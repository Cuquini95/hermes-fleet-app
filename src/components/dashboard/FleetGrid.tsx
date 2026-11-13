import { useState } from 'react'
import type { Equipment } from '../../types/equipment'
import StatusDot from '../ui/StatusDot'
import UnitDetailModal from './UnitDetailModal'
import { useFleetDispatch, type FleetDispatch } from '../../hooks/useFleetDispatch'
import { normalizeUnitId, type UnitDispatchReadiness } from '../../lib/dispatch-readiness'

interface FleetGridProps {
  equipment: Equipment[]
  dispatch?: FleetDispatch
  selectedUnit?: string
  onClearSelectedUnit?: () => void
}

const STATUS_ORDER: Equipment['status'][] = ['taller', 'alerta', 'operativo', 'inactivo']

interface SelectedUnit {
  unit: Equipment
  readiness?: UnitDispatchReadiness
}

export default function FleetGrid({ equipment, dispatch, selectedUnit, onClearSelectedUnit }: FleetGridProps) {
  const [selected, setSelected] = useState<SelectedUnit | null>(null)
  const fallback = useFleetDispatch(equipment, !dispatch)
  const { effectiveEquipment, readiness: dispatchReadiness, verified, loading, message } = dispatch ?? fallback

  const sorted = [...effectiveEquipment].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
  )

  const linkedUnit = selectedUnit ? sorted.find((unit) => normalizeUnitId(unit.unit_id) === normalizeUnitId(selectedUnit)) : null;
  const active = selected ?? (linkedUnit ? { unit: linkedUnit, readiness: dispatchReadiness.get(normalizeUnitId(linkedUnit.unit_id)) } : null);

  return (
    <>
      {message && <p role="status" className="mb-2 text-sm text-text-secondary">{message}</p>}
      {loading && !verified && !message && <p className="mb-2 text-sm text-text-secondary">Verificando bloqueos…</p>}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {sorted.map((unit) => {
          const readiness = dispatchReadiness.get(normalizeUnitId(unit.unit_id))
          return (
          <button
            key={unit.unit_id}
            type="button"
            onClick={() => setSelected({ unit, readiness })}
            className="relative bg-card rounded-lg p-3 border border-border text-center hover:shadow-md hover:border-blue-300 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            aria-label={`Ver detalle de ${unit.unit_id}`}
          >
            {readiness && readiness.level !== 'ok' && (
              <span className={`absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                readiness.level === 'blocked'
                  ? 'bg-red-100 text-red-700 border border-red-200'
                  : 'bg-amber-100 text-amber-700 border border-amber-200'
              }`}>
                {readiness.level === 'blocked' ? 'Bloq.' : 'Restr.'}
              </span>
            )}
            <div className="flex justify-center mb-1">
              <StatusDot status={!verified && unit.status === 'operativo' ? 'no_verificado' : unit.status} />
            </div>
            <p className="font-mono text-sm font-semibold text-text leading-tight">{unit.unit_id}</p>
            <p className="text-xs text-text-secondary truncate mt-0.5">{unit.model}</p>
          </button>
          )
        })}
      </div>

      {active && (
        <UnitDetailModal
          unit={active.unit}
          dispatchReadiness={active.readiness}
          verified={verified}
          onClose={() => { setSelected(null); onClearSelectedUnit?.(); }}
        />
      )}
    </>
  )
}
