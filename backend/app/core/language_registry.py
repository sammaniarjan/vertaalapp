"""Language registry: tracks available and installed translation languages."""

import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional

from transformers import MarianMTModel, MarianTokenizer

logger = logging.getLogger(__name__)

# All supported languages with translation model configuration.
#
# engine: "marianmt" (default) — dedicated Helsinki-NLP per-language models via English pivot
#         "nllb"              — Facebook NLLB-200 multilingual model (direct translation)
#
# quality: "high"   — dedicated model with 100K+ downloads, well-tested
#          "good"   — dedicated model or tc-big variant, solid quality
#          "basic"  — group model (zlw/roa) or NLLB fallback, functional but less refined

NLLB_MODEL_NAME = "facebook/nllb-200-distilled-600M"

SUPPORTED_LANGUAGES: dict[str, dict] = {
    "nl": {
        "name": "Nederlands",
        "native_name": "Nederlands",
        "flag": "\U0001f1f3\U0001f1f1",
        "quality": "high",
        "models": {
            "to_en": "Helsinki-NLP/opus-mt-nl-en",
            "from_en": "Helsinki-NLP/opus-mt-en-nl",
        },
    },
    "ar": {
        "name": "Arabisch",
        "native_name": "\u0627\u0644\u0639\u0631\u0628\u064a\u0629",
        "flag": "\U0001f1f8\U0001f1e6",
        "rtl": True,
        "quality": "high",
        "models": {
            "to_en": "Helsinki-NLP/opus-mt-ar-en",
            "from_en": "Helsinki-NLP/opus-mt-en-ar",
        },
    },
    "tr": {
        "name": "Turks",
        "native_name": "T\u00fcrk\u00e7e",
        "flag": "\U0001f1f9\U0001f1f7",
        "quality": "good",
        "models": {
            "to_en": "Helsinki-NLP/opus-mt-tc-big-tr-en",
            "from_en": "Helsinki-NLP/opus-mt-tc-big-en-tr",
        },
    },
    "fr": {
        "name": "Frans",
        "native_name": "Fran\u00e7ais",
        "flag": "\U0001f1eb\U0001f1f7",
        "quality": "high",
        "models": {
            "to_en": "Helsinki-NLP/opus-mt-fr-en",
            "from_en": "Helsinki-NLP/opus-mt-en-fr",
        },
    },
    "de": {
        "name": "Duits",
        "native_name": "Deutsch",
        "flag": "\U0001f1e9\U0001f1ea",
        "quality": "high",
        "models": {
            "to_en": "Helsinki-NLP/opus-mt-de-en",
            "from_en": "Helsinki-NLP/opus-mt-en-de",
        },
    },
    "es": {
        "name": "Spaans",
        "native_name": "Espa\u00f1ol",
        "flag": "\U0001f1ea\U0001f1f8",
        "quality": "high",
        "models": {
            "to_en": "Helsinki-NLP/opus-mt-es-en",
            "from_en": "Helsinki-NLP/opus-mt-en-es",
        },
    },
    "pl": {
        "name": "Pools",
        "native_name": "Polski",
        "flag": "\U0001f1f5\U0001f1f1",
        "quality": "basic",
        "models": {
            "to_en": "Helsinki-NLP/opus-mt-pl-en",
            "from_en": "Helsinki-NLP/opus-mt-en-zlw",
        },
    },
    "ru": {
        "name": "Russisch",
        "native_name": "\u0420\u0443\u0441\u0441\u043a\u0438\u0439",
        "flag": "\U0001f1f7\U0001f1fa",
        "quality": "high",
        "models": {
            "to_en": "Helsinki-NLP/opus-mt-ru-en",
            "from_en": "Helsinki-NLP/opus-mt-en-ru",
        },
    },
    "uk": {
        "name": "Oekra\u00efens",
        "native_name": "\u0423\u043a\u0440\u0430\u0457\u043d\u0441\u044c\u043a\u0430",
        "flag": "\U0001f1fa\U0001f1e6",
        "quality": "good",
        "models": {
            "to_en": "Helsinki-NLP/opus-mt-uk-en",
            "from_en": "Helsinki-NLP/opus-mt-en-uk",
        },
    },
    "zh": {
        "name": "Chinees",
        "native_name": "\u4e2d\u6587",
        "flag": "\U0001f1e8\U0001f1f3",
        "quality": "good",
        "models": {
            "to_en": "Helsinki-NLP/opus-mt-zh-en",
            "from_en": "Helsinki-NLP/opus-mt-en-zh",
        },
    },
    "it": {
        "name": "Italiaans",
        "native_name": "Italiano",
        "flag": "\U0001f1ee\U0001f1f9",
        "quality": "high",
        "models": {
            "to_en": "Helsinki-NLP/opus-mt-it-en",
            "from_en": "Helsinki-NLP/opus-mt-en-it",
        },
    },
    "pt": {
        "name": "Portugees",
        "native_name": "Portugu\u00eas",
        "flag": "\U0001f1f5\U0001f1f9",
        "quality": "basic",
        "models": {
            "to_en": "Helsinki-NLP/opus-mt-roa-en",
            "from_en": "Helsinki-NLP/opus-mt-tc-big-en-pt",
        },
    },
    # --- NLLB-backed languages (no dedicated MarianMT models) ---
    "fa": {
        "name": "Farsi",
        "native_name": "\u0641\u0627\u0631\u0633\u06cc",
        "flag": "\U0001f1ee\U0001f1f7",
        "rtl": True,
        "engine": "nllb",
        "quality": "basic",
        "models": {
            "nllb": NLLB_MODEL_NAME,
        },
    },
    "so": {
        "name": "Somalisch",
        "native_name": "Soomaali",
        "flag": "\U0001f1f8\U0001f1f4",
        "engine": "nllb",
        "quality": "basic",
        "models": {
            "nllb": NLLB_MODEL_NAME,
        },
    },
    "ti": {
        "name": "Tigrinya",
        "native_name": "\u1275\u130d\u122d\u129b",
        "flag": "\U0001f1ea\U0001f1f7",
        "engine": "nllb",
        "quality": "basic",
        "models": {
            "nllb": NLLB_MODEL_NAME,
        },
    },
}


def _get_state_path() -> Path:
    """Get path to the persistent language state JSON file."""
    hf_home = os.environ.get("HF_HOME", "")
    if hf_home:
        base = Path(hf_home)
    else:
        base = Path.home() / "Library" / "Caches" / "vertaalapp"
    base.mkdir(parents=True, exist_ok=True)
    return base / "languages.json"


def _load_state() -> dict:
    """Load language state from disk."""
    path = _get_state_path()
    if path.exists():
        try:
            return json.loads(path.read_text())
        except (json.JSONDecodeError, OSError):
            pass
    return {"installed": [], "active_pair": None}


def _save_state(state: dict) -> None:
    """Persist language state to disk."""
    path = _get_state_path()
    path.write_text(json.dumps(state, indent=2))


def _get_hf_cache_dirs() -> list[Path]:
    """Return all possible HuggingFace cache directories to scan."""
    dirs = []
    # Explicit HF_HOME
    hf_home = os.environ.get("HF_HOME", "")
    if hf_home:
        dirs.append(Path(hf_home) / "hub")
    # App-specific cache
    dirs.append(Path.home() / "Library" / "Caches" / "vertaalapp" / "hub")
    # Default HuggingFace cache
    dirs.append(Path.home() / ".cache" / "huggingface" / "hub")
    return dirs


def _model_exists_in_cache(model_name: str) -> bool:
    """Check if a HuggingFace model is already downloaded in any cache dir.

    HF caches models as: hub/models--{org}--{model}/
    e.g. Helsinki-NLP/opus-mt-nl-en -> models--Helsinki-NLP--opus-mt-nl-en
    """
    # Convert model name to cache directory name
    cache_dir_name = f"models--{model_name.replace('/', '--')}"
    for cache_dir in _get_hf_cache_dirs():
        model_dir = cache_dir / cache_dir_name
        if model_dir.exists():
            # Check it actually has snapshot files (not just an empty dir)
            snapshots = model_dir / "snapshots"
            if snapshots.exists() and any(snapshots.iterdir()):
                return True
    return False


def _detect_installed_languages() -> list[str]:
    """Scan HuggingFace cache to detect languages with required models already downloaded."""
    detected = []
    for code, info in SUPPORTED_LANGUAGES.items():
        engine = info.get("engine", "marianmt")
        models = info["models"]

        if engine == "nllb":
            # NLLB languages only need the shared NLLB model
            if _model_exists_in_cache(models["nllb"]):
                detected.append(code)
                logger.info("Detected cached NLLB model for language: %s", code)
        else:
            # MarianMT languages need both direction models
            to_en_exists = _model_exists_in_cache(models["to_en"])
            from_en_exists = _model_exists_in_cache(models["from_en"])
            if to_en_exists and from_en_exists:
                detected.append(code)
                logger.info("Detected cached models for language: %s", code)
    return detected


class LanguageRegistry:
    """Manages available, installed, and active translation languages."""

    def __init__(self) -> None:
        self._state = _load_state()
        self._download_progress: dict[str, dict] = {}
        self._progress_callbacks: list[Callable] = []

        # Scan cache for pre-existing model downloads
        self._sync_with_cache()

    def _sync_with_cache(self) -> None:
        """Detect already-downloaded models and mark them as installed."""
        detected = _detect_installed_languages()
        current_installed = set(self._state.get("installed", []))
        new_langs = [lang for lang in detected if lang not in current_installed]

        if new_langs:
            logger.info(
                "Found %d pre-downloaded language(s): %s",
                len(new_langs), ", ".join(new_langs),
            )
            self._state["installed"] = list(current_installed | set(detected))
            _save_state(self._state)

    def add_progress_callback(self, cb: Callable) -> None:
        self._progress_callbacks.append(cb)

    def remove_progress_callback(self, cb: Callable) -> None:
        self._progress_callbacks = [c for c in self._progress_callbacks if c is not cb]

    async def _notify(self, event: dict) -> None:
        import asyncio
        for cb in self._progress_callbacks:
            try:
                if asyncio.iscoroutinefunction(cb):
                    await cb(event)
                else:
                    cb(event)
            except Exception:
                pass

    @property
    def installed_languages(self) -> list[str]:
        return self._state.get("installed", [])

    @property
    def active_pair(self) -> Optional[tuple[str, str]]:
        pair = self._state.get("active_pair")
        if pair and len(pair) == 2:
            return (pair[0], pair[1])
        return None

    def set_active_pair(self, source: str, target: str) -> None:
        """Set the active translation pair and persist."""
        self._state["active_pair"] = [source, target]
        _save_state(self._state)

    def get_all_languages(self) -> list[dict]:
        """Return all supported languages with their installation status."""
        installed = set(self.installed_languages)
        result = []
        for code, info in SUPPORTED_LANGUAGES.items():
            dl = self._download_progress.get(code, {})
            result.append({
                "code": code,
                "name": info["name"],
                "native_name": info["native_name"],
                "flag": info.get("flag", ""),
                "rtl": info.get("rtl", False),
                "engine": info.get("engine", "marianmt"),
                "quality": info.get("quality", "good"),
                "installed": code in installed,
                "downloading": dl.get("status") == "downloading",
                "progress": dl.get("progress", 0),
                "error": dl.get("error"),
            })
        return result

    def is_pair_ready(self, source: str, target: str) -> bool:
        """Check if a translation pair has all required models installed."""
        installed = set(self.installed_languages)
        # Both languages need to be installed (they go through English pivot)
        return source in installed and target in installed

    async def download_language(self, lang_code: str) -> bool:
        """Download translation models for a language. Returns True on success."""
        import asyncio

        if lang_code not in SUPPORTED_LANGUAGES:
            logger.error("Unknown language: %s", lang_code)
            return False

        if lang_code in self.installed_languages:
            logger.info("Language %s already installed", lang_code)
            return True

        info = SUPPORTED_LANGUAGES[lang_code]
        engine = info.get("engine", "marianmt")

        self._download_progress[lang_code] = {
            "progress": 0,
            "status": "downloading",
            "current_model": "",
        }

        try:
            if engine == "nllb":
                await self._download_nllb_language(lang_code, info)
            else:
                await self._download_marianmt_language(lang_code, info)

            # Mark as installed
            if lang_code not in self._state["installed"]:
                self._state["installed"].append(lang_code)
                _save_state(self._state)

            logger.info("Language %s installed successfully", lang_code)
            return True

        except Exception as e:
            logger.error("Failed to download language %s: %s", lang_code, e)
            self._download_progress[lang_code] = {
                "progress": 0,
                "status": "error",
                "error": str(e),
            }
            await self._notify({
                "type": "download_progress",
                "lang": lang_code,
                **self._download_progress[lang_code],
            })
            return False
        finally:
            import asyncio
            status = self._download_progress.get(lang_code, {}).get("status")
            await asyncio.sleep(10 if status == "error" else 2)
            self._download_progress.pop(lang_code, None)

    async def _download_marianmt_language(self, lang_code: str, info: dict) -> None:
        """Download MarianMT model pair for a language."""
        import asyncio
        models = info["models"]

        # Download to_en model (50%)
        model_name = models["to_en"]
        self._download_progress[lang_code] = {
            "progress": 5,
            "status": "downloading",
            "current_model": model_name,
        }
        await self._notify({
            "type": "download_progress",
            "lang": lang_code,
            **self._download_progress[lang_code],
        })

        logger.info("Downloading %s -> en model: %s", lang_code, model_name)
        await asyncio.to_thread(MarianTokenizer.from_pretrained, model_name)
        self._download_progress[lang_code]["progress"] = 25
        await self._notify({
            "type": "download_progress",
            "lang": lang_code,
            **self._download_progress[lang_code],
        })

        await asyncio.to_thread(MarianMTModel.from_pretrained, model_name)
        self._download_progress[lang_code]["progress"] = 50
        await self._notify({
            "type": "download_progress",
            "lang": lang_code,
            **self._download_progress[lang_code],
        })

        # Download from_en model (100%)
        model_name = models["from_en"]
        self._download_progress[lang_code] = {
            "progress": 55,
            "status": "downloading",
            "current_model": model_name,
        }
        await self._notify({
            "type": "download_progress",
            "lang": lang_code,
            **self._download_progress[lang_code],
        })

        logger.info("Downloading en -> %s model: %s", lang_code, model_name)
        await asyncio.to_thread(MarianTokenizer.from_pretrained, model_name)
        self._download_progress[lang_code]["progress"] = 75
        await self._notify({
            "type": "download_progress",
            "lang": lang_code,
            **self._download_progress[lang_code],
        })

        await asyncio.to_thread(MarianMTModel.from_pretrained, model_name)
        self._download_progress[lang_code]["progress"] = 100
        await self._notify({
            "type": "download_progress",
            "lang": lang_code,
            **self._download_progress[lang_code],
        })

    async def _download_nllb_language(self, lang_code: str, info: dict) -> None:
        """Download the shared NLLB model for an NLLB-backed language."""
        import asyncio
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

        model_name = info["models"]["nllb"]

        # Check if NLLB model is already cached
        if _model_exists_in_cache(model_name):
            logger.info("NLLB model already cached for %s", lang_code)
            self._download_progress[lang_code] = {
                "progress": 100,
                "status": "downloading",
                "current_model": model_name,
            }
            await self._notify({
                "type": "download_progress",
                "lang": lang_code,
                **self._download_progress[lang_code],
            })
            return

        self._download_progress[lang_code] = {
            "progress": 5,
            "status": "downloading",
            "current_model": model_name,
        }
        await self._notify({
            "type": "download_progress",
            "lang": lang_code,
            **self._download_progress[lang_code],
        })

        logger.info("Downloading NLLB model for %s: %s", lang_code, model_name)
        await asyncio.to_thread(AutoTokenizer.from_pretrained, model_name)
        self._download_progress[lang_code]["progress"] = 50
        await self._notify({
            "type": "download_progress",
            "lang": lang_code,
            **self._download_progress[lang_code],
        })

        await asyncio.to_thread(AutoModelForSeq2SeqLM.from_pretrained, model_name)
        self._download_progress[lang_code]["progress"] = 100
        await self._notify({
            "type": "download_progress",
            "lang": lang_code,
            **self._download_progress[lang_code],
        })

    def get_model_name(self, source: str, target: str, direction: str) -> Optional[str]:
        """Get Helsinki-NLP model name for a translation direction.

        direction: 'to_en' or 'from_en'
        """
        lang = source if direction == "to_en" else target
        info = SUPPORTED_LANGUAGES.get(lang)
        if not info:
            return None
        return info["models"].get(direction)
