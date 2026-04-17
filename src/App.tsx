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

/** Wrap a page element in an inline ErrorBoundary so one page crash doesn't kill others */
function PageBoundary({ role, children }: { role?: AppRole; children: React.ReactNode }) {
  return (
    <ErrorBoundary role={role} inline>
      {children}
    </ErrorBoundary>
  );
}

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
const PrivacyPolicyPage  = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsPage          = lazy(() => import('./pages/TermsPage'));

// ── Shared loading fallback ───────────────────────────────────────────────────

const PageLoader = () => (
  <div role="status" aria-live="polite" className="flex items-center justify-center min-h-screen text-slate-400 text-sm">
    <span className="sr-only">Cargando</span>
    <span aria-hidden="true">Cargando...</span>
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
  const role = useAuthStore((s) => s.role) ?? undefined;

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

      {/* Public legal pages — no auth required */}
      <Route
        path="/privacy"
        element={
          <Suspense fallback={<PageLoader />}>
            <PrivacyPolicyPage />
          </Suspense>
        }
      />
      <Route
        path="/terms"
        element={
          <Suspense fallback={<PageLoader />}>
            <TermsPage />
          </Suspense>
        }
      />

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
            <ErrorBoundary role={role}>
              <AppShell />
            </ErrorBoundary>
          </RequireRole>
        }
      >
        {/* ── Role-specific home pages ──────────────────────────────────── */}
        <Route path="/operator"   element={<RequireRole roles={['operador']}><PageBoundary role={role}><OperatorHomePage /></PageBoundary></RequireRole>} />
        <Route path="/mechanic"   element={<RequireRole roles={['mecanico']}><PageBoundary role={role}><MechanicPage /></PageBoundary></RequireRole>} />
        <Route path="/workshop"   element={<RequireRole roles={['jefe_taller', 'gerencia', 'supervisor']}><PageBoundary role={role}><WorkshopHomePage /></PageBoundary></RequireRole>} />
        <Route path="/coordinator" element={<RequireRole roles={['coordinador', 'gerencia']}><PageBoundary role={role}><CoordinatorHomePage /></PageBoundary></RequireRole>} />
        <Route path="/supervisor" element={<RequireRole roles={['supervisor', 'gerencia']}><PageBoundary role={role}><SupervisorHomePage /></PageBoundary></RequireRole>} />
        <Route path="/dashboard"  element={
          <RequireRole roles={['gerencia', 'supervisor']}>
            <PageBoundary role={role}>
              <Suspense fallback={<PageLoader />}>
                <DashboardPage />
              </Suspense>
            </PageBoundary>
          </RequireRole>
        } />

        {/* ── Shared operational routes ─────────────────────────────────── */}
        <Route path="/workorders/:otId" element={
          <RequireRole roles={WORKSHOP}>
            <PageBoundary role={role}>
              <Suspense fallback={<PageLoader />}>
                <WorkOrderDetailPage />
              </Suspense>
            </PageBoundary>
          </RequireRole>
        } />
        <Route path="/workorders" element={
          <RequireRole roles={WORKSHOP}>
            <PageBoundary role={role}>
              <Suspense fallback={<PageLoader />}>
                <WorkOrdersPage />
              </Suspense>
            </PageBoundary>
          </RequireRole>
        } />
        <Route path="/pm" element={
          <RequireRole roles={ADMIN}>
            <PageBoundary role={role}>
              <Suspense fallback={<PageLoader />}>
                <PMSchedulePage />
              </Suspense>
            </PageBoundary>
          </RequireRole>
        } />
        <Route path="/pm-order" element={
          <RequireRole roles={ADMIN}>
            <PageBoundary role={role}>
              <Suspense fallback={<PageLoader />}>
                <PMWorkOrderPage />
              </Suspense>
            </PageBoundary>
          </RequireRole>
        } />
        <Route path="/calendar" element={
          <RequireRole roles={CALENDAR_ACCESS}>
            <PageBoundary role={role}>
              <Suspense fallback={<PageLoader />}>
                <CalendarPage />
              </Suspense>
            </PageBoundary>
          </RequireRole>
        } />
        <Route path="/parts"        element={<RequireRole roles={WORKSHOP}><PageBoundary role={role}><PartsSearch /></PageBoundary></RequireRole>} />
        <Route path="/parts/import" element={
          <RequireRole roles={ADMIN}>
            <PageBoundary role={role}>
              <Suspense fallback={<PageLoader />}>
                <CatalogoImportPage />
              </Suspense>
            </PageBoundary>
          </RequireRole>
        } />
        <Route path="/manuals"  element={<RequireRole roles={WORKSHOP}><PageBoundary role={role}><ManualSearch /></PageBoundary></RequireRole>} />
        <Route path="/diagrams" element={<RequireRole roles={WORKSHOP}><PageBoundary role={role}><DiagramViewer /></PageBoundary></RequireRole>} />
        <Route path="/inventory" element={
          <RequireRole roles={ADMIN}>
            <PageBoundary role={role}>
              <Suspense fallback={<PageLoader />}>
                <InventoryPage />
              </Suspense>
            </PageBoundary>
          </RequireRole>
        } />
        <Route path="/pedidos" element={
          <RequireRole roles={ADMIN}>
            <PageBoundary role={role}>
              <Suspense fallback={<PageLoader />}>
                <PedidosPage />
              </Suspense>
            </PageBoundary>
          </RequireRole>
        } />
        <Route path="/neumaticos" element={
          <RequireRole roles={ADMIN}>
            <PageBoundary role={role}>
              <Suspense fallback={<PageLoader />}>
                <NeumaticosPage />
              </Suspense>
            </PageBoundary>
          </RequireRole>
        } />

        {/* ── Gastos ───────────────────────────────────────────────────── */}
        <Route path="/gastos" element={
          <RequireRole roles={MANAGEMENT}>
            <PageBoundary role={role}>
              <Suspense fallback={<PageLoader />}>
                <GastosPage />
              </Suspense>
            </PageBoundary>
          </RequireRole>
        } />
        <Route path="/gastos/nuevo" element={<RequireRole roles={GASTOS_WRITE}><PageBoundary role={role}><NuevoGastoPage /></PageBoundary></RequireRole>} />

        {/* ── Operator-specific routes ──────────────────────────────────── */}
        <Route path="/dvir"            element={<RequireRole roles={['operador', 'supervisor', 'gerencia']}><PageBoundary role={role}><DVIRPage /></PageBoundary></RequireRole>} />
        <Route path="/dvir-compliance" element={<RequireRole roles={['operador', 'supervisor', 'gerencia']}><PageBoundary role={role}><DVIRPage /></PageBoundary></RequireRole>} />
        <Route path="/falla"           element={<RequireRole roles={ALL}><PageBoundary role={role}><FallaPage /></PageBoundary></RequireRole>} />
        <Route path="/fleet"           element={<RequireRole roles={['supervisor', 'gerencia', 'coordinador']}><PageBoundary role={role}><FleetPage /></PageBoundary></RequireRole>} />
        <Route path="/alerts" element={
          <RequireRole roles={ADMIN}>
            <PageBoundary role={role}>
              <Suspense fallback={<PageLoader />}>
                <AlertsPage />
              </Suspense>
            </PageBoundary>
          </RequireRole>
        } />
        <Route path="/data" element={
          <RequireRole roles={ADMIN}>
            <PageBoundary role={role}>
              <Suspense fallback={<PageLoader />}>
                <DataManagerPage />
              </Suspense>
            </PageBoundary>
          </RequireRole>
        } />
        <Route path="/diesel"    element={<RequireRole roles={['operador', 'supervisor', 'gerencia']}><PageBoundary role={role}><DieselPage /></PageBoundary></RequireRole>} />
        <Route path="/horometro" element={<RequireRole roles={['operador', 'supervisor', 'gerencia']}><PageBoundary role={role}><HorometroPage /></PageBoundary></RequireRole>} />
        <Route path="/viaje"     element={<RequireRole roles={['operador', 'supervisor', 'gerencia']}><PageBoundary role={role}><ViajePage /></PageBoundary></RequireRole>} />
        <Route path="/flete"     element={<RequireRole roles={['operador', 'supervisor', 'gerencia']}><PageBoundary role={role}><ViajePage /></PageBoundary></RequireRole>} />
        <Route path="/bulk-boletas" element={
          <RequireRole roles={['operador', 'coordinador', 'supervisor', 'gerencia']}>
            <PageBoundary role={role}>
              <Suspense fallback={<PageLoader />}>
                <BulkBoletasPage />
              </Suspense>
            </PageBoundary>
          </RequireRole>
        } />
        <Route path="/viajes-pena" element={
          <RequireRole roles={['supervisor', 'gerencia']}>
            <PageBoundary role={role}>
              <Suspense fallback={<PageLoader />}>
                <ViajesPenaPage />
              </Suspense>
            </PageBoundary>
          </RequireRole>
        } />
        <Route path="/briefing" element={
          <RequireRole roles={MANAGEMENT}>
            <PageBoundary role={role}>
              <Suspense fallback={<PageLoader />}>
                <BriefingCard />
              </Suspense>
            </PageBoundary>
          </RequireRole>
        } />
        <Route path="/perfil" element={
          <RequireRole roles={ALL}>
            <PageBoundary role={role}>
              <Suspense fallback={<PageLoader />}>
                <PerfilPage />
              </Suspense>
            </PageBoundary>
          </RequireRole>
        } />
        <Route path="/my-reports" element={
          <RequireRole roles={ALL}>
            <PageBoundary role={role}>
              <Suspense fallback={<PageLoader />}>
                <MyReportsPage />
              </Suspense>
            </PageBoundary>
          </RequireRole>
        } />
      </Route>

      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
