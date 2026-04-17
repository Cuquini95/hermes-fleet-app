import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { useAuthStore } from './stores/auth-store';
import { useWorkOrderStore } from './stores/workorder-store';
import { flushQueue } from './lib/offline-queue';
import { ROLE_HOME } from './types/roles';
import type { AppRole } from './types/roles';
import RequireRole from './components/auth/RequireRole';
import LoginPage from './pages/LoginPage';
import OperatorHomePage from './pages/OperatorHomePage';
import MechanicPage from './pages/MechanicPage';
import DVIRPage from './pages/DVIRPage';
import FallaPage from './pages/FallaPage';
import ChatPage from './pages/ChatPage';
import DieselPage from './pages/DieselPage';
import HorometroPage from './pages/HorometroPage';
import ViajePage from './pages/ViajePage';
import AppShell from './components/layout/AppShell';
import FleetPage from './pages/FleetPage';
import PartsSearch from './components/mechanic/PartsSearch';
import ManualSearch from './components/mechanic/ManualSearch';
import DiagramViewer from './components/mechanic/DiagramViewer';
import WorkOrderDetailPage from './pages/WorkOrderDetailPage';
import SupervisorHomePage from './pages/SupervisorHomePage';
import CoordinatorHomePage from './pages/CoordinatorHomePage';
import WorkshopHomePage from './pages/WorkshopHomePage';
import NuevoGastoPage from './pages/NuevoGastoPage';
import ErrorBoundary from './components/ErrorBoundary';

// ── Lazy-loaded heavy pages ───────────────────────────────────────────────────

const DashboardPage      = lazy(() => import('./pages/DashboardPage'));
const GastosPage         = lazy(() => import('./pages/GastosPage'));
const AlertsPage         = lazy(() => import('./pages/AlertsPage'));
const ViajesPenaPage     = lazy(() => import('./pages/ViajesPenaPage'));
const PerfilPage         = lazy(() => import('./pages/PerfilPage'));
const MyReportsPage      = lazy(() => import('./pages/MyReportsPage'));
const InventoryPage      = lazy(() => import('./pages/InventoryPage'));
const PMSchedulePage     = lazy(() => import('./pages/PMSchedulePage'));
const PMWorkOrderPage    = lazy(() => import('./pages/PMWorkOrderPage'));
const BriefingCard       = lazy(() => import('./components/dashboard/BriefingCard'));
const WorkOrdersPage     = lazy(() => import('./pages/WorkOrdersPage'));
const NeumaticosPage     = lazy(() => import('./pages/NeumaticosPage'));
const PedidosPage        = lazy(() => import('./pages/PedidosPage'));
const BulkBoletasPage    = lazy(() => import('./pages/BulkBoletasPage'));
const CatalogoImportPage = lazy(() => import('./pages/CatalogoImportPage'));
const DataManagerPage    = lazy(() => import('./pages/DataManagerPage'));
const CalendarPage       = lazy(() => import('./pages/CalendarPage'));

// ── Shared loading fallback ───────────────────────────────────────────────────

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen text-slate-400 text-sm">
    Cargando...
  </div>
);

// ── Roles allowed per route ───────────────────────────────────────────────────
// Empty array = any authenticated user

const ALL: AppRole[] = ['operador', 'mecanico', 'jefe_taller', 'coordinador', 'supervisor', 'gerencia'];
const ADMIN: AppRole[] = ['jefe_taller', 'coordinador', 'supervisor', 'gerencia'];
const WORKSHOP: AppRole[] = ['mecanico', 'jefe_taller', 'coordinador', 'supervisor', 'gerencia'];
const MANAGEMENT: AppRole[] = ['jefe_taller', 'coordinador', 'gerencia'];
const GASTOS_WRITE: AppRole[] = ['jefe_taller', 'coordinador', 'gerencia'];
const CALENDAR_ACCESS: AppRole[] = ['jefe_taller', 'coordinador', 'supervisor', 'gerencia'];

function RootRedirect() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.role);

  if (isAuthenticated && role) {
    return <Navigate to={ROLE_HOME[role]} replace />;
  }
  return <Navigate to="/login" replace />;
}

export default function App() {
  const initRealtime = useWorkOrderStore((s) => s.initRealtime);

  // Flush queued offline submissions when the device reconnects
  useEffect(() => {
    const handleOnline = () => { flushQueue().catch(() => {}); };
    window.addEventListener('online', handleOnline);
    // Also flush once on mount in case the app was opened after reconnecting
    if (navigator.onLine) handleOnline();
    return () => { window.removeEventListener('online', handleOnline); };
  }, []);

  // Start Supabase Realtime subscription (no-op when credentials are placeholders)
  useEffect(() => {
    const cleanup = initRealtime();
    return cleanup;
  }, [initRealtime]);

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
            <ErrorBoundary>
              <AppShell />
            </ErrorBoundary>
          </RequireRole>
        }
      >
        {/* ── Role-specific home pages ──────────────────────────────────── */}
        <Route path="/operator"   element={<RequireRole roles={['operador']}><OperatorHomePage /></RequireRole>} />
        <Route path="/mechanic"   element={<RequireRole roles={['mecanico']}><MechanicPage /></RequireRole>} />
        <Route path="/workshop"   element={<RequireRole roles={['jefe_taller', 'gerencia', 'supervisor']}><WorkshopHomePage /></RequireRole>} />
        <Route path="/coordinator" element={<RequireRole roles={['coordinador', 'gerencia']}><CoordinatorHomePage /></RequireRole>} />
        <Route path="/supervisor" element={<RequireRole roles={['supervisor', 'gerencia']}><SupervisorHomePage /></RequireRole>} />
        <Route path="/dashboard"  element={
          <RequireRole roles={['gerencia', 'supervisor']}>
            <Suspense fallback={<PageLoader />}>
              <DashboardPage />
            </Suspense>
          </RequireRole>
        } />

        {/* ── Shared operational routes ─────────────────────────────────── */}
        <Route path="/workorders/:otId" element={
          <RequireRole roles={WORKSHOP}>
            <Suspense fallback={<PageLoader />}>
              <WorkOrderDetailPage />
            </Suspense>
          </RequireRole>
        } />
        <Route path="/workorders" element={
          <RequireRole roles={WORKSHOP}>
            <Suspense fallback={<PageLoader />}>
              <WorkOrdersPage />
            </Suspense>
          </RequireRole>
        } />
        <Route path="/pm" element={
          <RequireRole roles={ADMIN}>
            <Suspense fallback={<PageLoader />}>
              <PMSchedulePage />
            </Suspense>
          </RequireRole>
        } />
        <Route path="/pm-order" element={
          <RequireRole roles={ADMIN}>
            <Suspense fallback={<PageLoader />}>
              <PMWorkOrderPage />
            </Suspense>
          </RequireRole>
        } />
        <Route path="/calendar" element={
          <RequireRole roles={CALENDAR_ACCESS}>
            <Suspense fallback={<PageLoader />}>
              <CalendarPage />
            </Suspense>
          </RequireRole>
        } />
        <Route path="/parts"        element={<RequireRole roles={WORKSHOP}><PartsSearch /></RequireRole>} />
        <Route path="/parts/import" element={
          <RequireRole roles={ADMIN}>
            <Suspense fallback={<PageLoader />}>
              <CatalogoImportPage />
            </Suspense>
          </RequireRole>
        } />
        <Route path="/manuals"  element={<RequireRole roles={WORKSHOP}><ManualSearch /></RequireRole>} />
        <Route path="/diagrams" element={<RequireRole roles={WORKSHOP}><DiagramViewer /></RequireRole>} />
        <Route path="/inventory" element={
          <RequireRole roles={ADMIN}>
            <Suspense fallback={<PageLoader />}>
              <InventoryPage />
            </Suspense>
          </RequireRole>
        } />
        <Route path="/pedidos" element={
          <RequireRole roles={ADMIN}>
            <Suspense fallback={<PageLoader />}>
              <PedidosPage />
            </Suspense>
          </RequireRole>
        } />
        <Route path="/neumaticos" element={
          <RequireRole roles={ADMIN}>
            <Suspense fallback={<PageLoader />}>
              <NeumaticosPage />
            </Suspense>
          </RequireRole>
        } />

        {/* ── Gastos ───────────────────────────────────────────────────── */}
        <Route path="/gastos" element={
          <RequireRole roles={MANAGEMENT}>
            <Suspense fallback={<PageLoader />}>
              <GastosPage />
            </Suspense>
          </RequireRole>
        } />
        <Route path="/gastos/nuevo" element={<RequireRole roles={GASTOS_WRITE}><NuevoGastoPage /></RequireRole>} />

        {/* ── Operator-specific routes ──────────────────────────────────── */}
        <Route path="/dvir"            element={<RequireRole roles={['operador', 'supervisor', 'gerencia']}><DVIRPage /></RequireRole>} />
        <Route path="/dvir-compliance" element={<RequireRole roles={['operador', 'supervisor', 'gerencia']}><DVIRPage /></RequireRole>} />
        <Route path="/falla"           element={<RequireRole roles={ALL}><FallaPage /></RequireRole>} />
        <Route path="/fleet"           element={<RequireRole roles={['supervisor', 'gerencia', 'coordinador']}><FleetPage /></RequireRole>} />
        <Route path="/alerts" element={
          <RequireRole roles={ADMIN}>
            <Suspense fallback={<PageLoader />}>
              <AlertsPage />
            </Suspense>
          </RequireRole>
        } />
        <Route path="/data" element={
          <RequireRole roles={ADMIN}>
            <Suspense fallback={<PageLoader />}>
              <DataManagerPage />
            </Suspense>
          </RequireRole>
        } />
        <Route path="/diesel"    element={<RequireRole roles={['operador', 'supervisor', 'gerencia']}><DieselPage /></RequireRole>} />
        <Route path="/horometro" element={<RequireRole roles={['operador', 'supervisor', 'gerencia']}><HorometroPage /></RequireRole>} />
        <Route path="/viaje"     element={<RequireRole roles={['operador', 'supervisor', 'gerencia']}><ViajePage /></RequireRole>} />
        <Route path="/flete"     element={<RequireRole roles={['operador', 'supervisor', 'gerencia']}><ViajePage /></RequireRole>} />
        <Route path="/bulk-boletas" element={
          <RequireRole roles={['operador', 'coordinador', 'supervisor', 'gerencia']}>
            <Suspense fallback={<PageLoader />}>
              <BulkBoletasPage />
            </Suspense>
          </RequireRole>
        } />
        <Route path="/viajes-pena" element={
          <RequireRole roles={['supervisor', 'gerencia']}>
            <Suspense fallback={<PageLoader />}>
              <ViajesPenaPage />
            </Suspense>
          </RequireRole>
        } />
        <Route path="/briefing" element={
          <RequireRole roles={MANAGEMENT}>
            <Suspense fallback={<PageLoader />}>
              <BriefingCard />
            </Suspense>
          </RequireRole>
        } />
        <Route path="/perfil" element={
          <RequireRole roles={ALL}>
            <Suspense fallback={<PageLoader />}>
              <PerfilPage />
            </Suspense>
          </RequireRole>
        } />
        <Route path="/my-reports" element={
          <RequireRole roles={ALL}>
            <Suspense fallback={<PageLoader />}>
              <MyReportsPage />
            </Suspense>
          </RequireRole>
        } />
      </Route>

      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
