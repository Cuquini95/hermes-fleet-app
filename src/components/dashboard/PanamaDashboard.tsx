import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, ArrowRight, ClipboardCheck, Package, RefreshCw, Wrench } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { useEquipmentStore } from '../../stores/equipment-store';
import { useEquipmentList } from '../../hooks/useEquipmentList';
import { useFleetDispatch } from '../../hooks/useFleetDispatch';
import { usePanamaWorkshopExceptions } from '../../hooks/usePanamaWorkshopExceptions';
import { usePanamaPmReview } from '../../hooks/usePanamaPmReview';
import { useDashboardData } from '../../hooks/useDashboardData';
import { normalizeUnitId } from '../../lib/dispatch-readiness';
import {
  isPendingFilter, panamaDashboardPendings, pendingAge, pendingDateLabel, pmReviewIsComplete,
  type DashboardPending, type PendingFilter,
} from '../../lib/panama-dashboard';
import { purchaseRequests, type PurchaseRequestLine } from '../../lib/purchasing-api';
import AvailabilityChart from './AvailabilityChart';
import BriefingCard from './BriefingCard';
import PanamaFinanceHandoff from './PanamaFinanceHandoff';
import PanamaWorkshopSummary from './PanamaWorkshopSummary';

const pageSize = 6;
const actions = [
  { to: '/fleet', label: 'Flota' },
  { to: '/workorders', label: 'Órdenes de trabajo' },
  { to: '/pm', label: 'Mantenimiento PM' },
  { to: '/inventory', label: 'Inventario' },
  { to: '/pedidos', label: 'Pedidos' },
  { to: '/panama/tiempo-caido', label: 'Tiempo caído' },
  { to: '/panama', label: 'Maestros TMF' },
  { to: '/data', label: 'Datos' },
];
const adminActions = [
  { to: '/briefing', label: 'Briefing' },
  { to: '/admin/activos', label: 'Activos' },
  { to: '/admin/proveedores', label: 'Proveedores' },
  { to: '/admin/ordenes-compra', label: 'Órdenes de compra' },
];

const filters: { value: PendingFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'stopped', label: 'Detenidos' },
  { value: 'unassigned', label: 'Sin asignar' },
  { value: 'parts', label: 'Por repuesto' },
  { value: 'pm', label: 'PM por revisar' },
];
const pendingColors: Record<DashboardPending['kind'], string> = {
  stopped: 'bg-red-50 text-red-900', critical: 'bg-red-50 text-red-900',
  parts: 'bg-amber-50 text-amber-900', assignment: 'bg-amber-50 text-amber-900',
  return: 'bg-blue-50 text-blue-900', pm: 'bg-slate-100 text-slate-800',
};
const cutFormat = new Intl.DateTimeFormat('es-PA', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Panama' });
const control = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:border-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700';
const destination = 'inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-blue-900 underline decoration-blue-300 underline-offset-4 hover:decoration-blue-900';
const columns = 'lg:grid lg:grid-cols-[5rem_minmax(0,1.45fr)_minmax(0,1fr)_minmax(0,1.05fr)_minmax(0,.85fr)] lg:items-start lg:gap-3';

function PendingRow({ item }: { item: DashboardPending }) {
  const age = item.date && pendingAge(item.date.day);
  return <li className={`min-w-0 space-y-2 px-3 py-3 lg:space-y-0 xl:px-4 ${columns}`}>
    <p className="break-words text-base font-bold text-[#162252]">{item.unit}</p>
    <div className="min-w-0">
      <p className={`inline-flex rounded-md px-2 py-1 text-sm font-semibold ${pendingColors[item.kind]}`}>{item.title}</p>
      {item.detail && <p className="mt-1 line-clamp-2 break-words text-sm text-slate-600">{item.detail}</p>}
      {item.unverified && <p className="mt-1 text-sm font-medium text-amber-900">Estado por confirmar</p>}
    </div>
    <div className="flex min-w-0 flex-wrap gap-x-4 text-sm text-slate-700 lg:contents">
      <p className="min-w-0 break-words"><span className="mr-1 font-medium lg:sr-only">Responsable</span>{item.owner}</p>
      <div className="min-w-0 space-x-3 lg:col-start-4 lg:row-start-1 lg:space-x-0">
        <Link className={`${destination} lg:min-h-0 lg:py-0.5`} to={item.href}>
          {item.action}<ArrowRight aria-hidden size={14} className="shrink-0" />
        </Link>
        {item.purchaseHref && <Link className={`${destination} lg:min-h-0 lg:py-0.5`} to={item.purchaseHref}>Ver pedidos vinculados</Link>}
      </div>
      <p className="min-w-0 text-xs text-slate-600 lg:col-start-5 lg:row-start-1 lg:pt-1">
        {item.date && age ? <time dateTime={item.date.day} title={pendingDateLabel(item.date.day)}>
          {item.date.label} · {age.toLowerCase()}
        </time> : 'Fecha por confirmar'}
      </p>
    </div>
  </li>;
}

function metricCount(value: number, complete: boolean) {
  if (complete) return String(value);
  return value ? String(value) : '—';
}

export default function PanamaDashboard() {
  const [filter, setFilter] = useState<PendingFilter>('all');
  const [limit, setLimit] = useState(pageSize);
  const [revision, setRevision] = useState(0);
  const [showBriefing, setShowBriefing] = useState(false);
  const role = useAuthStore(state => state.role);
  const equipment = useEquipmentList();
  const fetched = useEquipmentStore(state => state.fetched);
  const equipmentError = useEquipmentStore(state => state.error);
  const refetch = useEquipmentStore(state => state.refetch);
  const dispatch = useFleetDispatch(equipment);
  const exceptions = usePanamaWorkshopExceptions(true);
  const pm = usePanamaPmReview(revision);
  const data = useDashboardData(equipment, true, dispatch.workshop);
  const [purchases, setPurchases] = useState<{ orderCut: string; items: PurchaseRequestLine[] | null }>();
  const orderCut = !exceptions.unavailable && exceptions.view?.alerts.some(row => row.kind === 'parts' && !row.pendingConfirmation)
    ? exceptions.view.observedAt : undefined;
  const linkedPurchases = orderCut && purchases?.orderCut === orderCut ? purchases.items : undefined;

  useEffect(() => {
    if (!orderCut) return;
    const controller = new AbortController();
    void purchaseRequests(AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]))
      .then(({ items }) => {
        if (!controller.signal.aborted) setPurchases({ orderCut, items: Array.isArray(items) ? items : null });
      })
      .catch(() => { if (!controller.signal.aborted) setPurchases({ orderCut, items: null }); });
    return () => controller.abort();
  }, [orderCut]);

  const fleetVerified = fetched && !equipmentError && dispatch.verified && Boolean(dispatch.operatingStatuses);
  const scopedStatuses = equipment.map(unit => dispatch.operatingStatuses?.get(normalizeUnitId(unit.unit_id)));
  const operating = scopedStatuses.filter(status => status === 'operativo').length;
  const known = scopedStatuses.filter(Boolean).length;
  const pending = panamaDashboardPendings({
    equipment, dispatch, fleetVerified, orders: exceptions.view, ordersUnavailable: exceptions.unavailable,
    review: pm.data ?? undefined, purchases: linkedPurchases ?? [],
  });
  const completeOrders = !!exceptions.view && !exceptions.unavailable && !exceptions.view.unconfirmed
    && !exceptions.view.alerts.some(row => row.pendingConfirmation);
  const completeAssignments = completeOrders && exceptions.view?.assignmentsChecked === true;
  const completePm = !!pm.data && pmReviewIsComplete(pm.data);
  const completeFleet = fleetVerified && known === equipment.length;
  const loading = (!fetched && !equipmentError) || dispatch.loading || exceptions.loading || pm.loading;
  const stopped = scopedStatuses.filter(status => status === 'inoperativo').length;
  const missingPartsLinks = linkedPurchases === null;
  const alerts = [
    !dispatch.loading && (!completeFleet || equipmentError) && 'Estado de flota pendiente de verificar.',
    !exceptions.loading && !completeAssignments && 'Consulta de OT incompleta.',
    !pm.loading && !completePm && 'Revisión PM incompleta.',
    missingPartsLinks && 'Pedidos vinculados sin consultar.',
  ].filter(Boolean).join(' ');
  const metrics = [
    { label: 'Flota operativa', value: known ? `${operating} / ${known}` : '—', icon: Activity, color: 'bg-emerald-50 text-emerald-800',
      note: known && !fleetVerified ? 'Último dato disponible'
        : known < equipment.length ? `${equipment.length - known} equipos sin confirmar`
          : known ? `${stopped} ${stopped === 1 ? 'inoperativo' : 'inoperativos'}` : 'Estado por verificar' },
    { label: 'OT sin asignar', value: metricCount(pending.filter(row => row.unassigned).length, completeAssignments),
      icon: Wrench, color: 'bg-blue-50 text-blue-900', note: completeAssignments ? 'Órdenes de Hermes' : 'Verificación pendiente' },
    { label: 'Por repuesto', value: metricCount(pending.filter(row => row.kind === 'parts').length, completeOrders),
      icon: Package, color: 'bg-amber-50 text-amber-900', note: completeOrders ? 'OT en espera' : 'Verificación pendiente' },
    { label: 'PM por revisar', value: metricCount(pending.filter(row => row.kind === 'pm').length, completePm),
      icon: ClipboardCheck, color: 'bg-slate-100 text-slate-800', note: completePm ? 'Equipos con observaciones' : 'Verificación pendiente' },
  ];
  const filtered = pending.filter(item => isPendingFilter(item, filter));
  const shown = filtered.slice(0, limit);
  const remaining = filtered.length - shown.length;
  const fleetCut = dispatch.operatingCheckedAt;

  function refresh() {
    setRevision(value => value + 1);
    void Promise.all([refetch(), dispatch.refresh(), exceptions.refresh()]);
  }

  return <div className="mx-auto w-full min-w-0 max-w-[1440px] space-y-4 py-3 sm:space-y-5 sm:py-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#162252] sm:text-3xl">Operaciones Panamá</h1>
        <p className="mt-1 text-sm text-slate-600">
          {data.alertsToday === null ? 'Averías de hoy por verificar' : `${data.alertsToday} ${data.alertsToday === 1 ? 'avería reportada hoy' : 'averías reportadas hoy'}`}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`${control} disabled:opacity-60`} disabled={loading} onClick={refresh} aria-label="Actualizar datos">
          <RefreshCw aria-hidden size={16} className={loading ? 'animate-spin motion-reduce:animate-none' : ''} /> Actualizar
        </button>
        <Link to="/falla" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#162252] px-3 text-sm font-semibold text-white hover:bg-blue-950">Reportar falla</Link>
      </div>
    </header>

    <section className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4" aria-label="Indicadores de operaciones">
      {metrics.map(({ label, value, icon: Icon, color, note }) => <div key={label} className="min-w-0 rounded-xl border border-slate-200 bg-white p-2.5 sm:p-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className={`hidden shrink-0 rounded-lg p-2 min-[360px]:inline-flex ${color}`}><Icon aria-hidden size={18} /></span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-700 sm:text-sm">{label}</p>
            <p className="mt-0.5 break-words text-xl font-bold tabular-nums text-[#162252] sm:text-2xl">{value}</p>
          </div>
        </div>
        <p className="mt-1.5 text-xs text-slate-600">{note}</p>
      </div>)}
    </section>

    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_13.5rem]">
      <section aria-labelledby="operating-pendings" className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="px-3 pb-3 pt-4 sm:px-4">
          <h2 id="operating-pendings" className="text-lg font-bold text-[#162252]">Pendientes operativos</h2>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Filtrar pendientes">
            {filters.map(({ value, label }) => <button key={value} type="button" aria-pressed={filter === value}
              onClick={() => { setFilter(value); setLimit(pageSize); }}
              className={`min-h-11 rounded-lg border px-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-700 ${filter === value
                ? 'border-[#162252] bg-[#162252] text-white' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-400'}`}>
              {label}
            </button>)}
          </div>
        </div>
        {loading && <p className="px-3 pb-2 text-sm text-slate-600 sm:px-4" role="status">Consultando fuentes…</p>}
        {alerts && <p role="status" className="mx-3 mb-3 flex items-start gap-2 rounded-lg bg-amber-50 px-2.5 py-2 text-sm text-amber-950 sm:mx-4">
          <AlertTriangle aria-hidden size={16} className="mt-0.5 shrink-0" />{alerts}
        </p>}
        {shown.length > 0 ? <>
          <div aria-hidden className={`hidden bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 xl:px-4 ${columns}`}>
            <span>Equipo</span><span>Pendiente</span><span>Responsable</span><span>Siguiente acción</span><span>Antigüedad</span>
          </div>
          <ul aria-label="Lista de pendientes operativos" className="divide-y divide-slate-200 border-t border-slate-200">
            {shown.map(item => <PendingRow key={item.id} item={item} />)}
          </ul>
        </> : !loading && <p role="status" className="px-3 py-4 text-sm text-slate-700 sm:px-4">
          {alerts ? 'Sin pendientes confirmados para este filtro. Revisa el estado de las fuentes.' : 'Sin pendientes para este filtro.'}
        </p>}
        {remaining > 0 && <div className="border-t border-slate-200 px-3 py-2 sm:px-4">
          <button type="button" className={control} onClick={() => setLimit(value => value + pageSize)}>
            Ver {Math.min(remaining, pageSize)} más <span className="text-slate-500">({remaining} {remaining === 1 ? 'restante' : 'restantes'})</span>
          </button>
        </div>}
      </section>

      <nav aria-label="Accesos de operaciones" className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2">
        <h2 className="px-1 py-1 text-sm font-bold text-[#162252]">Accesos</h2>
        <ul className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-1 xl:divide-y xl:divide-slate-100">
          {[...actions, ...(role === 'gerencia' ? adminActions : [])].map(({ to, label }) => <li key={to} className="min-w-0">
            <Link to={to} className="flex min-h-11 items-center justify-between gap-2 rounded-md px-1.5 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100 hover:text-[#162252]">
              {label}<ArrowRight aria-hidden size={14} className="shrink-0 text-slate-500" />
            </Link>
          </li>)}
          {role === 'supervisor' && <li>
            <button type="button" onClick={() => setShowBriefing(open => !open)} aria-expanded={showBriefing}
              className="flex min-h-11 w-full items-center gap-2 rounded-md px-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100">
              Briefing
            </button>
          </li>}
        </ul>
      </nav>
    </div>

    {showBriefing && role === 'supervisor' && <BriefingCard dispatch={dispatch} />}
    <details className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 sm:px-4">
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-[#162252]">Fuentes y cortes</summary>
      <div className="space-y-3 pb-4">
        {fleetCut && Number.isFinite(Date.parse(fleetCut)) && <p className="text-xs text-slate-600">
          Estado de flota · <time dateTime={fleetCut}>{cutFormat.format(new Date(fleetCut))}</time> · Panamá
        </p>}
        {exceptions.view && <p className="text-xs text-slate-600">
          Consulta de OT Hermes · <time dateTime={exceptions.view.observedAt}>{cutFormat.format(new Date(exceptions.view.observedAt))}</time> · Panamá
        </p>}
        {pm.data?.sources.maintenancePlan?.capturedAt && Number.isFinite(Date.parse(pm.data.sources.maintenancePlan.capturedAt)) && <p className="text-xs text-slate-600">
          Planes PM · <time dateTime={pm.data.sources.maintenancePlan.capturedAt}>{cutFormat.format(new Date(pm.data.sources.maintenancePlan.capturedAt))}</time> · Panamá
        </p>}
        <PanamaWorkshopSummary data={dispatch.workshop} loading={dispatch.loading} />
        {data.availabilityTrend.length > 0 && <AvailabilityChart data={data.availabilityTrend} loading={data.loading} />}
      </div>
    </details>
    {role === 'gerencia' && <details className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 sm:px-4">
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-[#162252]">Seguimiento de compras y finanzas</summary>
      <div className="pb-4"><PanamaFinanceHandoff /></div>
    </details>}
  </div>;
}
