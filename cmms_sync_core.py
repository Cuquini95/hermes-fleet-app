"""Dependency-free CMMS to PocketBase delivery core."""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from typing import Any


FINAL_STATES = {"closed", "approved", "returned_to_service"}
COLLECTIONS = {
    "asset": "cmms_assets",
    "failure": "cmms_failures",
    "work_order": "cmms_work_orders",
    "meter_reading": "cmms_meter_readings",
}
POCKETBASE_RESERVED_FIELDS = {"id", "collectionId", "collectionName"}


class SyncConflict(RuntimeError):
    pass


class UnsupportedAggregate(ValueError):
    pass


class PocketBaseError(RuntimeError):
    pass


@dataclass
class SyncEventData:
    event_id: str
    event_type: str
    aggregate_type: str
    aggregate_id: str
    payload: dict[str, Any] = field(default_factory=dict)


@dataclass
class PocketBaseClient:
    base_url: str
    token: str

    def _request(self, method: str, path: str, body=None):
        data = json.dumps(body).encode() if body is not None else None
        request = urllib.request.Request(
            f"{self.base_url.rstrip('/')}{path}", data=data, method=method,
            headers={"Authorization": self.token, "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                raw = response.read()
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode(errors="replace")[:600]
            raise PocketBaseError(f"PocketBase {exc.code}: {detail}") from exc
        except urllib.error.URLError as exc:
            raise PocketBaseError(f"PocketBase unavailable: {exc.reason}") from exc

    def find_one(self, collection, field, value):
        escaped = value.replace('"', '\\"')
        query = urllib.parse.urlencode({"filter": f'{field}="{escaped}"', "perPage": 1})
        result = self._request("GET", f"/api/collections/{collection}/records?{query}")
        items = result.get("items", [])
        return items[0] if items else None

    def create(self, collection, body):
        return self._request("POST", f"/api/collections/{collection}/records", body)

    def update(self, collection, record_id, body):
        return self._request("PATCH", f"/api/collections/{collection}/records/{record_id}", body)


class SyncService:
    def __init__(self, pocketbase):
        self.pocketbase = pocketbase

    def deliver(self, event: SyncEventData, idempotency_key: str):
        prior = self.pocketbase.find_one("cmms_sync_receipts", "idempotency_key", idempotency_key)
        if prior:
            if prior.get("status") == "committed":
                return {"success": True, "receipt_id": prior["id"], "duplicate": True}
            if prior.get("status") != "failed":
                raise SyncConflict("Event with this key is already processing")
            receipt = self.pocketbase.update(
                "cmms_sync_receipts",
                prior["id"],
                {"status": "processing", "error": ""},
            )
        else:
            receipt = self.pocketbase.create("cmms_sync_receipts", {
                "idempotency_key": idempotency_key, "event_id": event.event_id,
                "event_type": event.event_type, "aggregate_id": event.aggregate_id,
                "status": "processing",
            })
        try:
            self._apply(event)
            self.pocketbase.update("cmms_sync_receipts", receipt["id"], {"status": "committed"})
        except Exception as exc:
            self.pocketbase.update("cmms_sync_receipts", receipt["id"], {
                "status": "failed", "error": str(exc)[:600],
            })
            raise
        return {"success": True, "receipt_id": receipt["id"], "duplicate": False}

    def _apply(self, event: SyncEventData):
        collection = COLLECTIONS.get(event.aggregate_type)
        if not collection:
            raise UnsupportedAggregate(f"Unsupported aggregate_type: {event.aggregate_type}")
        current = self.pocketbase.find_one(collection, "supabase_id", event.aggregate_id)
        payload = {
            key: value
            for key, value in event.payload.items()
            if key not in POCKETBASE_RESERVED_FIELDS
        }
        incoming = {**payload, "supabase_id": event.aggregate_id, "last_event_id": event.event_id}
        incoming_version = int(incoming.get("version") or 0)
        current_version = int((current or {}).get("version") or 0)
        if current and incoming_version and current_version > incoming_version:
            return
        if event.aggregate_type == "work_order" and current:
            current_status = str(current.get("status") or "")
            incoming_status = str(incoming.get("status") or current_status)
            if current_status in FINAL_STATES and incoming_status not in FINAL_STATES:
                incoming["status"] = current_status
        if current:
            self.pocketbase.update(collection, current["id"], incoming)
        else:
            self.pocketbase.create(collection, incoming)
