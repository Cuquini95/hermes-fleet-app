import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './stores/auth-store';
import { flushQueue } from './lib/offline-queue';
import { ROLE_HOME } from './types/roles';
import type { AppRole } from './types/roles';
import RequireRole from './components/auth/RequireRole';
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
import GastosPage from './pages/GastosPage';
import NuevoGastoPage from './pages/NuevoGastoPage';
import BulkBoletasPage from './pages/BulkBoletasPage';

// ── Roles allowed per route ───────────────────────────────────────────────────
// Empty array = any authenticated user

const ALL: AppRole[] = ['operador', 'mecanico', 'jefe_taller', 'coordinador', 'supervisor', 'gerencia'];
const ADMIN: AppRole[] = ['jefe_taller', 'coordinador', 'supervisor', 'gerencia'];
const WORKSHOP: AppRole[] = ['mecanico', 'jefe_taller', 'coordinador', 'supervisor', 'gerencia'];
const MANAGEMENT: AppRole[] = ['jefe_taller', 'coordinador', 'gerencia'];
const GASTOS_WRITE: AppRole[] = ['jefe_taller', 'coordinador', 'gerencia'];

function RootRedirect() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.role);

  if (isAuthenticated && role) {
    return <Navigate to={ROLE_HOME[role]} replace />;
  }
  return <Navigate to="/login" replace />;
}

export default function App() {
  // Flush queued offline submissions when the device reconnects
  useEffect(() => {
    const handleOnline = () => { flushQueue().catch(() => {}); };
    window.addEventListener('online', handleOnline);
    // Also flush once on mount in case the app was opened after reconnecting
    if (navigator.onLine) handleOnline();
    return () => { window.removeEventListener('online', handleOnline); };
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Chat is accessible to any authenticated user */}
      <Route
        path="/chat"
        element={
          <RequireRole roles={ALL}>
            <ChatPage />
          </RequireRole>
        }
      />

      <Route
        element={
          <RequireRole roles={ALL}>
            <AppShell />
          </RequireRole>
        }
      >
        {/* ── Role-specific home pages ──────────────────────────────────── */}
        <Route path="/operator"   element={<RequireRole roles={['operador']}><OperatorHomePage /></RequireRole>} />
        <Route path="/mechanic"   element={<RequireRole roles={['mecanico']}><MechanicPage /></RequireRole>} />
        <Route path="/workshop"   element={<RequireRole roles={['jefe_taller', 'gerencia', 'supervisor']}><WorkshopHomePage /></RequireRole>} />
        <Route path="/coordinator" element={<RequireRole roles={['coordinador', 'gerencia']}><CoordinatorHomePage /></RequireRole>} />
        <Route path="/supervisor" element={<RequireRole roles={['supervisor', 'gerencia']}><SupervisorHomePage /></RequireRole>} />
        <Route path="/dashboard"  element={<RequireRole roles={['gerencia', 'supervisor']}><DashboardPage /></RequireRole>} />

        {/* ── Shared operational routes ─────────────────────────────────── */}
        <Route path="/workorders/:otId" element={<RequireRole roles={WORKSHOP}><WorkOrderDetailPage /></RequireRole>} />
        <Route path="/workorders"       element={<RequireRole roles={WORKSHOP}><WorkOrdersPage /></RequireRole>} />
        <Route path="/pm"               element={<RequireRole roles={ADMIN}><PMSchedulePage /></RequireRole>} />
        <Route path="/pm-order"         element={<RequireRole roles={ADMIN}><PMWorkOrderPage /></RequireRole>} />
        <Route path="/parts"            element={<RequireRole roles={WORKSHOP}><PartsSearch /></RequireRole>} />
        <Route path="/manuals"          element={<RequireRole roles={WORKSHOP}><ManualSearch /></RequireRole>} />
        <Route path="/diagrams"         element={<RequireRole roles={WORKSHOP}><DiagramViewer /></RequireRole>} />
        <Route path="/inventory"        element={<RequireRole roles={ADMIN}><InventoryPage /></RequireRole>} />
        <Route path="/pedidos"          element={<RequireRole roles={ADMIN}><PedidosPage /></RequireRole>} />
        <Route path="/neumaticos"       element={<RequireRole roles={ADMIN}><NeumaticosPage /></RequireRole>} />

        {/* ── Gastos ───────────────────────────────────────────────────── */}
        <Route path="/gastos"           element={<RequireRole roles={MANAGEMENT}><GastosPage /></RequireRole>} />
        <Route path="/gastos/nuevo"     element={<RequireRole roles={GASTOS_WRITE}><NuevoGastoPage /></RequireRole>} />

        {/* ── Operator-specific routes ──────────────────────────────────── */}
        <Route path="/dvir"             element={<RequireRole roles={['operador', 'supervisor', 'gerencia']}><DVIRPage /></RequireRole>} />
        <Route path="/dvir-compliance"  element={<RequireRole roles={['operador', 'supervisor', 'gerencia']}><DVIRPage /></RequireRole>} />
        <Route path="/falla"            element={<RequireRole roles={ALL}><FallaPage /></RequireRole>} />
        <Route path="/fleet"            element={<RequireRole roles={['supervisor', 'gerencia', 'coordinador']}><FleetPage /></RequireRole>} />
        <Route path="/alerts"           element={<RequireRole roles={ADMIN}><AlertsPage /></RequireRole>} />
        <Route path="/diesel"           element={<RequireRole roles={['operador', 'supervisor', 'gerencia']}><DieselPage /></RequireRole>} />
        <Route path="/horometro"        element={<RequireRole roles={['operador', 'supervisor', 'gerencia']}><HorometroPage /></RequireRole>} />
        <Route path="/viaje"            element={<RequireRole roles={['operador', 'supervisor', 'gerencia']}><ViajePage /></RequireRole>} />
        <Route path="/flete"            element={<RequireRole roles={['operador', 'supervisor', 'gerencia']}><ViajePage /></RequireRole>} />
        <Route path="/bulk-boletas"     element={<RequireRole roles={['operador', 'coordinador', 'supervisor', 'gerencia']}><BulkBoletasPage /></RequireRole>} />
        <Route path="/viajes-pena"      element={<RequireRole roles={['supervisor', 'gerencia']}><ViajesPenaPage /></RequireRole>} />
        <Route path="/briefing"         element={<RequireRole roles={MANAGEMENT}><BriefingCard /></RequireRole>} />
        <Route path="/perfil"           element={<RequireRole roles={ALL}><PerfilPage /></RequireRole>} />
        <Route path="/my-reports"       element={<RequireRole roles={ALL}><MyReportsPage /></RequireRole>} />
      </Route>

      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
