import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth-store';
import { ROLE_HOME } from './types/roles';
import LoginPage from './pages/LoginPage';
import OperatorHomePage from './pages/OperatorHomePage';
import MechanicPage from './pages/MechanicPage';
import DVIRPage from './pages/DVIRPage';
import FallaPage from './pages/FallaPage';
import DashboardPage from './pages/DashboardPage';
import ChatPage from './pages/ChatPage';
import AppShell from './components/layout/AppShell';
import PartsSearch from './components/mechanic/PartsSearch';
import ManualSearch from './components/mechanic/ManualSearch';
import DiagramViewer from './components/mechanic/DiagramViewer';
import BriefingCard from './components/dashboard/BriefingCard';
import { MOCK_WORKORDERS } from './data/mock-workorders';
import OTCard from './components/ui/OTCard';

function Placeholder({ label }: { label: string }) {
  return (
    <div className="text-center py-12" style={{ color: '#6B7280' }}>
      {label} — Coming soon
    </div>
  );
}

function WorkOrdersPage() {
  return (
    <div className="py-4">
      <h2 className="font-semibold text-lg text-text mb-3">Órdenes de Trabajo</h2>
      {MOCK_WORKORDERS.map((ot) => (
        <OTCard key={ot.ot_id} workorder={ot} />
      ))}
    </div>
  );
}

function RootRedirect() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.role);

  if (isAuthenticated && role) {
    return <Navigate to={ROLE_HOME[role]} replace />;
  }
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/chat" element={<ChatPage />} />

      <Route element={<AppShell />}>
        <Route path="/operator" element={<OperatorHomePage />} />
        <Route path="/mechanic" element={<MechanicPage />} />
        <Route path="/workshop" element={<Placeholder label="Workshop Home" />} />
        <Route path="/coordinator" element={<Placeholder label="Coordinator Home" />} />
        <Route path="/supervisor" element={<Placeholder label="Supervisor Home" />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/dvir" element={<DVIRPage />} />
        <Route path="/falla" element={<FallaPage />} />
        <Route path="/workorders" element={<WorkOrdersPage />} />
        <Route path="/parts" element={<PartsSearch />} />
        <Route path="/manuals" element={<ManualSearch />} />
        <Route path="/diagrams" element={<DiagramViewer />} />
        <Route path="/alerts" element={<Placeholder label="Alerts" />} />
        <Route path="/pm" element={<Placeholder label="PM Schedule" />} />
        <Route path="/inventory" element={<Placeholder label="Inventory" />} />
        <Route path="/pedidos" element={<Placeholder label="Pedidos" />} />
        <Route path="/briefing" element={<BriefingCard />} />
        <Route path="/diesel" element={<Placeholder label="Diesel Log" />} />
        <Route path="/horometro" element={<Placeholder label="Horómetro" />} />
        <Route path="/viaje" element={<Placeholder label="Trip Log" />} />
        <Route path="/perfil" element={<Placeholder label="Profile" />} />
        <Route path="/my-reports" element={<Placeholder label="My Reports" />} />
      </Route>

      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
