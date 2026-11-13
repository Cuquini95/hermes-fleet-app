import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useEquipmentList } from '../hooks/useEquipmentList';
import FleetGrid from '../components/dashboard/FleetGrid';
import { useFleetDispatch } from '../hooks/useFleetDispatch';
import { useEquipmentStore } from '../stores/equipment-store';
import { useAuthStore } from '../stores/auth-store';
import { dispatchAvailability } from '../lib/availability';

export default function FleetPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const equipment = useEquipmentList();

  const dispatch = useFleetDispatch(equipment);
  const role = useAuthStore((state) => state.role);
  const equipmentError = useEquipmentStore((state) => state.error);
  const ready = useEquipmentStore((state) => state.fetched) && dispatch.verified && !dispatch.loading && !equipmentError;
  const refetch = useEquipmentStore((state) => state.refetch);
  const snapshot = dispatchAvailability(equipment, dispatch.readiness, ready);

  return (
    <div className="flex flex-col pb-4 animate-fade-up">
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <h1 className="text-xl font-bold text-text">Equipos</h1>
        <span className="ml-auto text-sm font-semibold text-text-secondary">
          {snapshot.available !== null ? `${snapshot.available}/${snapshot.total} aptos para despacho` : 'Disponibilidad por verificar'}
        </span>
        <button type="button" onClick={() => void Promise.all([refetch(), dispatch.refresh()])} aria-label="Actualizar flota" className="p-2 rounded-xl bg-white border border-border">
          <RefreshCw size={18} />
        </button>
      </div>

      {equipmentError && <p role="alert" className="mb-3 text-sm text-critical">No se pudo cargar el inventario de equipos.</p>}
      {role === 'supervisor' && dispatch.pendingReturns.length > 0 && (
        <section aria-labelledby="returns-heading" className="mb-4 rounded-xl border border-border bg-white p-4">
          <h2 id="returns-heading" className="text-sm font-semibold text-text">Entregas de Taller pendientes de Operaciones</h2>
          <ul className="mt-2 divide-y divide-border">
            {dispatch.pendingReturns.map(({ unit, otId }) => (
              <li key={otId} className="py-2">
                <Link to={`/workorders/${encodeURIComponent(otId)}`} className="text-sm font-medium text-text underline underline-offset-2">
                  {unit} · {otId}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <FleetGrid equipment={equipment} dispatch={dispatch} selectedUnit={params.get('unit') ?? undefined} onClearSelectedUnit={() => setParams({}, { replace: true })} />
    </div>
  );
}
