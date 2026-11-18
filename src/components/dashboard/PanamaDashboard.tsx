import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, CalendarClock, Camera, ChartNoAxesColumn, ChevronRight, ClipboardCheck,
  FileText, PackageSearch, Plus, RefreshCw, Search, Truck, Wrench,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { useEquipmentStore } from '../../stores/equipment-store';
import { useWorkOrderStore } from '../../stores/workorder-store';
import { useEquipmentList } from '../../hooks/useEquipmentList';
import { useFleetDispatch } from '../../hooks/useFleetDispatch';
import { usePanamaWorkshopExceptions } from '../../hooks/usePanamaWorkshopExceptions';
import { usePanamaPmReview } from '../../hooks/usePanamaPmReview';
import { normalizeUnitId } from '../../lib/dispatch-readiness';
import type { ListedOrder } from '../../lib/panama-order-list';
import { orderListPriority, orderListStatus, readPanamaOrderMaster, unifiedPanamaOrders } from '../../lib/panama-order-list';
import { fetchPanamaMaintenance, type PanamaMaintenance } from '../../lib/panama-maintenance';
import {
  isPendingFilter, panamaDashboardPendings, pendingAge, pendingDateLabel, pmReviewIsComplete,
  type DashboardPending, type PendingFilter,
} from '../../lib/panama-dashboard';
import { purchaseRead, purchaseRequests, type PurchaseRequestLine, type WarehouseStock } from '../../lib/purchasing-api';
import PanamaFinanceHandoff from './PanamaFinanceHandoff';

const pageSize = 5;
const filters: [PendingFilter, string][] = [
  ['all', 'Todos'], ['stopped', 'Detenidos'], ['unassigned', 'Sin asignar'], ['parts', 'Por repuesto'], ['pm', 'PM por revisar'],
];
const accents: Record<DashboardPending['kind'], string> = {
  stopped: 'red', critical: 'red', parts: 'amber', assignment: 'amber', return: 'blue', pm: 'gray',
};
const fmt = new Intl.DateTimeFormat('es-PA', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Panama' });
const todayLabel = new Intl.DateTimeFormat('es-PA', { dateStyle: 'full', timeZone: 'America/Panama' });
const localHour = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Panama', hour: 'numeric', hourCycle: 'h23' });
const count = (value: number | null) => value ?? '—';

function useMaintenanceSummary(revision: number) {
  const [result, setResult] = useState<{ revision: number; data: PanamaMaintenance | null }>();
  useEffect(() => {
    const abort = new AbortController();
    const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(15_000)]);
    void fetchPanamaMaintenance(signal).then(data => {
      if (!abort.signal.aborted) setResult({ revision, data });
    }).catch(() => { if (!abort.signal.aborted) setResult({ revision, data: null }); });
    return () => abort.abort();
  }, [revision]);
  return result?.revision === revision ? result.data : undefined;
}

function useStockSummary(revision: number) {
  const [result, setResult] = useState<{ revision: number; items: WarehouseStock[] | null }>();
  useEffect(() => {
    const abort = new AbortController();
    const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(12_000)]);
    void purchaseRead<{ items: WarehouseStock[] }>('inventory-stock', undefined, signal)
      .then(data => { if (!abort.signal.aborted) setResult({ revision, items: Array.isArray(data.items) ? data.items : null }); })
      .catch(() => { if (!abort.signal.aborted) setResult({ revision, items: null }); });
    return () => abort.abort();
  }, [revision]);
  return result?.revision === revision ? result.items : undefined;
}

function MaintenanceOverview({ orders, complete }: { orders: ListedOrder[]; complete: boolean }) {
  const statuses = orders.map(({ card }) => orderListStatus(card.estado));
  const open = statuses.filter(status => ['Abierta', 'En Reparación', 'Resuelta'].includes(status)).length;
  const waiting = statuses.filter(status => status === 'Esperando Pieza').length;
  const closed = statuses.filter(status => status === 'Completado').length;
  const other = statuses.length - open - waiting - closed;
  const groups = [
    { label: 'Abiertas', number: open, color: '#1769e8' },
    { label: 'En espera', number: waiting, color: '#f0ad22' },
    { label: 'Completadas', number: closed, color: '#25a55b' },
    ...(other ? [{ label: 'Por verificar', number: other, color: '#aab3bc' }] : []),
  ];
  let angle = 0;
  const bands = groups.filter(group => group.number > 0).map(group => {
    const start = angle;
    angle += 360 * group.number / orders.length;
    return `${group.color} ${start}deg ${angle}deg`;
  });
  const chart = complete && bands.length > 0 ? `conic-gradient(${bands.join(', ')})` : '#e7edf1';
  return <section className="rescue-panel rescue-overview" aria-labelledby="rescue-overview-title">
    <div className="rescue-panel-head">
      <h3 id="rescue-overview-title">Panorama de mantenimiento</h3>
      <Link to="/panama/tiempo-caido">Ver reporte <ChevronRight size={14} aria-hidden /></Link>
    </div>
    <div className="rescue-overview-body">
      <div className="rescue-donut" style={{ background: chart }}>
        <div><b>{complete ? orders.length : '—'}</b><span>OT totales</span></div>
      </div>
      <ul className="rescue-overview-legend">
        {groups.map(group => <li key={group.label}><i style={{ background: group.color }} aria-hidden />
          <span>{group.label}</span><b>{complete ? group.number : '—'}</b></li>)}
      </ul>
    </div>
  </section>;
}

function PriorityRow({ item }: { item: DashboardPending }) {
  const age = item.date ? pendingAge(item.date.day) : null;
  return <li className="rescue-priority-row">
    <Link to={item.href} className="rescue-priority-link"
      aria-label={[item.folio, item.unit, item.title, item.unverified && 'Por confirmar', item.action].filter(Boolean).join(' · ')}>
      <i className={`rescue-priority-rail ${accents[item.kind]}`} aria-hidden />
      <span className="min-w-0"><small>{[item.folio, item.unit].filter(Boolean).join(' · ')}</small>
        <b>{item.title}</b>{item.unverified && <em>Por confirmar</em>}</span>
      {age !== null && item.date && <time dateTime={item.date.day} title={`${item.date.label} · ${pendingDateLabel(item.date.day)}`}>
        {age === 0 ? 'Hoy' : `${age} d`}
      </time>}
      <ChevronRight size={15} aria-hidden />
    </Link>
    {item.purchaseHref && <Link className="rescue-order-purchases" to={item.purchaseHref}
      aria-label={`Ver pedidos vinculados · ${item.unit}`}>Pedidos</Link>}
  </li>;
}

export default function PanamaDashboard() {
  const [params, setParams] = useSearchParams();
  const filter = filters.find(([value]) => value === params.get('pendiente'))?.[0] ?? 'all';
  const queue = useRef<HTMLElement>(null);
  const [limit, setLimit] = useState(pageSize);
  const [revision, setRevision] = useState(0);
  const [master, setMaster] = useState<{ revision: number; result: Awaited<ReturnType<typeof readPanamaOrderMaster>> | null }>();
  const [purchases, setPurchases] = useState<{ orderCut: string; items: PurchaseRequestLine[] | null }>();
  const userName = useAuthStore(state => state.userName);
  const role = useAuthStore(state => state.role);
  const equipment = useEquipmentList();
  const fetched = useEquipmentStore(state => state.fetched);
  const equipmentError = useEquipmentStore(state => state.error);
  const refetch = useEquipmentStore(state => state.refetch);
  const workOrders = useWorkOrderStore(state => state.workorders);
  const ordersFetched = useWorkOrderStore(state => state.fetched);
  const orderError = useWorkOrderStore(state => state.error);
  const ordersLoading = useWorkOrderStore(state => state.loading);
  const fetchOrders = useWorkOrderStore(state => state.fetchWorkOrders);
  const dispatch = useFleetDispatch(equipment);
  const exceptions = usePanamaWorkshopExceptions(true);
  const pm = usePanamaPmReview(revision);
  const maintenance = useMaintenanceSummary(revision);
  const stock = useStockSummary(revision);
  const masterOrders = master?.revision === revision ? master.result : undefined;
  const orderCut = !exceptions.unavailable && exceptions.view?.alerts.some(row => row.kind === 'parts' && !row.pendingConfirmation)
    ? exceptions.view.observedAt : undefined;
  const linkedPurchases = orderCut && purchases?.orderCut === orderCut ? purchases.items : undefined;

  useEffect(() => {
    const abort = new AbortController();
    void fetchOrders();
    void readPanamaOrderMaster(AbortSignal.any([abort.signal, AbortSignal.timeout(12_000)]))
      .then(result => { if (!abort.signal.aborted) setMaster({ revision, result }); })
      .catch(() => { if (!abort.signal.aborted) setMaster({ revision, result: null }); });
    return () => abort.abort();
  }, [revision, fetchOrders]);

  useEffect(() => {
    if (!orderCut) return;
    const abort = new AbortController();
    void purchaseRequests(AbortSignal.any([abort.signal, AbortSignal.timeout(12_000)]))
      .then(({ items }) => { if (!abort.signal.aborted) setPurchases({ orderCut, items: Array.isArray(items) ? items : null }); })
      .catch(() => { if (!abort.signal.aborted) setPurchases({ orderCut, items: null }); });
    return () => abort.abort();
  }, [orderCut]);

  const fleetVerified = fetched && !equipmentError && dispatch.verified && Boolean(dispatch.operatingStatuses);
  const scopedStatuses = equipment.map(unit => dispatch.operatingStatuses?.get(normalizeUnitId(unit.unit_id)));
  const known = scopedStatuses.filter(Boolean).length;
  const operating = scopedStatuses.filter(status => status === 'operativo').length;
  const stopped = fleetVerified && (known > 0 || equipment.length === 0)
    ? scopedStatuses.filter(status => status === 'inoperativo').length : null;
  const completeFleet = fleetVerified && known === equipment.length;
  const completeExceptions = !!exceptions.view && !exceptions.unavailable && !exceptions.view.unconfirmed
    && !exceptions.view.alerts.some(row => row.pendingConfirmation);
  const completeOrders = ordersFetched && !orderError && Boolean(masterOrders);
  const orders = unifiedPanamaOrders(workOrders, masterOrders?.rows ?? []);
  const activeOrders = completeOrders ? orders.filter(row => !['Completado', 'Por verificar'].includes(orderListStatus(row.card.estado))) : [];
  const completePriority = completeOrders && orders.every(row => orderListStatus(row.card.estado) !== 'Por verificar') &&
    activeOrders.every(row => !!orderListPriority(row.card.prioridad) && (!row.masters.length ||
      row.masters.every(masterRow => orderListPriority(masterRow.priority) === orderListPriority(row.card.prioridad) &&
        orderListStatus(masterRow.status) === orderListStatus(row.card.estado))));
  const critical = completePriority ? activeOrders.filter(row => orderListPriority(row.card.prioridad) === 'CRITICA').length : null;
  const pmReview = pm.data?.rows.filter(row => row.issues.length > 0).length;
  const currentPm = maintenance?.entries?.filter(row => row.planApproval === 'approved' && !row.reconciliationPending && !row.readingConflict && !row.batchBlock);
  const overdue = currentPm?.length ? currentPm.filter(row => row.state === 'overdue').length : null;
  const knownStock = stock?.filter(row => row.warehouse && row.available !== null && row.minimum !== null &&
    Number.isFinite(Number(row.available)) && Number.isFinite(Number(row.minimum))) ?? [];
  const stockShort = knownStock.length ? knownStock.filter(row => Number(row.available) < Number(row.minimum) || Number(row.available) === 0).length : null;
  const completePm = !!pm.data && pmReviewIsComplete(pm.data);
  const pending = panamaDashboardPendings({
    equipment, dispatch, fleetVerified, orders: exceptions.view, ordersUnavailable: exceptions.unavailable,
    review: pm.data ?? undefined, purchases: linkedPurchases ?? [],
  });
  const shown = pending.filter(item => isPendingFilter(item, filter));
  const partial = [
    (!dispatch.loading && !completeFleet) && 'Flota',
    ((!exceptions.loading && !completeExceptions) || (ordersFetched && !ordersLoading && (orderError || masterOrders === null))) && 'OT',
    ((!pm.loading && !completePm) || (maintenance !== undefined && !maintenance?.entries)) && 'PM',
    (linkedPurchases === null || stock === null) && 'Repuestos',
  ].filter(Boolean).join(', ');
  const loading = (!fetched && !equipmentError) || dispatch.loading || exceptions.loading;
  const hour = Number(localHour.format(new Date()));
  const welcome = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const firstName = userName.trim().split(/\s+/)[0];
  const cut = dispatch.workshop?.orders.capturedAt;
  const validCut = cut && Number.isFinite(Date.parse(cut));

  function refresh() {
    setRevision(value => value + 1);
    void Promise.all([refetch(), dispatch.refresh(), exceptions.refresh()]);
  }

  function showQueue(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    setLimit(pageSize);
    queue.current?.scrollIntoView({ block: 'start' });
  }

  const metrics = [
    { label: 'Equipos detenidos', value: stopped, icon: Truck, color: 'red', context: known ? `${operating}/${known} operativos` : 'Estado por verificar',
      to: '/dashboard?pendiente=stopped' },
    { label: 'OT críticas', value: critical, icon: AlertTriangle, color: 'red',
      context: completeExceptions && exceptions.view?.assignmentsChecked ? `${pending.filter(row => row.unassigned).length} sin asignar` : 'Prioridad por verificar',
      to: '/workorders?prioridad=CRITICA' },
    { label: 'PM vencidos', value: overdue, icon: CalendarClock, color: 'amber',
      context: pmReview === undefined ? 'Planes por consultar' : `${pmReview} por revisar`, to: '/pm?vista=revisar' },
    { label: 'Faltantes de stock', value: stockShort, icon: PackageSearch, color: 'amber',
      context: stock == null ? 'Stock por verificar' : stock.length ? `${knownStock.length} partidas verificadas` : 'Sin conteo registrado', to: '/inventory' },
  ];

  return <div className="rescue-command">
    <div className="rescue-desktop-command">
      <div className="rescue-source-note"><FileText size={17} aria-hidden />
        <div><b>{fetched && !equipmentError ? `${equipment.length} equipos en Panamá` : 'Flota de Panamá'}</b>
          {validCut && <small>Maestro de Taller · <time dateTime={cut}>{fmt.format(new Date(cut))}</time></small>}</div>
        <button type="button" title="Actualizar datos" aria-label="Actualizar datos" disabled={loading} onClick={refresh}>
          <RefreshCw size={16} className={loading ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden />
        </button>
      </div>
      <div className="rescue-executive-head">
        <div><p className="rescue-eyebrow">Resumen ejecutivo · {todayLabel.format(new Date())}</p>
          <h1>{welcome}{firstName ? `, ${firstName}` : ''}</h1>
          <p className="rescue-command-subtitle">{dispatch.workshop?.alertsToday == null ? 'Operaciones Panamá' :
            `${dispatch.workshop.alertsToday} ${dispatch.workshop.alertsToday === 1 ? 'avería hoy' : 'averías hoy'}`}</p>
        </div>
        <div className="rescue-command-actions">
          <Link className="rescue-secondary" to="/data"><ChartNoAxesColumn size={17} aria-hidden /> Abrir reportes</Link>
          <Link className="rescue-primary" to="/falla"><Plus size={18} aria-hidden /> Reportar falla</Link>
        </div>
      </div>
      <section className="rescue-metrics" aria-label="Indicadores de operaciones">
        {metrics.map(({ label, value, icon: Icon, color, context, to }) => <Link to={to} className="rescue-metric" key={label}
          onClick={to.startsWith('/dashboard?') ? showQueue : undefined}>
          <span className={`rescue-metric-icon ${color}`}><Icon size={22} aria-hidden /></span>
          <div><span>{label}</span><strong>{count(value)}</strong><small>{context}</small></div>
        </Link>)}
      </section>
    </div>
    <div className="rescue-field-home">
      <div className="rescue-field-hero">
        <p>Turno activo · Panamá</p>
        <h1>Hola{firstName ? `, ${firstName}` : ''}.</h1>
        {known > 0 && <span>{operating}/{known} equipos operativos{!completeFleet && ' · parcial'}</span>}
      </div>
      <div className="rescue-field-actions">
        <Link className="danger" to="/falla"><span><Camera size={22} aria-hidden /></span>
          <div><b>Reportar una falla</b></div><ChevronRight size={16} aria-hidden /></Link>
        <Link to="/workorders"><span><Wrench size={22} aria-hidden /></span>
          <div><b>Continuar mis trabajos</b></div><ChevronRight size={16} aria-hidden /></Link>
      </div>
      <div className="rescue-field-metrics">
        <Link to="/dashboard?pendiente=stopped" onClick={showQueue}><span>Detenidos</span><b>{count(stopped)}</b><small>Equipos</small></Link>
        <Link to="/dashboard?pendiente=unassigned" onClick={showQueue}><span>Sin asignar</span>
          <b>{completeExceptions && exceptions.view?.assignmentsChecked ? pending.filter(row => row.unassigned).length : '—'}</b><small>Órdenes</small></Link>
        <Link to="/inventory"><span>Stock bajo</span><b>{count(stockShort)}</b><small>Repuestos</small></Link>
      </div>
      <section className="rescue-field-quick" aria-labelledby="rescue-quick-title">
        <h2 id="rescue-quick-title">Acciones rápidas</h2>
        <div>
          <Link to="/dvir"><ClipboardCheck size={21} aria-hidden /> Nueva inspección</Link>
          <Link to="/fleet"><Truck size={21} aria-hidden /> Buscar equipo</Link>
          <Link to="/inventory"><Search size={21} aria-hidden /> Buscar repuesto</Link>
          <Link to="/pm"><CalendarClock size={21} aria-hidden /> Mantenimiento PM</Link>
        </div>
      </section>
    </div>
    <div className="rescue-executive-grid">
      <section ref={queue} className="rescue-panel rescue-queue" aria-labelledby="rescue-queue-title">
        <div className="rescue-panel-head">
          <h3 id="rescue-queue-title">Prioridades operacionales</h3>
          <Link to="/workorders">Ver todas las órdenes <ChevronRight size={14} aria-hidden /></Link>
        </div>
        <div className="rescue-queue-tools">
          <select aria-label="Filtrar pendientes" value={filter} onChange={event => {
            const next = new URLSearchParams(params);
            if (event.target.value === 'all') next.delete('pendiente');
            else next.set('pendiente', event.target.value);
            setParams(next, { replace: true });
            setLimit(pageSize);
          }}>{filters.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <button type="button" className="rescue-queue-refresh" aria-label="Actualizar prioridades" disabled={loading} onClick={refresh}>
            <RefreshCw size={16} aria-hidden />
          </button>
          {partial && <span className="rescue-partial" role="status">Datos parciales · {partial}</span>}
        </div>
        {shown.length ? <ul className="rescue-priority-list" aria-label="Lista de pendientes operativos">
          {shown.slice(0, limit).map(item => <PriorityRow key={item.id} item={item} />)}
        </ul> : <p className="rescue-queue-empty" role="status">{loading ? 'Cargando…' : partial ? 'Sin datos confirmados' : 'Sin pendientes'}</p>}
        {shown.length > limit && <button type="button" className="rescue-more-priorities" onClick={() => setLimit(value => value + pageSize)}>
          Ver más ({shown.length - limit})
        </button>}
      </section>
      <MaintenanceOverview orders={orders} complete={completeOrders} />
    </div>
    <div className="rescue-executive-bottom">
      <Link className="rescue-panel" to="/pm?vista=revisar"><span>Planes PM por revisar</span><b>{pmReview ?? '—'}</b></Link>
      <Link className="rescue-panel" to="/fleet"><span>Flota operativa</span><b>{known ? `${operating}/${known}` : '—'}</b></Link>
      <Link className="rescue-panel" to="/panama/tiempo-caido"><span>Tiempo caído</span><ChartNoAxesColumn size={25} aria-hidden /></Link>
      {role === 'gerencia' && <details className="rescue-panel"><summary>Finanzas</summary><PanamaFinanceHandoff /></details>}
    </div>
    <Link to="/falla" className="rescue-field-add" aria-label="Reportar falla" data-mobile-toolbar><Plus size={25} aria-hidden /></Link>
  </div>;
}
