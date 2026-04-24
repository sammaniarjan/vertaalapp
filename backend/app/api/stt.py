"""STT model management endpoints."""

import logging
import os
from pathlib import Path

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/stt", tags=["stt"])


def _is_model_downloaded(model_size: str) -> bool:
    """Check if a Whisper model is already in the HuggingFace cache."""
    hf_home = os.environ.get("HF_HOME", str(Path.home() / "Library" / "Caches" / "vertaalapp"))
    # HuggingFace stores models in hub/models--{org}--{name}/
    cache_dir = Path(hf_home) / "hub" / f"models--mlx-community--whisper-{model_size}-mlx"
    if cache_dir.exists():
        # Check for snapshot dir with actual model files
        snapshots = cache_dir / "snapshots"
        if snapshots.exists() and any(snapshots.iterdir()):
            return True
    return False


WHISPER_MODELS_META = {
    "small": {
        "label": "Snel",
        "description": "Snelle herkenning, goed voor de meeste talen",
        "size_mb": 500,
        "ram_gb": 2,
    },
    "medium": {
        "label": "Nauwkeurig",
        "description": "Betere herkenning voor Farsi, Somalisch, Tigrinya. Meer geheugen nodig (~5GB).",
        "size_mb": 1500,
        "ram_gb": 5,
    },
}


@router.get("/models")
async def get_stt_models(request: Request):
    """Return available STT models with metadata and download status."""
    model_manager = request.app.state.model_manager
    active = model_manager.stt_model_size

    models = []
    for name in settings.WHISPER_MODELS_AVAILABLE:
        meta = WHISPER_MODELS_META.get(name, {})
        models.append({
            "name": name,
            "label": meta.get("label", name),
            "description": meta.get("description", ""),
            "size_mb": meta.get("size_mb", 0),
            "ram_gb": meta.get("ram_gb", 0),
            "downloaded": _is_model_downloaded(name),
        })

    return {"models": models, "active": active}


class SetModelRequest(BaseModel):
    model: str


@router.post("/set-model")
async def set_stt_model(request: Request, body: SetModelRequest):
    """Switch the active STT model."""
    model_manager = request.app.state.model_manager

    if body.model not in settings.WHISPER_MODELS_AVAILABLE:
        return {
            "status": "error",
            "message": f"Ongeldig model: {body.model}. Kies uit: {settings.WHISPER_MODELS_AVAILABLE}",
        }

    await model_manager.reload_stt(body.model)

    return {
        "status": "ok",
        "active": model_manager.stt_model_size,
    }
