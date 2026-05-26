"""
APT-CV Model Server
====================
OpenAI-compatible API server for the aptcv-model.

Serves the custom-built transformer model via a `/v1/chat/completions`
endpoint so the Node.js backend can call it without any code changes
(same API format as LM Studio / Ollama).

Usage:
    python serve.py --model models/aptcv_cv_best.pt --port 8000

    # Or with uvicorn directly:
    uvicorn serve:app --host 0.0.0.0 --port 8000
"""

import argparse
import json
import time
import os
import re
import sys
from typing import Optional

import torch
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Add ML directory to path for imports when the script is launched from repo root.
ML_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ML_DIR)

from model import APTCVModel
from generate import generate, generate_cv_content, load_tokenizer_from_file

# ---------------------------------------------------------------------------
# Pydantic models for OpenAI-compatible API
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatCompletionRequest(BaseModel):
    model: str = "aptcv-model"
    messages: list[ChatMessage]
    temperature: float = Field(default=0.3, ge=0.0, le=2.0)
    max_tokens: int = Field(default=1024, ge=1, le=2048)
    top_p: float = Field(default=0.9, ge=0.0, le=1.0)
    top_k: int = Field(default=50, ge=0)
    stream: bool = False  # Streaming not supported yet

class ChatCompletionChoice(BaseModel):
    index: int = 0
    message: ChatMessage
    finish_reason: str = "stop"

class UsageInfo(BaseModel):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int

class ChatCompletionResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: list[ChatCompletionChoice]
    usage: UsageInfo

class ModelInfo(BaseModel):
    id: str
    object: str = "model"
    created: int
    owned_by: str = "aptcv"

class ModelListResponse(BaseModel):
    object: str = "list"
    data: list[ModelInfo]

# ---------------------------------------------------------------------------
# Global model & tokenizer (loaded at startup)
# ---------------------------------------------------------------------------

_model: Optional[APTCVModel] = None
_tokenizer = None
_device: Optional[torch.device] = None
_model_name: str = "aptcv-model"
_model_path: str = ""
_model_params: int = 0

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="APT-CV Model Server",
    description="OpenAI-compatible API for the custom aptcv-model transformer",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def format_chat_messages(messages: list[ChatMessage]) -> str:
    """Convert OpenAI-style messages to the model's prompt format."""
    formatted_parts = []

    for msg in messages:
        if msg.role == "system":
            formatted_parts.append(f"<|system|>{msg.content}<|end|>")
        elif msg.role == "user":
            formatted_parts.append(f"<|user|>\n{msg.content}<|end|>")
        elif msg.role == "assistant":
            formatted_parts.append(f"<|assistant|>\n{msg.content}")

    # Add assistant prompt if last message is not from assistant
    if not messages or messages[-1].role != "assistant":
        formatted_parts.append("<|assistant|>\n")

    return "\n".join(formatted_parts)


def is_missing_value(value: str) -> bool:
    return value.strip().lower() in {
        "",
        "none",
        "not provided",
        "not updated",
        "n/a",
        "na",
        "chưa cung cấp",
        "chưa cập nhật",
        "không có",
    }


def extract_candidate_info(messages: list[ChatMessage]) -> dict[str, str]:
    """Parse the backend's CV-generation prompt into structured fields."""
    text = "\n".join(msg.content for msg in messages if msg.role == "user")
    field_aliases = [
        ("fullName", ["Full name", "Họ tên"]),
        ("email", ["Email"]),
        ("phone", ["Phone", "Điện thoại"]),
        ("githubUrl", ["GitHub"]),
        ("role", ["Target role", "Vị trí ứng tuyển"]),
        ("currentLocation", ["Location", "Vị trí hiện tại", "Khu vực"]),
        ("objective", ["Existing objective", "Mục tiêu hiện có", "Mục tiêu nghề nghiệp"]),
        ("education", ["Existing education", "Học vấn hiện có", "Học vấn"]),
        ("experience", ["Existing experience", "Kinh nghiệm hiện có", "Kinh nghiệm làm việc"]),
        ("skills", ["Existing skills", "Kỹ năng hiện có", "Kỹ năng"]),
        ("certifications", ["Existing certifications", "Chứng chỉ hiện có", "Chứng chỉ"]),
        ("hobbies", ["Existing interests", "Sở thích hiện có", "Sở thích"]),
    ]

    info: dict[str, str] = {}
    for key, labels in field_aliases:
        for label in labels:
            pattern = rf"^\s*-\s*{re.escape(label)}\s*:\s*(.+?)\s*$"
            match = re.search(pattern, text, flags=re.IGNORECASE | re.MULTILINE)
            if match:
                value = match.group(1).strip()
                if not is_missing_value(value):
                    info[key] = value
                break
    return info


def is_cv_content_request(messages: list[ChatMessage]) -> bool:
    combined = "\n".join(msg.content for msg in messages).lower()
    return (
        ("candidate information" in combined or "thông tin ứng viên" in combined)
        and '"objective"' in combined
        and '"experience"' in combined
        and '"education"' in combined
        and ("return only valid json" in combined or "json hợp lệ" in combined)
    )


def is_smoke_checkpoint() -> bool:
    if _model is None:
        return True
    config = getattr(_model, "config", None)
    max_seq_len = getattr(config, "max_seq_len", 0)
    return _model_params < 2_000_000 or max_seq_len < 256 or "/smoke/" in _model_path.replace("\\", "/")


def generate_completion_id() -> str:
    """Generate a unique completion ID."""
    import random
    chars = "abcdefghijklmnopqrstuvwxyz0123456789"
    suffix = "".join(random.choices(chars, k=24))
    return f"chatcmpl-{suffix}"

# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------

@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "ok",
        "model": _model_name,
        "model_path": _model_path,
        "model_params": _model_params,
        "smoke_checkpoint": is_smoke_checkpoint(),
        "device": str(_device),
    }


@app.get("/v1/models")
async def list_models():
    """List available models (OpenAI-compatible)."""
    return ModelListResponse(
        data=[
            ModelInfo(
                id=_model_name,
                created=int(time.time()),
            )
        ]
    )


@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest):
    """
    OpenAI-compatible chat completion endpoint.

    This is the main endpoint called by the Node.js backend's
    lmstudio.service.js via the standard OpenAI API format.
    """
    if _model is None or _tokenizer is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    if request.stream:
        raise HTTPException(
            status_code=400,
            detail="Streaming is not supported. Set stream=false.",
        )

    # Format messages into model prompt
    prompt = format_chat_messages(request.messages)

    # Count prompt tokens
    prompt_token_ids = _tokenizer.encode(prompt).ids
    prompt_tokens = len(prompt_token_ids)

    # Generate response
    start_time = time.time()

    try:
        if is_cv_content_request(request.messages):
            candidate_info = extract_candidate_info(request.messages)
            content = generate_cv_content(
                model=_model,
                tokenizer=_tokenizer,
                candidate_info=candidate_info,
                max_new_tokens=min(request.max_tokens, 768),
                temperature=request.temperature,
                top_k=request.top_k,
                top_p=request.top_p,
                device=_device,
                use_model=not is_smoke_checkpoint(),
            )
            generated_text = json.dumps(
                {
                    "objective": content.get("objective", ""),
                    "experience": content.get("experience", ""),
                    "education": content.get("education", ""),
                    "skills": content.get("skills", ""),
                    "certifications": content.get("certifications", ""),
                    "hobbies": content.get("hobbies", ""),
                },
                ensure_ascii=False,
            )
        else:
            generated_text = generate(
                model=_model,
                tokenizer=_tokenizer,
                prompt=prompt,
                max_new_tokens=min(request.max_tokens, 256) if is_smoke_checkpoint() else request.max_tokens,
                temperature=request.temperature,
                top_k=request.top_k,
                top_p=request.top_p,
                device=_device,
            )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Generation failed: {str(e)}",
        )

    elapsed = time.time() - start_time

    # Count completion tokens
    completion_token_ids = _tokenizer.encode(generated_text).ids
    completion_tokens = len(completion_token_ids)

    print(
        f"[aptcv-model] Generated {completion_tokens} tokens "
        f"in {elapsed:.2f}s ({completion_tokens / max(elapsed, 0.01):.1f} tok/s)"
    )

    return ChatCompletionResponse(
        id=generate_completion_id(),
        created=int(time.time()),
        model=_model_name,
        choices=[
            ChatCompletionChoice(
                message=ChatMessage(role="assistant", content=generated_text),
                finish_reason="stop",
            )
        ],
        usage=UsageInfo(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
        ),
    )

# ---------------------------------------------------------------------------
# Model loading
# ---------------------------------------------------------------------------

def load_model(model_path: str, tokenizer_path: str, device_str: str = "auto"):
    """Load the aptcv-model and tokenizer into memory."""
    global _model, _tokenizer, _device, _model_name, _model_path, _model_params

    # Determine device
    if device_str == "auto":
        if torch.cuda.is_available():
            _device = torch.device("cuda")
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            _device = torch.device("mps")
        else:
            _device = torch.device("cpu")
    else:
        _device = torch.device(device_str)

    print(f"[aptcv-model] Using device: {_device}")

    # Load tokenizer
    print(f"[aptcv-model] Loading tokenizer from: {tokenizer_path}")
    _tokenizer = load_tokenizer_from_file(tokenizer_path)
    print(f"[aptcv-model] Tokenizer vocab size: {_tokenizer.get_vocab_size()}")

    # Load model
    print(f"[aptcv-model] Loading model from: {model_path}")
    _model_path = os.path.abspath(model_path)
    _model = APTCVModel.load_checkpoint(model_path, device=_device)
    _model.eval()
    _model_params = _model.count_parameters()
    print(f"[aptcv-model] Model loaded successfully!")
    print(f"[aptcv-model] Parameters: {_model_params:,}")
    if is_smoke_checkpoint():
        print("[aptcv-model] WARNING: smoke/tiny checkpoint detected; CV generation will use the hardened APTCV fallback.")


def resolve_default_model_path() -> str:
    preferred = os.path.join(ML_DIR, "models", "aptcv_cv_best.pt")
    smoke = os.path.join(ML_DIR, "models", "smoke", "aptcv_cv_best.pt")
    return preferred if os.path.exists(preferred) else smoke

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="APT-CV Model Server")
    parser.add_argument(
        "--model",
        type=str,
        default=resolve_default_model_path(),
        help="Path to the trained model checkpoint",
    )
    parser.add_argument(
        "--tokenizer",
        type=str,
        default=os.path.join(ML_DIR, "tokenizer", "aptcv_tokenizer.json"),
        help="Path to the tokenizer file",
    )
    parser.add_argument(
        "--host",
        type=str,
        default="0.0.0.0",
        help="Host to bind the server to",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port to run the server on",
    )
    parser.add_argument(
        "--device",
        type=str,
        default="auto",
        choices=["auto", "cpu", "cuda", "mps"],
        help="Device to run inference on",
    )
    args = parser.parse_args()

    # Load model before starting server
    load_model(args.model, args.tokenizer, args.device)

    print(f"\n[aptcv-model] Starting server at http://{args.host}:{args.port}")
    print(f"[aptcv-model] API endpoint: http://{args.host}:{args.port}/v1/chat/completions")
    print(f"[aptcv-model] Health check: http://{args.host}:{args.port}/")
    print()

    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
