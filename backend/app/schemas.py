from datetime import UTC, datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, PlainSerializer

from app.models import TicketSeverity, TicketStatus


def _ensure_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value


def _serialize_iso_utc(value: datetime) -> str:
    return value.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


UTCDateTime = Annotated[
    datetime,
    AfterValidator(_ensure_utc),
    PlainSerializer(_serialize_iso_utc, return_type=str, when_used="json"),
]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- Commentaires (sous-ressource /api/tickets/{id}/comments) ---------------


class CommentCreate(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "author": "Zakaria",
                    "body": "Le correctif est prêt, je lance les tests unitaires.",
                }
            ]
        }
    )

    author: str = Field(min_length=1, max_length=80)
    body: str = Field(min_length=1, max_length=2000)


class CommentRead(ORMModel):
    id: int
    ticket_id: int
    author: str
    body: str
    created_at: UTCDateTime


# --- Tickets (/api/tickets) -------------------------------------------------


class TicketCreate(BaseModel):
    """Schéma pour POST /api/tickets (création d'une ressource)."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "title": "Erreur 500 lors de l'export CSV",
                    "description": "Le téléchargement échoue quand un filtre de date est actif.",
                    "severity": "high",
                    "assignee": "Zakaria",
                }
            ]
        }
    )

    title: str = Field(min_length=3, max_length=150)
    description: str = Field(default="", max_length=5000)
    severity: TicketSeverity = TicketSeverity.MEDIUM
    assignee: str | None = Field(default=None, max_length=80)


class TicketPut(BaseModel):
    """Schéma pour PUT /api/tickets/{id} (remplacement complet de la ressource)."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "title": "Erreur 500 lors de l'export CSV",
                    "description": "Corrigé en encodant le flux en UTF-8.",
                    "status": "resolved",
                    "severity": "medium",
                    "assignee": "Zakaria",
                }
            ]
        }
    )

    title: str = Field(min_length=3, max_length=150)
    description: str = Field(default="", max_length=5000)
    status: TicketStatus
    severity: TicketSeverity
    assignee: str | None = Field(default=None, max_length=80)


class TicketPatch(BaseModel):
    """Schéma pour PATCH /api/tickets/{id} (mise à jour partielle)."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {"status": "in_progress"},
                {"severity": "critical", "assignee": "Alice"},
            ]
        }
    )

    title: str | None = Field(default=None, min_length=3, max_length=150)
    description: str | None = Field(default=None, max_length=5000)
    status: TicketStatus | None = None
    severity: TicketSeverity | None = None
    assignee: str | None = Field(default=None, max_length=80)


class TicketRead(ORMModel):
    id: int
    title: str
    description: str
    status: TicketStatus
    severity: TicketSeverity
    assignee: str | None
    comments_count: int
    created_at: UTCDateTime
    updated_at: UTCDateTime


class TicketDetail(TicketRead):
    comments: list[CommentRead]


class TicketStats(BaseModel):
    total: int
    open: int
    in_progress: int
    resolved: int
    closed: int
    critical: int
