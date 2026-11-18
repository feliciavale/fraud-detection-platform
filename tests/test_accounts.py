import pytest
from fastapi.testclient import TestClient

from api.main import app

FRAUD = {"type": "TRANSFER", "amount": 696575.46, "oldbalanceOrg": 696575.46, "oldbalanceDest": 0}
NORMAL = {"type": "CASH_OUT", "amount": 500, "oldbalanceOrg": 90000, "oldbalanceDest": 20000}


def new_client(email, password="correct-horse-1"):
    c = TestClient(app)
    c.__enter__()                      # runs startup: models load, tables are created
    r = c.post("/auth/signup", json={"email": email, "password": password})
    assert r.status_code == 201, r.text
    return c


@pytest.fixture(scope="module")
def alice():
    c = new_client("alice@example.com")
    yield c
    c.__exit__(None, None, None)


@pytest.fixture(scope="module")
def bob():
    c = new_client("bob@example.com")
    yield c
    c.__exit__(None, None, None)


def test_private_endpoints_need_login():
    with TestClient(app) as c:
        assert c.get("/auth/me").status_code == 401
        assert c.get("/analyses").status_code == 401
        assert c.get("/stats").status_code == 401
        assert c.post("/analyses/mobile_money", json=FRAUD).status_code == 401


def test_cookie_is_httponly(alice):
    r = alice.post("/auth/login", json={"email": "ALICE@example.com ", "password": "correct-horse-1"})
    assert r.status_code == 200
    assert "httponly" in r.headers["set-cookie"].lower()
    assert alice.get("/auth/me").json()["email"] == "alice@example.com"


def test_wrong_password_and_duplicate_signup():
    with TestClient(app) as c:
        assert c.post("/auth/login", json={"email": "alice@example.com", "password": "nope-nope-nope"}).status_code == 401
        assert c.post("/auth/login", json={"email": "nobody@example.com", "password": "nope-nope-nope"}).status_code == 401
        assert c.post("/auth/signup", json={"email": "alice@example.com", "password": "another-pass"}).status_code == 409
        assert c.post("/auth/signup", json={"email": "not-an-email", "password": "long-enough"}).status_code == 422
        assert c.post("/auth/signup", json={"email": "short@example.com", "password": "short"}).status_code == 422


def test_password_is_not_stored_in_plain_text():
    from api.db import SessionLocal, User
    with SessionLocal() as db:
        u = db.query(User).filter_by(email="alice@example.com").one()
        assert "correct-horse-1" not in u.password_hash and u.password_hash.startswith("scrypt$")


def test_analysis_is_saved_and_listed(alice):
    r = alice.post("/analyses/mobile_money", json={**FRAUD, "junk": "dropped"})
    assert r.status_code == 201
    a = r.json()
    assert a["decision"] == "review" and a["outcome"] is None
    assert "junk" not in a["input"]
    alice.post("/analyses/mobile_money", json=NORMAL)
    items = alice.get("/analyses").json()
    assert items["total"] == 2 and items["items"][0]["decision"] == "approve"   # newest first


def test_bad_input_is_rejected_and_not_saved(alice):
    before = alice.get("/analyses").json()["total"]
    assert alice.post("/analyses/mobile_money", json={"type": "TRANSFER"}).status_code == 422
    assert alice.post("/analyses/unknown", json=FRAUD).status_code == 404
    assert alice.get("/analyses").json()["total"] == before


def test_users_cannot_see_or_change_each_others_analyses(alice, bob):
    alice_id = alice.get("/analyses").json()["items"][0]["id"]
    assert bob.get("/analyses").json()["total"] == 0
    assert bob.patch(f"/analyses/{alice_id}", json={"outcome": "fraud"}).status_code == 404
    assert bob.delete(f"/analyses/{alice_id}").status_code == 404
    assert bob.get("/stats").json()["total"] == 0


def test_outcome_and_stats(alice):
    items = alice.get("/analyses", params={"decision": "review"}).json()["items"]
    r = alice.patch(f"/analyses/{items[0]['id']}", json={"outcome": "fraud"})
    assert r.json()["outcome"] == "fraud" and r.json()["outcome_at"]
    assert alice.patch(f"/analyses/{items[0]['id']}", json={"outcome": "maybe"}).status_code == 422
    s = alice.get("/stats", params={"fraud_type": "mobile_money", "tz_offset_minutes": 420}).json()
    assert s["total"] == 2 and s["review"] == 1 and s["approve"] == 1
    assert s["outcomes"]["flagged_fraud"] == 1 and s["awaiting_outcome"] == 0
    assert sum(b["review"] + b["approve"] for b in s["histogram"]) == 2
    assert sum(d["review"] + d["approve"] for d in s["daily"]) == 2
    assert alice.get("/stats").json()["histogram"] is None          # no mixed-detector score summaries
    assert alice.get("/analyses", params={"outcome": "pending"}).json()["total"] == 1


def test_logout_ends_session(alice):
    assert alice.post("/auth/logout").status_code == 200
    assert alice.get("/auth/me").status_code == 401
