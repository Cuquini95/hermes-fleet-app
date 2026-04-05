import { useNavigate } from 'react-router-dom';
import { Wrench, Package, BookOpen, MessageCircle } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { MOCK_WORKORDERS } from '../../data/mock-workorders';
import KPICard from '../ui/KPICard';
import OTCard from '../ui/OTCard';

export default function MechanicHome() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);

  const activeStatuses = ['Completado', 'Cerrado'] as const;
  const myOTs = MOCK_WORKORDERS.filter(
    (ot) => ot.mecanico_asignado === userName && !activeStatuses.includes(ot.estado as typeof activeStatuses[number])
  );
  const waitingParts = MOCK_WORKORDERS.filter((ot) => ot.estado === 'Esperando Pieza').length;

  return (
    <div className="flex flex-col py-4">
      {/* KPI strip */}
      <div className="flex gap-3 mb-2">
        <KPICard
          icon={<Wrench size={20} />}
          value={myOTs.length}
          label="OTs Asignadas"
          color="#E8961A"
        />
        <KPICard
          icon={<Package size={20} />}
          value={waitingParts}
          label="Esperando Pieza"
          color="#EA580C"
        />
      </div>

      {/* Mis Órdenes Activas */}
      <h2 className="font-semibold text-lg text-text mt-6 mb-3">Mis Órdenes Activas</h2>
      {myOTs.length > 0 ? (
        myOTs.map((ot) => (
          <OTCard key={ot.ot_id} workorder={ot} />
        ))
      ) : (
        <p className="text-center text-text-secondary py-8">No tienes órdenes asignadas</p>
      )}

      {/* Acciones Rápidas */}
      <h2 className="font-semibold text-lg text-text mt-6 mb-3">Acciones Rápidas</h2>
      <div className="flex gap-3">
        <button
          onClick={() => navigate('/parts')}
          className="flex-1 bg-card rounded-xl p-4 text-center shadow-sm border border-border flex flex-col items-center gap-2 hover:bg-gray-50 transition-colors"
        >
          <Package size={24} className="text-amber" />
          <span className="text-xs font-medium text-text">Buscar Parte</span>
        </button>
        <button
          onClick={() => navigate('/manuals')}
          className="flex-1 bg-card rounded-xl p-4 text-center shadow-sm border border-border flex flex-col items-center gap-2 hover:bg-gray-50 transition-colors"
        >
          <BookOpen size={24} className="text-amber" />
          <span className="text-xs font-medium text-text">Manual Técnico</span>
        </button>
        <button
          onClick={() => navigate('/chat')}
          className="flex-1 bg-card rounded-xl p-4 text-center shadow-sm border border-border flex flex-col items-center gap-2 hover:bg-gray-50 transition-colors"
        >
          <MessageCircle size={24} className="text-amber" />
          <span className="text-xs font-medium text-text">Preguntar a Hermes</span>
        </button>
      </div>
    </div>
  );
}
