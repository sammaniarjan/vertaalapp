"""FastAPI application entry point."""

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.languages import router as languages_router
from app.api.stt import router as stt_router
from app.api.system import router as system_router
from app.api.websocket import router as websocket_router
from app.config import settings
from app.core.language_registry import LanguageRegistry
from app.core.model_manager import ModelManager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan context manager.

    Creates the ModelManager and begins loading all models in the background.
    The server starts accepting connections immediately.
    """
    logger.info("Starting vertaalapp backend...")

    model_manager = ModelManager()
    app.state.model_manager = model_manager

    language_registry = LanguageRegistry()
    app.state.language_registry = language_registry

    # Start loading STT model in the background (don't block server startup)
    # Translation models are loaded on-demand when user selects a language pair
    logger.info("Beginning STT model loading in background...")
    load_task = asyncio.create_task(model_manager.load_stt_and_installed_languages(language_registry))

    logger.info("Application startup complete - accepting connections")
    yield

    load_task.cancel()
    logger.info("Shutting down vertaalapp backend...")


app = FastAPI(
    title="Vertaalapp",
    description="Real-time spraakvertaling voor de gezondheidszorg",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware — restricted to known local origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health_router)
app.include_router(languages_router)
app.include_router(stt_router)
app.include_router(system_router)
app.include_router(websocket_router)
