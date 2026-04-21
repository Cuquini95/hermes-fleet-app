import { useState } from 'react'
import type { Equipment } from '../../types/equipment'
import StatusDot from '../ui/StatusDot'
import UnitDetailModal from './UnitDetailModal'

interface FleetGridProps {
  equipment: Equipment[]
}

const STATUS_ORDER: Equipment['status'][] = ['taller', 'alerta', 'operativo', 'inactivo']

export default function FleetGrid({ equipment }: FleetGridProps) {
  const [selected, setSelected] = useState<Equipment | null>(null)

  const sorted = [...equipment].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
  )

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {sorted.map((unit) => (
          <button
            key={unit.unit_id}
            type="button"
            onClick={() => setSelected(unit)}
            className="bg-card rounded-lg p-3 border border-border text-center hover:shadow-md hover:border-blue-300 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            aria-label={`Ver detalle de ${unit.unit_id}`}
          >
            <div className="flex justify-center mb-1">
              <StatusDot status={unit.status} />
            </div>
            <p className="font-mono text-sm font-semibold text-text leading-tight">{unit.unit_id}</p>
            <p className="text-xs text-text-secondary truncate mt-0.5">{unit.model}</p>
          </button>
        ))}
      </div>

      {selected && (
        <UnitDetailModal unit={selected} onClose={() => setSelected(null)} />
      )}
    </>
  )
}
