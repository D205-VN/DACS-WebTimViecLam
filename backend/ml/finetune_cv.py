#!/usr/bin/env python3
"""
finetune_cv.py — Fine-tune the APTCV model for CV generation.

Takes a pre-trained APTCV model checkpoint and fine-tunes it on
instruction-following CV generation data. The model learns to generate
CV content given a system prompt + user request.

Data format (JSONL):
    {"text": "<|system|>You are a CV assistant.<|end|><|user|>Write a CV for...<|end|><|assistant|>Name: ...<|end|>"}

The script masks system+user prompt tokens (label=-100) so the model
only learns to predict the assistant's response.

Usage:
    python finetune_cv.py --pretrained_path checkpoints/step_50000.pt
    python finetune_cv.py --pretrained_path checkpoints/latest.pt --num_epochs 20
"""

import argparse
import json
import math
import os
import sys
import time
from pathlib import Path
from typing import Optional

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader, random_split
from tqdm import tqdm

# ── Project imports ──
sys.path.insert(0, os.path.dirname(__file__))
from train_tokenizer import load_tokenizer, DEFAULT_SAVE_PATH as DEFAULT_TOKENIZER_PATH

try:
    from model import APTCVModel, ModelConfig
except ImportError:
    print("⚠  Could not import APTCVModel from model.py")
    print("   Make sure backend/ml/model.py exists with APTCVModel and ModelConfig defined.")
    sys.exit(1)


# ──────────────────────────────────────────────────────────────
# Dataset
# ──────────────────────────────────────────────────────────────

class CVFinetuneDataset(Dataset):
    """
    Dataset for fine-tuning the APTCV model on CV generation tasks.

    Each sample is a JSONL line with {"text": "..."} containing the full
    conversation: system prompt → user request → assistant response.

    The dataset creates proper labels by masking (setting to -100) all tokens
    before and including the <|assistant|> marker, so the model only learns
    to generate the assistant's response.

    Args:
        data_path: Path to the JSONL file.
        tokenizer_path: Path to the tokenizer JSON.
        max_seq_len: Maximum sequence length (pad/truncate to this).
    """

    def __init__(
        self,
        data_path: str,
        tokenizer_path: str,
        max_seq_len: int = 1024,
        max_samples: Optional[int] = None,
    ):
        super().__init__()
        self.max_seq_len = max_seq_len

        # ── Load tokenizer ──
        self.tokenizer = load_tokenizer(tokenizer_path)
        self.tokenizer.no_padding()
        self.tokenizer.no_truncation()

        self.pad_token_id = self.tokenizer.token_to_id("<pad>")
        self.assistant_token_id = self.tokenizer.token_to_id("<|assistant|>")
        self.end_token_id = self.tokenizer.token_to_id("<|end|>")
        self.eos_token_id = self.tokenizer.token_to_id("</s>")

        # ── Load JSONL data ──
        if not os.path.isfile(data_path):
            raise FileNotFoundError(
                f"Fine-tuning data not found at '{data_path}'.\n"
                f"Create a JSONL file where each line is: "
                f'{{"text": "<|system|>...<|end|><|user|>...<|end|><|assistant|>...<|end|>"}}'
            )

        self.samples: list[dict] = []
        with open(data_path, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    sample = json.loads(line)
                    if "text" not in sample:
                        print(f"  ⚠  Line {line_num}: missing 'text' field, skipping")
                        continue
                    self.samples.append(sample)
                    if max_samples and len(self.samples) >= max_samples:
                        break
                except json.JSONDecodeError as e:
                    print(f"  ⚠  Line {line_num}: invalid JSON ({e}), skipping")

        print(f"Loaded {len(self.samples):,} fine-tuning samples from {data_path}")

        if len(self.samples) == 0:
            raise ValueError(f"No valid samples found in {data_path}")

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> dict[str, torch.Tensor]:
        """
        Tokenize a sample and create masked labels.

        Returns:
            input_ids: [max_seq_len] token IDs (padded)
            labels:    [max_seq_len] target IDs (-100 for masked positions)
            attention_mask: [max_seq_len] 1 for real tokens, 0 for padding
        """
        text = self.samples[idx]["text"]

        # Tokenize (no special tokens added — we handle them in the data)
        encoded = self.tokenizer.encode(text)
        token_ids = encoded.ids

        # Truncate if necessary (leave room for nothing — data should include all markers)
        if len(token_ids) > self.max_seq_len:
            token_ids = token_ids[: self.max_seq_len]

        seq_len = len(token_ids)

        # ── Find where assistant response starts ──
        # Keep the assistant marker position so it learns the first response token.
        assistant_start = self._find_assistant_start(token_ids)
        label_start = max(assistant_start - 1, 0) if assistant_start else 0

        # ── Create labels ──
        # For causal LM: labels[i] = input_ids[i+1] (shifted)
        # Mask all non-assistant tokens with -100
        labels = torch.full((self.max_seq_len,), -100, dtype=torch.long)

        for i in range(label_start, seq_len - 1):
            # Label at position i is the token at position i+1
            labels[i] = token_ids[i + 1]

        # ── Pad input_ids ──
        input_ids = torch.full((self.max_seq_len,), self.pad_token_id, dtype=torch.long)
        input_ids[:seq_len] = torch.tensor(token_ids, dtype=torch.long)

        # ── Attention mask ──
        attention_mask = torch.zeros(self.max_seq_len, dtype=torch.long)
        attention_mask[:seq_len] = 1

        return {
            "input_ids": input_ids,
            "labels": labels,
            "attention_mask": attention_mask,
        }

    def _find_assistant_start(self, token_ids: list[int]) -> int:
        """
        Find the index right after the last <|assistant|> token.

        This is where the model should start generating (and where we
        start computing loss).

        Args:
            token_ids: List of token IDs.

        Returns:
            Index of the first token after <|assistant|>. If not found,
            returns 0 (train on entire sequence as fallback).
        """
        # Find the LAST occurrence of <|assistant|> (in case there are multiple turns)
        last_idx = -1
        for i, tid in enumerate(token_ids):
            if tid == self.assistant_token_id:
                last_idx = i

        if last_idx == -1:
            # No assistant token found — fallback: train on everything
            # This handles malformed data gracefully
            return 0

        # Start training right after <|assistant|>
        return last_idx + 1


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
# Training
# ──────────────────────────────────────────────────────────────

def finetune(args: argparse.Namespace) -> None:
    """Main fine-tuning loop."""

    # ── Device ──
    device = select_device(args.device)
    if device.type == "cuda":
        print(f"🔥 Using CUDA: {torch.cuda.get_device_name(0)}")
    elif device.type == "mps":
        print("🍎 Using Apple MPS")
    else:
        print("💻 Using CPU")

    # ── Load pre-trained checkpoint ──
    if not os.path.isfile(args.pretrained_path):
        print(f"✗ Pre-trained checkpoint not found: {args.pretrained_path}")
        print("  Run pretrain.py first to create a pre-trained model.")
        sys.exit(1)

    print(f"Loading pre-trained model from: {args.pretrained_path}")
    checkpoint = torch.load(args.pretrained_path, map_location="cpu", weights_only=False)

    # Reconstruct config from checkpoint
    saved_config = checkpoint.get("config", None)
    if isinstance(saved_config, ModelConfig):
        # Config was saved as a dataclass instance directly
        config = saved_config
    elif isinstance(saved_config, dict):
        # Config was saved as a dict — reconstruct
        # Filter out computed fields like 'head_dim' that aren't init params
        init_fields = {f.name for f in ModelConfig.__dataclass_fields__.values() if f.init}
        filtered = {k: v for k, v in saved_config.items() if k in init_fields}
        config = ModelConfig(**filtered)
    else:
        config = ModelConfig()

    model = APTCVModel(config=config)
    model.load_state_dict(checkpoint["model_state_dict"])
    print(f"✓ Model loaded (trained for {checkpoint.get('step', '?')} steps)")

    total_params = sum(p.numel() for p in model.parameters())
    print(f"  Parameters: {total_params:,}")

    # ── Load tokenizer ──
    tokenizer_path = args.tokenizer_path or os.path.join(
        os.path.dirname(__file__), "tokenizer", "aptcv_tokenizer.json"
    )

    # ── Prepare dataset ──
    full_dataset = CVFinetuneDataset(
        data_path=args.data_path,
        tokenizer_path=tokenizer_path,
        max_seq_len=config.max_seq_len,
        max_samples=args.max_samples,
    )

    # ── Train/Validation split (90/10) ──
    total_size = len(full_dataset)
    if total_size < 2:
        raise ValueError("Need at least 2 fine-tuning samples for train/validation split.")
    val_size = max(1, int(total_size * 0.1))
    train_size = total_size - val_size

    train_dataset, val_dataset = random_split(
        full_dataset,
        [train_size, val_size],
        generator=torch.Generator().manual_seed(42),
    )

    print(f"Train samples: {train_size:,}")
    print(f"Val samples  : {val_size:,}")

    train_loader = DataLoader(
        train_dataset,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=args.num_workers,
        pin_memory=(device.type == "cuda"),
        drop_last=False,
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=args.num_workers,
        pin_memory=(device.type == "cuda"),
        drop_last=False,
    )

    # ── Move model to device ──
    model = model.to(device)
    pad_token_id = full_dataset.pad_token_id

    # ── Optimizer ──
    # Lower learning rate for fine-tuning to avoid catastrophic forgetting
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=args.learning_rate,
        betas=(0.9, 0.95),
        eps=1e-8,
        weight_decay=0.01,
    )

    # ── Learning rate scheduler: cosine with warmup ──
    total_steps = len(train_loader) * args.num_epochs
    warmup_steps = min(100, total_steps // 10)
    print(f"Total training steps: {total_steps:,}")
    print(f"Warmup steps: {warmup_steps}")

    # ── Mixed precision ──
    use_amp = (device.type == "cuda")
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)
    amp_dtype = torch.float16 if use_amp else torch.float32

    # ── Output directory ──
    os.makedirs(args.output_dir, exist_ok=True)

    # ── Training loop ──
    print(f"\n{'='*60}")
    print(f"  Starting Fine-tuning for CV Generation")
    print(f"{'='*60}")
    print(f"  Epochs         : {args.num_epochs}")
    print(f"  Batch size     : {args.batch_size}")
    print(f"  Learning rate  : {args.learning_rate}")
    print(f"  Mixed precision: {use_amp}")
    print(f"  Output dir     : {args.output_dir}")
    print(f"{'='*60}\n")

    best_val_loss = float("inf")
    global_step = 0
    start_time = time.time()

    for epoch in range(1, args.num_epochs + 1):
        # ── Train epoch ──
        model.train()
        epoch_loss = 0.0
        epoch_tokens = 0
        epoch_start = time.time()

        progress = tqdm(
            train_loader,
            desc=f"Epoch {epoch}/{args.num_epochs} [Train]",
            leave=True,
        )

        for batch_idx, batch in enumerate(progress):
            input_ids = batch["input_ids"].to(device)
            labels = batch["labels"].to(device)
            attention_mask = batch["attention_mask"].to(device)

            # Update learning rate
            lr = _get_finetune_lr(
                global_step, warmup_steps, total_steps, args.learning_rate
            )
            for param_group in optimizer.param_groups:
                param_group["lr"] = lr

            # Forward
            with torch.amp.autocast(device_type=device.type, dtype=amp_dtype, enabled=use_amp):
                logits, _ = model(input_ids)  # [B, seq_len, vocab_size]; ignore built-in loss
                loss = nn.functional.cross_entropy(
                    logits.reshape(-1, logits.size(-1)),
                    labels.reshape(-1),
                    ignore_index=-100,
                )

            # Backward
            scaler.scale(loss).backward()
            scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            scaler.step(optimizer)
            scaler.update()
            optimizer.zero_grad()

            # Track metrics
            batch_loss = loss.item()
            num_target_tokens = (labels != -100).sum().item()
            epoch_loss += batch_loss * num_target_tokens
            epoch_tokens += num_target_tokens
            global_step += 1

            # Update progress bar
            progress.set_postfix(
                loss=f"{batch_loss:.4f}",
                lr=f"{lr:.2e}",
            )

        # ── Epoch train metrics ──
        avg_train_loss = epoch_loss / max(epoch_tokens, 1)
        train_ppl = math.exp(min(avg_train_loss, 20))
        epoch_time = time.time() - epoch_start

        # ── Validation ──
        val_loss, val_ppl = evaluate(model, val_loader, device, use_amp, amp_dtype)

        print(
            f"\n  Epoch {epoch:>2}/{args.num_epochs} | "
            f"Train Loss: {avg_train_loss:.4f} (PPL: {train_ppl:.1f}) | "
            f"Val Loss: {val_loss:.4f} (PPL: {val_ppl:.1f}) | "
            f"LR: {lr:.2e} | "
            f"Time: {epoch_time:.0f}s"
        )

        # ── Save best model ──
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_path = os.path.join(args.output_dir, "aptcv_cv_best.pt")
            _save_finetuned(model, config, epoch, val_loss, best_path)
            print(f"  ★ New best model saved! (val_loss: {val_loss:.4f})")

        # ── Save periodic checkpoint ──
        if epoch % 5 == 0 or epoch == args.num_epochs:
            ckpt_path = os.path.join(args.output_dir, f"aptcv_cv_epoch_{epoch}.pt")
            _save_finetuned(model, config, epoch, val_loss, ckpt_path)

    # ── Final summary ──
    total_time = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"  Fine-tuning Complete!")
    print(f"  Total time      : {total_time / 60:.1f} minutes")
    print(f"  Best val loss   : {best_val_loss:.4f}")
    print(f"  Best model saved: {os.path.join(args.output_dir, 'aptcv_cv_best.pt')}")
    print(f"{'='*60}\n")


# ──────────────────────────────────────────────────────────────
# Evaluation
# ──────────────────────────────────────────────────────────────

@torch.no_grad()
def evaluate(
    model: nn.Module,
    dataloader: DataLoader,
    device: torch.device,
    use_amp: bool,
    amp_dtype: torch.dtype,
) -> tuple[float, float]:
    """
    Evaluate the model on a validation set.

    Returns:
        Tuple of (average_loss, perplexity).
    """
    model.eval()
    total_loss = 0.0
    total_tokens = 0

    for batch in dataloader:
        input_ids = batch["input_ids"].to(device)
        labels = batch["labels"].to(device)

        with torch.amp.autocast(device_type=device.type, dtype=amp_dtype, enabled=use_amp):
            logits, _ = model(input_ids)  # ignore built-in loss
            loss = nn.functional.cross_entropy(
                logits.reshape(-1, logits.size(-1)),
                labels.reshape(-1),
                ignore_index=-100,
                reduction="sum",
            )

        num_tokens = (labels != -100).sum().item()
        total_loss += loss.item()
        total_tokens += num_tokens

    model.train()

    avg_loss = total_loss / max(total_tokens, 1)
    ppl = math.exp(min(avg_loss, 20))
    return avg_loss, ppl


# ──────────────────────────────────────────────────────────────
# Utilities
# ──────────────────────────────────────────────────────────────

def _get_finetune_lr(
    step: int,
    warmup_steps: int,
    total_steps: int,
    max_lr: float,
    min_lr: float = 1e-6,
) -> float:
    """Cosine LR schedule with linear warmup for fine-tuning."""
    if step < warmup_steps:
        return max_lr * (step + 1) / warmup_steps
    progress = (step - warmup_steps) / max(total_steps - warmup_steps, 1)
    return min_lr + 0.5 * (max_lr - min_lr) * (1.0 + math.cos(math.pi * progress))


def _save_finetuned(
    model: nn.Module,
    config: "ModelConfig",
    epoch: int,
    val_loss: float,
    path: str,
) -> None:
    """Save a fine-tuned model checkpoint."""
    torch.save(
        {
            "model_state_dict": model.state_dict(),
            "config": config.__dict__ if hasattr(config, "__dict__") else vars(config),
            "epoch": epoch,
            "val_loss": val_loss,
            "task": "cv_generation",
        },
        path,
    )
    print(f"  💾 Saved: {path}")


# ──────────────────────────────────────────────────────────────
# CLI Entry Point
# ──────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fine-tune the APTCV model for CV generation.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--pretrained_path",
        type=str,
        required=True,
        help="Path to the pre-trained model checkpoint (.pt file).",
    )
    parser.add_argument(
        "--tokenizer_path",
        type=str,
        default=None,
        help="Path to tokenizer JSON. Defaults to tokenizer/aptcv_tokenizer.json.",
    )
    parser.add_argument(
        "--data_path",
        type=str,
        default=os.path.join(os.path.dirname(__file__), "data", "cv_finetune.jsonl"),
        help="Path to the fine-tuning JSONL data file.",
    )
    parser.add_argument(
        "--batch_size",
        type=int,
        default=8,
        help="Training batch size.",
    )
    parser.add_argument(
        "--max_samples",
        type=int,
        default=None,
        help="Optional cap for quick smoke fine-tuning runs.",
    )
    parser.add_argument(
        "--num_workers",
        type=int,
        default=min(2, os.cpu_count() or 1),
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
        "--learning_rate",
        type=float,
        default=5e-5,
        help="Peak learning rate for fine-tuning.",
    )
    parser.add_argument(
        "--num_epochs",
        type=int,
        default=10,
        help="Number of fine-tuning epochs.",
    )
    parser.add_argument(
        "--output_dir",
        type=str,
        default=os.path.join(os.path.dirname(__file__), "models"),
        help="Directory to save fine-tuned models.",
    )

    args = parser.parse_args()
    finetune(args)


if __name__ == "__main__":
    main()
