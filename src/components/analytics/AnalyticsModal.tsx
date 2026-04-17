// src/components/analytics/AnalyticsModal.tsx
import { useEffect, useState, useRef } from 'react'
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
  const [unitsOpen, setUnitsOpen] = useState(false)
  const unitDropdownRef = useRef<HTMLDivElement>(null)
  const [sections, setSections] = useState({
    gastos: true,
    combustible: true,
    fletes: true,
    averias: true,
  })

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

  // Close unit dropdown when clicking outside
  useEffect(() => {
    if (!unitsOpen) return
    function handleClick(e: MouseEvent) {
      if (unitDropdownRef.current && !unitDropdownRef.current.contains(e.target as Node)) {
        setUnitsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [unitsOpen])

  if (!open) return null

  const isLoading = status === 'loading'
  const hasNoData =
    raw.gastos.length === 0 &&
    raw.combustible.length === 0 &&
    raw.fletes.length === 0 &&
    raw.averias.length === 0
  const units = store.getUnits()

  function toggleUnit(unit: string) {
    const current = unitFilter
    if (current.includes(unit)) {
      store.setUnitFilter(current.filter((u) => u !== unit))
    } else {
      store.setUnitFilter([...current, unit])
    }
  }

  const unitLabel =
    unitFilter.length === 0
      ? 'Todas las unidades'
      : unitFilter.length <= 2
        ? unitFilter.join(', ')
        : `${unitFilter[0]}, ${unitFilter[1]} +${unitFilter.length - 2}`

  function handlePdfClick() {
    const { period: p, unitFilter: uf, dateFrom: df, dateTo: dt, getFilteredRows, getKpiTotals, getUnitMetrics } =
      useAnalyticsStore.getState()
    const unitLabel = uf.length === 0 ? 'all' : uf.join(', ')
    generateReport(p, unitLabel, getFilteredRows(), getKpiTotals(), getUnitMetrics(), df, dt).catch(console.error)
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
          {/* Row 1: Title + right controls */}
          <div className="flex items-center gap-2 px-4 py-3">
            <span className="text-base font-bold text-slate-100 shrink-0">
              📊 Analítica
            </span>
            <div className="flex-1" />
            {/* Multi-unit filter */}
            <div ref={unitDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setUnitsOpen((o) => !o)}
                className="bg-slate-800 text-slate-300 border border-slate-700 rounded px-2 py-1 text-xs max-w-[160px] truncate flex items-center gap-1"
              >
                <span className="truncate">{unitLabel}</span>
                <span className="text-slate-500 shrink-0">▾</span>
              </button>
              {unitsOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
                  {/* All / None quick actions */}
                  <div className="flex border-b border-slate-700">
                    <button
                      type="button"
                      onClick={() => store.setUnitFilter([])}
                      className="flex-1 text-xs text-slate-400 hover:text-white py-1.5 hover:bg-slate-800 transition-colors"
                    >
                      Todas
                    </button>
                    <button
                      type="button"
                      onClick={() => store.setUnitFilter([...units])}
                      className="flex-1 text-xs text-slate-400 hover:text-white py-1.5 hover:bg-slate-800 transition-colors border-l border-slate-700"
                    >
                      Ninguna
                    </button>
                  </div>
                  {/* Unit checkboxes */}
                  <div className="max-h-48 overflow-y-auto">
                    {units.map((u) => (
                      <label
                        key={u}
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={unitFilter.length === 0 || unitFilter.includes(u)}
                          onChange={() => {
                            // If currently "all", clicking one unit deselects all others
                            if (unitFilter.length === 0) {
                              store.setUnitFilter(units.filter((x) => x !== u))
                            } else {
                              toggleUnit(u)
                            }
                          }}
                          className="accent-violet-500 shrink-0"
                        />
                        <span className="text-xs text-slate-300">{u}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {/* PDF button */}
            <button
              onClick={handlePdfClick}
              disabled={isLoading || status === 'error' || hasNoData}
              aria-label="Generar reporte PDF"
              className="bg-violet-700 hover:bg-violet-600 text-white px-2 py-1 rounded text-xs font-semibold disabled:opacity-50 transition-colors shrink-0"
            >
              🖨️ PDF
            </button>
            {/* Refresh */}
            <button
              onClick={() => store.fetch()}
              className="text-slate-400 hover:text-slate-200 px-1.5 py-1 rounded transition-colors shrink-0"
              title="Actualizar datos"
              aria-label="Actualizar datos"
            >
              {isLoading ? <span className="inline-block animate-spin" aria-hidden="true">↻</span> : <span aria-hidden="true">↻</span>}
            </button>
            {/* Close */}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 px-1.5 py-1 rounded transition-colors shrink-0"
              title="Cerrar"
              aria-label="Cerrar analítica"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>

          {/* Row 2: Period pills */}
          <div className="flex gap-1 px-4 pb-2 overflow-x-auto no-scrollbar">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => useAnalyticsStore.getState().setPeriod(opt.value)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  period === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Row 3: Custom date range */}
          {period === 'custom' && (
            <div className="flex flex-wrap gap-2 items-center px-4 pb-3 border-t border-slate-800 pt-2">
              <span className="text-xs text-slate-400">Desde</span>
              <input
                type="date"
                value={dateFrom}
                onChange={e => store.setDateRange(e.target.value, dateTo)}
                className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1 flex-1 min-w-0"
              />
              <span className="text-xs text-slate-400">Hasta</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => store.setDateRange(dateFrom, e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1 flex-1 min-w-0"
              />
            </div>
          )}

          {/* Row 4: PDF section toggles */}
          <div className="flex flex-wrap items-center gap-1.5 px-4 pb-2.5 border-t border-slate-800 pt-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-wide shrink-0 mr-1">PDF incluye:</span>
            {(
              [
                { key: 'gastos',      label: 'Gastos',      color: 'bg-blue-600/20 text-blue-300 border-blue-700'    },
                { key: 'combustible', label: 'Combustible', color: 'bg-green-600/20 text-green-300 border-green-700' },
                { key: 'fletes',      label: 'Fletes',      color: 'bg-orange-600/20 text-orange-300 border-orange-700' },
                { key: 'averias',     label: 'Averías',     color: 'bg-red-600/20 text-red-300 border-red-700'       },
              ] as const
            ).map(({ key, label, color }) => {
              const active = sections[key]
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSections((s) => ({ ...s, [key]: !s[key] }))}
                  className={`px-2 py-0.5 rounded border text-[11px] font-medium transition-all ${
                    active
                      ? color
                      : 'bg-transparent text-slate-600 border-slate-700 line-through'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
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
