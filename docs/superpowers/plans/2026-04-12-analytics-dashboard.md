# Analytics Dashboard & Printable Reports — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 📊 Analítica modal to the Gestor de Datos page showing KPI totals, per-unit charts, a summary table, and a full PDF export — with data pre-fetched via a Zustand store on page load.

**Architecture:** A Zustand analytics store fetches all 4 collections in parallel on `DataManagerPage` mount and caches them. A modal overlay reads from the store, applies period/unit filters via pure aggregation helpers, renders recharts charts and a summary table, and generates a jsPDF report on demand.

**Tech Stack:** React 18, TypeScript (strict), Zustand 5, Recharts 3, jsPDF 4, jspdf-autotable 5, Tailwind CSS, Lucide React

---

## File Map

| Path | Status | Responsibility |
|---|---|---|
| `src/components/analytics/analyticsUtils.ts` | **Create** | Types + pure date/aggregation helpers |
| `src/components/analytics/analyticsUtils.test.ts` | **Create** | Vitest unit tests for pure functions |
| `src/stores/analyticsStore.ts` | **Create** | Zustand store — fetch, cache, period, unitFilter |
| `src/components/analytics/KpiCards.tsx` | **Create** | 4 KPI card display components |
| `src/components/analytics/GastosPorUnidadChart.tsx` | **Create** | Recharts BarChart — Gastos per unit |
| `src/components/analytics/CombustibleTrendChart.tsx` | **Create** | Recharts LineChart — Combustible weekly trend |
| `src/components/analytics/UnitSummaryTable.tsx` | **Create** | Cross-tab per-unit summary table |
| `src/components/analytics/reportGenerator.ts` | **Create** | jsPDF 5-page PDF builder |
| `src/components/analytics/AnalyticsModal.tsx` | **Create** | Full modal shell — wires all analytics components |
| `src/pages/DataManagerPage.tsx` | **Modify** | +3 lines: `useEffect` fetch + button + modal mount |
| `src/lib/sheets-api.ts` | **Modify** | Fix `updateCell` silent-success bug |

---

## Task 1: Pure Types & Aggregation Helpers (`analyticsUtils.ts`)

**Files:**
- Create: `src/components/analytics/analyticsUtils.ts`

- [ ] **Step 1.1: Create the file with types and helpers**

```typescript
// src/components/analytics/analyticsUtils.ts

// ── Column indices (match DataManagerPage COLLECTIONS order) ─────────────────
// Gastos  ('02 Gastos'):           Fecha=0, Total=9, Unidad=10
// Combustible ('Combustible'):     Fecha=0, Unidad=3, Litros=6, Costo=7
// Fletes  ('Reporte_Fletes_Transporte'): Fecha=0, Unidad=2, KM_Total=8, Tonelaje=11, Flete=12
// Averias ('Averías'):             Fecha=0, Unidad=2, Descripcion=4, Status=7

export type Period = 'week' | 'month' | 'year'

export interface UnitMetrics {
  unit: string
  gastos: number         // sum of Total column (currency)
  combustibleLitros: number
  combustibleCosto: number
  fletes: number         // count of rows
  tonelaje: number
  averias: number        // count of rows
}

export interface KpiTotals {
  gastosTotal: number
  combustibleLitros: number
  combustibleCosto: number
  fletesCount: number
  averiasCount: number
}

export interface WeekPoint {
  label: string   // 'S1', 'S2', ... or 'Ene', 'Feb', ... for year
  litros: number
}

// ── Date helpers ─────────────────────────────────────────────────────────────

const DATE_RE = /^\d{1,2}\/\d{1,2}\/\d{4}$/

/** Parse a DD/MM/YYYY date string. Returns null if invalid. */
export function parseSheetDate(s: string): Date | null {
  if (!DATE_RE.test(s.trim())) return null
  const [d, m, y] = s.trim().split('/').map(Number)
  if (!d || !m || !y) return null
  return new Date(y, m - 1, d)
}

/** Cutoff date for the given period (days before today). */
export function getPeriodCutoff(period: Period): Date {
  const days = period === 'week' ? 7 : period === 'month' ? 30 : 365
  return new Date(Date.now() - days * 86_400_000)
}

/** Return true if a row's Fecha (col 0) falls within the period. */
export function isInPeriod(row: string[], period: Period): boolean {
  const d = parseSheetDate(row[0] ?? '')
  if (!d) return false
  return d >= getPeriodCutoff(period)
}

/** Return true if a row has a real date in col 0 (skips header + empty rows). */
export function isDataRow(row: string[]): boolean {
  return DATE_RE.test((row[0] ?? '').trim())
}

// ── Value parsers ─────────────────────────────────────────────────────────────

/** Parse a currency string like "$3,356.00" or "3356" to a number. */
export function parseCurrency(s: string): number {
  return parseFloat(s.replace(/[$,\s]/g, '')) || 0
}

/** Parse a numeric string to a number (for Litros, Tonelaje, KM). */
export function parseNum(s: string): number {
  return parseFloat(s.replace(/,/g, '')) || 0
}

// ── Aggregation ───────────────────────────────────────────────────────────────

/**
 * Aggregate all four collections into per-unit metrics.
 * Rows must already be filtered to the active period.
 */
export function aggregateByUnit(
  gastos: string[][],
  combustible: string[][],
  fletes: string[][],
  averias: string[][]
): UnitMetrics[] {
  const map = new Map<string, UnitMetrics>()

  const getOrCreate = (unit: string): UnitMetrics => {
    if (!map.has(unit)) {
      map.set(unit, {
        unit,
        gastos: 0,
        combustibleLitros: 0,
        combustibleCosto: 0,
        fletes: 0,
        tonelaje: 0,
        averias: 0,
      })
    }
    return map.get(unit)!
  }

  for (const row of gastos) {
    const unit = (row[10] ?? '').trim()
    if (!unit) continue
    getOrCreate(unit).gastos += parseCurrency(row[9] ?? '')
  }

  for (const row of combustible) {
    const unit = (row[3] ?? '').trim()
    if (!unit) continue
    const m = getOrCreate(unit)
    m.combustibleLitros += parseNum(row[6] ?? '')
    m.combustibleCosto += parseCurrency(row[7] ?? '')
  }

  for (const row of fletes) {
    const unit = (row[2] ?? '').trim()
    if (!unit) continue
    const m = getOrCreate(unit)
    m.fletes += 1
    m.tonelaje += parseNum(row[11] ?? '')
  }

  for (const row of averias) {
    const unit = (row[2] ?? '').trim()
    if (!unit) continue
    getOrCreate(unit).averias += 1
  }

  return Array.from(map.values()).sort((a, b) => a.unit.localeCompare(b.unit))
}

/** Compute fleet-wide KPI totals from per-unit metrics. */
export function computeKpiTotals(units: UnitMetrics[]): KpiTotals {
  return units.reduce<KpiTotals>(
    (acc, u) => ({
      gastosTotal: acc.gastosTotal + u.gastos,
      combustibleLitros: acc.combustibleLitros + u.combustibleLitros,
      combustibleCosto: acc.combustibleCosto + u.combustibleCosto,
      fletesCount: acc.fletesCount + u.fletes,
      averiasCount: acc.averiasCount + u.averias,
    }),
    { gastosTotal: 0, combustibleLitros: 0, combustibleCosto: 0, fletesCount: 0, averiasCount: 0 }
  )
}

/**
 * Build weekly trend data from raw Combustible rows.
 * Returns up to the 8 most recent weeks in the period.
 */
export function buildCombustibleTrend(rows: string[], period: Period): WeekPoint[] {
  // rows here is string[][] but typed as string[] for map key building
  void period // period already applied upstream — rows are pre-filtered
  return [] // placeholder — full implementation below
}

/**
 * Build weekly/monthly Combustible trend from filtered rows.
 * For 'week'/'month': group by ISO week. For 'year': group by month.
 */
export function buildTrend(combustibleRows: string[][], period: Period): WeekPoint[] {
  const buckets = new Map<string, number>()

  for (const row of combustibleRows) {
    const d = parseSheetDate(row[0] ?? '')
    if (!d) continue
    const litros = parseNum(row[6] ?? '')

    let key: string
    if (period === 'year') {
      key = d.toLocaleString('es-MX', { month: 'short', timeZone: 'UTC' })
    } else {
      // ISO week number within the period
      const startOfYear = new Date(d.getFullYear(), 0, 1)
      const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86_400_000 + startOfYear.getDay() + 1) / 7)
      key = `S${weekNum}`
    }

    buckets.set(key, (buckets.get(key) ?? 0) + litros)
  }

  return Array.from(buckets.entries())
    .map(([label, litros]) => ({ label, litros }))
    .slice(-12) // last 12 buckets max
}

/** Extract sorted unique unit names from all collections. */
export function extractUnits(
  gastos: string[][],
  combustible: string[][],
  fletes: string[][],
  averias: string[][]
): string[] {
  const units = new Set<string>()
  for (const row of gastos) { const u = (row[10] ?? '').trim(); if (u) units.add(u) }
  for (const row of combustible) { const u = (row[3] ?? '').trim(); if (u) units.add(u) }
  for (const row of fletes) { const u = (row[2] ?? '').trim(); if (u) units.add(u) }
  for (const row of averias) { const u = (row[2] ?? '').trim(); if (u) units.add(u) }
  return Array.from(units).sort()
}

/** Format a peso amount for display: "$1,234,567" */
export function formatPeso(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-MX')
}

/** Format liters: "8,420 L" */
export function formatLitros(n: number): string {
  return Math.round(n).toLocaleString('es-MX') + ' L'
}
```

- [ ] **Step 1.2: Remove the placeholder `buildCombustibleTrend` that conflicts with `buildTrend`**

Delete lines 97–102 (the `buildCombustibleTrend` stub) — they were only there as a draft. The file above already has the full `buildTrend` function. Double-check the file has no duplicate exports.

- [ ] **Step 1.3: Commit**

```bash
git add src/components/analytics/analyticsUtils.ts
git commit -m "feat: analytics aggregation helpers and types"
```

---

## Task 2: Unit Tests for `analyticsUtils.ts`

**Files:**
- Create: `src/components/analytics/analyticsUtils.test.ts`

- [ ] **Step 2.1: Create test file**

```typescript
// src/components/analytics/analyticsUtils.test.ts
import { describe, it, expect } from 'vitest'
import {
  parseSheetDate,
  getPeriodCutoff,
  isInPeriod,
  isDataRow,
  parseCurrency,
  parseNum,
  aggregateByUnit,
  computeKpiTotals,
  buildTrend,
  extractUnits,
} from './analyticsUtils'

describe('parseSheetDate', () => {
  it('parses a valid DD/MM/YYYY date', () => {
    const d = parseSheetDate('12/04/2026')
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2026)
    expect(d!.getMonth()).toBe(3) // April = 3
    expect(d!.getDate()).toBe(12)
  })
  it('returns null for header text', () => {
    expect(parseSheetDate('Fecha')).toBeNull()
    expect(parseSheetDate('')).toBeNull()
    expect(parseSheetDate('01-04-2026')).toBeNull()
  })
})

describe('isDataRow', () => {
  it('returns true for rows with a date in col 0', () => {
    expect(isDataRow(['12/04/2026', 'CV103', '42000'])).toBe(true)
  })
  it('returns false for header row', () => {
    expect(isDataRow(['Fecha', 'Unidad', 'Total'])).toBe(false)
  })
  it('returns false for empty row', () => {
    expect(isDataRow([])).toBe(false)
  })
})

describe('parseCurrency', () => {
  it('parses $3,356.00', () => expect(parseCurrency('$3,356.00')).toBe(3356))
  it('parses 42000', () => expect(parseCurrency('42000')).toBe(42000))
  it('returns 0 for empty string', () => expect(parseCurrency('')).toBe(0))
})

describe('parseNum', () => {
  it('parses 8,420', () => expect(parseNum('8,420')).toBe(8420))
  it('parses 47.07', () => expect(parseNum('47.07')).toBeCloseTo(47.07))
  it('returns 0 for empty', () => expect(parseNum('')).toBe(0))
})

describe('aggregateByUnit', () => {
  const gastos = [
    ['12/04/2026', '', '', '', '', '', '', '', '', '42000', 'CV103'],
    ['11/04/2026', '', '', '', '', '', '', '', '', '31000', 'CV104'],
    ['10/04/2026', '', '', '', '', '', '', '', '', '51000', 'CV103'],
  ]
  const combustible = [
    ['12/04/2026', '', '', 'CV103', '', '', '1200', '15000'],
    ['11/04/2026', '', '', 'CV104', '', '', '800', '10000'],
  ]
  const fletes = [
    ['12/04/2026', '', 'CV103', '', '', '', '', '', '100', '', '', '47'],
    ['11/04/2026', '', 'CV103', '', '', '', '', '', '80', '', '', '30'],
    ['10/04/2026', '', 'CV104', '', '', '', '', '', '90', '', '', '25'],
  ]
  const averias = [
    ['09/04/2026', '', 'CV104'],
    ['08/04/2026', '', 'CV104'],
    ['07/04/2026', '', 'CV103'],
  ]

  it('aggregates gastos per unit correctly', () => {
    const result = aggregateByUnit(gastos, [], [], [])
    const cv103 = result.find(u => u.unit === 'CV103')!
    const cv104 = result.find(u => u.unit === 'CV104')!
    expect(cv103.gastos).toBe(93000) // 42000 + 51000
    expect(cv104.gastos).toBe(31000)
  })

  it('aggregates combustible litros per unit', () => {
    const result = aggregateByUnit([], combustible, [], [])
    expect(result.find(u => u.unit === 'CV103')!.combustibleLitros).toBe(1200)
    expect(result.find(u => u.unit === 'CV104')!.combustibleLitros).toBe(800)
  })

  it('counts fletes per unit', () => {
    const result = aggregateByUnit([], [], fletes, [])
    expect(result.find(u => u.unit === 'CV103')!.fletes).toBe(2)
    expect(result.find(u => u.unit === 'CV104')!.fletes).toBe(1)
  })

  it('counts averias per unit', () => {
    const result = aggregateByUnit([], [], [], averias)
    expect(result.find(u => u.unit === 'CV104')!.averias).toBe(2)
    expect(result.find(u => u.unit === 'CV103')!.averias).toBe(1)
  })
})

describe('computeKpiTotals', () => {
  it('sums all units into fleet totals', () => {
    const units = [
      { unit: 'CV103', gastos: 42000, combustibleLitros: 1200, combustibleCosto: 15000, fletes: 2, tonelaje: 77, averias: 1 },
      { unit: 'CV104', gastos: 31000, combustibleLitros: 800, combustibleCosto: 10000, fletes: 1, tonelaje: 25, averias: 2 },
    ]
    const totals = computeKpiTotals(units)
    expect(totals.gastosTotal).toBe(73000)
    expect(totals.combustibleLitros).toBe(2000)
    expect(totals.fletesCount).toBe(3)
    expect(totals.averiasCount).toBe(3)
  })
})

describe('buildTrend', () => {
  it('returns an array of week points', () => {
    const rows = [
      ['05/04/2026', '', '', 'CV103', '', '', '500'],
      ['06/04/2026', '', '', 'CV104', '', '', '300'],
    ]
    const trend = buildTrend(rows, 'month')
    expect(trend.length).toBeGreaterThan(0)
    expect(trend[0]).toHaveProperty('label')
    expect(trend[0]).toHaveProperty('litros')
  })
})

describe('extractUnits', () => {
  it('returns sorted unique units across all collections', () => {
    const gastos = [['01/04/2026', '', '', '', '', '', '', '', '', '', 'CV105']]
    const combustible = [['01/04/2026', '', '', 'CV103']]
    const fletes = [['01/04/2026', '', 'CV104']]
    const averias = [['01/04/2026', '', 'CV103']]
    const units = extractUnits(gastos, combustible, fletes, averias)
    expect(units).toEqual(['CV103', 'CV104', 'CV105'])
  })
})
```

- [ ] **Step 2.2: Run tests**

```bash
cd C:/Users/Cuki/Desktop/Dani/hermes-fleet-app
npx vitest run src/components/analytics/analyticsUtils.test.ts
```

Expected: All tests pass (green). If any fail, fix the corresponding helper in `analyticsUtils.ts`.

- [ ] **Step 2.3: Commit**

```bash
git add src/components/analytics/analyticsUtils.test.ts
git commit -m "test: unit tests for analytics aggregation helpers"
```

---

## Task 3: Zustand Analytics Store (`analyticsStore.ts`)

**Files:**
- Create: `src/stores/analyticsStore.ts`

- [ ] **Step 3.1: Create the store**

```typescript
// src/stores/analyticsStore.ts
import { create } from 'zustand'
import { readRange, SHEET_TABS } from '../lib/sheets-api'
import {
  type Period,
  type UnitMetrics,
  type KpiTotals,
  type WeekPoint,
  isDataRow,
  isInPeriod,
  aggregateByUnit,
  computeKpiTotals,
  buildTrend,
  extractUnits,
} from '../components/analytics/analyticsUtils'

// Re-export types used by consumers
export type { Period, UnitMetrics, KpiTotals, WeekPoint }

type Status = 'idle' | 'loading' | 'ready' | 'error'

interface RawData {
  gastos: string[][]
  combustible: string[][]
  fletes: string[][]
  averias: string[][]
}

interface AnalyticsState {
  // raw rows from API (all rows, no period filter applied here)
  raw: RawData
  status: Status
  lastFetched: Date | null
  fetchErrors: string[]

  // UI filter state
  period: Period
  unitFilter: string  // 'all' or a unit name like 'CV103'

  // actions
  fetch: () => Promise<void>
  setPeriod: (p: Period) => void
  setUnitFilter: (u: string) => void

  // derived selectors (computed on read)
  getFilteredRows: () => RawData
  getUnits: () => string[]
  getUnitMetrics: () => UnitMetrics[]
  getKpiTotals: () => KpiTotals
  getTrend: () => WeekPoint[]
}

export const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
  raw: { gastos: [], combustible: [], fletes: [], averias: [] },
  status: 'idle',
  lastFetched: null,
  fetchErrors: [],
  period: 'month',
  unitFilter: 'all',

  fetch: async () => {
    if (get().status === 'loading') return
    set({ status: 'loading', fetchErrors: [] })

    const errors: string[] = []

    const safeRead = async (tab: string): Promise<string[][]> => {
      try {
        const rows = await readRange(tab)
        return rows.filter(isDataRow)
      } catch (err) {
        errors.push(`${tab}: ${err instanceof Error ? err.message : 'error'}`)
        return []
      }
    }

    const [gastos, combustible, fletes, averias] = await Promise.all([
      safeRead(SHEET_TABS.GASTOS),
      safeRead(SHEET_TABS.COMBUSTIBLE),
      safeRead(SHEET_TABS.FLETES),
      safeRead(SHEET_TABS.AVERIAS),
    ])

    set({
      raw: { gastos, combustible, fletes, averias },
      status: errors.length < 4 ? 'ready' : 'error',
      lastFetched: new Date(),
      fetchErrors: errors,
    })
  },

  setPeriod: (period) => set({ period }),
  setUnitFilter: (unitFilter) => set({ unitFilter }),

  getFilteredRows: () => {
    const { raw, period, unitFilter } = get()

    const filterRow = (unitColIndex: number) => (row: string[]) => {
      if (!isInPeriod(row, period)) return false
      if (unitFilter === 'all') return true
      return (row[unitColIndex] ?? '').trim() === unitFilter
    }

    return {
      gastos: raw.gastos.filter(filterRow(10)),
      combustible: raw.combustible.filter(filterRow(3)),
      fletes: raw.fletes.filter(filterRow(2)),
      averias: raw.averias.filter(filterRow(2)),
    }
  },

  getUnits: () => {
    const { raw } = get()
    return extractUnits(raw.gastos, raw.combustible, raw.fletes, raw.averias)
  },

  getUnitMetrics: () => {
    const { gastos, combustible, fletes, averias } = get().getFilteredRows()
    return aggregateByUnit(gastos, combustible, fletes, averias)
  },

  getKpiTotals: () => computeKpiTotals(get().getUnitMetrics()),

  getTrend: () => {
    const { combustible } = get().getFilteredRows()
    return buildTrend(combustible, get().period)
  },
}))
```

- [ ] **Step 3.2: Verify TypeScript compiles**

```bash
cd C:/Users/Cuki/Desktop/Dani/hermes-fleet-app
npx tsc --noEmit
```

Expected: No errors. Fix any type errors before continuing.

- [ ] **Step 3.3: Commit**

```bash
git add src/stores/analyticsStore.ts
git commit -m "feat: analytics Zustand store with period + unit filters"
```

---

## Task 4: KPI Cards (`KpiCards.tsx`)

**Files:**
- Create: `src/components/analytics/KpiCards.tsx`

- [ ] **Step 4.1: Create the component**

```tsx
// src/components/analytics/KpiCards.tsx
import type { KpiTotals } from './analyticsUtils'
import { formatPeso, formatLitros } from './analyticsUtils'

interface KpiCardsProps {
  totals: KpiTotals
}

interface CardProps {
  label: string
  value: string
  accent: string   // Tailwind border-left color class
}

function KpiCard({ label, value, accent }: CardProps) {
  return (
    <div className={`bg-[#1e293b] rounded-xl p-4 border-l-4 ${accent}`}>
      <p className="text-[10px] text-[#64748b] uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xl font-bold text-[#f1f5f9]">{value}</p>
    </div>
  )
}

export default function KpiCards({ totals }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <KpiCard
        label="💰 Gastos"
        value={totals.gastosTotal > 0 ? formatPeso(totals.gastosTotal) : '—'}
        accent="border-[#3b82f6]"
      />
      <KpiCard
        label="⛽ Combustible"
        value={totals.combustibleLitros > 0 ? formatLitros(totals.combustibleLitros) : '—'}
        accent="border-[#22c55e]"
      />
      <KpiCard
        label="🚛 Fletes"
        value={totals.fletesCount > 0 ? `${totals.fletesCount} viajes` : '—'}
        accent="border-[#f97316]"
      />
      <KpiCard
        label="🔧 Averías"
        value={totals.averiasCount > 0 ? `${totals.averiasCount} eventos` : '—'}
        accent="border-[#f87171]"
      />
    </div>
  )
}
```

- [ ] **Step 4.2: Commit**

```bash
git add src/components/analytics/KpiCards.tsx
git commit -m "feat: analytics KPI cards component"
```

---

## Task 5: Gastos Bar Chart (`GastosPorUnidadChart.tsx`)

**Files:**
- Create: `src/components/analytics/GastosPorUnidadChart.tsx`

- [ ] **Step 5.1: Create the component**

```tsx
// src/components/analytics/GastosPorUnidadChart.tsx
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { UnitMetrics } from './analyticsUtils'
import { formatPeso } from './analyticsUtils'

interface GastosPorUnidadChartProps {
  units: UnitMetrics[]
}

export default function GastosPorUnidadChart({ units }: GastosPorUnidadChartProps) {
  if (units.length === 0) {
    return (
      <div className="bg-[#1e293b] rounded-xl p-4 flex items-center justify-center h-40">
        <p className="text-[#475569] text-sm">Sin datos para este período</p>
      </div>
    )
  }

  const data = units.map(u => ({ unit: u.unit, gastos: Math.round(u.gastos) }))

  return (
    <div className="bg-[#1e293b] rounded-xl p-4">
      <p className="text-[10px] text-[#64748b] uppercase tracking-wide mb-3">
        Gastos por Unidad
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis
            dataKey="unit"
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
            width={36}
          />
          <Tooltip
            formatter={(value: number) => [formatPeso(value), 'Gastos']}
            contentStyle={{
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '8px',
              fontSize: 12,
            }}
            labelStyle={{ color: '#94a3b8' }}
          />
          <Bar dataKey="gastos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 5.2: Commit**

```bash
git add src/components/analytics/GastosPorUnidadChart.tsx
git commit -m "feat: Gastos por Unidad recharts bar chart"
```

---

## Task 6: Combustible Trend Chart (`CombustibleTrendChart.tsx`)

**Files:**
- Create: `src/components/analytics/CombustibleTrendChart.tsx`

- [ ] **Step 6.1: Create the component**

```tsx
// src/components/analytics/CombustibleTrendChart.tsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts'
import type { WeekPoint } from './analyticsUtils'
import { formatLitros } from './analyticsUtils'

interface CombustibleTrendChartProps {
  data: WeekPoint[]
}

export default function CombustibleTrendChart({ data }: CombustibleTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-[#1e293b] rounded-xl p-4 flex items-center justify-center h-40">
        <p className="text-[#475569] text-sm">Sin datos para este período</p>
      </div>
    )
  }

  return (
    <div className="bg-[#1e293b] rounded-xl p-4">
      <p className="text-[10px] text-[#64748b] uppercase tracking-wide mb-3">
        Combustible — Tendencia
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="combustibleGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}L`}
            width={36}
          />
          <Tooltip
            formatter={(value: number) => [formatLitros(value), 'Combustible']}
            contentStyle={{
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '8px',
              fontSize: 12,
            }}
            labelStyle={{ color: '#94a3b8' }}
          />
          <Area
            type="monotone"
            dataKey="litros"
            stroke="#22c55e"
            strokeWidth={2}
            fill="url(#combustibleGradient)"
            dot={{ r: 3, fill: '#22c55e', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 6.2: Commit**

```bash
git add src/components/analytics/CombustibleTrendChart.tsx
git commit -m "feat: Combustible trend recharts area chart"
```

---

## Task 7: Unit Summary Table (`UnitSummaryTable.tsx`)

**Files:**
- Create: `src/components/analytics/UnitSummaryTable.tsx`

- [ ] **Step 7.1: Create the component**

```tsx
// src/components/analytics/UnitSummaryTable.tsx
import type { UnitMetrics } from './analyticsUtils'
import { formatPeso, formatLitros } from './analyticsUtils'

interface UnitSummaryTableProps {
  units: UnitMetrics[]
}

export default function UnitSummaryTable({ units }: UnitSummaryTableProps) {
  if (units.length === 0) {
    return (
      <div className="bg-[#1e293b] rounded-xl p-4 text-center">
        <p className="text-[#475569] text-sm">Sin datos para este período</p>
      </div>
    )
  }

  const totals = units.reduce(
    (acc, u) => ({
      gastos: acc.gastos + u.gastos,
      combustibleLitros: acc.combustibleLitros + u.combustibleLitros,
      fletes: acc.fletes + u.fletes,
      averias: acc.averias + u.averias,
    }),
    { gastos: 0, combustibleLitros: 0, fletes: 0, averias: 0 }
  )

  return (
    <div className="bg-[#1e293b] rounded-xl p-4">
      <p className="text-[10px] text-[#64748b] uppercase tracking-wide mb-3">
        Resumen por Unidad
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[#64748b] text-[10px] uppercase tracking-wide">
              <th className="text-left py-2 px-3 font-medium">Unidad</th>
              <th className="text-right py-2 px-3 font-medium">Gastos</th>
              <th className="text-right py-2 px-3 font-medium">Combustible</th>
              <th className="text-right py-2 px-3 font-medium">Fletes</th>
              <th className="text-right py-2 px-3 font-medium">Averías</th>
            </tr>
          </thead>
          <tbody>
            {units.map((u, i) => (
              <tr
                key={u.unit}
                className={`border-t border-[#334155] ${i % 2 === 1 ? 'bg-[#111827]/50' : ''}`}
              >
                <td className="py-2 px-3 font-semibold text-[#f1f5f9] font-mono">{u.unit}</td>
                <td className="py-2 px-3 text-right text-[#93c5fd]">
                  {u.gastos > 0 ? formatPeso(u.gastos) : '—'}
                </td>
                <td className="py-2 px-3 text-right text-[#86efac]">
                  {u.combustibleLitros > 0 ? formatLitros(u.combustibleLitros) : '—'}
                </td>
                <td className="py-2 px-3 text-right text-[#f1f5f9]">
                  {u.fletes > 0 ? u.fletes : '—'}
                </td>
                <td className="py-2 px-3 text-right text-[#fca5a5]">
                  {u.averias > 0 ? u.averias : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#475569] font-bold">
              <td className="py-2 px-3 text-[#94a3b8] text-[10px] uppercase">Total</td>
              <td className="py-2 px-3 text-right text-[#60a5fa]">{formatPeso(totals.gastos)}</td>
              <td className="py-2 px-3 text-right text-[#4ade80]">{formatLitros(totals.combustibleLitros)}</td>
              <td className="py-2 px-3 text-right text-[#f1f5f9]">{totals.fletes}</td>
              <td className="py-2 px-3 text-right text-[#f87171]">{totals.averias}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 7.2: Commit**

```bash
git add src/components/analytics/UnitSummaryTable.tsx
git commit -m "feat: per-unit analytics summary table"
```

---

## Task 8: PDF Report Generator (`reportGenerator.ts`)

**Files:**
- Create: `src/components/analytics/reportGenerator.ts`

- [ ] **Step 8.1: Create the PDF builder**

```typescript
// src/components/analytics/reportGenerator.ts
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { UnitMetrics, KpiTotals, Period } from './analyticsUtils'
import { formatPeso, formatLitros } from './analyticsUtils'

// Column indices for detail tables (same as DataManagerPage COLLECTIONS)
// Fletes:      Fecha=0, Unidad=2, Conductor=3, Origen=6, Destino=7, KM Total=8, Tonelaje=11, Flete=12
// Combustible: Fecha=0, Unidad=3, Litros=6, Costo=7, Estacion=11
// Gastos:      Fecha=0, Unidad=10, Tipo=3, Proveedor=4, Total=9
// Averias:     Fecha=0, Unidad=2, Descripcion=4, Status=7

const DARK_BLUE = [22, 34, 82] as [number, number, number]  // #162252
const LIGHT_BG  = [241, 245, 249] as [number, number, number]  // #f1f5f9
const ALT_ROW   = [248, 250, 252] as [number, number, number]  // #f8fafc

function addPageFooter(doc: jsPDF, generated: string) {
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(
      `Página ${i} de ${pageCount}  ·  Generado: ${generated}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    )
  }
}

function addSectionHeader(doc: jsPDF, y: number, title: string): number {
  doc.setFontSize(12)
  doc.setTextColor(...DARK_BLUE)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 14, y)
  doc.setDrawColor(...DARK_BLUE)
  doc.line(14, y + 2, doc.internal.pageSize.getWidth() - 14, y + 2)
  return y + 10
}

export function generateReport(params: {
  period: Period
  unitFilter: string
  units: UnitMetrics[]
  totals: KpiTotals
  gastosRows: string[][]
  combustibleRows: string[][]
  fletesRows: string[][]
  averiasRows: string[][]
}): void {
  const { period, unitFilter, units, totals, gastosRows, combustibleRows, fletesRows, averiasRows } = params

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const now = new Date()
  const generated = now.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })
  const periodLabel = period === 'week' ? 'Semana' : period === 'month' ? 'Mes' : 'Año'
  const unitLabel = unitFilter === 'all' ? 'Todas las unidades' : unitFilter

  // ── PAGE 1: Executive Summary ──────────────────────────────────────────────
  doc.setFontSize(18)
  doc.setTextColor(...DARK_BLUE)
  doc.setFont('helvetica', 'bold')
  doc.text('HERMES FLEET — REPORTE GERENCIAL', 14, 20)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100)
  doc.text(`Período: ${periodLabel}  ·  Unidades: ${unitLabel}  ·  Generado: ${generated}`, 14, 28)

  doc.setDrawColor(...DARK_BLUE)
  doc.setLineWidth(0.5)
  doc.line(14, 31, 196, 31)

  // KPI boxes (4 across)
  const kpiBoxes = [
    { label: 'Total Gastos', value: formatPeso(totals.gastosTotal) },
    { label: 'Combustible', value: formatLitros(totals.combustibleLitros) },
    { label: 'Fletes', value: `${totals.fletesCount} viajes` },
    { label: 'Averías', value: `${totals.averiasCount} eventos` },
  ]

  kpiBoxes.forEach((kpi, i) => {
    const x = 14 + i * 45.5
    doc.setFillColor(...LIGHT_BG)
    doc.roundedRect(x, 36, 43, 20, 2, 2, 'F')
    doc.setFontSize(8)
    doc.setTextColor(100)
    doc.setFont('helvetica', 'normal')
    doc.text(kpi.label, x + 3, 43)
    doc.setFontSize(12)
    doc.setTextColor(...DARK_BLUE)
    doc.setFont('helvetica', 'bold')
    doc.text(kpi.value, x + 3, 52)
  })

  // Per-unit summary table
  addSectionHeader(doc, 66, 'Resumen por Unidad')

  autoTable(doc, {
    startY: 70,
    head: [['Unidad', 'Gastos', 'Combustible (L)', 'Fletes', 'Averías']],
    body: units.map(u => [
      u.unit,
      u.gastos > 0 ? formatPeso(u.gastos) : '—',
      u.combustibleLitros > 0 ? formatLitros(u.combustibleLitros) : '—',
      u.fletes > 0 ? String(u.fletes) : '—',
      u.averias > 0 ? String(u.averias) : '—',
    ]),
    foot: [['TOTAL', formatPeso(totals.gastosTotal), formatLitros(totals.combustibleLitros), String(totals.fletesCount), String(totals.averiasCount)]],
    headStyles: { fillColor: DARK_BLUE, fontSize: 9 },
    footStyles: { fillColor: DARK_BLUE, fontSize: 9, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: ALT_ROW },
    styles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  })

  // ── PAGE 2: Gastos Detail ─────────────────────────────────────────────────
  doc.addPage()
  addSectionHeader(doc, 20, `Gastos — Detalle (${periodLabel} · ${unitLabel})`)

  autoTable(doc, {
    startY: 28,
    head: [['Fecha', 'Unidad', 'Tipo', 'Proveedor', 'Total']],
    body: gastosRows.map(r => [r[0] ?? '', r[10] ?? '', r[3] ?? '', r[4] ?? '', formatPeso(parseFloat((r[9] ?? '0').replace(/[$,]/g, '')) || 0)]),
    headStyles: { fillColor: DARK_BLUE, fontSize: 8 },
    alternateRowStyles: { fillColor: ALT_ROW },
    styles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
  })

  // ── PAGE 3: Combustible Detail ────────────────────────────────────────────
  doc.addPage()
  addSectionHeader(doc, 20, `Combustible — Detalle (${periodLabel} · ${unitLabel})`)

  autoTable(doc, {
    startY: 28,
    head: [['Fecha', 'Unidad', 'Litros', 'Costo', 'Estación']],
    body: combustibleRows.map(r => [r[0] ?? '', r[3] ?? '', r[6] ?? '', formatPeso(parseFloat((r[7] ?? '0').replace(/[$,]/g, '')) || 0), r[11] ?? '']),
    headStyles: { fillColor: DARK_BLUE, fontSize: 8 },
    alternateRowStyles: { fillColor: ALT_ROW },
    styles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
  })

  // ── PAGE 4: Fletes Detail ─────────────────────────────────────────────────
  doc.addPage()
  addSectionHeader(doc, 20, `Fletes — Detalle (${periodLabel} · ${unitLabel})`)

  autoTable(doc, {
    startY: 28,
    head: [['Fecha', 'Unidad', 'Conductor', 'Origen', 'Destino', 'Ton.', 'KM']],
    body: fletesRows.map(r => [r[0] ?? '', r[2] ?? '', r[3] ?? '', r[6] ?? '', r[7] ?? '', r[11] ?? '', r[8] ?? '']),
    headStyles: { fillColor: DARK_BLUE, fontSize: 8 },
    alternateRowStyles: { fillColor: ALT_ROW },
    styles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
    columnStyles: { 5: { halign: 'right' }, 6: { halign: 'right' } },
  })

  // ── PAGE 5: Averías Detail ────────────────────────────────────────────────
  doc.addPage()
  addSectionHeader(doc, 20, `Averías — Detalle (${periodLabel} · ${unitLabel})`)

  autoTable(doc, {
    startY: 28,
    head: [['Fecha', 'Unidad', 'Descripción', 'Status']],
    body: averiasRows.map(r => [r[0] ?? '', r[2] ?? '', r[4] ?? '', r[7] ?? '']),
    headStyles: { fillColor: DARK_BLUE, fontSize: 8 },
    alternateRowStyles: { fillColor: ALT_ROW },
    styles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
    columnStyles: { 2: { cellWidth: 90 } },
  })

  // Add footers to all pages
  addPageFooter(doc, generated)

  // Save
  const dateStr = now.toISOString().slice(0, 10)
  doc.save(`hermes-reporte-${periodLabel.toLowerCase()}-${dateStr}.pdf`)
}
```

- [ ] **Step 8.2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors. If you see `Cannot find module 'jspdf-autotable'`, add this to `src/vite-env.d.ts`:
```typescript
declare module 'jspdf-autotable'
```

- [ ] **Step 8.3: Commit**

```bash
git add src/components/analytics/reportGenerator.ts
git commit -m "feat: jsPDF analytics report generator (5 pages)"
```

---

## Task 9: Analytics Modal Shell (`AnalyticsModal.tsx`)

**Files:**
- Create: `src/components/analytics/AnalyticsModal.tsx`

- [ ] **Step 9.1: Create the modal**

```tsx
// src/components/analytics/AnalyticsModal.tsx
import { useAnalyticsStore } from '../../stores/analyticsStore'
import KpiCards from './KpiCards'
import GastosPorUnidadChart from './GastosPorUnidadChart'
import CombustibleTrendChart from './CombustibleTrendChart'
import UnitSummaryTable from './UnitSummaryTable'
import { generateReport } from './reportGenerator'
import type { Period } from './analyticsUtils'

interface AnalyticsModalProps {
  open: boolean
  onClose: () => void
}

const PERIOD_LABELS: Record<Period, string> = {
  week: 'Semana',
  month: 'Mes',
  year: 'Año',
}

export default function AnalyticsModal({ open, onClose }: AnalyticsModalProps) {
  const {
    status,
    fetchErrors,
    period,
    unitFilter,
    setPeriod,
    setUnitFilter,
    fetch: refetch,
    getUnits,
    getUnitMetrics,
    getKpiTotals,
    getTrend,
    getFilteredRows,
  } = useAnalyticsStore()

  if (!open) return null

  const units = getUnits()
  const unitMetrics = getUnitMetrics()
  const kpiTotals = getKpiTotals()
  const trend = getTrend()
  const filteredRows = getFilteredRows()

  const handlePrint = () => {
    generateReport({
      period,
      unitFilter,
      units: unitMetrics,
      totals: kpiTotals,
      gastosRows: filteredRows.gastos,
      combustibleRows: filteredRows.combustible,
      fletesRows: filteredRows.fletes,
      averiasRows: filteredRows.averias,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-4 pb-4 px-4 overflow-y-auto"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal panel */}
      <div
        className="relative z-10 w-full max-w-5xl bg-[#0f172a] rounded-2xl shadow-2xl border border-[#1e293b] my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 px-5 py-4 border-b border-[#1e293b]">
          <span className="text-lg font-bold text-[#f1f5f9] flex-1 min-w-0">
            📊 Analítica de Flota
          </span>

          {/* Period filter */}
          <div className="flex gap-1 bg-[#1e293b] rounded-lg p-1">
            {(['week', 'month', 'year'] as Period[]).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  period === p
                    ? 'bg-[#3b82f6] text-white'
                    : 'text-[#94a3b8] hover:text-[#f1f5f9]'
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Unit filter */}
          <select
            value={unitFilter}
            onChange={e => setUnitFilter(e.target.value)}
            className="bg-[#1e293b] text-[#94a3b8] text-xs rounded-lg px-3 py-2 border border-[#334155] focus:outline-none focus:ring-1 focus:ring-[#3b82f6]"
          >
            <option value="all">🚛 Todas las unidades</option>
            {units.map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>

          {/* PDF button */}
          <button
            type="button"
            onClick={handlePrint}
            disabled={status === 'loading' || unitMetrics.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            🖨️ <span className="hidden sm:inline">PDF</span>
          </button>

          {/* Refresh button */}
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={status === 'loading'}
            className="flex items-center justify-center w-8 h-8 bg-[#1e293b] hover:bg-[#334155] rounded-lg text-[#94a3b8] transition-colors disabled:opacity-40"
            title="Actualizar datos"
          >
            {status === 'loading' ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 4v6h6M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 bg-[#1e293b] hover:bg-[#334155] rounded-lg text-[#94a3b8] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="p-5 space-y-4">
          {/* Partial error warning */}
          {fetchErrors.length > 0 && (
            <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg px-4 py-3 text-yellow-300 text-xs">
              ⚠️ Algunos datos no pudieron cargarse. Mostrando datos parciales.
            </div>
          )}

          {/* Loading skeleton */}
          {status === 'loading' && unitMetrics.length === 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="bg-[#1e293b] rounded-xl p-4 h-20 animate-pulse" />
              ))}
            </div>
          )}

          {/* KPIs */}
          {status !== 'loading' && <KpiCards totals={kpiTotals} />}

          {/* Charts */}
          {status !== 'loading' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GastosPorUnidadChart units={unitMetrics} />
              <CombustibleTrendChart data={trend} />
            </div>
          )}

          {/* Summary table */}
          {status !== 'loading' && <UnitSummaryTable units={unitMetrics} />}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 9.2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 9.3: Commit**

```bash
git add src/components/analytics/AnalyticsModal.tsx
git commit -m "feat: analytics modal shell with filters, charts, table, and PDF"
```

---

## Task 10: Wire into `DataManagerPage.tsx`

**Files:**
- Modify: `src/pages/DataManagerPage.tsx`

The file is 971 lines. Make three surgical changes — no other lines touched.

- [ ] **Step 10.1: Add imports at the top of the file**

Find the existing import block (around line 1–15). Add these two imports **after** the existing imports:

```typescript
import { useAnalyticsStore } from '../stores/analyticsStore'
import AnalyticsModal from '../components/analytics/AnalyticsModal'
```

- [ ] **Step 10.2: Add state + effect inside the `DataManagerPage` component**

Find the existing `useState` declarations near the top of the component function body. After the last `useState`, add:

```typescript
const [analyticsOpen, setAnalyticsOpen] = useState(false)
useEffect(() => { void useAnalyticsStore.getState().fetch() }, [])
```

The `useEffect` with `[]` fires once on mount and pre-fetches all analytics data in the background.

- [ ] **Step 10.3: Add the Analítica button in the toolbar**

Find this exact block (around line 634):

```typescript
  {/* Export CSV button */}
  <button
    type="button"
    onClick={handleExport}
    disabled={visibleRows.length === 0}
    title="Exportar CSV"
    className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-[#162252] text-white text-xs font-semibold hover:bg-[#1E3A8A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
  >
    <Download size={14} />
    <span className="hidden sm:inline">Exportar CSV</span>
  </button>
```

Insert the following **immediately before** that block:

```tsx
  {/* Analytics button */}
  <button
    type="button"
    onClick={() => setAnalyticsOpen(true)}
    title="Analítica"
    className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-[#7c3aed] text-white text-xs font-semibold hover:bg-[#6d28d9] transition-colors"
  >
    <span>📊</span>
    <span className="hidden sm:inline">Analítica</span>
  </button>
```

- [ ] **Step 10.4: Mount the modal at the bottom of the component's return**

Find the closing `</div>` of the outermost return (last line of the JSX). Insert **just before** it:

```tsx
<AnalyticsModal open={analyticsOpen} onClose={() => setAnalyticsOpen(false)} />
```

- [ ] **Step 10.5: Verify TypeScript and dev server**

```bash
npx tsc --noEmit
npm run dev
```

Open `http://localhost:5173/data`. You should see the **📊 Analítica** button in the toolbar. Click it — the modal should open, fetch data, and display KPIs, charts, and the summary table. Click outside to close.

- [ ] **Step 10.6: Commit**

```bash
git add src/pages/DataManagerPage.tsx
git commit -m "feat: wire analytics modal into DataManagerPage"
```

---

## Task 11: Fix the Disappearing-Row Bug (edit → refresh reverts)

**Root cause:** `updateCell` in `sheets-api.ts` returns HTTP 200 even when the row wasn't found (the server responds `{"success": false}`). The frontend only checks the HTTP status, misses the failure, updates the local cache optimistically, and on refresh the old data returns.

**Files:**
- Modify: `src/lib/sheets-api.ts`

- [ ] **Step 11.1: Find the `updateCell` function**

```bash
grep -n "updateCell" src/lib/sheets-api.ts
```

Expected output will show the function definition. Open the file and locate the function body.

- [ ] **Step 11.2: Add success-body check to `updateCell`**

Find the current `updateCell` function. It currently looks like this pattern:

```typescript
export async function updateCell(...): Promise<void> {
  const response = await fetch('/hermes-api/api/sheets/update', { ... })
  if (!response.ok) throw new Error(...)
  // ← gap here: no check on response.json().success
}
```

Change it to also check the JSON body:

```typescript
export async function updateCell(
  tab: string,
  keyColIndex: number,
  keyValue: string,
  updateColIndex: number,
  updateValue: string
): Promise<void> {
  const response = await fetch('/hermes-api/api/sheets/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tab,
      search_column: keyColIndex,
      search_value: keyValue,
      update_column: updateColIndex,
      update_value: updateValue,
    }),
  })
  if (!response.ok) {
    throw new Error(`Sheets API error ${response.status}`)
  }
  const json = await response.json() as { success: boolean; detail?: string }
  if (!json.success) {
    throw new Error(json.detail ?? 'Fila no encontrada — el cambio no se guardó')
  }
}
```

**Important:** Keep the existing function signature exactly as it is — only add the `json` check after the `if (!response.ok)` block. If the existing signature differs from the above, adjust the body only.

- [ ] **Step 11.3: Update `handleCellSave` in `DataManagerPage.tsx` to show the error**

Find `handleCellSave` in `DataManagerPage.tsx`. It currently calls `updateCell(...)` inside a try/catch or directly. Make sure it shows an error toast/alert on failure instead of silently succeeding:

```typescript
// Inside handleCellSave, replace the silent catch with:
try {
  await updateCell(active.tab, keyCol.index, keyValue, targetCol.index, newValue)
  // update local cache on success
  setCache(prev => ({
    ...prev,
    [active.id]: prev[active.id]?.map((row, i) =>
      i === rowIndex ? row.map((cell, j) => (j === targetCol.index ? newValue : cell)) : row
    ) ?? [],
  }))
} catch (err) {
  alert(err instanceof Error ? err.message : 'Error al guardar')
}
```

Adjust to match the actual structure of `handleCellSave` in the file — only add the alert on error.

- [ ] **Step 11.4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 11.5: Test the fix**

1. Open `http://localhost:5173/data`
2. Click any cell in any tab, edit the value, save
3. Refresh the page
4. The edited value should persist

- [ ] **Step 11.6: Commit**

```bash
git add src/lib/sheets-api.ts src/pages/DataManagerPage.tsx
git commit -m "fix: updateCell now checks success body — edits no longer revert on refresh"
```

---

## Task 12: Build Verification & Deploy

- [ ] **Step 12.1: Run full test suite**

```bash
npx vitest run
```

Expected: All tests in `analyticsUtils.test.ts` pass.

- [ ] **Step 12.2: Production build**

```bash
npm run build
```

Expected: Build completes with no errors. Fix any type or lint errors before continuing.

- [ ] **Step 12.3: Add `.superpowers/` to `.gitignore`**

Open `.gitignore` and add:

```
.superpowers/
```

- [ ] **Step 12.4: Final commit and push**

```bash
git add .gitignore
git commit -m "chore: ignore .superpowers brainstorm artifacts"
git push
```

---

## Self-Review Checklist

- [x] **Spec §1 (Overview):** Covered by Tasks 9 + 10 (modal + button)
- [x] **Spec §2 (Architecture):** All 8 new files created in Tasks 1–9; DataManagerPage modified in Task 10
- [x] **Spec §3 (Zustand store):** Task 3 — fetch, period, unitFilter, all selectors
- [x] **Spec §4 (Modal layout):** Task 9 — header bar with pills, unit dropdown, PDF, refresh, close; body with KPIs + charts + table
- [x] **Spec §5 (Aggregation):** Tasks 1 + 2 — analyticsUtils.ts with full tests; column indices verified against DataManagerPage COLLECTIONS
- [x] **Spec §6 (Charts):** Tasks 5 + 6 — BarChart and AreaChart with correct axis formatting
- [x] **Spec §7 (PDF 5 pages):** Task 8 — all 5 pages with correct column mappings
- [x] **Spec §8 (Error handling):** Task 9 — yellow warning banner on partial failure; "—" for zero-data cards; PDF button disabled during loading
- [x] **Spec §9 (DataManagerPage +3 lines):** Task 10 — exactly 3 integration points
- [x] **Bug fix:** Task 11 — updateCell silent-success fix
- [x] **No new dependencies:** All libraries already installed
- [x] **Type consistency:** `UnitMetrics`, `KpiTotals`, `WeekPoint`, `Period` defined in `analyticsUtils.ts` and re-exported from `analyticsStore.ts` — all consumers import from one place
