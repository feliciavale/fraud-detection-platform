"""Saved analyses (history), analyst outcomes and the numbers behind Overview and Analytics.

Every query filters on the logged-in user's id, so a user can only see and change their own analyses.
"""
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session as DbSession

from api.auth import current_user
from api.db import Analysis, User, get_db, utcnow
from detectors.registry import REGISTRY

router = APIRouter(tags=["analyses"])

Outcome = Literal["fraud", "not_fraud"]


def detector_or_404(fraud_type: str):
    if fraud_type not in REGISTRY:
        raise HTTPException(404, f"Unknown fraud type '{fraud_type}'")
    return REGISTRY[fraud_type]


def as_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)   # SQLite returns naive datetimes


def to_dict(a: Analysis) -> dict:
    return {
        "id": a.id,
        "fraud_type": a.fraud_type,
        "input": a.input,
        "risk_score": a.risk_score,
        "decision": a.decision,
        "top_reasons": a.top_reasons,
        "created_at": as_utc(a.created_at).isoformat(),
        "outcome": a.outcome,
        "outcome_at": as_utc(a.outcome_at).isoformat() if a.outcome_at else None,
    }


def own(db: DbSession, user: User, analysis_id: int) -> Analysis:
    a = db.get(Analysis, analysis_id)
    if a is None or a.user_id != user.id:      # someone else's analysis looks exactly like a missing one
        raise HTTPException(404, "Analysis not found.")
    return a


@router.post("/analyses/{fraud_type}", status_code=201)
def create_analysis(fraud_type: str, record: dict, user: User = Depends(current_user), db: DbSession = Depends(get_db)):
    detector = detector_or_404(fraud_type)
    try:
        result = detector.predict(record)
    except ValueError as e:
        raise HTTPException(422, str(e))
    allowed = {f["name"] for f in detector.schema()["fields"]}
    a = Analysis(
        user_id=user.id,
        fraud_type=fraud_type,
        input={k: v for k, v in record.items() if k in allowed},
        risk_score=result["risk_score"],
        decision=result["decision"],
        top_reasons=result["top_reasons"],
    )
    db.add(a)
    db.commit()
    return to_dict(a)


@router.get("/analyses")
def list_analyses(
    fraud_type: str | None = None,
    decision: Literal["review", "approve"] | None = None,
    outcome: Literal["pending", "fraud", "not_fraud"] | None = None,
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(current_user),
    db: DbSession = Depends(get_db),
):
    q = select(Analysis).where(Analysis.user_id == user.id)
    if fraud_type:
        q = q.where(Analysis.fraud_type == fraud_type)
    if decision:
        q = q.where(Analysis.decision == decision)
    if outcome == "pending":
        q = q.where(Analysis.outcome.is_(None))
    elif outcome:
        q = q.where(Analysis.outcome == outcome)
    total = db.scalar(select(func.count()).select_from(q.subquery()))
    rows = db.scalars(q.order_by(Analysis.created_at.desc(), Analysis.id.desc()).limit(limit).offset(offset)).all()
    return {"total": total, "items": [to_dict(a) for a in rows]}


class OutcomeBody(BaseModel):
    outcome: Outcome | None   # null clears the outcome


@router.patch("/analyses/{analysis_id}")
def set_outcome(analysis_id: int, body: OutcomeBody, user: User = Depends(current_user), db: DbSession = Depends(get_db)):
    a = own(db, user, analysis_id)
    a.outcome = body.outcome
    a.outcome_at = utcnow() if body.outcome else None
    db.commit()
    return to_dict(a)


@router.delete("/analyses/{analysis_id}")
def delete_analysis(analysis_id: int, user: User = Depends(current_user), db: DbSession = Depends(get_db)):
    db.delete(own(db, user, analysis_id))
    db.commit()
    return {"ok": True}


@router.get("/stats")
def stats(
    fraud_type: str | None = None,
    days: int = Query(30, ge=1, le=365),
    tz_offset_minutes: int = Query(0, ge=-840, le=840),   # the browser's offset from UTC, so days match the user's calendar
    user: User = Depends(current_user),
    db: DbSession = Depends(get_db),
):
    """Counts for Overview and Analytics. Scores are only summarised for one detector at a time,
    because scores from different detectors mean different things."""
    if fraud_type:
        detector_or_404(fraud_type)
    q = select(Analysis.fraud_type, Analysis.decision, Analysis.outcome, Analysis.risk_score, Analysis.created_at).where(
        Analysis.user_id == user.id)
    if fraud_type:
        q = q.where(Analysis.fraud_type == fraud_type)
    rows = db.execute(q).all()

    offset = timedelta(minutes=tz_offset_minutes)
    today = (utcnow() + offset).date()
    first_day = today - timedelta(days=days - 1)
    daily = {first_day + timedelta(days=i): {"review": 0, "approve": 0} for i in range(days)}
    week_ago = utcnow() - timedelta(days=7)

    by_type: dict[str, dict] = {}
    outcomes = {"flagged_fraud": 0, "flagged_not_fraud": 0, "approved_fraud": 0, "approved_not_fraud": 0}
    histogram = [{"from": i / 10, "to": (i + 1) / 10, "review": 0, "approve": 0} for i in range(10)]
    review = approve = pending = last_7 = 0

    for ft, decision, outcome, score, created in rows:
        created = as_utc(created)
        t = by_type.setdefault(ft, {"fraud_type": ft, "total": 0, "review": 0, "approve": 0})
        t["total"] += 1
        t[decision] += 1
        if decision == "review":
            review += 1
            if outcome is None:
                pending += 1
        else:
            approve += 1
        if outcome:
            key = ("flagged_" if decision == "review" else "approved_") + outcome
            outcomes[key] += 1
        if created >= week_ago:
            last_7 += 1
        local_day = (created + offset).date()
        if local_day in daily:
            daily[local_day][decision] += 1
        if fraud_type:
            histogram[min(int(score * 10), 9)][decision] += 1

    return {
        "fraud_type": fraud_type,
        "total": len(rows),
        "last_7_days": last_7,
        "review": review,
        "approve": approve,
        "awaiting_outcome": pending,
        "outcomes": outcomes,
        "by_detector": sorted(by_type.values(), key=lambda t: t["fraud_type"]),
        "daily": [{"date": d.isoformat(), **v} for d, v in daily.items()],
        "histogram": histogram if fraud_type else None,
    }
