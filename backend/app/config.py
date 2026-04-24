"""Application configuration settings."""

import os
from dataclasses import dataclass, field
from pathlib import Path


# Set HuggingFace cache directory for bundled app
# This ensures models are stored in a predictable location
_hf_home = os.environ.get("HF_HOME")
if _hf_home:
    os.environ["HF_HOME"] = _hf_home
    os.environ["TRANSFORMERS_CACHE"] = os.path.join(_hf_home, "hub")
else:
    # Default cache location for packaged app
    _default_cache = Path.home() / "Library" / "Caches" / "vertaalapp"
    if getattr(os, "_MEIPASS", None):  # Running as PyInstaller bundle
        os.environ["HF_HOME"] = str(_default_cache)
        os.environ["TRANSFORMERS_CACHE"] = str(_default_cache / "hub")

# Ensure ffmpeg is on PATH (mlx-whisper calls ffmpeg as subprocess)
_ffmpeg_path = os.environ.get("FFMPEG_PATH", "")
if _ffmpeg_path and os.path.isfile(_ffmpeg_path):
    _ffmpeg_dir = os.path.dirname(os.path.abspath(_ffmpeg_path))
    _current_path = os.environ.get("PATH", "")
    if _ffmpeg_dir not in _current_path:
        os.environ["PATH"] = _ffmpeg_dir + os.pathsep + _current_path


@dataclass
class Settings:
    """Application settings for the vertaalapp backend."""

    # Whisper STT settings
    WHISPER_MODEL: str = os.environ.get("WHISPER_MODEL", "small")
    WHISPER_MODELS_AVAILABLE: list[str] = field(default_factory=lambda: ["small", "medium"])
    WHISPER_LANGUAGE_NL: str = "nl"
    WHISPER_LANGUAGE_AR: str = "ar"

    # Translation models are now managed by language_registry.py
    # (no hardcoded pairs — users select languages dynamically)

    # Audio processing settings
    SAMPLE_RATE: int = 16000
    FFMPEG_PATH: str = os.environ.get("FFMPEG_PATH", "ffmpeg")

    # Server settings
    HOST: str = "127.0.0.1"
    PORT: int = 8001
    CORS_ORIGINS: list[str] = field(default_factory=lambda: [
        "http://localhost:5173",
        "http://localhost:5174",
        "file://",
        "app://",
    ])


settings = Settings()
