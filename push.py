"""
Web Push (VAPID) endpoints for Hermes Fleet.

Requires:
    pip install pywebpush

VPS .env variables required:
    VAPID_PRIVATE_KEY=zm9dor7yt2bOXt85_xFB8elzHO-M-qLx901NDIlklC8
    VAPID_PUBLIC_KEY=BNB5YECCdWno9OwJUuoeqzqTmW8h__z-DE38MaqrNTqMbduWcSyTa1z3TmLAiBL2nhYh2U2y2Yt_w1iPxhUqeqE
    VAPID_EMAIL=mailto:admin@gtp.com.mx

Add to gateway.py:
    from push import router as push_router
    app.include_router(push_router, prefix="/api/push")
"""

import json
import os
import logging
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_PUBLIC_KEY  = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_EMAIL       = os.environ.get("VAPID_EMAIL", "mailto:admin@gtp.com.mx")

# Subscriptions stored as JSON on disk (PocketBase integration is optional)
SUBS_FILE = Path("/root/.hermes/push_subscriptions.json")

router = APIRouter()

# ── Helpers ───────────────────────────────────────────────────────────────────

def _load_subs() -> list[dict]:
    if not SUBS_FILE.exists():
        return []
    try:
        return json.loads(SUBS_FILE.read_text())
    except Exception:
        return []

def _save_subs(subs: list[dict]) -> None:
    SUBS_FILE.parent.mkdir(parents=True, exist_ok=True)
    SUBS_FILE.write_text(json.dumps(subs, indent=2))

def _send_one(subscription: dict, payload: dict) -> bool:
    """Send a single push notification. Returns True on success."""
    try:
        from pywebpush import webpush, WebPushException
        webpush(
            subscription_info=subscription["subscription"],
            data=json.dumps(payload),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_EMAIL},
        )
        return True
    except Exception as exc:
        # 410 Gone = subscription expired, should be removed
        gone = "410" in str(exc)
        if gone:
            logger.info("Push subscription expired, will clean up: %s", exc)
        else:
            logger.warning("Push send failed: %s", exc)
        return not gone  # return False only for expired subs

# ── Push event payloads ───────────────────────────────────────────────────────

EVENT_PAYLOADS: dict[str, Any] = {
    "nueva_falla": lambda d: {
        "title": f"⚠️ Falla reportada — {d.get('unidad', '')}",
        "body": f"{d.get('tipo', '')} · Prioridad {d.get('prioridad', '').upper()} · {d.get('ot_id', '')}",
        "url": "/workorders",
        "tag": "falla",
    },
    "dvir_deficiente": lambda d: {
        "title": f"🚨 DVIR Reprobado — {d.get('unidad', '')}",
        "body": f"Score {d.get('score', '')} · OT {d.get('ot_id', '')} generada",
        "url": "/workorders",
        "tag": "dvir",
    },
    "nueva_ot": lambda d: {
        "title": f"🔧 Nueva OT — {d.get('unidad', '')}",
        "body": d.get("descripcion", ""),
        "url": "/workorders",
        "tag": "ot",
    },
}

# Roles that receive each event
EVENT_ROLES: dict[str, list[str]] = {
    "nueva_falla":    ["gerencia", "jefe_taller", "supervisor"],
    "dvir_deficiente": ["gerencia", "supervisor"],
    "nueva_ot":       ["gerencia", "jefe_taller"],
}

# ── Endpoints ─────────────────────────────────────────────────────────────────

class SubscribeRequest(BaseModel):
    subscription: dict    # PushSubscription JSON from browser
    role: str

class SendRequest(BaseModel):
    event: str
    data: dict[str, str] = {}

@router.post("/subscribe")
async def subscribe(req: SubscribeRequest) -> dict:
    """Store a push subscription for a device + role."""
    subs = _load_subs()

    # Deduplicate by endpoint URL
    endpoint = req.subscription.get("endpoint", "")
    subs = [s for s in subs if s.get("subscription", {}).get("endpoint") != endpoint]
    subs.append({"subscription": req.subscription, "role": req.role})
    _save_subs(subs)

    logger.info("Push subscription stored: role=%s endpoint=...%s", req.role, endpoint[-20:])
    return {"success": True}

@router.post("/send")
async def send_push(req: SendRequest) -> dict:
    """Fire a push notification event to all matching role subscriptions."""
    if not VAPID_PRIVATE_KEY:
        return {"success": False, "reason": "VAPID not configured"}

    build_payload = EVENT_PAYLOADS.get(req.event)
    if not build_payload:
        raise HTTPException(400, f"Unknown event: {req.event}")

    target_roles = set(EVENT_ROLES.get(req.event, []))
    payload = build_payload(req.data)

    subs = _load_subs()
    active_subs = []
    sent = 0

    for sub in subs:
        if sub.get("role") not in target_roles:
            active_subs.append(sub)
            continue
        ok = _send_one(sub, payload)
        if ok:
            sent += 1
            active_subs.append(sub)
        # If not ok, sub was expired — drop it from the list

    _save_subs(active_subs)
    logger.info("Push event=%s sent=%d/%d", req.event, sent, len(subs))
    return {"success": True, "sent": sent}
