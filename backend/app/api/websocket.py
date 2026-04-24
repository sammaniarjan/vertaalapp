"""WebSocket endpoint for real-time audio translation."""

import asyncio
import json
import logging
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.audio_processor import AudioProcessor, AudioProcessingError
from app.core.language_registry import SUPPORTED_LANGUAGES
from app.core.stt_engine import STTError
from app.core.translation_engine import TranslationError

logger = logging.getLogger(__name__)

router = APIRouter()

audio_processor = AudioProcessor()

MAX_AUDIO_BYTES = 5 * 1024 * 1024  # 5 MB

ALLOWED_ORIGINS = {
    "http://localhost:5173", "http://localhost:5174",
    "http://127.0.0.1:5173", "http://127.0.0.1:5174",
    "http://127.0.0.1:8001", "file://", "app://",
}


@router.websocket("/ws/translate")
async def websocket_translate(websocket: WebSocket) -> None:
    """WebSocket endpoint for real-time speech-to-text and translation.

    Protocol:
        1. On connect: server sends session_init message.
        2. Client sends text frame with audio metadata (JSON), including
           is_final flag and session_id.
        3. Client sends binary frame with audio data.
        4. For interim chunks (is_final=False): transcribe only, return quickly.
        5. For final chunks (is_final=True): transcribe + translate.
    """
    model_manager = websocket.app.state.model_manager

    # Validate origin to prevent cross-site WebSocket hijacking
    origin = websocket.headers.get("origin", "")
    if origin and origin not in ALLOWED_ORIGINS:
        await websocket.close(code=4403, reason="Origin not allowed")
        return

    await websocket.accept()

    await websocket.send_json({
        "type": "session_init",
        "models_ready": model_manager.models_ready,
        "stt_engine": model_manager.engine_name,
        "stt_model": model_manager.stt_model_size,
    })

    # Register progress callback to push model status updates to this client
    async def send_models_status(status: dict) -> None:
        try:
            await websocket.send_json({
                "type": "models_status",
                "all_ready": status.get("models_ready", False),
                "details": {
                    "stt": status.get("stt", "not_loaded"),
                    "translation": status.get("translation", "not_loaded"),
                },
            })
        except Exception:
            pass

    model_manager.add_progress_callback(send_models_status)

    try:
        while True:
            try:
                meta_raw = await websocket.receive_text()
                meta = json.loads(meta_raw)
            except json.JSONDecodeError as e:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Invalid JSON in metadata: {e}",
                })
                continue

            if meta.get("type") != "audio_meta":
                await websocket.send_json({
                    "type": "error",
                    "message": f"Expected 'audio_meta', got '{meta.get('type')}'",
                })
                continue

            chunk_id = meta.get("chunk_id")
            source_lang = meta.get("source_lang")
            target_lang = meta.get("target_lang")
            is_final = meta.get("is_final", True)
            session_id = meta.get("session_id", chunk_id)

            if not source_lang or not target_lang:
                await websocket.send_json({
                    "type": "error",
                    "message": "Missing 'source_lang' or 'target_lang'",
                    "chunk_id": chunk_id,
                })
                continue

            if source_lang not in SUPPORTED_LANGUAGES or target_lang not in SUPPORTED_LANGUAGES:
                await websocket.send_json({
                    "type": "error",
                    "message": "Onbekende taal",
                    "chunk_id": chunk_id,
                })
                continue

            audio_data = await websocket.receive_bytes()

            if len(audio_data) > MAX_AUDIO_BYTES:
                await websocket.send_json({
                    "type": "error",
                    "message": "Audio te groot",
                    "chunk_id": chunk_id,
                })
                continue

            if not audio_data:
                await websocket.send_json({
                    "type": "error",
                    "message": "Empty audio data",
                    "chunk_id": chunk_id,
                })
                continue

            start_time = time.monotonic()

            try:
                wav_data = await asyncio.to_thread(
                    audio_processor.convert_webm_to_wav, audio_data
                )

                if model_manager.stt_engine is None or model_manager.engine_name == "none":
                    await websocket.send_json({
                        "type": "error",
                        "message": "Spraakherkenning is niet beschikbaar",
                        "chunk_id": chunk_id,
                    })
                    continue

                original_text = await asyncio.to_thread(
                    model_manager.stt_engine.transcribe, wav_data, source_lang
                )

                # Send transcription result (interim or final)
                await websocket.send_json({
                    "type": "transcription",
                    "chunk_id": chunk_id,
                    "source_lang": source_lang,
                    "original_text": original_text,
                    "is_final": is_final,
                    "session_id": session_id,
                })

                # Only translate on final chunk
                if not is_final or not original_text:
                    continue

                if model_manager.translation_engine is None:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Translation engine not loaded",
                        "chunk_id": chunk_id,
                    })
                    continue

                translated_text = await asyncio.to_thread(
                    model_manager.translation_engine.translate,
                    original_text,
                    source_lang,
                    target_lang,
                )

                elapsed_ms = round((time.monotonic() - start_time) * 1000)

                await websocket.send_json({
                    "type": "translation",
                    "chunk_id": chunk_id,
                    "original_text": original_text,
                    "translated_text": translated_text,
                    "source_lang": source_lang,
                    "target_lang": target_lang,
                    "processing_time_ms": elapsed_ms,
                    "session_id": session_id,
                })

                logger.info(
                    "Chunk %s processed in %dms: %s -> %s",
                    chunk_id, elapsed_ms, source_lang, target_lang,
                )

            except (AudioProcessingError, STTError, TranslationError) as e:
                logger.error("Processing error %s: %s", chunk_id, e)
                try:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Er is een fout opgetreden bij de verwerking",
                        "chunk_id": chunk_id,
                    })
                except Exception:
                    break
            except WebSocketDisconnect:
                raise
            except Exception as e:
                logger.exception("Unexpected error %s", chunk_id)
                try:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Er is een fout opgetreden bij de verwerking",
                        "chunk_id": chunk_id,
                    })
                except Exception:
                    break

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.exception("WebSocket connection error: %s", e)
    finally:
        model_manager.remove_progress_callback(send_models_status)
