"""
Supabase mirror helper for Hermes Fleet VPS gateway.

After every PocketBase write, call the appropriate mirror function here.
Supabase Realtime will then broadcast the change to all connected browser clients.

Requires:
    pip install supabase

VPS .env variables required:
    SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
    SUPABASE_SERVICE_KEY=eyJh...   (service_role key, NOT anon key)

Usage in gateway.py:
    from supabase_mirror import mirror_workorder, mirror_averia

    # After a PocketBase OT write:
    await mirror_workorder(ot_data)   # fire-and-forget

    # After a PocketBase Averías write:
    await mirror_averia(averia_data)  # fire-and-forget
"""

import asyncio
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

SUPABASE_URL         = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

def _get_client():
    """Return a Supabase client, or None if not configured."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return None
    try:
        from supabase import create_client
        return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    except Exception as exc:
        logger.warning("Supabase client init failed: %s", exc)
        return None

# ── Mirror functions (fire-and-forget) ───────────────────────────────────────

def _mirror_sync(table: str, data: dict[str, Any]) -> None:
    """Upsert a row into a Supabase table. Called from a background thread."""
    client = _get_client()
    if not client:
        return
    try:
        client.table(table).upsert(data).execute()
        logger.debug("Supabase mirror: upserted to %s", table)
    except Exception as exc:
        logger.warning("Supabase mirror failed (%s): %s", table, exc)

async def _mirror_async(table: str, data: dict[str, Any]) -> None:
    """Non-blocking async wrapper — runs the sync upsert in a thread pool."""
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _mirror_sync, table, data)

# ── Public API ────────────────────────────────────────────────────────────────

async def mirror_workorder(ot: dict[str, Any]) -> None:
    """
    Mirror a work-order upsert to Supabase → triggers Realtime on the frontend.

    Expected keys (snake_case):
        ot_id, fecha, unidad, tipo_averia, descripcion, severidad,
        prioridad, mecanico_asignado, estado, foto_url, averia_ref,
        partes_necesarias, costo_estimado, fecha_cierre, observaciones, progreso
    """
    asyncio.ensure_future(_mirror_async("workorders", ot))

async def mirror_averia(averia: dict[str, Any]) -> None:
    """Mirror an avería upsert to Supabase → triggers Realtime on the frontend."""
    asyncio.ensure_future(_mirror_async("averias", averia))

async def mirror_combustible(row: dict[str, Any]) -> None:
    """Mirror a fuel entry to Supabase."""
    asyncio.ensure_future(_mirror_async("combustible", row))
