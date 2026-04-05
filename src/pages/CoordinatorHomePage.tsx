import { useNavigate } from 'react-router-dom';
import {
  Wrench,
  CalendarCheck,
  Package,
  Clock,
  ShoppingCart,
  AlertTriangle,
  ClipboardList,
  Flame,
  Timer,
  Archive,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { EQUIPMENT_CATALOG } from '../data/equipment-catalog';
import { MOCK_WORKORDERS } from '../data/mock-workorders';
import { getNextPM } from '../data/pm-rules';
import KPICard from '../components/ui/KPICard';
import OTCard from '../components/ui/OTCard';

interface ActionCard {
  label: string;
  icon: React.ReactNode;
  path: string;
}

const ACTION_CARDS: ActionCard[] = [
  { label: 'Órdenes', icon: <Wrench size={32} className="text-amber" />, path: '/workorders' },
  { label: 'Orden PM', icon: <CalendarCheck size={32} className="text-amber" />, path: '/pm-order' },
  { label: 'Inventario', icon: <Package size={32} className="text-amber" />, path: '/inventory' },
  { label: 'Programa PM', icon: <Clock size={32} className="text-amber" />, path: '/pm' },
  { label: 'Pedidos', icon: <ShoppingCart size={32} className="text-amber" />, path: '/pedidos' },
  { label: 'Alertas', icon: <AlertTriangle size={32} className="text-amber" />, path: '/alerts' },
];

export default function CoordinatorHomePage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);

  const openOTs = MOCK_WORKORDERS.filter(
    (ot) => ot.estado !== 'Completado'
  );
  const criticalOTs = MOCK_WORKORDERS.filter((ot) => ot.prioridad === 'CRITICA');

  const pmProximos = EQUIPMENT_CATALOG.filter((e) => {
    const pm = getNextPM(e.model, e.current_horometro);
    return pm.hours_remaining <= 50;
  }).length;

  const stockCritico = 2;

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
        <p className="text-text-secondary text-sm mt-0.5">Coordinador de Mantenimiento</p>
      </div>

      {/* KPI grid 2x2 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <KPICard
          icon={<ClipboardList size={20} />}
          value={openOTs.length}
          label="OTs Abiertas"
          color="#2563EB"
        />
        <KPICard
          icon={<Flame size={20} />}
          value={criticalOTs.length}
          label="OTs Críticas"
          color="#DC2626"
        />
        <KPICard
          icon={<Timer size={20} />}
          value={pmProximos}
          label="PM Próximos"
          color="#F59E0B"
        />
        <KPICard
          icon={<Archive size={20} />}
          value={stockCritico}
          label="Stock Crítico"
          color="#EA580C"
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

      {/* OTs Pendientes */}
      <h2 className="font-semibold text-text mt-2 mb-3">OTs Pendientes</h2>
      <div className="flex flex-col">
        {openOTs.length > 0 ? (
          openOTs.map((ot) => (
            <OTCard
              key={ot.ot_id}
              workorder={ot}
              onClick={() => navigate(`/workorders/${ot.ot_id}`)}
            />
          ))
        ) : (
          <div className="bg-green-50 border border-success rounded-lg p-3">
            <p className="text-sm font-medium text-success text-center">
              Sin órdenes pendientes ✓
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
