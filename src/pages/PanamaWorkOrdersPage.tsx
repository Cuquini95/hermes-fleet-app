import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';
import { useWorkOrderStore } from '../stores/workorder-store';
import { filterPanamaOrders, readPanamaOrderMaster, unifiedPanamaOrders, masterOrderHref, type MasterOrder, type OrderListStatus } from '../lib/panama-order-list';
import OTCard from '../components/ui/OTCard';
import { SkeletonList } from '../components/ui/Skeleton';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import PullIndicator from '../components/ui/PullIndicator';

const inputClass = 'min-h-11 w-full min-w-0 rounded-lg border border-border bg-white px-3 text-sm text-text';
const buttonClass = 'min-h-11 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-text';
const statusOptions: [OrderListStatus, string][] = [['Abierta', 'Abiertas'], ['En Reparación', 'En reparación'], ['Esperando Pieza', 'Por repuesto'],
  ['Resuelta', 'En revisión'], ['Completado', 'Cerradas'], ['Por verificar', 'Por verificar']];
const unitKey = (value: string) => value.trim().toUpperCase();
const displayCut = (value: string) => new Date(value).toLocaleString('es-PA', { timeZone: 'America/Panama', dateStyle: 'short', timeStyle: 'short' });

export default function PanamaWorkOrdersPage() {
  const navigate = useNavigate();
  const { workorders, fetched, loading: nativeLoading, error, fetchWorkOrders } = useWorkOrderStore();
  const allUnits = useAuthStore(state => state.allUnits);
  const assigned = useAuthStore(state => state.assignedUnits);
  const units = new Set(assigned.map(unitKey));
  const allows = (unit: string) => allUnits || units.has(unitKey(unit));
  const [master, setMaster] = useState<{ loading: boolean; rows: MasterOrder[] | null; capturedAt: string | null; error: string }>({ loading: true, rows: null, capturedAt: null, error: '' });
  const controller = useRef<AbortController | null>(null);
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('');
  const [status, setStatus] = useState('');

  const loadMaster = useCallback(() => {
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    return readPanamaOrderMaster(AbortSignal.any([request.signal, AbortSignal.timeout(12000)])).then(result => {
      if (!request.signal.aborted) setMaster({ ...result, loading: false, error: '' });
    }).catch(() => {
      if (!request.signal.aborted) setMaster({ loading: false, rows: null, capturedAt: null, error: 'No se pudo consultar el Maestro de Taller.' });
    });
  }, []);
  const refreshMaster = useCallback(async () => {
    setMaster({ loading: true, rows: null, capturedAt: null, error: '' });
    await loadMaster();
  }, [loadMaster]);
  const refresh = useCallback(async () => { await Promise.all([fetchWorkOrders(), refreshMaster()]); }, [fetchWorkOrders, refreshMaster]);
  useEffect(() => {
    void Promise.all([fetchWorkOrders(), loadMaster()]);
    const check = () => { if (document.visibilityState === 'visible') void refreshMaster(); };
    window.addEventListener('focus', check); window.addEventListener('online', check);
    return () => { controller.current?.abort(); window.removeEventListener('focus', check); window.removeEventListener('online', check); };
  }, [fetchWorkOrders, loadMaster, refreshMaster]);

  const items = unifiedPanamaOrders(workorders.filter(row => allows(row.unidad)), (master.rows ?? []).filter(row => allows(row.unit)));
  const filtered = filterPanamaOrders(items, { search, priority, status });
  const loading = nativeLoading || !fetched || master.loading;
  const partial = Boolean(error || master.error);
  const { scrollRef, onTouchStart, onTouchMove, onTouchEnd, pullDistance, refreshing, pullIndicatorStyle, isReady } = usePullToRefresh({ onRefresh: refresh });

  return <div ref={scrollRef} className="min-w-0 space-y-3 py-4 text-text" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
    <PullIndicator pullDistance={pullDistance} refreshing={refreshing} isReady={isReady} style={pullIndicatorStyle} />
    <header className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-lg font-bold">Órdenes de trabajo</h1>
      <button type="button" className={buttonClass} onClick={() => void refresh()} disabled={loading}>Actualizar</button>
    </header>
    <label className="block min-w-0 space-y-1 text-sm font-medium">Buscar orden
      <input className={inputClass} value={search} maxLength={100} placeholder="Equipo, folio o trabajo" onChange={event => setSearch(event.target.value)} />
    </label>
    <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-2">
      <label className="min-w-0 space-y-1 text-sm font-medium">Prioridad
        <select aria-label="Prioridad" className={inputClass} value={priority} onChange={event => setPriority(event.target.value)}>
          <option value="">Todas</option><option value="CRITICA">Crítica</option><option value="ALTA">Alta</option>
          <option value="MEDIA">Media</option><option value="BAJA">Baja</option><option value="unknown">Por priorizar</option>
        </select>
      </label>
      <label className="min-w-0 space-y-1 text-sm font-medium">Estado
        <select aria-label="Estado" className={inputClass} value={status} onChange={event => setStatus(event.target.value)}>
          <option value="">Todos</option>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
    </div>
    {(search || priority || status) && <button type="button" className={buttonClass} onClick={() => { setSearch(''); setPriority(''); setStatus(''); }}>Limpiar filtros</button>}
    {partial && <div role="alert" className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <p className="font-semibold">Lista parcial</p>
      {error && <p>No se pudieron consultar las órdenes de Hermes.</p>}{master.error && <p>{master.error}</p>}
      <button type="button" className={buttonClass} onClick={() => void refresh()} disabled={loading}>Reintentar</button>
    </div>}
    <p className="text-xs text-text-secondary" role="status">{loading ? 'Actualizando la lista…' : partial && items.length === 0 ? 'Fuentes pendientes de consulta' : `${filtered.length} de ${items.length} órdenes${partial ? ' disponibles' : ''}`}</p>
    {loading && items.length === 0 ? <SkeletonList count={3} /> : <>
      <div role="list" aria-label="Órdenes de trabajo">
        {filtered.map(row => <div role="listitem" key={row.key}><OTCard workorder={row.card} readOnly={!row.native}
          origin={row.native ? row.masters.length ? 'Hermes y Maestro' : 'Hermes' : 'Maestro'} notice={row.notice}
          onClick={() => row.native ? navigate(`/workorders/${encodeURIComponent(row.detailReference ?? row.native.ot_id)}`) : navigate(masterOrderHref(row.card.unidad, row.card.ot_id), { state: { fromOrderList: true } })} /></div>)}
      </div>
      {filtered.length === 0 && <p className="rounded-xl border border-border bg-card p-4 text-sm text-text-secondary">
        {partial && items.length === 0 ? 'No hay una lista completa verificada. Reintenta la consulta.' : items.length ? 'Sin coincidencias. Cambia los filtros.' : 'Sin órdenes en las fuentes consultadas.'}
      </p>}
    </>}
    <details className="rounded-lg border border-border bg-card px-3 text-xs text-text-secondary">
      <summary className="min-h-11 cursor-pointer py-3 font-medium">Fuentes de la lista</summary>
      <div className="space-y-2 pb-3"><p>Hermes: {nativeLoading || !fetched ? 'consultando' : error ? 'sin consulta' : 'consulta disponible'}.</p>
        <p>Maestro de Taller: {master.loading ? 'consultando' : master.rows === null ? 'sin consulta' : master.capturedAt ? `corte del ${displayCut(master.capturedAt)} · Panamá` : 'consulta disponible; fecha del corte sin dato'}.</p>
        <p>Las órdenes exclusivas del maestro se consultan sin edición. Las referencias coincidentes del mismo equipo se muestran una vez.</p>
        <Link className="inline-flex min-h-11 items-center font-semibold text-blue-800 underline" to="/panama">Maestros TMF</Link>
        <Link className="ml-4 inline-flex min-h-11 items-center font-semibold text-blue-800 underline" to="/panama/tiempo-caido">Tiempo caído</Link>
      </div>
    </details>
  </div>;
}
