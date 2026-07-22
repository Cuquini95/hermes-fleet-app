# Hermes release promotion and evidence gate

This runbook is for an authorized release operator. A green local build is a
candidate only; it does not prove that `hermes-fleet-app.vercel.app` serves the
candidate.

## Candidate freeze

Record the exact commit and keep the checkout clean before promotion:

```powershell
git rev-parse HEAD
git status --short
npm.cmd run test:api
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd audit --omit=dev
```

Required Vercel environment names:

- `HERMES_AUTH_USERS_JSON`
- `HERMES_AUTH_SESSION_SECRET` (at least 32 characters)
- `HERMES_UPSTREAM_VPS_TOKEN`
- `HERMES_UPSTREAM_SHEETS_TOKEN` (if Sheets operations are enabled)
- `CMMS_API_BASE` plus either `CMMS_HERMES_SYSTEM_TOKEN` or
  `CMMS_HERMES_INGEST_SECRET`, unless the approved hosted Supabase fallback is
  being used
- `HOSTED_CMMS_SUPABASE_URL` and
  `HOSTED_CMMS_SUPABASE_SERVICE_KEY` plus
  `CMMS_HERMES_FALLBACK_ORGANIZATION_ID` only when the hosted fallback is
  approved

Never place values for these variables in the repository, transcript, or
evidence artifact.

The direct Hermes origins must enforce the same boundary. Both
`hermes-api.service` (public prefix `/hermes-api/`, port 8000) and
`panama-hermes-api.service` (public prefix `/panama-hermes-api/`, port 8001)
run the same checkout and must accept `HERMES_UPSTREAM_VPS_TOKEN` (or the
existing `HERMES_SYNC_TOKEN`) for the Vercel gateway and a valid signed Hermes
session for approved direct clients. Anonymous requests to `/ai/*`,
`/api/ocr/*`, `/api/push/*`, and `/parts` must return 401 before route
validation or side effects on both public prefixes. Protecting only the Vercel
rewrite or only port 8000 is insufficient because both VPS paths are public.

## Route gate after promotion

Capture the deployment ID, commit SHA, aliases, output functions, and deployed
rewrite configuration with `vercel inspect <deployment-or-alias> --format=json`.
The deployed output must include `api/hermes-vps-gate` and the protected AI,
Sheets, intake, parts-import, and CMMS handlers.

Anonymous probes must fail before upstream side effects:

```powershell
$base = 'https://hermes-fleet-app.vercel.app'
Invoke-WebRequest "$base/api/hermes-vps-gate" -Method Get
Invoke-WebRequest "$base/api/hermes-ai/manual_lookup" -Method Post -Body '{}'
Invoke-WebRequest "$base/api/cmms/damage" -Method Post -Body '{}'
Invoke-WebRequest "$base/hermes-api/ai/fault_code_pages?equipo=HM400-3&codigo_falla=E01" -Method Get
Invoke-WebRequest "$base/hermes-api/parts?q=CA20" -Method Get
```

Expected anonymous results are 401 (or 405 for an intentionally unsupported
method), never an upstream success, payload-validation response, or public
data response. The fault-code and parts requests are especially important:
they were public through the old catch-all rewrite.

Repeat the same anonymous probes directly against
`https://5-78-204-80.sslip.io`. The direct-origin results must match the
Vercel-gateway boundary; a 200 from the VPS for a sensitive path is a release
blocker even if the Vercel route returns 401. Repeat the sensitive-path probes
under both `/hermes-api/` and `/panama-hermes-api/`, and capture restart
receipts for both services.

With a disposable authorized session and approved service-token configuration,
capture authenticated checks for OCR, Push, fault-code lookup, parts lookup,
Sheets role boundaries, and the CMMS damage handoff. Verify that each receipt
contains a correlation ID, the actor comes from the verified session, and a
replayed `external_event_id` returns the original hosted work order rather
than creating another one.

The CMMS damage bridge must also return `400` for malformed JSON and `413` for
request bodies larger than 64 KiB before contacting CMMS. These are boundary
checks, not substitutes for the authenticated live handoff proof.

The login handler must return `400` for malformed JSON and `413` for request
bodies larger than 16 KiB before evaluating credentials.

The authenticated intake bridge must return `400` for malformed JSON and
`413` for request bodies larger than 8 MiB before contacting OpsOS.

The authenticated AI diagnose, manual-lookup, and photo-analysis handlers use
the same bounded 8 MiB parser and must return `400` for malformed JSON or
`413` for oversized bodies before provider work.

## Release decision

Promote only when all of the following are attached to the release evidence:

1. Candidate commit and clean-worktree receipt.
2. Vercel deployment ID and alias mapping for that commit.
3. Required environment names confirmed without exposing values.
4. Anonymous and authenticated route results above.
5. Rollback target (previous READY deployment ID).

If any item is missing, classify the result as `CANDIDATE` or `HOLD`; do not
describe the local candidate as production-ready.
