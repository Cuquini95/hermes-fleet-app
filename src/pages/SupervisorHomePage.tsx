import { useNavigate } from 'react-router-dom';
import {
  Truck,
  MapPin,
  AlertTriangle,
  Activity,
  Wrench,
  ShieldAlert,
  ShieldOff,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { EQUIPMENT_CATALOG } from '../data/equipment-catalog';
import KPICard from '../components/ui/KPICard';
import EquipmentCard from '../components/ui/EquipmentCard';

interface ActionCard {
  label: string;
  icon: React.ReactNode;
  path: string;
}

const ACTION_CARDS: ActionCard[] = [
  { label: 'Equipos', icon: <Truck size={32} className="text-amber" />, path: '/fleet' },
  { label: 'Viajes Peña', icon: <MapPin size={32} className="text-amber" />, path: '/viajes-pena' },
  { label: 'Alertas', icon: <AlertTriangle size={32} className="text-amber" />, path: '/alerts' },
];

export default function SupervisorHomePage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);

  const total = EQUIPMENT_CATALOG.length;
  const operativo = EQUIPMENT_CATALOG.filter((e) => e.status === 'operativo').length;
  const alerta = EQUIPMENT_CATALOG.filter((e) => e.status === 'alerta').length;
  const taller = EQUIPMENT_CATALOG.filter((e) => e.status === 'taller').length;
  const inactivo = EQUIPMENT_CATALOG.filter((e) => e.status === 'inactivo').length;
  const disponibilidad = total > 0 ? Math.round(((operativo + alerta) / total) * 100) : 0;

  const equiposTaller = EQUIPMENT_CATALOG.filter((e) => e.status === 'taller');
  const equiposAlerta = EQUIPMENT_CATALOG.filter((e) => e.status === 'alerta');

  const greeting =
    new Date().getHours() < 12
      ? 'Buenos días'
      : new Date().getHours() < 18
        ? 'Buenas tardes'
        : 'Buenas noches';

  return (
    <div className="flex flex-col py-4 animate-fade-up">
      {/* Greeting */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-text">{greeting}, {userName}</h1>
        <p className="text-text-secondary text-sm mt-0.5">Supervisor de Producción</p>
      </div>

      {/* KPI grid 2x2 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <KPICard
          icon={<Activity size={20} />}
          value={`${disponibilidad}%`}
          label="Disponibilidad"
          color="#16A34A"
        />
        <KPICard
          icon={<Wrench size={20} />}
          value={taller}
          label="En Taller"
          color="#DC2626"
        />
        <KPICard
          icon={<ShieldAlert size={20} />}
          value={alerta}
          label="Alertas"
          color="#F59E0B"
        />
        <KPICard
          icon={<ShieldOff size={20} />}
          value={inactivo}
          label="Inactivos"
          color="#9CA3AF"
        />
      </div>

      {/* Quick actions 2-column grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {ACTION_CARDS.map(({ label, icon, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex flex-col items-center justify-center gap-2 bg-white rounded-xl p-4 shadow-sm border border-border btn-press"
            style={{ minHeight: 100 }}
          >
            {icon}
            <span className="text-sm font-medium text-center text-text">{label}</span>
          </button>
        ))}
      </div>

      {/* Equipos en Taller */}
      <h2 className="font-semibold text-text mt-2 mb-3">Equipos en Taller</h2>
      <div className="flex flex-col gap-3 mb-6">
        {equiposTaller.length > 0 ? (
          equiposTaller.map((equipment) => (
            <EquipmentCard key={equipment.unit_id} equipment={equipment} />
          ))
        ) : (
          <div className="bg-green-50 border border-success rounded-lg p-3">
            <p className="text-sm font-medium text-success text-center">
              Todos los equipos operativos ✓
            </p>
          </div>
        )}
      </div>

      {/* Equipos en Alerta */}
      <h2 className="font-semibold text-text mt-2 mb-3">Equipos en Alerta</h2>
      <div className="flex flex-col gap-3">
        {equiposAlerta.length > 0 ? (
          equiposAlerta.map((equipment) => (
            <EquipmentCard key={equipment.unit_id} equipment={equipment} />
          ))
        ) : (
          <div className="bg-green-50 border border-success rounded-lg p-3">
            <p className="text-sm font-medium text-success text-center">
              Sin alertas activas ✓
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
