import { useNavigate } from 'react-router-dom';
import {
  Truck,
  AlertTriangle,
  Activity,
  Wrench,
  ShieldAlert,
  ShieldOff,
  BadgeCheck,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { useEquipmentList } from '../hooks/useEquipmentList';
import KPICard from '../components/ui/KPICard';
import EquipmentCard from '../components/ui/EquipmentCard';
import { useFleetDispatch } from '../hooks/useFleetDispatch';
import { useEquipmentStore } from '../stores/equipment-store';

interface ActionCard {
  label: string;
  icon: React.ReactNode;
  path: string;
}

const ACTION_CARDS: ActionCard[] = [
  { label: 'Equipos', icon: <Truck size={32} className="text-amber" />, path: '/fleet' },
  { label: 'Alertas', icon: <AlertTriangle size={32} className="text-amber" />, path: '/alerts' },
  { label: 'Sticker 15 días', icon: <BadgeCheck size={32} className="text-amber" />, path: '/sticker-inspection' },
];

export default function SupervisorHomePage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);
  const fleet = useEquipmentList();
  const { effectiveEquipment: equipment, verified, message, loading, refresh } = useFleetDispatch(fleet);
  const equipmentFetched = useEquipmentStore((state) => state.fetched);
  const ready = verified && equipmentFetched;

  const total = equipment.length;
  const operativo = equipment.filter((e) => e.status === 'operativo').length;
  const alerta = equipment.filter((e) => e.status === 'alerta').length;
  const taller = equipment.filter((e) => e.status === 'taller').length;
  const inactivo = equipment.filter((e) => e.status === 'inactivo').length;
  const disponibilidad = total > 0 ? Math.round((operativo / total) * 100) : 0;

  const equiposTaller = equipment.filter((e) => e.status === 'taller');
  const equiposAlerta = equipment.filter((e) => e.status === 'alerta');

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
          value={ready && total > 0 ? `${disponibilidad}%` : '—'}
          label="Disponibilidad"
          color="#16A34A"
        />
        <KPICard
          icon={<Wrench size={20} />}
          value={ready ? taller : '—'}
          label="En Taller"
          color="#DC2626"
        />
        <KPICard
          icon={<ShieldAlert size={20} />}
          value={ready ? alerta : '—'}
          label="Alertas"
          color="#F59E0B"
        />
        <KPICard
          icon={<ShieldOff size={20} />}
          value={equipmentFetched ? inactivo : '—'}
          label="Inactivos"
          color="#9CA3AF"
        />
      </div>

      {message && <p role="status" className="mb-3 text-sm text-text-secondary">{message}</p>}
      {!ready && !message && <p className="mb-3 text-sm text-text-secondary">Verificando disponibilidad…</p>}
      <button type="button" disabled={loading} onClick={() => void refresh()} className="self-start mb-3 text-sm font-medium text-amber">Actualizar bloqueos</button>

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
        ) : ready ? (
          <div className="bg-green-50 border border-success rounded-lg p-3">
            <p className="text-sm font-medium text-success text-center">
              Sin equipos en taller
            </p>
          </div>
        ) : null}
      </div>

      {/* Equipos en Alerta */}
      <h2 className="font-semibold text-text mt-2 mb-3">Equipos en Alerta</h2>
      <div className="flex flex-col gap-3">
        {equiposAlerta.length > 0 ? (
          equiposAlerta.map((equipment) => (
            <EquipmentCard key={equipment.unit_id} equipment={equipment} />
          ))
        ) : ready ? (
          <div className="bg-green-50 border border-success rounded-lg p-3">
            <p className="text-sm font-medium text-success text-center">
              Sin equipos en alerta
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
