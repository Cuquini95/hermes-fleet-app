"""FastAPI adapter for the dependency-free CMMS synchronization core."""

import asyncio
import os
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from cmms_sync_core import (
    PocketBaseClient, PocketBaseError, SyncConflict, SyncEventData,
    SyncService, UnsupportedAggregate,
)


class SyncEvent(BaseModel):
    event_id: str = Field(min_length=1)
    event_type: str = Field(min_length=1)
    aggregate_type: str = Field(min_length=1)
    aggregate_id: str = Field(min_length=1)
    payload: dict[str, Any] = Field(default_factory=dict)


router = APIRouter()


def _service():
    token = os.environ.get("POCKETBASE_ADMIN_TOKEN", "")
    if not token:
        raise HTTPException(503, "PocketBase integration is not configured")
    return SyncService(PocketBaseClient(
        os.environ.get("POCKETBASE_URL", "http://127.0.0.1:8090"), token
    ))


@router.post("/cmms/sync")
async def receive_cmms_event(
    event: SyncEvent,
    authorization: str | None = Header(default=None),
    idempotency_key: str | None = Header(default=None),
):
    expected = os.environ.get("HERMES_SYNC_TOKEN", "")
    if not expected or authorization != f"Bearer {expected}":
        raise HTTPException(401, "Unauthorized")
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key header is required")
    data = SyncEventData(**event.model_dump())
    try:
        return await asyncio.to_thread(_service().deliver, data, idempotency_key)
    except SyncConflict as exc:
        raise HTTPException(409, str(exc)) from exc
    except UnsupportedAggregate as exc:
        raise HTTPException(422, str(exc)) from exc
    except PocketBaseError as exc:
        raise HTTPException(502, str(exc)) from exc
