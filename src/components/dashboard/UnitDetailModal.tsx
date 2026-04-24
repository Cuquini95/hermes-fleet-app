/**
 * Modal that opens when a fleet tile is clicked.
 * Shows the unit's current status (from "01 Inventario") plus the latest
 * open averia entry for that unit (from "Averías"), if any.
 */

import { useEffect, useState } from 'react'
import { X, AlertCircle, FileText, Clock, User as UserIcon, Wrench } from 'lucide-react'
import { readRange, SHEET_TABS } from '../../lib/sheets-api'
import StatusDot from '../ui/StatusDot'
import type { Equipment } from '../../types/equipment'
import { firstPhotoUrl, isOpenAveria, parseAveriaRow, type AveriaEntry } from '../../lib/averias'

interface UnitDetailModalProps {
  unit: Equipment
  onClose: () => void
}

const STATUS_LABEL: Record<Equipment['status'], string> = {
  operativo: 'Operativo',
  alerta: 'En traslado / alerta',
  taller: 'En taller / reparación',
  inactivo: 'Inactivo',
}

const SEV_BADGE: Record<string, string> = {
  CRITICA: 'bg-red-100 text-red-700 border-red-200',
  ALTA: 'bg-red-100 text-red-700 border-red-200',
  MEDIA: 'bg-amber-100 text-amber-700 border-amber-200',
  BAJA: 'bg-yellow-100 text-yellow-700 border-yellow-200',
}

export default function UnitDetailModal({ unit, onClose }: UnitDetailModalProps) {
  const [averias, setAverias] = useState<AveriaEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const rows = await readRange(SHEET_TABS.AVERIAS)
        // Header rows: 0 (title), 1 (legend), 2 (column names) — data starts at row 3
        const matches = rows
          .slice(3)
          .filter((r) => (r[2] ?? '').trim().toUpperCase() === unit.unit_id.toUpperCase())
          .map(parseAveriaRow)
          .filter((a): a is AveriaEntry => a !== null)
        if (!cancelled) setAverias(matches)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [unit.unit_id])

  const open = averias?.filter(isOpenAveria) ?? []
  const closed = averias?.filter((a) => !isOpenAveria(a)) ?? []
  const effectiveStatus: Equipment['status'] = open.length > 0 ? 'taller' : unit.status

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <StatusDot status={effectiveStatus} />
            <div>
              <h2 className="text-lg font-bold text-gray-900 font-mono">{unit.unit_id}</h2>
              <p className="text-sm text-gray-500">{unit.model}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Status */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 text-sm">
          <Wrench size={16} className="text-gray-500" />
          <span className="font-semibold text-gray-700">Estado:</span>
          <span className="text-gray-900">{STATUS_LABEL[effectiveStatus]}</span>
          {open.length > 0 && unit.status === 'operativo' && (
            <span className="ml-auto rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 border border-red-100">
              Averia abierta
            </span>
          )}
        </div>

        {/* Body */}
        <div className="p-5">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 mb-4">
              No se pudo cargar la información de averías: {error}
            </div>
          )}

          {!error && averias === null && (
            <p className="text-sm text-gray-500">Cargando reporte de averías…</p>
          )}

          {!error && averias !== null && open.length === 0 && closed.length === 0 && (
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600 flex items-start gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-gray-400" />
              <div>
                <p className="font-medium">Sin reporte de avería registrado</p>
                {unit.status !== 'operativo' && (
                  <p className="text-xs text-gray-500 mt-1">
                    El estado en "01 Inventario" indica{' '}
                    <strong>{(STATUS_LABEL[unit.status] ?? unit.status).toLowerCase()}</strong> pero
                    no hay un registro asociado en la pestaña <code>Averías</code>.
                  </p>
                )}
              </div>
            </div>
          )}

          {open.length > 0 && (
            <>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-red-700 mb-2">
                Averías abiertas ({open.length})
              </h3>
              <div className="space-y-3 mb-4">
                {open.map((a, i) => (
                  <AveriaCard key={`open-${i}`} averia={a} />
                ))}
              </div>
            </>
          )}

          {closed.length > 0 && (
            <>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                Histórico ({closed.length})
              </h3>
              <div className="space-y-3">
                {closed.slice(0, 5).map((a, i) => (
                  <AveriaCard key={`closed-${i}`} averia={a} muted />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

interface AveriaCardProps {
  averia: AveriaEntry
  muted?: boolean
}

function AveriaCard({ averia, muted }: AveriaCardProps) {
  const sevClass =
    SEV_BADGE[averia.severidad] ?? 'bg-gray-100 text-gray-600 border-gray-200'
  const photoUrl = firstPhotoUrl(averia.foto_url)
  const [photoOpen, setPhotoOpen] = useState(false)

  useEffect(() => {
    if (!photoOpen) return undefined

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPhotoOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [photoOpen])

  return (
    <div
      className={`rounded-lg border p-3 ${muted ? 'border-gray-200 bg-gray-50' : 'border-red-200 bg-red-50'}`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Clock size={12} />
          <span>{averia.fecha}{averia.hora ? ` · ${averia.hora}` : ''}</span>
        </div>
        {averia.severidad && (
          <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${sevClass}`}>
            {averia.severidad}
          </span>
        )}
      </div>

      {averia.tipo && (
        <p className="text-xs font-semibold text-gray-700 mb-0.5">{averia.tipo}</p>
      )}
      {averia.descripcion && (
        <p className="text-sm text-gray-900 mb-2">{averia.descripcion}</p>
      )}

      {photoUrl && (
        <>
          <button
            type="button"
            onClick={() => setPhotoOpen(true)}
            className="mb-2 block rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 cursor-zoom-in"
            aria-label={`Ampliar foto averia ${averia.unidad}`}
          >
            <img
              src={photoUrl}
              alt={`Foto averia ${averia.unidad}`}
              className="h-28 w-28 rounded-lg object-cover"
              loading="lazy"
            />
          </button>

          {photoOpen && (
            <div
              className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-3 sm:p-6"
              role="dialog"
              aria-modal="true"
              onClick={() => setPhotoOpen(false)}
            >
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  setPhotoOpen(false)
                }}
                className="absolute right-4 top-4 rounded-full bg-white/95 p-2 text-gray-700 shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                aria-label="Cerrar foto"
              >
                <X size={22} />
              </button>
              <img
                src={photoUrl}
                alt={`Foto averia ${averia.unidad}`}
                className="max-h-[88vh] max-w-[96vw] rounded-xl object-contain shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              />
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-3 text-xs text-gray-600">
        {averia.tecnico && (
          <span className="inline-flex items-center gap-1">
            <UserIcon size={11} /> {averia.tecnico}
          </span>
        )}
        {averia.tiempo_paro && (
          <span className="inline-flex items-center gap-1">
            <Clock size={11} /> {averia.tiempo_paro}
          </span>
        )}
        {averia.estado && (
          <span className={`inline-flex items-center gap-1 font-medium ${averia.estado.toLowerCase() === 'abierta' ? 'text-red-700' : 'text-gray-500'}`}>
            <FileText size={11} /> {averia.estado}
          </span>
        )}
        {averia.ot_id && (
          <span className="inline-flex items-center gap-1 font-mono text-gray-500">
            OT: {averia.ot_id}
          </span>
        )}
      </div>

      {averia.observaciones && (
        <p className="text-xs text-gray-500 mt-2 italic">{averia.observaciones}</p>
      )}
    </div>
  )
}
