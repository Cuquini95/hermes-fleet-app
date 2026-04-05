import { useState } from 'react';
import { Activity, AlertTriangle, Fuel, Bell } from 'lucide-react';
import { EQUIPMENT_CATALOG } from '../../data/equipment-catalog';
import { MOCK_WORKORDERS } from '../../data/mock-workorders';
import KPICard from '../ui/KPICard';
import FleetGrid from './FleetGrid';
import AvailabilityChart from './AvailabilityChart';
import AccionesDelDia from './AccionesDelDia';
import BriefingCard from './BriefingCard';

type Tab = 'general' | 'briefing' | 'pedidos';

const TABS: { id: Tab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'briefing', label: 'Briefing' },
  { id: 'pedidos', label: 'Pedidos' },
];

const criticasCount = MOCK_WORKORDERS.filter((ot) => ot.prioridad === 'CRITICA').length;

export default function ExecutiveDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('general');

  return (
    <div className="flex flex-col py-4">
      {/* Tab pills */}
      <div className="flex gap-2 mb-5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-white'
                : 'bg-card border border-border text-text-secondary hover:text-text'
            }`}
            style={activeTab === tab.id ? { backgroundColor: '#1B4A4A' } : undefined}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* General tab */}
      {activeTab === 'general' && (
        <div className="flex flex-col gap-4">
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3">
            <KPICard
              icon={<Activity size={20} />}
              value="88%"
              label="Disponibilidad"
              color="#16A34A"
            />
            <KPICard
              icon={<AlertTriangle size={20} />}
              value={criticasCount}
              label="OTs Críticas"
              color="#DC2626"
            />
            <KPICard
              icon={<Fuel size={20} />}
              value="1.02 L/hr"
              label="Consumo Promedio"
              color="#E8961A"
            />
            <KPICard
              icon={<Bell size={20} />}
              value="4"
              label="Alertas Hoy"
              color="#F59E0B"
            />
          </div>

          {/* Fleet grid */}
          <FleetGrid equipment={EQUIPMENT_CATALOG} />

          {/* Availability chart */}
          <AvailabilityChart />

          {/* Daily actions */}
          <AccionesDelDia />
        </div>
      )}

      {/* Briefing tab */}
      {activeTab === 'briefing' && <BriefingCard />}

      {/* Pedidos tab */}
      {activeTab === 'pedidos' && (
        <div className="flex items-center justify-center py-16">
          <p className="text-text-secondary">Pedidos de Repuestos — Próximamente</p>
        </div>
      )}
    </div>
  );
}
