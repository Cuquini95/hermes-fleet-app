// src/components/analytics/analyticsUtils.ts

// ── Month sort helpers ────────────────────────────────────────────────────────

const MONTH_ORDER = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function sortTrendKeys(a: string, b: string): number {
  // Week keys like "S1", "S2" — sort numerically
  if (a.startsWith('S') && b.startsWith('S')) {
    return parseInt(a.slice(1)) - parseInt(b.slice(1))
  }
  // Month abbreviations — sort by calendar order
  const ai = MONTH_ORDER.indexOf(a)
  const bi = MONTH_ORDER.indexOf(b)
  if (ai !== -1 && bi !== -1) return ai - bi
  return a.localeCompare(b, 'es-MX', { numeric: true })
}

// ── Column indices (match DataManagerPage COLLECTIONS order) ─────────────────
// Gastos  ('Gastos'):              Fecha=0, Total=9, Unidad=10
// Combustible ('Combustible'):     Fecha=0, Unidad=3, Litros=6, Costo=7
// Fletes  ('Reporte_Fletes_Transporte'): Fecha=0, Unidad=2, KM_Total=8, Tonelaje=11, Flete=12
// Averias ('Averías'):             Fecha=0, Unidad=2, Descripcion=4, Status=7

export type Period = 'week' | 'month' | 'year' | 'custom'

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
export function getPeriodCutoff(period: Exclude<Period, 'custom'>): Date {
  const days = period === 'week' ? 7 : period === 'month' ? 30 : 365
  return new Date(Date.now() - days * 86_400_000)
}

/** Return true if a row's Fecha (col 0) falls within the period. */
export function isInPeriod(row: string[], period: Exclude<Period, 'custom'>): boolean {
  const d = parseSheetDate(row[0] ?? '')
  if (!d) return false
  return d >= getPeriodCutoff(period)
}

/** Return true if a row's date column falls within the given date range. */
export function isInDateRange(row: string[], dateCol: number, from: string, to: string): boolean {
  const raw = (row[dateCol] ?? '').trim()
  if (!raw) return false
  const d = parseSheetDate(raw)
  if (!d) return false
  const fromDate = from ? new Date(from + 'T00:00:00') : null
  const toDate = to ? new Date(to + 'T23:59:59') : null
  if (fromDate && d < fromDate) return false
  if (toDate && d > toDate) return false
  return true
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
    if (!unit || !isRealUnit(unit)) continue
    getOrCreate(unit).gastos += parseCurrency(row[9] ?? '')
  }

  for (const row of combustible) {
    const unit = (row[3] ?? '').trim()
    if (!unit || !isRealUnit(unit)) continue
    const m = getOrCreate(unit)
    m.combustibleLitros += parseNum(row[6] ?? '')
    m.combustibleCosto += parseCurrency(row[7] ?? '')
  }

  for (const row of fletes) {
    const unit = (row[2] ?? '').trim()
    if (!unit || !isRealUnit(unit)) continue
    const m = getOrCreate(unit)
    m.fletes += 1
    m.tonelaje += parseNum(row[11] ?? '')
  }

  for (const row of averias) {
    const unit = (row[2] ?? '').trim()
    if (!unit || !isRealUnit(unit)) continue
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
      const raw = d.toLocaleString('es-MX', { month: 'short', timeZone: 'UTC' })
      key = raw.charAt(0).toUpperCase() + raw.slice(1)
    } else if (period === 'custom') {
      // For custom range, group by month like year view
      const raw = d.toLocaleString('es-MX', { month: 'short', timeZone: 'UTC' })
      key = raw.charAt(0).toUpperCase() + raw.slice(1)
    } else {
      // Relative week index from window start
      const cutoff = getPeriodCutoff(period)
      const weekIndex = Math.floor((d.getTime() - cutoff.getTime()) / (7 * 86_400_000))
      key = `S${weekIndex + 1}`
    }

    buckets.set(key, (buckets.get(key) ?? 0) + litros)
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => sortTrendKeys(a, b))
    .map(([label, litros]) => ({ label, litros }))
    .slice(-12) // last 12 buckets max
}

/** Pattern matching test/dev unit names that should be excluded from analytics. */
const TEST_UNIT_PATTERN = /^(test|fallback|fixtest|livetest)/i

/** Returns true if the unit name is a real fleet unit (not a test/dev artifact). */
export function isRealUnit(unit: string): boolean {
  return !TEST_UNIT_PATTERN.test(unit)
}

/** Extract sorted unique unit names from all collections, excluding test/dev units. */
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
  return Array.from(units).filter(isRealUnit).sort()
}

/** Format a peso amount for display: "$1,234,567" */
export function formatPeso(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-MX')
}

/** Format liters: "8,420 L" */
export function formatLitros(n: number): string {
  return Math.round(n).toLocaleString('es-MX') + ' L'
}
