import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { useAuthStore } from './stores/auth-store';
import { useWorkOrderStore } from './stores/workorder-store';
import { flushQueue } from './lib/offline-queue';
import { ROLE_HOME } from './types/roles';
import type { AppRole } from './types/roles';
import RequireRole from './components/auth/RequireRole';
import AppShell from './components/layout/AppShell';
import ErrorBoundary from './components/ErrorBoundary';

// ── All pages are lazy-loaded — nothing lands in the initial chunk except
//    the shell, auth guard, and error boundary. ────────────────────────────────

const LoginPage           = lazy(() => import('./pages/LoginPage'));
const PrivacyPolicyPage   = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsPage           = lazy(() => import('./pages/TermsPage'));

const OperatorHomePage    = lazy(() => import('./pages/OperatorHomePage'));
const MechanicPage        = lazy(() => import('./pages/MechanicPage'));
const WorkshopHomePage    = lazy(() => import('./pages/WorkshopHomePage'));
const CoordinatorHomePage = lazy(() => import('./pages/CoordinatorHomePage'));
const SupervisorHomePage  = lazy(() => import('./pages/SupervisorHomePage'));
const DashboardPage       = lazy(() => import('./pages/DashboardPage'));

const WorkOrderDetailPage = lazy(() => import('./pages/WorkOrderDetailPage'));
const WorkOrdersPage      = lazy(() => import('./pages/WorkOrdersPage'));
const PMSchedulePage      = lazy(() => import('./pages/PMSchedulePage'));
const PMWorkOrderPage     = lazy(() => import('./pages/PMWorkOrderPage'));
const CalendarPage        = lazy(() => import('./pages/CalendarPage'));
const InventoryPage       = lazy(() => import('./pages/InventoryPage'));
const PedidosPage         = lazy(() => import('./pages/PedidosPage'));
const NeumaticosPage      = lazy(() => import('./pages/NeumaticosPage'));

const PartsSearch         = lazy(() => import('./components/mechanic/PartsSearch'));
const ManualSearch        = lazy(() => import('./components/mechanic/ManualSearch'));
const DiagramViewer       = lazy(() => import('./components/mechanic/DiagramViewer'));
const CatalogoImportPage  = lazy(() => import('./pages/CatalogoImportPage'));

const GastosPage          = lazy(() => import('./pages/GastosPage'));
const NuevoGastoPage      = lazy(() => import('./pages/NuevoGastoPage'));

const DVIRPage            = lazy(() => import('./pages/DVIRPage'));
const FallaPage           = lazy(() => import('./pages/FallaPage'));
const FleetPage           = lazy(() => import('./pages/FleetPage'));
const AlertsPage          = lazy(() => import('./pages/AlertsPage'));
const DataManagerPage     = lazy(() => import('./pages/DataManagerPage'));
const DieselPage          = lazy(() => import('./pages/DieselPage'));
const HorometroPage       = lazy(() => import('./pages/HorometroPage'));
const ViajePage           = lazy(() => import('./pages/ViajePage'));
const BulkBoletasPage     = lazy(() => import('./pages/BulkBoletasPage'));
const ChatPage            = lazy(() => import('./pages/ChatPage'));
const BriefingCard        = lazy(() => import('./components/dashboard/BriefingCard'));
const PerfilPage          = lazy(() => import('./pages/PerfilPage'));
const MyReportsPage       = lazy(() => import('./pages/MyReportsPage'));

const AdminActivosPage       = lazy(() => import('./pages/AdminActivosPage'));
const AdminOrdenesCompraPage = lazy(() => import('./pages/AdminOrdenesCompraPage'));
const AdminProveedoresPage   = lazy(() => import('./pages/AdminProveedoresPage'));
const OrdenCompraPrintPage   = lazy(() => import('./pages/OrdenCompraPrintPage'));

// ── Convenience wrapper — all lazy routes go through this ────────────────────

function S({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div role="status" aria-live="polite" className="flex items-center justify-center min-h-screen text-slate-400 text-sm">
          <span className="sr-only">Cargando</span>
          <span aria-hidden="true">Cargando...</span>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

/** Wrap a page in an inline ErrorBoundary so one page crash doesn't kill others */
function PageBoundary({ role, children }: { role?: AppRole; children: React.ReactNode }) {
  return (
    <ErrorBoundary role={role} inline>
      {children}
    </ErrorBoundary>
  );
}

// ── Role constants ────────────────────────────────────────────────────────────

const ALL: AppRole[]          = ['operador', 'mecanico', 'jefe_taller', 'coordinador', 'supervisor', 'gerencia'];
const ADMIN: AppRole[]        = ['jefe_taller', 'coordinador', 'supervisor', 'gerencia'];
const WORKSHOP: AppRole[]     = ['mecanico', 'jefe_taller', 'coordinador', 'supervisor', 'gerencia'];
const MANAGEMENT: AppRole[]   = ['jefe_taller', 'coordinador', 'gerencia'];
const GASTOS_WRITE: AppRole[] = ['jefe_taller', 'coordinador', 'gerencia'];
const CALENDAR_ACCESS: AppRole[] = ['jefe_taller', 'coordinador', 'supervisor', 'gerencia'];

function RootRedirect() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.role);
  if (isAuthenticated && role) return <Navigate to={ROLE_HOME[role]} replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  const initRealtime = useWorkOrderStore((s) => s.initRealtime);
  const role = useAuthStore((s) => s.role) ?? undefined;

  useEffect(() => {
    const handleOnline = () => { flushQueue().catch(() => {}); };
    window.addEventListener('online', handleOnline);
    if (navigator.onLine) handleOnline();
    return () => { window.removeEventListener('online', handleOnline); };
  }, []);

  useEffect(() => {
    const cleanup = initRealtime();
    return cleanup;
  }, [initRealtime]);

  return (
    <Routes>
      {/* ── Public routes ──────────────────────────────────────────────── */}
      <Route path="/login"   element={<S><LoginPage /></S>} />
      <Route path="/privacy" element={<S><PrivacyPolicyPage /></S>} />
      <Route path="/terms"   element={<S><TermsPage /></S>} />

      {/* ── Chat — any authenticated user, no AppShell ─────────────────── */}
      <Route path="/chat" element={
        <RequireRole roles={ALL}>
          <S><ChatPage /></S>
        </RequireRole>
      } />

      {/* ── Protected shell ────────────────────────────────────────────── */}
      <Route element={
        <RequireRole roles={ALL}>
          <ErrorBoundary role={role}>
            <AppShell />
          </ErrorBoundary>
        </RequireRole>
      }>
        {/* Role homes */}
        <Route path="/operator"    element={<RequireRole roles={['operador']}><PageBoundary role={role}><S><OperatorHomePage /></S></PageBoundary></RequireRole>} />
        <Route path="/mechanic"    element={<RequireRole roles={['mecanico']}><PageBoundary role={role}><S><MechanicPage /></S></PageBoundary></RequireRole>} />
        <Route path="/workshop"    element={<RequireRole roles={['jefe_taller', 'gerencia', 'supervisor']}><PageBoundary role={role}><S><WorkshopHomePage /></S></PageBoundary></RequireRole>} />
        <Route path="/coordinator" element={<RequireRole roles={['coordinador', 'gerencia']}><PageBoundary role={role}><S><CoordinatorHomePage /></S></PageBoundary></RequireRole>} />
        <Route path="/supervisor"  element={<RequireRole roles={['supervisor', 'gerencia']}><PageBoundary role={role}><S><SupervisorHomePage /></S></PageBoundary></RequireRole>} />
        <Route path="/dashboard"   element={<RequireRole roles={['gerencia', 'supervisor']}><PageBoundary role={role}><S><DashboardPage /></S></PageBoundary></RequireRole>} />

        {/* Work orders */}
        <Route path="/workorders/:otId" element={<RequireRole roles={WORKSHOP}><PageBoundary role={role}><S><WorkOrderDetailPage /></S></PageBoundary></RequireRole>} />
        <Route path="/workorders"       element={<RequireRole roles={WORKSHOP}><PageBoundary role={role}><S><WorkOrdersPage /></S></PageBoundary></RequireRole>} />
        <Route path="/pm"               element={<RequireRole roles={ADMIN}><PageBoundary role={role}><S><PMSchedulePage /></S></PageBoundary></RequireRole>} />
        <Route path="/pm-order"         element={<RequireRole roles={ADMIN}><PageBoundary role={role}><S><PMWorkOrderPage /></S></PageBoundary></RequireRole>} />
        <Route path="/calendar"         element={<RequireRole roles={CALENDAR_ACCESS}><PageBoundary role={role}><S><CalendarPage /></S></PageBoundary></RequireRole>} />

        {/* Parts & manuals */}
        <Route path="/parts"        element={<RequireRole roles={WORKSHOP}><PageBoundary role={role}><S><PartsSearch /></S></PageBoundary></RequireRole>} />
        <Route path="/parts/import" element={<RequireRole roles={ADMIN}><PageBoundary role={role}><S><CatalogoImportPage /></S></PageBoundary></RequireRole>} />
        <Route path="/manuals"      element={<RequireRole roles={WORKSHOP}><PageBoundary role={role}><S><ManualSearch /></S></PageBoundary></RequireRole>} />
        <Route path="/diagrams"     element={<RequireRole roles={WORKSHOP}><PageBoundary role={role}><S><DiagramViewer /></S></PageBoundary></RequireRole>} />

        {/* Inventory & procurement */}
        <Route path="/inventory"  element={<RequireRole roles={ADMIN}><PageBoundary role={role}><S><InventoryPage /></S></PageBoundary></RequireRole>} />
        <Route path="/pedidos"    element={<RequireRole roles={ADMIN}><PageBoundary role={role}><S><PedidosPage /></S></PageBoundary></RequireRole>} />
        <Route path="/neumaticos" element={<RequireRole roles={ADMIN}><PageBoundary role={role}><S><NeumaticosPage /></S></PageBoundary></RequireRole>} />

        {/* Gastos */}
        <Route path="/gastos"       element={<RequireRole roles={MANAGEMENT}><PageBoundary role={role}><S><GastosPage /></S></PageBoundary></RequireRole>} />
        <Route path="/gastos/nuevo" element={<RequireRole roles={GASTOS_WRITE}><PageBoundary role={role}><S><NuevoGastoPage /></S></PageBoundary></RequireRole>} />

        {/* Operator / field operations */}
        <Route path="/dvir"            element={<RequireRole roles={['operador', 'supervisor', 'gerencia']}><PageBoundary role={role}><S><DVIRPage /></S></PageBoundary></RequireRole>} />
        <Route path="/dvir-compliance" element={<RequireRole roles={['operador', 'supervisor', 'gerencia']}><PageBoundary role={role}><S><DVIRPage /></S></PageBoundary></RequireRole>} />
        <Route path="/falla"           element={<RequireRole roles={ALL}><PageBoundary role={role}><S><FallaPage /></S></PageBoundary></RequireRole>} />
        <Route path="/fleet"           element={<RequireRole roles={['supervisor', 'gerencia', 'coordinador']}><PageBoundary role={role}><S><FleetPage /></S></PageBoundary></RequireRole>} />
        <Route path="/alerts"          element={<RequireRole roles={ADMIN}><PageBoundary role={role}><S><AlertsPage /></S></PageBoundary></RequireRole>} />
        <Route path="/data"            element={<RequireRole roles={ADMIN}><PageBoundary role={role}><S><DataManagerPage /></S></PageBoundary></RequireRole>} />
        <Route path="/diesel"          element={<RequireRole roles={['operador', 'supervisor', 'gerencia']}><PageBoundary role={role}><S><DieselPage /></S></PageBoundary></RequireRole>} />
        <Route path="/horometro"       element={<RequireRole roles={['operador', 'supervisor', 'gerencia']}><PageBoundary role={role}><S><HorometroPage /></S></PageBoundary></RequireRole>} />
        <Route path="/viaje"           element={<RequireRole roles={['operador', 'supervisor', 'gerencia']}><PageBoundary role={role}><S><ViajePage /></S></PageBoundary></RequireRole>} />
        <Route path="/flete"           element={<RequireRole roles={['operador', 'supervisor', 'gerencia']}><PageBoundary role={role}><S><ViajePage /></S></PageBoundary></RequireRole>} />
        <Route path="/bulk-boletas"    element={<RequireRole roles={['operador', 'coordinador', 'supervisor', 'gerencia']}><PageBoundary role={role}><S><BulkBoletasPage /></S></PageBoundary></RequireRole>} />
        <Route path="/briefing"        element={<RequireRole roles={MANAGEMENT}><PageBoundary role={role}><S><BriefingCard /></S></PageBoundary></RequireRole>} />
        <Route path="/perfil"          element={<RequireRole roles={ALL}><PageBoundary role={role}><S><PerfilPage /></S></PageBoundary></RequireRole>} />
        <Route path="/my-reports"      element={<RequireRole roles={ALL}><PageBoundary role={role}><S><MyReportsPage /></S></PageBoundary></RequireRole>} />

        {/* Admin (Gerencia) */}
        <Route path="/admin/activos"             element={<RequireRole roles={['gerencia']}><PageBoundary role={role}><S><AdminActivosPage /></S></PageBoundary></RequireRole>} />
        <Route path="/admin/ordenes-compra"      element={<RequireRole roles={['gerencia']}><PageBoundary role={role}><S><AdminOrdenesCompraPage /></S></PageBoundary></RequireRole>} />
        <Route path="/admin/proveedores"         element={<RequireRole roles={['gerencia']}><PageBoundary role={role}><S><AdminProveedoresPage /></S></PageBoundary></RequireRole>} />
        <Route path="/admin/ordenes-compra/:ocId" element={<RequireRole roles={['gerencia']}><PageBoundary role={role}><S><OrdenCompraPrintPage /></S></PageBoundary></RequireRole>} />
      </Route>

      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
