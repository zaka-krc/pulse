import os

os.environ.update(
    {
        "PULSE_DATABASE_URL": "sqlite://",
        "PULSE_SEED_DEMO": "false",
    }
)

from collections.abc import Iterator  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def _reset_database() -> Iterator[None]:
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def create_ticket(client: TestClient):
    def _create(**overrides) -> dict:
        payload = {
            "title": "Crash au clic sur Enregistrer",
            "description": "NullPointerException dans le contrôleur",
            "severity": "high",
            "assignee": "Zakaria",
            **overrides,
        }
        response = client.post("/api/tickets", json=payload)
        assert response.status_code == 201, response.text
        return response.json()

    return _create
