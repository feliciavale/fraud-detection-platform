import pytest
from fastapi.testclient import TestClient

from api.main import app

FRAUD = {"type": "TRANSFER", "amount": 696575.46, "oldbalanceOrg": 696575.46, "oldbalanceDest": 0}
NORMAL = {"type": "CASH_OUT", "amount": 500, "oldbalanceOrg": 90000, "oldbalanceDest": 20000}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:   # runs startup, so the models load
        yield c


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_types_contains_mobile_money(client):
    assert "mobile_money" in client.get("/types").json()


def test_schema_has_fields(client):
    names = [f["name"] for f in client.get("/schema/mobile_money").json()["fields"]]
    assert names == ["type", "amount", "oldbalanceOrg", "oldbalanceDest"]


def test_fraud_is_flagged(client):
    r = client.post("/score/mobile_money", json=FRAUD).json()
    assert r["decision"] == "review"
    assert r["fraud_probability"] > 0.9
    assert r["top_reasons"][0]["feature"] == "drainRatio"


def test_normal_is_approved(client):
    r = client.post("/score/mobile_money", json=NORMAL).json()
    assert r["decision"] == "approve"
    assert r["fraud_probability"] < 0.1


def test_payment_type_skips_model(client):
    r = client.post("/score/mobile_money", json={**NORMAL, "type": "PAYMENT"}).json()
    assert r["fraud_probability"] == 0.0


def test_missing_field_returns_422(client):
    bad = {k: v for k, v in NORMAL.items() if k != "amount"}
    assert client.post("/score/mobile_money", json=bad).status_code == 422


def test_unknown_type_returns_404(client):
    assert client.post("/score/nope", json=NORMAL).status_code == 404