import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { EQUIPMENT_CATALOG } from '../data/equipment-catalog';
import FleetGrid from '../components/dashboard/FleetGrid';

export default function FleetPage() {
  const navigate = useNavigate();

  const operativo = EQUIPMENT_CATALOG.filter((e) => e.status === 'operativo').length;
  const total = EQUIPMENT_CATALOG.length;

  return (
    <div className="flex flex-col pb-4">
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <h1 className="text-xl font-bold text-text">Equipos</h1>
        <span className="ml-auto text-sm font-semibold text-success">
          {operativo}/{total} operativos
        </span>
      </div>

      <FleetGrid equipment={EQUIPMENT_CATALOG} />
    </div>
  );
}
