import { useNavigate } from 'react-router-dom';
import {
  Wrench,
  Clock,
  Package,
  CalendarCheck,
  BookOpen,
  FileImage,
  HardHat,
  ClipboardList,
  Users,
  PackageSearch,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { EQUIPMENT_CATALOG } from '../data/equipment-catalog';
import { MOCK_WORKORDERS } from '../data/mock-workorders';
import KPICard from '../components/ui/KPICard';
import EquipmentCard from '../components/ui/EquipmentCard';
import OTCard from '../components/ui/OTCard';

interface ActionCard {
  label: string;
  icon: React.ReactNode;
  path: string;
}

const ACTION_CARDS: ActionCard[] = [
  { label: 'Órdenes', icon: <Wrench size={32} className="text-amber" />, path: '/workorders' },
  { label: 'PM', icon: <Clock size={32} className="text-amber" />, path: '/pm' },
  { label: 'Partes', icon: <Package size={32} className="text-amber" />, path: '/parts' },
  { label: 'Orden PM', icon: <CalendarCheck size={32} className="text-amber" />, path: '/pm-order' },
  { label: 'Manuales', icon: <BookOpen size={32} className="text-amber" />, path: '/manuals' },
  { label: 'Diagramas', icon: <FileImage size={32} className="text-amber" />, path: '/diagrams' },
];

export default function WorkshopHomePage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);

  const equiposTaller = EQUIPMENT_CATALOG.filter((e) => e.status === 'taller');
  const otsActivas = MOCK_WORKORDERS.filter(
    (ot) => ot.estado === 'En Proceso' || ot.estado === 'Asignado'
  );
  const otsEnProceso = MOCK_WORKORDERS.filter((ot) => ot.estado === 'En Proceso');

  const mecanicos = 3;
  const partesPendientes = 5;

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
        <p className="text-text-secondary text-sm mt-0.5">Jefe de Taller</p>
      </div>

      {/* KPI grid 2x2 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <KPICard
          icon={<HardHat size={20} />}
          value={equiposTaller.length}
          label="En Taller"
          color="#DC2626"
        />
        <KPICard
          icon={<ClipboardList size={20} />}
          value={otsActivas.length}
          label="OTs Activas"
          color="#2563EB"
        />
        <KPICard
          icon={<Users size={20} />}
          value={mecanicos}
          label="Mecánicos"
          color="#16A34A"
        />
        <KPICard
          icon={<PackageSearch size={20} />}
          value={partesPendientes}
          label="Partes Pendientes"
          color="#F59E0B"
        />
      </div>

      {/* Quick actions 2x3 grid */}
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

      {/* En el Taller Ahora */}
      <h2 className="font-semibold text-text mt-2 mb-3">En el Taller Ahora</h2>
      <div className="flex flex-col gap-3 mb-6">
        {equiposTaller.length > 0 ? (
          equiposTaller.map((equipment) => (
            <EquipmentCard key={equipment.unit_id} equipment={equipment} />
          ))
        ) : (
          <div className="bg-green-50 border border-success rounded-lg p-3">
            <p className="text-sm font-medium text-success text-center">
              Taller vacío ✓
            </p>
          </div>
        )}
      </div>

      {/* OTs en Proceso */}
      <h2 className="font-semibold text-text mt-2 mb-3">OTs en Proceso</h2>
      <div className="flex flex-col">
        {otsEnProceso.length > 0 ? (
          otsEnProceso.map((ot) => (
            <OTCard
              key={ot.ot_id}
              workorder={ot}
              onClick={() => navigate(`/workorders/${ot.ot_id}`)}
            />
          ))
        ) : (
          <div className="bg-green-50 border border-success rounded-lg p-3">
            <p className="text-sm font-medium text-success text-center">
              Sin órdenes en proceso ✓
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
