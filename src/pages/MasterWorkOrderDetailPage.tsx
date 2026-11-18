import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';
import { useWorkOrderStore } from '../stores/workorder-store';
import { useEquipmentById } from '../hooks/useEquipmentList';
import { masterOrderForReference, masterOrderNotes, nativeOrderForReference, readPanamaOrderMaster, type MasterOrder } from '../lib/panama-order-list';
import { visibleWorkOrderFolio } from '../lib/purchasing-api';
import { OrderDetailHeader, OrderDetailInformation, OrderDetailLayout, OrderDetailStatus, OrderDetailStatusBadge } from '../components/workshop/OrderDetailLayout';

const buttonClass = 'inline-flex min-h-11 items-center rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-text disabled:opacity-50';
const key = (value: string) => value.trim().toUpperCase();
const displayCut = (value: string) => new Date(value).toLocaleString('es-PA', { timeZone: 'America/Panama', dateStyle: 'short', timeStyle: 'short' });

export default function MasterWorkOrderDetailPage() {
  const { unit = '' } = useParams<{ unit: string }>();
  const [query] = useSearchParams();
  const reference = query.get('ref') ?? '';
  const project = useAuthStore(state => state.project);
  const scope = useAuthStore(state => JSON.stringify([state.userId, state.project, state.role, state.allUnits, state.assignedUnits, unit, reference]));
  return project === 'tmf-panama' ? <MasterWorkOrderDetail key={scope} unit={unit} reference={reference} /> : <Navigate to="/workorders" replace />;
}

function MasterWorkOrderDetail({ unit, reference }: { unit: string; reference: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const allUnits = useAuthStore(state => state.allUnits);
  const assigned = useAuthStore(state => state.assignedUnits);
  const { workorders, loading: nativeLoading, fetched, error: nativeError, fetchWorkOrders } = useWorkOrderStore();
  const valid = /^[A-Z0-9][A-Z0-9 -]{0,39}$/i.test(unit) && Boolean(reference.trim()) && reference.length <= 200;
  const allowed = allUnits || assigned.some(assignedUnit => key(assignedUnit) === key(unit));
  const [master, setMaster] = useState<{ rows: MasterOrder[] | null; capturedAt: string | null; loading: boolean; error: string }>({ rows: null, capturedAt: null, loading: true, error: '' });
  const request = useRef<AbortController | null>(null);
  const equipment = useEquipmentById(key(unit));
  const back = () => (location.state as { fromOrderList?: boolean } | null)?.fromOrderList === true ? navigate(-1) : navigate('/workorders', { replace: true });

  const loadMaster = useCallback(() => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    return readPanamaOrderMaster(AbortSignal.any([controller.signal, AbortSignal.timeout(12000)])).then(result => {
      if (!controller.signal.aborted) setMaster({ ...result, loading: false, error: '' });
    }).catch(() => {
      if (!controller.signal.aborted) setMaster({ rows: null, capturedAt: null, loading: false, error: 'No se pudo consultar la orden del Maestro de Taller.' });
    });
  }, []);
  const refresh = useCallback(async () => {
    setMaster({ rows: null, capturedAt: null, loading: true, error: '' });
    await Promise.all([fetchWorkOrders(), loadMaster()]);
  }, [fetchWorkOrders, loadMaster]);
  useEffect(() => {
    if (valid && allowed) void Promise.all([fetchWorkOrders(), loadMaster()]);
    return () => request.current?.abort();
  }, [valid, allowed, fetchWorkOrders, loadMaster]);

  const native = valid && allowed && fetched && !nativeLoading && !nativeError ? nativeOrderForReference(workorders, unit, reference) : undefined;
  if (native) return <Navigate to={`/workorders/${encodeURIComponent(native.ot_id)}`} state={location.state} replace />;
  const row = valid && allowed && master.rows ? masterOrderForReference(master.rows, unit, reference) : undefined;
  const folio = visibleWorkOrderFolio(reference);
  if (!valid || !allowed || !row) {
    const message = !valid ? 'La referencia de esta orden está incompleta.' : !allowed ? 'Este equipo no está disponible para tu cuenta.'
      : master.loading ? 'Consultando orden…' : master.error || 'Esta orden no se encontró en el corte autorizado del maestro.';
    return <OrderDetailLayout>
      <OrderDetailHeader folio={folio} onBack={back} />
      <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <p role={valid && allowed && master.loading ? 'status' : 'alert'} className="text-sm text-text-secondary">{message}</p>
        {valid && allowed && !master.loading && <button type="button" className={`mt-3 ${buttonClass}`} onClick={() => void refresh()}>Reintentar</button>}
      </section>
    </OrderDetailLayout>;
  }
  const notes = masterOrderNotes(row.masters);
  return <OrderDetailLayout>
    <OrderDetailHeader folio={visibleWorkOrderFolio(row.card.ot_id)} priority={row.card.prioridad} onBack={back} />
    <div><button type="button" className={buttonClass} onClick={() => void refresh()} disabled={master.loading}>Actualizar datos</button></div>
    <OrderDetailStatus><OrderDetailStatusBadge status={row.card.estado} />
      <p className="mt-2 text-xs text-text-secondary">Maestro de Taller · Solo consulta</p>
    </OrderDetailStatus>
    {nativeError && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Hermes no está disponible. Se muestran los datos consultados del maestro.</p>}
    <OrderDetailInformation data={{ unit: row.card.unidad, model: equipment?.model, serial: equipment?.serial,
      priority: row.card.prioridad, description: row.card.descripcion }}>
      <Link to={`/manuals?unit=${encodeURIComponent(row.card.unidad)}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-amber underline">Manuales de {row.card.unidad}</Link>
    </OrderDetailInformation>
    {(notes.length > 0 || row.masters.length > 1) && <section aria-label="Pendientes de la orden" className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold text-text">Pendientes de la orden</h2>
      {row.masters.length > 1 && <p className="mt-2 text-sm text-amber-900">Hay variantes del registro que Taller debe conciliar.</p>}
      {notes.length > 0 && <ul className="mt-2 list-inside list-disc space-y-1 break-words text-sm text-text-secondary">{notes.map(note => <li key={note}>{note}</li>)}</ul>}
    </section>}
    <details className="rounded-xl border border-border bg-white px-4 text-sm text-text-secondary">
      <summary className="min-h-11 cursor-pointer py-3 font-semibold">Datos del registro</summary>
      <div className="space-y-3 pb-4"><p>Origen: Maestro de Taller.</p>
        <p>{master.capturedAt ? `Corte del ${displayCut(master.capturedAt)} · Panamá` : 'Fecha del corte por confirmar.'}</p>
        <p>La fecha de apertura, el tipo, el mecánico y el progreso no están disponibles en esta consulta.</p>
        {row.masters.map((record, index) => <div key={index} className="space-y-1 break-words border-t border-border pt-3">
          <p><strong>Referencia:</strong> {record.id || 'Sin dato'}</p><p><strong>Estado registrado:</strong> {record.status || 'Sin dato'}</p>
          <p><strong>Prioridad registrada:</strong> {record.priority || 'Sin dato'}</p>
          {row.masters.length > 1 && <p><strong>Descripción registrada:</strong> {record.description || 'Sin dato'}</p>}
          {record.check && <p><strong>Control del maestro:</strong> {record.check}</p>}
        </div>)}
      </div>
    </details>
  </OrderDetailLayout>;
}
