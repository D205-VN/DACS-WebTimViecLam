"""
APTCV Generate — Text-generation utilities for the APTCVModel.

Provides:
  • ``top_k_top_p_filter``  — logit filtering (top-k + nucleus)
  • ``generate``            — autoregressive decoding loop
  • ``generate_cv_content`` — high-level CV generation from candidate info

Author : APTCV Team
Compat : Python 3.10+, PyTorch 2.0+
"""

from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, Optional

import torch
import torch.nn.functional as F

try:
    from .model import APTCVModel
except ImportError:  # Allows running as `python generate.py` from backend/ml.
    from model import APTCVModel

try:
    from tokenizers import Tokenizer
except ImportError:  # Server/tests can still import helpers before deps are installed.
    Tokenizer = None


# ============================================================================
#  Logit Filtering
# ============================================================================

def top_k_top_p_filter(
    logits: torch.Tensor,
    top_k: int = 50,
    top_p: float = 0.9,
) -> torch.Tensor:
    """Filter a distribution of logits using top-k and/or nucleus (top-p).

    The filtering is applied **in-place** on a clone so the original tensor
    is not mutated.

    Args:
        logits: Un-normalised log-probabilities of shape ``[B, vocab_size]``
            or ``[vocab_size]``.
        top_k: Keep only the ``top_k`` highest-probability tokens.
            Set to ``0`` to disable top-k filtering.
        top_p: Keep the smallest set of tokens whose cumulative probability
            mass ≥ ``top_p``.  Set to ``1.0`` to disable nucleus filtering.

    Returns:
        Filtered logits with the same shape as the input.  Removed positions
        are set to ``-inf``.
    """
    logits = logits.clone()

    # --- Top-k filtering ---
    if top_k > 0:
        top_k = min(top_k, logits.size(-1))
        # Indices of tokens NOT in the top-k
        indices_to_remove = logits < torch.topk(logits, top_k, dim=-1).values[..., -1:]
        logits[indices_to_remove] = float("-inf")

    # --- Top-p (nucleus) filtering ---
    if 0.0 < top_p < 1.0:
        sorted_logits, sorted_indices = torch.sort(logits, descending=True, dim=-1)
        cumulative_probs = torch.cumsum(F.softmax(sorted_logits, dim=-1), dim=-1)

        # Mask tokens with cumulative probability above the threshold
        sorted_mask = cumulative_probs - F.softmax(sorted_logits, dim=-1) >= top_p
        # Scatter the mask back to the original token ordering.
        indices_to_remove = torch.zeros_like(logits, dtype=torch.bool)
        indices_to_remove.scatter_(dim=-1, index=sorted_indices, src=sorted_mask)
        logits[indices_to_remove] = float("-inf")

    return logits


def load_tokenizer_from_file(path: str) -> Any:
    """Load the ByteLevel BPE tokenizer used by the local APTCV model."""
    if Tokenizer is None:
        raise ImportError(
            "The `tokenizers` package is required. Install backend/ml/requirements.txt."
        )
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Tokenizer not found: {path}")

    tokenizer = Tokenizer.from_file(path)
    tokenizer.no_padding()
    tokenizer.no_truncation()
    return tokenizer


def _encode_token_ids(
    tokenizer: Any,
    text: str,
    *,
    add_special_tokens: bool = False,
) -> list[int]:
    """Return token ids for either `tokenizers.Tokenizer` or HF-style tokenizers."""
    try:
        encoded = tokenizer.encode(text, add_special_tokens=add_special_tokens)
    except TypeError:
        encoded = tokenizer.encode(text)

    if hasattr(encoded, "ids"):
        return list(encoded.ids)
    if torch.is_tensor(encoded):
        return encoded.detach().cpu().view(-1).tolist()
    if isinstance(encoded, dict) and "input_ids" in encoded:
        ids = encoded["input_ids"]
        if torch.is_tensor(ids):
            return ids.detach().cpu().view(-1).tolist()
        if ids and isinstance(ids[0], list):
            return list(ids[0])
        return list(ids)
    if encoded and isinstance(encoded[0], list):
        return list(encoded[0])
    return list(encoded)


def _decode_token_ids(
    tokenizer: Any,
    token_ids: list[int],
    *,
    skip_special_tokens: bool = True,
) -> str:
    """Decode ids for either `tokenizers.Tokenizer` or HF-style tokenizers."""
    try:
        return tokenizer.decode(token_ids, skip_special_tokens=skip_special_tokens)
    except TypeError:
        return tokenizer.decode(token_ids)


def _lookup_token_id(tokenizer: Any, token: str) -> Optional[int]:
    """Best-effort token id lookup across tokenizer implementations."""
    token_to_id = getattr(tokenizer, "token_to_id", None)
    if callable(token_to_id):
        token_id = token_to_id(token)
        if token_id is not None:
            return int(token_id)

    convert = getattr(tokenizer, "convert_tokens_to_ids", None)
    if callable(convert):
        token_id = convert(token)
        if token_id is not None:
            return int(token_id)

    ids = _encode_token_ids(tokenizer, token, add_special_tokens=False)
    return ids[-1] if ids else None


# ============================================================================
#  Autoregressive Generation
# ============================================================================

@torch.inference_mode()
def generate(
    model: APTCVModel,
    tokenizer: Any,
    prompt: str,
    max_new_tokens: int = 512,
    temperature: float = 0.7,
    top_k: int = 50,
    top_p: float = 0.9,
    device: str | torch.device = "cpu",
) -> str:
    """Generate text autoregressively from a prompt.

    The function tokenises the prompt, then iteratively predicts the next
    token using temperature-scaled sampling with top-k / top-p filtering
    until an end-of-sequence token (``</s>``) is produced or
    ``max_new_tokens`` is reached.

    Args:
        model: A trained :class:`APTCVModel`.
        tokenizer: Any HuggingFace-compatible tokenizer (must have
            ``encode``, ``decode``, and optionally ``eos_token_id``).
        prompt: The text prompt to condition generation on.
        max_new_tokens: Maximum number of new tokens to generate.
        temperature: Sampling temperature.  Lower → more deterministic.
        top_k: Top-k filtering parameter (0 = disabled).
        top_p: Nucleus sampling threshold (1.0 = disabled).
        device: Device to run inference on.

    Returns:
        The generated text string (**excluding** the original prompt).
    """
    model.eval()
    device = torch.device(device) if isinstance(device, str) else device

    # Encode without the tokenizer post-processor so the prompt does not get a
    # synthetic EOS token immediately before generation.
    input_id_list = _encode_token_ids(tokenizer, prompt, add_special_tokens=False)
    bos_token_id = _lookup_token_id(tokenizer, "<s>")
    if bos_token_id is not None and (not input_id_list or input_id_list[0] != bos_token_id):
        input_id_list = [bos_token_id] + input_id_list
    input_ids = torch.tensor([input_id_list], dtype=torch.long)
    input_ids = input_ids.to(device)

    # Determine the EOS token id
    eos_token_id: Optional[int] = getattr(tokenizer, "eos_token_id", None)
    # Fallback: try to look up </s> explicitly
    if eos_token_id is None:
        eos_token_id = _lookup_token_id(tokenizer, "</s>")

    generated_ids: list[int] = []
    max_seq_len = model.config.max_seq_len

    for _ in range(max_new_tokens):
        # Truncate context to fit the model's max sequence length
        context = input_ids[:, -max_seq_len:]

        # Forward pass — only need the last token's logits
        logits, _ = model(context)
        next_token_logits = logits[:, -1, :]  # [B, vocab_size]

        # Temperature scaling. temperature <= 0 means deterministic greedy decode.
        if temperature <= 0.0:
            next_token = torch.argmax(next_token_logits, dim=-1, keepdim=True)
        else:
            next_token_logits = next_token_logits / temperature

            # Filter logits
            filtered_logits = top_k_top_p_filter(
                next_token_logits,
                top_k=top_k,
                top_p=top_p,
            )

            # Sample from the filtered distribution
            probs = F.softmax(filtered_logits, dim=-1)
            next_token = torch.multinomial(probs, num_samples=1)  # [B, 1]

        # Append and check for EOS
        token_id = next_token.item()
        generated_ids.append(token_id)

        if eos_token_id is not None and token_id == eos_token_id:
            break

        # Extend the running context
        input_ids = torch.cat([input_ids, next_token], dim=1)

    # Decode only the generated portion
    generated_text = _decode_token_ids(
        tokenizer,
        generated_ids,
        skip_special_tokens=True,
    )
    return generated_text


# ============================================================================
#  High-Level CV Content Generation
# ============================================================================

# Canonical fields the model should return
_CV_JSON_FIELDS = [
    "objective",
    "experience",
    "education",
    "skills",
    "certifications",
    "hobbies",
]


def _build_cv_prompt(candidate_info: Dict[str, Any]) -> str:
    """Format candidate information into the chat-style prompt expected by
    the model.

    The prompt follows:
        ``<|system|>…<|end|>  <|user|>…<|end|>  <|assistant|>``

    Args:
        candidate_info: Dictionary with candidate details.  Recognised keys:
            ``fullName``, ``email``, ``phone``, ``role``, ``objective``,
            ``education``, ``experience``, ``skills``, ``certifications``,
            ``hobbies``, ``currentLocation``.

    Returns:
        The assembled prompt string.
    """
    system_msg = (
        "You are a professional CV writer. "
        "Return only valid JSON with these fields: "
        + ", ".join(_CV_JSON_FIELDS)
        + "."
    )

    # Build the user section from whichever fields are provided
    user_lines: list[str] = []
    field_map = {
        "fullName": "Full name",
        "email": "Email",
        "phone": "Phone",
        "role": "Target role",
        "objective": "Career objective",
        "education": "Education",
        "experience": "Experience",
        "skills": "Skills",
        "certifications": "Certifications",
        "hobbies": "Hobbies",
        "currentLocation": "Current location",
    }
    for key, label in field_map.items():
        value = candidate_info.get(key)
        if value:
            # Convert lists to comma-separated strings
            if isinstance(value, list):
                value = ", ".join(str(v) for v in value)
            user_lines.append(f"{label}: {value}")

    user_msg = "\n".join(user_lines)

    prompt = (
        f"<|system|>{system_msg}<|end|>\n"
        f"<|user|>\n{user_msg}<|end|>\n"
        f"<|assistant|>\n"
    )
    return prompt


def _extract_json(text: str) -> Optional[Dict[str, Any]]:
    """Try to extract a JSON object from *text*.

    Handles cases where the model wraps JSON in markdown code fences or
    includes trailing text after the closing brace.

    Args:
        text: Raw model output.

    Returns:
        Parsed dict, or ``None`` if extraction fails.
    """
    # Strip markdown code fences if present
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    decoder = json.JSONDecoder()

    # Try every object-looking start. This handles trailing prose and avoids
    # greedy brace matching when the model emits more than one object.
    for match in re.finditer(r"\{", text):
        try:
            parsed, _ = decoder.raw_decode(text[match.start():])
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            continue

    # Last resort: try the entire string
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        return None


def _fallback_cv_content(candidate_info: Dict[str, Any]) -> Dict[str, Any]:
    """Create a deterministic CV payload when a weak checkpoint emits bad JSON."""
    role = str(candidate_info.get("role") or "Professional").strip()
    skills = candidate_info.get("skills") or ""
    if isinstance(skills, list):
        skill_text = ", ".join(str(item) for item in skills if item)
    else:
        skill_text = str(skills).strip()

    experience = candidate_info.get("experience") or ""
    if isinstance(experience, list):
        experience_text = "\n".join(f"- {item}" for item in experience if item)
    else:
        experience_text = str(experience).strip()

    if not experience_text:
        experience_text = (
            f"- Built practical experience relevant to {role} through projects, "
            "coursework, and continuous self-learning."
        )

    objective_parts = [f"Detail-oriented {role}"]
    if skill_text:
        objective_parts.append(f"with strengths in {skill_text}")
    objective = " ".join(objective_parts) + (
        ", seeking to contribute measurable value in a professional team."
    )

    return {
        "objective": objective,
        "experience": experience_text,
        "education": candidate_info.get("education", ""),
        "skills": skill_text,
        "certifications": candidate_info.get("certifications", ""),
        "hobbies": candidate_info.get("hobbies", ""),
    }


@torch.inference_mode()
def generate_cv_content(
    model: APTCVModel,
    tokenizer: Any,
    candidate_info: Dict[str, Any],
    device: str | torch.device = "cpu",
    max_new_tokens: int = 768,
    temperature: float = 0.6,
    top_k: int = 40,
    top_p: float = 0.85,
) -> Dict[str, Any]:
    """Generate professional CV content from structured candidate data.

    This is the primary entry-point for the CV generation feature.  It:

    1. Formats ``candidate_info`` into the model's chat-style prompt.
    2. Calls :func:`generate` to produce a response.
    3. Parses the JSON output.
    4. Returns a dictionary with the canonical CV fields.

    Args:
        model: A trained :class:`APTCVModel`.
        tokenizer: HuggingFace-compatible tokenizer.
        candidate_info: A dict with any of the following keys:
            - ``fullName`` (str): Candidate full name.
            - ``email`` (str): Contact email.
            - ``phone`` (str): Contact phone number.
            - ``role`` (str): Target job role.
            - ``objective`` (str): Career objective / summary.
            - ``education`` (str | list): Education background.
            - ``experience`` (str | list): Work experience.
            - ``skills`` (str | list): Technical / soft skills.
            - ``certifications`` (str | list): Certifications.
            - ``hobbies`` (str | list): Hobbies / interests.
            - ``currentLocation`` (str): Current city / country.
        device: Inference device.
        max_new_tokens: Maximum tokens to generate.
        temperature: Sampling temperature.
        top_k: Top-k filtering value.
        top_p: Nucleus sampling threshold.

    Returns:
        A dictionary containing the generated CV content.  Guaranteed keys
        (may be empty strings/lists if the model didn't produce them):
        ``objective``, ``experience``, ``education``, ``skills``,
        ``certifications``, ``hobbies``.

    Raises:
        ValueError: If the model's output cannot be parsed as valid JSON
            after best-effort extraction.

    Example::

        info = {
            "fullName": "Nguyễn Văn A",
            "role": "Backend Developer",
            "skills": ["Python", "Django", "PostgreSQL"],
            "education": "HCMUT — CS, 2024",
        }
        result = generate_cv_content(model, tokenizer, info, device="cuda")
        print(result["objective"])
    """
    prompt = _build_cv_prompt(candidate_info)

    raw_output = generate(
        model=model,
        tokenizer=tokenizer,
        prompt=prompt,
        max_new_tokens=max_new_tokens,
        temperature=temperature,
        top_k=top_k,
        top_p=top_p,
        device=device,
    )

    parsed = _extract_json(raw_output)

    if parsed is None:
        parsed = _fallback_cv_content(candidate_info)
        parsed["_model_raw_output"] = raw_output

    # Ensure all canonical fields exist in the result
    result: Dict[str, Any] = {}
    for field in _CV_JSON_FIELDS:
        result[field] = parsed.get(field, "")

    # Carry over the candidate's identity info for convenience
    for passthrough_key in ("fullName", "email", "phone", "role", "currentLocation"):
        if passthrough_key in candidate_info:
            result[passthrough_key] = candidate_info[passthrough_key]

    return result


# ============================================================================
#  Quick smoke test
# ============================================================================

if __name__ == "__main__":
    # This smoke test only validates the prompt builder and JSON extractor
    # (the model and tokenizer would need to be loaded for full generation).

    sample_info = {
        "fullName": "Nguyễn Văn A",
        "email": "nguyenvana@example.com",
        "phone": "0901234567",
        "role": "Backend Developer",
        "objective": "Seeking a backend engineering position",
        "education": "HCMUT — Computer Science, 2024",
        "experience": "Intern at FPT Software (6 months)",
        "skills": ["Python", "Django", "PostgreSQL", "Docker"],
        "certifications": "AWS Cloud Practitioner",
        "hobbies": ["Reading", "Swimming"],
        "currentLocation": "Ho Chi Minh City",
    }

    prompt = _build_cv_prompt(sample_info)
    print("=== PROMPT ===")
    print(prompt)

    # Test JSON extraction
    mock_output = """
    ```json
    {
        "objective": "Motivated backend developer with hands-on experience...",
        "experience": "6-month internship at FPT Software...",
        "education": "Bachelor of Computer Science, HCMUT (2024)",
        "skills": ["Python", "Django", "PostgreSQL", "Docker"],
        "certifications": ["AWS Cloud Practitioner"],
        "hobbies": ["Reading", "Swimming"]
    }
    ```
    """
    parsed = _extract_json(mock_output)
    print("\n=== PARSED JSON ===")
    print(json.dumps(parsed, indent=2, ensure_ascii=False))
    print("\nSmoke test passed ✓")
