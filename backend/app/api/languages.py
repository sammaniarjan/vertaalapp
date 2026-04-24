"""Language management API endpoints."""

import asyncio
import logging

from fastapi import APIRouter, Request
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/languages")


class DownloadRequest(BaseModel):
    lang_code: str


class SetPairRequest(BaseModel):
    source: str
    target: str


@router.get("")
async def list_languages(request: Request) -> dict:
    """List all supported languages with installation status."""
    registry = request.app.state.language_registry
    return {
        "languages": registry.get_all_languages(),
        "active_pair": registry.active_pair,
        "installed": registry.installed_languages,
    }


@router.post("/download")
async def download_language(request: Request, body: DownloadRequest) -> dict:
    """Start downloading models for a language (runs in background)."""
    registry = request.app.state.language_registry

    async def do_download():
        await registry.download_language(body.lang_code)

    asyncio.create_task(do_download())

    return {"status": "started", "lang_code": body.lang_code}


@router.post("/set-pair")
async def set_active_pair(request: Request, body: SetPairRequest) -> dict:
    """Set the active translation language pair and load models into memory."""
    registry = request.app.state.language_registry
    model_manager = request.app.state.model_manager

    if not registry.is_pair_ready(body.source, body.target):
        return {
            "status": "error",
            "message": f"Models not installed for {body.source} <-> {body.target}",
        }

    # Ensure translation models are loaded in memory for both languages
    for lang in (body.source, body.target):
        loaded = await model_manager.ensure_language_loaded(lang)
        if not loaded:
            return {
                "status": "error",
                "message": f"Failed to load models for {lang}",
            }

    registry.set_active_pair(body.source, body.target)
    return {"status": "ok", "active_pair": [body.source, body.target]}


@router.get("/status")
async def download_status(request: Request) -> dict:
    """Get current download progress for all active downloads."""
    registry = request.app.state.language_registry
    return {
        "downloads": registry._download_progress,
        "installed": registry.installed_languages,
    }
