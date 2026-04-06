import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, Package, BookOpen, MessageCircle } from 'lucide-react';
import { useWorkOrderStore } from '../../stores/workorder-store';
import KPICard from '../ui/KPICard';
import OTCard from '../ui/OTCard';

export default function MechanicHome() {
  const navigate = useNavigate();
  const { workorders, fetched, fetchWorkOrders, loading } = useWorkOrderStore();

  useEffect(() => {
    if (!fetched) fetchWorkOrders();
  }, [fetched, fetchWorkOrders]);

  const activeOTs    = workorders.filter((ot) => ot.estado !== 'Completado');
  const waitingParts = workorders.filter((ot) => ot.estado === 'Esperando Pieza').length;

  return (
    <div className="flex flex-col py-4">
      {/* KPI strip */}
      <div className="flex gap-3 mb-2">
        <KPICard
          icon={<Wrench size={20} />}
          value={loading ? '…' : activeOTs.length}
          label="OTs Activas"
          color="#2563EB"
        />
        <KPICard
          icon={<Package size={20} />}
          value={loading ? '…' : waitingParts}
          label="Esperando Pieza"
          color="#EA580C"
        />
      </div>

      {/* Mis Órdenes Activas */}
      <h2 className="font-semibold text-lg text-text mt-6 mb-3">Órdenes Activas</h2>
      {loading ? (
        <div className="text-center py-8 text-text-secondary text-sm">Cargando…</div>
      ) : activeOTs.length > 0 ? (
        activeOTs.map((ot) => (
          <OTCard
            key={ot.ot_id}
            workorder={ot}
            onClick={() => navigate(`/workorders/${ot.ot_id}`)}
          />
        ))
      ) : (
        <div className="bg-green-50 border border-success rounded-lg p-4 text-center">
          <p className="text-sm font-medium text-success">Sin órdenes activas ✓</p>
        </div>
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
