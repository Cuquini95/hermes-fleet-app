import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkOrderStore } from '../stores/workorder-store';
import OTCard from '../components/ui/OTCard';

type FilterKey = 'Todas' | 'CRITICA' | 'ALTA' | 'MEDIA' | 'Nuevo' | 'En Proceso';

const FILTER_OPTIONS: FilterKey[] = ['Todas', 'CRITICA', 'ALTA', 'MEDIA', 'Nuevo', 'En Proceso'];

const FILTER_LABELS: Record<FilterKey, string> = {
  Todas: 'Todas',
  CRITICA: 'Critica',
  ALTA: 'Alta',
  MEDIA: 'Media',
  Nuevo: 'Nuevo',
  'En Proceso': 'En Proceso',
};

export default function WorkOrdersPage() {
  const navigate = useNavigate();
  const { workorders, loading, error, fetched, fetchWorkOrders } = useWorkOrderStore();
  const [filter, setFilter] = useState<FilterKey>('Todas');

  useEffect(() => {
    if (!fetched) {
      fetchWorkOrders();
    }
  }, [fetched, fetchWorkOrders]);

  const filtered = filter === 'Todas'
    ? workorders
    : workorders.filter((ot) =>
        ot.prioridad === filter || ot.estado === filter
      );

  if (loading && !fetched) {
    return (
      <div className="py-4">
        <h2 className="font-semibold text-lg text-text mb-3">Ordenes de Trabajo</h2>
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber border-t-transparent" />
        </div>
      </div>
    );
  }

  if (error && workorders.length === 0) {
    return (
      <div className="py-4">
        <h2 className="font-semibold text-lg text-text mb-3">Ordenes de Trabajo</h2>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-border text-center">
          <p className="text-red-600 text-sm mb-2">Error al cargar ordenes</p>
          <p className="text-xs text-text-secondary mb-3">{error}</p>
          <button
            type="button"
            onClick={() => fetchWorkOrders()}
            className="px-4 py-2 bg-amber text-white rounded-xl text-sm font-medium"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-4">
      <h2 className="font-semibold text-lg text-text mb-3">Ordenes de Trabajo</h2>

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
        <div className="bg-white rounded-xl p-6 shadow-sm border border-border text-center">
          <p className="text-text-secondary text-sm">No hay ordenes con este filtro</p>
        </div>
      ) : (
        filtered.map((ot) => (
          <OTCard
            key={ot.ot_id}
            workorder={ot}
            onClick={() => navigate(`/workorders/${ot.ot_id}`)}
          />
        ))
      )}
    </div>
  );
}
