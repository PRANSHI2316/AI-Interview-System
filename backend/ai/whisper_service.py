"""
Lazy singleton Whisper loader — one model instance per process, loaded on first use.
Optimized for low-memory CPU hosts (e.g. Railway).
"""
import gc
import os
import threading
from typing import Any, Dict

_WHISPER_MODEL: Any = None
_LOAD_LOCK = threading.Lock()
_ALLOWED_MODELS = frozenset({"tiny", "base"})
_HEAVY_MODELS = frozenset(
    {"small", "medium", "large", "large-v1", "large-v2", "large-v3", "turbo"}
)
_torch_configured = False


def _configure_torch() -> None:
    global _torch_configured
    if _torch_configured:
        return
    os.environ.setdefault("CUDA_VISIBLE_DEVICES", "")
    try:
        import torch

        torch.set_num_threads(1)
        if hasattr(torch, "set_num_interop_threads"):
            torch.set_num_interop_threads(1)
    except Exception as exc:
        print(f"[Whisper] torch thread config skipped: {exc}")
    _torch_configured = True


def _resolve_model_name() -> str:
    requested = (os.environ.get("WHISPER_MODEL") or "base").strip().lower()
    if requested in _ALLOWED_MODELS:
        return requested
    if requested in _HEAVY_MODELS:
        print(
            f"[Whisper] Model '{requested}' is too heavy for this deployment; using 'base'."
        )
        return "base"
    print(f"[Whisper] Unknown WHISPER_MODEL '{requested}'; using 'base'.")
    return "base"


def get_whisper_model():
    """Return the singleton Whisper model, loading it once on first access."""
    global _WHISPER_MODEL
    if _WHISPER_MODEL is not None:
        return _WHISPER_MODEL

    with _LOAD_LOCK:
        if _WHISPER_MODEL is not None:
            return _WHISPER_MODEL

        _configure_torch()
        import whisper

        model_name = _resolve_model_name()
        print(f"[Whisper] Loading model '{model_name}' (one-time, lazy)...")
        _WHISPER_MODEL = whisper.load_model(model_name)
        print("[Whisper] Model ready.")
        return _WHISPER_MODEL


def is_whisper_loaded() -> bool:
    return _WHISPER_MODEL is not None


def _release_torch_cache() -> None:
    try:
        import torch

        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:
        pass
    gc.collect()


def transcribe_file(audio_path: str) -> Dict[str, Any]:
    """
    Transcribe audio with the shared model.
    Returns {"ok": True, "text": "..."} or {"ok": False, "error": "..."}.
    """
    try:
        model = get_whisper_model()
        result = model.transcribe(
            audio_path,
            fp16=False,
            verbose=False,
        )
        text = (result.get("text") or "").strip()
        return {"ok": True, "text": text}
    except MemoryError as exc:
        print(f"[Whisper] MemoryError during transcribe: {exc}")
        _release_torch_cache()
        return {
            "ok": False,
            "error": "Speech recognition is temporarily overloaded. Please try again in a moment.",
            "detail": str(exc),
        }
    except Exception as exc:
        print(f"[Whisper] transcribe failed: {exc}")
        return {"ok": False, "error": str(exc)}
    finally:
        _release_torch_cache()
