"""Initialisation de la base et données d'exemple au premier lancement."""

import logging
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app.models import Comment, Ticket, TicketSeverity, TicketStatus, utcnow

logger = logging.getLogger(__name__)


def seed(db: Session, *, force: bool = False) -> None:
    if not force and not get_settings().seed_demo:
        return
    if db.scalar(select(Ticket.id).limit(1)) is not None:
        return

    now = utcnow()

    # #1 est le plus récent (created_at le plus proche) : il apparaît en tête de liste avec id=1.
    t1 = Ticket(
        title="Erreur 500 lors de l'export PDF des factures",
        description=(
            "Quand une facture contient le symbole '€' dans les notes client, "
            "l'endpoint POST /export renvoie une erreur 500."
        ),
        status=TicketStatus.OPEN,
        severity=TicketSeverity.CRITICAL,
        assignee="Zakaria",
        created_at=now - timedelta(minutes=25),
        updated_at=now - timedelta(minutes=10),
        comments=[
            Comment(
                author="Sarah",
                body="Reproduit en pré-production avec la facture #2026-041.",
                created_at=now - timedelta(minutes=20),
            ),
            Comment(
                author="Zakaria",
                body="C'est un souci d'encodage Latin-1 dans le générateur PDF, je passe en UTF-8.",
                created_at=now - timedelta(minutes=10),
            ),
        ],
    )
    t2 = Ticket(
        title="Le filtre par statut ne garde pas la sélection au rafraîchissement",
        description=(
            "Les paramètres de requête ?status=... sont réinitialisés "
            "au premier rendu du composant React."
        ),
        status=TicketStatus.IN_PROGRESS,
        severity=TicketSeverity.MEDIUM,
        assignee="Alice",
        created_at=now - timedelta(hours=5),
        updated_at=now - timedelta(hours=1),
        comments=[
            Comment(
                author="Alice",
                body="Je synchronise l'état du filtre avec l'URL.",
                created_at=now - timedelta(hours=1),
            )
        ],
    )
    t3 = Ticket(
        title="Timeout sur la recherche produit au-delà de 50 000 lignes",
        description="Il manque un index SQL sur la colonne SKU de la table products.",
        status=TicketStatus.RESOLVED,
        severity=TicketSeverity.HIGH,
        assignee="Karim",
        created_at=now - timedelta(hours=18),
        updated_at=now - timedelta(hours=4),
    )
    t4 = Ticket(
        title="Corriger l'alignement du bouton de déconnexion sur mobile",
        description="Sur un écran de 375px de large, le bouton déborde de la barre de navigation.",
        status=TicketStatus.CLOSED,
        severity=TicketSeverity.LOW,
        assignee=None,
        created_at=now - timedelta(days=2),
        updated_at=now - timedelta(days=1),
    )

    db.add_all([t1, t2, t3, t4])
    db.commit()
    logger.info("Base initialisée avec 4 tickets d'exemple")


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        try:
            seed(db)
        except IntegrityError:
            db.rollback()
