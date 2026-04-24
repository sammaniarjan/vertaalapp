"""System information API endpoint."""

import os
import platform
import shutil
from pathlib import Path

import psutil
from fastapi import APIRouter, Request

router = APIRouter()


def _dir_size_mb(path: str) -> float | None:
    """Return directory size in MB, or None if it doesn't exist."""
    p = Path(path)
    if not p.exists():
        return None
    total = sum(f.stat().st_size for f in p.rglob("*") if f.is_file())
    return round(total / (1024 * 1024), 1)


@router.get("/api/system")
async def system_info(request: Request) -> dict:
    """Return system information for the About page."""
    model_manager = request.app.state.model_manager

    # Memory info
    mem = psutil.virtual_memory()

    # Cache directory
    hf_home = os.environ.get("HF_HOME", "")
    default_cache = Path.home() / "Library" / "Caches" / "vertaalapp"
    cache_dir = hf_home if hf_home else str(default_cache)

    # Disk space
    disk = shutil.disk_usage("/")

    return {
        "system": {
            "platform": platform.system(),
            "arch": platform.machine(),
            "python": platform.python_version(),
            "cpu_count": os.cpu_count(),
            "ram_total_gb": round(mem.total / (1024**3), 1),
            "ram_available_gb": round(mem.available / (1024**3), 1),
            "ram_percent_used": mem.percent,
            "disk_free_gb": round(disk.free / (1024**3), 1),
        },
        "models": {
            k: v
            for k, v in model_manager.get_status().items()
            if isinstance(v, str)
        },
        "stt_engine": model_manager.engine_name,
        "cache_size_mb": _dir_size_mb(cache_dir),
    }
