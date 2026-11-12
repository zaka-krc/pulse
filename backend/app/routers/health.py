from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.deps import DbSession

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live")
def liveness() -> dict[str, str]:
    """Kubernetes liveness probe: the process is up and serving requests."""
    return {"status": "ok"}


@router.get("/ready", responses={503: {"description": "Database unavailable"}})
def readiness(db: DbSession):
    """Kubernetes readiness probe: the app can reach its database."""
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "unavailable", "detail": type(exc).__name__},
        )
    return {"status": "ready"}
