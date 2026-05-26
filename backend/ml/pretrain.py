#!/usr/bin/env python3
"""
pretrain.py — Pre-training script for the APTCV transformer model.

Trains the model on a large text corpus using next-token prediction (causal LM).
Supports mixed-precision training, gradient accumulation, checkpointing, and
resume-from-checkpoint.

Usage:
    python pretrain.py
    python pretrain.py --batch_size 8 --learning_rate 1e-4 --max_steps 100000
    python pretrain.py --resume checkpoints/step_10000.pt
"""

import argparse
import math
import os
import sys
import time
from pathlib import Path
from typing import Optional

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader, IterableDataset
from tqdm import tqdm

# ── Project imports ──
# Add parent directory to path so we can import the model
sys.path.insert(0, os.path.dirname(__file__))
from train_tokenizer import load_tokenizer, DEFAULT_SAVE_PATH as DEFAULT_TOKENIZER_PATH

# Try to import the model — provide helpful error if not found
try:
    from model import APTCVModel, ModelConfig
except ImportError:
    print("⚠  Could not import APTCVModel from model.py")
    print("   Make sure backend/ml/model.py exists with APTCVModel and ModelConfig defined.")
    sys.exit(1)


# ──────────────────────────────────────────────────────────────
# Dataset
# ──────────────────────────────────────────────────────────────

class PretrainDataset(Dataset):
    """
    Dataset for causal language model pre-training.

    Reads a text corpus, tokenizes it, and splits it into fixed-length chunks
    of `seq_len` tokens. Each chunk is an independent training sample where
    the model learns to predict the next token.

    Args:
        tokenizer_path: Path to the tokenizer JSON file.
        data_path: Path to the pre-training text corpus.
        seq_len: Length of each token chunk (context window).
    """

    def __init__(
        self,
        tokenizer_path: str,
        data_path: str,
        seq_len: int = 1024,
    ):
        super().__init__()
        self.seq_len = seq_len

        # ── Load tokenizer ──
        print(f"Loading tokenizer from: {tokenizer_path}")
        self.tokenizer = load_tokenizer(tokenizer_path)
        # Disable automatic padding/truncation for pre-training
        self.tokenizer.no_padding()
        self.tokenizer.no_truncation()

        # ── Load and tokenize corpus ──
        print(f"Loading corpus from: {data_path}")
        if not os.path.isfile(data_path):
            raise FileNotFoundError(
                f"Pre-training corpus not found at '{data_path}'.\n"
                f"Create a text file with your training data (one document per line "
                f"or paragraph-separated)."
            )

        with open(data_path, "r", encoding="utf-8") as f:
            text = f.read()

        print(f"Corpus size: {len(text):,} characters")
        print("Tokenizing corpus (this may take a while)...")

        # Tokenize the entire corpus into one long sequence of token IDs.
        # For large corpora, we process in chunks to avoid memory issues.
        all_ids: list[int] = []
        chunk_size = 100_000  # characters per chunk
        for i in range(0, len(text), chunk_size):
            chunk = text[i : i + chunk_size]
            encoded = self.tokenizer.encode(chunk)
            all_ids.extend(encoded.ids)

        self.token_ids = np.array(all_ids, dtype=np.int64)
        total_tokens = len(self.token_ids)
        self.num_chunks = max(0, (total_tokens - 1) // seq_len)

        print(f"Total tokens: {total_tokens:,}")
        print(f"Chunk size: {seq_len}")
        print(f"Number of training chunks: {self.num_chunks:,}")

        if self.num_chunks == 0:
            raise ValueError(
                f"Corpus is too small ({total_tokens} tokens) for seq_len={seq_len}. "
                f"Need at least {seq_len + 1} tokens."
            )

    def __len__(self) -> int:
        return self.num_chunks

    def __getitem__(self, idx: int) -> dict[str, torch.Tensor]:
        """
        Returns a chunk of tokens as input_ids and labels.

        For causal LM training:
        - input_ids = tokens[i : i + seq_len]
        - labels    = tokens[i + 1 : i + seq_len + 1]  (shifted by 1)
        """
        start = idx * self.seq_len
        end = start + self.seq_len

        # Ensure we have room for the label shift (+1)
        chunk = self.token_ids[start : end + 1]

        input_ids = torch.tensor(chunk[:-1], dtype=torch.long)  # [seq_len]
        labels = torch.tensor(chunk[1:], dtype=torch.long)      # [seq_len]

        return {"input_ids": input_ids, "labels": labels}


# ──────────────────────────────────────────────────────────────
# Learning Rate Scheduler (Cosine with Linear Warmup)
# ──────────────────────────────────────────────────────────────

def get_lr(step: int, warmup_steps: int, max_steps: int, max_lr: float, min_lr: float = 1e-6) -> float:
    """
    Cosine learning rate schedule with linear warmup.

    Args:
        step: Current training step.
        warmup_steps: Number of warmup steps (linear ramp-up).
        max_steps: Total number of training steps.
        max_lr: Peak learning rate (reached after warmup).
        min_lr: Minimum learning rate at the end of cosine decay.

    Returns:
        Learning rate for the current step.
    """
    if warmup_steps > 0 and step < warmup_steps:
        # Linear warmup: 0 → max_lr
        return max_lr * (step + 1) / warmup_steps
    elif step >= max_steps:
        return min_lr
    else:
        # Cosine decay: max_lr → min_lr
        progress = (step - warmup_steps) / max(max_steps - warmup_steps, 1)
        return min_lr + 0.5 * (max_lr - min_lr) * (1.0 + math.cos(math.pi * progress))


def select_device(device_name: str = "auto") -> torch.device:
    """Select a training device with an explicit override for smoke tests."""
    if device_name != "auto":
        return torch.device(device_name)

    if torch.cuda.is_available():
        return torch.device("cuda")
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


# ──────────────────────────────────────────────────────────────
# Training Loop
# ──────────────────────────────────────────────────────────────

def train(args: argparse.Namespace) -> None:
    """Main pre-training loop."""

    # ── Device selection ──
    device = select_device(args.device)
    if device.type == "cuda":
        print(f"🔥 Using CUDA: {torch.cuda.get_device_name(0)}")
        print(f"   VRAM: {torch.cuda.get_device_properties(0).total_mem / 1e9:.1f} GB")
    elif device.type == "mps":
        print("🍎 Using Apple MPS (Metal Performance Shaders)")
    else:
        print("💻 Using CPU (training will be slow)")

    # ── Load tokenizer to get vocab size ──
    tokenizer = load_tokenizer(args.tokenizer_path)
    vocab_size = tokenizer.get_vocab_size()
    pad_token_id = tokenizer.token_to_id("<pad>")
    print(f"Vocab size: {vocab_size:,}")

    # ── Build model ──
    config = ModelConfig(
        vocab_size=vocab_size,
        hidden_dim=args.hidden_dim,
        num_layers=args.num_layers,
        num_heads=args.num_heads,
        ffn_dim=args.ffn_dim,
        max_seq_len=args.max_seq_len,
        dropout=args.dropout,
    )
    model = APTCVModel(config=config)

    # Print model size
    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"Model parameters: {total_params:,} total, {trainable_params:,} trainable")
    print(f"Model size: ~{total_params * 4 / 1e6:.1f} MB (float32)")

    # ── Prepare dataset ──
    dataset = PretrainDataset(
        tokenizer_path=args.tokenizer_path,
        data_path=args.data_path,
        seq_len=config.max_seq_len,
    )

    dataloader = DataLoader(
        dataset,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=args.num_workers,
        pin_memory=(device.type == "cuda"),
        drop_last=True,
    )

    total_training_tokens = args.max_steps * args.batch_size * args.gradient_accumulation * config.max_seq_len
    print(f"\nTotal training tokens (estimated): {total_training_tokens:,}")

    # ── Optimizer ──
    # Separate weight decay for different parameter groups
    decay_params = []
    no_decay_params = []
    for name, param in model.named_parameters():
        if not param.requires_grad:
            continue
        # Don't apply weight decay to bias, LayerNorm, or embedding parameters
        if (
            "bias" in name
            or "norm" in name
            or "embedding" in name
            or "tok_emb" in name
            or "lm_head" in name
        ):
            no_decay_params.append(param)
        else:
            decay_params.append(param)

    optimizer = torch.optim.AdamW(
        [
            {"params": decay_params, "weight_decay": args.weight_decay},
            {"params": no_decay_params, "weight_decay": 0.0},
        ],
        lr=args.learning_rate,
        betas=(0.9, 0.95),
        eps=1e-8,
    )

    # ── Mixed precision setup ──
    use_amp = (device.type == "cuda")
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)
    amp_dtype = torch.float16 if use_amp else torch.float32

    # ── Resume from checkpoint ──
    start_step = 0
    if args.resume:
        if not os.path.isfile(args.resume):
            print(f"⚠  Checkpoint not found: {args.resume}")
            sys.exit(1)
        print(f"\nResuming from checkpoint: {args.resume}")
        checkpoint = torch.load(args.resume, map_location="cpu", weights_only=False)
        model.load_state_dict(checkpoint["model_state_dict"])
        optimizer.load_state_dict(checkpoint["optimizer_state_dict"])
        if "scaler_state_dict" in checkpoint and use_amp:
            scaler.load_state_dict(checkpoint["scaler_state_dict"])
        start_step = checkpoint.get("step", 0)
        print(f"Resumed at step {start_step}")

    model = model.to(device)

    # ── Checkpoint directory ──
    os.makedirs(args.checkpoint_dir, exist_ok=True)

    # ── Training ──
    print(f"\n{'='*60}")
    print(f"  Starting Pre-training")
    print(f"{'='*60}")
    print(f"  Batch size          : {args.batch_size}")
    print(f"  Gradient accumulation: {args.gradient_accumulation}")
    print(f"  Effective batch size : {args.batch_size * args.gradient_accumulation}")
    print(f"  Learning rate       : {args.learning_rate}")
    print(f"  Max steps           : {args.max_steps:,}")
    print(f"  Warmup steps        : {args.warmup_steps:,}")
    print(f"  Mixed precision     : {use_amp}")
    print(f"  Device              : {device}")
    print(f"{'='*60}\n")

    model.train()
    optimizer.zero_grad()

    step = start_step
    running_loss = 0.0
    tokens_processed = 0
    start_time = time.time()
    log_start_time = time.time()

    # Infinite data iterator (loop over epochs)
    data_iter = iter(dataloader)

    while step < args.max_steps:
        # ── Get next batch (restart dataloader if exhausted) ──
        try:
            batch = next(data_iter)
        except StopIteration:
            data_iter = iter(dataloader)
            batch = next(data_iter)

        input_ids = batch["input_ids"].to(device)   # [B, seq_len]
        labels = batch["labels"].to(device)          # [B, seq_len]

        # ── Forward pass with mixed precision ──
        with torch.amp.autocast(device_type=device.type, dtype=amp_dtype, enabled=use_amp):
            # model.forward() returns (logits, loss) when labels are provided
            # We pass labels directly to leverage the model's built-in loss computation
            # but we also compute our own to control ignore_index properly
            logits, _ = model(input_ids)  # [B, seq_len, vocab_size]
            # Flatten for cross-entropy with custom ignore_index
            loss = nn.functional.cross_entropy(
                logits.reshape(-1, logits.size(-1)),
                labels.reshape(-1),
                ignore_index=pad_token_id,
            )
            # Scale loss for gradient accumulation
            loss = loss / args.gradient_accumulation

        # ── Backward pass ──
        scaler.scale(loss).backward()

        running_loss += loss.item() * args.gradient_accumulation
        tokens_processed += input_ids.numel()

        # ── Optimizer step (after accumulation) ──
        if (step + 1) % args.gradient_accumulation == 0 or step == args.max_steps - 1:
            # Gradient clipping
            scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)

            # Update learning rate
            lr = get_lr(step, args.warmup_steps, args.max_steps, args.learning_rate)
            for param_group in optimizer.param_groups:
                param_group["lr"] = lr

            scaler.step(optimizer)
            scaler.update()
            optimizer.zero_grad()

        step += 1

        # ── Logging ──
        if step % args.log_interval == 0:
            elapsed = time.time() - log_start_time
            tokens_per_sec = tokens_processed / elapsed if elapsed > 0 else 0
            avg_loss = running_loss / args.log_interval
            current_lr = get_lr(step, args.warmup_steps, args.max_steps, args.learning_rate)

            # Estimated time remaining
            total_elapsed = time.time() - start_time
            steps_done = step - start_step
            if steps_done > 0:
                time_per_step = total_elapsed / steps_done
                remaining_steps = args.max_steps - step
                eta_seconds = remaining_steps * time_per_step
                eta_str = _format_time(eta_seconds)
            else:
                eta_str = "N/A"

            # Perplexity
            ppl = math.exp(min(avg_loss, 20))  # clip to avoid overflow

            print(
                f"Step {step:>7,}/{args.max_steps:,} | "
                f"Loss: {avg_loss:.4f} | "
                f"PPL: {ppl:.1f} | "
                f"LR: {current_lr:.2e} | "
                f"Tok/s: {tokens_per_sec:,.0f} | "
                f"ETA: {eta_str}"
            )

            running_loss = 0.0
            tokens_processed = 0
            log_start_time = time.time()

        # ── Checkpoint saving ──
        should_save = step == args.max_steps or (
            args.save_interval > 0 and step % args.save_interval == 0
        )
        if should_save:
            save_checkpoint(
                model=model,
                optimizer=optimizer,
                scaler=scaler,
                step=step,
                config=config,
                checkpoint_dir=args.checkpoint_dir,
            )

    # ── Final save ──
    total_time = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"  Pre-training Complete!")
    print(f"  Total time: {_format_time(total_time)}")
    print(f"  Final checkpoint: {args.checkpoint_dir}/step_{step}.pt")
    print(f"{'='*60}\n")


# ──────────────────────────────────────────────────────────────
# Checkpoint Utilities
# ──────────────────────────────────────────────────────────────

def save_checkpoint(
    model: nn.Module,
    optimizer: torch.optim.Optimizer,
    scaler: torch.amp.GradScaler,
    step: int,
    config: "ModelConfig",
    checkpoint_dir: str,
) -> None:
    """Save a training checkpoint."""
    path = os.path.join(checkpoint_dir, f"step_{step}.pt")
    checkpoint = {
        "step": step,
        "model_state_dict": model.state_dict(),
        "optimizer_state_dict": optimizer.state_dict(),
        "scaler_state_dict": scaler.state_dict(),
        "config": config.__dict__ if hasattr(config, "__dict__") else vars(config),
    }
    torch.save(checkpoint, path)
    print(f"  💾 Checkpoint saved: {path}")

    # Also save a "latest" symlink/copy for easy resume
    latest_path = os.path.join(checkpoint_dir, "latest.pt")
    torch.save(checkpoint, latest_path)


def _format_time(seconds: float) -> str:
    """Format seconds into a human-readable string."""
    if seconds < 60:
        return f"{seconds:.0f}s"
    elif seconds < 3600:
        return f"{seconds / 60:.1f}m"
    else:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        return f"{hours}h {minutes}m"


# ──────────────────────────────────────────────────────────────
# CLI Entry Point
# ──────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Pre-train the APTCV transformer model on a text corpus.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--tokenizer_path",
        type=str,
        default=os.path.join(os.path.dirname(__file__), "tokenizer", "aptcv_tokenizer.json"),
        help="Path to the trained tokenizer JSON file.",
    )
    parser.add_argument(
        "--data_path",
        type=str,
        default=os.path.join(os.path.dirname(__file__), "data", "pretrain_corpus.txt"),
        help="Path to the pre-training text corpus.",
    )
    parser.add_argument(
        "--batch_size",
        type=int,
        default=16,
        help="Batch size per step (before gradient accumulation).",
    )
    parser.add_argument(
        "--learning_rate",
        type=float,
        default=3e-4,
        help="Peak learning rate.",
    )
    parser.add_argument(
        "--hidden_dim",
        type=int,
        default=512,
        help="Transformer hidden size.",
    )
    parser.add_argument(
        "--num_layers",
        type=int,
        default=8,
        help="Number of transformer blocks.",
    )
    parser.add_argument(
        "--num_heads",
        type=int,
        default=8,
        help="Number of attention heads.",
    )
    parser.add_argument(
        "--ffn_dim",
        type=int,
        default=2048,
        help="Feed-forward hidden size.",
    )
    parser.add_argument(
        "--max_seq_len",
        type=int,
        default=1024,
        help="Maximum sequence length used for training chunks.",
    )
    parser.add_argument(
        "--dropout",
        type=float,
        default=0.1,
        help="Dropout probability.",
    )
    parser.add_argument(
        "--weight_decay",
        type=float,
        default=0.01,
        help="Weight decay for AdamW optimizer.",
    )
    parser.add_argument(
        "--max_steps",
        type=int,
        default=50_000,
        help="Maximum number of training steps.",
    )
    parser.add_argument(
        "--warmup_steps",
        type=int,
        default=1000,
        help="Number of linear warmup steps.",
    )
    parser.add_argument(
        "--gradient_accumulation",
        type=int,
        default=4,
        help="Number of gradient accumulation steps.",
    )
    parser.add_argument(
        "--log_interval",
        type=int,
        default=100,
        help="Log every N training steps.",
    )
    parser.add_argument(
        "--save_interval",
        type=int,
        default=2000,
        help="Save a checkpoint every N steps. Final checkpoint is always saved.",
    )
    parser.add_argument(
        "--num_workers",
        type=int,
        default=min(4, os.cpu_count() or 1),
        help="DataLoader worker processes.",
    )
    parser.add_argument(
        "--device",
        type=str,
        default="auto",
        choices=["auto", "cpu", "cuda", "mps"],
        help="Training device.",
    )
    parser.add_argument(
        "--checkpoint_dir",
        type=str,
        default=os.path.join(os.path.dirname(__file__), "checkpoints"),
        help="Directory to save training checkpoints.",
    )
    parser.add_argument(
        "--resume",
        type=str,
        default=None,
        help="Path to a checkpoint to resume training from.",
    )

    args = parser.parse_args()
    train(args)


if __name__ == "__main__":
    main()
