"""Audio processing utilities for converting audio formats."""

import subprocess
import logging

from app.config import settings

logger = logging.getLogger(__name__)


class AudioProcessingError(Exception):
    """Raised when audio processing fails."""
    pass


class AudioProcessor:
    """Handles audio format conversion using ffmpeg."""

    def __init__(self) -> None:
        self.ffmpeg_path: str = settings.FFMPEG_PATH
        self.sample_rate: int = settings.SAMPLE_RATE

    def convert_webm_to_wav(self, audio_data: bytes) -> bytes:
        """Convert WebM/Opus audio data to 16kHz mono WAV using ffmpeg.

        Uses stdin/stdout pipes to avoid temporary files.

        Args:
            audio_data: Raw audio bytes in WebM/Opus format.

        Returns:
            Audio bytes in 16kHz mono WAV format.

        Raises:
            AudioProcessingError: If ffmpeg conversion fails.
        """
        if not audio_data:
            raise AudioProcessingError("Empty audio data received")

        cmd = [
            self.ffmpeg_path,
            "-i", "pipe:0",          # Read from stdin
            "-ar", str(self.sample_rate),  # Set sample rate to 16kHz
            "-ac", "1",              # Mono channel
            "-f", "wav",             # Output format WAV
            "-acodec", "pcm_s16le",  # 16-bit PCM encoding
            "pipe:1",                # Write to stdout
        ]

        try:
            process = subprocess.run(
                cmd,
                input=audio_data,
                capture_output=True,
                timeout=30,
            )
        except FileNotFoundError:
            raise AudioProcessingError(
                f"ffmpeg not found at '{self.ffmpeg_path}'. "
                "Please install ffmpeg and ensure it is on your PATH."
            )
        except subprocess.TimeoutExpired:
            raise AudioProcessingError(
                "Audio conversion timed out after 30 seconds."
            )
        except Exception as e:
            raise AudioProcessingError(
                f"Unexpected error during audio conversion: {e}"
            )

        if process.returncode != 0:
            stderr_output = process.stderr.decode("utf-8", errors="replace")
            raise AudioProcessingError(
                f"ffmpeg conversion failed (exit code {process.returncode}): "
                f"{stderr_output}"
            )

        wav_data = process.stdout
        if not wav_data:
            raise AudioProcessingError(
                "ffmpeg produced no output. The input audio may be corrupted."
            )

        logger.debug(
            "Converted audio: %d bytes input -> %d bytes WAV output",
            len(audio_data),
            len(wav_data),
        )
        return wav_data
