#!/usr/bin/env python3
"""Patch api_server.py to add Redis caching for sheets/read and ETag headers."""

FILEPATH = '/root/.hermes/hermes-agent/gateway/api_server.py'

with open(FILEPATH, 'r') as f:
    content = f.read()

REDIS_IMPORT = """
# Redis cache (optional, gracefully degrades if unavailable)
import redis as _redis_lib
import hashlib as _hashlib

_redis_client = None
_REDIS_TTL = 60  # seconds

def _get_redis():
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        r = _redis_lib.Redis(host="127.0.0.1", port=6379, db=0, socket_connect_timeout=1, socket_timeout=1)
        r.ping()
        _redis_client = r
        logger.info("[REDIS] Connected to Redis cache")
    except Exception as exc:
        logger.warning("[REDIS] Unavailable, running without cache: %s", exc)
        _redis_client = None
    return _redis_client

def _cache_get(key):
    r = _get_redis()
    if r is None:
        return None
    try:
        return r.get(key)
    except Exception:
        return None

def _cache_set(key, val, ttl=_REDIS_TTL):
    r = _get_redis()
    if r is None:
        return
    try:
        r.setex(key, ttl, val)
    except Exception:
        pass

def _cache_invalidate_tab(tab):
    r = _get_redis()
    if r is None:
        return
    try:
        pattern = "sheets:read:" + tab + ":*"
        for k in r.scan_iter(pattern, count=100):
            r.delete(k)
        logger.debug("[REDIS] Invalidated cache for tab=%s", tab)
    except Exception as exc:
        logger.debug("[REDIS] Invalidation failed for tab=%s: %s", tab, exc)

"""

if 'import redis' not in content:
    content = content.replace(
        'logger = logging.getLogger("api_server")',
        'logger = logging.getLogger("api_server")' + REDIS_IMPORT
    )
    print("Added Redis helpers")
else:
    print("Redis already imported, skipping")

OLD_SHEETS_READ = """@app.get('/api/sheets/read')
async def sheets_read(tab: str, range: str = 'A:Z'):
    if PRIMARY_DB == "pocketbase":
        collection = get_collection(tab)
        if collection:
            try:
                pb = get_pb_client()
                records = await pb.list(collection, sort="created", per_page=5000)
                rows = [record_to_values(r) for r in records]
                if rows:  # PB has data
                    return {'data': rows, 'count': len(rows)}
                logger.info(f'[READ] PB empty for {tab}, falling back to Sheets')
            except Exception as exc:
                logger.warning(f'[READ] PB error for {tab}: {exc} - falling back to Sheets')
    try:
        gc = _get_gc()
        sh = gc.open_by_key(SHEET_ID)
        ws = sh.worksheet(tab)
        data = ws.get_all_values()
        return {'data': data, 'count': len(data)}
    except Exception as exc:
        logger.error(f"Internal error on sheets_read: {exc}", exc_info=True)
        raise HTTPException(500, "Internal server error")"""

NEW_SHEETS_READ = """@app.get('/api/sheets/read')
async def sheets_read(tab: str, range: str = 'A:Z', limit: int = 0, offset: int = 0):
    from fastapi.responses import JSONResponse
    cache_key = "sheets:read:" + tab + ":" + range
    # Redis cache hit
    cached = _cache_get(cache_key)
    if cached is not None:
        try:
            payload = json.loads(cached)
            etag = '"' + _hashlib.md5(cached).hexdigest() + '"'
            data = payload.get("data", [])
            if limit > 0:
                page = data[offset:offset + limit]
                return JSONResponse(
                    content={"data": page, "count": len(data), "total": len(data), "limit": limit, "offset": offset},
                    headers={"ETag": etag, "Cache-Control": "public, max-age=30", "X-Cache": "HIT"},
                )
            return JSONResponse(
                content={"data": data, "count": len(data)},
                headers={"ETag": etag, "Cache-Control": "public, max-age=30", "X-Cache": "HIT"},
            )
        except Exception:
            pass  # fall through on decode error

    if PRIMARY_DB == "pocketbase":
        collection = get_collection(tab)
        if collection:
            try:
                pb = get_pb_client()
                records = await pb.list(collection, sort="created", per_page=5000)
                rows = [record_to_values(r) for r in records]
                if rows:
                    payload = {"data": rows, "count": len(rows)}
                    payload_json = json.dumps(payload)
                    _cache_set(cache_key, payload_json)
                    etag = '"' + _hashlib.md5(payload_json.encode()).hexdigest() + '"'
                    if limit > 0:
                        page = rows[offset:offset + limit]
                        return JSONResponse(
                            content={"data": page, "count": len(rows), "total": len(rows), "limit": limit, "offset": offset},
                            headers={"ETag": etag, "Cache-Control": "public, max-age=30", "X-Cache": "MISS"},
                        )
                    return JSONResponse(
                        content=payload,
                        headers={"ETag": etag, "Cache-Control": "public, max-age=30", "X-Cache": "MISS"},
                    )
                logger.info('[READ] PB empty for %s, falling back to Sheets', tab)
            except Exception as exc:
                logger.warning('[READ] PB error for %s: %s - falling back to Sheets', tab, exc)
    try:
        gc = _get_gc()
        sh = gc.open_by_key(SHEET_ID)
        ws = sh.worksheet(tab)
        data = ws.get_all_values()
        payload = {"data": data, "count": len(data)}
        payload_json = json.dumps(payload)
        _cache_set(cache_key, payload_json)
        etag = '"' + _hashlib.md5(payload_json.encode()).hexdigest() + '"'
        if limit > 0:
            page = data[offset:offset + limit]
            return JSONResponse(
                content={"data": page, "count": len(data), "total": len(data), "limit": limit, "offset": offset},
                headers={"ETag": etag, "Cache-Control": "public, max-age=30", "X-Cache": "MISS"},
            )
        return JSONResponse(
            content=payload,
            headers={"ETag": etag, "Cache-Control": "public, max-age=30", "X-Cache": "MISS"},
        )
    except Exception as exc:
        logger.error("Internal error on sheets_read: %s", exc, exc_info=True)
        raise HTTPException(500, "Internal server error")"""

if OLD_SHEETS_READ in content:
    content = content.replace(OLD_SHEETS_READ, NEW_SHEETS_READ)
    print("Patched sheets_read with Redis + ETag + pagination")
else:
    print("ERROR: Could not find sheets_read to patch")

# Add cache invalidation to sheets_append
OLD_NOTIFY_APPEND = "    _notify_tab(req.tab, req.values)\n    return {'success': True, 'tab': req.tab}"
NEW_NOTIFY_APPEND = "    _notify_tab(req.tab, req.values)\n    _cache_invalidate_tab(req.tab)\n    return {'success': True, 'tab': req.tab}"

if OLD_NOTIFY_APPEND in content:
    content = content.replace(OLD_NOTIFY_APPEND, NEW_NOTIFY_APPEND, 1)
    print("Added cache invalidation to sheets_append")
else:
    print("WARNING: Could not patch sheets_append")

# Add cache invalidation to sheets_update PB path
OLD_UPDATE_PB = '        asyncio.ensure_future(_mirror_supabase_update(req))\n        return {"success": True, "tab": req.tab}'
NEW_UPDATE_PB = '        asyncio.ensure_future(_mirror_supabase_update(req))\n        _cache_invalidate_tab(req.tab)\n        return {"success": True, "tab": req.tab}'

if OLD_UPDATE_PB in content:
    content = content.replace(OLD_UPDATE_PB, NEW_UPDATE_PB)
    print("Added cache invalidation to sheets_update (PB path)")
else:
    print("WARNING: Could not patch sheets_update PB path")

# Add cache invalidation to sheets_update Sheets path
OLD_UPDATE_SHEETS = '    return {"success": True, "updated": updated}'
NEW_UPDATE_SHEETS = '    _cache_invalidate_tab(req.tab)\n    return {"success": True, "updated": updated}'

if OLD_UPDATE_SHEETS in content:
    content = content.replace(OLD_UPDATE_SHEETS, NEW_UPDATE_SHEETS)
    print("Added cache invalidation to sheets_update (Sheets path)")
else:
    print("WARNING: Could not patch sheets_update Sheets path")

with open(FILEPATH, 'w') as f:
    f.write(content)

print("Done")
