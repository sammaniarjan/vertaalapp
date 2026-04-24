"""Health check API endpoint."""

from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/health")
async def health_check(request: Request) -> dict:
    """Return the health status of the application and its models.

    Returns:
        Dictionary with overall status, model statuses, and STT engine name.
    """
    model_manager = request.app.state.model_manager

    return {
        "status": "ok",
        "models": model_manager.get_status(),
        "stt_engine": model_manager.engine_name,
    }
