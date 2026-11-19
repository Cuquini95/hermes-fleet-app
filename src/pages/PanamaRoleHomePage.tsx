import { useEffect, useState } from 'react';
import { ArrowRight, FileText } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { panamaRoleHome, type PanamaHomeAction } from '../data/panama-role-homes.js';
import { useApiHealth } from '../hooks/useApiHealth';
import { NAV_ICONS } from '../lib/nav-icons';
import { panamaHomeActions } from '../lib/panama-home-actions';
import { purchaseRead, type PurchaseOverview } from '../lib/purchasing-api';
import { sessionHome } from '../lib/purchasing-home';
import { useAuthStore } from '../stores/auth-store';
import { useWorkOrderStore } from '../stores/workorder-store';

const serviceLabels = {
  identity: 'Identidad',
  fleet: 'Flota',
  operations: 'Operación',
  masters: 'Maestros',
  evidence: 'Adjuntos',
} as const;

function ServiceStatus() {
  const health = useApiHealth();
  return <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4" aria-label="Estado técnico">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-semibold">Estado técnico</h2>
      <button type="button" className="min-h-11 rounded-lg px-3 text-sm font-semibold text-blue-800"
        onClick={() => void health.refresh()}>Actualizar</button>
    </div>
    <dl className="space-y-2 text-sm">
      {Object.entries(serviceLabels).map(([key, label]) => {
        const status = health.checks?.[key as keyof typeof serviceLabels];
        return <div key={key} className="flex justify-between gap-4">
          <dt>{label}</dt>
          <dd className={status === 'up' ? 'text-emerald-800' : 'text-slate-600'}>
            {status === 'up' ? 'Disponible' : status === 'down' ? 'Por revisar' : 'Sin datos'}
          </dd>
        </div>;
      })}
    </dl>
    {health.deployment?.commit && <p className="text-xs text-slate-600">
      Versión {health.deployment.commit.slice(0, 8)} · {health.deployment.environment === 'production' ? 'Producción' : 'Prueba'}
    </p>}
    {health.lastChecked && <p className="text-xs text-slate-600">Consulta {health.lastChecked.toLocaleTimeString('es-PA', {
      hour: 'numeric', minute: '2-digit', timeZone: 'America/Panama',
    })} · Panamá</p>}
  </section>;
}

function WorkOrderCount() {
  const { workorders, error, fetched, fetchWorkOrders } = useWorkOrderStore();
  useEffect(() => {
    if (!fetched) void fetchWorkOrders();
  }, [fetched, fetchWorkOrders]);
  if (error) return 'Por conciliar';
  if (!fetched) return 'Consultando…';
  const active = workorders.filter(order => order.estado !== 'Completado').length;
  return active === 0 ? 'Sin OT abiertas' : active === 1 ? '1 OT abierta' : `${active} OT abiertas`;
}

function PrimaryStatus({ action }: { action: PanamaHomeAction }) {
  const [status, setStatus] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    const read = async () => {
      if (action === 'approve') {
        const data = await purchaseRead<PurchaseOverview>('orders', undefined, controller.signal);
        const pending = data.orders.filter(order => order.status === 'Borrador').length;
        return pending === 0 ? 'Sin OC pendientes' : `${pending} por aprobar`;
      }
      if (action === 'partQueue' || action === 'warehouseQueue') {
        const data = await purchaseRead<{ items: { state: string; closed: boolean }[] }>('ot-part-needs', undefined, controller.signal);
        const pending = data.items.filter(item => !item.closed && item.state === (
          action === 'partQueue' ? 'Por revisar en Taller' : 'Autorizada'
        )).length;
        return pending === 0 ? 'Sin solicitudes pendientes' : `${pending} por atender`;
      }
    };
    void read().then(value => {
      if (!controller.signal.aborted) setStatus(value);
    }).catch(() => {
      if (!controller.signal.aborted) setStatus('Por conciliar');
    });
    return () => controller.abort();
  }, [action]);

  if (action === 'orders') return <span className="mt-1 block text-sm text-blue-100"><WorkOrderCount /></span>;
  return status ? <span className="mt-1 block text-sm text-blue-100">{status}</span> : null;
}

function RoleHome({ account, home }: {
  account: ReturnType<typeof useAuthStore.getState>;
  home: NonNullable<ReturnType<typeof panamaRoleHome>>;
}) {
  const [primary, ...actions] = panamaHomeActions(account);
  const PrimaryIcon = (primary && NAV_ICONS[primary.icon]) ?? FileText;
  const units = account.assignedUnits;
  const context = account.unitScope !== 'assigned' ? '' : units.length > 0
    ? ` · ${units.slice(0, 2).join(', ')}${units.length > 2 ? ` +${units.length - 2}` : ''}`
    : ' · Sin unidad asignada';

  return <div className="mx-auto max-w-3xl space-y-4 px-3 py-5 sm:px-5 sm:py-8">
    <header className="min-w-0">
      <p className="mb-1 break-words text-sm font-semibold text-slate-600">TMF · Panamá{context}</p>
      <h1 className="break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{home.title}</h1>
    </header>
    {primary && <Link data-position-action to={primary.path}
        className="flex min-h-20 min-w-0 items-center gap-3 rounded-2xl bg-[#205cda] p-4 text-white shadow-sm hover:bg-blue-800">
        <PrimaryIcon className="shrink-0" size={23} aria-hidden />
        <span className="min-w-0 flex-1 break-words">
          <span className="block text-base font-bold">{primary.label}</span>
          <PrimaryStatus action={primary.id} />
        </span>
        <ArrowRight className="shrink-0" size={20} aria-hidden />
      </Link>}
    {actions.length > 0 && <ul className="grid grid-cols-2 gap-2 sm:gap-3" aria-label="Accesos del puesto">
      {actions.map(item => {
        const Icon = NAV_ICONS[item.icon] ?? FileText;
        return <li key={item.id} className="min-w-0">
          <Link to={item.path} className="flex h-full min-h-16 min-w-0 flex-col justify-center gap-1.5 rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-800 hover:border-blue-400 sm:flex-row sm:items-center sm:justify-start sm:gap-2">
            <Icon className="shrink-0 text-blue-800" size={18} aria-hidden />
            <span className="break-words">{item.label}</span>
          </Link>
        </li>;
      })}
    </ul>}
    {account.positionCode === 'TP-PER-026' && <ServiceStatus />}
    {!primary && <p className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">Acceso por conciliar.</p>}
    {home.pending && <p className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
      {home.pending} · <strong>Por conciliar</strong>
    </p>}
  </div>;
}

export default function PanamaRoleHomePage() {
  const account = useAuthStore();
  const home = panamaRoleHome(account);
  if (!home) return <Navigate to={sessionHome(account)} replace />;
  return <RoleHome key={account.userId + ':' + account.positionCode} account={account} home={home} />;
}
