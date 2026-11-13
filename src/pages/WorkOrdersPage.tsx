import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkOrderStore } from '../stores/workorder-store';
import OTCard from '../components/ui/OTCard';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonList } from '../components/ui/Skeleton';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import PullIndicator from '../components/ui/PullIndicator';
import PanamaSourceRecords from '../components/workshop/PanamaSourceRecords';
import { useAuthStore } from '../stores/auth-store';

type FilterKey = 'Todas' | 'CRITICA' | 'ALTA' | 'MEDIA' | 'Abierta' | 'En Reparación' | 'Esperando Pieza' | 'Resuelta' | 'Completado';

const FILTER_OPTIONS: FilterKey[] = ['Todas', 'CRITICA', 'ALTA', 'MEDIA', 'Abierta', 'En Reparación', 'Esperando Pieza', 'Resuelta', 'Completado'];

const FILTER_LABELS: Record<FilterKey, string> = {
  Todas: 'Todas',
  CRITICA: 'Critica',
  ALTA: 'Alta',
  MEDIA: 'Media',
  Abierta: 'Abierta',
  'En Reparación': 'En Reparación',
  'Esperando Pieza': 'Esperando Pieza',
  Resuelta: 'Resuelta',
  Completado: 'Cerradas',
};

export default function WorkOrdersPage() {
  const navigate = useNavigate();
  const showMaster = useAuthStore(state => state.project === 'tmf-panama' && state.role !== 'mecanico');
  const { workorders, loading, error, fetched, fetchWorkOrders } = useWorkOrderStore();
  const [filter, setFilter] = useState<FilterKey>('Todas');

  const { scrollRef, onTouchStart, onTouchMove, onTouchEnd, pullDistance, refreshing, pullIndicatorStyle, isReady } =
    usePullToRefresh({ onRefresh: fetchWorkOrders });

  useEffect(() => {
    if (!fetched) {
      fetchWorkOrders();
    }
  }, [fetched, fetchWorkOrders]);

  const filtered = workorders.filter((ot) => {
    if (filter === 'Todas') return true;
    if (filter === 'Abierta' && ot.estado === 'En Espera de Asignación') return true;
    return ot.prioridad?.toUpperCase() === filter || ot.estado === filter;
  });

  if (loading && !fetched) {
    return (
      <div className="py-4">
        <h2 className="font-semibold text-lg text-text mb-3">Órdenes de Trabajo</h2>
        <SkeletonList count={4} />
      </div>
    );
  }

  if (error && workorders.length === 0) {
    return (
      <div className="py-4">
        <h2 className="font-semibold text-lg text-text mb-3">Órdenes de Trabajo</h2>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-900" role="alert">{showMaster ? 'No se pudieron consultar las órdenes de Hermes.' : error}</p>
          <button
            type="button"
            onClick={() => fetchWorkOrders()}
            className="min-h-10 rounded-lg bg-[#162252] px-3 text-sm font-semibold text-white"
          >
            Reintentar
          </button>
        </div>
        {showMaster && <PanamaSourceRecords source="orders" />}
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="py-4 animate-fade-up overflow-y-auto"
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

      <h2 className="font-semibold text-lg text-text mb-3">Órdenes de Trabajo</h2>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1 mb-2">
        {FILTER_OPTIONS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap shrink-0 transition-colors ${
              filter === key
                ? 'bg-amber text-white'
                : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
            }`}
          >
            {FILTER_LABELS[key]}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          type="workorders"
          title="Sin órdenes"
          description="No hay órdenes de trabajo de Hermes con este filtro"
        />
      ) : (
        filtered.map((ot) => (
          <OTCard
            key={ot.ot_id}
            workorder={ot}
            onClick={() => navigate(`/workorders/${ot.ot_id}`)}
          />
        ))
      )}
      {showMaster && fetched && filter === 'Todas' && <div className="mt-4"><PanamaSourceRecords source="orders" /></div>}
    </div>
  );
}
