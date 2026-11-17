import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, AlertTriangle, Fuel, Bell, RefreshCw, Package, ShoppingCart, Building2 } from 'lucide-react';
import { useEquipmentList } from '../../hooks/useEquipmentList';
import { useDashboardData } from '../../hooks/useDashboardData';
import { useAuthStore } from '../../stores/auth-store';
import KPICard from '../ui/KPICard';
import { SkeletonKPI } from '../ui/Skeleton';
import FleetGrid from './FleetGrid';
import AvailabilityChart from './AvailabilityChart';
import AccionesDelDia from './AccionesDelDia';
import BriefingCard from './BriefingCard';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import PullIndicator from '../ui/PullIndicator';

type Tab = 'general' | 'briefing' | 'pedidos' | 'datos';

const TABS: { id: Tab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'briefing', label: 'Briefing' },
  { id: 'pedidos', label: 'Pedidos' },
  { id: 'datos', label: 'Datos' },
];

export default function ExecutiveDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const navigate = useNavigate();
  const equipment = useEquipmentList();
  const data = useDashboardData();
  const role = useAuthStore((s) => s.role);

  const handleRefresh = useCallback(async () => {
    data.refresh();
  }, [data]);

  const { scrollRef, onTouchStart, onTouchMove, onTouchEnd, pullDistance, refreshing, pullIndicatorStyle, isReady } =
    usePullToRefresh({ onRefresh: handleRefresh });

  return (
    <div
      ref={scrollRef}
      className={`mx-auto flex w-full min-w-0 max-w-6xl flex-col py-3 transition-opacity ${data.loading ? 'opacity-60' : 'opacity-100'}`}
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
      <div className="mb-4 flex min-w-0 items-center gap-2">
        <div className="grid min-w-0 flex-1 grid-cols-4 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => tab.id === 'datos' ? navigate('/data') : setActiveTab(tab.id)}
              aria-pressed={tab.id === 'datos' ? undefined : activeTab === tab.id}
              className={`min-h-11 min-w-0 rounded-full border px-1 text-xs font-medium transition-colors sm:px-4 sm:text-sm ${
                activeTab === tab.id
                  ? 'border-teal bg-teal text-white'
                  : 'border-border bg-card text-text-secondary hover:text-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={data.refresh}
          disabled={data.loading}
          className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-card text-text-secondary transition-colors hover:text-text disabled:opacity-40"
          aria-label="Actualizar datos"
        >
          <RefreshCw size={16} className={data.loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* General tab */}
      {activeTab === 'general' && (
        <div className="flex flex-col gap-4">
          {/* KPI row */}
          {data.loading ? (
            <div className="grid min-w-0 grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
              <SkeletonKPI />
              <SkeletonKPI />
              <SkeletonKPI />
              <SkeletonKPI />
            </div>
          ) : (
            <div className="grid min-w-0 grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
              <KPICard
                icon={<Activity size={20} />}
                value={`${data.availability}%`}
                label="Disponibilidad"
                color="#16A34A"
              />
              <KPICard
                icon={<AlertTriangle size={20} />}
                value={data.criticalOTs}
                label="OTs Críticas"
                color="#DC2626"
              />
              <KPICard
                icon={<Fuel size={20} />}
                value={data.avgConsumption}
                label="Consumo Promedio"
                color="#2563EB"
              />
              <KPICard
                icon={<Bell size={20} />}
                value={String(data.alertsToday)}
                label="Alertas Hoy"
                color="#F59E0B"
              />
            </div>
          )}

          {/* Fleet grid */}
          <FleetGrid equipment={equipment} />

          {/* Availability chart */}
          <AvailabilityChart data={data.availabilityTrend} />

          {/* Daily actions */}
          <AccionesDelDia />

          {/* Admin shortcuts (Gerencia only) */}
          {role === 'gerencia' && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
                Administración
              </p>
              <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
                <Link
                  to="/admin/activos"
                  className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-blue-400"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <Package size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text">Activos</p>
                    <p className="text-xs text-text-secondary">Ciclo de vida</p>
                  </div>
                </Link>
                <Link
                  to="/admin/proveedores"
                  className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-blue-400"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <Building2 size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text">Proveedores</p>
                    <p className="text-xs text-text-secondary">Catálogo</p>
                  </div>
                </Link>
                <Link
                  to="/admin/ordenes-compra"
                  className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-blue-400"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <ShoppingCart size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text">Órdenes de Compra</p>
                    <p className="text-xs text-text-secondary">Crear OC</p>
                  </div>
                </Link>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Briefing tab */}
      {activeTab === 'briefing' && <BriefingCard />}

      {/* Pedidos tab */}
      {activeTab === 'pedidos' && (
        <div className="flex items-center justify-center py-16">
          <p className="text-text-secondary">Pedidos de Repuestos — Próximamente</p>
        </div>
      )}
    </div>
  );
}
