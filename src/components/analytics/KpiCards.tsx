// src/components/analytics/KpiCards.tsx
import type { KpiTotals } from './analyticsUtils'
import { formatPeso, formatLitros } from './analyticsUtils'

interface KpiCardsProps {
  totals: KpiTotals
}

interface CardProps {
  label: string
  value: string
  accent: string
  sub?: string
}

function KpiCard({ label, value, accent, sub }: CardProps) {
  return (
    <div className={`bg-[#1e293b] rounded-xl p-4 border-l-4 ${accent}`}>
      <p className="text-[10px] text-[#64748b] uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xl font-bold text-[#f1f5f9]">{value}</p>
      {sub && (
        <p className="text-[11px] text-[#94a3b8] mt-0.5">{sub}</p>
      )}
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
        sub={totals.fletesAmount > 0 ? formatPeso(totals.fletesAmount) : undefined}
      />
      <KpiCard
        label="🔧 Averías"
        value={totals.averiasCount > 0 ? `${totals.averiasCount} eventos` : '—'}
        accent="border-[#f87171]"
      />
    </div>
  )
}
