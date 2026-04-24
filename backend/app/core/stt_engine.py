"""Speech-to-text engine with multiple backend support.

Tries backends in order of preference:
1. mlx-whisper (Apple Silicon optimized)
2. faster-whisper (GPU/CPU optimized)
3. openai-whisper (fallback)
"""

import logging
import os
import tempfile
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)


class STTError(Exception):
    """Raised when speech-to-text transcription fails."""
    pass


class STTEngine:
    """Speech-to-text engine that auto-detects the best available backend."""

    def __init__(self) -> None:
        self.engine_name: str = "none"
        self.model_size: str = settings.WHISPER_MODEL
        self._mlx_whisper = None
        self._faster_whisper_model = None
        self._openai_whisper_model = None

        self._detect_backend()

    def _detect_backend(self) -> None:
        """Detect which Whisper backend is available, in priority order."""

        # 1. Try mlx-whisper (Apple Silicon optimized)
        try:
            import mlx_whisper  # noqa: F401
            self._mlx_whisper = mlx_whisper
            self.engine_name = "mlx-whisper"
            logger.info("Using mlx-whisper backend (Apple Silicon optimized)")
            return
        except ImportError:
            logger.debug("mlx-whisper not available")

        # 2. Try faster-whisper (GPU/CPU optimized)
        try:
            from faster_whisper import WhisperModel
            self._faster_whisper_model = WhisperModel(
                self.model_size, device="auto", compute_type="default"
            )
            self.engine_name = "faster-whisper"
            logger.info("Using faster-whisper backend")
            return
        except ImportError:
            logger.debug("faster-whisper not available")

        # 3. Try openai-whisper (fallback)
        try:
            import whisper
            self._openai_whisper_model = whisper.load_model(self.model_size)
            self.engine_name = "openai-whisper"
            logger.info("Using openai-whisper backend (fallback)")
            return
        except ImportError:
            logger.debug("openai-whisper not available")

        logger.error(
            "No Whisper backend available. Install one of: "
            "mlx-whisper, faster-whisper, or openai-whisper."
        )

    def reload(self, model_size: str) -> None:
        """Reload with a different model size (e.g. 'small' -> 'medium')."""
        if model_size == self.model_size:
            logger.info("STT model size unchanged: %s", model_size)
            return

        old_size = self.model_size
        self.model_size = model_size
        logger.info("Switching STT model from %s to %s", old_size, model_size)

        if self.engine_name == "mlx-whisper":
            # mlx-whisper loads model lazily per transcribe call via path_or_hf_repo,
            # so we only need to update model_size
            logger.info("mlx-whisper: model_size updated, new model loads on next transcription")
        elif self.engine_name == "faster-whisper":
            from faster_whisper import WhisperModel
            self._faster_whisper_model = WhisperModel(
                self.model_size, device="auto", compute_type="default"
            )
            logger.info("faster-whisper: reloaded with model %s", model_size)
        elif self.engine_name == "openai-whisper":
            import whisper
            self._openai_whisper_model = whisper.load_model(self.model_size)
            logger.info("openai-whisper: reloaded with model %s", model_size)

    def transcribe(self, audio_wav: bytes, language: str) -> str:
        """Transcribe WAV audio data to text.

        Args:
            audio_wav: Audio data in WAV format (16kHz mono).
            language: Language code for transcription (e.g., 'nl', 'ar').

        Returns:
            Transcribed text string.

        Raises:
            STTError: If transcription fails or no backend is available.
        """
        if self.engine_name == "none":
            raise STTError(
                "No STT backend available. Install mlx-whisper, "
                "faster-whisper, or openai-whisper."
            )

        if not audio_wav:
            raise STTError("Empty audio data received for transcription")

        if self.engine_name == "mlx-whisper":
            return self._transcribe_mlx(audio_wav, language)
        elif self.engine_name == "faster-whisper":
            return self._transcribe_faster(audio_wav, language)
        elif self.engine_name == "openai-whisper":
            return self._transcribe_openai(audio_wav, language)
        else:
            raise STTError(f"Unknown engine: {self.engine_name}")

    def _transcribe_mlx(self, audio_wav: bytes, language: str) -> str:
        """Transcribe using mlx-whisper backend."""
        tmp_path: Optional[str] = None
        try:
            tmp_fd, tmp_path = tempfile.mkstemp(suffix=".wav")
            os.close(tmp_fd)
            with open(tmp_path, "wb") as f:
                f.write(audio_wav)

            model_path = f"mlx-community/whisper-{self.model_size}-mlx"
            result = self._mlx_whisper.transcribe(
                tmp_path,
                language=language,
                path_or_hf_repo=model_path,
            )
            text = result.get("text", "").strip()
            logger.debug("Transcription complete (%s), %d chars", language, len(text))
            return text
        except Exception as e:
            raise STTError(f"mlx-whisper transcription failed: {e}") from e
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)

    def _transcribe_faster(self, audio_wav: bytes, language: str) -> str:
        """Transcribe using faster-whisper backend."""
        tmp_path: Optional[str] = None
        try:
            tmp_fd, tmp_path = tempfile.mkstemp(suffix=".wav")
            os.close(tmp_fd)
            with open(tmp_path, "wb") as f:
                f.write(audio_wav)

            segments, _info = self._faster_whisper_model.transcribe(
                tmp_path, language=language
            )
            text = " ".join(segment.text for segment in segments).strip()
            logger.debug("Transcription complete (%s), %d chars", language, len(text))
            return text
        except Exception as e:
            raise STTError(f"faster-whisper transcription failed: {e}") from e
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)

    def _transcribe_openai(self, audio_wav: bytes, language: str) -> str:
        """Transcribe using openai-whisper backend."""
        tmp_path: Optional[str] = None
        try:
            tmp_fd, tmp_path = tempfile.mkstemp(suffix=".wav")
            os.close(tmp_fd)
            with open(tmp_path, "wb") as f:
                f.write(audio_wav)

            result = self._openai_whisper_model.transcribe(
                tmp_path, language=language
            )
            text = result.get("text", "").strip()
            logger.debug("Transcription complete (%s), %d chars", language, len(text))
            return text
        except Exception as e:
            raise STTError(f"openai-whisper transcription failed: {e}") from e
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)
