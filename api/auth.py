"""Accounts and login sessions.

- Passwords are hashed with scrypt (Python standard library) and a random salt per user.
- Logging in creates a random token. The browser keeps it in an HttpOnly cookie
  (JavaScript cannot read it); the database keeps only its SHA-256 hash.
- current_user() is the dependency every private endpoint uses. The user id always comes
  from the session, never from anything the browser sends.
"""
import base64
import hashlib
import hmac
import os
import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.orm import Session as DbSession

from api.db import Session, User, get_db, utcnow

COOKIE = "sentinel_session"
SESSION_DAYS = 7
SECURE_COOKIE = os.getenv("COOKIE_SECURE", "false").lower() == "true"   # set to true when served over HTTPS
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_PASSWORD = 8

router = APIRouter(prefix="/auth", tags=["auth"])


# ---------- password hashing ----------
N, R, P = 2**14, 8, 1


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=N, r=R, p=P, dklen=64)
    b64 = lambda b: base64.b64encode(b).decode()
    return f"scrypt${N}${R}${P}${b64(salt)}${b64(digest)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, n, r, p, salt, digest = stored.split("$")
        expected = base64.b64decode(digest)
        actual = hashlib.scrypt(password.encode(), salt=base64.b64decode(salt), n=int(n), r=int(r), p=int(p),
                                dklen=len(expected))
        return hmac.compare_digest(actual, expected)
    except ValueError:
        return False


# A real hash of a random password, used so that a login for an unknown email takes as long as one for a known email.
DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# ---------- sessions ----------
def start_session(db: DbSession, user: User, response: Response) -> None:
    token = secrets.token_urlsafe(32)
    db.add(Session(token_hash=token_hash(token), user_id=user.id, expires_at=utcnow() + timedelta(days=SESSION_DAYS)))
    db.commit()
    response.set_cookie(COOKIE, token, max_age=SESSION_DAYS * 86400, httponly=True, samesite="lax",
                        secure=SECURE_COOKIE, path="/")


def current_user(sentinel_session: str | None = Cookie(default=None), db: DbSession = Depends(get_db)) -> User:
    if not sentinel_session:
        raise HTTPException(401, "Not logged in.")
    row = db.scalar(select(Session).where(Session.token_hash == token_hash(sentinel_session)))
    if row is None:
        raise HTTPException(401, "Not logged in.")
    expires = row.expires_at if row.expires_at.tzinfo else row.expires_at.replace(tzinfo=timezone.utc)  # SQLite drops tz
    if expires < utcnow():
        db.delete(row)
        db.commit()
        raise HTTPException(401, "Your session has expired. Please log in again.")
    user = db.get(User, row.user_id)
    if user is None:
        raise HTTPException(401, "Not logged in.")
    return user


# ---------- endpoints ----------
class Credentials(BaseModel):
    email: str
    password: str


def public(user: User) -> dict:
    return {"id": user.id, "email": user.email}


@router.post("/signup", status_code=201)
def signup(body: Credentials, response: Response, db: DbSession = Depends(get_db)):
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email) or len(email) > 254:
        raise HTTPException(422, "Enter a valid email address.")
    if len(body.password) < MIN_PASSWORD:
        raise HTTPException(422, f"Password must be at least {MIN_PASSWORD} characters.")
    if len(body.password) > 200:
        raise HTTPException(422, "Password is too long.")
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, "An account with this email already exists. Log in instead.")
    user = User(email=email, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    start_session(db, user, response)
    return public(user)


@router.post("/login")
def login(body: Credentials, response: Response, db: DbSession = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.strip().lower()))
    if user is None:
        verify_password(body.password, DUMMY_HASH)
        raise HTTPException(401, "Email or password is incorrect.")
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Email or password is incorrect.")
    start_session(db, user, response)
    return public(user)


@router.post("/logout")
def logout(response: Response, sentinel_session: str | None = Cookie(default=None), db: DbSession = Depends(get_db)):
    if sentinel_session:
        db.execute(delete(Session).where(Session.token_hash == token_hash(sentinel_session)))
        db.commit()
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return public(user)
