"""Database setup and tables.

DATABASE_URL decides which database is used:
  - not set:  sqlite:///./sentinel.db  (a single file in the project root, no installation)
  - PostgreSQL, for example the connection string from Neon: postgresql://user:password@host/dbname?sslmode=require
The code below works with both.
"""
import os
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker


def normalise_url(url: str) -> str:
    """Hosts such as Neon give URLs starting with postgres:// or postgresql://.
    Point them at the psycopg (version 3) driver that requirements-ci.txt installs."""
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


DATABASE_URL = normalise_url(os.getenv("DATABASE_URL", "sqlite:///./sentinel.db"))

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # pool_pre_ping: a hosted database may close idle connections (Neon sleeps after a few minutes),
    # so each connection is checked before use and replaced if it was closed.
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=300)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Session(Base):
    """A login session. Only a hash of the cookie token is stored, never the token itself."""
    __tablename__ = "sessions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Analysis(Base):
    """One scored transaction, owned by the user who submitted it."""
    __tablename__ = "analyses"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    fraud_type: Mapped[str] = mapped_column(String(50), index=True)
    input: Mapped[dict] = mapped_column(JSON)
    risk_score: Mapped[float] = mapped_column(Float)
    decision: Mapped[str] = mapped_column(String(10))               # "review" or "approve"
    top_reasons: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    outcome: Mapped[str | None] = mapped_column(String(20), nullable=True)   # None, "fraud" or "not_fraud"
    outcome_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


def init_db() -> None:
    Base.metadata.create_all(engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
