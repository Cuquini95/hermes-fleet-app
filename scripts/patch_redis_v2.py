#!/usr/bin/env python3
"""Patch api_server.py to add Redis caching for sheets/read and ETag + pagination."""

FILEPATH = '/root/.hermes/hermes-agent/gateway/api_server.py'

with open(FILEPATH, 'r') as f:
    content = f.read()

# Only patch sheets_read - Redis helpers and append invalidation already added

OLD_SHEETS_READ = """@app.get('/api/sheets/read')
@limiter.limit("60/minute")
async def sheets_read(request: Request, tab: str, range: str = 'A:Z'):
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
@limiter.limit("60/minute")
async def sheets_read(request: Request, tab: str, range: str = 'A:Z', limit: int = 0, offset: int = 0):
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
    # print first 200 chars around sheets_read
    idx = content.find("async def sheets_read")
    if idx >= 0:
        print("Found at index", idx, "context:")
        print(repr(content[idx-100:idx+300]))

# Also add invalidation to sheets_update Sheets path if missing
OLD_UPDATE_SHEETS = '    return {"success": True, "updated": updated}'
NEW_UPDATE_SHEETS = '    _cache_invalidate_tab(req.tab)\n    return {"success": True, "updated": updated}'

if OLD_UPDATE_SHEETS in content:
    content = content.replace(OLD_UPDATE_SHEETS, NEW_UPDATE_SHEETS)
    print("Added cache invalidation to sheets_update (Sheets path)")
elif '_cache_invalidate_tab' in content and 'updated' in content:
    print("sheets_update Sheets path already has invalidation or has different structure")
else:
    print("WARNING: Could not patch sheets_update Sheets path")

with open(FILEPATH, 'w') as f:
    f.write(content)

print("Done")
