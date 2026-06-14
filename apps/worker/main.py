"""
Bitecodes AI Worker — FastAPI skeleton.
Endpoints: /health, /embed, /ingest, /graph/run
Populated in Phase 3 (P3-09).
"""
from fastapi import FastAPI

app = FastAPI(title="Bitecodes Worker", version="0.1.0")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/ready")
def ready() -> dict:
    return {"status": "ok"}
