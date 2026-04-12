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
