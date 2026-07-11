import { useEffect, useState } from 'react'
import type { Equipment } from '../../types/equipment'
import StatusDot from '../ui/StatusDot'
import UnitDetailModal from './UnitDetailModal'
import { readRange, SHEET_TABS } from '../../lib/sheets-api'
import { openAveriaUnitSet } from '../../lib/averias'
import {
  applyDispatchReadiness,
  buildDispatchReadinessMap,
  normalizeUnitId,
  type UnitDispatchReadiness,
} from '../../lib/dispatch-readiness'

interface FleetGridProps {
  equipment: Equipment[]
}

const STATUS_ORDER: Equipment['status'][] = ['taller', 'alerta', 'operativo', 'inactivo']

interface SelectedUnit {
  unit: Equipment
  readiness?: UnitDispatchReadiness
}

export default function FleetGrid({ equipment }: FleetGridProps) {
  const [selected, setSelected] = useState<SelectedUnit | null>(null)
  const [openAveriaUnits, setOpenAveriaUnits] = useState<Set<string>>(new Set())
  const [dispatchReadiness, setDispatchReadiness] = useState<Map<string, UnitDispatchReadiness>>(new Map())

  useEffect(() => {
    let cancelled = false
    void Promise.allSettled([
      readRange(SHEET_TABS.AVERIAS),
      readRange(SHEET_TABS.INSPECCION_STICKERS),
      readRange(SHEET_TABS.INSPECCIONES),
    ])
      .then(([averiaResult, stickerResult, dvirResult]) => {
        if (cancelled) return
        const averiaRows = averiaResult.status === 'fulfilled' ? averiaResult.value : []
        const stickerRows = stickerResult.status === 'fulfilled' ? stickerResult.value : []
        const dvirRows = dvirResult.status === 'fulfilled' ? dvirResult.value : []
        setOpenAveriaUnits(openAveriaUnitSet(averiaRows))
        setDispatchReadiness(buildDispatchReadinessMap(stickerRows, dvirRows))
      })
      .catch(() => {
        if (!cancelled) {
          setOpenAveriaUnits(new Set())
          setDispatchReadiness(new Map())
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const effectiveEquipment = equipment.map((unit) => {
    const readiness = dispatchReadiness.get(normalizeUnitId(unit.unit_id))
    const withDispatchStatus = applyDispatchReadiness(unit, readiness)
    return openAveriaUnits.has(normalizeUnitId(unit.unit_id))
      ? { ...withDispatchStatus, status: 'taller' as Equipment['status'] }
      : withDispatchStatus
  })

  const sorted = [...effectiveEquipment].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
  )

  return (
    <>
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
              <StatusDot status={unit.status} />
            </div>
            <p className="font-mono text-sm font-semibold text-text leading-tight">{unit.unit_id}</p>
            <p className="text-xs text-text-secondary truncate mt-0.5">{unit.model}</p>
          </button>
          )
        })}
      </div>

      {selected && (
        <UnitDetailModal
          unit={selected.unit}
          dispatchReadiness={selected.readiness}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
