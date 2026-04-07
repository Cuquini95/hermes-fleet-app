import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useEquipmentList } from '../hooks/useEquipmentList';
import FleetGrid from '../components/dashboard/FleetGrid';

export default function FleetPage() {
  const navigate = useNavigate();
  const equipment = useEquipmentList();

  const operativo = equipment.filter((e) => e.status === 'operativo').length;
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
        <span className="ml-auto text-sm font-semibold text-success">
          {operativo}/{total} operativos
        </span>
      </div>

      <FleetGrid equipment={equipment} />
    </div>
  );
}
