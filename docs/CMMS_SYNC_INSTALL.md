# Install the CMMS receiver in Hermes Gateway

The implementation lives in `cmms_sync.py` and exposes `POST /cmms/sync`.

## Gateway registration

```python
from cmms_sync import router as cmms_sync_router

app.include_router(cmms_sync_router)
```

## Runtime configuration

Configure these values in the VPS secret environment, never in Git:

```text
HERMES_SYNC_TOKEN
POCKETBASE_URL=http://127.0.0.1:8090
POCKETBASE_ADMIN_TOKEN
```

Create the five collections described in the CMMS sync contract before enabling
the worker. The gateway persists a `processing` receipt before applying an event,
then changes it to `committed` only after the aggregate write succeeds.

## Verification

```bash
python -m unittest discover -s tests -p 'test_cmms_sync.py'
```

Then send the same controlled event twice. Both responses must contain the same
`receipt_id`, and PocketBase must contain only one aggregate record.
