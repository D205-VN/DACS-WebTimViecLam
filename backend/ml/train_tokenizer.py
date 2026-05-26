#!/usr/bin/env python3
"""
train_tokenizer.py — Train a ByteLevel BPE tokenizer for the APTCV model.

Uses the HuggingFace `tokenizers` library to train a custom BPE tokenizer
optimized for Vietnamese and English text, with special tokens for the
chat/instruction format used in CV generation.

Usage:
    python train_tokenizer.py                          # Train on data/*.txt
    python train_tokenizer.py file1.txt file2.txt      # Train on specific files
    python train_tokenizer.py --vocab_size 32000       # Custom vocab size
"""

import argparse
import glob
import json
import os
import sys
from pathlib import Path
from typing import Optional

from tokenizers import Tokenizer, models, trainers, pre_tokenizers, processors, decoders


# ──────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────

SPECIAL_TOKENS = [
    "<pad>",          # 0 — Padding token
    "<s>",            # 1 — Beginning of sequence
    "</s>",           # 2 — End of sequence
    "<unk>",          # 3 — Unknown token
    "<|system|>",     # 4 — System prompt marker
    "<|user|>",       # 5 — User turn marker
    "<|assistant|>",  # 6 — Assistant turn marker
    "<|end|>",        # 7 — End-of-turn marker
    "<|cv_generate|>",  # 8 — CV generation task marker
]

DEFAULT_VOCAB_SIZE = 16_000
DEFAULT_SAVE_DIR = os.path.join(os.path.dirname(__file__), "tokenizer")
DEFAULT_SAVE_PATH = os.path.join(DEFAULT_SAVE_DIR, "aptcv_tokenizer.json")
DEFAULT_CONFIG_PATH = os.path.join(DEFAULT_SAVE_DIR, "tokenizer_config.json")
DEFAULT_DATA_PATTERN = os.path.join(os.path.dirname(__file__), "data", "*.txt")


# ──────────────────────────────────────────────────────────────
# Tokenizer Training
# ──────────────────────────────────────────────────────────────

def train_tokenizer(
    files: list[str],
    vocab_size: int = DEFAULT_VOCAB_SIZE,
    save_path: str = DEFAULT_SAVE_PATH,
) -> Tokenizer:
    """
    Train a ByteLevel BPE tokenizer on the given text files.

    Args:
        files: List of paths to training text files.
        vocab_size: Target vocabulary size (including special tokens).
        save_path: Path to save the trained tokenizer JSON.

    Returns:
        The trained Tokenizer object.
    """
    print(f"{'='*60}")
    print(f"  APTCV Tokenizer Training")
    print(f"{'='*60}")
    print(f"  Vocab size   : {vocab_size:,}")
    print(f"  Training files: {len(files)}")
    for f in files:
        size_mb = os.path.getsize(f) / (1024 * 1024)
        print(f"    - {f} ({size_mb:.2f} MB)")
    print(f"  Save path    : {save_path}")
    print(f"{'='*60}\n")

    # ── Initialize BPE model ──
    tokenizer = Tokenizer(models.BPE(unk_token="<unk>"))

    # ── Pre-tokenizer: ByteLevel splits text into bytes before BPE ──
    # add_prefix_space=False avoids inserting 'Ġ' at the start of every text
    tokenizer.pre_tokenizer = pre_tokenizers.ByteLevel(add_prefix_space=False)

    # ── Decoder: ByteLevel to reconstruct text properly ──
    tokenizer.decoder = decoders.ByteLevel()

    # ── Trainer configuration ──
    trainer = trainers.BpeTrainer(
        vocab_size=vocab_size,
        special_tokens=SPECIAL_TOKENS,
        min_frequency=2,
        show_progress=True,
        initial_alphabet=pre_tokenizers.ByteLevel.alphabet(),
    )

    # ── Train ──
    print("Training tokenizer...")
    tokenizer.train(files=files, trainer=trainer)

    # ── Post-processor: add <s> and </s> around sequences ──
    tokenizer.post_processor = processors.TemplateProcessing(
        single="<s> $A </s>",
        pair="<s> $A </s> <s> $B </s>",
        special_tokens=[
            ("<s>", tokenizer.token_to_id("<s>")),
            ("</s>", tokenizer.token_to_id("</s>")),
        ],
    )

    # ── Enable padding (pad to longest in batch) ──
    tokenizer.enable_padding(
        pad_id=tokenizer.token_to_id("<pad>"),
        pad_token="<pad>",
    )

    # ── Save tokenizer ──
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    tokenizer.save(save_path)
    print(f"\n✓ Tokenizer saved to: {save_path}")

    # ── Save config ──
    config = {
        "model_type": "aptcv",
        "tokenizer_class": "ByteLevelBPE",
        "vocab_size": tokenizer.get_vocab_size(),
        "special_tokens": {tok: tokenizer.token_to_id(tok) for tok in SPECIAL_TOKENS},
        "pad_token": "<pad>",
        "bos_token": "<s>",
        "eos_token": "</s>",
        "unk_token": "<unk>",
    }
    config_path = os.path.join(os.path.dirname(save_path), "tokenizer_config.json")
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
    print(f"✓ Config saved to: {config_path}")

    return tokenizer


# ──────────────────────────────────────────────────────────────
# Load Tokenizer
# ──────────────────────────────────────────────────────────────

def load_tokenizer(path: str = DEFAULT_SAVE_PATH) -> Tokenizer:
    """
    Load a previously trained tokenizer from a JSON file.

    Args:
        path: Path to the tokenizer JSON file.

    Returns:
        The loaded Tokenizer object.

    Raises:
        FileNotFoundError: If the tokenizer file does not exist.
    """
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Tokenizer not found at '{path}'. "
            f"Run `python train_tokenizer.py` first to train one."
        )
    tokenizer = Tokenizer.from_file(path)
    return tokenizer


# ──────────────────────────────────────────────────────────────
# Test / Demo
# ──────────────────────────────────────────────────────────────

def test_tokenizer(tokenizer: Tokenizer) -> None:
    """Run encode/decode tests on sample Vietnamese and English text."""
    print(f"\n{'='*60}")
    print(f"  Tokenizer Test Results")
    print(f"{'='*60}")
    print(f"  Final vocab size: {tokenizer.get_vocab_size():,}")
    print()

    # Show special token IDs
    print("  Special tokens:")
    for tok in SPECIAL_TOKENS:
        tid = tokenizer.token_to_id(tok)
        print(f"    {tok:20s} -> {tid}")
    print()

    # Test sentences
    test_samples = [
        # Vietnamese
        "Xin chào, tôi là một kỹ sư phần mềm với 5 năm kinh nghiệm.",
        # English
        "I have experience in Python, JavaScript, and machine learning.",
        # Mixed with special tokens pattern (raw, without post-processing)
        "Kỹ năng: Lập trình Python, React.js, Docker, CI/CD",
        # CV-style content
        "Học vấn: Đại học Bách Khoa Hà Nội - Khoa học Máy tính (2018-2022)",
    ]

    for i, text in enumerate(test_samples, 1):
        encoded = tokenizer.encode(text)
        decoded = tokenizer.decode(encoded.ids)
        print(f"  Sample {i}:")
        print(f"    Input   : {text}")
        print(f"    Tokens  : {len(encoded.ids)} ids")
        print(f"    Token ids: {encoded.ids[:20]}{'...' if len(encoded.ids) > 20 else ''}")
        print(f"    Decoded : {decoded}")
        print()


# ──────────────────────────────────────────────────────────────
# CLI Entry Point
# ──────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Train a ByteLevel BPE tokenizer for the APTCV model."
    )
    parser.add_argument(
        "files",
        nargs="*",
        default=None,
        help="Text files to train on. Defaults to data/*.txt",
    )
    parser.add_argument(
        "--vocab_size",
        type=int,
        default=DEFAULT_VOCAB_SIZE,
        help=f"Vocabulary size (default: {DEFAULT_VOCAB_SIZE})",
    )
    parser.add_argument(
        "--save_path",
        type=str,
        default=DEFAULT_SAVE_PATH,
        help=f"Path to save trained tokenizer (default: {DEFAULT_SAVE_PATH})",
    )
    args = parser.parse_args()

    # ── Resolve training files ──
    if args.files:
        files = args.files
    else:
        files = sorted(glob.glob(DEFAULT_DATA_PATTERN))

    # ── Validate files exist ──
    missing = [f for f in files if not os.path.isfile(f)]
    if missing:
        print("⚠  Some training files were not found:")
        for f in missing:
            print(f"    ✗ {f}")
        files = [f for f in files if os.path.isfile(f)]

    if not files:
        print("\n" + "="*60)
        print("  No training data found!")
        print("="*60)
        print()
        print("  To train the tokenizer, you need text files.")
        print()
        print("  Option 1: Place .txt files in the data/ directory:")
        data_dir = os.path.join(os.path.dirname(__file__), "data")
        print(f"    mkdir -p {data_dir}")
        print(f"    # Add your .txt files there")
        print()
        print("  Option 2: Pass file paths as arguments:")
        print(f"    python {sys.argv[0]} path/to/corpus1.txt path/to/corpus2.txt")
        print()
        print("  Recommended data sources for Vietnamese:")
        print("    - Vietnamese Wikipedia dump (cleaned)")
        print("    - Vietnamese news articles")
        print("    - CV/resume text samples")
        print("    - Job description text samples")
        print()
        sys.exit(1)

    # ── Train ──
    tokenizer = train_tokenizer(
        files=files,
        vocab_size=args.vocab_size,
        save_path=args.save_path,
    )

    # ── Test ──
    test_tokenizer(tokenizer)

    print("✓ Done! Tokenizer is ready for use.\n")


if __name__ == "__main__":
    main()
