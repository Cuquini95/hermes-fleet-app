import { useState } from 'react';
import { MOCK_WORKORDERS } from '../data/mock-workorders';
import MechanicHome from '../components/mechanic/MechanicHome';
import PartsSearch from '../components/mechanic/PartsSearch';
import ManualSearch from '../components/mechanic/ManualSearch';
import DiagramViewer from '../components/mechanic/DiagramViewer';
import OTCard from '../components/ui/OTCard';

type Tab = 'inicio' | 'ordenes' | 'partes' | 'manuales' | 'diagramas';

const TABS: { id: Tab; label: string }[] = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'ordenes', label: 'Órdenes' },
  { id: 'partes', label: 'Partes' },
  { id: 'manuales', label: 'Manuales' },
  { id: 'diagramas', label: 'Diagramas' },
];

export default function MechanicPage() {
  const [activeTab, setActiveTab] = useState<Tab>('inicio');

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
          <h2 className="font-semibold text-lg text-text mb-3">Todas las Órdenes</h2>
          {MOCK_WORKORDERS.map((ot) => (
            <OTCard key={ot.ot_id} workorder={ot} />
          ))}
        </div>
      )}

      {activeTab === 'partes' && <PartsSearch />}
      {activeTab === 'manuales' && <ManualSearch />}
      {activeTab === 'diagramas' && <DiagramViewer />}
    </div>
  );
}
