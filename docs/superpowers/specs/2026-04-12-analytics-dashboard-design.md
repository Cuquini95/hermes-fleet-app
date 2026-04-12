# Analytics Dashboard & Printable Reports
**Date:** 2026-04-12  
**Status:** Approved  
**Scope:** Gestor de Datos page — visual analytics modal + PDF export

---

## 1. Overview

Add a floating **📊 Analítica** button to the Gestor de Datos toolbar (next to "Exportar CSV"). Clicking it opens a full-screen overlay modal showing cross-tab analytics for the fleet: KPI totals, per-unit charts, a summary table, and a one-click PDF export.

Data is pre-fetched in a Zustand store when the Datos page loads — the modal opens instantly every time with no loading delay.

---

## 2. Architecture

### 2.1 New Files

```
src/
  stores/
    analyticsStore.ts          # Zustand store — fetches & aggregates all 4 collections
  components/analytics/
    AnalyticsModal.tsx          # Full overlay modal — layout shell
    KpiCards.tsx                # 4 KPI cards (Gastos, Combustible, Fletes, Averías)
    GastosPorUnidadChart.tsx    # Recharts BarChart — Gastos per unit
    CombustibleTrendChart.tsx   # Recharts LineChart — Fuel over time (weekly)
    UnitSummaryTable.tsx        # Cross-tab per-unit summary table
    analyticsUtils.ts           # Data aggregation helpers (pure functions)
    reportGenerator.ts          # jsPDF + jspdf-autotable PDF builder
```

### 2.2 Modified Files

- `src/pages/DataManagerPage.tsx` — add `<AnalyticsButton />` to toolbar + mount `<AnalyticsModal />` at page root
- `.gitignore` — add `.superpowers/` entry

### 2.3 No New Dependencies

All libraries already installed:
- `recharts ^3.8.1` — charts
- `jspdf ^4.2.1` + `jspdf-autotable ^5.0.7` — PDF
- `zustand` — state store

---

## 3. Zustand Analytics Store (`analyticsStore.ts`)

```ts
interface AnalyticsState {
  gastos: Row[]
  combustible: Row[]
  fletes: Row[]
  averias: Row[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  lastFetched: Date | null
  period: 'week' | 'month' | 'year'
  unitFilter: string  // 'all' | specific unit like 'CV103'
  fetch: () => Promise<void>
  setPeriod: (p: 'week' | 'month' | 'year') => void
  setUnitFilter: (u: string) => void
}
```

- `fetch()` fires 4 parallel API calls (`readSheet('Gastos')`, `readSheet('Combustible')`, `readSheet('Fletes')`, `readSheet('Averias')`) using the existing `readSheet` helper from `sheets-api.ts`
- Called once when `DataManagerPage` mounts (via `useEffect`)
- Subsequent modal opens use cached data — a manual refresh button re-calls `fetch()`
- `period` and `unitFilter` are UI state that drive filtering in `analyticsUtils.ts`

---

## 4. Modal Layout

The modal is a fixed full-screen overlay (`position: fixed, inset: 0`) with a dark backdrop. The content panel is centered and scrollable.

**Header bar:**
- Title "📊 Analítica de Flota"
- Time filter pills: Semana / Mes / Año (controls `period` in store)
- Unit dropdown: "Todas las unidades" + one option per unique unit found in data
- 🖨️ PDF button
- Refresh icon (re-triggers `fetch()`)
- ✕ close button

**Body (scrollable):**
1. KPI cards row — 4 cards, one per category
2. Charts row — 2 charts side-by-side (Gastos bar chart + Combustible line chart)
3. Per-unit summary table — rows = units, columns = Gastos / Combustible / Fletes / Averías / Total

---

## 5. Data Aggregation (`analyticsUtils.ts`)

All aggregation is pure functions — no side effects, easy to test.

**Period filtering:** Each collection has a `Fecha` column (format `DD/MM/YYYY`). Rows are filtered to the active period window (last 7 days / last 30 days / last 365 days from today).

**Unit filtering:** When a specific unit is selected, only rows where the `Unidad` column matches are included.

**KPI derivation per collection:**
- **Gastos**: Sum of `Monto` column → total spend
- **Combustible**: Sum of `Litros` column → total liters
- **Fletes**: Count of rows → total trips; also sum `Tonelaje` and `KM Total`
- **Averías**: Count of rows → event count

**Per-unit aggregation:** Group each collection by `Unidad`, compute the KPI for each group, merge into a single per-unit record for the summary table.

**Trend data for line chart:** Group Combustible rows by ISO week, sum liters per week → `[{ week: 'S1', litros: 2100 }, ...]`

Column indices for each collection are derived from the header row (row 0 of the data), making the code resilient to column reordering.

---

## 6. Charts

### GastosPorUnidadChart
- `recharts` `BarChart` with `ResponsiveContainer`
- X axis: unit names (CV103, CV104, …)
- Y axis: peso amount
- Bar color: `#3b82f6` (blue), active bar slightly lighter
- Tooltip shows exact amount

### CombustibleTrendChart
- `recharts` `LineChart` with `ResponsiveContainer`
- X axis: week labels (S1, S2, S3, S4 or month labels for year view)
- Y axis: liters
- Line color: `#22c55e` (green), dot on last point
- Area fill with low opacity gradient

Both charts inherit dark background from parent card (`bg-slate-800`).

---

## 7. PDF Report (`reportGenerator.ts`)

Triggered by the 🖨️ PDF button. Uses jsPDF + jspdf-autotable. Respects the active `period` and `unitFilter` at time of click.

**Page 1 — Executive Summary:**
- Header: "HERMES FLEET — REPORTE GERENCIAL" + period label + generated date
- KPI boxes: 4 boxes in a row (Gastos total, Combustible total, Fletes count, Averías count)
- Per-unit summary table (same as on-screen table)

**Page 2 — Gastos Detail:**
- Section heading + period
- Table: Fecha | Unidad | Descripción | Monto — all rows for the period (filtered)

**Page 3 — Combustible Detail:**
- Table: Fecha | Unidad | Litros | Proveedor | Km

**Page 4 — Fletes Detail:**
- Table: Fecha | Unidad | Conductor | Origen | Destino | Tonelaje | KM Total

**Page 5 — Averías Detail:**
- Table: Fecha | Unidad | Descripción | Estado

Each detail page uses `autoTable` with alternating row colors. Footer on every page: page number + generation timestamp.

File name: `hermes-reporte-[periodo]-[fecha].pdf`

---

## 8. Error Handling

- If any collection fetch fails, the store sets `status: 'error'` and the modal shows a yellow warning banner: "Algunos datos no pudieron cargarse. Mostrando datos parciales." — the modal still opens with whatever data did load.
- If a collection returns 0 rows for the active period, its KPI card shows "—" and the chart/table section shows "Sin datos para este período."
- PDF button is disabled while `status === 'loading'`.

---

## 9. DataManagerPage Integration

Two small changes to `DataManagerPage.tsx`:

1. **On mount** — call `analyticsStore.fetch()` via `useEffect([])`
2. **In toolbar** — add `<button onClick={() => setModalOpen(true)}>📊 Analítica</button>` next to the existing Exportar CSV button
3. **At page root** — render `<AnalyticsModal open={modalOpen} onClose={() => setModalOpen(false)} />`

`modalOpen` is local `useState` in `DataManagerPage` — no store needed for open/close state.

---

## 10. File Size & Cohesion

`DataManagerPage.tsx` is already 971 lines. The analytics feature adds zero logic to that file — only 3 lines of integration (effect + button + modal mount). All analytics logic lives in `analyticsStore.ts`, `analyticsUtils.ts`, and the `components/analytics/` directory.

---

## 11. Out of Scope

- Real-time auto-refresh (manual refresh button only)
- Chart for Averías trend (count-over-time) — can be added later
- Fletes revenue tracking (no revenue column in current data)
- Sending the PDF via email/WhatsApp from within the app
