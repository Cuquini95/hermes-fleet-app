import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkOrderStore } from '../stores/workorder-store';
import MechanicHome from '../components/mechanic/MechanicHome';
import PartsSearch from '../components/mechanic/PartsSearch';
import ManualSearch from '../components/mechanic/ManualSearch';
import DiagramViewer from '../components/mechanic/DiagramViewer';
import OTCard from '../components/ui/OTCard';

type Tab = 'inicio' | 'ordenes' | 'partes' | 'manuales' | 'diagramas';

const TABS: { id: Tab; label: string }[] = [
  { id: 'inicio',    label: 'Inicio' },
  { id: 'ordenes',   label: 'Órdenes' },
  { id: 'partes',    label: 'Partes' },
  { id: 'manuales',  label: 'Manuales' },
  { id: 'diagramas', label: 'Diagramas' },
];

export default function MechanicPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('inicio');
  const { workorders, fetched, fetchWorkOrders, loading } = useWorkOrderStore();

  useEffect(() => {
    if (!fetched) fetchWorkOrders();
  }, [fetched, fetchWorkOrders]);

  // Show all active orders to mechanics (role-based, not name-based)
  const activeOrders = workorders.filter((ot) => ot.estado !== 'Completado');

  return (
    <div className="flex flex-col">
      {/* Sub-tab navigation */}
      <div className="flex gap-2 overflow-x-auto pb-1 pt-2 scrollbar-none">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-amber text-white'
                : 'bg-white text-text-secondary border border-border hover:border-amber'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'inicio' && <MechanicHome />}

      {activeTab === 'ordenes' && (
        <div className="py-4">
          <h2 className="font-semibold text-lg text-text mb-3">
            Órdenes Activas
            {!loading && (
              <span className="text-sm font-normal text-text-secondary ml-2">
                ({activeOrders.length})
              </span>
            )}
          </h2>
          {loading ? (
            <div className="text-center py-10 text-sm text-text-secondary">Cargando…</div>
          ) : activeOrders.length > 0 ? (
            activeOrders.map((ot) => (
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
        </div>
      )}

      {activeTab === 'partes'    && <PartsSearch />}
      {activeTab === 'manuales'  && <ManualSearch />}
      {activeTab === 'diagramas' && <DiagramViewer />}
    </div>
  );
}
