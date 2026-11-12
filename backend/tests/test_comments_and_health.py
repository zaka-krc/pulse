from fastapi.testclient import TestClient

from app.bootstrap import seed
from app.database import SessionLocal


def test_liveness_and_readiness(client: TestClient):
    assert client.get("/api/health/live").json() == {"status": "ok"}
    assert client.get("/api/health/ready").json() == {"status": "ready"}
    assert client.get("/api/openapi.json").status_code == 200


def test_demo_seed_populates_tickets_in_order(client: TestClient):
    with SessionLocal() as db:
        seed(db, force=True)
        seed(db, force=True)  # idempotent

    tickets = client.get("/api/tickets").json()
    assert [t["id"] for t in tickets] == [1, 2, 3, 4]
    assert tickets[0]["status"] == "open"
    assert tickets[0]["comments_count"] == 2


def test_add_list_and_delete_comments(client: TestClient, create_ticket):
    ticket = create_ticket()
    tid = ticket["id"]

    # POST /api/tickets/{id}/comments -> 201 Created
    c1 = client.post(
        f"/api/tickets/{tid}/comments",
        json={"author": "Sarah", "body": "Je reproduis le bug sur Chrome."},
    )
    assert c1.status_code == 201
    comment_id = c1.json()["id"]

    # Le compteur comments_count du ticket est mis à jour
    assert client.get(f"/api/tickets/{tid}").json()["comments_count"] == 1

    # GET /api/tickets/{id}/comments -> 200 OK
    comments = client.get(f"/api/tickets/{tid}/comments").json()
    assert len(comments) == 1
    assert comments[0]["author"] == "Sarah"

    # DELETE /api/tickets/{id}/comments/{comment_id} -> 204 No Content
    del_res = client.delete(f"/api/tickets/{tid}/comments/{comment_id}")
    assert del_res.status_code == 204
    assert client.get(f"/api/tickets/{tid}/comments").json() == []


def test_comment_on_missing_ticket_returns_404(client: TestClient):
    res = client.post("/api/tickets/999/comments", json={"author": "A", "body": "B"})
    assert res.status_code == 404


def test_delete_missing_comment_returns_404(client: TestClient, create_ticket):
    ticket = create_ticket()
    assert client.delete(f"/api/tickets/{ticket['id']}/comments/999").status_code == 404
