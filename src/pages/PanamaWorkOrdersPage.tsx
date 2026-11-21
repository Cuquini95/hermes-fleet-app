import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, RefreshCw, Truck } from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { useWorkOrderStore } from '../stores/workorder-store';
import { filterPanamaOrders, readPanamaOrderMaster, unifiedPanamaOrders, masterOrderHref, orderListPriority, orderListStatus, type ListedOrder, type MasterOrder, type OrderListStatus } from '../lib/panama-order-list';
import { visibleWorkOrderFolio } from '../lib/purchasing-api';
import { useEquipmentById } from '../hooks/useEquipmentList';
import { PRIORITY_CONFIG, type OTPriority } from '../types/workorder';
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
const orderFolio = ({ card }: ListedOrder) => visibleWorkOrderFolio(card.folio ?? card.ot_id);
const orderHref = ({ native, card, detailReference }: ListedOrder) => native
  ? `/workorders/${encodeURIComponent(detailReference ?? native.ot_id)}`
  : masterOrderHref(card.unidad, card.ot_id);

function PriorityBadge({ value }: { value?: string }) {
  const priority = orderListPriority(value) as OTPriority | undefined;
  return <span className={`rescue-order-badge ${priority?.toLowerCase() ?? ''}`}>
    {priority ? PRIORITY_CONFIG[priority].label : 'Por priorizar'}
  </span>;
}

function OrderPreview({ row }: { row: ListedOrder }) {
  const { card, native, notice } = row;
  const equipment = useEquipmentById(card.unidad);
  return <aside className="rescue-order-preview" aria-label="Vista previa de la orden">
    <header><div><span>Orden de trabajo</span><h2>{orderFolio(row) ?? card.unidad}</h2></div><PriorityBadge value={card.prioridad} /></header>
    <div className="rescue-order-preview-asset"><Truck size={21} aria-hidden /><div><b>{card.unidad}</b>{equipment?.model && <small>{equipment.model}</small>}</div></div>
    <div className="rescue-order-preview-section"><span>Trabajo</span><p>{card.descripcion}</p></div>
    <div className="rescue-order-preview-meta">
      <div className="rescue-order-preview-section"><span>Estado</span><p>{card.estado}</p></div>
      <div className="rescue-order-preview-section"><span>Asignación</span><p>{card.mecanico_asignado || (native ? 'Sin asignar' : 'Sin dato')}</p></div>
    </div>
    {notice && <p className="rescue-partial">{notice}</p>}
    <Link className="rescue-primary" to={orderHref(row)} state={native ? undefined : { fromOrderList: true }}>
      {native ? 'Abrir orden' : 'Consultar orden'} <ArrowRight size={15} aria-hidden />
    </Link>
  </aside>;
}

export default function PanamaWorkOrdersPage() {
  const navigate = useNavigate();
  const { workorders, fetched, loading: nativeLoading, error, fetchWorkOrders } = useWorkOrderStore();
  const canReadMaster = useAuthStore(state => state.role !== 'mecanico');
  const allUnits = useAuthStore(state => state.allUnits);
  const assigned = useAuthStore(state => state.assignedUnits);
  const units = new Set(assigned.map(unitKey));
  const allows = (unit: string) => allUnits || units.has(unitKey(unit));
  const [master, setMaster] = useState<{ loading: boolean; rows: MasterOrder[] | null; capturedAt: string | null; error: string }>({ loading: true, rows: null, capturedAt: null, error: '' });
  const controller = useRef<AbortController | null>(null);
  const [params, setParams] = useSearchParams();
  const search = (params.get('buscar') ?? '').slice(0, 100);
  const priorityParam = params.get('prioridad') ?? '';
  const priority = ['', 'CRITICA', 'ALTA', 'MEDIA', 'BAJA', 'unknown'].includes(priorityParam) ? priorityParam : '';
  const statusParam = params.get('estado') ?? '';
  const status = statusOptions.some(([value]) => value === statusParam) ? statusParam : '';
  const [selectedKey, setSelectedKey] = useState('');

  // BrowserRouter updates history before the next render. Merge rapid edits into that latest URL.
  function setFilter(name: 'buscar' | 'prioridad' | 'estado', value: string) {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next, { replace: true });
  }

  function clearFilters() {
    const next = new URLSearchParams(window.location.search);
    for (const key of ['buscar', 'prioridad', 'estado']) next.delete(key);
    setParams(next, { replace: true });
  }

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
    if (!canReadMaster) { void fetchWorkOrders(); return; }
    void Promise.all([fetchWorkOrders(), loadMaster()]);
    const check = () => { if (document.visibilityState === 'visible') void refreshMaster(); };
    window.addEventListener('focus', check); window.addEventListener('online', check);
    return () => { controller.current?.abort(); window.removeEventListener('focus', check); window.removeEventListener('online', check); };
  }, [canReadMaster, fetchWorkOrders, loadMaster, refreshMaster]);

  const items = unifiedPanamaOrders(workorders.filter(row => allows(row.unidad)), (master.rows ?? []).filter(row => allows(row.unit)));
  const filtered = filterPanamaOrders(items, { search, priority, status });
  const byStatus = new Map<string, number>();
  for (const row of filterPanamaOrders(items, { search, priority })) {
    const state = orderListStatus(row.card.estado);
    byStatus.set(state, (byStatus.get(state) ?? 0) + 1);
  }
  const selected = filtered.find(row => row.key === selectedKey) ?? filtered[0];
  const loading = nativeLoading || !fetched || (canReadMaster && master.loading);
  const partial = Boolean(error || (canReadMaster && master.error));
  const refreshList = canReadMaster ? refresh : fetchWorkOrders;
  const { scrollRef, onTouchStart, onTouchMove, onTouchEnd, pullDistance, refreshing, pullIndicatorStyle, isReady } = usePullToRefresh({ onRefresh: refreshList });

  return <div ref={scrollRef} className="rescue-orders min-w-0 text-text" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
    <PullIndicator pullDistance={pullDistance} refreshing={refreshing} isReady={isReady} style={pullIndicatorStyle} />
    <header className="rescue-orders-heading">
      <h1>Órdenes de trabajo</h1>
      <button type="button" className="rescue-secondary" onClick={() => void refreshList()} disabled={loading}><RefreshCw size={14} aria-hidden /> Actualizar</button>
    </header>
    {partial && <div role="alert" className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <p className="font-semibold">Lista parcial</p>
      {error && <p>No se pudieron consultar las órdenes de Hermes.</p>}{master.error && <p>{master.error}</p>}
      <button type="button" className={buttonClass} onClick={() => void refreshList()} disabled={loading}>Reintentar</button>
    </div>}
    <div className="rescue-panel rescue-orders-control">
      <div className="rescue-orders-tabs" role="group" aria-label="Estado de la orden">
        <button type="button" aria-pressed={!status} onClick={() => setFilter('estado', '')}>Todas <b>{[...byStatus.values()].reduce((total, count) => total + count, 0)}</b></button>
        {statusOptions.map(([value, label]) => <button type="button" key={value} aria-pressed={status === value}
          onClick={() => setFilter('estado', value)}>{label} <b>{byStatus.get(value) ?? 0}</b></button>)}
      </div>
      <div className="rescue-orders-filters">
        <label>Prioridad
          <select aria-label="Prioridad" className={inputClass} value={priority} onChange={event => setFilter('prioridad', event.target.value)}>
            <option value="">Todas</option><option value="CRITICA">Crítica</option><option value="ALTA">Alta</option>
            <option value="MEDIA">Media</option><option value="BAJA">Baja</option><option value="unknown">Por priorizar</option>
          </select>
        </label>
        <label className="rescue-orders-state">Estado
          <select aria-label="Estado" className={inputClass} value={status} onChange={event => setFilter('estado', event.target.value)}>
            <option value="">Todos</option>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="rescue-orders-search">Buscar orden
          <input className={inputClass} value={search} maxLength={100} placeholder="Equipo, folio o trabajo" onChange={event => setFilter('buscar', event.target.value)} />
        </label>
        <p role="status">{loading ? 'Actualizando la lista…' : partial && items.length === 0 ? 'Fuentes pendientes' : `${filtered.length} de ${items.length} órdenes${partial ? ' disponibles' : ''}`}</p>
        {(search || priority || status) && <button type="button" onClick={clearFilters}>Limpiar filtros</button>}
      </div>
      {loading && items.length === 0 ? <div className="rescue-orders-empty"><SkeletonList count={3} /></div> : selected ? <>
        <div className="rescue-orders-layout">
          <div className="rescue-orders-table-wrap">
            <table className="rescue-orders-table" aria-label="Órdenes de trabajo">
              <colgroup><col /><col /><col /><col /><col /></colgroup>
              <thead><tr>{['OT', 'Equipo', 'Falla o trabajo', 'Prioridad', 'Estado'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
              <tbody>{filtered.map(row => <tr key={row.key} className={selected.key === row.key ? 'selected' : undefined} onClick={() => setSelectedKey(row.key)}>
                <td><button type="button" aria-pressed={selected.key === row.key} aria-label={`Ver ${orderFolio(row) ?? 'orden'} de ${row.card.unidad}`}>
                  {orderFolio(row) ?? 'Ver OT'}</button></td>
                <td><strong>{row.card.unidad}</strong></td><td><span title={row.card.descripcion}>{row.card.descripcion}</span></td>
                <td><PriorityBadge value={row.card.prioridad} /></td><td><span title={row.card.estado}>{row.card.estado}</span></td>
              </tr>)}</tbody>
            </table>
          </div>
          <OrderPreview row={selected} />
        </div>
        <div className="rescue-orders-cards" role="list" aria-label="Órdenes de trabajo">
          {filtered.map(row => <div role="listitem" key={row.key}><OTCard workorder={row.card} readOnly={!row.native}
            origin={row.native ? row.masters.length ? 'Hermes y Maestro' : 'Hermes' : 'Maestro'} notice={row.notice}
            onClick={() => navigate(orderHref(row), { state: row.native ? undefined : { fromOrderList: true } })} /></div>)}
        </div>
      </> : <p className="rescue-orders-empty">
        {partial && items.length === 0 ? 'No hay una lista completa verificada. Reintenta la consulta.' : items.length ? 'Sin coincidencias. Cambia los filtros.' : 'Sin órdenes en las fuentes consultadas.'}
      </p>}
    </div>
    {canReadMaster && <details className="rounded-lg border border-border bg-card px-3 text-xs text-text-secondary">
      <summary className="min-h-11 cursor-pointer py-3 font-medium">Fuentes de la lista</summary>
      <div className="space-y-2 pb-3"><p>Hermes: {nativeLoading || !fetched ? 'consultando' : error ? 'sin consulta' : 'consulta disponible'}.</p>
        <p>Maestro de Taller: {master.loading ? 'consultando' : master.rows === null ? 'sin consulta' : master.capturedAt ? `corte del ${displayCut(master.capturedAt)} · Panamá` : 'consulta disponible; fecha del corte sin dato'}.</p>
        <Link className="inline-flex min-h-11 items-center font-semibold text-blue-800 underline" to="/panama">Maestros TMF</Link>
        <Link className="ml-4 inline-flex min-h-11 items-center font-semibold text-blue-800 underline" to="/panama/tiempo-caido">Tiempo caído</Link>
      </div>
    </details>}
  </div>;
}
