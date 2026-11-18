from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from api import analyses, auth
from api.db import init_db
from detectors.registry import REGISTRY, load_all


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_all()
    init_db()
    yield


app = FastAPI(title="Fraud Platform", lifespan=lifespan)

# The dashboard normally reaches the API through its own /api proxy (same origin, so no CORS needed).
# This stays for direct calls from the dev server.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(analyses.router)


def get_detector(fraud_type: str):
    if fraud_type not in REGISTRY:
        raise HTTPException(404, f"Unknown fraud type '{fraud_type}'")
    return REGISTRY[fraud_type]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/types")
def types():
    return list(REGISTRY)


@app.get("/schema/{fraud_type}")
def schema(fraud_type: str):
    return get_detector(fraud_type).schema()


@app.post("/score/{fraud_type}")
def score(fraud_type: str, record: dict):
    """Stateless scoring: nothing is saved. Logged-in users save results through POST /analyses/{fraud_type}."""
    try:
        return get_detector(fraud_type).predict(record)
    except ValueError as e:
        raise HTTPException(422, str(e))
