import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api.main import app
from detectors.ecommerce.features import build_row

META = json.load(open(Path(__file__).resolve().parents[1] / "models" / "ecommerce_meta.json"))
MIN = {"TransactionAmt": 59.0, "ProductCD": "W"}
FULL = {**MIN, "card4": "visa", "card6": "credit", "P_emaildomain": "gmail.com", "R_emaildomain": "gmail.com",
        "DeviceType": "mobile", "addr1": 315, "addr2": 87}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_feature_encoding_matches_training_mappings():
    row = build_row({"TransactionAmt": 59.0, "ProductCD": "W", "card4": "visa"}, META)
    assert row["ProductCD"].iloc[0] == 4        # sorted C, H, R, S, W
    assert row["card4"].iloc[0] == 3            # sorted american express, discover, mastercard, visa
    assert row["card6"].iloc[0] == -1           # missing -> -1
    assert row["amt_cents"].iloc[0] == 0
    assert list(row.columns) == META["features"]


def test_unseen_category_maps_to_missing():
    row = build_row({**MIN, "P_emaildomain": "not-a-real-domain.example"}, META)
    assert row["P_emaildomain"].iloc[0] == -1


def test_types_lists_both_modules(client):
    assert {"mobile_money", "ecommerce"} <= set(client.get("/types").json())


def test_schema_marks_required_fields(client):
    fields = {f["name"]: f for f in client.get("/schema/ecommerce").json()["fields"]}
    assert fields["TransactionAmt"]["required"] and fields["ProductCD"]["required"]
    assert fields["card4"]["kind"] == "select" and "visa" in fields["card4"]["options"]


def test_score_response_shape(client):
    r = client.post("/score/ecommerce", json=FULL).json()
    assert 0.0 <= r["risk_score"] <= 1.0
    assert r["decision"] in {"review", "approve"}
    assert len(r["top_reasons"]) == 3


def test_minimal_record_works(client):
    assert client.post("/score/ecommerce", json=MIN).status_code == 200


def test_scoring_is_deterministic(client):
    a = client.post("/score/ecommerce", json=FULL).json()
    b = client.post("/score/ecommerce", json=FULL).json()
    assert a == b


def test_missing_required_field_returns_422(client):
    assert client.post("/score/ecommerce", json={"ProductCD": "W"}).status_code == 422


def test_unknown_product_returns_422(client):
    assert client.post("/score/ecommerce", json={**MIN, "ProductCD": "Z"}).status_code == 422


def test_non_numeric_amount_returns_422(client):
    assert client.post("/score/ecommerce", json={**MIN, "TransactionAmt": "abc"}).status_code == 422