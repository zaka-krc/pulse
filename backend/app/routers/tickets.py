from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.deps import DbSession
from app.models import Comment, Ticket, TicketSeverity, TicketStatus, utcnow
from app.schemas import (
    CommentCreate,
    CommentRead,
    TicketCreate,
    TicketDetail,
    TicketPatch,
    TicketPut,
    TicketRead,
    TicketStats,
)

router = APIRouter(prefix="/tickets", tags=["tickets"])


def _get_ticket_or_404(db: DbSession, ticket_id: int) -> Ticket:
    stmt = select(Ticket).options(selectinload(Ticket.comments)).where(Ticket.id == ticket_id)
    ticket = db.scalar(stmt)
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket introuvable")
    return ticket


@router.get("", response_model=list[TicketRead])
def list_tickets(
    db: DbSession,
    status_filter: Annotated[TicketStatus | None, Query(alias="status")] = None,
    severity: TicketSeverity | None = None,
    assignee: str | None = None,
    search: str | None = None,
) -> list[Ticket]:
    """GET /api/tickets — Liste la collection de tickets avec filtres optionnels."""
    query = select(Ticket).options(selectinload(Ticket.comments))
    if status_filter is not None:
        query = query.where(Ticket.status == status_filter)
    if severity is not None:
        query = query.where(Ticket.severity == severity)
    if assignee is not None:
        query = query.where(Ticket.assignee == assignee)
    if search:
        pattern = f"%{search.strip()}%"
        query = query.where(or_(Ticket.title.ilike(pattern), Ticket.description.ilike(pattern)))
    return list(db.scalars(query.order_by(Ticket.created_at.desc(), Ticket.id.desc())))


@router.get("/stats", response_model=TicketStats)
def get_ticket_stats(db: DbSession) -> TicketStats:
    """GET /api/tickets/stats — Compteurs agrégés par statut et sévérité."""
    by_status = dict(
        db.execute(select(Ticket.status, func.count(Ticket.id)).group_by(Ticket.status)).all()
    )
    critical = (
        db.scalar(
            select(func.count(Ticket.id)).where(
                Ticket.severity == TicketSeverity.CRITICAL,
                Ticket.status != TicketStatus.CLOSED,
            )
        )
        or 0
    )
    total = sum(by_status.values())
    return TicketStats(
        total=total,
        open=by_status.get(TicketStatus.OPEN, 0),
        in_progress=by_status.get(TicketStatus.IN_PROGRESS, 0),
        resolved=by_status.get(TicketStatus.RESOLVED, 0),
        closed=by_status.get(TicketStatus.CLOSED, 0),
        critical=critical,
    )


@router.get("/{ticket_id}", response_model=TicketDetail)
def get_ticket(ticket_id: int, db: DbSession) -> Ticket:
    """GET /api/tickets/{id} — Récupère un ticket et ses commentaires (ou 404)."""
    return _get_ticket_or_404(db, ticket_id)


@router.post("", response_model=TicketRead, status_code=status.HTTP_201_CREATED)
def create_ticket(payload: TicketCreate, db: DbSession) -> Ticket:
    """POST /api/tickets — Crée un nouveau ticket (retourne 201 Created)."""
    data = payload.model_dump()
    if data.get("assignee") == "":
        data["assignee"] = None
    ticket = Ticket(**data)
    db.add(ticket)
    db.commit()
    return _get_ticket_or_404(db, ticket.id)


@router.put("/{ticket_id}", response_model=TicketRead)
def replace_ticket(ticket_id: int, payload: TicketPut, db: DbSession) -> Ticket:
    """PUT /api/tickets/{id} — Remplacement complet d'un ticket existant."""
    ticket = _get_ticket_or_404(db, ticket_id)
    for field, value in payload.model_dump().items():
        setattr(ticket, field, None if field == "assignee" and value == "" else value)
    ticket.updated_at = utcnow()
    db.commit()
    return ticket


@router.patch("/{ticket_id}", response_model=TicketRead)
def update_ticket_partial(ticket_id: int, payload: TicketPatch, db: DbSession) -> Ticket:
    """PATCH /api/tickets/{id} — Mise à jour partielle (ex: changer uniquement le statut)."""
    ticket = _get_ticket_or_404(db, ticket_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(ticket, field, None if field == "assignee" and value == "" else value)
    ticket.updated_at = utcnow()
    db.commit()
    return ticket


@router.delete("/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ticket(ticket_id: int, db: DbSession) -> Response:
    """DELETE /api/tickets/{id} — Supprime un ticket et ses commentaires (204 No Content)."""
    ticket = _get_ticket_or_404(db, ticket_id)
    db.delete(ticket)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Sous-ressource REST : /api/tickets/{ticket_id}/comments ----------------


@router.get("/{ticket_id}/comments", response_model=list[CommentRead])
def list_comments(ticket_id: int, db: DbSession) -> list[Comment]:
    """GET /api/tickets/{id}/comments — Liste les commentaires d'un ticket."""
    ticket = _get_ticket_or_404(db, ticket_id)
    return ticket.comments


@router.post(
    "/{ticket_id}/comments",
    response_model=CommentRead,
    status_code=status.HTTP_201_CREATED,
)
def add_comment(ticket_id: int, payload: CommentCreate, db: DbSession) -> Comment:
    """POST /api/tickets/{id}/comments — Ajoute un commentaire au ticket (201 Created)."""
    ticket = _get_ticket_or_404(db, ticket_id)
    comment = Comment(ticket=ticket, **payload.model_dump())
    ticket.updated_at = utcnow()
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@router.delete(
    "/{ticket_id}/comments/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_comment(ticket_id: int, comment_id: int, db: DbSession) -> Response:
    """DELETE /api/tickets/{id}/comments/{comment_id} — Supprime un commentaire (204 No Content)."""
    _get_ticket_or_404(db, ticket_id)
    comment = db.scalar(
        select(Comment).where(Comment.id == comment_id, Comment.ticket_id == ticket_id)
    )
    if comment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commentaire introuvable")
    db.delete(comment)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
