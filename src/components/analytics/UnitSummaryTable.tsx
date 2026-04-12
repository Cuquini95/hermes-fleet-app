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
      combustibleCosto: acc.combustibleCosto + u.combustibleCosto,
      fletes: acc.fletes + u.fletes,
      averias: acc.averias + u.averias,
    }),
    { gastos: 0, combustibleLitros: 0, combustibleCosto: 0, fletes: 0, averias: 0 }
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
              <th className="text-right py-2 px-3 font-medium">Total</th>
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
                <td className="py-2 px-3 text-right text-[#f1f5f9]">
                  {formatPeso(u.gastos + u.combustibleCosto)}
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
              <td className="py-2 px-3 text-right text-[#f1f5f9]">{formatPeso(totals.gastos + totals.combustibleCosto)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
