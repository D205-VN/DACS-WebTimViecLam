"""
APTCV Model — A small GPT-style decoder-only Transformer for CV generation.

Architecture highlights:
  • Rotary Position Embedding (RoPE) on Q/K
  • RMSNorm (pre-norm residual style)
  • SwiGLU feed-forward network
  • Weight tying between token embedding and lm_head
  • Causal (autoregressive) attention mask
  • PyTorch 2.0+ scaled_dot_product_attention

Author : APTCV Team
Compat : Python 3.10+, PyTorch 2.0+
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F


# ============================================================================
#  Configuration
# ============================================================================

@dataclass
class ModelConfig:
    """All hyper-parameters for APTCVModel in one place."""

    vocab_size: int = 16_000
    hidden_dim: int = 512
    num_layers: int = 8
    num_heads: int = 8
    ffn_dim: int = 2_048
    max_seq_len: int = 1_024
    dropout: float = 0.1
    rope_theta: float = 10_000.0  # base frequency for RoPE

    # Derived ---
    head_dim: int = field(init=False)

    def __post_init__(self) -> None:
        assert self.hidden_dim % self.num_heads == 0, (
            f"hidden_dim ({self.hidden_dim}) must be divisible by "
            f"num_heads ({self.num_heads})"
        )
        self.head_dim = self.hidden_dim // self.num_heads


# ============================================================================
#  RMSNorm
# ============================================================================

class RMSNorm(nn.Module):
    """Root Mean Square Layer Normalisation (Zhang & Sennrich, 2019).

    Unlike LayerNorm, RMSNorm does not re-centre activations (no bias /
    mean subtraction), making it slightly faster while retaining quality.

    Args:
        dim: Feature dimension to normalise over.
        eps: Small constant for numerical stability.
    """

    def __init__(self, dim: int, eps: float = 1e-6) -> None:
        super().__init__()
        self.eps = eps
        self.weight = nn.Parameter(torch.ones(dim))

    def _norm(self, x: torch.Tensor) -> torch.Tensor:
        # rsqrt = 1 / sqrt(mean(x^2) + eps)
        return x * torch.rsqrt(x.pow(2).mean(dim=-1, keepdim=True) + self.eps)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Cast to float32 for numerical stability, then cast back.
        output = self._norm(x.float()).type_as(x)
        return output * self.weight


# ============================================================================
#  Rotary Position Embedding (RoPE)
# ============================================================================

class RotaryEmbedding(nn.Module):
    """Rotary Position Embedding (Su et al., 2021).

    Pre-computes sin/cos frequency tables up to ``max_seq_len`` so they can
    be looked up during the forward pass without recomputation.

    Args:
        head_dim: Dimension of each attention head (must be even).
        max_seq_len: Maximum sequence length to pre-compute.
        theta: Base frequency (default 10 000).
    """

    def __init__(
        self,
        head_dim: int,
        max_seq_len: int = 1_024,
        theta: float = 10_000.0,
    ) -> None:
        super().__init__()
        assert head_dim % 2 == 0, "head_dim must be even for RoPE"

        # Frequency bands: theta^{-2i/d} for i in [0, d/2)
        inv_freq = 1.0 / (
            theta ** (torch.arange(0, head_dim, 2, dtype=torch.float32) / head_dim)
        )
        self.register_buffer("inv_freq", inv_freq, persistent=False)

        # Pre-compute [max_seq_len, head_dim/2] sin & cos tables
        self._build_cache(max_seq_len)

    def _build_cache(self, seq_len: int) -> None:
        """Build or extend the sin/cos cache to *at least* ``seq_len``."""
        t = torch.arange(seq_len, dtype=self.inv_freq.dtype, device=self.inv_freq.device)
        freqs = torch.outer(t, self.inv_freq)  # [seq_len, head_dim/2]
        # Duplicate each frequency to cover the full head_dim
        emb = torch.cat([freqs, freqs], dim=-1)  # [seq_len, head_dim]
        self.register_buffer("cos_cached", emb.cos(), persistent=False)
        self.register_buffer("sin_cached", emb.sin(), persistent=False)

    def forward(self, seq_len: int) -> Tuple[torch.Tensor, torch.Tensor]:
        """Return ``(cos, sin)`` each of shape ``[seq_len, head_dim]``."""
        if seq_len > self.cos_cached.size(0):
            self._build_cache(seq_len)
        return (
            self.cos_cached[:seq_len],
            self.sin_cached[:seq_len],
        )


def _rotate_half(x: torch.Tensor) -> torch.Tensor:
    """Rotate the last dimension: [x1, x2, ...] → [−x_{d/2+1}, …, x1, …]."""
    x1 = x[..., : x.shape[-1] // 2]
    x2 = x[..., x.shape[-1] // 2 :]
    return torch.cat([-x2, x1], dim=-1)


def apply_rotary_pos_emb(
    q: torch.Tensor,
    k: torch.Tensor,
    cos: torch.Tensor,
    sin: torch.Tensor,
) -> Tuple[torch.Tensor, torch.Tensor]:
    """Apply Rotary Position Embedding to query and key tensors.

    Args:
        q: Query tensor of shape ``[B, num_heads, S, head_dim]``.
        k: Key tensor of shape ``[B, num_heads, S, head_dim]``.
        cos: Cosine table ``[S, head_dim]``.
        sin: Sine table ``[S, head_dim]``.

    Returns:
        Tuple of rotated ``(q, k)`` with the same shapes.
    """
    # Reshape cos/sin for broadcasting: [1, 1, S, head_dim]
    cos = cos.unsqueeze(0).unsqueeze(0)
    sin = sin.unsqueeze(0).unsqueeze(0)
    q_embed = (q * cos) + (_rotate_half(q) * sin)
    k_embed = (k * cos) + (_rotate_half(k) * sin)
    return q_embed, k_embed


# ============================================================================
#  Causal Self-Attention
# ============================================================================

class CausalSelfAttention(nn.Module):
    """Multi-head causal self-attention with Rotary Position Embedding.

    Uses ``torch.nn.functional.scaled_dot_product_attention`` (PyTorch 2.0+)
    which auto-selects the fastest kernel (Flash Attention / Memory-Efficient).

    Args:
        config: A :class:`ModelConfig` instance.
    """

    def __init__(self, config: ModelConfig) -> None:
        super().__init__()
        self.num_heads = config.num_heads
        self.head_dim = config.head_dim
        self.hidden_dim = config.hidden_dim

        # Packed QKV projection — bias=False per spec
        self.q_proj = nn.Linear(config.hidden_dim, config.hidden_dim, bias=False)
        self.k_proj = nn.Linear(config.hidden_dim, config.hidden_dim, bias=False)
        self.v_proj = nn.Linear(config.hidden_dim, config.hidden_dim, bias=False)

        # Output projection
        self.o_proj = nn.Linear(config.hidden_dim, config.hidden_dim, bias=False)

        # Rotary embeddings
        self.rotary_emb = RotaryEmbedding(
            head_dim=config.head_dim,
            max_seq_len=config.max_seq_len,
            theta=config.rope_theta,
        )

        self.attn_dropout = config.dropout
        self.resid_dropout = nn.Dropout(config.dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: Input tensor of shape ``[B, S, D]``.

        Returns:
            Output tensor of shape ``[B, S, D]``.
        """
        B, S, D = x.shape

        # Project to Q, K, V and reshape for multi-head attention
        q = self.q_proj(x).view(B, S, self.num_heads, self.head_dim).transpose(1, 2)
        k = self.k_proj(x).view(B, S, self.num_heads, self.head_dim).transpose(1, 2)
        v = self.v_proj(x).view(B, S, self.num_heads, self.head_dim).transpose(1, 2)
        # q, k, v: [B, num_heads, S, head_dim]

        # Apply Rotary Position Embedding to Q and K
        cos, sin = self.rotary_emb(S)
        cos = cos.to(q.device, dtype=q.dtype)
        sin = sin.to(q.device, dtype=q.dtype)
        q, k = apply_rotary_pos_emb(q, k, cos, sin)

        # Efficient attention (PyTorch 2.0+) — handles causal mask internally
        attn_out = F.scaled_dot_product_attention(
            q, k, v,
            attn_mask=None,
            dropout_p=self.attn_dropout if self.training else 0.0,
            is_causal=True,
        )  # [B, num_heads, S, head_dim]

        # Merge heads and project back
        attn_out = attn_out.transpose(1, 2).contiguous().view(B, S, D)
        return self.resid_dropout(self.o_proj(attn_out))


# ============================================================================
#  Feed-Forward Network (SwiGLU)
# ============================================================================

class FeedForward(nn.Module):
    """SwiGLU Feed-Forward Network (Shazeer, 2020).

    SwiGLU splits the up-projection into a *gate* and an *up* pathway::

        output = down_proj( SiLU(gate_proj(x)) * up_proj(x) )

    This gives better quality than plain GELU/ReLU for a comparable param
    count.

    Args:
        config: A :class:`ModelConfig` instance.
    """

    def __init__(self, config: ModelConfig) -> None:
        super().__init__()
        self.gate_proj = nn.Linear(config.hidden_dim, config.ffn_dim, bias=False)
        self.up_proj = nn.Linear(config.hidden_dim, config.ffn_dim, bias=False)
        self.down_proj = nn.Linear(config.ffn_dim, config.hidden_dim, bias=False)
        self.dropout = nn.Dropout(config.dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # SwiGLU: SiLU(gate) ⊙ up
        gate = F.silu(self.gate_proj(x))
        up = self.up_proj(x)
        return self.dropout(self.down_proj(gate * up))


# ============================================================================
#  Transformer Block
# ============================================================================

class TransformerBlock(nn.Module):
    """A single decoder-only Transformer block (pre-norm residual style).

    ::

        x  ─→  RMSNorm → CausalSelfAttention → (+residual)
           ─→  RMSNorm → FeedForward          → (+residual)

    Args:
        config: A :class:`ModelConfig` instance.
    """

    def __init__(self, config: ModelConfig) -> None:
        super().__init__()
        self.attn_norm = RMSNorm(config.hidden_dim)
        self.attn = CausalSelfAttention(config)
        self.ffn_norm = RMSNorm(config.hidden_dim)
        self.ffn = FeedForward(config)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Pre-norm → attention → residual
        x = x + self.attn(self.attn_norm(x))
        # Pre-norm → FFN → residual
        x = x + self.ffn(self.ffn_norm(x))
        return x


# ============================================================================
#  APTCVModel — Full Model
# ============================================================================

class APTCVModel(nn.Module):
    """APTCV: A small GPT-style decoder-only Transformer for CV generation.

    This model is designed to generate professional CV / résumé content
    given structured candidate information.

    Example::

        config = ModelConfig(vocab_size=16000, hidden_dim=512)
        model = APTCVModel(config)
        logits, loss = model(input_ids, labels=input_ids)

    Args:
        config: A :class:`ModelConfig` instance (or ``None`` to use defaults).
        **kwargs: Override any :class:`ModelConfig` field by name.
    """

    def __init__(self, config: Optional[ModelConfig] = None, **kwargs) -> None:
        super().__init__()

        # Merge explicit config with overrides
        if config is None:
            self.config = ModelConfig(**kwargs)
        else:
            # Allow kwargs to override fields on an existing config
            cfg_dict = {
                k: kwargs.get(k, getattr(config, k))
                for k in config.__dataclass_fields__
                if k != "head_dim"  # computed field
            }
            self.config = ModelConfig(**cfg_dict)

        cfg = self.config

        # ---- Token + position embeddings ----
        self.tok_emb = nn.Embedding(cfg.vocab_size, cfg.hidden_dim)
        self.emb_dropout = nn.Dropout(cfg.dropout)

        # ---- Transformer blocks ----
        self.layers = nn.ModuleList(
            [TransformerBlock(cfg) for _ in range(cfg.num_layers)]
        )

        # ---- Final norm ----
        self.final_norm = RMSNorm(cfg.hidden_dim)

        # ---- Language-model head (weight-tied with tok_emb) ----
        self.lm_head = nn.Linear(cfg.hidden_dim, cfg.vocab_size, bias=False)
        self.lm_head.weight = self.tok_emb.weight  # weight tying

        # ---- Initialisation ----
        self.apply(self._init_weights)

        # Report size
        n_params = self.count_parameters()
        print(f"APTCVModel instantiated — {n_params / 1e6:.2f}M parameters")

    # ------------------------------------------------------------------
    #  Weight initialisation
    # ------------------------------------------------------------------

    @staticmethod
    def _init_weights(module: nn.Module) -> None:
        """Small-init strategy (GPT-2 style)."""
        if isinstance(module, nn.Linear):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)
            if module.bias is not None:
                nn.init.zeros_(module.bias)
        elif isinstance(module, nn.Embedding):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)

    # ------------------------------------------------------------------
    #  Forward pass
    # ------------------------------------------------------------------

    def forward(
        self,
        input_ids: torch.Tensor,
        labels: Optional[torch.Tensor] = None,
    ) -> Tuple[torch.Tensor, Optional[torch.Tensor]]:
        """Run a forward pass through the model.

        Args:
            input_ids: Token IDs of shape ``[B, S]``.
            labels: Target token IDs of shape ``[B, S]`` for computing the
                cross-entropy loss.  If ``None``, loss is not computed.

        Returns:
            A tuple ``(logits, loss)`` where *logits* has shape
            ``[B, S, vocab_size]`` and *loss* is a scalar tensor (or ``None``).
        """
        B, S = input_ids.shape
        assert S <= self.config.max_seq_len, (
            f"Sequence length {S} exceeds max_seq_len {self.config.max_seq_len}"
        )

        # Token embeddings (RoPE replaces learned positional embeddings)
        x = self.emb_dropout(self.tok_emb(input_ids))  # [B, S, D]

        # Transformer blocks
        for layer in self.layers:
            x = layer(x)

        # Final norm + lm_head
        x = self.final_norm(x)
        logits = self.lm_head(x)  # [B, S, vocab_size]

        # Compute loss if labels provided (shift by one for next-token pred)
        loss: Optional[torch.Tensor] = None
        if labels is not None:
            # Shift: predict token t+1 from position t
            shift_logits = logits[:, :-1, :].contiguous()
            shift_labels = labels[:, 1:].contiguous()
            loss = F.cross_entropy(
                shift_logits.view(-1, shift_logits.size(-1)),
                shift_labels.view(-1),
                ignore_index=-100,
            )

        return logits, loss

    # ------------------------------------------------------------------
    #  Causal mask helper (kept for reference / manual use)
    # ------------------------------------------------------------------

    @staticmethod
    def _causal_mask(seq_len: int, device: torch.device) -> torch.Tensor:
        """Create a lower-triangular causal mask.

        Returns:
            Boolean tensor of shape ``[seq_len, seq_len]`` where ``True``
            means the position is **allowed** to attend.
        """
        return torch.tril(torch.ones(seq_len, seq_len, device=device, dtype=torch.bool))

    # ------------------------------------------------------------------
    #  Utilities
    # ------------------------------------------------------------------

    def count_parameters(self) -> int:
        """Return the number of trainable parameters (excluding tied duplicates)."""
        return sum(p.numel() for p in self.parameters() if p.requires_grad)

    def save_checkpoint(self, path: str | Path) -> None:
        """Save model weights and config to disk.

        Args:
            path: File path (e.g. ``checkpoints/aptcv_model.pt``).
        """
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        torch.save(
            {
                "model_state_dict": self.state_dict(),
                "config": self.config,
            },
            path,
        )
        print(f"Checkpoint saved → {path}")

    @staticmethod
    def config_from_checkpoint(saved_config: object | None) -> ModelConfig:
        """Rebuild ModelConfig from dataclass or dict checkpoint metadata."""
        if isinstance(saved_config, ModelConfig):
            return saved_config
        if isinstance(saved_config, dict):
            init_fields = {
                name
                for name, field_info in ModelConfig.__dataclass_fields__.items()
                if field_info.init
            }
            return ModelConfig(
                **{k: v for k, v in saved_config.items() if k in init_fields}
            )
        return ModelConfig()

    @classmethod
    def load_checkpoint(
        cls,
        path: str | Path,
        device: str | torch.device = "cpu",
    ) -> "APTCVModel":
        """Load a model from a checkpoint file.

        Args:
            path: Path to the ``.pt`` checkpoint.
            device: Device to map the tensors to.

        Returns:
            A fully-loaded :class:`APTCVModel` instance.
        """
        ckpt = torch.load(path, map_location=device, weights_only=False)
        config = cls.config_from_checkpoint(
            ckpt.get("config", ckpt.get("model_config"))
        )
        model = cls(config=config)
        model.load_state_dict(ckpt["model_state_dict"])
        model = model.to(device)
        print(f"Checkpoint loaded ← {path}")
        return model


# ============================================================================
#  Quick smoke test
# ============================================================================

if __name__ == "__main__":
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}\n")

    cfg = ModelConfig()
    model = APTCVModel(config=cfg).to(device)

    # Dummy forward pass
    dummy_ids = torch.randint(0, cfg.vocab_size, (2, 64), device=device)
    logits, loss = model(dummy_ids, labels=dummy_ids)
    print(f"Logits shape : {logits.shape}")   # [2, 64, 16000]
    print(f"Loss         : {loss.item():.4f}")

    # Save / load round-trip
    tmp_path = Path("/tmp/aptcv_test_ckpt.pt")
    model.save_checkpoint(tmp_path)
    model2 = APTCVModel.load_checkpoint(tmp_path, device=device)
    print("Round-trip checkpoint OK ✓")
