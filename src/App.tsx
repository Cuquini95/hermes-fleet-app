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
import ViajesPenaPage from './pages/ViajesPenaPage';
import AlertsPage from './pages/AlertsPage';
import PerfilPage from './pages/PerfilPage';
import MyReportsPage from './pages/MyReportsPage';
import InventoryPage from './pages/InventoryPage';
import PMSchedulePage from './pages/PMSchedulePage';
import PMWorkOrderPage from './pages/PMWorkOrderPage';
import AppShell from './components/layout/AppShell';
import FleetPage from './pages/FleetPage';
import PartsSearch from './components/mechanic/PartsSearch';
import ManualSearch from './components/mechanic/ManualSearch';
import DiagramViewer from './components/mechanic/DiagramViewer';
import BriefingCard from './components/dashboard/BriefingCard';
import WorkOrdersPage from './pages/WorkOrdersPage';
import WorkOrderDetailPage from './pages/WorkOrderDetailPage';
import SupervisorHomePage from './pages/SupervisorHomePage';
import CoordinatorHomePage from './pages/CoordinatorHomePage';
import WorkshopHomePage from './pages/WorkshopHomePage';
import NeumaticosPage from './pages/NeumaticosPage';
import PedidosPage from './pages/PedidosPage';

function Placeholder({ label }: { label: string }) {
  return (
    <div className="text-center py-12" style={{ color: '#6B7280' }}>
      {label} — Coming soon
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
        <Route path="/workshop" element={<WorkshopHomePage />} />
        <Route path="/coordinator" element={<CoordinatorHomePage />} />
        <Route path="/supervisor" element={<SupervisorHomePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/dvir" element={<DVIRPage />} />
        <Route path="/dvir-compliance" element={<DVIRPage />} />
        <Route path="/fleet" element={<FleetPage />} />
        <Route path="/falla" element={<FallaPage />} />
        <Route path="/workorders/:otId" element={<WorkOrderDetailPage />} />
        <Route path="/workorders" element={<WorkOrdersPage />} />
        <Route path="/parts" element={<PartsSearch />} />
        <Route path="/manuals" element={<ManualSearch />} />
        <Route path="/diagrams" element={<DiagramViewer />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/pm" element={<PMSchedulePage />} />
        <Route path="/pm-order" element={<PMWorkOrderPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/pedidos" element={<PedidosPage />} />
        <Route path="/briefing" element={<BriefingCard />} />
        <Route path="/diesel" element={<DieselPage />} />
        <Route path="/horometro" element={<HorometroPage />} />
        <Route path="/viaje" element={<ViajePage />} />
        <Route path="/flete" element={<ViajePage />} />
        <Route path="/viajes-pena" element={<ViajesPenaPage />} />
        <Route path="/perfil" element={<PerfilPage />} />
        <Route path="/my-reports" element={<MyReportsPage />} />
        <Route path="/neumaticos" element={<NeumaticosPage />} />
      </Route>

      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
