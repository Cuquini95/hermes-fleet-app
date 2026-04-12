# Hermes Fleet App — $500/Month Improvement Roadmap

**Generated:** 2026-04-12  
**Stack:** React 19 + TypeScript + Vite + Tailwind · Vercel · VPS 5.78.204.80 · Google Sheets gateway  
**Budget:** $500/month (services + APIs — not dev time)

---

## Key Discoveries (Pre-Roadmap)

Before spending a dollar, the research phase found that significant groundwork already exists:

| Already in codebase | Implication |
|---|---|
| `@supabase/supabase-js` installed, `src/lib/supabase.ts` has placeholders | Supabase activation = config change, not a migration sprint |
| VPS gateway supports `PRIMARY_DB=pocketbase` env switch | Real DB is one env var flip away — PocketBase already runs on VPS |
| `src/lib/offline-queue.ts` exists | Offline sync groundwork is laid |
| OCR (Gemini Vision) already on VPS | AI vision pipeline exists, needs expansion not construction |
| `src/components/chat/HermesChat.tsx` exists | NL query can extend existing chat, not new infrastructure |

---

## Highest-ROI Change Per Dollar

> **Flip `PRIMARY_DB=pocketbase` on the VPS. Cost: $0.**
>
> PocketBase is already running on the VPS. Reads drop from 2–5s (Google Sheets round-trip)
> to <100ms (local SQLite). This single env var change is the biggest performance leap
> available and costs nothing.

---

## Budget Allocation Overview

| Tier | Monthly Cost | Timeline | Theme |
|---|---|---|---|
| Tier 1 | $0–$30 | Week 1–2 | Activate what's already there |
| Tier 2 | $50–$120 | Month 1–2 | Real-time + push |
| Tier 3 | $150–$350 | Month 2–4 | AI features |
| **Total** | **$200–$500** | — | — |

Remaining budget from Tier 1–2 savings rolls into Tier 3 AI API spend.

---

## Tier 1 — Quick Wins ($0–$30/month, Ship in 2 Weeks)

### T1-1 · Activate PocketBase as Primary DB

| | |
|---|---|
| **Problem** | DataManager reads take 2–5s; Google Sheets rate-limits at 60 req/min; no query filtering |
| **Solution** | Set `PRIMARY_DB=pocketbase` on VPS — gateway already routes to it |
| **Service** | PocketBase (self-hosted on existing VPS) |
| **Monthly cost** | **$0** (already running on VPS) |
| **Complexity** | LOW |
| **Files touched** | VPS env config only — no frontend changes required |
| **Verification** | `curl http://5.78.204.80/hermes-api/api/sheets/read?tab=Combustible` → response < 200ms |

**Steps:**
1. SSH into VPS: `ssh user@5.78.204.80`
2. In the gateway `.env`: set `PRIMARY_DB=pocketbase`
3. Restart gateway: `pm2 restart hermes-api`
4. Verify read latency drops in browser DevTools Network tab

**Rollback:** Set `PRIMARY_DB=sheets` and restart — Sheets remain the source of truth.

---

### T1-2 · Frontend Read Cache (stale-while-revalidate)

| | |
|---|---|
| **Problem** | Every tab switch in DataManager fires a fresh `readRange()` call — 2–5s freeze even after T1-1 |
| **Solution** | Add a 30s TTL localStorage cache in `sheets-api.ts readRange()` |
| **Service** | None (browser localStorage) |
| **Monthly cost** | **$0** |
| **Complexity** | LOW |
| **Files touched** | `src/lib/sheets-api.ts` |

**Implementation:**
```typescript
// In readRange() — wrap with TTL cache
const CACHE_TTL_MS = 30_000;
const cacheKey = `hermes_cache_${tab}`;
const cached = localStorage.getItem(cacheKey);
if (cached) {
  const { ts, data } = JSON.parse(cached);
  if (Date.now() - ts < CACHE_TTL_MS) return data as string[][];
}
// ... fetch, then store:
localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: result }));
```

**Verification:** Open DataManager, switch tabs — second visit to same tab loads instantly.

---

### T1-3 · VPS Response Compression

| | |
|---|---|
| **Problem** | Sheet responses contain large JSON arrays, transferred uncompressed |
| **Solution** | Enable gzip on VPS nginx / gateway |
| **Service** | None |
| **Monthly cost** | **$0** |
| **Complexity** | LOW |
| **Files touched** | VPS nginx.conf only |

```nginx
gzip on;
gzip_types application/json;
gzip_min_length 1024;
```

**Verification:** DevTools → Response Headers → `Content-Encoding: gzip`

---

### T1-4 · Activate Supabase Storage for Photos

| | |
|---|---|
| **Problem** | Photos currently upload to VPS local disk — no CDN, no redundancy |
| **Solution** | Switch photo uploads to Supabase Storage (500MB free tier) |
| **Service** | Supabase Free tier |
| **Monthly cost** | **$0** (free tier sufficient for fleet photo volume) |
| **Complexity** | LOW — `src/lib/supabase.ts` + env vars only |
| **Files touched** | `src/lib/supabase.ts` + Vercel env vars only — `photo-upload.ts` already calls `supabase.storage` internally |

**Steps:**
1. Create Supabase project at supabase.com (**US East / Virginia region** — ~40ms to Mexico City vs ~150ms from São Paulo)
2. Create `fleet-photos` storage bucket (public)
3. Add to Vercel env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
4. No code changes needed — `photo-upload.ts` already wired to Supabase storage

**Verification:** Upload DVIR photo → URL contains `supabase.co/storage` instead of VPS IP.

---

### Tier 1 Summary

| Change | Cost | Impact | Effort |
|---|---|---|---|
| T1-1 PocketBase activation | $0 | ⭐⭐⭐⭐⭐ Reads <100ms | 30 min |
| T1-2 Frontend read cache | $0 | ⭐⭐⭐⭐ Tab switching instant | 1 hour |
| T1-3 VPS gzip | $0 | ⭐⭐ Smaller payloads | 15 min |
| T1-4 Supabase Storage | $0 | ⭐⭐⭐ Photos on CDN | 2 hours |
| **Tier 1 total** | **$0/month** | All read latency eliminated | ~4 hours |

---

## Tier 2 — Core Infrastructure ($7–$37/month, Month 1–2)

### T2-1 · Web Push Notifications

| | |
|---|---|
| **Problem** | Fleet manager doesn't know when an OT is opened, DVIR fails, or breakdown is reported — must check app manually |
| **Solution** | Web Push API (VAPID) — free standard, works on Android Chrome, iOS Safari 16.4+ |
| **Service** | VAPID (self-hosted on VPS, free) |
| **Monthly cost** | **$0** |
| **Complexity** | MEDIUM |
| **Files touched** | New `src/lib/push-notifications.ts`, `src/stores/auth-store.ts`, VPS gateway |

**Trigger events to push:**
- New OT created → push to fleet manager + workshop
- DVIR result = Deficiente → push to supervisor + fleet manager
- Avería priority Alta/Crítica → push to fleet manager
- PM due in ≤ 7 days → daily digest push

**Implementation sketch:**
1. VPS: add `/api/push/subscribe` and `/api/push/send` endpoints using `web-push` npm package
2. Frontend: request notification permission on login, POST subscription to VPS
3. Store subscription per user in PocketBase `push_subscriptions` collection
4. Hook existing `FallaPage.tsx`, `DVIRPage.tsx`, `WorkOrderDetailPage.tsx` saves to trigger push

---

### T2-2 · Supabase Realtime for Live Updates

| | |
|---|---|
| **Problem** | After registering a flete/falla/OT, other users see stale data until manual refresh |
| **Solution** | Supabase Realtime subscriptions — SDK already installed |
| **Service** | Supabase Pro ($25/month) or Free tier (500 concurrent connections) |
| **Monthly cost** | **$0–$25/month** (Free tier likely sufficient for <20 simultaneous users) |
| **Complexity** | MEDIUM |
| **Files touched** | `src/lib/supabase.ts`, `src/stores/workorder-store.ts`, `src/stores/equipment-store.ts`, `src/hooks/useDashboardData.ts` |

**Architecture:**
- Mirror PocketBase writes to Supabase in background (VPS gateway already handles multi-write)
- Subscribe in `useDashboardData.ts` to `workorders` table changes
- On INSERT/UPDATE event → invalidate affected Zustand store slice → UI refreshes automatically

**Verification:** Open app on two devices → register OT on device 1 → device 2 updates within 2s.

---

### T2-3 · WhatsApp Business API for Notifications

| | |
|---|---|
| **Problem** | Telegram reaches the fleet manager but not truck operators (not all use Telegram) |
| **Solution** | WhatsApp Business Cloud API — operators already use WhatsApp |
| **Service** | Meta WhatsApp Business Cloud API (free up to 1,000 conversations/month; then ~$0.05/conversation) |
| **Monthly cost** | **$0–$30/month** at fleet scale |
| **Complexity** | MEDIUM |
| **Files touched** | VPS gateway only (new `whatsapp.py` module alongside existing Telegram module) |

**Templates to create:**
- `ot_creada`: "🔧 OT {{ot_id}} abierta para {{unidad}} — {{descripcion}}"
- `dvir_falla`: "⚠️ {{unidad}} reprobó inspección — {{fallas_count}} fallas. OT: {{ot_id}}"
- `pm_vencimiento`: "📅 PM de {{unidad}} vence en {{dias}} días — {{km_restantes}} km"

---

### T2-4 · Upgrade VPS ($20–$40/month)

| | |
|---|---|
| **Problem** | Current VPS handles OCR (Gemini calls), Sheets gateway, PocketBase, photo storage — CPU/RAM contention |
| **Solution** | Upgrade from 1 vCPU / 2GB to 2 vCPU / 4GB |
| **Service** | Hetzner CX22 (2 vCPU, 4GB RAM, Helsinki) = €5.99/month ≈ $7/month, OR DigitalOcean Basic 2vCPU/4GB = $24/month |
| **Monthly cost** | **$7–$24/month** |
| **Complexity** | LOW |
| **Files touched** | None (infra only) |

**Recommendation:** Hetzner CX22 at $7/month is the best value. Hetzner has excellent latency to Mexico (~140ms) vs DigitalOcean NY ($24/month, ~70ms). For async operations, Hetzner wins on cost.

---

### Tier 2 Summary

| Change | Cost | Impact | Effort |
|---|---|---|---|
| T2-1 Web Push | $0 | ⭐⭐⭐⭐⭐ No more missed events | 1 day |
| T2-2 Supabase Realtime | $0–$25 | ⭐⭐⭐⭐ Live multi-user sync | 1 day |
| T2-3 WhatsApp API | $0–$30 | ⭐⭐⭐⭐⭐ Operators get notified | 1 day |
| T2-4 VPS upgrade | $7–$24 | ⭐⭐⭐ More headroom | 1 hour |
| **Tier 2 total** | **$7–$79/month** | Fleet fully connected | ~4 days |

---

## Tier 3 — AI-Powered Features ($150–$350/month, Month 2–4)

### T3-1 · Predictive Maintenance Intelligence

| | |
|---|---|
| **Problem** | Breakdowns happen reactively — no early warning from patterns in the data |
| **Solution** | Nightly Claude API job: analyze Averías + Horómetros + DVIR history per unit, output risk scores and recommended interventions |
| **Service** | Anthropic Claude API (claude-haiku-4-5 for batch analysis) |
| **Monthly cost** | **~$3–$8/month** (Haiku at $0.80/M input tokens; 30 units × 30 days × ~2k tokens/run = ~1.8M tokens = ~$1.50 input + similar output) |
| **Complexity** | MEDIUM |
| **Files touched** | New VPS `predictive_maintenance.py` cron job; new `src/pages/PMSchedulePage.tsx` section (flag at-risk units); `src/components/dashboard/FleetGrid.tsx` (risk badge) |

**Output per unit:**
```json
{
  "unit_id": "CV103",
  "risk_score": 8.2,
  "risk_level": "HIGH",
  "top_pattern": "Transmission failures every 450hr — due at 520hr",
  "recommended_action": "Schedule transmission inspection before 510hr",
  "confidence": 0.84
}
```

**Display:** Red/amber/green risk dot on `FleetGrid.tsx` unit cards, detail in `PMSchedulePage.tsx`.

---

### T3-2 · Claude Vision DVIR Analysis

| | |
|---|---|
| **Problem** | DVIR photos are uploaded but never analyzed — defects visible in photos aren't flagged |
| **Solution** | After photo upload, send to Claude Vision: "Analyze this fleet vehicle inspection photo. List any visible defects, damage, or maintenance concerns." |
| **Service** | Anthropic Claude API (claude-sonnet-4-5 for vision accuracy) |
| **Monthly cost** | **~$30–$80/month** (Sonnet at $3/M input tokens; ~50 inspections/day × 3 photos × ~1k tokens) |
| **Complexity** | MEDIUM |
| **Files touched** | `src/pages/DVIRPage.tsx`, VPS new endpoint `POST /api/dvir/analyze-photo` |

**UX:** After capture, show "Analizando foto..." → 3s → display findings inline:
```
📸 Análisis IA: Neumático delantero derecho muestra desgaste irregular en 
el hombro exterior. Posible problema de alineación o presión incorrecta.
```

Auto-flag findings as additional DVIR checklist items if severity = HIGH.

---

### T3-3 · Natural Language Data Queries

| | |
|---|---|
| **Problem** | DataManager requires knowing which tab to open and manually scanning rows |
| **Solution** | Extend existing `HermesChat.tsx` to accept data questions; VPS translates to PocketBase queries via Claude |
| **Service** | Claude API (Haiku for query parsing) |
| **Monthly cost** | **~$10–$20/month** (low volume NL queries) |
| **Complexity** | LOW — chat infrastructure already exists |
| **Files touched** | `src/components/chat/HermesChat.tsx`, `src/pages/ChatPage.tsx`, VPS `hermes_agent.py` (extend existing) |

**Example queries:**
- "¿Cuánto diesel cargó CV103 en abril?" → returns total liters + cost summary
- "¿Qué unidades tienen OTs abiertas?" → list with OT IDs and ages
- "Muéstrame los fletes de esta semana para Manzanillo" → filtered table

**Implementation:** Route data questions to new VPS endpoint that: (1) parses intent with Claude Haiku, (2) queries PocketBase, (3) formats response as table or summary.

---

### T3-4 · Automated Weekly Fleet Health Report

| | |
|---|---|
| **Problem** | Fleet manager has no consolidated weekly view — must manually review each module |
| **Solution** | Every Monday 8am: VPS cron pulls week's data → Claude generates executive summary → sends via WhatsApp + Telegram |
| **Service** | Claude API + existing WhatsApp/Telegram channels |
| **Monthly cost** | **~$5/month** (4 reports/month × ~20k tokens each = ~0.02¢/report at Haiku pricing) |
| **Complexity** | LOW (VPS cron + existing notification channels) |
| **Files touched** | New VPS `weekly_report.py` cron; no frontend changes |

**Report sections:**
1. Fleet availability % (units operational vs down)
2. Top 3 problematic units (most OTs, highest cost)
3. Fuel efficiency: actual vs benchmark per unit
4. OTs status: open / resolved / overdue this week
5. Upcoming PMs in next 14 days
6. Cost summary: gastos by category

---

### T3-5 · Smart Parts Ordering Assistant

| | |
|---|---|
| **Problem** | When opening an OT for a breakdown, the mechanic has to manually look up parts in the catalog |
| **Solution** | On OT creation with a fault code, auto-suggest common parts needed based on historical repairs for that fault type |
| **Service** | Claude API (Haiku, small context per query) |
| **Monthly cost** | **~$10/month** |
| **Complexity** | LOW — `PedidosPage.tsx` already has cart; OT creation already uses `fault-codes.ts` |
| **Files touched** | `src/pages/WorkOrderDetailPage.tsx`, `src/lib/hermes-api.ts`, `src/data/fault-codes.ts` |

**UX:** On OT detail page, show "Partes sugeridas basadas en reparaciones similares" → mechanic adds to cart in one tap.

---

### Tier 3 Summary

| Change | Cost | Impact | Effort |
|---|---|---|---|
| T3-1 Predictive Maintenance | $3–$8 | ⭐⭐⭐⭐⭐ Prevent breakdowns | 3 days |
| T3-2 DVIR Vision Analysis | $30–$80 | ⭐⭐⭐⭐ Catch defects automatically | 2 days |
| T3-3 NL Data Queries | $10–$20 | ⭐⭐⭐⭐ Manager self-serves data | 1 day |
| T3-4 Weekly Health Report | $5 | ⭐⭐⭐⭐⭐ Zero-effort oversight | 1 day |
| T3-5 Smart Parts Suggestions | $10 | ⭐⭐⭐ Faster OT resolution | 1 day |
| **Tier 3 total** | **$56–$123/month** | AI layer on top of fleet ops | ~8 days |

---

## Full Budget Breakdown

```
TIER 1 (activate existing)
  PocketBase (VPS already running)     $0
  Frontend cache                       $0
  VPS gzip                             $0
  Supabase Storage (free tier)         $0
  ─────────────────────────────────────────
  Tier 1 subtotal                      $0/month

TIER 2 (connectivity)
  VPS upgrade (Hetzner CX22)           $7
  Supabase Free tier realtime          $0
  WhatsApp Business API (<1k conv)     $0–$30
  Web Push (VAPID, self-hosted)        $0
  ─────────────────────────────────────────
  Tier 2 subtotal                      $7–$37/month

TIER 3 (AI features)
  Claude API — Haiku (maintenance,
    NL queries, weekly report,
    parts suggestions)                 $26–$43
  Claude API — Sonnet (DVIR vision)   $30–$80
  ─────────────────────────────────────────
  Tier 3 subtotal                     $56–$123/month

TOTAL                                 $63–$160/month

BUDGET REMAINING from $500:          $340–$437/month
  → Buffer for traffic spikes, Supabase Pro
    upgrade if >500 concurrent users,
    additional Claude API capacity,
    or Cloudinary for photo CDN ($0 on
    free tier for <25GB storage)
```

---

## Migration Sequence (Dependency Order)

```
WEEK 1 ──────────────────────────────────────────────────────────
  Day 1:  T1-1  Flip PRIMARY_DB=pocketbase (zero risk, instant rollback)
  Day 1:  T1-3  Enable VPS gzip
  Day 2:  T1-2  Add frontend read cache to sheets-api.ts
  Day 3:  T1-4  Supabase Storage for photos (create project, update upload)

  ↓ GATE: DataManager reads < 200ms. Photos load from CDN. ✓

WEEK 2 ──────────────────────────────────────────────────────────
  Day 4:  T2-4  Upgrade VPS (more headroom before adding AI load)
  Day 5:  T2-1  Web Push notifications (subscribe → VPS → PocketBase)
  Day 6:  T2-3  WhatsApp Business API registration + OT/DVIR hooks

  ↓ GATE: Push notification delivered on test OT creation. ✓

MONTH 2 ─────────────────────────────────────────────────────────
  Week 3: T2-2  Supabase Realtime (depends on Supabase project from T1-4)
  Week 4: T3-4  Weekly health report cron (lowest risk AI feature, validates Claude API billing)
  Week 5: T3-3  NL queries in existing chat (extends, doesn't replace)

  ↓ GATE: Two consecutive weekly reports delivered correctly. ✓

MONTH 3 ─────────────────────────────────────────────────────────
  Week 6: T3-5  Smart parts suggestions (low risk, uses existing OT + catalog)
  Week 7: T3-2  DVIR photo vision analysis
  Week 8: T3-1  Predictive maintenance (needs 4+ weeks of PocketBase data)

  ↓ GATE: Predictive score matches 1+ known historical breakdown pattern. ✓
```

**Critical ordering rules:**
- T1-1 (PocketBase) MUST come before T3-1 (Predictive Maintenance needs structured data, not flat rows)
- T1-4 (Supabase project) MUST come before T2-2 (Realtime uses same project)
- T2-4 (VPS upgrade) SHOULD come before T3-1/T3-2 (AI calls add CPU load)
- T3-4 (weekly report) SHOULD come before T3-1 (validates Claude API integration cheaply)

---

## What NOT to Do with This Budget

| Temptation | Why to skip |
|---|---|
| Native iOS/Android app | PWA works on all platforms; native would cost $200+/month in dev tools + Apple dev account + Play store + maintenance |
| Full rewrite from Google Sheets to Supabase tables | PocketBase is already on VPS and working — Supabase migration adds complexity for no performance gain over T1-1 |
| GPT-4o vs Claude API | Claude Haiku outperforms GPT-3.5 at same price; Claude Sonnet matches GPT-4o at lower cost for structured fleet data |
| Separate analytics SaaS (Mixpanel, Amplitude) | Recharts + PocketBase queries cover all fleet analytics needs; no $50–200/month SaaS needed |
| Multiple VPS providers | Consolidate on one VPS; adding DigitalOcean + Hetzner creates ops overhead |
| Cloudinary Pro | Supabase Storage free tier covers fleet photo volume; upgrade only if >25GB/month |
