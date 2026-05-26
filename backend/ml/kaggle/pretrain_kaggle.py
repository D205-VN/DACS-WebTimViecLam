"""
APT-CV Model — Kaggle Pre-training Script
==========================================
Copy this entire script into a Kaggle notebook cell to pre-train the
aptcv-model on English text data.

Prerequisites:
    1. Upload the `ml/` folder to Kaggle as a dataset or use Git.
    2. Enable GPU accelerator (P100 or T4).
    3. Install dependencies: !pip install tokenizers tqdm

Estimated time: 15-20h on P100 for 50K steps.

Instructions:
    1. Create a new Kaggle notebook
    2. Turn on GPU (Settings -> Accelerator -> GPU P100)
    3. Upload your trained tokenizer (aptcv_tokenizer.json)
    4. Run this script
"""

import os
import sys
import json
import time
import math
import glob
import argparse
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torch.cuda.amp import autocast, GradScaler

# ============================================================================
# Check environment
# ============================================================================

print("=" * 60)
print("APT-CV Pre-training on Kaggle")
print("=" * 60)

if torch.cuda.is_available():
    gpu_name = torch.cuda.get_device_name(0)
    gpu_mem = torch.cuda.get_device_properties(0).total_mem / 1e9
    print(f"GPU: {gpu_name} ({gpu_mem:.1f} GB)")
    DEVICE = torch.device("cuda")
else:
    print("WARNING: No GPU detected! Training will be very slow.")
    DEVICE = torch.device("cpu")

# ============================================================================
# Configuration
# ============================================================================

CONFIG = {
    # Model architecture
    "vocab_size": 16000,
    "hidden_dim": 512,
    "num_layers": 8,
    "num_heads": 8,
    "ffn_dim": 2048,
    "max_seq_len": 1024,
    "dropout": 0.1,

    # Training
    "batch_size": 16,
    "learning_rate": 3e-4,
    "weight_decay": 0.01,
    "max_steps": 50000,
    "warmup_steps": 1000,
    "gradient_accumulation": 4,
    "max_grad_norm": 1.0,

    # Logging & checkpoints
    "log_interval": 100,
    "save_interval": 2000,
    "checkpoint_dir": "/kaggle/working/checkpoints",

    # Data
    "tokenizer_path": "/kaggle/input/aptcv-tokenizer/aptcv_tokenizer.json",
    "data_dir": "/kaggle/input/aptcv-pretrain-data",
}

os.makedirs(CONFIG["checkpoint_dir"], exist_ok=True)

# ============================================================================
# Model Definition (inline for Kaggle portability)
# ============================================================================

class RMSNorm(nn.Module):
    def __init__(self, dim, eps=1e-6):
        super().__init__()
        self.weight = nn.Parameter(torch.ones(dim))
        self.eps = eps

    def forward(self, x):
        norm = torch.rsqrt(x.pow(2).mean(-1, keepdim=True) + self.eps)
        return x * norm * self.weight


class RotaryEmbedding(nn.Module):
    def __init__(self, dim, max_seq_len=2048):
        super().__init__()
        inv_freq = 1.0 / (10000.0 ** (torch.arange(0, dim, 2).float() / dim))
        self.register_buffer("inv_freq", inv_freq)
        self.max_seq_len = max_seq_len

    def forward(self, seq_len, device):
        t = torch.arange(seq_len, device=device, dtype=self.inv_freq.dtype)
        freqs = torch.outer(t, self.inv_freq)
        emb = torch.cat((freqs, freqs), dim=-1)
        return emb.cos().unsqueeze(0), emb.sin().unsqueeze(0)


def rotate_half(x):
    x1, x2 = x.chunk(2, dim=-1)
    return torch.cat((-x2, x1), dim=-1)


def apply_rotary_pos_emb(q, k, cos, sin):
    q_embed = (q * cos) + (rotate_half(q) * sin)
    k_embed = (k * cos) + (rotate_half(k) * sin)
    return q_embed, k_embed


class CausalSelfAttention(nn.Module):
    def __init__(self, hidden_dim, num_heads, max_seq_len=1024, dropout=0.1):
        super().__init__()
        assert hidden_dim % num_heads == 0
        self.num_heads = num_heads
        self.head_dim = hidden_dim // num_heads
        self.q_proj = nn.Linear(hidden_dim, hidden_dim, bias=False)
        self.k_proj = nn.Linear(hidden_dim, hidden_dim, bias=False)
        self.v_proj = nn.Linear(hidden_dim, hidden_dim, bias=False)
        self.out_proj = nn.Linear(hidden_dim, hidden_dim, bias=False)
        self.attn_dropout = nn.Dropout(dropout)
        self.resid_dropout = nn.Dropout(dropout)
        self.rope = RotaryEmbedding(self.head_dim, max_seq_len)

    def forward(self, x):
        B, T, C = x.shape
        q = self.q_proj(x).view(B, T, self.num_heads, self.head_dim).transpose(1, 2)
        k = self.k_proj(x).view(B, T, self.num_heads, self.head_dim).transpose(1, 2)
        v = self.v_proj(x).view(B, T, self.num_heads, self.head_dim).transpose(1, 2)

        cos, sin = self.rope(T, x.device)
        cos = cos.unsqueeze(1)
        sin = sin.unsqueeze(1)
        q, k = apply_rotary_pos_emb(q, k, cos, sin)

        attn_output = torch.nn.functional.scaled_dot_product_attention(
            q, k, v, is_causal=True, dropout_p=self.attn_dropout.p if self.training else 0.0,
        )
        attn_output = attn_output.transpose(1, 2).contiguous().view(B, T, C)
        return self.resid_dropout(self.out_proj(attn_output))


class FeedForward(nn.Module):
    def __init__(self, hidden_dim, ffn_dim, dropout=0.1):
        super().__init__()
        self.gate_proj = nn.Linear(hidden_dim, ffn_dim, bias=False)
        self.up_proj = nn.Linear(hidden_dim, ffn_dim, bias=False)
        self.down_proj = nn.Linear(ffn_dim, hidden_dim, bias=False)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x):
        return self.dropout(self.down_proj(nn.functional.silu(self.gate_proj(x)) * self.up_proj(x)))


class TransformerBlock(nn.Module):
    def __init__(self, hidden_dim, num_heads, ffn_dim, max_seq_len=1024, dropout=0.1):
        super().__init__()
        self.ln1 = RMSNorm(hidden_dim)
        self.attn = CausalSelfAttention(hidden_dim, num_heads, max_seq_len, dropout)
        self.ln2 = RMSNorm(hidden_dim)
        self.ffn = FeedForward(hidden_dim, ffn_dim, dropout)

    def forward(self, x):
        x = x + self.attn(self.ln1(x))
        x = x + self.ffn(self.ln2(x))
        return x


class APTCVModel(nn.Module):
    def __init__(self, vocab_size=16000, hidden_dim=512, num_layers=8,
                 num_heads=8, ffn_dim=2048, max_seq_len=1024, dropout=0.1):
        super().__init__()
        self.config = {
            "vocab_size": vocab_size, "hidden_dim": hidden_dim,
            "num_layers": num_layers, "num_heads": num_heads,
            "ffn_dim": ffn_dim, "max_seq_len": max_seq_len, "dropout": dropout,
        }
        self.token_emb = nn.Embedding(vocab_size, hidden_dim)
        self.drop = nn.Dropout(dropout)
        self.layers = nn.ModuleList([
            TransformerBlock(hidden_dim, num_heads, ffn_dim, max_seq_len, dropout)
            for _ in range(num_layers)
        ])
        self.ln_final = RMSNorm(hidden_dim)
        self.lm_head = nn.Linear(hidden_dim, vocab_size, bias=False)
        self.lm_head.weight = self.token_emb.weight  # weight tying

        total_params = sum(p.numel() for p in self.parameters())
        print(f"APTCVModel initialized: {total_params:,} parameters")

    def forward(self, input_ids, labels=None):
        x = self.drop(self.token_emb(input_ids))
        for layer in self.layers:
            x = layer(x)
        logits = self.lm_head(self.ln_final(x))

        loss = None
        if labels is not None:
            shift_logits = logits[:, :-1, :].contiguous()
            shift_labels = labels[:, 1:].contiguous()
            loss = nn.functional.cross_entropy(
                shift_logits.view(-1, shift_logits.size(-1)),
                shift_labels.view(-1),
                ignore_index=-100,
            )
        return logits, loss

# ============================================================================
# Dataset
# ============================================================================

class TextDataset(Dataset):
    def __init__(self, token_ids, seq_len):
        self.seq_len = seq_len
        n = len(token_ids) - seq_len
        self.num_samples = max(1, n // seq_len)
        self.token_ids = token_ids[:self.num_samples * seq_len + seq_len]

    def __len__(self):
        return self.num_samples

    def __getitem__(self, idx):
        start = idx * self.seq_len
        chunk = self.token_ids[start:start + self.seq_len + 1]
        x = torch.tensor(chunk[:-1], dtype=torch.long)
        y = torch.tensor(chunk[1:], dtype=torch.long)
        return x, y

# ============================================================================
# Training loop
# ============================================================================

def train():
    from tokenizers import Tokenizer

    # Load tokenizer
    print(f"\nLoading tokenizer from: {CONFIG['tokenizer_path']}")
    tokenizer = Tokenizer.from_file(CONFIG["tokenizer_path"])
    actual_vocab = tokenizer.get_vocab_size()
    print(f"Tokenizer vocab size: {actual_vocab}")

    # Update vocab size to match tokenizer
    CONFIG["vocab_size"] = actual_vocab

    # Load and tokenize text data
    print(f"\nLoading text data from: {CONFIG['data_dir']}")
    text_files = glob.glob(os.path.join(CONFIG["data_dir"], "*.txt"))
    if not text_files:
        print("ERROR: No .txt files found in data directory!")
        print("Please upload text files for pre-training.")
        print("You can use English Wikipedia, news articles, or any clean text.")
        return

    all_text = []
    for fp in sorted(text_files):
        with open(fp, "r", encoding="utf-8") as f:
            all_text.append(f.read())
        print(f"  Loaded: {os.path.basename(fp)} ({len(all_text[-1]):,} chars)")

    combined = "\n\n".join(all_text)
    print(f"\nTotal text: {len(combined):,} characters")

    # Tokenize
    print("Tokenizing...")
    encoded = tokenizer.encode(combined)
    token_ids = encoded.ids
    print(f"Total tokens: {len(token_ids):,}")

    # Create dataset
    dataset = TextDataset(token_ids, CONFIG["max_seq_len"])
    dataloader = DataLoader(
        dataset,
        batch_size=CONFIG["batch_size"],
        shuffle=True,
        num_workers=2,
        pin_memory=True,
        drop_last=True,
    )
    print(f"Dataset: {len(dataset):,} samples")
    print(f"Batches per epoch: {len(dataloader):,}")

    total_tokens_per_step = (
        CONFIG["batch_size"] * CONFIG["max_seq_len"] * CONFIG["gradient_accumulation"]
    )
    total_tokens = total_tokens_per_step * CONFIG["max_steps"]
    print(f"Total training tokens: {total_tokens:,}")

    # Initialize model
    model = APTCVModel(
        vocab_size=CONFIG["vocab_size"],
        hidden_dim=CONFIG["hidden_dim"],
        num_layers=CONFIG["num_layers"],
        num_heads=CONFIG["num_heads"],
        ffn_dim=CONFIG["ffn_dim"],
        max_seq_len=CONFIG["max_seq_len"],
        dropout=CONFIG["dropout"],
    ).to(DEVICE)

    # Optimizer
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=CONFIG["learning_rate"],
        weight_decay=CONFIG["weight_decay"],
        betas=(0.9, 0.95),
    )

    # Learning rate schedule: linear warmup + cosine decay
    def lr_schedule(step):
        if step < CONFIG["warmup_steps"]:
            return step / CONFIG["warmup_steps"]
        decay_ratio = (step - CONFIG["warmup_steps"]) / (CONFIG["max_steps"] - CONFIG["warmup_steps"])
        return 0.5 * (1.0 + math.cos(math.pi * decay_ratio))

    scheduler = torch.optim.lr_scheduler.LambdaLR(optimizer, lr_schedule)

    # Mixed precision
    use_amp = DEVICE.type == "cuda"
    scaler = GradScaler(enabled=use_amp)

    # Training
    print(f"\n{'='*60}")
    print(f"Starting pre-training...")
    print(f"Device: {DEVICE} | AMP: {use_amp}")
    print(f"Batch: {CONFIG['batch_size']} x {CONFIG['gradient_accumulation']} accum")
    print(f"Max steps: {CONFIG['max_steps']:,}")
    print(f"{'='*60}\n")

    model.train()
    global_step = 0
    total_loss = 0.0
    best_loss = float("inf")
    start_time = time.time()
    data_iter = iter(dataloader)

    while global_step < CONFIG["max_steps"]:
        optimizer.zero_grad()
        accum_loss = 0.0

        for accum_step in range(CONFIG["gradient_accumulation"]):
            try:
                x, y = next(data_iter)
            except StopIteration:
                data_iter = iter(dataloader)
                x, y = next(data_iter)

            x, y = x.to(DEVICE), y.to(DEVICE)

            with autocast(enabled=use_amp):
                _, loss = model(x, labels=y)
                loss = loss / CONFIG["gradient_accumulation"]

            scaler.scale(loss).backward()
            accum_loss += loss.item()

        scaler.unscale_(optimizer)
        torch.nn.utils.clip_grad_norm_(model.parameters(), CONFIG["max_grad_norm"])
        scaler.step(optimizer)
        scaler.update()
        scheduler.step()

        global_step += 1
        total_loss += accum_loss

        # Logging
        if global_step % CONFIG["log_interval"] == 0:
            avg_loss = total_loss / CONFIG["log_interval"]
            elapsed = time.time() - start_time
            tokens_per_sec = (global_step * total_tokens_per_step) / elapsed
            remaining = (CONFIG["max_steps"] - global_step) * elapsed / global_step
            lr = scheduler.get_last_lr()[0]

            print(
                f"Step {global_step:>6d}/{CONFIG['max_steps']} | "
                f"Loss: {avg_loss:.4f} | "
                f"LR: {lr:.2e} | "
                f"Tok/s: {tokens_per_sec:,.0f} | "
                f"ETA: {remaining/3600:.1f}h"
            )
            total_loss = 0.0

        # Save checkpoint
        if global_step % CONFIG["save_interval"] == 0:
            ckpt_path = os.path.join(CONFIG["checkpoint_dir"], f"pretrain_step{global_step}.pt")
            torch.save({
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "scheduler_state_dict": scheduler.state_dict(),
                "scaler_state_dict": scaler.state_dict(),
                "global_step": global_step,
                "config": CONFIG,
                "model_config": model.config,
            }, ckpt_path)
            print(f"  → Checkpoint saved: {ckpt_path}")

            if accum_loss < best_loss:
                best_loss = accum_loss
                best_path = os.path.join(CONFIG["checkpoint_dir"], "pretrain_best.pt")
                torch.save({
                    "model_state_dict": model.state_dict(),
                    "config": CONFIG,
                    "model_config": model.config,
                    "global_step": global_step,
                }, best_path)
                print(f"  → Best model saved: {best_path}")

    # Final save
    final_path = os.path.join(CONFIG["checkpoint_dir"], "pretrain_final.pt")
    torch.save({
        "model_state_dict": model.state_dict(),
        "config": CONFIG,
        "model_config": model.config,
        "global_step": global_step,
    }, final_path)

    elapsed = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"Pre-training complete!")
    print(f"Total time: {elapsed/3600:.1f}h")
    print(f"Final model: {final_path}")
    print(f"{'='*60}")


if __name__ == "__main__":
    train()
