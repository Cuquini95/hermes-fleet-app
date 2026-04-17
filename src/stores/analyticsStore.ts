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
  isInDateRange,
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
  unitFilter: string[]  // empty = all units; otherwise an array of selected unit names
  dateFrom: string      // 'YYYY-MM-DD' or '' when not set
  dateTo: string        // 'YYYY-MM-DD' or '' when not set

  // actions
  fetch: () => Promise<void>
  setPeriod: (p: Period) => void
  setUnitFilter: (u: string[]) => void
  setDateRange: (from: string, to: string) => void

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
  unitFilter: [],
  dateFrom: '',
  dateTo: '',

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
      lastFetched: new Date(), // records last attempt time (not last successful fetch)
      fetchErrors: errors,
    })
  },

  setPeriod: (p) => set({ period: p, ...(p !== 'custom' ? { dateFrom: '', dateTo: '' } : {}) }),
  setUnitFilter: (unitFilter: string[]) => set({ unitFilter }),
  setDateRange: (from, to) => set({ dateFrom: from, dateTo: to, period: 'custom' }),

  getFilteredRows: () => {
    const { raw, period, unitFilter, dateFrom, dateTo } = get()

    const filterRow = (dateColIndex: number, unitColIndex: number) => (row: string[]) => {
      // Period/date filter
      const inPeriod = period === 'custom'
        ? isInDateRange(row, dateColIndex, dateFrom, dateTo)
        : isInPeriod(row, period)
      if (!inPeriod) return false
      // Unit filter — empty array means "all units"
      if (unitFilter.length > 0) {
        if (!unitFilter.includes((row[unitColIndex] ?? '').trim())) return false
      }
      return true
    }

    return {
      gastos:      raw.gastos.filter(filterRow(0, 10)),
      combustible: raw.combustible.filter(filterRow(0, 3)),
      fletes:      raw.fletes.filter(filterRow(0, 2)),
      averias:     raw.averias.filter(filterRow(0, 2)),
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
