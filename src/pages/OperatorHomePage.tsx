import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  Camera,
  Fuel,
  Gauge,
  MapPin,
  FileText,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { getEquipmentById } from '../data/equipment-catalog';
import EquipmentCard from '../components/ui/EquipmentCard';

interface ActionCard {
  label: string;
  icon: React.ReactNode;
  path: string;
}

const ACTION_CARDS: ActionCard[] = [
  { label: 'DVIR', icon: <ClipboardCheck size={32} className="text-amber" />, path: '/dvir' },
  { label: 'Reportar Falla', icon: <Camera size={32} className="text-amber" />, path: '/falla' },
  { label: 'Diesel', icon: <Fuel size={32} className="text-amber" />, path: '/diesel' },
  { label: 'Horómetro', icon: <Gauge size={32} className="text-amber" />, path: '/horometro' },
  { label: 'Viaje', icon: <MapPin size={32} className="text-amber" />, path: '/viaje' },
  { label: 'Mis Reportes', icon: <FileText size={32} className="text-amber" />, path: '/my-reports' },
];

export default function OperatorHomePage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);
  const assignedUnits = useAuthStore((s) => s.assignedUnits);

  const assignedEquipment = assignedUnits
    .map((id) => getEquipmentById(id))
    .filter((e) => e !== undefined);

  return (
    <div className="flex flex-col py-4">
      {/* Greeting */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-text">Buenos días, {userName}</h1>
        <p className="text-text-secondary text-sm mt-0.5">Operador</p>
      </div>

      {/* Alert strip — DVIR not completed today (mock: always shown) */}
      <div className="bg-red-50 border-l-4 border-critical rounded-lg p-3 mb-4">
        <p className="text-sm font-medium text-critical">
          ⚠️ Tu DVIR de hoy no ha sido completado
        </p>
      </div>

      {/* Action grid 3x2 */}
      <div className="grid grid-cols-2 gap-3">
        {ACTION_CARDS.map(({ label, icon, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex flex-col items-center justify-center gap-2 bg-white rounded-xl p-4 shadow-sm border border-border transition-opacity active:opacity-70"
            style={{ minHeight: 100 }}
          >
            {icon}
            <span className="text-sm font-medium text-center text-text">{label}</span>
          </button>
        ))}
      </div>

      {/* Mi Equipo section */}
      <h2 className="font-semibold text-text mt-6 mb-3">Mi Equipo Asignado</h2>
      <div className="flex flex-col gap-3">
        {assignedEquipment.length > 0 ? (
          assignedEquipment.map((equipment) => (
            <EquipmentCard key={equipment!.unit_id} equipment={equipment!} />
          ))
        ) : (
          <p className="text-sm text-text-secondary">No tienes equipos asignados.</p>
        )}
      </div>

      {/* Footer counter */}
      <p className="text-sm text-text-secondary text-center mt-4">Reportes hoy: 3 ✓</p>
    </div>
  );
}
