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
import DieselPage from './pages/DieselPage';
import HorometroPage from './pages/HorometroPage';
import ViajePage from './pages/ViajePage';
import AlertsPage from './pages/AlertsPage';
import PerfilPage from './pages/PerfilPage';
import MyReportsPage from './pages/MyReportsPage';
import InventoryPage from './pages/InventoryPage';
import PMSchedulePage from './pages/PMSchedulePage';
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
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/pm" element={<PMSchedulePage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/pedidos" element={<Placeholder label="Pedidos" />} />
        <Route path="/briefing" element={<BriefingCard />} />
        <Route path="/diesel" element={<DieselPage />} />
        <Route path="/horometro" element={<HorometroPage />} />
        <Route path="/viaje" element={<ViajePage />} />
        <Route path="/perfil" element={<PerfilPage />} />
        <Route path="/my-reports" element={<MyReportsPage />} />
      </Route>

      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
