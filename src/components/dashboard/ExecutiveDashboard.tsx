import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, AlertTriangle, Fuel, Bell, RefreshCw, Package, ShoppingCart, Building2 } from 'lucide-react';
import { useEquipmentList } from '../../hooks/useEquipmentList';
import { useDashboardData } from '../../hooks/useDashboardData';
import { usePanamaWorkshopExceptions } from '../../hooks/usePanamaWorkshopExceptions';
import { useFleetDispatch, type WorkshopRecord } from '../../hooks/useFleetDispatch';
import { dispatchAvailability } from '../../lib/availability';
import { useEquipmentStore } from '../../stores/equipment-store';
import { useAuthStore } from '../../stores/auth-store';
import KPICard from '../ui/KPICard';
import { SkeletonKPI } from '../ui/Skeleton';
import FleetGrid from './FleetGrid';
import AvailabilityChart from './AvailabilityChart';
import AccionesDelDia from './AccionesDelDia';
import BriefingCard from './BriefingCard';
import PanamaFinanceHandoff from './PanamaFinanceHandoff';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import PullIndicator from '../ui/PullIndicator';
import PanamaSourceRecords from '../workshop/PanamaSourceRecords';
import PanamaWorkshopSummary from './PanamaWorkshopSummary';
import PanamaFuelReconciliation from './PanamaFuelReconciliation';
import { PanamaWorkshopExceptions } from './PanamaWorkshopExceptions';

type Tab = 'general' | 'briefing' | 'pedidos' | 'datos';

const TABS: { id: Tab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'briefing', label: 'Briefing' },
  { id: 'pedidos', label: 'Pedidos' },
  { id: 'datos', label: 'Datos' },
];

export default function ExecutiveDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [showCriticalOrders, setShowCriticalOrders] = useState(false);
  const navigate = useNavigate();
  const equipment = useEquipmentList();
  const dispatch = useFleetDispatch(equipment);
  const role = useAuthStore((s) => s.role);
  const project = useAuthStore((s) => s.project);
  const isPanama = project === 'tmf-panama';
  const demo = useAuthStore((s) => s.previewDemo);
  const showWorkshopExceptions = isPanama && (role === 'gerencia' || role === 'supervisor');
  const exceptions = usePanamaWorkshopExceptions(showWorkshopExceptions);
  const { refresh: refreshExceptions } = exceptions;
  const useWorkshopMaster = isPanama && !demo;
  const data = useDashboardData(equipment, useWorkshopMaster, dispatch.workshop);
  const orderSection = dispatch.workshop?.orders;
  const completeOrderSources = orderSection?.masterAvailable && orderSection.operationalAvailable;
  const criticalOrders = dispatch.workshop?.criticalOrders ?? [];
  const ordersWithoutPriority = dispatch.workshop?.ordersWithoutPriority ?? [];
  const criticalCount = completeOrderSources ? data.criticalOTs : null;
  const criticalCut = orderSection?.capturedAt;
  const equipmentError = useEquipmentStore((state) => state.error);
  const { refresh: refreshData } = data;
  const { refresh: refreshDispatch } = dispatch;
  const snapshot = dispatchAvailability(equipment, dispatch.readiness, dispatch.verified && !dispatch.loading && !equipmentError);
  const operatingCount = dispatch.operatingStatuses
    ? equipment.filter(unit => dispatch.operatingStatuses?.get(unit.unit_id) === 'operativo').length : null;
  const operatingKnown = dispatch.operatingStatuses
    ? equipment.filter(unit => dispatch.operatingStatuses?.has(unit.unit_id)).length : 0;
  const refreshAll = useCallback(() => {
    refreshData();
    return Promise.all([refreshDispatch(), refreshExceptions()]);
  }, [refreshData, refreshDispatch, refreshExceptions]);

  const handleRefresh = useCallback(async () => {
    await refreshAll();
  }, [refreshAll]);

  const { scrollRef, onTouchStart, onTouchMove, onTouchEnd, pullDistance, refreshing, pullIndicatorStyle, isReady } =
    usePullToRefresh({ onRefresh: handleRefresh });

  return (
    <div
      ref={scrollRef}
      className={`flex flex-col py-4 overflow-y-auto transition-opacity ${data.loading ? 'opacity-60' : 'opacity-100'}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <PullIndicator
        pullDistance={pullDistance}
        refreshing={refreshing}
        isReady={isReady}
        style={pullIndicatorStyle}
      />
      {/* Tab pills */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              if (tab.id === 'pedidos' || tab.id === 'datos') navigate(tab.id === 'pedidos' ? '/pedidos' : '/data');
              else setActiveTab(tab.id);
            }}
            className={`px-3 py-1.5 rounded-full text-sm sm:px-4 font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-white'
                : 'bg-card border border-border text-text-secondary hover:text-text'
            }`}
            style={activeTab === tab.id ? { backgroundColor: '#162252' } : undefined}
          >
            {isPanama && tab.id === 'general' ? 'Resumen' : tab.label}
          </button>
        ))}
        <button
          onClick={refreshAll}
          disabled={data.loading}
          className="ml-auto p-1.5 rounded-full text-text-secondary hover:text-text hover:bg-card border border-transparent hover:border-border transition-colors disabled:opacity-40"
          aria-label="Actualizar datos"
        >
          <RefreshCw size={16} className={data.loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* General tab */}
      {activeTab === 'general' && (
        <div className="flex flex-col gap-4">
          {isPanama && (
            <div className="flex flex-wrap gap-2">
              <Link to="/falla" className="inline-flex min-h-11 items-center rounded-lg bg-[#162252] px-3 text-sm font-semibold text-white">
                Reportar falla
              </Link>
              <Link to="/panama" className="inline-flex min-h-11 items-center rounded-lg border border-border bg-card px-3 text-sm font-semibold text-text">
                Maestros TMF
              </Link>
              <Link to="/panama/tiempo-caido" className="inline-flex min-h-11 items-center rounded-lg border border-border bg-card px-3 text-sm font-semibold text-text">
                Tiempo caído
              </Link>
            </div>
          )}
          {data.error && (
            <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              <span>{data.error}</span>
            </p>
          )}

          {/* KPI row */}
          {data.loading ? (
            <div className="grid grid-cols-2 gap-3">
              <SkeletonKPI />
              <SkeletonKPI />
              <SkeletonKPI />
              <SkeletonKPI />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <KPICard
                icon={<Activity size={20} />}
                value={useWorkshopMaster ? (operatingCount === null || operatingKnown === 0 ? '—' : `${operatingCount}/${operatingKnown}`)
                  : snapshot.pct === null ? 'Sin verificar' : `${snapshot.pct}%`}
                label={useWorkshopMaster ? (operatingKnown > 0 && operatingKnown < equipment.length ? 'Equipos operativos · unidades con dato' : 'Equipos operativos')
                  : snapshot.available === null ? 'Aptos para despacho' : `Aptos para despacho · ${snapshot.available}/${snapshot.total}`}
                color="#16A34A"
              />
              {useWorkshopMaster ? (
                <button type="button" className="text-left"
                  aria-label="Ver OT críticas" aria-expanded={showCriticalOrders}
                  aria-controls={showCriticalOrders ? 'ot-criticas-detalle' : undefined}
                  onClick={() => setShowCriticalOrders(open => !open)}>
                  <KPICard icon={<AlertTriangle size={20} />} label="OTs Críticas" color="#DC2626"
                    value={criticalCount ?? (criticalOrders.length === 1 ? '1 confirmada'
                      : criticalOrders.length ? `${criticalOrders.length} confirmadas` : 'Sin verificar')} />
                </button>
              ) : (
                <KPICard icon={<AlertTriangle size={20} />} label="OTs Críticas" color="#DC2626"
                  value={data.criticalOTs ?? '—'} />
              )}
              <KPICard
                icon={<Fuel size={20} />}
                value={data.avgConsumption}
                label="Diésel promedio por carga"
                color="#2563EB"
              />
              <KPICard
                icon={<Bell size={20} />}
                value={data.alertsToday ?? (useWorkshopMaster ? 'Sin verificar' : '—')}
                label="Averías hoy"
                color="#F59E0B"
              />
            </div>
          )}

          {useWorkshopMaster && showCriticalOrders && (
            <section id="ot-criticas-detalle" aria-label="Detalle de OT críticas"
              className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-text">OT críticas</h3>
              {criticalCut && Number.isFinite(Date.parse(criticalCut)) && (
                <details className="mt-1 text-xs text-text-secondary">
                  <summary className="cursor-pointer">Corte del Maestro</summary>
                  <p><time dateTime={criticalCut}>{new Date(criticalCut).toLocaleString('es-PA', {
                    timeZone: 'America/Panama', dateStyle: 'medium', timeStyle: 'short',
                  })}</time> · Panamá</p>
                </details>
              )}
              {criticalCount === 0 && <p className="mt-2 text-sm text-text-secondary">No hay OT críticas abiertas.</p>}
              {!completeOrderSources && <p className="mt-2 text-sm text-amber-800">Falta confirmar una fuente de órdenes de trabajo.</p>}
              {completeOrderSources && criticalCount === null && !ordersWithoutPriority.length && (
                <p className="mt-2 text-sm text-amber-800">Hay estados de órdenes que requieren verificación.</p>
              )}
              <OrderList label="Críticas confirmadas" records={criticalOrders} />
              <OrderList label="Prioridad pendiente de confirmar" records={ordersWithoutPriority} />
            </section>
          )}
          {showWorkshopExceptions && <PanamaWorkshopExceptions {...exceptions} />}
          {useWorkshopMaster && <PanamaWorkshopSummary data={dispatch.workshop} loading={dispatch.loading} card />}
          {useWorkshopMaster && <PanamaFuelReconciliation data={data.fuelReconciliation} />}
          {isPanama && !useWorkshopMaster && data.error && <PanamaSourceRecords source="orders" limit={3} />}

          {/* Fleet grid */}
          <FleetGrid equipment={equipment} dispatch={dispatch} operatingOnly={useWorkshopMaster} />

          {/* Availability chart */}
          <AvailabilityChart data={data.availabilityTrend} loading={data.loading} />

          {/* Daily actions */}
          {!useWorkshopMaster && <AccionesDelDia exceptions={snapshot.exceptions} readiness={dispatch.readiness} verified={snapshot.pct !== null} />}

          {role === 'gerencia' && isPanama && <PanamaFinanceHandoff />}

          {/* Admin shortcuts (Gerencia only) */}
          {role === 'gerencia' && (
            <section aria-label="Administración" className="mt-2">
              {!isPanama && <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
                Admin
              </p>}
              <div className={isPanama ? 'grid gap-3 sm:grid-cols-3' : 'grid grid-cols-3 gap-3'}>
                <Link
                  to="/admin/activos"
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:border-blue-400 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <Package size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text">Activos</p>
                    {!isPanama && <p className="text-xs text-text-secondary truncate">Ciclo de vida</p>}
                  </div>
                </Link>
                <Link
                  to="/admin/proveedores"
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:border-blue-400 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <Building2 size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text">Proveedores</p>
                    {!isPanama && <p className="text-xs text-text-secondary truncate">Catálogo</p>}
                  </div>
                </Link>
                <Link
                  to="/admin/ordenes-compra"
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:border-blue-400 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <ShoppingCart size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text">Órdenes de Compra</p>
                    {!isPanama && <p className="text-xs text-text-secondary truncate">Crear OC</p>}
                  </div>
                </Link>
              </div>
            </section>
          )}

        </div>
      )}

      {/* Briefing tab */}
      {activeTab === 'briefing' && <BriefingCard dispatch={dispatch} />}

    </div>
  );
}

function OrderList({ label, records }: { label: string; records: WorkshopRecord[] }) {
  if (records.length === 0) return null;
  return (
    <div className="mt-2 text-sm">
      <h4 className="font-semibold text-text">{label}</h4>
      <ul aria-label={label} className="mt-1 space-y-1 text-text-secondary">
        {records.map(order => <li key={`${order.source}-${order.id}`}>
          {order.id} · {order.unit} · {order.source === 'master' ? 'Maestro de Taller' : 'Hermes'}
          {order.needsReview && ' · Estado por conciliar'}
        </li>)}
      </ul>
    </div>
  );
}
