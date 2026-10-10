from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from detectors.registry import REGISTRY, load_all


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_all()
    yield


app = FastAPI(title="Fraud Platform", lifespan=lifespan)


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
    try:
        return get_detector(fraud_type).predict(record)
    except ValueError as e:
        raise HTTPException(422, str(e))