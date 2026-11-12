import pytest
from fastapi.testclient import TestClient


def test_post_creates_ticket_with_201(create_ticket):
    ticket = create_ticket(title="Bug affichage", severity="critical", assignee="Alice")

    assert ticket["id"] == 1
    assert ticket["title"] == "Bug affichage"
    assert ticket["status"] == "open"
    assert ticket["severity"] == "critical"
    assert ticket["assignee"] == "Alice"
    assert ticket["comments_count"] == 0


def test_post_empty_assignee_is_normalized_to_none(create_ticket):
    ticket = create_ticket(assignee="")
    assert ticket["assignee"] is None


@pytest.mark.parametrize(
    "invalid_payload",
    [
        {"title": "ab"},  # trop court (min 3)
        {"title": "Valide", "severity": "inconnue"},
        {},
    ],
)
def test_post_validation_returns_422(client: TestClient, invalid_payload: dict):
    response = client.post("/api/tickets", json=invalid_payload)
    assert response.status_code == 422


def test_get_collection_and_filters(client: TestClient, create_ticket):
    t1 = create_ticket(title="Erreur SQL login", severity="critical", assignee="Zakaria")
    create_ticket(title="Bouton décalé sur Safari", severity="low", assignee="Alice")
    client.patch(f"/api/tickets/{t1['id']}", json={"status": "in_progress"})

    # Sans filtre : 2 tickets
    assert len(client.get("/api/tickets").json()) == 2

    # Filtre par statut
    in_progress = client.get("/api/tickets?status=in_progress").json()
    assert [t["title"] for t in in_progress] == ["Erreur SQL login"]

    # Filtre par sévérité
    low = client.get("/api/tickets?severity=low").json()
    assert [t["title"] for t in low] == ["Bouton décalé sur Safari"]

    # Filtre par personne assignée
    by_user = client.get("/api/tickets?assignee=Zakaria").json()
    assert [t["title"] for t in by_user] == ["Erreur SQL login"]

    # Recherche plein texte
    searched = client.get("/api/tickets?search=safari").json()
    assert [t["title"] for t in searched] == ["Bouton décalé sur Safari"]


def test_get_single_ticket_and_404(client: TestClient, create_ticket):
    created = create_ticket(title="API lente")

    res = client.get(f"/api/tickets/{created['id']}")
    assert res.status_code == 200
    assert res.json()["title"] == "API lente"
    assert res.json()["comments"] == []

    assert client.get("/api/tickets/999").status_code == 404


def test_put_replaces_entire_ticket(client: TestClient, create_ticket):
    ticket = create_ticket()

    res = client.put(
        f"/api/tickets/{ticket['id']}",
        json={
            "title": "Titre remplacé via PUT",
            "description": "Nouvelle description complète",
            "status": "resolved",
            "severity": "low",
            "assignee": "Karim",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["title"] == "Titre remplacé via PUT"
    assert body["status"] == "resolved"
    assert body["severity"] == "low"
    assert body["assignee"] == "Karim"


def test_put_on_missing_ticket_returns_404(client: TestClient):
    res = client.put(
        "/api/tickets/999",
        json={
            "title": "Inexistant",
            "description": "",
            "status": "open",
            "severity": "low",
            "assignee": None,
        },
    )
    assert res.status_code == 404


def test_patch_updates_only_provided_fields(client: TestClient, create_ticket):
    ticket = create_ticket(title="Titre initial", severity="high", assignee="Zakaria")

    res = client.patch(f"/api/tickets/{ticket['id']}", json={"status": "resolved"})
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "resolved"
    assert body["title"] == "Titre initial"
    assert body["severity"] == "high"
    assert body["assignee"] == "Zakaria"


def test_delete_ticket_returns_204_and_removes_resource(client: TestClient, create_ticket):
    ticket = create_ticket()

    delete_res = client.delete(f"/api/tickets/{ticket['id']}")
    assert delete_res.status_code == 204
    assert delete_res.content == b""

    assert client.get(f"/api/tickets/{ticket['id']}").status_code == 404
    assert client.delete(f"/api/tickets/{ticket['id']}").status_code == 404


def test_stats_endpoint_counts_statuses_and_critical(client: TestClient, create_ticket):
    t1 = create_ticket(severity="critical")
    t2 = create_ticket(severity="critical")
    create_ticket(severity="low")
    client.patch(f"/api/tickets/{t1['id']}", json={"status": "in_progress"})
    client.patch(f"/api/tickets/{t2['id']}", json={"status": "closed"})

    stats = client.get("/api/tickets/stats").json()
    assert stats == {
        "total": 3,
        "open": 1,
        "in_progress": 1,
        "resolved": 0,
        "closed": 1,
        "critical": 1,  # le ticket critique fermé n'est plus compté dans les critiques actifs
    }
