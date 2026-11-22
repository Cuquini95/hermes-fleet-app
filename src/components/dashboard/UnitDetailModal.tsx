/**
 * Modal that opens when a fleet tile is clicked.
 * Shows the unit's current status (from "01 Inventario") plus the latest
 * open averia entry for that unit (from "Averías"), if any.
 */

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { X, AlertCircle, FileText, Clock, User as UserIcon, Wrench } from 'lucide-react'
import { readRange, SHEET_TABS } from '../../lib/sheets-api'
import StatusDot from '../ui/StatusDot'
import type { Equipment } from '../../types/equipment'
import type { OperatingStatus, WorkshopRecord, WorkshopSummary } from '../../hooks/useFleetDispatch'
import { firstPhotoUrl, isOpenAveria, parseAveriaRow, type AveriaEntry } from '../../lib/averias'
import { applyDispatchReadiness, normalizeUnitId, type UnitDispatchReadiness } from '../../lib/dispatch-readiness'
import { useAuthStore } from '../../stores/auth-store'
import PanamaUnitOperations from './PanamaUnitOperations'
import { masterOrderHref } from '../../lib/panama-order-list'

interface UnitDetailModalProps {
  unit: Equipment
  dispatchReadiness?: UnitDispatchReadiness
  verified?: boolean
  operatingOnly?: boolean
  operatingStatus?: OperatingStatus
  workshop?: WorkshopSummary
  workshopRestriction?: UnitDispatchReadiness
  onClose: () => void
}

const STATUS_LABEL: Record<Equipment['status'], string> = {
  operativo: 'Operativo',
  alerta: 'En traslado / alerta',
  taller: 'En taller / reparación',
  inactivo: 'Inactivo',
  no_verificado: 'Por verificar',
}

const SEV_BADGE: Record<string, string> = {
  CRITICA: 'bg-red-100 text-red-700 border-red-200',
  ALTA: 'bg-red-100 text-red-700 border-red-200',
  MEDIA: 'bg-amber-100 text-amber-700 border-amber-200',
  BAJA: 'bg-yellow-100 text-yellow-700 border-yellow-200',
}

const panamaCut = new Intl.DateTimeFormat('es-PA', {
  timeZone: 'America/Panama', dateStyle: 'medium', timeStyle: 'short',
})

export default function UnitDetailModal({ unit, dispatchReadiness, verified = true, operatingOnly = false, operatingStatus, workshop, workshopRestriction, onClose }: UnitDetailModalProps) {
  const isPanama = useAuthStore(state => state.project === 'tmf-panama')
  const role = useAuthStore(state => state.role)
  const userId = useAuthStore(state => state.userId)
  const canSeeOperations = isPanama && ['jefe_taller', 'coordinador', 'supervisor', 'gerencia'].includes(role ?? '')
  const [averias, setAverias] = useState<AveriaEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const refreshedFailures = workshop?.failures

  useEffect(() => {
    if (!isPanama) return;
    const opener = document.activeElement;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('keydown', close);
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [isPanama, onClose]);

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const rows = await readRange(SHEET_TABS.AVERIAS)
        const matches = rows
          .filter((r) => (r[2] ?? '').trim().toUpperCase() === unit.unit_id.toUpperCase())
          .map(parseAveriaRow)
          .filter((a): a is AveriaEntry => a !== null)
        if (!cancelled) {
          setError(null)
          setAverias(matches)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [unit.unit_id, refreshedFailures])

  const open = averias?.filter(isOpenAveria) ?? []
  const closed = averias?.filter((a) => !isOpenAveria(a)) ?? []
  const unitId = normalizeUnitId(unit.unit_id)
  const workshopFailures = workshop?.failures.records.filter(record => normalizeUnitId(record.unit) === unitId) ?? []
  const workshopOrders = workshop?.orders.records.filter(record => normalizeUnitId(record.unit) === unitId) ?? []
  const linkedFailures = new Map((averias ?? []).filter(row => row.ot_id.trim())
    .map(row => [row.ot_id.trim().toUpperCase(), row]))
  const reconciledLinks = new Set(workshopFailures.flatMap(row => [row.id, row.order ?? '']).filter(Boolean))
  const unlinkedReport = (row: AveriaEntry) => !reconciledLinks.has(row.ot_id.trim().toUpperCase())
  const localOpen = open.filter(unlinkedReport)
  const localClosed = closed.filter(unlinkedReport)
  const workshopIncomplete = (operatingOnly || !!workshop) && (!workshop || !workshop.failures.masterAvailable || !workshop.orders.masterAvailable
    || !workshop.failures.operationalAvailable || !workshop.orders.operationalAvailable)
  const status = applyDispatchReadiness(unit, dispatchReadiness).status
  const effectiveStatus = !verified && open.length > 0 && status !== 'inactivo'
    ? 'taller'
    : !verified && status === 'operativo' ? 'no_verificado' : status

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de ${unit.unit_id}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div className="flex min-w-0 items-center gap-3">
            {operatingOnly ? operatingStatus && <StatusDot status={operatingStatus === 'operativo' ? 'operativo' : 'taller'} />
              : <StatusDot status={effectiveStatus} />}
            <div className="min-w-0 break-words">
              <h2 className="text-lg font-bold text-gray-900 font-mono">{unit.unit_id}</h2>
              <p className="text-sm text-gray-500">{unit.model}</p>
              {isPanama && <p className="mt-1 text-xs text-gray-500">Serie / PIN: {unit.serial || 'Por verificar'}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Status */}
        {(!operatingOnly || operatingStatus) && <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 text-sm">
          <Wrench size={16} className="text-gray-500" />
          <span className="font-semibold text-gray-700">Estado:</span>
          <span className="text-gray-900">{operatingOnly ? operatingStatus === 'operativo' ? 'Operativo' : 'Inoperativo' : STATUS_LABEL[effectiveStatus]}</span>
          {dispatchReadiness && dispatchReadiness.level !== 'ok' && (
            <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold border ${
              dispatchReadiness.level === 'blocked'
                ? 'bg-red-50 text-red-700 border-red-100'
                : 'bg-amber-50 text-amber-700 border-amber-100'
            }`}>
              {dispatchReadiness.label}
            </span>
          )}
          {open.length > 0 && unit.status === 'operativo' && (
            <span className={`${dispatchReadiness && dispatchReadiness.level !== 'ok' ? '' : 'ml-auto'} rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 border border-red-100`}>
              Averia abierta
            </span>
          )}
        </div>}

        {/* Body */}
        <div className="p-5">
          {isPanama && <nav aria-label="Acciones relacionadas del equipo" className="mb-4 flex flex-wrap gap-2">
            <Link to={`/falla?unit=${encodeURIComponent(unit.unit_id)}`}
              className="inline-flex min-h-11 items-center rounded-lg border border-gray-200 px-3 text-sm font-semibold text-gray-900">
              Reportar falla
            </Link>
            <Link to={`/sticker-inspection?unit=${encodeURIComponent(unit.unit_id)}`}
              className="inline-flex min-h-11 items-center rounded-lg border border-gray-200 px-3 text-sm font-semibold text-gray-900">
              Inspección HSE
            </Link>
            {canSeeOperations && <Link to={`/neumaticos?unit=${encodeURIComponent(unit.unit_id)}`}
              className="inline-flex min-h-11 items-center rounded-lg border border-gray-200 px-3 text-sm font-semibold text-gray-900">
              Llantas por posición
            </Link>}
            {['supervisor', 'coordinador', 'gerencia'].includes(role ?? '') &&
              <Link to={`/panama/turnos?${new URLSearchParams({ unit: unit.unit_id, estado: 'aceptados' })}`}
                className="inline-flex min-h-11 items-center rounded-lg border border-gray-200 px-3 text-sm font-semibold text-gray-900">
                Partes aceptados
              </Link>}
          </nav>}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 mb-4">
              {isPanama ? (
                <>
                  <p>No se pudieron cargar las averías. Vuelve a abrir el equipo para reintentar.</p>
                  <details className="mt-1 break-words text-xs">
                    <summary className="cursor-pointer">Detalle del error</summary>
                    <p>{error}</p>
                  </details>
                </>
              ) : <>No se pudo cargar la información de averías: {error}</>}
            </div>
          )}

          {dispatchReadiness && dispatchReadiness.level !== 'ok' && (
            <div className={`rounded-lg border px-4 py-3 text-sm mb-4 ${
              dispatchReadiness.level === 'blocked'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <p className="font-semibold">
                {dispatchReadiness.level === 'blocked' ? 'No despachar' : 'Despacho restringido'}
              </p>
              <p className="mt-1">{dispatchReadiness.reason}</p>
              {dispatchReadiness.expiresOn && (
                <p className="mt-1 text-xs opacity-80">Vigencia: {dispatchReadiness.expiresOn}</p>
              )}
            </div>
          )}

          {!error && averias === null && (
            <p className="text-sm text-gray-500">Cargando reporte de averías…</p>
          )}

          {workshopRestriction && workshopRestriction.level !== 'ok' && (
            <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${workshopRestriction.level === 'blocked'
              ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              <p className="font-semibold">Restricción registrada</p>
              <p>{workshopRestriction.reason}</p>
            </div>
          )}
          {canSeeOperations && <PanamaUnitOperations key={JSON.stringify([userId, role, unitId])}
            unit={unit.unit_id.trim().toUpperCase()} showFinancials={role === 'gerencia'} />}
          {workshopIncomplete && (
            <p className="mb-4 text-sm text-amber-800">{isPanama ? 'Historial de Taller incompleto.' : 'Historial de Taller incompleto. Parte de la información no está disponible.'}</p>
          )}
          <WorkshopHistory label="Averías en Taller" records={workshopFailures.filter(row => row.id || !averias?.length)}
            unit={unit.unit_id} cut={workshop?.failures.capturedAt} linkedFailures={linkedFailures} />
          <WorkshopHistory label="Órdenes de trabajo" records={workshopOrders} unit={unit.unit_id} cut={workshop?.orders.capturedAt} />

          {!error && averias !== null && open.length === 0 && closed.length === 0
            && !workshopIncomplete && !workshopFailures.length && !workshopOrders.length && (
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600 flex items-start gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-gray-400" />
              <div>
                <p className="font-medium">{dispatchReadiness?.source === 'averia'
                  ? 'El detalle de la avería pendiente requiere conciliación'
                  : 'Sin reporte de avería registrado'}</p>
                {!operatingOnly && unit.status !== 'operativo' && dispatchReadiness?.source !== 'averia' && (
                  <p className="text-xs text-gray-500 mt-1">
                    {isPanama ? <>Inventario · <strong>{STATUS_LABEL[unit.status] ?? unit.status}</strong></> : <>
                      El estado en "01 Inventario" indica{' '}
                      <strong>{(STATUS_LABEL[unit.status] ?? unit.status).toLowerCase()}</strong> pero
                      no hay un registro asociado en la pestaña <code>Averías</code>.
                    </>}
                  </p>
                )}
              </div>
            </div>
          )}

          {localOpen.length > 0 && (
            <>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-red-700 mb-2">
                Averías abiertas ({localOpen.length})
              </h3>
              <div className="space-y-3 mb-4">
                {localOpen.map((a, i) => (
                  <AveriaCard key={`open-${i}`} averia={a} />
                ))}
              </div>
            </>
          )}

          {localClosed.length > 0 && (
            <>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                Histórico ({closed.length})
              </h3>
              <div className="space-y-3">
                {localClosed.slice(0, 5).map((a, i) => (
                  <AveriaCard key={`closed-${i}`} averia={a} muted />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function WorkshopHistory({ label, records, unit, cut, linkedFailures }: {
  label: string
  records: WorkshopRecord[]
  unit: string
  cut?: string | null
  linkedFailures?: ReadonlyMap<string, AveriaEntry>
}) {
  if (!records.length) return null
  return (
    <section aria-label={label} className="mb-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</h3>
      {cut && Number.isFinite(Date.parse(cut)) && <details className="mb-2 text-xs text-gray-600">
        <summary className="cursor-pointer">Corte del Maestro</summary>
        <p><time dateTime={cut}>{panamaCut.format(new Date(cut))}</time> · Panamá</p>
      </details>}
      <ul className="space-y-2">
        {records.map((record, index) => {
          const detail = linkedFailures?.get(record.order || record.id)
          return (
          <li key={`${record.source}-${record.id}-${index}`} className="rounded-lg border border-gray-200 px-3 py-2 text-sm break-words">
            {record.id && <p className="font-semibold text-gray-900">{record.id}</p>}
            <p className="text-gray-600">{record.source === 'master' ? 'Maestro de Taller' : 'Hermes'} · {record.status || 'Estado sin verificar'}</p>
            {record.date && <p className="text-gray-600">{record.date}</p>}
            {record.order && record.order !== record.id && <p className="text-gray-600">OT vinculada: {record.order}</p>}
            {record.description && <p className="text-gray-700">{record.description}</p>}
            {label === 'Órdenes de trabajo' && record.source === 'master' && /cerrad/i.test(record.status ?? '') && (
              <p className="text-xs text-amber-800">Estado cerrado según Maestro; la fecha de cierre debe verificarse en el expediente.</p>
            )}
            {label === 'Órdenes de trabajo' && record.id && <Link
              className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-blue-800 underline"
              to={masterOrderHref(unit, record.id)}>Abrir OT y comprobar cierre</Link>}
            {record.needsReview && <p className="text-amber-800">
              Por conciliar{record.operationalStatus !== undefined ? ` · Hermes: ${record.operationalStatus || 'Estado sin verificar'}` : ''}
            </p>}
            {detail && <div className="mt-2"><AveriaCard averia={detail} muted hideStatus /></div>}
          </li>
          )
        })}
      </ul>
    </section>
  )
}

interface AveriaCardProps {
  averia: AveriaEntry
  muted?: boolean
  hideStatus?: boolean
}

function AveriaCard({ averia, muted, hideStatus }: AveriaCardProps) {
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
        {!hideStatus && averia.estado && (
          <span className={`inline-flex items-center gap-1 font-medium ${isOpenAveria(averia) ? 'text-red-700' : 'text-gray-500'}`}>
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
