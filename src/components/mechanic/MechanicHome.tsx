import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Wrench, Package, BookOpen, MessageCircle } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { useWorkOrderStore } from '../../stores/workorder-store';
import KPICard from '../ui/KPICard';
import OTCard from '../ui/OTCard';

export default function MechanicHome() {
  const navigate = useNavigate();
  const isPanama = useAuthStore((state) => state.project === 'tmf-panama');
  const { workorders, fetched, fetchWorkOrders, loading, error } = useWorkOrderStore();

  useEffect(() => {
    if (!fetched) fetchWorkOrders();
  }, [fetched, fetchWorkOrders]);

  const activeOTs    = workorders.filter((ot) => ot.estado !== 'Completado');
  const waitingParts = workorders.filter((ot) => ot.estado === 'Esperando Pieza').length;

  return (
    <div className="flex flex-col py-4">
      <h1 className="mb-3 text-xl font-bold text-text">Hoy en Taller</h1>
      {/* KPI strip */}
      <div className="flex gap-3 mb-2">
        <KPICard
          icon={<Wrench size={20} />}
          value={error ? '—' : loading || !fetched ? '…' : activeOTs.length}
          label={isPanama ? 'OT activas' : 'OTs Activas'}
          color="#2563EB"
        />
        <KPICard
          icon={<Package size={20} />}
          value={error ? '—' : loading || !fetched ? '…' : waitingParts}
          label={isPanama ? 'Esperan repuesto' : 'Esperando Pieza'}
          color="#EA580C"
        />
      </div>

      {/* Mis Órdenes Activas */}
      <h2 className="font-semibold text-lg text-text mt-6 mb-3">{isPanama ? 'Órdenes' : 'Órdenes Activas'}</h2>
      {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : loading || !fetched ? (
        <div className="text-center py-8 text-text-secondary text-sm">Cargando…</div>
      ) : activeOTs.length > 0 ? (
        activeOTs.map((ot) => (
          <Link key={ot.ot_id} to={`/workorders/${encodeURIComponent(ot.ot_id)}`}
            className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy">
            <OTCard workorder={ot} />
          </Link>
        ))
      ) : (
        <div className="bg-green-50 border border-success rounded-lg p-4 text-center">
          <p className="text-sm font-medium text-success">{isPanama ? 'Sin órdenes activas' : 'Sin órdenes activas ✓'}</p>
        </div>
      )}

      {/* Acciones Rápidas */}
      {!isPanama && <h2 className="font-semibold text-lg text-text mt-6 mb-3">Acciones Rápidas</h2>}
      <div className={isPanama ? 'mt-6 flex gap-3' : 'flex gap-3'}>
        <button
          onClick={() => navigate('/parts')}
          className="flex-1 bg-card rounded-xl p-4 text-center shadow-sm border border-border flex flex-col items-center gap-2 hover:bg-gray-50 transition-colors"
        >
          <Package size={24} className="text-amber" />
          <span className="text-xs font-medium text-text">{isPanama ? 'Buscar repuesto' : 'Buscar Parte'}</span>
        </button>
        <button
          onClick={() => navigate('/manuals')}
          className="flex-1 bg-card rounded-xl p-4 text-center shadow-sm border border-border flex flex-col items-center gap-2 hover:bg-gray-50 transition-colors"
        >
          <BookOpen size={24} className="text-amber" />
          <span className="text-xs font-medium text-text">{isPanama ? 'Manuales' : 'Manual Técnico'}</span>
        </button>
        <button
          onClick={() => navigate('/chat')}
          className="flex-1 bg-card rounded-xl p-4 text-center shadow-sm border border-border flex flex-col items-center gap-2 hover:bg-gray-50 transition-colors"
        >
          <MessageCircle size={24} className="text-amber" />
          <span className="text-xs font-medium text-text">{isPanama ? 'Consultar a Hermes' : 'Preguntar a Hermes'}</span>
        </button>
      </div>
    </div>
  );
}
