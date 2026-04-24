"""Model manager for orchestrating STT and translation model loading."""

import asyncio
import logging
from typing import Callable, Optional

from app.core.language_registry import LanguageRegistry
from app.core.stt_engine import STTEngine
from app.core.translation_engine import TranslationEngine

logger = logging.getLogger(__name__)


class ModelManager:
    """Orchestrates loading and lifecycle management of all ML models."""

    def __init__(self) -> None:
        self.stt_engine: Optional[STTEngine] = None
        self.translation_engine: Optional[TranslationEngine] = None
        self.language_registry: Optional[LanguageRegistry] = None
        self._status: dict[str, str] = {
            "stt": "not_loaded",
            "translation": "not_loaded",
        }
        self._loading_lock = asyncio.Lock()
        self._models_ready: bool = False
        self._progress_callbacks: list[Callable] = []

    def add_progress_callback(self, callback: Callable) -> None:
        self._progress_callbacks.append(callback)

    def remove_progress_callback(self, callback: Callable) -> None:
        self._progress_callbacks = [
            cb for cb in self._progress_callbacks if cb is not callback
        ]

    async def _notify_progress(self) -> None:
        status = self.get_status()
        for callback in self._progress_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(status)
                else:
                    callback(status)
            except Exception as e:
                logger.debug("Progress callback error: %s", e)

    async def load_stt_and_installed_languages(self, registry: LanguageRegistry) -> None:
        """Load STT engine. Translation models load on-demand via set-pair."""
        self.language_registry = registry

        async with self._loading_lock:
            logger.info("Starting model loading...")
            await self._notify_progress()

            # Load STT engine
            await self._load_stt()
            await self._notify_progress()

            # Translation models load on-demand when user clicks "Start vertaalsessie"
            # This prevents blocking startup for minutes loading all installed languages
            self._status["translation"] = "loaded"
            logger.info("Translation models will load on-demand via set-pair")

            await self._notify_progress()

            # Ready for connections even if STT failed — translation is what matters
            self._models_ready = True
            if self._status["stt"] == "loaded":
                logger.info("STT loaded — fully ready")
            else:
                logger.warning("STT not available — translation still works, speech recognition disabled")

            await self._notify_progress()

    async def _load_stt(self) -> None:
        try:
            self._status["stt"] = "loading"
            logger.info("Loading STT engine...")
            self.stt_engine = await asyncio.to_thread(STTEngine)

            if self.stt_engine.engine_name == "none":
                self._status["stt"] = "error"
                logger.error("No STT backend available")
            else:
                self._status["stt"] = "loaded"
                logger.info("STT engine loaded: %s", self.stt_engine.engine_name)
        except Exception as e:
            self._status["stt"] = "error"
            logger.error("Failed to load STT engine: %s", e)

    async def _load_translation_for_languages(self, lang_codes: list[str]) -> None:
        """Load translation models for specific languages."""
        try:
            self._status["translation"] = "loading"
            logger.info("Loading translation models for: %s", lang_codes)

            if self.translation_engine is None:
                self.translation_engine = TranslationEngine()

            for lang in lang_codes:
                try:
                    await asyncio.to_thread(
                        self.translation_engine.load_language, lang
                    )
                except Exception as e:
                    logger.error("Failed to load models for %s: %s", lang, e)

            self._status["translation"] = "loaded"
            logger.info("Translation models loaded")
        except Exception as e:
            self._status["translation"] = "error"
            logger.error("Failed to load translation models: %s", e)

    async def ensure_language_loaded(self, lang_code: str) -> bool:
        """Ensure translation models for a language are loaded in memory.

        If the startup loading task is still running and holds the lock,
        we skip waiting for it and load the requested language directly.
        """
        if self.translation_engine is None:
            self.translation_engine = TranslationEngine()

        if self.translation_engine.is_language_loaded(lang_code):
            return True

        logger.info("Loading language on-demand: %s", lang_code)
        try:
            await asyncio.to_thread(
                self.translation_engine.load_language, lang_code
            )
            logger.info("Language loaded on-demand: %s", lang_code)
            return True
        except Exception as e:
            logger.error("Failed to load language %s: %s", lang_code, e)
            return False

    async def reload_stt(self, model_size: str) -> None:
        """Reload STT engine with a different model size."""
        if self.stt_engine is None:
            logger.error("Cannot reload STT: engine not loaded")
            return

        self._status["stt"] = "loading"
        await self._notify_progress()

        try:
            await asyncio.to_thread(self.stt_engine.reload, model_size)
            self._status["stt"] = "loaded"
            logger.info("STT engine reloaded with model: %s", model_size)
        except Exception as e:
            self._status["stt"] = "error"
            logger.error("Failed to reload STT engine: %s", e)

        await self._notify_progress()

    @property
    def stt_model_size(self) -> str:
        if self.stt_engine is not None:
            return self.stt_engine.model_size
        return "small"

    # Keep old load_all_models for backward compatibility
    async def load_all_models(self) -> None:
        """Legacy method — loads STT only. Use load_stt_and_installed_languages instead."""
        async with self._loading_lock:
            await self._load_stt()
            self._status["translation"] = "loaded"
            self._models_ready = self._status["stt"] == "loaded"
            await self._notify_progress()

    def get_status(self) -> dict:
        status = {
            "stt": self._status.get("stt", "not_loaded"),
            "translation": self._status.get("translation", "not_loaded"),
            "models_ready": self._models_ready,
        }

        if self.translation_engine is not None:
            status["translation_models"] = self.translation_engine.get_status()

        if self.language_registry is not None:
            status["installed_languages"] = self.language_registry.installed_languages
            status["active_pair"] = self.language_registry.active_pair

        return status

    @property
    def models_ready(self) -> bool:
        return self._models_ready

    @property
    def engine_name(self) -> str:
        if self.stt_engine is not None:
            return self.stt_engine.engine_name
        return "none"
