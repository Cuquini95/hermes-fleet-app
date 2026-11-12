import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useEquipmentList } from '../hooks/useEquipmentList';
import FleetGrid from '../components/dashboard/FleetGrid';
import { useFleetDispatch } from '../hooks/useFleetDispatch';
import { useEquipmentStore } from '../stores/equipment-store';

export default function FleetPage() {
  const navigate = useNavigate();
  const equipment = useEquipmentList();

  const dispatch = useFleetDispatch(equipment);
  const equipmentError = useEquipmentStore((state) => state.error);
  const ready = useEquipmentStore((state) => state.fetched) && dispatch.verified && !equipmentError;
  const refetch = useEquipmentStore((state) => state.refetch);
  const operativo = dispatch.effectiveEquipment.filter((e) => e.status === 'operativo').length;
  const total = equipment.length;

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
          {ready ? `${operativo}/${total} operativos` : 'Disponibilidad por verificar'}
        </span>
        <button type="button" onClick={() => void Promise.all([refetch(), dispatch.refresh()])} aria-label="Actualizar flota" className="p-2 rounded-xl bg-white border border-border">
          <RefreshCw size={18} />
        </button>
      </div>

      {equipmentError && <p role="alert" className="mb-3 text-sm text-critical">No se pudo cargar el inventario de equipos.</p>}
      <FleetGrid equipment={equipment} dispatch={dispatch} />
    </div>
  );
}
