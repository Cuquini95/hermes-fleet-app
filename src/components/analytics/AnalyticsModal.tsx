// src/components/analytics/AnalyticsModal.tsx
import { useEffect } from 'react'
import { useAnalyticsStore } from '../../stores/analyticsStore'
import type { Period } from '../../stores/analyticsStore'
import KpiCards from './KpiCards'
import GastosPorUnidadChart from './GastosPorUnidadChart'
import CombustibleTrendChart from './CombustibleTrendChart'
import UnitSummaryTable from './UnitSummaryTable'
import { generateReport } from './reportGenerator'

interface AnalyticsModalProps {
  open: boolean
  onClose: () => void
}

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Año' },
  { value: 'custom', label: 'Personalizado' },
]

export default function AnalyticsModal({ open, onClose }: AnalyticsModalProps) {
  const store = useAnalyticsStore()
  const { status, fetchErrors, period, unitFilter, raw, dateFrom, dateTo } = store

  // ESC key handler
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Body scroll lock
  useEffect(() => {
    if (open) document.body.classList.add('overflow-hidden')
    else document.body.classList.remove('overflow-hidden')
    return () => document.body.classList.remove('overflow-hidden')
  }, [open])

  if (!open) return null

  const isLoading = status === 'loading'
  const hasNoData =
    raw.gastos.length === 0 &&
    raw.combustible.length === 0 &&
    raw.fletes.length === 0 &&
    raw.averias.length === 0
  const units = store.getUnits()

  function handlePdfClick() {
    const { period: p, unitFilter: uf, dateFrom: df, dateTo: dt, getFilteredRows, getKpiTotals, getUnitMetrics } =
      useAnalyticsStore.getState()
    generateReport(p, uf, getFilteredRows(), getKpiTotals(), getUnitMetrics(), df, dt)
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-[#0f172a] rounded-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-800">
        {/* Header */}
        <div className="sticky top-0 bg-[#0f172a] border-b border-slate-800 z-10">
          <div className="flex items-center gap-4 px-6 py-4">
            {/* Title */}
            <span className="text-lg font-bold text-slate-100 shrink-0">
              📊 Analítica de Flota
            </span>

            {/* Period pills */}
            <div className="flex gap-1">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => useAnalyticsStore.getState().setPeriod(opt.value)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    period === opt.value
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Right controls */}
            <div className="flex items-center gap-2">
              {/* Unit filter dropdown */}
              <select
                value={unitFilter}
                onChange={(e) => store.setUnitFilter(e.target.value)}
                className="bg-slate-800 text-slate-300 border border-slate-700 rounded px-2 py-1 text-sm"
              >
                <option value="all">Todas las unidades</option>
                {units.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>

              {/* PDF button */}
              <button
                onClick={handlePdfClick}
                disabled={isLoading || status === 'error' || hasNoData}
                className="bg-violet-700 hover:bg-violet-600 text-white px-3 py-1 rounded text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                🖨️ PDF
              </button>

              {/* Refresh button */}
              <button
                onClick={() => store.fetch()}
                className="text-slate-400 hover:text-slate-200 px-2 py-1 rounded transition-colors"
                title="Actualizar datos"
              >
                {isLoading ? (
                  <span className="inline-block animate-spin">↻</span>
                ) : (
                  '↻'
                )}
              </button>

              {/* Close button */}
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-200 px-2 py-1 rounded transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
          {period === 'custom' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '8px 20px', borderTop: '1px solid #1e293b', background: '#0f172a' }}>
              <span className="text-xs text-slate-400">Desde</span>
              <input
                type="date"
                value={dateFrom}
                onChange={e => store.setDateRange(e.target.value, dateTo)}
                className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1"
              />
              <span className="text-xs text-slate-400">Hasta</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => store.setDateRange(dateFrom, e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1"
              />
            </div>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-6">
          {/* Error/warning banner */}
          {fetchErrors.length > 0 && (
            <div className="bg-yellow-900/40 border border-yellow-700 text-yellow-300 rounded px-4 py-2 text-sm">
              ⚠️ Algunos datos no pudieron cargarse. Mostrando datos parciales.
            </div>
          )}

          {/* Loading state */}
          {isLoading && hasNoData ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <span className="text-3xl animate-spin mb-3">↻</span>
              <span className="text-sm">Cargando datos...</span>
            </div>
          ) : (
            <>
              {/* KPI row */}
              <KpiCards totals={store.getKpiTotals()} />

              {/* Charts row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-800 rounded-lg p-4">
                  <p className="text-sm font-semibold text-slate-200 mb-3">Gastos por Unidad</p>
                  <GastosPorUnidadChart units={store.getUnitMetrics()} />
                </div>
                <div className="bg-slate-800 rounded-lg p-4">
                  <p className="text-sm font-semibold text-slate-200 mb-3">Combustible por Semana</p>
                  <CombustibleTrendChart data={store.getTrend()} />
                </div>
              </div>

              {/* Summary table */}
              <div className="bg-slate-800 rounded-lg p-4">
                <p className="text-sm font-semibold text-slate-200 mb-3">Resumen por Unidad</p>
                <UnitSummaryTable units={store.getUnitMetrics()} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
