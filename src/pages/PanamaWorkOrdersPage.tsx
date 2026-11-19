import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, ChevronRight, RefreshCw, Search, SlidersHorizontal, TriangleAlert, Truck } from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { useWorkOrderStore } from '../stores/workorder-store';
import { filterPanamaOrders, readPanamaOrderMaster, unifiedPanamaOrders, masterOrderHref, orderListPriority, orderListStatus, type ListedOrder, type MasterOrder, type OrderListStatus } from '../lib/panama-order-list';
import { visibleWorkOrderFolio } from '../lib/purchasing-api';
import { useEquipmentById } from '../hooks/useEquipmentList';
import { PRIORITY_CONFIG, type OTPriority } from '../types/workorder';
import { SkeletonList } from '../components/ui/Skeleton';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import PullIndicator from '../components/ui/PullIndicator';

const inputClass = 'min-h-11 w-full min-w-0 rounded-lg border border-border bg-white px-3 text-sm text-text';
const statusOptions: [OrderListStatus, string][] = [['Abierta', 'Abiertas'], ['En Reparación', 'En reparación'], ['Esperando Pieza', 'Por repuesto'],
  ['Resuelta', 'En revisión'], ['Completado', 'Cerradas'], ['Por verificar', 'Por verificar']];
const rowStatus: Record<OrderListStatus, { label: string; color?: string }> = {
  Abierta: { label: 'Abierta', color: 'blue' },
  'En Reparación': { label: 'En reparación', color: 'media' },
  'Esperando Pieza': { label: 'Por repuesto', color: 'media' },
  Resuelta: { label: 'Resuelta', color: 'blue' },
  Completado: { label: 'Cerrada', color: 'rescue-badge-ok' },
  'Por verificar': { label: 'Por verificar' },
};
const unitKey = (value: string) => value.trim().toUpperCase();
const displayCut = (value: string) => new Date(value).toLocaleString('es-PA', { timeZone: 'America/Panama', dateStyle: 'short', timeStyle: 'short' });
const orderFolio = ({ card }: ListedOrder) => visibleWorkOrderFolio(card.folio ?? card.ot_id);
const needsReturn = ({ native }: ListedOrder) => native?.estado === 'Completado'
  && native.tipo_averia !== 'PM' && native.operations?.decision !== 'accepted';
const displayStatus = (row: ListedOrder) => needsReturn(row) ? 'Retorno pendiente' : row.card.estado;
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
      <div className="rescue-order-preview-section"><span>Estado</span><p>{displayStatus(row)}</p></div>
      <div className="rescue-order-preview-section"><span>Asignación</span><p>{card.mecanico_asignado || (native ? 'Sin asignar' : 'Sin dato')}</p></div>
    </div>
    {notice && <p className="rescue-partial">{notice}</p>}
    <Link className="rescue-primary" to={orderHref(row)} state={native ? undefined : { fromOrderList: true }}>
      {native ? 'Abrir orden' : 'Consultar orden'} <ArrowRight size={15} aria-hidden />
    </Link>
  </aside>;
}

function OrderRow({ row }: { row: ListedOrder }) {
  const { card, native, notice } = row;
  const folio = orderFolio(row);
  const { label, color } = rowStatus[orderListStatus(card.estado)];
  const waiting = needsReturn(row);
  const state = waiting ? 'Retorno pendiente' : card.estado === 'En Espera de Asignación' ? 'Sin asignar' : card.estado === 'Por conciliar' ? 'Por conciliar' : label;
  return <Link className="rescue-order-row" to={orderHref(row)} state={native ? undefined : { fromOrderList: true }}>
    <div className="rescue-order-row-main">
      <div className="rescue-order-row-title"><b>{card.unidad}</b>{folio && <span>{folio}</span>}
        {notice && <span title="Por revisar" className="rescue-order-row-warning"><TriangleAlert size={13} aria-hidden /><span className="sr-only">Por revisar</span></span>}
      </div>
      <span className="rescue-order-row-task">{card.descripcion}</span>
    </div>
    <div className="rescue-order-row-meta">
      <span className={`rescue-order-badge ${waiting ? 'media' : color ?? ''}`}>{state}</span>
      {orderListPriority(card.prioridad) && <PriorityBadge value={card.prioridad} />}
    </div>
    <ChevronRight size={16} aria-hidden />
  </Link>;
}

export default function PanamaWorkOrdersPage() {
  const { workorders, fetched, loading: nativeLoading, error, fetchWorkOrders } = useWorkOrderStore();
  const canReadMaster = useAuthStore(state => state.role !== 'mecanico');
  const allUnits = useAuthStore(state => state.allUnits);
  const assigned = useAuthStore(state => state.assignedUnits);
  const units = new Set(assigned.map(unitKey));
  const allows = (unit: string) => allUnits || units.has(unitKey(unit));
  const [master, setMaster] = useState<{ loading: boolean; rows: MasterOrder[] | null; capturedAt: string | null; error: string }>({ loading: true, rows: null, capturedAt: null, error: '' });
  const controller = useRef<AbortController | null>(null);
  const [params, setParams] = useSearchParams();
  const returning = params.get('bandeja') === 'retornos';
  const search = (params.get('buscar') ?? '').slice(0, 100);
  const priorityParam = params.get('prioridad') ?? '';
  const priority = ['', 'CRITICA', 'ALTA', 'MEDIA', 'BAJA', 'unknown'].includes(priorityParam) ? priorityParam : '';
  const statusParam = params.get('estado') ?? '';
  const status = statusOptions.some(([value]) => value === statusParam) ? statusParam : '';
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilters = Number(Boolean(priority)) + Number(Boolean(status));
  const [selectedKey, setSelectedKey] = useState('');

  function setFilter(name: 'buscar' | 'prioridad' | 'estado', value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next, { replace: true });
  }

  function clearFilters() {
    const next = new URLSearchParams(params);
    for (const key of ['buscar', 'prioridad', 'estado']) next.delete(key);
    setParams(next, { replace: true });
  }

  const loadMaster = useCallback(() => {
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    return readPanamaOrderMaster(AbortSignal.any([request.signal, AbortSignal.timeout(12000)])).then(result => {
      if (!request.signal.aborted) setMaster({ ...result, loading: false, error: '' });
    }).catch(() => {
      if (!request.signal.aborted) setMaster({ loading: false, rows: null, capturedAt: null, error: 'Maestro de Taller no disponible' });
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

  const scopedOrders = unifiedPanamaOrders(workorders.filter(row => allows(row.unidad)), (master.rows ?? []).filter(row => allows(row.unit)));
  const items = returning ? scopedOrders.filter(needsReturn) : scopedOrders;
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
      <h1 aria-label={returning ? 'Retornos pendientes' : 'Órdenes de trabajo'}>{returning ? 'Retornos pendientes' : 'Órdenes'}</h1>
      <button type="button" className="rescue-icon-button" aria-label="Actualizar órdenes" title="Actualizar"
        onClick={() => void refreshList()} disabled={loading}><RefreshCw size={17} aria-hidden /></button>
    </header>
    {partial && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <b>Lista parcial</b> · {[error && 'Hermes no disponible', canReadMaster && master.error].filter(Boolean).join(' · ')}
    </p>}
    <div className="rescue-panel rescue-orders-control">
      <div className="rescue-orders-tabs" role="group" aria-label="Estado de la orden">
        <button type="button" aria-pressed={!status} onClick={() => setFilter('estado', '')}>Todas <b>{[...byStatus.values()].reduce((total, count) => total + count, 0)}</b></button>
        {statusOptions.map(([value, label]) => <button type="button" key={value} aria-pressed={status === value}
          onClick={() => setFilter('estado', value)}>{label} <b>{byStatus.get(value) ?? 0}</b></button>)}
      </div>
      <div className="rescue-orders-filters">
        <label className="rescue-compact-search rescue-orders-search"><Search size={16} aria-hidden />
          <input aria-label="Buscar orden" type="search" value={search} maxLength={100} placeholder="Buscar OT o equipo" onChange={event => setFilter('buscar', event.target.value)} />
        </label>
        <button type="button" className="rescue-secondary rescue-orders-filter-toggle" aria-expanded={filtersOpen}
          aria-controls="panama-order-filters" onClick={() => setFiltersOpen(open => !open)}>
          <SlidersHorizontal size={15} aria-hidden /> Filtros{activeFilters > 0 && <b>{activeFilters}</b>}
        </button>
        <div id="panama-order-filters" className="rescue-orders-settings" data-open={filtersOpen}>
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
          {(search || priority || status) && <button type="button" className="rescue-orders-clear" aria-label="Limpiar filtros" onClick={clearFilters}>Limpiar</button>}
        </div>
        <p className="rescue-orders-count" role="status">{loading ? 'Cargando…' : partial && items.length === 0 ? 'Fuentes pendientes' : `${filtered.length} de ${items.length} órdenes`}</p>
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
                <td><PriorityBadge value={row.card.prioridad} /></td><td><span title={displayStatus(row)}>{displayStatus(row)}</span></td>
              </tr>)}</tbody>
            </table>
          </div>
          <OrderPreview row={selected} />
        </div>
        <div className="rescue-orders-cards" role="list" aria-label="Órdenes de trabajo">
          {filtered.map(row => <div role="listitem" key={row.key}><OrderRow row={row} /></div>)}
        </div>
      </> : <p className="rescue-orders-empty">
        {partial && items.length === 0 ? 'Órdenes no disponibles' : items.length ? 'Sin coincidencias' : 'Sin órdenes'}
      </p>}
    </div>
    {canReadMaster && <details className="rounded-lg border border-border bg-card px-3 text-xs text-text-secondary">
      <summary className="min-h-11 cursor-pointer py-3 font-medium">Fuentes</summary>
      <div className="space-y-2 pb-3"><p>Hermes: {nativeLoading || !fetched ? 'consultando' : error ? 'sin consulta' : 'consulta disponible'}.</p>
        <p>Maestro de Taller: {master.loading ? 'consultando' : master.rows === null ? 'sin consulta' : master.capturedAt ? `corte del ${displayCut(master.capturedAt)} · Panamá` : 'consulta disponible; fecha del corte sin dato'}.</p>
        <Link className="inline-flex min-h-11 items-center font-semibold text-blue-800 underline" to="/panama">Maestros TMF</Link>
        <Link className="ml-4 inline-flex min-h-11 items-center font-semibold text-blue-800 underline" to="/panama/tiempo-caido">Tiempo caído</Link>
      </div>
    </details>}
  </div>;
}
