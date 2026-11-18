import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, RefreshCw } from 'lucide-react';
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

const pageSize = 6;
const filters: [PendingFilter, string][] = [
  ['all', 'Todos'], ['stopped', 'Detenidos'], ['unassigned', 'Sin asignar'], ['parts', 'Por repuesto'], ['pm', 'PM por revisar'],
];

const pendingColors: Record<DashboardPending['kind'], string> = {
  stopped: 'bg-red-600', critical: 'bg-red-600', parts: 'bg-amber-600',
  assignment: 'bg-amber-600', return: 'bg-blue-600', pm: 'bg-slate-500',
};
const cutFormat = new Intl.DateTimeFormat('es-PA', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Panama' });
const panel = 'min-w-0 rounded-xl border border-slate-200 bg-white';
const summary = 'min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold text-[#162252]';
const textLink = 'inline-flex min-h-11 items-center text-sm font-semibold text-[#162252] underline decoration-slate-300 underline-offset-4 hover:decoration-slate-800';

function PendingRow({ item }: { item: DashboardPending }) {
  const age = item.date ? pendingAge(item.date.day) : null;
  return <li className="flex min-w-0 items-stretch">
    <Link to={item.href} aria-label={[item.unit, item.folio, item.title, item.unverified && 'Por confirmar', item.action].filter(Boolean).join(' · ')}
      className="flex min-h-13 min-w-0 flex-1 items-center gap-2.5 px-3 py-1.5 hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-700">
      <span className={`size-2 shrink-0 rounded-full ${pendingColors[item.kind]}`} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-bold leading-tight text-[#162252]">{item.unit}</span>
          {item.folio && <span className="text-xs text-slate-600">{item.folio}</span>}
        </span>
        <span className="block text-sm leading-tight text-slate-700">
          {item.title}{item.unverified && <span className="text-amber-900"> · por confirmar</span>}
        </span>
      </span>
      {age !== null && item.date && <time dateTime={item.date.day} title={`${item.date.label} · ${pendingDateLabel(item.date.day)}`}
        aria-label={`${item.date.label} ${age === 0 ? 'hoy' : age === 1 ? 'hace 1 día' : `hace ${age} días`}`}
        className="shrink-0 text-xs tabular-nums text-slate-600">{age === 0 ? 'Hoy' : `${age} d`}</time>}
      <ChevronRight aria-hidden size={16} className="shrink-0 text-slate-500" />
    </Link>
    {item.purchaseHref && <Link to={item.purchaseHref} aria-label={`Ver pedidos vinculados · ${item.unit}`}
      className="flex min-h-11 shrink-0 items-center border-l border-slate-200 px-2.5 text-xs font-semibold text-blue-900 hover:bg-blue-50">
      Pedidos
    </Link>}
  </li>;
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
  const partial = [
    !dispatch.loading && !completeFleet && 'Flota',
    !exceptions.loading && (!completeOrders || !completeAssignments) && 'OT',
    !pm.loading && !completePm && 'PM',
    linkedPurchases === null && 'Pedidos',
  ].filter(Boolean).join(', ');
  const coverage: Record<PendingFilter, boolean> = { all: false, stopped: completeFleet, unassigned: completeAssignments, parts: completeOrders, pm: completePm };
  const filtered = pending.filter(item => isPendingFilter(item, filter));
  const shown = filtered.slice(0, limit);
  const remaining = filtered.length - shown.length;
  const cuts = [
    { label: 'Flota', date: dispatch.operatingCheckedAt },
    { label: 'OT', date: exceptions.view?.observedAt },
    { label: 'PM', date: pm.data?.sources.maintenancePlan?.capturedAt },
  ];

  function refresh() {
    setRevision(value => value + 1);
    void Promise.all([refetch(), dispatch.refresh(), exceptions.refresh()]);
  }

  return <div className="mx-auto w-full min-w-0 max-w-4xl space-y-3 pb-3 sm:py-3">
    <header>
      <div className="flex min-h-11 items-center justify-between gap-2">
        <h1 className="text-xl font-bold tracking-tight text-[#162252] sm:text-2xl">Operaciones Panamá</h1>
        <button type="button" className="grid size-11 shrink-0 place-items-center rounded-lg text-[#162252] hover:bg-white disabled:opacity-50"
          disabled={loading} onClick={refresh} aria-label="Actualizar datos" title="Actualizar datos">
          <RefreshCw aria-hidden size={18} className={loading ? 'animate-spin motion-reduce:animate-none' : ''} />
        </button>
      </div>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <Link to="/fleet" className="inline-flex min-h-11 items-center text-sm font-semibold text-[#162252] underline decoration-slate-400 underline-offset-4">
            {known ? `${operating}/${known} operativos` : 'Flota'}
          </Link>
          {known > 0 && !fleetVerified && <span className="block text-xs text-slate-600">Último dato</span>}
        </div>
        <Link to="/falla" className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-[#162252] px-3 text-sm font-semibold text-white hover:bg-blue-950">Reportar falla</Link>
      </div>
    </header>

    <section aria-labelledby="operating-pendings" className={panel}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <h2 id="operating-pendings" className="text-base font-bold text-[#162252]">Pendientes</h2>
        <select aria-label="Filtrar pendientes" value={filter}
          onChange={event => { setFilter(event.target.value as PendingFilter); setLimit(pageSize); }}
          className="min-h-11 max-w-full rounded-lg border border-slate-300 bg-white pl-2 pr-1 text-sm font-medium text-slate-800">
          {filters.map(([value, label]) => <option key={value} value={value}>
            {coverage[value] ? `${label} (${pending.filter(item => isPendingFilter(item, value)).length})` : label}
          </option>)}
        </select>
      </div>
      {partial && <p role="status" className="border-t border-amber-100 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-950">
        Datos parciales · {partial}
      </p>}
      {shown.length > 0 ? <ul aria-label="Lista de pendientes operativos" className="divide-y divide-slate-200 border-t border-slate-200">
        {shown.map(item => <PendingRow key={item.id} item={item} />)}
      </ul> : <p role="status" className="border-t border-slate-200 px-3 py-3 text-sm text-slate-600">
        {loading ? 'Cargando…' : partial && !coverage[filter] ? 'Sin datos confirmados' : 'Sin pendientes'}
      </p>}
      {remaining > 0 && <div className="border-t border-slate-200 px-3">
        <button type="button" className={textLink} onClick={() => setLimit(value => value + pageSize)}>Ver más ({remaining})</button>
      </div>}
    </section>

    <nav aria-label="Accesos de operaciones" className="flex flex-wrap items-center gap-x-5">
      <Link to="/pm" className={textLink}>PM</Link>
      <Link to="/inventory" className={textLink}>Inventario</Link>
      <Link to="/panama/tiempo-caido" className={textLink}>Tiempo caído</Link>
      {role === 'supervisor' && <button type="button" className={textLink} aria-expanded={showBriefing}
        onClick={() => setShowBriefing(open => !open)}>Briefing</button>}
    </nav>

    {showBriefing && role === 'supervisor' && <BriefingCard dispatch={dispatch} />}
    {role === 'gerencia' && <details className={panel}>
      <summary className={summary}>Finanzas</summary>
      <div className="px-3 pb-3"><PanamaFinanceHandoff /></div>
    </details>}
    <details className={panel}>
      <summary className={summary}>Fuentes</summary>
      <div className="space-y-2 px-3 pb-3 text-sm text-slate-600">
        {cuts.map(({ label, date }) => date && Number.isFinite(Date.parse(date)) && <p key={label}>
          {label} · <time dateTime={date}>{cutFormat.format(new Date(date))}</time>
        </p>)}
        <Link to="/panama" className={textLink}>Maestros TMF</Link>
        {data.alertsToday !== null && <p>Averías hoy · {data.alertsToday}</p>}
        {data.availabilityTrend.length > 0 && <AvailabilityChart data={data.availabilityTrend} loading={data.loading} />}
      </div>
    </details>
  </div>;
}
