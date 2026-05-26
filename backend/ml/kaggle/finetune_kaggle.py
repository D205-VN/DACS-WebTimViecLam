"""
APT-CV Model — Kaggle Fine-tuning Script
=========================================
Copy this script into a Kaggle notebook cell to fine-tune the pre-trained
aptcv-model specifically for CV/resume content generation.

Prerequisites:
    1. Pre-trained model checkpoint (from pretrain_kaggle.py)
    2. Training data: cv_finetune.jsonl (from prepare_cv_data.py)
    3. Tokenizer: aptcv_tokenizer.json
    4. GPU accelerator enabled

Estimated time: 3-5h on P100 for 10 epochs.
"""

import os
import sys
import json
import time
import math
import random
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torch.cuda.amp import autocast, GradScaler

# ============================================================================
# Check environment
# ============================================================================

print("=" * 60)
print("APT-CV Fine-tuning for CV Generation")
print("=" * 60)

if torch.cuda.is_available():
    gpu_name = torch.cuda.get_device_name(0)
    gpu_mem = torch.cuda.get_device_properties(0).total_mem / 1e9
    print(f"GPU: {gpu_name} ({gpu_mem:.1f} GB)")
    DEVICE = torch.device("cuda")
else:
    print("WARNING: No GPU! Training will be very slow.")
    DEVICE = torch.device("cpu")

# ============================================================================
# Configuration
# ============================================================================

CONFIG = {
    # Paths — adjust for your Kaggle setup
    "pretrained_path": "/kaggle/input/aptcv-pretrained/pretrain_best.pt",
    "tokenizer_path": "/kaggle/input/aptcv-tokenizer/aptcv_tokenizer.json",
    "data_path": "/kaggle/input/aptcv-cv-data/cv_finetune.jsonl",
    "output_dir": "/kaggle/working/aptcv-finetuned",

    # Training hyperparameters
    "batch_size": 8,
    "learning_rate": 5e-5,
    "weight_decay": 0.01,
    "num_epochs": 10,
    "warmup_ratio": 0.1,
    "max_grad_norm": 1.0,
    "max_seq_len": 1024,

    # Validation
    "val_split": 0.1,
    "eval_interval": 50,   # evaluate every N steps
    "patience": 3,         # early stopping patience (epochs without improvement)

    # Logging
    "log_interval": 10,
}

os.makedirs(CONFIG["output_dir"], exist_ok=True)

# ============================================================================
# Model Definition (same as pretrain — inlined for portability)
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

    def forward(self, seq_len, device):
        t = torch.arange(seq_len, device=device, dtype=self.inv_freq.dtype)
        freqs = torch.outer(t, self.inv_freq)
        emb = torch.cat((freqs, freqs), dim=-1)
        return emb.cos().unsqueeze(0), emb.sin().unsqueeze(0)


def rotate_half(x):
    x1, x2 = x.chunk(2, dim=-1)
    return torch.cat((-x2, x1), dim=-1)


def apply_rotary_pos_emb(q, k, cos, sin):
    return (q * cos) + (rotate_half(q) * sin), (k * cos) + (rotate_half(k) * sin)


class CausalSelfAttention(nn.Module):
    def __init__(self, hidden_dim, num_heads, max_seq_len=1024, dropout=0.1):
        super().__init__()
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
        cos, sin = cos.unsqueeze(1), sin.unsqueeze(1)
        q, k = apply_rotary_pos_emb(q, k, cos, sin)
        out = torch.nn.functional.scaled_dot_product_attention(
            q, k, v, is_causal=True,
            dropout_p=self.attn_dropout.p if self.training else 0.0,
        )
        return self.resid_dropout(self.out_proj(out.transpose(1, 2).contiguous().view(B, T, C)))


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
        self.lm_head.weight = self.token_emb.weight

        total = sum(p.numel() for p in self.parameters())
        print(f"APTCVModel: {total:,} parameters")

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
# Fine-tuning Dataset
# ============================================================================

class CVFineTuneDataset(Dataset):
    """
    Loads JSONL data where each line is {"text": "<formatted CV sample>"}.
    Tokenizes and creates (input_ids, labels) pairs where the prompt portion
    is masked with -100 so only the assistant response is trained on.
    """

    ASSISTANT_MARKER = "<|assistant|>"

    def __init__(self, samples, tokenizer, max_seq_len=1024):
        self.tokenizer = tokenizer
        self.max_seq_len = max_seq_len
        self.data = []

        pad_id = tokenizer.token_to_id("<pad>") or 0

        for sample in samples:
            text = sample.get("text", "")
            if not text.strip():
                continue

            encoded = tokenizer.encode(text)
            token_ids = encoded.ids[:max_seq_len]

            # Find where the assistant response starts
            assistant_text = text.split(self.ASSISTANT_MARKER)
            if len(assistant_text) >= 2:
                prompt_part = text[:text.index(self.ASSISTANT_MARKER) + len(self.ASSISTANT_MARKER)]
                prompt_tokens = len(tokenizer.encode(prompt_part).ids)
            else:
                prompt_tokens = 0

            # Create labels: mask prompt with -100
            labels = [-100] * min(prompt_tokens, len(token_ids))
            labels += token_ids[len(labels):]

            # Pad to max_seq_len
            pad_len = max_seq_len - len(token_ids)
            token_ids = token_ids + [pad_id] * pad_len
            labels = labels + [-100] * pad_len

            self.data.append({
                "input_ids": torch.tensor(token_ids, dtype=torch.long),
                "labels": torch.tensor(labels, dtype=torch.long),
            })

        print(f"CVFineTuneDataset: {len(self.data)} samples loaded")

    def __len__(self):
        return len(self.data)

    def __getitem__(self, idx):
        item = self.data[idx]
        return item["input_ids"], item["labels"]

# ============================================================================
# Training
# ============================================================================

def finetune():
    from tokenizers import Tokenizer

    # Load tokenizer
    print(f"\nLoading tokenizer: {CONFIG['tokenizer_path']}")
    tokenizer = Tokenizer.from_file(CONFIG["tokenizer_path"])
    vocab_size = tokenizer.get_vocab_size()
    print(f"Vocab size: {vocab_size}")

    # Load pre-trained model
    print(f"\nLoading pre-trained model: {CONFIG['pretrained_path']}")
    checkpoint = torch.load(CONFIG["pretrained_path"], map_location="cpu")
    model_config = checkpoint.get("model_config", {})

    model = APTCVModel(
        vocab_size=model_config.get("vocab_size", vocab_size),
        hidden_dim=model_config.get("hidden_dim", 512),
        num_layers=model_config.get("num_layers", 8),
        num_heads=model_config.get("num_heads", 8),
        ffn_dim=model_config.get("ffn_dim", 2048),
        max_seq_len=model_config.get("max_seq_len", 1024),
        dropout=model_config.get("dropout", 0.1),
    )
    model.load_state_dict(checkpoint["model_state_dict"])
    model = model.to(DEVICE)
    print("Pre-trained weights loaded successfully!")

    # Load fine-tuning data
    print(f"\nLoading fine-tune data: {CONFIG['data_path']}")
    with open(CONFIG["data_path"], "r", encoding="utf-8") as f:
        all_samples = [json.loads(line) for line in f if line.strip()]

    print(f"Total samples: {len(all_samples)}")

    # Train/val split
    random.seed(42)
    random.shuffle(all_samples)
    val_size = int(len(all_samples) * CONFIG["val_split"])
    val_samples = all_samples[:val_size]
    train_samples = all_samples[val_size:]

    print(f"Train: {len(train_samples)} | Val: {len(val_samples)}")

    train_dataset = CVFineTuneDataset(train_samples, tokenizer, CONFIG["max_seq_len"])
    val_dataset = CVFineTuneDataset(val_samples, tokenizer, CONFIG["max_seq_len"])

    train_loader = DataLoader(
        train_dataset,
        batch_size=CONFIG["batch_size"],
        shuffle=True,
        num_workers=2,
        pin_memory=True,
        drop_last=True,
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=CONFIG["batch_size"],
        shuffle=False,
        num_workers=2,
        pin_memory=True,
    )

    # Optimizer
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=CONFIG["learning_rate"],
        weight_decay=CONFIG["weight_decay"],
        betas=(0.9, 0.95),
    )

    total_steps = len(train_loader) * CONFIG["num_epochs"]
    warmup_steps = int(total_steps * CONFIG["warmup_ratio"])

    def lr_schedule(step):
        if step < warmup_steps:
            return step / max(1, warmup_steps)
        progress = (step - warmup_steps) / max(1, total_steps - warmup_steps)
        return 0.5 * (1.0 + math.cos(math.pi * progress))

    scheduler = torch.optim.lr_scheduler.LambdaLR(optimizer, lr_schedule)

    use_amp = DEVICE.type == "cuda"
    scaler = GradScaler(enabled=use_amp)

    # Validation function
    @torch.no_grad()
    def evaluate():
        model.eval()
        total_val_loss = 0.0
        num_batches = 0
        for x, y in val_loader:
            x, y = x.to(DEVICE), y.to(DEVICE)
            with autocast(enabled=use_amp):
                _, loss = model(x, labels=y)
            total_val_loss += loss.item()
            num_batches += 1
        model.train()
        return total_val_loss / max(1, num_batches)

    # Training loop
    print(f"\n{'='*60}")
    print(f"Starting fine-tuning...")
    print(f"Epochs: {CONFIG['num_epochs']} | Steps/epoch: {len(train_loader)}")
    print(f"Total steps: {total_steps} | Warmup: {warmup_steps}")
    print(f"{'='*60}\n")

    model.train()
    global_step = 0
    best_val_loss = float("inf")
    epochs_without_improvement = 0
    start_time = time.time()

    for epoch in range(CONFIG["num_epochs"]):
        epoch_loss = 0.0
        epoch_steps = 0

        for batch_idx, (x, y) in enumerate(train_loader):
            x, y = x.to(DEVICE), y.to(DEVICE)

            with autocast(enabled=use_amp):
                _, loss = model(x, labels=y)

            scaler.scale(loss).backward()
            scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(model.parameters(), CONFIG["max_grad_norm"])
            scaler.step(optimizer)
            scaler.update()
            optimizer.zero_grad()
            scheduler.step()

            global_step += 1
            epoch_loss += loss.item()
            epoch_steps += 1

            # Log
            if global_step % CONFIG["log_interval"] == 0:
                avg = epoch_loss / epoch_steps
                lr = scheduler.get_last_lr()[0]
                elapsed = time.time() - start_time
                eta = (total_steps - global_step) * elapsed / max(1, global_step)
                print(
                    f"Epoch {epoch+1}/{CONFIG['num_epochs']} | "
                    f"Step {global_step}/{total_steps} | "
                    f"Loss: {avg:.4f} | LR: {lr:.2e} | "
                    f"ETA: {eta/60:.0f}m"
                )

            # Evaluate
            if global_step % CONFIG["eval_interval"] == 0:
                val_loss = evaluate()
                print(f"  → Val Loss: {val_loss:.4f} (best: {best_val_loss:.4f})")

                if val_loss < best_val_loss:
                    best_val_loss = val_loss
                    best_path = os.path.join(CONFIG["output_dir"], "aptcv-best.pt")
                    torch.save({
                        "model_state_dict": model.state_dict(),
                        "model_config": model.config,
                        "val_loss": val_loss,
                        "epoch": epoch + 1,
                        "global_step": global_step,
                    }, best_path)
                    print(f"  → Best model saved! (val_loss: {val_loss:.4f})")

        # End of epoch
        val_loss = evaluate()
        avg_epoch_loss = epoch_loss / max(1, epoch_steps)
        print(f"\n--- Epoch {epoch+1} complete ---")
        print(f"  Train Loss: {avg_epoch_loss:.4f} | Val Loss: {val_loss:.4f}")

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            epochs_without_improvement = 0
        else:
            epochs_without_improvement += 1
            print(f"  No improvement for {epochs_without_improvement} epoch(s)")

        if epochs_without_improvement >= CONFIG["patience"]:
            print(f"  Early stopping! (patience={CONFIG['patience']})")
            break

        # Save epoch checkpoint
        epoch_path = os.path.join(CONFIG["output_dir"], f"aptcv-epoch{epoch+1}.pt")
        torch.save({
            "model_state_dict": model.state_dict(),
            "model_config": model.config,
            "val_loss": val_loss,
            "epoch": epoch + 1,
        }, epoch_path)
        print()

    # Save final model
    final_path = os.path.join(CONFIG["output_dir"], "aptcv-final.pt")
    torch.save({
        "model_state_dict": model.state_dict(),
        "model_config": model.config,
        "global_step": global_step,
    }, final_path)

    elapsed = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"Fine-tuning complete!")
    print(f"Total time: {elapsed/60:.0f} minutes")
    print(f"Best val loss: {best_val_loss:.4f}")
    print(f"Best model: {os.path.join(CONFIG['output_dir'], 'aptcv-best.pt')}")
    print(f"Final model: {final_path}")
    print(f"{'='*60}")

    # ========================================================================
    # Quick test: generate a sample CV
    # ========================================================================
    print("\n--- Quick Test ---")
    model.eval()

    test_prompt = (
        "<|system|>You are a professional CV writer. Return only valid JSON with "
        "these fields: objective, experience, education, skills, certifications, hobbies.<|end|>\n"
        "<|user|>\n"
        "Full name: Test User\n"
        "Target role: Software Engineer\n"
        "Email: test@example.com\n"
        "Skills: Python, JavaScript, React\n"
        "Education: Computer Science, University of Technology\n"
        "Experience: 2 years building web applications<|end|>\n"
        "<|assistant|>\n"
    )

    input_ids = tokenizer.encode(test_prompt).ids
    input_tensor = torch.tensor([input_ids], dtype=torch.long, device=DEVICE)

    with torch.no_grad():
        eos_id = tokenizer.token_to_id("</s>") or 2
        generated = input_tensor
        for _ in range(512):
            logits, _ = model(generated[:, -CONFIG["max_seq_len"]:])
            next_logits = logits[:, -1, :] / 0.3
            probs = torch.softmax(next_logits, dim=-1)
            next_token = torch.multinomial(probs, 1)
            generated = torch.cat([generated, next_token], dim=1)
            if next_token.item() == eos_id:
                break

    output = tokenizer.decode(generated[0].tolist()[len(input_ids):])
    print(f"Generated output:\n{output[:500]}")


if __name__ == "__main__":
    finetune()
