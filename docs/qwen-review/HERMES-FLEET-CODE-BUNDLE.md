# Hermes Fleet App — Full Code Bundle for Qwen Review

Production React 19 + TypeScript PWA for fleet management.
Backend: Google Sheets via Python FastAPI on VPS. Deployed on Vercel.

---

## `package.json`

```json
{
  "name": "hermes-fleet-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.101.1",
    "jspdf": "^4.2.1",
    "jspdf-autotable": "^5.0.7",
    "lucide-react": "^1.7.0",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-router-dom": "^7.14.0",
    "recharts": "^3.8.1",
    "zustand": "^5.0.12"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.4",
    "@tailwindcss/vite": "^4.2.2",
    "@types/node": "^24.12.0",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.1",
    "eslint": "^9.39.4",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.5.2",
    "globals": "^17.4.0",
    "tailwindcss": "^4.2.2",
    "typescript": "~5.9.3",
    "typescript-eslint": "^8.57.0",
    "vite": "^8.0.1"
  }
}
```

---

## `src/main.tsx`

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
```

---

## `src/App.tsx`

```typescript
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
        <Route path="/viajes-pena"      element={<RequireRole roles={['supervisor', 'gerencia']}><ViajesPenaPage /></RequireRole>} />
        <Route path="/briefing"         element={<RequireRole roles={MANAGEMENT}><BriefingCard /></RequireRole>} />
        <Route path="/perfil"           element={<RequireRole roles={ALL}><PerfilPage /></RequireRole>} />
        <Route path="/my-reports"       element={<RequireRole roles={ALL}><MyReportsPage /></RequireRole>} />
      </Route>

      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
```

---

## `src/types/roles.ts`

```typescript
export type AppRole =
  | 'operador'
  | 'mecanico'
  | 'jefe_taller'
  | 'coordinador'
  | 'supervisor'
  | 'gerencia';

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
}

export const NAV_CONFIG: Record<AppRole, { visible: NavItem[]; overflow: NavItem[] }> = {
  operador: {
    visible: [
      { id: 'inicio',   label: 'Inicio',    icon: 'Home',          path: '/operator' },
      { id: 'reportar', label: 'Reportar',  icon: 'Camera',        path: '/falla' },
      { id: 'dvir',     label: 'Checklist', icon: 'ClipboardCheck',path: '/dvir' },
      { id: 'diesel',   label: 'Diesel',    icon: 'Fuel',          path: '/diesel' },
      { id: 'mas',      label: 'Más',       icon: 'MoreHorizontal',path: '' },
    ],
    overflow: [
      { id: 'horometro', label: 'Horómetro', icon: 'Gauge',  path: '/horometro' },
      { id: 'fletes',    label: 'Fletes',    icon: 'MapPin', path: '/flete' },
      { id: 'perfil',    label: 'Perfil',    icon: 'User',   path: '/perfil' },
    ],
  },
  mecanico: {
    visible: [
      { id: 'inicio',  label: 'Inicio',  icon: 'Home',          path: '/mechanic' },
      { id: 'ordenes', label: 'Órdenes', icon: 'Wrench',        path: '/workorders' },
      { id: 'partes',  label: 'Partes',  icon: 'Package',       path: '/parts' },
      { id: 'hermes',  label: 'Hermes',  icon: 'MessageCircle', path: '/chat' },
      { id: 'mas',     label: 'Más',     icon: 'MoreHorizontal',path: '' },
    ],
    overflow: [
      { id: 'manuales',  label: 'Manuales',  icon: 'BookOpen',  path: '/manuals' },
      { id: 'diagramas', label: 'Diagramas', icon: 'FileImage', path: '/diagrams' },
    ],
  },
  jefe_taller: {
    visible: [
      { id: 'inicio',  label: 'Inicio',  icon: 'Home',          path: '/workshop' },
      { id: 'ordenes', label: 'Órdenes', icon: 'Wrench',        path: '/workorders' },
      { id: 'pm',      label: 'PM',      icon: 'Clock',         path: '/pm' },
      { id: 'partes',  label: 'Partes',  icon: 'Package',       path: '/parts' },
      { id: 'mas',     label: 'Más',     icon: 'MoreHorizontal',path: '' },
    ],
    overflow: [
      { id: 'hermes',     label: 'Hermes Chat', icon: 'MessageCircle', path: '/chat' },
      { id: 'pm-order',   label: 'Orden PM',    icon: 'CalendarCheck', path: '/pm-order' },
      { id: 'manuales',   label: 'Manuales',    icon: 'BookOpen',      path: '/manuals' },
      { id: 'diagramas',  label: 'Diagramas',   icon: 'FileImage',     path: '/diagrams' },
      { id: 'pedidos',    label: 'Pedidos',     icon: 'ShoppingCart',  path: '/pedidos' },
      { id: 'neumaticos', label: 'Neumáticos',  icon: 'Disc3',         path: '/neumaticos' },
      { id: 'gastos',     label: 'Gastos',      icon: 'Receipt',       path: '/gastos/nuevo' },
    ],
  },
  coordinador: {
    visible: [
      { id: 'inicio',    label: 'Inicio',    icon: 'Home',          path: '/coordinator' },
      { id: 'ordenes',   label: 'Órdenes',   icon: 'Wrench',        path: '/workorders' },
      { id: 'pm-order',  label: 'Orden PM',  icon: 'CalendarCheck', path: '/pm-order' },
      { id: 'inventario',label: 'Inventario',icon: 'Package',       path: '/inventory' },
      { id: 'mas',       label: 'Más',       icon: 'MoreHorizontal',path: '' },
    ],
    overflow: [
      { id: 'pm',      label: 'Programa PM', icon: 'Clock',        path: '/pm' },
      { id: 'pedidos', label: 'Pedidos',     icon: 'ShoppingCart', path: '/pedidos' },
      { id: 'alertas', label: 'Alertas',     icon: 'AlertTriangle',path: '/alerts' },
      { id: 'gastos',  label: 'Gastos',      icon: 'Receipt',      path: '/gastos/nuevo' },
    ],
  },
  supervisor: {
    visible: [
      { id: 'inicio',  label: 'Inicio',  icon: 'Home',          path: '/supervisor' },
      { id: 'equipos', label: 'Equipos', icon: 'Truck',         path: '/fleet' },
      { id: 'viajes',  label: 'Viajes',  icon: 'MapPin',        path: '/viajes-pena' },
      { id: 'alertas', label: 'Alertas', icon: 'AlertTriangle', path: '/alerts' },
      { id: 'perfil',  label: 'Perfil',  icon: 'User',          path: '/perfil' },
    ],
    overflow: [],
  },
  gerencia: {
    visible: [
      { id: 'dashboard', label: 'Dashboard', icon: 'BarChart3',    path: '/dashboard' },
      { id: 'ordenes',   label: 'Órdenes',   icon: 'Wrench',       path: '/workorders' },
      { id: 'gastos',    label: 'Gastos',    icon: 'Receipt',      path: '/gastos' },
      { id: 'pedidos',   label: 'Pedidos',   icon: 'ShoppingCart', path: '/pedidos' },
      { id: 'alertas',   label: 'Alertas',   icon: 'AlertTriangle',path: '/alerts' },
    ],
    overflow: [
      { id: 'briefing', label: 'Briefing', icon: 'FileText', path: '/briefing' },
    ],
  },
};

export const ROLE_HOME: Record<AppRole, string> = {
  operador:    '/operator',
  mecanico:    '/mechanic',
  jefe_taller: '/workshop',
  coordinador: '/coordinator',
  supervisor:  '/supervisor',
  gerencia:    '/dashboard',
};

export const ROLE_LABELS: Record<AppRole, string> = {
  operador:    'Operador',
  mecanico:    'Mecánico',
  jefe_taller: 'Jefe de Taller',
  coordinador: 'Coordinador',
  supervisor:  'Supervisor',
  gerencia:    'Gerencia',
};
```

---

## `src/types/workorder.ts`

```typescript
export type OTPriority = 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA';
export type OTEstado = 'Abierta' | 'En Reparación' | 'Esperando Pieza' | 'Resuelta' | 'Completado';

export const OT_STATUS_FLOW: OTEstado[] = ['Abierta', 'En Reparación', 'Esperando Pieza', 'Resuelta', 'Completado'];

export type OTStatusField = 'estado' | 'mecanico_asignado' | 'progreso' | 'observaciones' | 'costo_estimado' | 'prioridad';

export interface StatusLogEntry {
  timestamp: string;
  ot_id: string;
  field: OTStatusField;
  old_value: string;
  new_value: string;
  changed_by: string;
  role: string;
}

export function getNextStatuses(current: OTEstado): OTEstado[] {
  const idx = OT_STATUS_FLOW.indexOf(current);
  if (idx < 0) return OT_STATUS_FLOW;
  return OT_STATUS_FLOW.slice(idx);
}

export interface WorkOrder {
  ot_id: string;
  fecha: string;
  unidad: string;
  tipo_averia: string;
  descripcion: string;
  severidad: string;
  prioridad: OTPriority;
  mecanico_asignado: string;
  estado: OTEstado;
  foto_url: string;
  averia_ref: string;
  partes_necesarias: string;
  costo_estimado: number;
  fecha_cierre: string;
  observaciones: string;
  progreso: number;
}

export const PRIORITY_CONFIG: Record<OTPriority, { color: string; bg: string; label: string; time: string }> = {
  CRITICA: { color: '#DC2626', bg: '#FEE2E2', label: 'CRÍTICA', time: '< 4 horas' },
  ALTA: { color: '#EA580C', bg: '#FFEDD5', label: 'ALTA', time: '< 8 horas' },
  MEDIA: { color: '#F59E0B', bg: '#FEF3C7', label: 'MEDIA', time: '< 24 horas' },
  BAJA: { color: '#3B82F6', bg: '#DBEAFE', label: 'BAJA', time: '< 1 semana' },
};

export const ESTADO_CONFIG: Record<OTEstado, { color: string; bg: string }> = {
  'Abierta': { color: '#3B82F6', bg: '#DBEAFE' },
  'En Reparación': { color: '#2563EB', bg: '#FEF3C7' },
  'Esperando Pieza': { color: '#EA580C', bg: '#FFEDD5' },
  'Resuelta': { color: '#8B5CF6', bg: '#EDE9FE' },
  'Completado': { color: '#16A34A', bg: '#DCFCE7' },
};
```

---

## `src/types/equipment.ts`

```typescript
export interface Equipment {
  unit_id: string;
  model: string;
  type: string;
  client: string;
  status: string;
  current_horometro: number;
  next_pm_level: string;
  next_pm_horometro: number;
  last_inspection_date: string;
  last_inspection_result: string;
  assigned_operator: string;
}
```

---

## `src/types/dvir.ts`

```typescript
export type CheckStatus = 'ok' | 'alerta' | 'falla' | null;
export type DVIRResult = 'aprobado' | 'condicional' | 'reprobado';
export type DVIRType = 'pre-operacion' | 'post-operacion';

export interface DVIRSystem {
  id: string;
  label: string;
  icon: string;
}

export interface DVIRCheck {
  system_id: string;
  status: CheckStatus;
  photo_url?: string;
  notes?: string;
}

export interface DVIRInspection {
  unit_id: string;
  type: DVIRType;
  operator: string;
  horometro: number;
  fecha: string;
  hora: string;
  checks: DVIRCheck[];
  result: DVIRResult;
  score: number;
  observations: string;
  ot_generated?: string;
}
```

---

## `src/types/fuel.ts`

```typescript
export interface FuelLog {
  id: string;
  fecha: string;
  hora: string;
  unidad: string;
  operador: string;
  tipo_combustible: 'ULSD' | 'Diesel' | 'Gasolina';
  litros: number;
  costo: number;
  horometro: number;
  km: number;
  rendimiento: number;
  estacion: string;
  observaciones: string;
  anomaly_flag: boolean;
}
```

---

## `src/types/trip.ts`

```typescript
export interface TripLog {
  id: string;
  fecha: string;
  hora: string;
  camion: string;
  conductor: string;
  ruta_origen: string;
  ruta_destino: string;
  km_cargado: number;
  km_vacio: number;
  km_total: number;
  material: 'Tierra' | 'Roca' | 'Grava' | 'Mineral' | 'Caliza' | 'Otro';
  tonelaje: number;
  observaciones: string;
}
```

---

## `src/types/chat.ts`

```typescript
export interface ChatMessage {
  id: string;
  role: 'user' | 'hermes';
  content: string;
  photo_url?: string;
  timestamp: Date;
  loading?: boolean;
}

export interface DiagnoseResponse {
  causas_probables: string[];
  checklist_diagnostico: string[];
  partes_probables: string[];
  prioridad: string;
}

export interface PhotoAnalysisResponse {
  componente_probable: string;
  tipo_de_dano: string;
  severidad: string;
  recomendacion_inicial: string;
}
```

---

## `src/stores/auth-store.ts`

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppRole } from '../types/roles';

interface AuthState {
  role: AppRole | null;
  userName: string;
  assignedUnits: string[];
  isAuthenticated: boolean;
  login: (role: AppRole, pin: string) => boolean;
  logout: () => void;
}

const MOCK_USERS: Record<AppRole, { userName: string; assignedUnits: string[]; pin: string }> = {
  operador:    { userName: 'Operador',       assignedUnits: ['EPAK-09'], pin: '2026' },
  mecanico:    { userName: 'Mecánico',       assignedUnits: [], pin: '2015' },
  jefe_taller: { userName: 'Jefe de Taller', assignedUnits: [], pin: '1995' },
  coordinador: { userName: 'Coordinador',    assignedUnits: [], pin: '2001' },
  supervisor:  { userName: 'Supervisor',     assignedUnits: ['EPAK-09', 'EPTK-08', 'EPCF-08'], pin: '2008' },
  gerencia:    { userName: 'Gerencia',       assignedUnits: [], pin: '1963' },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      role: null,
      userName: '',
      assignedUnits: [],
      isAuthenticated: false,

      login: (role: AppRole, pin: string): boolean => {
        if (pin.length !== 4) return false;
        const user = MOCK_USERS[role];
        if (pin !== user.pin) return false;
        set({
          role,
          userName: user.userName,
          assignedUnits: user.assignedUnits,
          isAuthenticated: true,
        });
        return true;
      },

      logout: () => {
        set({
          role: null,
          userName: '',
          assignedUnits: [],
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'hermes-auth',
      // Only persist the session state, not the action functions
      partialize: (state) => ({
        role: state.role,
        userName: state.userName,
        assignedUnits: state.assignedUnits,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
```

---

## `src/stores/gastos-store.ts`

```typescript
import { create } from 'zustand';
import { readRange, appendRow, updateCell, SHEET_TABS } from '../lib/sheets-api';
import { useCatalogoStore } from './catalogo-store';
import type { OcrLineItem } from '../lib/sheets-api';
import { mexicoDate, mexicoTime } from '../lib/date-utils';

// ── Types ─────────────────────────────────────────────────────────────────────

export type GastoTipo = 'Refaccion' | 'Combustible' | 'Servicio' | 'Otro';
export type GastoStatus = 'Borrador' | 'Aprobado' | 'Rechazado' | 'Eliminado';
export type MetodoPago = 'Efectivo' | 'Transferencia' | 'Tarjeta';

// Single flat row per receipt — stored in the "Gastos" tab
// A  Gasto_ID | B Fecha | C Hora | D Tipo | E Proveedor | F RFC_Proveedor
// G  Folio_Factura | H Subtotal | I IVA | J Total | K Unidad | L OT_ID
// M  Solicitante | N Metodo_Pago | O Items | P Imagen_URL | Q Status
export interface GastoCompra {
  gasto_id: string;
  fecha: string;
  hora: string;
  tipo: GastoTipo;
  proveedor: string;
  rfc_proveedor: string;
  folio_factura: string;
  subtotal: number;
  iva: number;
  total: number;
  unidad: string;
  ot_id: string;
  solicitante: string;
  metodo_pago: MetodoPago;
  items: string;       // human-readable line items, e.g. "Filtro aceite x2 $450 | Bujías x4 $280"
  imagen_url: string;
  status: GastoStatus;
}

export interface NuevoGastoPayload {
  tipo: GastoTipo;
  proveedor: string;
  rfc_proveedor: string;
  folio_factura: string;
  subtotal: number;
  iva: number;
  total: number;
  unidad: string;
  ot_id: string;
  metodo_pago: MetodoPago;
  imagen_url: string;
  solicitante: string;
  line_items: OcrLineItem[];
}

// ── State ─────────────────────────────────────────────────────────────────────

interface GastosState {
  gastos: GastoCompra[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  fetched: boolean;
  fetchGastos: () => Promise<void>;
  saveGasto: (payload: NuevoGastoPayload) => Promise<string>;
  deleteGasto: (gastoId: string) => Promise<void>;
}

// ── Row parser ────────────────────────────────────────────────────────────────

/** Strip currency symbols, commas, and whitespace before parsing — gspread
 *  returns FORMATTED_VALUE by default (e.g. "$3,356.00"). */
function parseNum(v: string | undefined): number {
  return Number(String(v ?? '').replace(/[$,\s]/g, '')) || 0;
}

function parseGastoRow(row: string[]): GastoCompra | null {
  if (!row[0] || row[0] === 'Gasto_ID') return null;
  return {
    gasto_id:      row[0] ?? '',
    fecha:         row[1] ?? '',
    hora:          row[2] ?? '',
    tipo:          (row[3] ?? 'Otro') as GastoTipo,
    proveedor:     row[4] ?? '',
    rfc_proveedor: row[5] ?? '',
    folio_factura: row[6] ?? '',
    subtotal:      parseNum(row[7]),
    iva:           parseNum(row[8]),
    total:         parseNum(row[9]),
    unidad:        row[10] ?? '',
    ot_id:         row[11] ?? '',
    solicitante:   row[12] ?? '',
    metodo_pago:   (row[13] ?? 'Efectivo') as MetodoPago,
    items:         row[14] ?? '',
    imagen_url:    row[15] ?? '',
    status:        (row[16] ?? 'Aprobado') as GastoStatus,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeGastoId(): string {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 4).toUpperCase();
  return `GST-${ym}-${rand}`;
}

/**
 * Serialize line items as a readable string for the single Items column.
 * Example: "Filtro aceite x2 $450.00 | Bujías x4 $280.00"
 */
function serializeItems(items: OcrLineItem[]): string {
  return items
    .filter((i) => i.description.trim())
    .map((i) => {
      const desc = i.part_number ? `[${i.part_number}] ${i.description}` : i.description;
      return `${desc} x${i.qty} $${i.subtotal.toFixed(2)}`;
    })
    .join(' | ');
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useGastosStore = create<GastosState>((set, get) => ({
  gastos: [],
  loading: false,
  saving: false,
  error: null,
  fetched: false,

  fetchGastos: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const rows = await readRange(SHEET_TABS.GASTOS);
      const gastos: GastoCompra[] = [];
      for (const row of rows) {
        const g = parseGastoRow(row);
        if (g) gastos.push(g);
      }
      set({ gastos, loading: false, fetched: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar gastos';
      set({ error: message, loading: false, fetched: true });
    }
  },

  saveGasto: async (payload: NuevoGastoPayload): Promise<string> => {
    set({ saving: true, error: null });
    const gastoId = makeGastoId();
    const fecha = mexicoDate();
    const hora = mexicoTime();

    try {
      await appendRow(SHEET_TABS.GASTOS, [
        gastoId,                          // A: Gasto_ID
        fecha,                            // B: Fecha
        hora,                             // C: Hora
        payload.tipo,                     // D: Tipo
        payload.proveedor,                // E: Proveedor
        payload.rfc_proveedor,            // F: RFC_Proveedor
        payload.folio_factura,            // G: Folio_Factura
        payload.subtotal.toFixed(2),      // H: Subtotal
        payload.iva.toFixed(2),           // I: IVA
        payload.total.toFixed(2),         // J: Total
        payload.unidad,                   // K: Unidad
        payload.ot_id,                    // L: OT_ID
        payload.solicitante,              // M: Solicitante
        payload.metodo_pago,              // N: Metodo_Pago
        serializeItems(payload.line_items), // O: Items
        payload.imagen_url,               // P: Imagen_URL
        'Aprobado',                       // Q: Status
      ]);

      const newGasto: GastoCompra = {
        gasto_id:      gastoId,
        fecha,
        hora,
        tipo:          payload.tipo,
        proveedor:     payload.proveedor,
        rfc_proveedor: payload.rfc_proveedor,
        folio_factura: payload.folio_factura,
        subtotal:      payload.subtotal,
        iva:           payload.iva,
        total:         payload.total,
        unidad:        payload.unidad,
        ot_id:         payload.ot_id,
        solicitante:   payload.solicitante,
        metodo_pago:   payload.metodo_pago,
        items:         serializeItems(payload.line_items),
        imagen_url:    payload.imagen_url,
        status:        'Aprobado',
      };

      set((state) => ({
        gastos: [newGasto, ...state.gastos],
        saving: false,
      }));

      // Sync line items to price catalog (non-blocking)
      const itemsWithPrice = payload.line_items.filter(
        (i) => i.description.trim() && (i.unit_price > 0 || i.subtotal > 0)
      );
      if (itemsWithPrice.length > 0) {
        useCatalogoStore.getState().syncLineItems(itemsWithPrice, payload.proveedor);
      }

      return gastoId;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al guardar gasto';
      set({ error: message, saving: false });
      throw err;
    }
  },

  deleteGasto: async (gastoId: string): Promise<void> => {
    // Optimistically remove from local state
    set((state) => ({
      gastos: state.gastos.filter((g) => g.gasto_id !== gastoId),
    }));
    try {
      // Mark as "Eliminado" in the sheet (col 0 = Gasto_ID, col 16 = Status)
      await updateCell(SHEET_TABS.GASTOS, 0, gastoId, 16, 'Eliminado');
    } catch (err: unknown) {
      // If sheet update fails, restore the row on next fetch — not critical
      console.error('Failed to mark gasto as Eliminado in sheet:', err);
    }
  },
}));
```

---

## `src/stores/catalogo-store.ts`

```typescript
import { create } from 'zustand';
import { readRange, upsertRow, SHEET_TABS } from '../lib/sheets-api';
import { mexicoDate } from '../lib/date-utils';
import type { OcrLineItem } from '../lib/sheets-api';

// ── Catalog schema ────────────────────────────────────────────────────────────
// Catalogo_Precios sheet columns:
// A(0) Clave           — part_number or slug(description)
// B(1) Descripcion
// C(2) Precio_Unitario — latest seen price
// D(3) Precio_Min
// E(4) Precio_Max
// F(5) Proveedor       — latest supplier
// G(6) Fecha_Actualizacion
// H(7) Veces_Comprado

export interface CatalogoEntry {
  clave:        string;
  descripcion:  string;
  precio:       number;
  precioMin:    number;
  precioMax:    number;
  proveedor:    string;
  fechaActual:  string;
  vecesComprado: number;
}

interface CatalogoState {
  entries:  CatalogoEntry[];
  fetched:  boolean;
  loading:  boolean;
  fetchCatalogo: () => Promise<void>;
  syncLineItems: (items: OcrLineItem[], proveedor: string) => Promise<void>;
  search: (query: string) => CatalogoEntry[];
}

// ── Row key: part_number if available, otherwise normalised description ────────

export function catalogKey(partNumber: string, description: string): string {
  const pn = partNumber.trim().toUpperCase();
  if (pn) return pn;
  return description.trim().toUpperCase().replace(/\s+/g, '_').slice(0, 40);
}

function parseNum(v: string | undefined): number {
  return Number(String(v ?? '').replace(/[$,\s]/g, '')) || 0;
}

function parseRow(row: string[]): CatalogoEntry | null {
  if (!row[0] || row[0] === 'Clave') return null;
  return {
    clave:         row[0] ?? '',
    descripcion:   row[1] ?? '',
    precio:        parseNum(row[2]),
    precioMin:     parseNum(row[3]),
    precioMax:     parseNum(row[4]),
    proveedor:     row[5] ?? '',
    fechaActual:   row[6] ?? '',
    vecesComprado: parseInt(row[7] ?? '0') || 0,
  };
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useCatalogoStore = create<CatalogoState>((set, get) => ({
  entries: [],
  fetched: false,
  loading: false,

  fetchCatalogo: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const rows = await readRange(SHEET_TABS.CATALOGO_PRECIOS);
      const entries: CatalogoEntry[] = [];
      for (const row of rows) {
        const e = parseRow(row);
        if (e) entries.push(e);
      }
      set({ entries, fetched: true, loading: false });
    } catch {
      set({ loading: false, fetched: true });
    }
  },

  /**
   * Called after saving a gasto. For each line item with a description,
   * upserts the catalog entry: updates price/supplier/date/count, or inserts new.
   */
  syncLineItems: async (items: OcrLineItem[], proveedor: string) => {
    const today = mexicoDate();
    const { entries } = get();

    for (const item of items) {
      if (!item.description.trim()) continue;

      const clave  = catalogKey(item.part_number, item.description);
      const precio = item.unit_price > 0 ? item.unit_price : item.subtotal / Math.max(item.qty, 1);

      // Look up existing entry in local cache for min/max tracking
      const existing = entries.find((e) => e.clave === clave);
      const precioMin = existing ? Math.min(existing.precioMin || precio, precio) : precio;
      const precioMax = existing ? Math.max(existing.precioMax || precio, precio) : precio;
      const veces     = (existing?.vecesComprado ?? 0) + 1;

      const row = [
        clave,
        item.description.trim(),
        precio.toFixed(2),
        precioMin.toFixed(2),
        precioMax.toFixed(2),
        proveedor,
        today,
        String(veces),
      ];

      // Fire-and-forget — catalog sync failure must not block gasto save
      upsertRow(SHEET_TABS.CATALOGO_PRECIOS, clave, row).catch((err) => {
        console.warn('Catalog sync failed for', clave, err);
      });
    }

    // Optimistically update local cache
    set((state) => {
      const updated = [...state.entries];
      for (const item of items) {
        if (!item.description.trim()) continue;
        const clave  = catalogKey(item.part_number, item.description);
        const precio = item.unit_price > 0 ? item.unit_price : item.subtotal / Math.max(item.qty, 1);
        const idx    = updated.findIndex((e) => e.clave === clave);
        const entry: CatalogoEntry = {
          clave,
          descripcion:   item.description.trim(),
          precio,
          precioMin:     idx >= 0 ? Math.min(updated[idx].precioMin || precio, precio) : precio,
          precioMax:     idx >= 0 ? Math.max(updated[idx].precioMax || precio, precio) : precio,
          proveedor,
          fechaActual:   today,
          vecesComprado: (idx >= 0 ? updated[idx].vecesComprado : 0) + 1,
        };
        if (idx >= 0) updated[idx] = entry;
        else updated.push(entry);
      }
      return { entries: updated };
    });
  },

  search: (query: string): CatalogoEntry[] => {
    if (!query.trim()) return [];
    const q = query.toUpperCase();
    return get().entries.filter(
      (e) =>
        e.clave.includes(q) ||
        e.descripcion.toUpperCase().includes(q) ||
        e.proveedor.toUpperCase().includes(q)
    ).slice(0, 8);
  },
}));
```

---

## `src/stores/workorder-store.ts`

```typescript
import { create } from 'zustand';
import { readRange, appendRow, updateCell, SHEET_TABS } from '../lib/sheets-api';
import type { WorkOrder, StatusLogEntry, OTStatusField, OTEstado, OTPriority } from '../types/workorder';
import { mexicoDate, mexicoTime } from '../lib/date-utils';

/** Wrap a promise with a timeout. Rejects if not resolved in ms. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms)
    ),
  ]);
}

interface WorkOrderState {
  workorders: WorkOrder[];
  statusLog: StatusLogEntry[];
  loading: boolean;
  error: string | null;
  fetched: boolean;
  fetchWorkOrders: () => Promise<void>;
  updateOTField: (
    otId: string,
    field: OTStatusField,
    newValue: string,
    changedBy: string,
    role: string,
  ) => Promise<void>;
  getWorkOrderById: (otId: string) => WorkOrder | undefined;
}

function parseWorkOrderRow(row: string[]): WorkOrder | null {
  if (!row[1] || !row[1].startsWith('OT-')) return null;
  return {
    ot_id: row[1] ?? '',
    fecha: row[2] ?? '',
    unidad: row[3] ?? '',
    tipo_averia: row[4] ?? '',
    descripcion: row[5] ?? '',
    severidad: row[6] ?? '',
    prioridad: (row[7] ?? 'MEDIA') as OTPriority,
    mecanico_asignado: row[8] ?? '',
    estado: (row[9] ?? 'Abierta') as OTEstado,
    foto_url: row[10] ?? '',
    averia_ref: row[11] ?? '',
    partes_necesarias: row[12] ?? '',
    costo_estimado: Number(row[13]) || 0,
    fecha_cierre: row[14] ?? '',
    observaciones: row[15] ?? '',
    progreso: Number(row[16]) || 0,
  };
}

function parseStatusLogRow(row: string[]): StatusLogEntry | null {
  if (!row[1] || !row[1].startsWith('OT-')) return null;
  return {
    timestamp: row[0] ?? '',
    ot_id: row[1] ?? '',
    field: (row[2] ?? 'estado') as OTStatusField,
    old_value: row[3] ?? '',
    new_value: row[4] ?? '',
    changed_by: row[5] ?? '',
    role: row[6] ?? '',
  };
}

function applyStatusLog(workorders: WorkOrder[], log: StatusLogEntry[]): WorkOrder[] {
  const sorted = [...log].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const woMap = new Map<string, WorkOrder>();
  for (const wo of workorders) {
    woMap.set(wo.ot_id, { ...wo });
  }
  for (const entry of sorted) {
    const wo = woMap.get(entry.ot_id);
    if (!wo) continue;
    switch (entry.field) {
      case 'estado':
        wo.estado = entry.new_value as OTEstado;
        break;
      case 'mecanico_asignado':
        wo.mecanico_asignado = entry.new_value;
        break;
      case 'progreso':
        wo.progreso = Number(entry.new_value) || 0;
        break;
      case 'observaciones':
        wo.observaciones = entry.new_value;
        break;
      case 'costo_estimado':
        wo.costo_estimado = Number(entry.new_value) || 0;
        break;
      case 'prioridad':
        wo.prioridad = entry.new_value as OTPriority;
        break;
    }
    woMap.set(wo.ot_id, wo);
  }
  return Array.from(woMap.values());
}

export const useWorkOrderStore = create<WorkOrderState>((set, get) => ({
  workorders: [],
  statusLog: [],
  loading: false,
  error: null,
  fetched: false,

  fetchWorkOrders: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const [otResult, logResult] = await Promise.allSettled([
        withTimeout(readRange(SHEET_TABS.ORDENES_TRABAJO), 10000),
        withTimeout(readRange(SHEET_TABS.OT_STATUS_LOG), 10000),
      ]);

      const otRows = otResult.status === 'fulfilled' ? otResult.value : [];
      const logRows = logResult.status === 'fulfilled' ? logResult.value : [];

      const baseWorkorders: WorkOrder[] = [];
      for (const row of otRows) {
        const wo = parseWorkOrderRow(row);
        if (wo) baseWorkorders.push(wo);
      }

      const statusLog: StatusLogEntry[] = [];
      for (const row of logRows) {
        const entry = parseStatusLogRow(row);
        if (entry) statusLog.push(entry);
      }

      const workorders = applyStatusLog(baseWorkorders, statusLog);
      set({ workorders, statusLog, loading: false, fetched: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar órdenes';
      set({ workorders: [], statusLog: [], error: message, loading: false, fetched: true });
    }
  },

  updateOTField: async (otId, field, newValue, changedBy, role) => {
    const wo = get().workorders.find((w) => w.ot_id === otId);
    if (!wo) return;

    const oldValue = String(wo[field] ?? '');
    const timestamp = `${mexicoDate()} ${mexicoTime()}`;

    const entry: StatusLogEntry = {
      timestamp,
      ot_id: otId,
      field,
      old_value: oldValue,
      new_value: newValue,
      changed_by: changedBy,
      role,
    };

    // Optimistic update
    set((state) => {
      const updatedLog = [...state.statusLog, entry];
      const updatedWOs = state.workorders.map((w) => {
        if (w.ot_id !== otId) return w;
        const updated = { ...w };
        switch (field) {
          case 'estado':
            updated.estado = newValue as OTEstado;
            break;
          case 'mecanico_asignado':
            updated.mecanico_asignado = newValue;
            break;
          case 'progreso':
            updated.progreso = Number(newValue) || 0;
            break;
          case 'observaciones':
            updated.observaciones = newValue;
            break;
          case 'costo_estimado':
            updated.costo_estimado = Number(newValue) || 0;
            break;
          case 'prioridad':
            updated.prioridad = newValue as OTPriority;
            break;
        }
        return updated;
      });
      return { workorders: updatedWOs, statusLog: updatedLog };
    });

    try {
      await appendRow(SHEET_TABS.OT_STATUS_LOG, [
        timestamp,
        otId,
        field,
        oldValue,
        newValue,
        changedBy,
        role,
      ]);

      const FIELD_TO_COLUMN: Record<string, number> = {
        estado: 9,
        mecanico_asignado: 8,
        prioridad: 7,
        observaciones: 15,
        progreso: 16,
        costo_estimado: 13,
      };
      const col = FIELD_TO_COLUMN[field];
      if (col !== undefined) {
        try {
          await updateCell(SHEET_TABS.ORDENES_TRABAJO, 1, otId, col, newValue);
        } catch {
          // Non-critical — the log is the source of truth
        }
      }

      // Auto-sync Averías sheet when estado changes
      // Averías ESTADO is at column 9, OT_ID stored at column 13
      if (field === 'estado') {
        try {
          await updateCell(SHEET_TABS.AVERIAS, 13, otId, 9, newValue);
        } catch {
          // Non-critical — Averías row may not exist for older OTs
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al guardar';
      set({ error: message });
    }
  },

  getWorkOrderById: (otId) => {
    return get().workorders.find((w) => w.ot_id === otId);
  },
}));
```

---

## `src/stores/equipment-store.ts`

```typescript
import { create } from 'zustand';
import { readRange, SHEET_TABS } from '../lib/sheets-api';
import type { Equipment } from '../types/equipment';

// ── Status normalization ───────────────────────────────────────────────────────

function normalizeStatus(raw: string): string {
  const s = (raw ?? '').toLowerCase().trim();
  if (s === 'operativo') return 'operativo';
  if (s.includes('reparac')) return 'taller';
  if (s.includes('traslado')) return 'alerta';
  if (s.includes('alerta')) return 'alerta';
  if (s.includes('taller')) return 'taller';
  return 'inactivo';
}

// ── Row parser ─────────────────────────────────────────────────────────────────
// Sheet columns (0-indexed):
//  0=#  1=COD1  2=COD2  3=Descripción  4=Marca  5=Modelo  6=Año
//  7=Serie  8=Ubicación  9=Estado  10=Lectura Actual Hr/Km  11=Fecha Lectura

function parseEquipmentRow(row: string[]): Equipment | null {
  const unit_id = (row[1] ?? '').trim();
  if (!unit_id) return null; // skip empty rows

  const marca = (row[4] ?? '').trim();
  const modelo = (row[5] ?? '').trim();

  return {
    unit_id,
    model: [marca, modelo].filter(Boolean).join(' ') || unit_id,
    type: (row[3] ?? '').trim() || 'Equipo',
    client: 'GTP',
    status: normalizeStatus(row[9] ?? ''),
    current_horometro: parseFloat((row[10] ?? '').replace(/,/g, '')) || 0,
    next_pm_level: '',
    next_pm_horometro: 0,
    last_inspection_date: (row[11] ?? '').trim(),
    last_inspection_result: '',
    assigned_operator: '',
  };
}

// ── Store ──────────────────────────────────────────────────────────────────────

interface EquipmentState {
  equipment: Equipment[];
  fetched: boolean;
  loading: boolean;
  error: string | null;
  fetchEquipment: () => Promise<void>;
}

export const useEquipmentStore = create<EquipmentState>((set, get) => ({
  equipment: [],
  fetched: false,
  loading: false,
  error: null,

  fetchEquipment: async () => {
    if (get().fetched || get().loading) return;
    set({ loading: true, error: null });
    try {
      const rows = await readRange(SHEET_TABS.FLOTA);
      // Rows 0–4 are branding/headers; real data starts at row 5 (index 5)
      const DATA_START = 5;
      const parsed = rows
        .slice(DATA_START)
        .map(parseEquipmentRow)
        .filter((e): e is Equipment => e !== null);
      set({ equipment: parsed, fetched: true, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },
}));
```

---

## `src/stores/cart-store.ts`

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  cartId: string;
  part_number: string;
  description: string;
  quantity: number;
  unit_price: number;
  equipment: string;         // machine the part is for
  urgencia: 'Normal' | 'Urgente' | 'Crítico';
  notes: string;
  isManual: boolean;         // true = added manually (not from catalog)
  source: string;            // e.g. "Catálogo Komatsu D155AX-6"
}

interface CartStore {
  items: CartItem[];
  addItem: (part: Omit<CartItem, 'cartId'>) => void;
  removeItem: (cartId: string) => void;
  updateItem: (cartId: string, updates: Partial<CartItem>) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set) => ({
      items: [],

      addItem: (part) =>
        set((state) => {
          // If same part_number already in cart (catalog parts), bump qty
          if (!part.isManual) {
            const existing = state.items.find((i) => i.part_number === part.part_number && !i.isManual);
            if (existing) {
              return {
                items: state.items.map((i) =>
                  i.cartId === existing.cartId ? { ...i, quantity: i.quantity + 1 } : i
                ),
              };
            }
          }
          const cartId = `cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          return { items: [...state.items, { ...part, cartId }] };
        }),

      removeItem: (cartId) =>
        set((state) => ({ items: state.items.filter((i) => i.cartId !== cartId) })),

      updateItem: (cartId, updates) =>
        set((state) => ({
          items: state.items.map((i) => (i.cartId === cartId ? { ...i, ...updates } : i)),
        })),

      clearCart: () => set({ items: [] }),
    }),
    { name: 'hermes-cart-v1' }
  )
);
```

---

## `src/lib/sheets-api.ts`

```typescript
const HERMES_API = '/hermes-api';

export async function appendRow(tab: string, values: string[]): Promise<void> {
  const response = await fetch(`${HERMES_API}/api/sheets/append`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tab, values }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sheets API error ${response.status}: ${text}`);
  }
}

export async function readRange(tab: string): Promise<string[][]> {
  const params = new URLSearchParams({ tab });
  const response = await fetch(`${HERMES_API}/api/sheets/read?${params}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sheets API error ${response.status}: ${text}`);
  }
  const data = await response.json();
  return data.data || [];
}

export async function updateCell(
  tab: string,
  searchColumn: number,
  searchValue: string,
  updateColumn: number,
  updateValue: string
): Promise<void> {
  const response = await fetch(`${HERMES_API}/api/sheets/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tab,
      search_column: searchColumn,
      search_value: searchValue,
      update_column: updateColumn,
      update_value: updateValue,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sheets update error ${response.status}: ${text}`);
  }
}

export async function upsertRow(
  tab: string,
  key: string,
  values: string[]
): Promise<'updated' | 'inserted'> {
  const response = await fetch(`${HERMES_API}/api/sheets/upsert-row`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tab, key, values }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sheets upsert error ${response.status}: ${text}`);
  }
  const data = await response.json();
  return data.action;
}

// ── OCR ──────────────────────────────────────────────────────────────────────

export interface OcrLineItem {
  part_number: string;
  description: string;
  qty: number;
  unit_price: number;
  subtotal: number;
}

export interface OcrReceiptResult {
  proveedor: string;
  rfc_proveedor: string;
  folio_factura: string;
  fecha: string;
  subtotal: number;
  iva: number;
  total: number;
  /** Refaccion | Combustible | Servicio | Otro */
  tipo: string;
  line_items: OcrLineItem[];
}

/** Compress an image file to ≤ 800 KB using canvas, then base64-encode it. */
async function compressToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxW = 1200;
        const scale = img.width > maxW ? maxW / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas unavailable')); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve(dataUrl.split(',')[1]); // strip "data:image/jpeg;base64,"
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Send a receipt image to the VPS OCR endpoint.
 * VPS must expose: POST /api/ocr/receipt  { image_base64: string }
 * Returns structured receipt data.
 */
export async function ocrReceipt(file: File): Promise<OcrReceiptResult> {
  const image_base64 = await compressToBase64(file);
  const response = await fetch(`${HERMES_API}/api/ocr/receipt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_base64 }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OCR error ${response.status}: ${text}`);
  }
  return response.json() as Promise<OcrReceiptResult>;
}

// ── Sheet tab names ───────────────────────────────────────────────────────────

export const SHEET_TABS = {
  FLOTA: '01 Inventario',
  INSPECCIONES: '14 Inspecciones',
  AVERIAS: 'Averías',
  ORDENES_TRABAJO: 'ORDENES_TRABAJO',
  OT_STATUS_LOG: 'OT_STATUS_LOG',
  COMBUSTIBLE: 'Combustible',
  VIAJES: 'Reporte_Viajes_Peña',
  HOROMETROS: '04B Registro Horómetros',
  HISTORIAL_PM: '05 Historial PM',
  ORDENES_MANTENIMIENTO: 'Ordenes Mantenimiento',
  INVENTARIO: '12 Inventario Rep.',
  FLETES: 'Reporte_Fletes_Transporte',
  INCIDENTES: 'Incidentes',
  TURNOS: 'Turnos',
  COTIZACIONES: 'Cotizaciones_Pendientes',
  NEUMATICOS: '13 Neumáticos',
  GASTOS: 'Gastos',
  GASTOS_PRESUPUESTO: 'Gastos_Presupuesto',
  CATALOGO_PRECIOS: 'Catalogo_Precios',
} as const;
```

---

## `src/lib/hermes-api.ts`

```typescript
// Always proxy through /hermes-api — Vite dev server and Vercel both rewrite to VPS
const HERMES_BASE = '/hermes-api';

async function hermesPost<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${HERMES_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Hermes API error ${response.status}: ${text}`);
  }
  return response.json();
}

async function hermesGet<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  const response = await fetch(`${HERMES_BASE}${endpoint}${qs}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Hermes API error ${response.status}: ${text}`);
  }
  return response.json();
}

export interface DiagnoseParams {
  equipo: string;
  sintoma: string;
  foto_base64?: string;
  codigo_falla?: string;
  horometro?: number;
}

export interface DiagnoseResult {
  causas_probables: string[];
  checklist_diagnostico: string[];
  partes_probables: string[];
  prioridad: string;
}

export async function diagnose(params: DiagnoseParams): Promise<DiagnoseResult> {
  return hermesPost('/ai/diagnose', params as unknown as Record<string, unknown>);
}

export interface PhotoAnalysisParams {
  foto_base64: string;
  equipo?: string;
  contexto?: string;
}

export interface PhotoAnalysisResult {
  componente_probable: string;
  tipo_de_dano: string;
  severidad: string;
  recomendacion_inicial: string;
}

export async function photoToFailure(params: PhotoAnalysisParams): Promise<PhotoAnalysisResult> {
  return hermesPost('/ai/photo_to_failure', params as unknown as Record<string, unknown>);
}

export interface ManualLookupParams {
  equipo: string;
  tema: string;
  seccion?: string;
}

export interface ManualLookupResult {
  extracto: string;
  pasos_tecnicos: string[];
  herramientas_requeridas: string[];
  torque_specs?: string;
}

export async function manualLookup(params: ManualLookupParams): Promise<ManualLookupResult> {
  return hermesPost('/ai/manual_lookup', params as unknown as Record<string, unknown>);
}

export interface PartResult {
  part_number: string;
  description: string;
  oem_ref: string;
  compatible_units: string[];
  stock_quantity: number;
  stock_minimum: number;
  location: string;
  unit_price: number;
  alternatives: string[];
}

export async function searchParts(query: string, equipo?: string): Promise<PartResult[]> {
  const params: Record<string, string> = { q: query };
  if (equipo) params.equipo = equipo;
  return hermesGet('/parts', params);
}

export interface DiagramResult {
  found: boolean;
  pdf?: string;
  page?: number;
  section?: string;
  image_url?: string;
  message?: string;
}

export async function findDiagram(equipo: string, search: string): Promise<DiagramResult> {
  return hermesGet('/diagrams/find', { equipo, search });
}

export interface FaultCodePagesResult {
  found: boolean;
  pdf?: string;
  page_start?: number;
  page_end?: number;
  codigo?: string;
  message?: string;
}

export async function getFaultCodePages(equipo: string, codigo_falla: string): Promise<FaultCodePagesResult> {
  return hermesGet('/ai/fault_code_pages', { equipo, codigo_falla });
}
```

---

## `src/lib/offline-queue.ts`

```typescript
import { appendRow } from './sheets-api';

const DB_NAME = 'hermes-offline';
const STORE_NAME = 'pending-submissions';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface PendingSubmission {
  id?: number;
  type: 'dvir' | 'falla' | 'fuel' | 'trip' | 'horometro';
  data: Record<string, unknown>;
  timestamp: string;
}

export async function queueSubmission(submission: Omit<PendingSubmission, 'id'>): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).add(submission);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingSubmissions(): Promise<PendingSubmission[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const request = tx.objectStore(STORE_NAME).getAll();
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function clearSubmission(id: number): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingCount(): Promise<number> {
  const submissions = await getPendingSubmissions();
  return submissions.length;
}

/**
 * Replay all pending submissions against the Sheets API.
 * Each entry must have been queued with data: { tab: string, values: string[] }.
 * Succeeded entries are removed from the queue. Failed entries are left for the next retry.
 * Returns { succeeded, failed } counts.
 */
export async function flushQueue(): Promise<{ succeeded: number; failed: number }> {
  const pending = await getPendingSubmissions();
  if (pending.length === 0) return { succeeded: 0, failed: 0 };

  let succeeded = 0;
  let failed = 0;

  for (const submission of pending) {
    const { tab, values } = submission.data as { tab?: string; values?: string[] };
    if (!tab || !Array.isArray(values)) {
      // Malformed entry — remove it rather than retry forever
      if (submission.id !== undefined) await clearSubmission(submission.id);
      continue;
    }
    try {
      await appendRow(tab, values);
      if (submission.id !== undefined) await clearSubmission(submission.id);
      succeeded++;
    } catch {
      failed++;
    }
  }

  return { succeeded, failed };
}
```

---

## `src/lib/date-utils.ts`

```typescript
/**
 * Date formatting utilities — forces Mexico City timezone for all sheet entries.
 * Prevents UTC/locale mismatch when devices have different timezone settings.
 */

const MEXICO_TZ = 'America/Mexico_City';
const MEXICO_LOCALE = 'es-MX';

/** Returns formatted date string: "05/04/2026" (dd/MM/yyyy) */
export function mexicoDate(date: Date = new Date()): string {
  return date.toLocaleDateString(MEXICO_LOCALE, {
    timeZone: MEXICO_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Returns formatted time string: "07:41:00" (HH:mm:ss) */
export function mexicoTime(date: Date = new Date()): string {
  return date.toLocaleTimeString(MEXICO_LOCALE, {
    timeZone: MEXICO_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/** Returns YYYY-MM-DD for use in <input type="date"> */
export function mexicoDateInput(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MEXICO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value ?? '';
  const m = parts.find((p) => p.type === 'month')?.value ?? '';
  const d = parts.find((p) => p.type === 'day')?.value ?? '';
  return `${y}-${m}-${d}`;
}

/** Returns HH:mm for use in <input type="time"> */
export function mexicoTimeInput(date: Date = new Date()): string {
  return mexicoTime(date).slice(0, 5);
}

/** Returns ISO-style date for IDs: "20260405" */
export function mexicoDateCompact(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MEXICO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value ?? '';
  const m = parts.find((p) => p.type === 'month')?.value ?? '';
  const d = parts.find((p) => p.type === 'day')?.value ?? '';
  return `${y}${m}${d}`;
}

/** Returns compact time for IDs: "0741" */
export function mexicoTimeCompact(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MEXICO_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const h = parts.find((p) => p.type === 'hour')?.value ?? '';
  const min = parts.find((p) => p.type === 'minute')?.value ?? '';
  return `${h}${min}`;
}
```

---

## `src/lib/download-blob.ts`

```typescript
/**
 * Triggers a browser download for the given Blob.
 * Creates a temporary <a> element, clicks it, then cleans up.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a short delay so the browser has time to start the download
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

---

## `src/lib/gastos-pdf.ts`

```typescript
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { GastoCompra, GastoTipo } from '../stores/gastos-store';

// ── Logo loader ───────────────────────────────────────────────────────────────
// Load /logo-transplus.svg once, rasterise to PNG data URL, cache for reuse.

const LOGO_URL = '/logo-transplus.svg';
const LOGO_RENDER_SIZE = 256; // px; oversampled for crisp PDF embedding
let logoPromise: Promise<string | null> | null = null;

function loadLogoDataUrl(): Promise<string | null> {
  if (logoPromise) return logoPromise;
  logoPromise = new Promise<string | null>((resolve) => {
    fetch(LOGO_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`logo fetch ${res.status}`);
        return res.text();
      })
      .then((svgText) => {
        const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = LOGO_RENDER_SIZE;
          canvas.height = LOGO_RENDER_SIZE;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(svgUrl);
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0, LOGO_RENDER_SIZE, LOGO_RENDER_SIZE);
          const dataUrl = canvas.toDataURL('image/png');
          URL.revokeObjectURL(svgUrl);
          resolve(dataUrl);
        };
        img.onerror = () => {
          URL.revokeObjectURL(svgUrl);
          resolve(null);
        };
        img.src = svgUrl;
      })
      .catch(() => resolve(null));
  });
  return logoPromise;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GastoReportData {
  period: { year: number; month: number; label: string };
  generatedAt: string;
  generatedBy: string;
  selectedUnits: string[];
  gastos: GastoCompra[];
  totals: {
    total: number;
    count: number;
    averagePerRecord: number;
  };
  byType: Array<{
    tipo: GastoTipo;
    total: number;
    count: number;
    pct: number;
  }>;
  byUnit: Array<{
    unidad: string;
    total: number;
    count: number;
    gastos: GastoCompra[];
  }>;
}

// ── Colors (must match GastosPage palette) ────────────────────────────────────

const COLORS = {
  navy:        [22, 34, 82] as [number, number, number],
  navyDark:    [30, 58, 138] as [number, number, number],
  amber:       [245, 158, 11] as [number, number, number],
  green:       [5, 150, 105] as [number, number, number],
  textPrimary: [17, 24, 39] as [number, number, number],
  textMuted:   [107, 114, 128] as [number, number, number],
  divider:     [229, 231, 235] as [number, number, number],
  bgSoft:      [249, 250, 251] as [number, number, number],
};

const TYPE_COLORS: Record<string, [number, number, number]> = {
  Combustible: [59, 130, 246],
  Refaccion:   [245, 158, 11],
  Servicio:    [139, 92, 246],
  Otro:        [107, 114, 128],
};

const TYPE_LABELS: Record<string, string> = {
  Combustible: 'Combustible',
  Refaccion:   'Refacciones',
  Servicio:    'Servicio',
  Otro:        'Otros',
};

// ── Formatters ────────────────────────────────────────────────────────────────

const mxn = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });

const mxnCompact = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

// ── Page dimensions (A4 portrait at 72 DPI) ───────────────────────────────────

const PAGE = {
  width:  595.28,
  height: 841.89,
  margin: 40,
};

// ── Main generator ────────────────────────────────────────────────────────────

/**
 * Generates a Gastos PDF report and returns it as a Blob.
 * Async because it loads the logo SVG on first call (then caches it).
 */
export async function generateGastosPDF(data: GastoReportData): Promise<Blob> {
  const logoDataUrl = await loadLogoDataUrl();
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });

  drawHeader(doc, data, logoDataUrl);
  let y = 140;

  y = drawHeroKpi(doc, data, y);
  y = drawTypeBreakdown(doc, data, y + 16);
  y = drawUnitDetails(doc, data, y + 20, logoDataUrl);

  drawFooters(doc);

  return doc.output('blob');
}

// ── Header (drawn on every page via event) ────────────────────────────────────

function drawHeader(doc: jsPDF, data: GastoReportData, logoDataUrl: string | null): void {
  const m = PAGE.margin;

  // Logo — use real image if available, else fallback to text placeholder
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', m, m, 44, 44);
    } catch {
      // fall through to fallback
      doc.setFillColor(...COLORS.navy);
      doc.roundedRect(m, m, 44, 44, 5, 5, 'F');
    }
  } else {
    doc.setFillColor(...COLORS.navy);
    doc.roundedRect(m, m, 44, 44, 5, 5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('GTP', m + 22, m + 27, { align: 'center' });
  }

  // Brand text
  doc.setTextColor(...COLORS.textMuted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Hermes Fleet', m + 54, m + 18);
  doc.setTextColor(...COLORS.textPrimary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('GTP Transportes', m + 54, m + 33);

  // Right-side title block
  const rightX = PAGE.width - m;
  doc.setTextColor(...COLORS.textPrimary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Reporte de Gastos', rightX, m + 15, { align: 'right' });

  doc.setTextColor(...COLORS.textMuted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `Generado ${data.generatedAt} · por ${data.generatedBy}`,
    rightX,
    m + 28,
    { align: 'right' }
  );

  // Period badge (amber)
  doc.setTextColor(...COLORS.amber);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const unitsLabel =
    data.selectedUnits.length === 1
      ? `· ${data.selectedUnits[0]}`
      : `· ${data.selectedUnits.length} unidades`;
  doc.text(
    `${data.period.label.toUpperCase()} ${unitsLabel}`,
    rightX,
    m + 40,
    { align: 'right' }
  );

  // Separator line
  doc.setDrawColor(...COLORS.navy);
  doc.setLineWidth(1.5);
  doc.line(m, m + 55, PAGE.width - m, m + 55);
}

// ── Hero KPI card ─────────────────────────────────────────────────────────────

function drawHeroKpi(doc: jsPDF, data: GastoReportData, y: number): number {
  const m = PAGE.margin;
  const w = PAGE.width - m * 2;
  const h = 70;

  // Gradient-ish: two rectangles to fake a gradient
  doc.setFillColor(...COLORS.navy);
  doc.roundedRect(m, y, w, h, 8, 8, 'F');

  // Left block
  doc.setTextColor(200, 220, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('TOTAL DEL PERÍODO', m + 18, y + 20);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.text(mxn(data.totals.total), m + 18, y + 48);

  doc.setTextColor(180, 200, 230);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `${data.totals.count} registros · ${data.byUnit.length} unidades`,
    m + 18,
    y + 62
  );

  // Right block — average per record
  const rightX = m + w - 18;
  doc.setTextColor(200, 220, 255);
  doc.setFontSize(8);
  doc.text('Promedio / registro', rightX, y + 20, { align: 'right' });

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(mxn(data.totals.averagePerRecord), rightX, y + 42, { align: 'right' });

  return y + h;
}

// ── Type breakdown (4-column grid) ────────────────────────────────────────────

function drawTypeBreakdown(doc: jsPDF, data: GastoReportData, y: number): number {
  const m = PAGE.margin;
  const w = PAGE.width - m * 2;

  // Section header
  drawSectionHeader(doc, 'GASTO POR TIPO', y);
  y += 14;

  const cellW = (w - 9) / 4; // 3 gaps of 3pt
  const cellH = 52;

  const types = ['Combustible', 'Refaccion', 'Servicio', 'Otro'] as const;

  for (let i = 0; i < types.length; i++) {
    const tipo = types[i];
    const entry = data.byType.find((t) => t.tipo === tipo);
    const total = entry?.total ?? 0;
    const count = entry?.count ?? 0;
    const pct   = entry?.pct   ?? 0;
    const color = TYPE_COLORS[tipo];

    const x = m + i * (cellW + 3);

    // Background
    doc.setFillColor(...COLORS.bgSoft);
    doc.roundedRect(x, y, cellW, cellH, 4, 4, 'F');

    // Left color border
    doc.setFillColor(...color);
    doc.rect(x, y, 3, cellH, 'F');

    // Label
    doc.setTextColor(...COLORS.textMuted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(TYPE_LABELS[tipo].toUpperCase(), x + 10, y + 14);

    // Amount
    doc.setTextColor(...COLORS.textPrimary);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(mxnCompact(total), x + 10, y + 32);

    // Count + pct
    doc.setTextColor(...COLORS.textMuted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`${pct.toFixed(1)}% · ${count} reg`, x + 10, y + 44);
  }

  return y + cellH;
}

// ── Unit detail tables ────────────────────────────────────────────────────────

function drawUnitDetails(
  doc: jsPDF,
  data: GastoReportData,
  y: number,
  logoDataUrl: string | null,
): number {
  const m = PAGE.margin;
  const w = PAGE.width - m * 2;

  drawSectionHeader(doc, 'DETALLE POR UNIDAD', y);
  y += 20;

  // Sort units by total desc
  const sortedUnits = [...data.byUnit].sort((a, b) => b.total - a.total);

  for (const unit of sortedUnits) {
    // Page break check — need at least 80pt for the header + 1 row
    if (y > PAGE.height - 120) {
      doc.addPage();
      drawHeader(doc, data, logoDataUrl);
      y = 140;
    }

    // Unit header strip
    const stripH = 26;
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(m, y, w, stripH, 4, 4, 'F');
    doc.setFillColor(29, 78, 216);
    doc.rect(m, y, 4, stripH, 'F');

    doc.setTextColor(30, 58, 138);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(unit.unidad, m + 12, y + 12);

    doc.setTextColor(...COLORS.textMuted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(
      `${unit.count} ${unit.count === 1 ? 'gasto' : 'gastos'}`,
      m + 12,
      y + 22
    );

    doc.setTextColor(...COLORS.green);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(mxn(unit.total), m + w - 10, y + 17, { align: 'right' });

    y += stripH + 4;

    // Detail table
    const rows = unit.gastos
      .slice()
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((g) => [
        g.fecha,
        g.proveedor || '—',
        TYPE_LABELS[g.tipo] || g.tipo,
        g.folio_factura || '—',
        mxn(g.total),
      ]);

    autoTable(doc, {
      startY: y,
      head: [['Fecha', 'Proveedor', 'Tipo', 'Folio', 'Total']],
      body: rows,
      margin: { left: m, right: m },
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 5,
        textColor: COLORS.textPrimary,
        lineColor: COLORS.divider,
        lineWidth: 0.3,
      },
      headStyles: {
        fillColor: [243, 244, 246],
        textColor: [55, 65, 81],
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250],
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 70 },
        3: { cellWidth: 60 },
        4: { cellWidth: 70, halign: 'right', fontStyle: 'bold' },
      },
      didDrawPage: () => {
        // Re-draw the report header on each new page autotable creates
        drawHeader(doc, data, logoDataUrl);
      },
    });

    // @ts-expect-error — jspdf-autotable augments the jsPDF instance at runtime
    y = doc.lastAutoTable.finalY + 14;
  }

  return y;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function drawSectionHeader(doc: jsPDF, label: string, y: number): void {
  const m = PAGE.margin;
  doc.setTextColor(...COLORS.navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(label, m, y);
  doc.setDrawColor(...COLORS.divider);
  doc.setLineWidth(0.5);
  doc.line(m, y + 4, PAGE.width - m, y + 4);
}

function drawFooters(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const y = PAGE.height - 25;
    doc.setDrawColor(...COLORS.divider);
    doc.setLineWidth(0.5);
    doc.line(PAGE.margin, y - 8, PAGE.width - PAGE.margin, y - 8);

    doc.setTextColor(...COLORS.textMuted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Hermes Fleet · Reporte automático', PAGE.margin, y);
    doc.text(`Página ${i} de ${pageCount}`, PAGE.width - PAGE.margin, y, { align: 'right' });
  }
}
```

---

## `src/lib/priority-calculator.ts`

```typescript
import type { OTPriority } from '../types/workorder';

interface FallaFields {
  puede_moverse: boolean;
  cliente_afectado: string;
  tipo_falla: string;
}

export function calculatePriority(fields: FallaFields): OTPriority {
  if (!fields.puede_moverse && fields.cliente_afectado.trim().length > 0) return 'CRITICA';
  if (!fields.puede_moverse) return 'ALTA';
  if (fields.tipo_falla && fields.tipo_falla !== '') return 'MEDIA';
  return 'BAJA';
}
```

---

## `src/lib/ot-generator.ts`

```typescript
import { mexicoDateCompact, mexicoTimeCompact } from './date-utils';

export function generateOTId(): string {
  const now = new Date();
  return `OT-${mexicoDateCompact(now)}-${mexicoTimeCompact(now)}`;
}
```

---

## `src/hooks/useEquipmentList.ts`

```typescript
import { EQUIPMENT_CATALOG } from '../data/equipment-catalog';
import type { Equipment } from '../types/equipment';

/**
 * Returns the hardcoded fleet catalog instantly.
 * Format: Unit ID + Brand + Model — consistent everywhere, no sheet dependency.
 */
export function useEquipmentList(): Equipment[] {
  return EQUIPMENT_CATALOG;
}

/**
 * Look up a single unit by ID from the hardcoded catalog.
 */
export function useEquipmentById(unit_id: string): Equipment | undefined {
  return EQUIPMENT_CATALOG.find((e) => e.unit_id === unit_id);
}
```

---

## `src/hooks/useDashboardData.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { readRange, SHEET_TABS } from '../lib/sheets-api';
import { useEquipmentList } from './useEquipmentList';
import { mexicoDate } from '../lib/date-utils';

export interface DashboardData {
  availability: number;
  criticalOTs: number;
  avgConsumption: string;
  alertsToday: number;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

async function fetchCriticalOTs(): Promise<number> {
  const rows = await readRange(SHEET_TABS.ORDENES_TRABAJO);
  let count = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const priority = (row[7] ?? '').toLowerCase();
    const status = (row[9] ?? '').toLowerCase();
    if (
      priority === 'critica' &&
      status !== 'completado'
    ) {
      count++;
    }
  }
  return count;
}

async function fetchAvgConsumption(): Promise<string> {
  const rows = await readRange(SHEET_TABS.COMBUSTIBLE);
  let total = 0;
  let count = 0;
  for (let i = 2; i < rows.length; i++) {
    const raw = rows[i][6] ?? '';
    const litros = parseFloat(raw.replace(',', '.'));
    if (!isNaN(litros) && litros > 0) {
      total += litros;
      count++;
    }
  }
  if (count === 0) return '--';
  return `${(total / count).toFixed(2)} L/avg`;
}

async function fetchAlertsToday(): Promise<number> {
  const rows = await readRange(SHEET_TABS.AVERIAS);
  const today = mexicoDate();
  let count = 0;
  for (let i = 1; i < rows.length; i++) {
    const dateCell = (rows[i][0] ?? '').trim();
    if (dateCell === today) {
      count++;
    }
  }
  return count;
}

export function useDashboardData(): DashboardData {
  const [criticalOTs, setCriticalOTs] = useState(0);
  const [avgConsumption, setAvgConsumption] = useState('--');
  const [alertsToday, setAlertsToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const equipmentList = useEquipmentList();
  const available = equipmentList.filter(
    (e) => e.status === 'operativo' || e.status === 'alerta'
  ).length;
  const availability = equipmentList.length > 0
    ? Math.round((available / equipmentList.length) * 100)
    : 0;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const results = await Promise.allSettled([
      fetchCriticalOTs(),
      fetchAvgConsumption(),
      fetchAlertsToday(),
    ]);

    const [otsResult, consumptionResult, alertsResult] = results;

    if (otsResult.status === 'fulfilled') {
      setCriticalOTs(otsResult.value);
    } else {
      setCriticalOTs(0);
    }

    if (consumptionResult.status === 'fulfilled') {
      setAvgConsumption(consumptionResult.value);
    } else {
      setAvgConsumption('--');
    }

    if (alertsResult.status === 'fulfilled') {
      setAlertsToday(alertsResult.value);
    } else {
      setAlertsToday(0);
    }

    const anyFailed = results.some((r) => r.status === 'rejected');
    if (anyFailed) {
      setError('Algunos datos no pudieron cargarse');
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    availability,
    criticalOTs,
    avgConsumption,
    alertsToday,
    loading,
    error,
    refresh: fetchAll,
  };
}
```

---

## `src/hooks/useOnlineStatus.ts`

```typescript
import { useState, useEffect } from 'react';

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
```

---

## `src/components/MonthSelector.tsx`

```typescript
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MonthSelectorProps {
  /** Currently displayed year (e.g. 2026) */
  year: number;
  /** Currently displayed month (1-12) */
  month: number;
  /** Called when the user navigates to a different month */
  onChange: (year: number, month: number) => void;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/**
 * Month navigator: ◀ Abril 2026 ▶
 * Cannot navigate into the future (max = current month).
 */
export default function MonthSelector({ year, month, onChange }: MonthSelectorProps) {
  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth() + 1;
  const isAtCurrent = year === nowYear && month === nowMonth;

  function goPrev() {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear  = month === 1 ? year - 1 : year;
    onChange(prevYear, prevMonth);
  }

  function goNext() {
    if (isAtCurrent) return;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear  = month === 12 ? year + 1 : year;
    onChange(nextYear, nextMonth);
  }

  const label = `${MONTH_NAMES[month - 1]} ${year}`;

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={goPrev}
        className="p-1.5 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
        aria-label="Mes anterior"
      >
        <ChevronLeft size={18} className="text-text-secondary" />
      </button>
      <span className="text-sm font-medium text-text-secondary min-w-[110px] text-center capitalize">
        {label}
      </span>
      <button
        type="button"
        onClick={goNext}
        disabled={isAtCurrent}
        className="p-1.5 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
        aria-label="Mes siguiente"
      >
        <ChevronRight size={18} className="text-text-secondary" />
      </button>
    </div>
  );
}
```

---

## `src/components/auth/RequireRole.tsx`

```typescript
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';
import { ROLE_HOME } from '../../types/roles';
import type { AppRole } from '../../types/roles';

interface RequireRoleProps {
  /** Roles allowed to view this route. Empty array = any authenticated user. */
  roles: AppRole[];
  children: React.ReactNode;
}

/**
 * Route guard. Redirect to /login if not authenticated.
 * Redirect to role home if authenticated but not in the allowed roles list.
 */
export default function RequireRole({ roles, children }: RequireRoleProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.role);

  if (!isAuthenticated || !role) {
    return <Navigate to="/login" replace />;
  }

  if (roles.length > 0 && !roles.includes(role)) {
    return <Navigate to={ROLE_HOME[role]} replace />;
  }

  return <>{children}</>;
}
```

---

## `src/components/layout/AppShell.tsx`

```typescript
import { Outlet } from 'react-router-dom';
import Header from './Header';
import BottomNav from './BottomNav';

export default function AppShell() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main
        className="flex-1 overflow-y-auto px-4"
        style={{
          paddingTop: 80,
          paddingBottom: 80,
          backgroundColor: '#F1F5F9',
        }}
      >
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
```

---

## `src/components/layout/Header.tsx`

```typescript
import { useNavigate } from 'react-router-dom';
import { Bell, LogOut, ShoppingCart } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { useCartStore } from '../../stores/cart-store';
import { ROLE_LABELS } from '../../types/roles';

export default function Header() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);
  const role = useAuthStore((s) => s.role);
  const logout = useAuthStore((s) => s.logout);
  const cartCount = useCartStore((s) => s.items.length);

  const canSeeCart = role === 'jefe_taller' || role === 'gerencia';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4"
      style={{ height: 64, backgroundColor: '#162252' }}
    >
      {/* Left: avatar + user info */}
      <div className="flex items-center gap-3">
        <img
          src="/logo-transplus.svg"
          alt="Trans Plus"
          className="shrink-0 rounded"
          style={{ width: 36, height: 36 }}
        />
        <div className="flex flex-col leading-tight">
          <span className="text-white font-semibold text-sm">{userName}</span>
          {role && (
            <span className="text-white/60 text-xs">{ROLE_LABELS[role]}</span>
          )}
        </div>
      </div>

      {/* Right: cart (JT only) + bell + logout */}
      <div className="flex items-center gap-4">
        {canSeeCart && (
          <button
            onClick={() => navigate('/pedidos')}
            className="relative text-white/80 hover:text-white transition-colors"
            aria-label="Pedidos"
          >
            <ShoppingCart size={22} />
            {cartCount > 0 && (
              <span
                className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-white font-bold"
                style={{ width: 16, height: 16, fontSize: 9, backgroundColor: '#F59E0B' }}
              >
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </button>
        )}

        <button
          onClick={() => navigate('/alerts')}
          className="relative text-white/80 hover:text-white transition-colors"
          aria-label="Alertas"
        >
          <Bell size={22} />
          <span
            className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-white"
            style={{ width: 16, height: 16, fontSize: 9, backgroundColor: '#DC2626' }}
          >
            2
          </span>
        </button>

        <button
          onClick={handleLogout}
          className="text-white/80 hover:text-white transition-colors"
          aria-label="Cerrar sesión"
        >
          <LogOut size={22} />
        </button>
      </div>
    </header>
  );
}
```

---

## `src/components/layout/BottomNav.tsx`

```typescript
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import type { NavItem } from '../../types/roles';
import { NAV_CONFIG } from '../../types/roles';
import MoreTray from './MoreTray';

function LucideIcon({ name, ...props }: { name: string } & Icons.LucideProps) {
  const Icon = (Icons as unknown as Record<string, Icons.LucideIcon | undefined>)[name];
  return Icon ? <Icon {...props} /> : null;
}

export default function BottomNav() {
  const [showMoreTray, setShowMoreTray] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const role = useAuthStore((s) => s.role);

  if (!role) return null;

  const { visible, overflow } = NAV_CONFIG[role];

  const isActive = (item: NavItem) => {
    if (!item.path) return false;
    return location.pathname.startsWith(item.path);
  };

  const handleItemClick = (item: NavItem) => {
    if (item.id === 'mas') {
      setShowMoreTray(true);
    } else {
      navigate(item.path);
    }
  };

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-2 pb-safe"
        style={{ height: 64, backgroundColor: '#162252' }}
      >
        {visible.map((item) => {
          const active = isActive(item);
          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              className="flex flex-col items-center gap-1 flex-1 py-2"
              aria-label={item.label}
            >
              <LucideIcon
                name={item.icon}
                size={22}
                color={active ? '#2563EB' : 'rgba(255,255,255,0.6)'}
              />
              <span
                className="text-xs leading-none"
                style={{ color: active ? '#2563EB' : 'rgba(255,255,255,0.6)' }}
              >
                {item.label}
              </span>
              {active && (
                <span
                  className="w-1 h-1 rounded-full"
                  style={{ backgroundColor: '#2563EB' }}
                />
              )}
            </button>
          );
        })}
      </nav>

      <MoreTray
        open={showMoreTray}
        onClose={() => setShowMoreTray(false)}
        items={overflow}
      />
    </>
  );
}
```

---

## `src/pages/LoginPage.tsx`

```typescript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  Wrench,
  Eye,
  Settings,
  BarChart3,
  ArrowLeft,
  Delete,
} from 'lucide-react';
import type { AppRole } from '../types/roles';
import { ROLE_HOME, ROLE_LABELS } from '../types/roles';
import { useAuthStore } from '../stores/auth-store';

interface RoleCard {
  role: AppRole;
  label: string;
  icon: React.ReactNode;
}

const ROLE_CARDS: RoleCard[] = [
  { role: 'operador', label: 'Operador', icon: <Truck size={28} className="text-white/80" /> },
  { role: 'mecanico', label: 'Mecánico', icon: <Wrench size={28} className="text-white/80" /> },
  { role: 'supervisor', label: 'Supervisor', icon: <Eye size={28} className="text-white/80" /> },
  { role: 'coordinador', label: 'Coordinador Mtto.', icon: <Settings size={28} className="text-white/80" /> },
  { role: 'jefe_taller', label: 'Jefe de Taller', icon: <Wrench size={28} className="text-white/80" /> },
  { role: 'gerencia', label: 'Gerencia', icon: <BarChart3 size={28} className="text-white/80" /> },
];

const PIN_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

export default function LoginPage() {
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  useEffect(() => {
    if (!selectedRole) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handleKeyPress(e.key);
      else if (e.key === 'Backspace') handleKeyPress('del');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedRole, pin]);

  const handleRoleSelect = (role: AppRole) => {
    setSelectedRole(role);
    setPin('');
  };

  const handleBack = () => {
    setSelectedRole(null);
    setPin('');
  };

  const handleKeyPress = (key: string) => {
    if (key === 'del') {
      setPin((prev) => prev.slice(0, -1));
      return;
    }
    if (key === '') return;
    if (pin.length >= 4) return;

    const newPin = pin + key;
    setPin(newPin);

    if (newPin.length === 4 && selectedRole) {
      const success = login(selectedRole, newPin);
      if (success) {
        navigate(ROLE_HOME[selectedRole]);
      } else {
        setPinError(true);
        setTimeout(() => {
          setPin('');
          setPinError(false);
        }, 800);
      }
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between py-10 px-4"
      style={{ background: '#FFFFFF' }}
    >
      {selectedRole === null ? (
        /* Phase 1 - Role Selection */
        <div className="flex flex-col items-center w-full max-w-sm gap-6">
          {/* Logo */}
          <div className="flex flex-col items-center gap-3 mb-2">
            <img
              src="/logo-transplus.svg"
              alt="Trans Plus"
              className="w-24 h-24"
            />
            <span className="font-bold text-2xl tracking-widest" style={{ color: '#162252' }}>HERMES</span>
            <span className="text-sm" style={{ color: '#6B7280' }}>Grupo Trans Plus • Operaciones</span>
          </div>

          <p className="text-base text-center" style={{ color: '#162252' }}>
            Selecciona tu rol para ingresar
          </p>

          {/* Role cards grid */}
          <div className="grid grid-cols-2 gap-3 w-full">
            {ROLE_CARDS.map(({ role, label, icon }) => (
              <button
                key={role}
                onClick={() => handleRoleSelect(role)}
                className="flex flex-col items-center gap-2 rounded-xl py-5 px-3 transition-opacity active:opacity-70"
                style={{ backgroundColor: '#1E3A8A' }}
              >
                {icon}
                <span className="text-white text-sm font-medium text-center leading-tight">
                  {label}
                </span>
              </button>
            ))}
          </div>

          <p className="text-xs mt-4" style={{ color: '#9CA3AF' }}>v1.0.0 MVP • GTP Hermes Fleet</p>
        </div>
      ) : (
        /* Phase 2 - PIN Entry */
        <div className="flex flex-col items-center w-full max-w-xs gap-6">
          {/* Header with back arrow */}
          <div className="flex items-center w-full gap-3">
            <button
              onClick={handleBack}
              className="transition-colors"
              style={{ color: '#162252' }}
            >
              <ArrowLeft size={22} />
            </button>
            <span className="font-semibold text-lg" style={{ color: '#162252' }}>
              {ROLE_LABELS[selectedRole]}
            </span>
          </div>

          {/* PIN dots */}
          <div className={`flex gap-4 my-4 ${pinError ? 'animate-[shake_0.3s_ease]' : ''}`}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-4 h-4 rounded-full transition-colors duration-150"
                style={{
                  backgroundColor: pinError ? '#DC2626' : i < pin.length ? '#2563EB' : '#D1D5DB',
                }}
              />
            ))}
          </div>
          {pinError && (
            <p className="text-sm font-medium" style={{ color: '#DC2626' }}>PIN incorrecto</p>
          )}

          {/* Numeric keypad */}
          <div className="grid grid-cols-3 gap-3 w-full">
            {PIN_KEYS.map((key, idx) => (
              <button
                key={idx}
                onClick={() => handleKeyPress(key)}
                disabled={key === ''}
                className={[
                  'flex items-center justify-center rounded-xl transition-opacity active:opacity-60',
                  key === '' ? 'invisible' : '',
                ].join(' ')}
                style={{
                  minHeight: 64,
                  backgroundColor: key === '' ? 'transparent' : '#162252',
                }}
              >
                {key === 'del' ? (
                  <Delete size={22} className="text-white" />
                ) : (
                  <span className="text-white text-xl font-semibold">{key}</span>
                )}
              </button>
            ))}
          </div>

          <p className="text-xs mt-4" style={{ color: '#9CA3AF' }}>v1.0.0 MVP • GTP Hermes Fleet</p>
        </div>
      )}
    </div>
  );
}
```

---

## `src/pages/DashboardPage.tsx`

```typescript
import ExecutiveDashboard from '../components/dashboard/ExecutiveDashboard';

export default function DashboardPage() {
  return <ExecutiveDashboard />;
}
```

---

## `src/pages/GastosPage.tsx`

```typescript
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  RefreshCw,
  Receipt,
  TrendingUp,
  Wrench,
  Fuel,
  Package,
  Trash2,
  Download,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { useGastosStore } from '../stores/gastos-store';
import type { GastoCompra, GastoTipo } from '../stores/gastos-store';
import MonthSelector from '../components/MonthSelector';
import { generateGastosPDF, type GastoReportData } from '../lib/gastos-pdf';
import { downloadBlob } from '../lib/download-blob';
import { mexicoDate, mexicoTime } from '../lib/date-utils';

// ── Colour palette ────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  Refaccion:   '#F59E0B',
  Combustible: '#3B82F6',
  Servicio:    '#8B5CF6',
  Otro:        '#6B7280',
};

const TYPE_ICONS_SM: Record<string, React.ReactNode> = {
  Refaccion:   <Wrench  size={14} />,
  Combustible: <Fuel    size={14} />,
  Servicio:    <Package size={14} />,
  Otro:        <Receipt size={14} />,
};

const TYPE_ICONS_LG: Record<string, React.ReactNode> = {
  Refaccion:   <Wrench  size={20} />,
  Combustible: <Fuel    size={20} />,
  Servicio:    <Package size={20} />,
  Otro:        <Receipt size={20} />,
};

const TYPE_ORDER = ['Combustible', 'Refaccion', 'Servicio', 'Otro'] as const;

// ── Heatmap colour scale (blue, darkest = highest spend) ─────────────────────

function heatColor(value: number, max: number): { bg: string; text: string } {
  if (max === 0 || value === 0) return { bg: '#F1F5F9', text: '#94A3B8' };
  const r = value / max;
  if (r > 0.70) return { bg: '#1D4ED8', text: '#ffffff' };
  if (r > 0.40) return { bg: '#2563EB', text: '#ffffff' };
  if (r > 0.20) return { bg: '#3B82F6', text: '#ffffff' };
  if (r > 0.08) return { bg: '#93C5FD', text: '#1E3A8A' };
  return          { bg: '#DBEAFE', text: '#1E3A8A' };
}

// ── Helper: current month label ───────────────────────────────────────────────

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

// ── Filter gastos to a specific year/month ──────────────────────────────────
// fecha is stored as "dd/MM/yyyy" — compare month and year parts directly

function filterByMonth(gastos: GastoCompra[], year: number, month: number): GastoCompra[] {
  return gastos.filter((g) => {
    if (g.status === 'Eliminado') return false;
    const parts = g.fecha.split('/');
    if (parts.length !== 3) return false;
    return parseInt(parts[1]) === month && parseInt(parts[2]) === year;
  });
}

// ── Summary helpers ───────────────────────────────────────────────────────────

function byUnit(gastos: GastoCompra[]) {
  const map: Record<string, number> = {};
  for (const g of gastos) {
    map[g.unidad] = (map[g.unidad] || 0) + g.total;
  }
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);
}

function byType(gastos: GastoCompra[]) {
  const map: Record<string, { total: number; count: number }> = {};
  for (const g of gastos) {
    if (!map[g.tipo]) map[g.tipo] = { total: 0, count: 0 };
    map[g.tipo].total += g.total;
    map[g.tipo].count += 1;
  }
  return map;
}

// ── Currency formatter ────────────────────────────────────────────────────────

const mxn = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

// ── Report data builder (for PDF export) ─────────────────────────────────────

interface BuildReportArgs {
  gastos: GastoCompra[];
  selectedUnits: Set<string>;
  year: number;
  month: number;
  userName: string;
}

function buildReportData(args: BuildReportArgs): GastoReportData {
  const { gastos, selectedUnits, year, month, userName } = args;

  // Filter to only the selected units
  const filtered = gastos.filter((g) => selectedUnits.has(g.unidad));
  const total = filtered.reduce((s, g) => s + g.total, 0);
  const count = filtered.length;

  // Per-type aggregation
  const typeOrder: GastoTipo[] = ['Combustible', 'Refaccion', 'Servicio', 'Otro'];
  const byTypeData = typeOrder.map((tipo) => {
    const items = filtered.filter((g) => g.tipo === tipo);
    const typeTotal = items.reduce((s, g) => s + g.total, 0);
    return {
      tipo,
      total: typeTotal,
      count: items.length,
      pct: total > 0 ? (typeTotal / total) * 100 : 0,
    };
  });

  // Per-unit aggregation (only units present in the filtered set)
  const unitMap = new Map<string, GastoCompra[]>();
  for (const g of filtered) {
    const list = unitMap.get(g.unidad) ?? [];
    list.push(g);
    unitMap.set(g.unidad, list);
  }
  const byUnitData = Array.from(unitMap.entries()).map(([unidad, items]) => ({
    unidad,
    total: items.reduce((s, g) => s + g.total, 0),
    count: items.length,
    gastos: items,
  }));

  return {
    period: { year, month, label: monthLabel(year, month) },
    generatedAt: `${mexicoDate()} ${mexicoTime()}`,
    generatedBy: userName || 'Usuario',
    selectedUnits: Array.from(selectedUnits).sort(),
    gastos: filtered,
    totals: {
      total,
      count,
      averagePerRecord: count > 0 ? total / count : 0,
    },
    byType: byTypeData,
    byUnit: byUnitData,
  };
}

function buildFilename(year: number, month: number, selectedUnits: string[]): string {
  const mes = MONTH_NAMES[month - 1];
  if (selectedUnits.length === 1) {
    return `Gastos-${mes}-${year}-${selectedUnits[0]}.pdf`;
  }
  return `Gastos-${mes}-${year}.pdf`;
}

// ── Component ─────────────────────────────────────────────────────────────────

type Tab = 'resumen' | 'detalle';

interface ToastState {
  kind: 'success' | 'error';
  message: string;
}

export default function GastosPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.role);
  const userName = useAuthStore((s) => s.userName);
  const { gastos, loading, fetchGastos, deleteGasto } = useGastosStore();

  const [tab, setTab] = useState<Tab>('resumen');

  // ── Month selector state (defaults to current month) ─────────────────────
  const now = new Date();
  const [selectedYear, setSelectedYear]   = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);

  // ── Unit selection state (for PDF export) ────────────────────────────────
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());

  // ── PDF download state ───────────────────────────────────────────────────
  const [generating, setGenerating] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const canCreate = role === 'gerencia' || role === 'supervisor' ||
                    role === 'jefe_taller' || role === 'coordinador';

  useEffect(() => {
    fetchGastos();
  }, []);

  const monthly   = useMemo(
    () => filterByMonth(gastos, selectedYear, selectedMonth),
    [gastos, selectedYear, selectedMonth]
  );
  const totalMes  = monthly.reduce((s, g) => s + g.total, 0);
  const unitData  = byUnit(monthly);
  const typeMap   = byType(monthly);
  const unitMax   = unitData[0]?.value ?? 0;

  // When the month or data changes, reset selected units to ALL visible
  useEffect(() => {
    setSelectedUnits(new Set(unitData.map((u) => u.name)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth, unitData.length]);

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function toggleUnit(unitId: string): void {
    setSelectedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  }

  function selectAllUnits(): void {
    setSelectedUnits(new Set(unitData.map((u) => u.name)));
  }

  function selectNoUnits(): void {
    setSelectedUnits(new Set());
  }

  async function handleDownloadPDF(): Promise<void> {
    if (selectedUnits.size === 0 || monthly.length === 0) return;
    setGenerating(true);
    try {
      const reportData = buildReportData({
        gastos: monthly,
        selectedUnits,
        year: selectedYear,
        month: selectedMonth,
        userName,
      });
      const blob = await generateGastosPDF(reportData);
      const filename = buildFilename(selectedYear, selectedMonth, reportData.selectedUnits);
      downloadBlob(blob, filename);
      setToast({ kind: 'success', message: `PDF descargado: ${filename}` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setToast({ kind: 'error', message: `No se pudo generar el PDF: ${msg}` });
    } finally {
      setGenerating(false);
    }
  }

  const canDownload = canCreate && monthly.length > 0 && selectedUnits.size > 0 && !generating;

  return (
    <div className="flex flex-col py-4 gap-4 animate-fade-up">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${
            toast.kind === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.kind === 'success' ? (
            <CheckCircle size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Gastos</h1>
          <MonthSelector
            year={selectedYear}
            month={selectedMonth}
            onChange={(y, m) => {
              setSelectedYear(y);
              setSelectedMonth(m);
            }}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              useGastosStore.setState({ fetched: false });
              fetchGastos();
            }}
            className="p-2 rounded-full"
            style={{ color: '#162252' }}
            aria-label="Actualizar"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          {canCreate && (
            <button
              onClick={() => navigate('/gastos/nuevo')}
              className="flex items-center gap-1.5 bg-amber text-white text-sm font-medium rounded-lg px-3 py-2"
            >
              <Plus size={16} /> Nuevo
            </button>
          )}
        </div>
      </div>

      {/* Download PDF CTA */}
      {canCreate && monthly.length > 0 && (
        <button
          type="button"
          onClick={handleDownloadPDF}
          disabled={!canDownload}
          className="w-full flex items-center justify-center gap-2 bg-navy text-white text-sm font-semibold rounded-xl py-3 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          style={{ backgroundColor: '#162252' }}
        >
          {generating ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Generando PDF…
            </>
          ) : (
            <>
              <Download size={18} />
              Descargar PDF ({selectedUnits.size} {selectedUnits.size === 1 ? 'unidad' : 'unidades'})
            </>
          )}
        </button>
      )}

      {/* Total KPI */}
      <div className="bg-white rounded-xl border border-border p-4 shadow-sm flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-amber/10 flex items-center justify-center">
          <TrendingUp size={22} className="text-amber" />
        </div>
        <div>
          <p className="text-2xl font-bold text-text">
            {loading ? '…' : mxn(totalMes)}
          </p>
          <p className="text-sm text-text-secondary">Total del mes · {monthly.length} registros</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['resumen', 'detalle'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              tab === t
                ? 'bg-amber text-white'
                : 'bg-white border border-border text-text-secondary'
            }`}
          >
            {t === 'resumen' ? 'Resumen' : 'Detalle'}
          </button>
        ))}
      </div>

      {/* ── RESUMEN tab ──────────────────────────────────────────────────── */}
      {tab === 'resumen' && (
        <>
          {/* Type cards 2×2 */}
          {monthly.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {TYPE_ORDER.map((tipo) => {
                const val   = typeMap[tipo]?.total ?? 0;
                const count = typeMap[tipo]?.count ?? 0;
                const pct   = totalMes > 0 ? Math.round((val / totalMes) * 100) : 0;
                const color = TYPE_COLORS[tipo];
                return (
                  <div key={tipo} className="bg-white rounded-xl border border-border p-3 shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: `${color}18`, color }}
                      >
                        {TYPE_ICONS_LG[tipo]}
                      </div>
                      <span className="text-sm font-bold" style={{ color }}>
                        {pct}%
                      </span>
                    </div>
                    <p className="text-base font-bold text-text leading-tight">{mxn(val)}</p>
                    <p className="text-xs text-text-secondary mt-0.5">{tipo} · {count} reg.</p>
                    <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-1 rounded-full transition-all"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Heat map by unit — tap to select/deselect for PDF export */}
          {unitData.length > 0 && (
            <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-text">Mapa de calor por Unidad</p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={selectAllUnits}
                    className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber/10 text-amber hover:bg-amber/20 transition-colors"
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    onClick={selectNoUnits}
                    className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-text-secondary hover:bg-gray-200 transition-colors"
                  >
                    Ninguna
                  </button>
                </div>
              </div>
              <p className="text-xs text-text-secondary mb-2">
                Toca una unidad para incluirla o excluirla del reporte PDF
              </p>
              <div className="grid grid-cols-3 gap-2">
                {unitData.map((u) => {
                  const { bg, text } = heatColor(u.value, unitMax);
                  const isSelected = selectedUnits.has(u.name);
                  return (
                    <button
                      key={u.name}
                      type="button"
                      onClick={() => toggleUnit(u.name)}
                      className={`rounded-xl py-3 px-2 flex flex-col items-center gap-1 transition-all ${
                        isSelected
                          ? 'ring-2 ring-amber ring-offset-1'
                          : 'opacity-50 grayscale'
                      }`}
                      style={{ background: bg }}
                      aria-pressed={isSelected}
                    >
                      <span className="text-xs font-bold" style={{ color: text }}>
                        {u.name}
                      </span>
                      <span className="text-xs" style={{ color: text, opacity: 0.8 }}>
                        {mxn(u.value)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && monthly.length === 0 && (
            <div className="bg-white rounded-xl border border-border p-8 text-center">
              <Receipt size={32} className="text-text-secondary mx-auto mb-2" />
              <p className="text-sm text-text-secondary">Sin gastos este mes</p>
              {canCreate && (
                <button
                  onClick={() => navigate('/gastos/nuevo')}
                  className="mt-3 text-sm text-amber font-medium"
                >
                  Registrar primer gasto
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* ── DETALLE tab ──────────────────────────────────────────────────── */}
      {tab === 'detalle' && (
        <div className="flex flex-col gap-2">
          {loading && (
            <div className="text-center py-10 text-sm text-text-secondary">Cargando…</div>
          )}
          {!loading && gastos.length === 0 && (
            <div className="text-center py-10 text-sm text-text-secondary">Sin gastos registrados</div>
          )}
          {gastos.filter((g) => g.status !== 'Eliminado').slice().reverse().map((g) => (
            <GastoRow
              key={g.gasto_id}
              gasto={g}
              canDelete={canCreate}
              onDelete={() => deleteGasto(g.gasto_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── GastoRow ──────────────────────────────────────────────────────────────────

function GastoRow({
  gasto,
  canDelete,
  onDelete,
}: {
  gasto: GastoCompra;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const color = TYPE_COLORS[gasto.tipo] ?? '#6B7280';
  const statusColor =
    gasto.status === 'Aprobado'  ? 'text-success' :
    gasto.status === 'Rechazado' ? 'text-red-500' :
    'text-amber';

  return (
    <div className="bg-white rounded-xl border border-border p-3 shadow-sm flex items-center gap-3">
      <div
        className="rounded-full self-stretch"
        style={{ backgroundColor: color, minWidth: 4, maxWidth: 4 }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text truncate">{gasto.proveedor || '—'}</p>
        <p className="text-xs text-text-secondary">
          {gasto.unidad} · {gasto.fecha}
        </p>
        <p className="text-xs text-text-secondary flex items-center gap-1">
          <span style={{ color }}>{TYPE_ICONS_SM[gasto.tipo]}</span>
          {gasto.tipo}
        </p>
      </div>
      <div className="text-right flex items-center gap-3">
        <div>
          <p className="text-sm font-semibold text-text">{mxn(gasto.total)}</p>
          <p className={`text-xs font-medium ${statusColor}`}>{gasto.status}</p>
        </div>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            aria-label="Eliminar gasto"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
```

---

## `src/pages/NuevoGastoPage.tsx`

```typescript
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  Upload,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ScanLine,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { useGastosStore } from '../stores/gastos-store';
import { ocrReceipt } from '../lib/sheets-api';
import type { GastoTipo, MetodoPago } from '../stores/gastos-store';
import type { OcrLineItem } from '../lib/sheets-api';
import { uploadPhoto } from '../lib/photo-upload';
import { useEquipmentList } from '../hooks/useEquipmentList';

// ── Empty line item ───────────────────────────────────────────────────────────

function emptyLine(): OcrLineItem {
  return { part_number: '', description: '', qty: 1, unit_price: 0, subtotal: 0 };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NuevoGastoPage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);
  const equipment = useEquipmentList();
  const { saveGasto, saving } = useGastosStore();

  // ── Form state
  const [tipo, setTipo] = useState<GastoTipo>('Refaccion');
  const [proveedor, setProveedor] = useState('');
  const [rfcProveedor, setRfcProveedor] = useState('');
  const [folioFactura, setFolioFactura] = useState('');
  const [subtotal, setSubtotal] = useState(0);
  const [iva, setIva] = useState(0);
  const [total, setTotal] = useState(0);
  // ── Unit mode
  const [unitMode, setUnitMode] = useState<'single' | 'multi'>('single');
  const [unidad, setUnidad] = useState('');
  const [splitEntries, setSplitEntries] = useState<{ unitId: string; amount: number }[]>([]);
  const [splitPickerValue, setSplitPickerValue] = useState('');
  const [otId, setOtId] = useState('');
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('Efectivo');
  const [lineItems, setLineItems] = useState<OcrLineItem[]>([emptyLine()]);
  const [imageUrl, setImageUrl] = useState('');

  // ── OCR state
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrDone, setOcrDone] = useState(false);

  // ── Submit state
  const [submitDone, setSubmitDone] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // ── Recalc total when subtotal or IVA changes ─────────────────────────────

  function handleSubtotalChange(val: number) {
    setSubtotal(val);
    const calculatedIva = parseFloat((val * 0.16).toFixed(2));
    setIva(calculatedIva);
    setTotal(parseFloat((val + calculatedIva).toFixed(2)));
  }

  // ── OCR ───────────────────────────────────────────────────────────────────

  async function handleFile(file: File) {
    setOcrLoading(true);
    setOcrError(null);
    setOcrDone(false);
    try {
      // Run OCR and photo upload in parallel — upload failure is non-blocking
      const [ocrResult, uploadResult] = await Promise.allSettled([
        ocrReceipt(file),
        uploadPhoto(file, 'receipts', `gastos/${Date.now()}`),
      ]);

      if (ocrResult.status === 'fulfilled') {
        const result = ocrResult.value;
        setProveedor(result.proveedor || '');
        setRfcProveedor(result.rfc_proveedor || '');
        setFolioFactura(result.folio_factura || '');
        setSubtotal(result.subtotal || 0);
        setIva(result.iva || 0);
        setTotal(result.total || 0);
        if (result.tipo) setTipo(result.tipo as GastoTipo);
        if (result.line_items?.length > 0) {
          setLineItems(result.line_items);
        }
        setOcrDone(true);
      } else {
        const msg = ocrResult.reason instanceof Error ? ocrResult.reason.message : '';
        if (msg.includes('404') || msg.includes('Not Found')) {
          setOcrError('El servicio OCR aún no está activo en el servidor. Completa los datos manualmente.');
        } else if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed')) {
          setOcrError('Sin conexión al servidor. Completa los datos manualmente.');
        } else {
          setOcrError('No se pudo leer el recibo. Completa los datos manualmente.');
        }
      }

      // Save photo URL if upload succeeded (non-blocking — gasto saves even if upload failed)
      if (uploadResult.status === 'fulfilled') {
        setImageUrl(uploadResult.value);
      }
    } finally {
      setOcrLoading(false);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  // ── Line item helpers ─────────────────────────────────────────────────────

  function updateLine(index: number, patch: Partial<OcrLineItem>) {
    setLineItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, ...patch };
        updated.subtotal = parseFloat((updated.qty * updated.unit_price).toFixed(2));
        return updated;
      })
    );
  }

  function addLine() {
    setLineItems((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Split helpers ─────────────────────────────────────────────────────────

  function addSplitUnit(uid: string) {
    if (!uid || splitEntries.some((e) => e.unitId === uid)) return;
    setSplitEntries((prev) => {
      const count = prev.length + 1;
      const equal = parseFloat((total / count).toFixed(2));
      // Redistribute equally
      const updated = prev.map((e) => ({ ...e, amount: equal }));
      // Last entry absorbs rounding remainder
      const sumRest = equal * (count - 1);
      const last = parseFloat((total - sumRest).toFixed(2));
      return [...updated, { unitId: uid, amount: last }];
    });
    setSplitPickerValue('');
  }

  function removeSplitUnit(uid: string) {
    setSplitEntries((prev) => prev.filter((e) => e.unitId !== uid));
  }

  function updateSplitAmount(uid: string, amount: number) {
    setSplitEntries((prev) =>
      prev.map((e) => (e.unitId === uid ? { ...e, amount } : e))
    );
  }

  const splitSum = splitEntries.reduce((s, e) => s + e.amount, 0);
  const splitOk = splitEntries.length > 0 && Math.abs(splitSum - total) < 0.01;

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const commonFields = {
      tipo,
      proveedor,
      rfc_proveedor: rfcProveedor,
      folio_factura: folioFactura,
      ot_id: otId,
      metodo_pago: metodoPago,
      imagen_url: imageUrl,
      solicitante: userName,
      line_items: lineItems.filter((l) => l.description.trim() !== ''),
    };

    try {
      if (unitMode === 'single') {
        await saveGasto({ ...commonFields, subtotal, iva, total, unidad });
      } else {
        for (const entry of splitEntries) {
          const proportion = total > 0 ? entry.amount / total : 1 / splitEntries.length;
          await saveGasto({
            ...commonFields,
            unidad: entry.unitId,
            total: entry.amount,
            subtotal: parseFloat((subtotal * proportion).toFixed(2)),
            iva: parseFloat((iva * proportion).toFixed(2)),
          });
        }
      }
      setSubmitDone(true);
      setTimeout(() => navigate(-1), 1800);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Error al guardar');
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────

  if (submitDone) {
    const count = unitMode === 'multi' ? splitEntries.length : 1;
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 animate-fade-up">
        <CheckCircle size={56} className="text-success" />
        <p className="text-xl font-semibold text-text">
          {count === 1 ? 'Gasto registrado' : `${count} gastos registrados`}
        </p>
        <p className="text-sm text-text-secondary">Regresando…</p>
      </div>
    );
  }

  const unitIds = ['FLOTA', ...equipment.map((e) => e.unit_id)];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col py-4 gap-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <button type="button" onClick={() => navigate(-1)} className="p-1 -ml-1">
          <ChevronLeft size={22} className="text-text-secondary" />
        </button>
        <h1 className="text-xl font-bold text-text">Nuevo Gasto</h1>
      </div>

      {/* ── OCR section ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
        <p className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
          <ScanLine size={16} /> Escanear Recibo / Factura
        </p>
        <div className="flex gap-3">
          {/* Camera */}
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex-1 flex flex-col items-center gap-1 border-2 border-dashed border-border rounded-lg py-4 text-text-secondary hover:border-amber transition-colors"
          >
            <Camera size={22} />
            <span className="text-xs">Cámara</span>
          </button>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileInput}
          />

          {/* Gallery */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex-1 flex flex-col items-center gap-1 border-2 border-dashed border-border rounded-lg py-4 text-text-secondary hover:border-amber transition-colors"
          >
            <Upload size={22} />
            <span className="text-xs">Galería</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>

        {/* OCR feedback */}
        {ocrLoading && (
          <div className="flex items-center gap-2 mt-3 text-sm text-text-secondary">
            <Loader2 size={16} className="animate-spin" />
            Leyendo recibo…
          </div>
        )}
        {ocrDone && !ocrLoading && (
          <div className="flex items-center gap-2 mt-3 text-sm text-success">
            <CheckCircle size={16} />
            Datos extraídos — revisa y corrige si es necesario
          </div>
        )}
        {ocrError && (
          <div className="flex items-center gap-2 mt-3 text-sm text-red-600">
            <AlertCircle size={16} />
            {ocrError}
          </div>
        )}
      </div>

      {/* ── General info ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border p-4 shadow-sm flex flex-col gap-3">
        <p className="text-sm font-semibold text-text">Datos Generales</p>

        {/* Tipo */}
        <div>
          <label className="text-xs text-text-secondary mb-1 block">Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as GastoTipo)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="Refaccion">Refacción</option>
            <option value="Combustible">Combustible</option>
            <option value="Servicio">Servicio</option>
            <option value="Otro">Otro</option>
          </select>
        </div>

        {/* Proveedor */}
        <div>
          <label className="text-xs text-text-secondary mb-1 block">Proveedor</label>
          <input
            value={proveedor}
            onChange={(e) => setProveedor(e.target.value)}
            placeholder="Nombre del proveedor"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm"
            required
          />
        </div>

        {/* RFC */}
        <div>
          <label className="text-xs text-text-secondary mb-1 block">RFC Proveedor (opcional)</label>
          <input
            value={rfcProveedor}
            onChange={(e) => setRfcProveedor(e.target.value.toUpperCase())}
            placeholder="RFC-XXXXXX-XXX"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm font-mono"
          />
        </div>

        {/* Folio */}
        <div>
          <label className="text-xs text-text-secondary mb-1 block">Folio / Factura (opcional)</label>
          <input
            value={folioFactura}
            onChange={(e) => setFolioFactura(e.target.value)}
            placeholder="A-04821"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {/* Unidad(es) */}
        <div>
          <label className="text-xs text-text-secondary mb-1 block">Unidad(es)</label>

          {/* Mode toggle */}
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => setUnitMode('single')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                unitMode === 'single' ? 'bg-amber text-white' : 'bg-white border border-border text-text-secondary'
              }`}
            >
              Una unidad
            </button>
            <button
              type="button"
              onClick={() => setUnitMode('multi')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                unitMode === 'multi' ? 'bg-amber text-white' : 'bg-white border border-border text-text-secondary'
              }`}
            >
              Múltiples · Flota
            </button>
          </div>

          {unitMode === 'single' ? (
            <select
              value={unidad}
              onChange={(e) => setUnidad(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white"
              required={unitMode === 'single'}
            >
              <option value="">Seleccionar unidad…</option>
              {unitIds.map((uid) => (
                <option key={uid} value={uid}>{uid === 'FLOTA' ? '── FLOTA (global) ──' : uid}</option>
              ))}
            </select>
          ) : (
            <div className="bg-amber/5 border border-amber/30 rounded-xl p-3 flex flex-col gap-2">
              <p className="text-xs font-semibold text-amber-800">
                Distribución — Total: ${total.toFixed(2)}
              </p>

              {splitEntries.map((entry) => (
                <div key={entry.unitId} className="flex items-center gap-2">
                  <span className="flex-1 bg-white border border-border rounded-lg px-3 py-1.5 text-sm font-semibold text-text">
                    {entry.unitId}
                  </span>
                  <span className="text-xs text-text-secondary">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={entry.amount || ''}
                    onChange={(e) => updateSplitAmount(entry.unitId, parseFloat(e.target.value) || 0)}
                    className="w-24 border border-border rounded-lg px-2 py-1.5 text-sm font-semibold text-right"
                  />
                  <button
                    type="button"
                    onClick={() => removeSplitUnit(entry.unitId)}
                    className="w-7 h-7 rounded-full bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-100 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}

              {/* Add unit picker */}
              <select
                value={splitPickerValue}
                onChange={(e) => addSplitUnit(e.target.value)}
                className="w-full border border-dashed border-border rounded-lg px-3 py-1.5 text-sm text-text-secondary bg-white"
              >
                <option value="">+ Agregar unidad…</option>
                {unitIds
                  .filter((uid) => !splitEntries.some((e) => e.unitId === uid))
                  .map((uid) => (
                    <option key={uid} value={uid}>{uid === 'FLOTA' ? '── FLOTA (global) ──' : uid}</option>
                  ))}
              </select>

              {/* Running total */}
              {splitEntries.length > 0 && (
                <div className="flex justify-between items-center pt-1 border-t border-amber/20">
                  <span className="text-xs text-amber-800">Distribuido</span>
                  <span className={`text-xs font-bold ${splitOk ? 'text-green-600' : 'text-red-500'}`}>
                    ${splitSum.toFixed(2)} {splitOk ? '✓' : `— faltan $${(total - splitSum).toFixed(2)}`}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* OT (optional) */}
        <div>
          <label className="text-xs text-text-secondary mb-1 block">OT relacionada (opcional)</label>
          <input
            value={otId}
            onChange={(e) => setOtId(e.target.value.toUpperCase())}
            placeholder="OT-2026-044"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm font-mono"
          />
        </div>

        {/* Método de pago */}
        <div>
          <label className="text-xs text-text-secondary mb-1 block">Método de Pago</label>
          <select
            value={metodoPago}
            onChange={(e) => setMetodoPago(e.target.value as MetodoPago)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="Efectivo">Efectivo</option>
            <option value="Transferencia">Transferencia</option>
            <option value="Tarjeta">Tarjeta</option>
          </select>
        </div>
      </div>

      {/* ── Totales ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border p-4 shadow-sm flex flex-col gap-3">
        <p className="text-sm font-semibold text-text">Totales</p>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-text-secondary mb-1 block">Subtotal</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={subtotal || ''}
              onChange={(e) => handleSubtotalChange(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary mb-1 block">IVA 16%</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={iva || ''}
              onChange={(e) => {
                const v = parseFloat(e.target.value) || 0;
                setIva(v);
                setTotal(parseFloat((subtotal + v).toFixed(2)));
              }}
              placeholder="0.00"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary mb-1 block">Total</label>
            <div className="w-full border border-border rounded-lg px-3 py-2 text-sm font-semibold bg-gray-50">
              ${total.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Line items ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border p-4 shadow-sm flex flex-col gap-3">
        <p className="text-sm font-semibold text-text">Líneas del Recibo</p>

        {lineItems.map((item, i) => (
          <div key={i} className="border border-border rounded-lg p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary font-medium">Línea {i + 1}</span>
              {lineItems.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  className="text-red-400 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <input
              value={item.part_number}
              onChange={(e) => updateLine(i, { part_number: e.target.value })}
              placeholder="Número de parte (opcional)"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm font-mono"
            />
            <input
              value={item.description}
              onChange={(e) => updateLine(i, { description: e.target.value })}
              placeholder="Descripción *"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm"
              required
            />
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-text-secondary mb-1 block">Cant.</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={item.qty || ''}
                  onChange={(e) => updateLine(i, { qty: parseFloat(e.target.value) || 0 })}
                  className="w-full border border-border rounded-lg px-2 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary mb-1 block">Precio u.</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unit_price || ''}
                  onChange={(e) => updateLine(i, { unit_price: parseFloat(e.target.value) || 0 })}
                  className="w-full border border-border rounded-lg px-2 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary mb-1 block">Subtotal</label>
                <div className="w-full border border-border rounded-lg px-2 py-2 text-sm bg-gray-50">
                  ${item.subtotal.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addLine}
          className="flex items-center gap-2 text-sm text-amber font-medium py-2"
        >
          <Plus size={16} /> Agregar línea
        </button>
      </div>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {submitError && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle size={16} />
          {submitError}
        </div>
      )}

      {/* ── Submit ───────────────────────────────────────────────────────── */}
      <button
        type="submit"
        disabled={saving || (unitMode === 'multi' && !splitOk)}
        className="w-full bg-amber text-white font-semibold rounded-xl py-3.5 flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {saving ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Guardando…
          </>
        ) : unitMode === 'multi' ? (
          `Registrar ${splitEntries.length} gastos`
        ) : (
          'Registrar Gasto'
        )}
      </button>
    </form>
  );
}
```

---

## `src/pages/ViajePage.tsx`

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Plus } from 'lucide-react';
import { TRANSPORT_UNITS } from '../data/transport-units';
import { mexicoDateInput, mexicoTimeInput } from '../lib/date-utils';
import { appendRow, SHEET_TABS } from '../lib/sheets-api';
import { useAuthStore } from '../stores/auth-store';
import ConfirmModal from '../components/ui/ConfirmModal';
import SuccessToast from '../components/ui/SuccessToast';

const MATERIAL_OPTIONS = ['Tierra', 'Roca', 'Grava', 'Mineral', 'Caliza', 'Otro'] as const;

// ── Column mapping for Reporte_Fletes_Transporte ──────────────────────────────
// A (0)  Fecha
// B (1)  Hora
// C (2)  No. Unidad
// D (3)  Conductor
// E (4)  KM Cargado
// F (5)  KM Vacío
// G (6)  ORIGEN
// H (7)  RUTA DESTINO
// I (8)  KM TOTAL
// J (9)  CLIENTE
// K (10) TIPO CARGA
// L (11) TONELAJE
// M (12) FLETE ($)
// N (13) OBSERVACIONES
// O (14) Ticket_Bascula

type Mode = 'single' | 'multi';

interface TripEntry {
  hora:     string;
  tonelaje: string;
  flete:    string;
}

const emptyTrip = (hora: string = ''): TripEntry => ({
  hora,
  tonelaje: '',
  flete:    '',
});

export default function ViajePage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);

  // ── Mode ──────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>('single');

  // ── Common fields ─────────────────────────────────────────────────────────
  const [fecha, setFecha] = useState<string>(mexicoDateInput());
  const [hora, setHora] = useState<string>(mexicoTimeInput());
  const [unidad, setUnidad] = useState<string>('');
  const [rutaOrigen, setRutaOrigen] = useState<string>('');
  const [rutaDestino, setRutaDestino] = useState<string>('');
  const [kmCargado, setKmCargado] = useState<string>('');
  const [kmVacio, setKmVacio] = useState<string>('');
  const [material, setMaterial] = useState<string>('');
  const [cliente, setCliente] = useState<string>('');
  const [observaciones, setObservaciones] = useState<string>('');

  // ── Single-mode fields ────────────────────────────────────────────────────
  const [tonelaje, setTonelaje] = useState<string>('');
  const [flete, setFlete] = useState<string>('');

  // ── Multi-mode trips ──────────────────────────────────────────────────────
  const [trips, setTrips] = useState<TripEntry[]>([emptyTrip(mexicoTimeInput())]);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastVisible, setToastVisible] = useState<boolean>(false);

  const kmCargadoNum = parseFloat(kmCargado) || 0;
  const kmVacioNum   = parseFloat(kmVacio)   || 0;
  const kmTotal      = kmCargado !== '' && kmVacio !== '' ? kmCargadoNum + kmVacioNum : null;

  // ── Totals in multi mode ──────────────────────────────────────────────────
  const totalTonelaje = trips.reduce((s, t) => s + (parseFloat(t.tonelaje) || 0), 0);
  const totalFlete    = trips.reduce((s, t) => s + (parseFloat(t.flete)    || 0), 0);

  const commonsFilled =
    unidad !== '' &&
    rutaOrigen.trim() !== '' &&
    rutaDestino.trim() !== '' &&
    kmCargado !== '' &&
    kmVacio !== '';

  const tripsValid = trips.length > 0 && trips.every(
    (t) => t.hora.trim() !== '' && (parseFloat(t.tonelaje) || 0) > 0
  );

  const canSubmit =
    mode === 'single'
      ? commonsFilled
      : commonsFilled && tripsValid;

  // ── Trip helpers ──────────────────────────────────────────────────────────

  function updateTrip(index: number, patch: Partial<TripEntry>): void {
    setTrips((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function addTrip(): void {
    // Pre-fill flete from the most recent trip if set (same client/route usually = same rate)
    const last = trips[trips.length - 1];
    setTrips((prev) => [
      ...prev,
      { hora: mexicoTimeInput(), tonelaje: '', flete: last?.flete ?? '' },
    ]);
  }

  function removeTrip(index: number): void {
    setTrips((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  function handleSubmitIntent(): void {
    if (!canSubmit) return;
    setShowConfirm(true);
  }

  async function handleConfirm(): Promise<void> {
    setShowConfirm(false);
    setSubmitting(true);

    const fechaSheet = fecha.split('-').reverse().join('/'); // dd/MM/yyyy
    const kmTotalStr = String(kmCargadoNum + kmVacioNum);

    /**
     * Builds a row with EXACTLY 15 columns in the order of Reporte_Fletes_Transporte:
     * A:Fecha B:Hora C:Unidad D:Conductor E:KM_Cargado F:KM_Vacio
     * G:Origen H:Destino I:KM_Total J:Cliente K:Tipo_Carga L:Tonelaje
     * M:Flete N:Observaciones O:Ticket_Bascula
     */
    const buildRow = (horaVal: string, tonelajeVal: string, fleteVal: string): string[] => {
      const horaNormalised = horaVal.length === 5 ? `${horaVal}:00` : horaVal;
      return [
        fechaSheet,                                // A (0)  Fecha
        horaNormalised,                            // B (1)  Hora
        unidad,                                    // C (2)  No. Unidad
        userName,                                  // D (3)  Conductor
        String(kmCargadoNum),                      // E (4)  KM Cargado
        String(kmVacioNum),                        // F (5)  KM Vacío
        rutaOrigen,                                // G (6)  ORIGEN
        rutaDestino,                               // H (7)  RUTA DESTINO
        kmTotalStr,                                // I (8)  KM TOTAL
        cliente,                                   // J (9)  CLIENTE
        material,                                  // K (10) TIPO CARGA
        String(parseFloat(tonelajeVal) || 0),      // L (11) TONELAJE
        String(parseFloat(fleteVal) || 0),         // M (12) FLETE ($)
        observaciones,                             // N (13) OBSERVACIONES
        '',                                        // O (14) Ticket_Bascula
      ];
    };

    try {
      if (mode === 'single') {
        await appendRow(SHEET_TABS.FLETES, buildRow(hora, tonelaje, flete));
        setToastMessage('Flete registrado ✓');
      } else {
        // Sort trips chronologically so the Google Sheet shows them in order —
        // operator may enter them out of order when catching up at home.
        const orderedTrips = [...trips].sort((a, b) => a.hora.localeCompare(b.hora));

        // Sequential await guarantees rows land in order (no parallel races).
        for (const t of orderedTrips) {
          await appendRow(SHEET_TABS.FLETES, buildRow(t.hora, t.tonelaje, t.flete));
        }
        setToastMessage(`${orderedTrips.length} viajes registrados ✓`);
      }
      setToastVisible(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar';
      setToastMessage(`Error: ${msg}`);
      setToastVisible(true);
    } finally {
      setSubmitting(false);
    }
  }

  function handleToastDismiss(): void {
    setToastVisible(false);
    navigate(-1);
  }

  const confirmMessage =
    mode === 'single'
      ? `¿Registrar flete de ${rutaOrigen} → ${rutaDestino} para ${unidad || 'la unidad'}?`
      : `¿Registrar ${trips.length} viajes de ${rutaOrigen} → ${rutaDestino} para ${unidad || 'la unidad'}? Total: ${totalTonelaje.toFixed(1)} ton · $${totalFlete.toFixed(2)}`;

  return (
    <div className="flex flex-col pb-4 animate-fade-up">
      <SuccessToast
        message={toastMessage}
        visible={toastVisible}
        onDismiss={handleToastDismiss}
      />

      <ConfirmModal
        open={showConfirm}
        title={mode === 'single' ? 'Confirmar registro de flete' : `Confirmar ${trips.length} viajes`}
        message={confirmMessage}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <h1 className="text-xl font-bold text-text">Registro de Flete</h1>
      </div>

      {/* ── Mode toggle ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl p-3 shadow-sm border border-border mb-3">
        <label className="text-xs font-medium text-text-secondary mb-2 block">Modo</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mode === 'single' ? 'bg-amber text-white' : 'bg-white border border-border text-text-secondary'
            }`}
          >
            Un viaje
          </button>
          <button
            type="button"
            onClick={() => setMode('multi')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mode === 'multi' ? 'bg-amber text-white' : 'bg-white border border-border text-text-secondary'
            }`}
          >
            Varios viajes del día
          </button>
        </div>
      </div>

      {/* ── Common fields card ────────────────────────────────────────── */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border flex flex-col gap-4">
        {mode === 'multi' && (
          <p className="text-xs font-semibold text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
            Datos comunes — aplica a todos los viajes
          </p>
        )}

        {/* Fecha + (single-mode Hora) */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-secondary">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-xl border border-border p-3 text-text bg-white"
            />
          </div>
          {mode === 'single' && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-secondary">Hora</label>
              <input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="w-full rounded-xl border border-border p-3 text-text bg-white"
              />
            </div>
          )}
        </div>

        {/* Unidad */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Camión / Unidad</label>
          <select
            value={unidad}
            onChange={(e) => setUnidad(e.target.value)}
            className="w-full rounded-xl border border-border p-3 bg-white text-text"
          >
            <option value="">Seleccionar unidad...</option>
            {TRANSPORT_UNITS.map((eq) => (
              <option key={eq.unit_id} value={eq.unit_id}>
                {eq.unit_id} — {eq.type}
              </option>
            ))}
          </select>
        </div>

        {/* Origen / Destino */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-secondary">Origen</label>
            <input
              type="text"
              value={rutaOrigen}
              onChange={(e) => setRutaOrigen(e.target.value)}
              placeholder="Ej: Frente 3"
              className="w-full rounded-xl border border-border p-3 text-text bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-secondary">Destino</label>
            <input
              type="text"
              value={rutaDestino}
              onChange={(e) => setRutaDestino(e.target.value)}
              placeholder="Ej: Patio de acopio"
              className="w-full rounded-xl border border-border p-3 text-text bg-white"
            />
          </div>
        </div>

        {/* KM grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-secondary">KM Cargado</label>
            <input
              type="number"
              value={kmCargado}
              onChange={(e) => setKmCargado(e.target.value)}
              placeholder="0"
              className="w-full rounded-xl border border-border p-3 text-text bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-secondary">KM Vacío</label>
            <input
              type="number"
              value={kmVacio}
              onChange={(e) => setKmVacio(e.target.value)}
              placeholder="0"
              className="w-full rounded-xl border border-border p-3 text-text bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-secondary">KM Total</label>
            <div className="w-full rounded-xl border border-border p-3 bg-gray-50 text-text font-semibold text-center">
              {kmTotal !== null ? kmTotal : '—'}
            </div>
          </div>
        </div>

        {/* Tipo de Carga + (single-mode Tonelaje) */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-secondary">Tipo de Carga</label>
            <select
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              className="w-full rounded-xl border border-border p-3 bg-white text-text"
            >
              <option value="">Seleccionar...</option>
              {MATERIAL_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          {mode === 'single' ? (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-secondary">Tonelaje</label>
              <input
                type="number"
                value={tonelaje}
                onChange={(e) => setTonelaje(e.target.value)}
                placeholder="0"
                className="w-full rounded-xl border border-border p-3 text-text bg-white"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-secondary">Cliente</label>
              <input
                type="text"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Nombre del cliente"
                className="w-full rounded-xl border border-border p-3 text-text bg-white"
              />
            </div>
          )}
        </div>

        {/* Cliente + Flete (single only — in multi these live per-trip/in commons) */}
        {mode === 'single' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-secondary">Cliente</label>
              <input
                type="text"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Nombre del cliente"
                className="w-full rounded-xl border border-border p-3 text-text bg-white"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-secondary">Flete ($)</label>
              <input
                type="number"
                value={flete}
                onChange={(e) => setFlete(e.target.value)}
                placeholder="0.00"
                step="0.01"
                className="w-full rounded-xl border border-border p-3 text-text bg-white"
              />
            </div>
          </div>
        )}

        {/* Observaciones */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">
            Observaciones {mode === 'multi' && <span className="text-xs text-text-secondary">(del día)</span>}
          </label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Observaciones del viaje..."
            rows={2}
            className="w-full rounded-xl border border-border p-3 text-sm text-text resize-none bg-white"
          />
        </div>
      </div>

      {/* ── Multi-mode trips list ─────────────────────────────────────── */}
      {mode === 'multi' && (
        <div className="mt-3 rounded-xl p-4 border" style={{ background: '#FFFBEB', borderColor: '#F59E0B' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold" style={{ color: '#92400E' }}>
              🚚 Viajes del día
            </p>
            <span className="text-xs font-semibold" style={{ color: '#92400E' }}>
              {trips.length} {trips.length === 1 ? 'viaje' : 'viajes'}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {trips.map((t, i) => (
              <div
                key={i}
                className="bg-white rounded-lg p-3 border"
                style={{ borderColor: '#FDE68A' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold" style={{ color: '#92400E' }}>
                    Viaje {i + 1}
                  </span>
                  {trips.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTrip(i)}
                      className="w-7 h-7 rounded-full bg-red-50 text-red-500 flex items-center justify-center"
                      aria-label="Eliminar viaje"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-text-secondary block mb-1">Hora</label>
                    <input
                      type="time"
                      value={t.hora}
                      onChange={(e) => updateTrip(i, { hora: e.target.value })}
                      className="w-full rounded-lg border p-2 text-sm text-text bg-white text-center"
                      style={{ borderColor: '#FDE68A' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-secondary block mb-1">Tonelaje</label>
                    <input
                      type="number"
                      value={t.tonelaje}
                      onChange={(e) => updateTrip(i, { tonelaje: e.target.value })}
                      placeholder="0"
                      className="w-full rounded-lg border p-2 text-sm font-semibold text-center bg-white"
                      style={{ borderColor: '#FDE68A', color: '#D97706' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-secondary block mb-1">Flete $</label>
                    <input
                      type="number"
                      value={t.flete}
                      onChange={(e) => updateTrip(i, { flete: e.target.value })}
                      placeholder="0"
                      step="0.01"
                      className="w-full rounded-lg border p-2 text-sm text-center bg-white"
                      style={{ borderColor: '#FDE68A' }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addTrip}
            className="mt-3 w-full py-2.5 rounded-lg border border-dashed text-sm font-semibold flex items-center justify-center gap-2 bg-white"
            style={{ borderColor: '#F59E0B', color: '#D97706' }}
          >
            <Plus size={16} /> Agregar otro viaje
          </button>

          {/* Totals strip */}
          <div
            className="mt-3 pt-3 border-t border-dashed flex justify-between items-center"
            style={{ borderColor: '#FCD34D' }}
          >
            <span className="text-xs font-medium" style={{ color: '#92400E' }}>
              Total del día
            </span>
            <span className="text-sm font-bold text-green-600">
              {totalTonelaje.toFixed(1)} ton · ${totalFlete.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmitIntent}
        disabled={!canSubmit || submitting}
        className="mt-4 w-full bg-amber text-white rounded-xl py-4 font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity btn-press"
        style={{ minHeight: 52 }}
      >
        {submitting
          ? 'Guardando...'
          : mode === 'single'
            ? 'Registrar Flete'
            : `Registrar ${trips.length} Viajes`}
      </button>
    </div>
  );
}
```

---

## `src/pages/ViajesPenaPage.tsx`

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { mexicoDate, mexicoTime } from '../lib/date-utils';
import { appendRow, SHEET_TABS } from '../lib/sheets-api';
import { useAuthStore } from '../stores/auth-store';
import ConfirmModal from '../components/ui/ConfirmModal';
import SuccessToast from '../components/ui/SuccessToast';

export default function ViajesPenaPage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);

  const [rutaOrigen, setRutaOrigen] = useState('');
  const [rutaDestino, setRutaDestino] = useState('');
  const [numViajes, setNumViajes] = useState('');
  const [metrosCubicos, setMetrosCubicos] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const canSubmit =
    rutaOrigen.trim() !== '' &&
    rutaDestino.trim() !== '';

  function handleSubmitIntent() {
    if (!canSubmit) return;
    setShowConfirm(true);
  }

  async function handleConfirm() {
    setShowConfirm(false);

    try {
      await appendRow(SHEET_TABS.VIAJES, [
        String(Date.now()),
        mexicoDate(),
        mexicoTime(),
        userName,
        rutaOrigen,
        rutaDestino,
        String(parseFloat(numViajes) || 0),
        String(parseFloat(metrosCubicos) || 0),
        observaciones,
      ]);
    } catch (err) {
      console.error('Sheets append failed (Viajes Peña):', err);
    }

    setToastMessage('Viaje Peña registrado ✓');
    setToastVisible(true);
  }

  function handleToastDismiss() {
    setToastVisible(false);
    navigate(-1);
  }

  return (
    <div className="flex flex-col pb-4 animate-fade-up">
      <SuccessToast
        message={toastMessage}
        visible={toastVisible}
        onDismiss={handleToastDismiss}
      />

      <ConfirmModal
        open={showConfirm}
        title="Confirmar viaje Peña"
        message={`¿Registrar viaje de ${rutaOrigen} → ${rutaDestino}?`}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-text">Viajes Peña Colorada</h1>
          <p className="text-xs text-text-secondary">Reporte de fin de turno</p>
        </div>
      </div>

      {/* Form card */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border flex flex-col gap-4">

        {/* Ruta origen */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Ruta Origen</label>
          <input
            type="text"
            value={rutaOrigen}
            onChange={(e) => setRutaOrigen(e.target.value)}
            placeholder="Frente 3"
            className="w-full rounded-xl border border-border p-3 text-text bg-white"
          />
        </div>

        {/* Ruta destino */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Ruta Destino</label>
          <input
            type="text"
            value={rutaDestino}
            onChange={(e) => setRutaDestino(e.target.value)}
            placeholder="Patio de acopio"
            className="w-full rounded-xl border border-border p-3 text-text bg-white"
          />
        </div>

        {/* Num viajes del turno */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Número de Viajes (turno)</label>
          <input
            type="number"
            value={numViajes}
            onChange={(e) => setNumViajes(e.target.value)}
            placeholder="Ej: 8"
            className="w-full rounded-xl border border-border p-4 text-2xl font-semibold text-text bg-white text-center"
          />
        </div>

        {/* Metros cúbicos totales */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Metros Cúbicos Totales</label>
          <input
            type="number"
            value={metrosCubicos}
            onChange={(e) => setMetrosCubicos(e.target.value)}
            placeholder="0"
            className="w-full rounded-xl border border-border p-3 text-text bg-white"
          />
        </div>

        {/* Observaciones */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Observaciones</label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Observaciones del turno..."
            rows={3}
            className="w-full rounded-xl border border-border p-3 text-sm text-text resize-none bg-white"
          />
        </div>
      </div>

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmitIntent}
        disabled={!canSubmit}
        className="mt-4 w-full bg-amber text-white rounded-xl py-4 font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity btn-press"
        style={{ minHeight: 52 }}
      >
        Registrar Viajes del Turno
      </button>
    </div>
  );
}
```

---

## `src/pages/PedidosPage.tsx`

```typescript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Plus,
  Trash2,
  Send,
  CheckCircle2,
  Loader2,
  PackageSearch,
  AlertCircle,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  Search,
  ArrowRight,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { useCartStore, type CartItem } from '../stores/cart-store';
import { appendRow, readRange, updateCell, SHEET_TABS } from '../lib/sheets-api';
import { useEquipmentList } from '../hooks/useEquipmentList';
import { mexicoDate, mexicoTime } from '../lib/date-utils';
import { useCatalogoStore } from '../stores/catalogo-store';

// ── Sheet columns for Cotizaciones_Pendientes (matching actual Sheet headers) ─
// A(0)  Fecha
// B(1)  Part_Number
// C(2)  Descripcion
// D(3)  Equipo
// E(4)  Qty
// F(5)  Dealer          ← source / OEM / Manual
// G(6)  Status          ← Pendiente / Pedido / Completado
// H(7)  Precio_Recibido ← blank on submit; supplier fills later
// I(8)  Fecha_Respuesta ← blank on submit; supplier fills later
// J(9)  PEDIDO_ID       ← tracking reference
// K(10) Hora
// L(11) Solicitante
// M(12) Urgencia
// N(13) Notas
// O(14) Total

const URGENCIA_CONFIG = {
  Normal:  { color: '#16A34A', bg: '#F0FDF4' },
  Urgente: { color: '#D97706', bg: '#FFFBEB' },
  Crítico: { color: '#DC2626', bg: '#FEF2F2' },
} as const;

let _pedidoSeq = 1;
function newPedidoId(): string {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `PED-${d}-${String(_pedidoSeq++).padStart(3, '0')}`;
}

// ── Manual part form ─────────────────────────────────────────────────────────
interface ManualForm {
  part_number: string;
  description: string;
  quantity: string;
  unit_price: string;
  equipment: string;
  urgencia: 'Normal' | 'Urgente' | 'Crítico';
  notes: string;
}

const emptyManual = (): ManualForm => ({
  part_number: '',
  description: '',
  quantity: '1',
  unit_price: '0',
  equipment: '',
  urgencia: 'Normal',
  notes: '',
});

// ── Submitted order row (read from sheet) ────────────────────────────────────
interface PedidoRow {
  id: string;
  pedidoId: string;
  fecha: string;
  hora: string;
  solicitante: string;
  partNum: string;
  descripcion: string;
  equipo: string;
  cantidad: string;
  precioUnit: string;
  total: string;
  urgencia: string;
  fuente: string;
  notas: string;
  estado: string;
}

type Tab = 'carrito' | 'historial';

// ════════════════════════════════════════════════════════════════════════════
export default function PedidosPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.role);
  const userName = useAuthStore((s) => s.userName);
  const equipment = useEquipmentList();
  const { items, removeItem, updateItem, clearCart } = useCartStore();

  const isJT = role === 'jefe_taller';
  const isGerencia = role === 'gerencia';

  const { fetchCatalogo, fetched: catalogFetched } = useCatalogoStore();

  const [tab, setTab] = useState<Tab>(isGerencia ? 'historial' : 'carrito');
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState<ManualForm>(emptyManual());
  const [manualErrors, setManualErrors] = useState<Partial<ManualForm>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [historial, setHistorial] = useState<PedidoRow[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [historialLoaded, setHistorialLoaded] = useState(false);
  const [historialError, setHistorialError] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  // ── Load historial ────────────────────────────────────────────────────────
  async function loadHistorial(force = false) {
    if (historialLoaded && !force) return;
    setLoadingHistorial(true);
    setHistorialError(false);
    try {
      const rows = await readRange(SHEET_TABS.COTIZACIONES);
      if (rows.length === 0) { setHistorial([]); setHistorialLoaded(true); return; }

      // ── Discover column positions from the header row ──────────────────
      const headers = rows[0].map((h) => (h ?? '').toLowerCase().trim());
      const col = (keys: string[]): number =>
        keys.reduce((found, k) => found !== -1 ? found : headers.findIndex((h) => h.includes(k)), -1);

      const iDate   = col(['fecha']);
      const iPart   = col(['part_number', 'part number', 'part#', 'numero', 'número']);
      const iDesc   = col(['descripcion', 'descripción', 'description']);
      const iEquip  = col(['equipo', 'equipment', 'unidad']);
      const iQty    = col(['qty', 'cantidad', 'quantity']);
      const iDealer = col(['dealer', 'fuente', 'source', 'origen']);
      const iStatus = col(['status', 'estado', 'estatus']);
      const iPrice  = col(['precio_recibido', 'precio recibido', 'price', 'precio']);
      const iPedId  = col(['pedido_id', 'pedido id', 'pedidoid', 'folio']);
      const iHora   = col(['hora', 'time', 'hour']);
      const iSolic  = col(['solicitante', 'solicitado', 'requested by', 'usuario']);
      const iUrg    = col(['urgencia', 'urgency', 'prioridad']);
      const iNotes  = col(['notas', 'notes', 'nota', 'observaciones']);
      const iTotal  = col(['total']);

      // Safe cell reader — falls back to hardcoded fallback index if header not found
      const cell = (r: string[], dynamicIdx: number, fallback: number) =>
        r[dynamicIdx !== -1 ? dynamicIdx : fallback] ?? '';

      const VALID_STATUSES = new Set(['Pendiente', 'Pedido', 'Completado']);

      const data = rows.slice(1).flatMap((r, idx) => {
        const pedidoId = cell(r, iPedId, 9);
        const estado   = cell(r, iStatus, 6);
        const partNum  = cell(r, iPart, 1);

        // Skip completely blank rows
        if (!pedidoId && !partNum) return [];

        // Skip rows with unrecognised status values (corrupted legacy data)
        if (estado && !VALID_STATUSES.has(estado)) return [];

        // Guard numeric fields — reject strings that look like names
        const rawQty   = cell(r, iQty, 4);
        const rawTotal = cell(r, iTotal, 14);
        const cantidad = /^\d+(\.\d+)?$/.test(rawQty.trim())    ? rawQty   : '';
        const total    = /^\d+(\.\d+)?$/.test(rawTotal.trim())  ? rawTotal : '';

        return [{
          id:          String(idx),
          pedidoId:    pedidoId || `ROW-${idx}`,
          fecha:       cell(r, iDate, 0),
          hora:        cell(r, iHora, 10),
          solicitante: cell(r, iSolic, 11),
          partNum,
          descripcion: cell(r, iDesc, 2),
          equipo:      cell(r, iEquip, 3),
          cantidad,
          precioUnit:  cell(r, iPrice, 7),
          total,
          urgencia:    cell(r, iUrg, 12),
          fuente:      cell(r, iDealer, 5),
          notas:       cell(r, iNotes, 13),
          estado:      estado || 'Pendiente',
        }];
      });
      setHistorial(data.reverse()); // newest first
      setHistorialLoaded(true);
    } catch {
      setHistorialError(true);
      setHistorial([]);
    } finally {
      setLoadingHistorial(false);
    }
  }

  // Auto-load historial on mount (Gerencia starts on historial tab directly)
  useEffect(() => {
    loadHistorial();
    if (!catalogFetched) fetchCatalogo();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTabChange(t: Tab) {
    setTab(t);
    if (t === 'historial') loadHistorial();
  }

  // ── Status change (Gerencia only) ─────────────────────────────────────────
  function handleStatusChange(rowId: string, newStatus: string) {
    setHistorial((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, estado: newStatus } : r))
    );
  }

  // ── Manual part validation ────────────────────────────────────────────────
  function validateManual(): boolean {
    const e: Partial<ManualForm> = {};
    if (!manual.part_number.trim()) e.part_number = 'Requerido';
    if (!manual.description.trim()) e.description = 'Requerido';
    if (!manual.quantity || isNaN(Number(manual.quantity)) || Number(manual.quantity) < 1) e.quantity = 'Mín 1';
    setManualErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleAddManual() {
    if (!validateManual()) return;
    useCartStore.getState().addItem({
      part_number: manual.part_number.trim().toUpperCase(),
      description: manual.description.trim(),
      quantity: Number(manual.quantity),
      unit_price: Number(manual.unit_price) || 0,
      equipment: manual.equipment,
      urgencia: manual.urgencia,
      notes: manual.notes,
      isManual: true,
      source: 'Manual',
    });
    setManual(emptyManual());
    setManualErrors({});
    setShowManual(false);
  }

  // ── Submit cart → Sheet ───────────────────────────────────────────────────
  async function handleSubmit() {
    if (items.length === 0) return;
    setSubmitting(true);
    setSubmitError(false);
    const fecha = mexicoDate();
    const hora = mexicoTime();
    const pedidoId = newPedidoId();

    try {
      await Promise.all(
        items.map((item) =>
          appendRow(SHEET_TABS.COTIZACIONES, [
            fecha,                                              // A: Fecha
            item.part_number,                                   // B: Part_Number
            item.description,                                   // C: Descripcion
            item.equipment,                                     // D: Equipo
            String(item.quantity),                              // E: Qty
            item.isManual ? 'Manual' : item.source,             // F: Dealer
            'Pendiente',                                        // G: Status
            '',                                                 // H: Precio_Recibido (proveedor llena)
            '',                                                 // I: Fecha_Respuesta (proveedor llena)
            pedidoId,                                           // J: PEDIDO_ID
            hora,                                               // K: Hora
            userName,                                           // L: Solicitante
            item.urgencia,                                      // M: Urgencia
            item.notes,                                         // N: Notas
            (item.quantity * item.unit_price).toFixed(2),       // O: Total
          ])
        )
      );
      clearCart();
      setSubmitted(true);
      setHistorialLoaded(false); // force reload next time
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  }

  // ── SUCCESS screen ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6 animate-fade-up">
        <CheckCircle2 size={64} color="#16A34A" />
        <h2 className="text-2xl font-bold text-text text-center">Pedido Enviado</h2>
        <p className="text-text-secondary text-center text-sm">
          El pedido fue registrado en el Sheet.<br />Gerencia recibirá la notificación.
        </p>
        <button
          onClick={() => { setSubmitted(false); navigate('/workshop'); }}
          className="w-full py-3 rounded-xl font-semibold text-white"
          style={{ backgroundColor: '#162252' }}
        >
          Volver al Inicio
        </button>
        <button
          onClick={() => { setSubmitted(false); handleTabChange('historial'); }}
          className="w-full py-3 rounded-xl font-semibold border"
          style={{ borderColor: '#162252', color: '#162252' }}
        >
          Ver Historial
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col py-4 animate-fade-up">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        <ShoppingCart size={24} color="#162252" />
        <h1 className="text-xl font-bold text-text">Pedidos de Refacciones</h1>
      </div>

      {/* ── Tabs ── */}
      <div className="flex mb-5 rounded-xl overflow-hidden border border-border">
        {isJT && (
          <button
            onClick={() => handleTabChange('carrito')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: tab === 'carrito' ? '#162252' : '#FFFFFF',
              color: tab === 'carrito' ? '#FFFFFF' : '#6B7280',
            }}
          >
            <ShoppingCart size={15} />
            Carrito
            {items.length > 0 && (
              <span
                className="rounded-full text-xs px-1.5 py-0.5 font-bold"
                style={{
                  backgroundColor: tab === 'carrito' ? '#F59E0B' : '#162252',
                  color: '#FFFFFF',
                }}
              >
                {items.length}
              </span>
            )}
          </button>
        )}
        <button
          onClick={() => handleTabChange('historial')}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors"
          style={{
            backgroundColor: tab === 'historial' ? '#162252' : '#FFFFFF',
            color: tab === 'historial' ? '#FFFFFF' : '#6B7280',
          }}
        >
          <ClipboardList size={15} />
          {isGerencia ? 'Pedidos Pendientes' : 'Historial'}
        </button>
      </div>

      {/* ════════════════════ CARRITO TAB ════════════════════ */}
      {tab === 'carrito' && isJT && (
        <div className="flex flex-col gap-4">

          {/* Empty carrito */}
          {items.length === 0 && !showManual && (
            <div className="flex flex-col items-center gap-4 py-10">
              <PackageSearch size={48} color="#9CA3AF" />
              <p className="text-text-secondary text-center">
                Tu carrito está vacío.<br />
                Busca refacciones en <strong>Partes</strong> y agrega las que necesitas.
              </p>
              <button
                onClick={() => navigate('/parts')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white"
                style={{ backgroundColor: '#162252' }}
              >
                <Search size={16} />
                Ir a Partes
              </button>
              <button
                onClick={() => setShowManual(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold border"
                style={{ borderColor: '#162252', color: '#162252' }}
              >
                <Plus size={16} />
                Agregar parte manual
              </button>
            </div>
          )}

          {/* Cart items */}
          {items.map((item) => (
            <CartItemCard
              key={item.cartId}
              item={item}
              expanded={expandedItem === item.cartId}
              onToggle={() => setExpandedItem(expandedItem === item.cartId ? null : item.cartId)}
              onUpdate={(updates) => updateItem(item.cartId, updates)}
              onRemove={() => removeItem(item.cartId)}
              unitIds={equipment.map((e) => e.unit_id)}
            />
          ))}

          {/* Add manual part toggle */}
          {items.length > 0 && !showManual && (
            <button
              onClick={() => setShowManual(true)}
              className="flex items-center justify-center gap-2 py-3 rounded-xl border-dashed border-2 text-sm font-medium transition-colors"
              style={{ borderColor: '#162252', color: '#162252' }}
            >
              <Plus size={16} />
              Agregar parte manual
            </button>
          )}

          {/* Manual entry form */}
          {showManual && (
            <ManualPartForm
              form={manual}
              errors={manualErrors}
              onChange={(f) => setManual(f)}
              onAdd={handleAddManual}
              onCancel={() => { setShowManual(false); setManual(emptyManual()); setManualErrors({}); }}
              unitIds={equipment.map((e) => e.unit_id)}
            />
          )}

          {/* Order summary + submit */}
          {items.length > 0 && (
            <div className="mt-2">
              {/* Summary */}
              <div
                className="rounded-xl p-4 mb-3"
                style={{ backgroundColor: '#F1F5F9', border: '1px solid #E5E7EB' }}
              >
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-text-secondary">Total partes:</span>
                  <span className="font-semibold text-text">{totalItems} piezas</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-text-secondary">Líneas:</span>
                  <span className="font-semibold text-text">{items.length}</span>
                </div>
                <div className="flex justify-between text-base font-bold mt-2 pt-2 border-t border-border">
                  <span className="text-text">Total estimado:</span>
                  <span style={{ color: '#162252' }}>${totalPrice.toFixed(2)}</span>
                </div>
              </div>

              {/* Crítico warning */}
              {items.some((i) => i.urgencia === 'Crítico') && (
                <div
                  className="flex items-center gap-2 p-3 rounded-xl mb-3"
                  style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}
                >
                  <AlertCircle size={16} color="#DC2626" />
                  <p className="text-xs text-red-700 font-medium">
                    Hay partes marcadas como Crítico — notifica al Supervisor inmediatamente.
                  </p>
                </div>
              )}

              {submitError && (
                <div
                  className="flex items-center gap-2 p-3 rounded-xl mb-3"
                  style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}
                >
                  <WifiOff size={16} color="#DC2626" />
                  <p className="text-xs text-red-700 font-medium">
                    Error al enviar — verifica la conexión e intenta de nuevo.
                  </p>
                </div>
              )}

              <button
                disabled={submitting}
                onClick={handleSubmit}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white text-base"
                style={{ backgroundColor: '#162252' }}
              >
                {submitting ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <Send size={18} />
                    {submitError ? 'Reintentar envío' : `Enviar Pedido (${items.length} ${items.length === 1 ? 'parte' : 'partes'})`}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════ HISTORIAL TAB ════════════════════ */}
      {tab === 'historial' && (
        <div className="flex flex-col gap-3">
          {loadingHistorial && (
            <div className="flex justify-center py-10">
              <Loader2 size={28} className="animate-spin" style={{ color: '#162252' }} />
            </div>
          )}

          {/* Connection error */}
          {!loadingHistorial && historialError && (
            <div className="flex flex-col items-center gap-4 py-10">
              <WifiOff size={40} color="#9CA3AF" />
              <div className="text-center">
                <p className="text-sm font-semibold text-text">Sin conexión al servidor</p>
                <p className="text-xs text-text-secondary mt-1">
                  No se pudieron cargar los pedidos.<br />Verifica el VPS e intenta de nuevo.
                </p>
              </div>
              <button
                onClick={() => { setHistorialLoaded(false); loadHistorial(true); }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white text-sm"
                style={{ backgroundColor: '#162252' }}
              >
                <RefreshCw size={15} />
                Reintentar
              </button>
            </div>
          )}

          {/* Empty (loaded successfully but zero rows) */}
          {!loadingHistorial && !historialError && historial.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-10">
              <ClipboardList size={48} color="#9CA3AF" />
              <p className="text-text-secondary text-center text-sm">
                No hay pedidos registrados aún.
              </p>
              <button
                onClick={() => loadHistorial(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium"
                style={{ borderColor: '#162252', color: '#162252' }}
              >
                <RefreshCw size={14} />
                Actualizar
              </button>
            </div>
          )}

          {historial.map((row) => (
            <PedidoRowCard
              key={row.id}
              row={row}
              isGerencia={isGerencia}
              onStatusChange={handleStatusChange}
            />
          ))}

          {/* Refresh at bottom when results are showing */}
          {!loadingHistorial && !historialError && historial.length > 0 && (
            <button
              onClick={() => loadHistorial(true)}
              className="flex items-center justify-center gap-1.5 text-center text-sm py-2"
              style={{ color: '#2563EB' }}
            >
              <RefreshCw size={13} />
              Actualizar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── CartItemCard ─────────────────────────────────────────────────────────────
function CartItemCard({
  item,
  expanded,
  onToggle,
  onUpdate,
  onRemove,
  unitIds,
}: {
  item: CartItem;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (u: Partial<CartItem>) => void;
  onRemove: () => void;
  unitIds: string[];
}) {
  const urgCfg = URGENCIA_CONFIG[item.urgencia] ?? URGENCIA_CONFIG.Normal;

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Collapsed header */}
      <div className="flex items-center gap-3 p-3">
        {/* Urgencia dot */}
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: urgCfg.color }}
        />
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm font-semibold text-amber truncate">{item.part_number}</p>
          <p className="text-xs text-text-secondary truncate">{item.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm font-bold text-text">×{item.quantity}</span>
          <button onClick={onToggle} className="p-1">
            {expanded ? <ChevronUp size={16} color="#6B7280" /> : <ChevronDown size={16} color="#6B7280" />}
          </button>
          <button onClick={onRemove} className="p-1">
            <Trash2 size={16} color="#DC2626" />
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border px-3 pb-3 pt-2 flex flex-col gap-3">
          {/* Equipo */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Equipo / Unidad</label>
            <select
              value={item.equipment}
              onChange={(e) => onUpdate({ equipment: e.target.value })}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text bg-white"
            >
              <option value="">Sin asignar</option>
              {unitIds.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          {/* Qty + Urgencia */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Cantidad</label>
              <input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(e) => onUpdate({ quantity: Math.max(1, Number(e.target.value)) })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Urgencia</label>
              <select
                value={item.urgencia}
                onChange={(e) => onUpdate({ urgencia: e.target.value as CartItem['urgencia'] })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text bg-white"
              >
                <option>Normal</option>
                <option>Urgente</option>
                <option>Crítico</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Notas</label>
            <input
              type="text"
              value={item.notes}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              placeholder="Número de avería, referencia, etc."
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text bg-white"
            />
          </div>

          {/* Price row */}
          <div className="flex justify-between text-sm pt-1 border-t border-border">
            <span className="text-text-secondary">
              {item.isManual ? '📝 Parte manual' : `📦 ${item.source}`}
            </span>
            <span className="font-bold text-text">
              ${(item.quantity * item.unit_price).toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ManualPartForm ───────────────────────────────────────────────────────────
function ManualPartForm({
  form,
  errors,
  onChange,
  onAdd,
  onCancel,
  unitIds,
}: {
  form: ManualForm;
  errors: Partial<ManualForm>;
  onChange: (f: ManualForm) => void;
  onAdd: () => void;
  onCancel: () => void;
  unitIds: string[];
}) {
  const { search: searchCatalog } = useCatalogoStore();
  const [suggestions, setSuggestions] = useState<ReturnType<typeof searchCatalog>>([]);

  const f = (field: keyof ManualForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...form, [field]: e.target.value });

  function handleSearchInput(value: string) {
    onChange({ ...form, description: value });
    setSuggestions(value.length >= 2 ? searchCatalog(value) : []);
  }

  function handlePartNumberInput(value: string) {
    onChange({ ...form, part_number: value });
    setSuggestions(value.length >= 2 ? searchCatalog(value) : []);
  }

  function applySuggestion(s: ReturnType<typeof searchCatalog>[0]) {
    onChange({
      ...form,
      part_number: s.clave.includes('_') ? '' : s.clave, // clave is PN if no underscores
      description: s.descripcion,
      unit_price:  s.precio > 0 ? String(s.precio) : form.unit_price,
    });
    setSuggestions([]);
  }

  return (
    <div
      className="rounded-xl border-2 p-4 flex flex-col gap-3 animate-fade-up"
      style={{ borderColor: '#2563EB', backgroundColor: '#EFF6FF' }}
    >
      <p className="font-semibold text-sm" style={{ color: '#1E3A8A' }}>
        ➕ Agregar parte manualmente
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">N° de Parte *</label>
          <input
            type="text"
            value={form.part_number}
            onChange={(e) => handlePartNumberInput(e.target.value)}
            placeholder="Ej: 6745-11-3102"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text"
          />
          {errors.part_number && <p className="text-xs text-red-500 mt-0.5">{errors.part_number}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">Cantidad *</label>
          <input
            type="number"
            min={1}
            value={form.quantity}
            onChange={f('quantity')}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text"
          />
          {errors.quantity && <p className="text-xs text-red-500 mt-0.5">{errors.quantity}</p>}
        </div>
      </div>

      <div className="relative">
        <label className="block text-xs font-semibold text-text-secondary mb-1">Descripción *</label>
        <input
          type="text"
          value={form.description}
          onChange={(e) => handleSearchInput(e.target.value)}
          placeholder="Nombre o descripción de la parte"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text"
          autoComplete="off"
        />
        {errors.description && <p className="text-xs text-red-500 mt-0.5">{errors.description}</p>}

        {/* Catalog suggestions dropdown */}
        {suggestions.length > 0 && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg overflow-hidden">
            {suggestions.map((s) => (
              <button
                key={s.clave}
                type="button"
                onMouseDown={() => applySuggestion(s)}
                className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-gray-50 last:border-0"
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="text-xs font-semibold text-text leading-tight">{s.descripcion}</p>
                    {!s.clave.includes('_') && (
                      <p className="text-xs text-blue-600 font-mono">{s.clave}</p>
                    )}
                    <p className="text-xs text-text-secondary">{s.proveedor}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold text-green-600">${s.precio.toFixed(2)}</p>
                    {s.precioMin !== s.precioMax && (
                      <p className="text-xs text-gray-400">${s.precioMin.toFixed(0)}–${s.precioMax.toFixed(0)}</p>
                    )}
                    <p className="text-xs text-gray-400">×{s.vecesComprado}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">Precio Unit. ($)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.unit_price}
            onChange={f('unit_price')}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">Urgencia</label>
          <select
            value={form.urgencia}
            onChange={f('urgencia')}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text"
          >
            <option>Normal</option>
            <option>Urgente</option>
            <option>Crítico</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-1">Equipo / Unidad</label>
        <select
          value={form.equipment}
          onChange={f('equipment')}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text"
        >
          <option value="">Sin asignar</option>
          {unitIds.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-1">Notas</label>
        <input
          type="text"
          value={form.notes}
          onChange={f('notes')}
          placeholder="Referencia, avería relacionada..."
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={onAdd}
          className="flex-1 py-2.5 rounded-xl font-semibold text-white text-sm"
          style={{ backgroundColor: '#162252' }}
        >
          Agregar al carrito
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl font-semibold text-sm border"
          style={{ borderColor: '#D1D5DB', color: '#6B7280' }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── Status flow config ────────────────────────────────────────────────────────
const STATUS_NEXT: Record<string, string | null> = {
  Pendiente:  'Pedido',
  Pedido:     'Completado',
  Completado: null,
};

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  Pendiente:  { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  Pedido:     { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  Completado: { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
};

const STATUS_LABEL: Record<string, string> = {
  Pendiente:  'Marcar como Pedido',
  Pedido:     'Marcar Completado',
  Completado: '',
};

// ── PedidoRowCard (Historial / Gerencia view) ────────────────────────────────
function PedidoRowCard({
  row,
  isGerencia,
  onStatusChange,
}: {
  row: PedidoRow;
  isGerencia: boolean;
  onStatusChange: (id: string, newStatus: string) => void;
}) {
  const [updating, setUpdating] = useState(false);
  const urgCfg = (URGENCIA_CONFIG as Record<string, { color: string; bg: string }>)[row.urgencia] ?? URGENCIA_CONFIG.Normal;
  const sCfg = STATUS_STYLE[row.estado] ?? STATUS_STYLE.Pendiente;
  const nextStatus = STATUS_NEXT[row.estado] ?? null;

  async function handleAdvance() {
    if (!nextStatus || updating) return;
    setUpdating(true);
    try {
      // Column J (index 9) = PEDIDO_ID, Column G (index 6) = Status
      await updateCell(SHEET_TABS.COTIZACIONES, 9, row.pedidoId, 6, nextStatus);
      onStatusChange(row.id, nextStatus);
    } catch {
      // silently fail — state not updated
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div
      className="bg-white rounded-xl shadow-sm overflow-hidden"
      style={{ border: `1.5px solid ${sCfg.border}` }}
    >
      {/* Status bar */}
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{ backgroundColor: sCfg.bg }}
      >
        <span className="text-xs font-bold" style={{ color: sCfg.color }}>
          {row.estado}
        </span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: urgCfg.color, backgroundColor: urgCfg.bg }}>
          {row.urgencia}
        </span>
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="mb-2">
          <p className="font-mono text-sm font-semibold text-amber">{row.partNum}</p>
          <p className="text-sm text-text font-medium">{row.descripcion}</p>
          <p className="text-xs text-text-secondary mt-0.5">
            {row.pedidoId} · {row.fecha} · {row.solicitante}
          </p>
        </div>
        <div className="flex gap-4 text-xs text-text-secondary mb-3">
          {row.equipo && <span>📍 {row.equipo}</span>}
          <span>×{row.cantidad}</span>
          {row.total && <span className="font-semibold text-text">${row.total}</span>}
          {row.fuente && <span>{row.fuente}</span>}
        </div>
        {row.notas && <p className="text-xs text-text-secondary mb-3 italic">{row.notas}</p>}

        {/* Gerencia status action */}
        {isGerencia && nextStatus && (
          <button
            onClick={handleAdvance}
            disabled={updating}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-opacity"
            style={{
              backgroundColor: STATUS_STYLE[nextStatus]?.bg ?? '#F1F5F9',
              color: STATUS_STYLE[nextStatus]?.color ?? '#162252',
              border: `1.5px solid ${STATUS_STYLE[nextStatus]?.border ?? '#E5E7EB'}`,
              opacity: updating ? 0.6 : 1,
            }}
          >
            {updating ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <>
                <ArrowRight size={15} />
                {STATUS_LABEL[row.estado]}
              </>
            )}
          </button>
        )}

        {/* Completado — no further action */}
        {isGerencia && row.estado === 'Completado' && (
          <div className="flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold" style={{ color: '#16A34A' }}>
            <CheckCircle2 size={14} />
            Pedido completado
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## `src/pages/DVIRPage.tsx`

```typescript
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { DVIRCheck, CheckStatus } from '../types/dvir';
import { DVIR_SYSTEMS } from '../data/dvir-systems';
import { useEquipmentList } from '../hooks/useEquipmentList';
import { generateOTId } from '../lib/ot-generator';
import { mexicoDateInput, mexicoTimeInput, mexicoDateCompact, mexicoTimeCompact } from '../lib/date-utils';
import { appendRow, SHEET_TABS } from '../lib/sheets-api';
import { tryUploadPhotos } from '../lib/photo-upload-safe';
import { useAuthStore } from '../stores/auth-store';
import SystemCheckRow from '../components/dvir/SystemCheckRow';
import DVIRResultBanner from '../components/dvir/DVIRResultBanner';
import ConfirmModal from '../components/ui/ConfirmModal';
import SuccessToast from '../components/ui/SuccessToast';

interface PhotoItem {
  file: File;
  preview: string;
}

interface CheckState extends DVIRCheck {
  photos: PhotoItem[];
}

function buildInitialChecks(): CheckState[] {
  return DVIR_SYSTEMS.map((sys) => ({
    system_id: sys.id,
    status: null,
    notes: '',
    photos: [],
  }));
}

export default function DVIRPage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);
  const equipment = useEquipmentList();
  const [fecha, setFecha] = useState(mexicoDateInput());
  const [hora, setHora] = useState(mexicoTimeInput());
  const [unit_id, setUnitId] = useState('');
  const [type, setType] = useState<'pre-operacion' | 'post-operacion'>('pre-operacion');
  const [horometro, setHorometro] = useState('');
  const [checks, setChecks] = useState<CheckState[]>(buildInitialChecks);
  const [observations, setObservations] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const allChecked = checks.every((c) => c.status !== null);
  const canSubmit = allChecked && unit_id !== '';

  function updateCheck(index: number, status: CheckStatus) {
    setChecks((prev) =>
      prev.map((c, i) => (i === index ? { ...c, status } : c))
    );
  }

  function updateNotes(index: number, notes: string) {
    setChecks((prev) =>
      prev.map((c, i) => (i === index ? { ...c, notes } : c))
    );
  }

  const handlePhotoCapture = useCallback((index: number, file: File) => {
    const preview = URL.createObjectURL(file);
    setChecks((prev) =>
      prev.map((c, i) =>
        i === index ? { ...c, photos: [{ file, preview }] } : c
      )
    );
  }, []);

  const handlePhotoRemove = useCallback((checkIndex: number, photoIndex: number) => {
    setChecks((prev) =>
      prev.map((c, i) => {
        if (i !== checkIndex) return c;
        const updated = [...c.photos];
        const removed = updated.splice(photoIndex, 1);
        if (removed[0]) URL.revokeObjectURL(removed[0].preview);
        return { ...c, photos: updated };
      })
    );
  }, []);

  function handleSubmitIntent() {
    if (!canSubmit) return;
    setShowConfirm(true);
  }

  async function handleConfirm() {
    setShowConfirm(false);

    const fallaCount = checks.filter((c) => c.status === 'falla').length;
    const alertaCount = checks.filter((c) => c.status === 'alerta').length;
    const okCount = checks.filter((c) => c.status === 'ok').length;

    let result: string;
    if (fallaCount > 0) result = 'reprobado';
    else if (alertaCount > 0) result = 'condicional';
    else result = 'aprobado';

    let otId: string | null = null;
    if (fallaCount > 0) {
      otId = generateOTId();
    }

    const now = new Date();
    const date = fecha.split('-').reverse().join('/');      // dd/MM/yyyy
    const time = hora.length === 5 ? hora + ':00' : hora;  // HH:mm:ss
    const inspId = `INS-${mexicoDateCompact(now)}-${mexicoTimeCompact(now)}`;
    const selectedEquipment = equipment.find((eq) => eq.unit_id === unit_id);
    const modelo = selectedEquipment?.model ?? '';

    const allPhotos = checks.flatMap((c) => c.photos.map((p) => p.file));
    const photoUrls = await tryUploadPhotos(allPhotos, 'dvir-photos');
    const photoUrlStr = photoUrls.join(', ');

    try {
      await appendRow(SHEET_TABS.INSPECCIONES, [
        '',                                    // # (auto-number)
        inspId,                                // INSP_ID
        date,                                  // FECHA
        time,                                  // HORA
        unit_id,                               // CÓDIGO UNIDAD
        modelo,                                // MODELO
        userName,                              // OPERADOR
        type,                                  // TIPO
        String(horometro),                     // HORÓMETRO
        ...checks.map((c) => c.status || 'N/A'), // MOTOR through TREN RODAJE (12 cols)
        `${okCount}/12`,                       // SCORE TOTAL
        result,                                // RESULTADO
        observations,                          // DEFECTOS ENCONTRADOS
        photoUrlStr,                           // FOTO_URL
        otId || '',                            // ACCIÓN REQUERIDA
        otId ? 'Pendiente' : '',               // ESTADO ACCIÓN
        userName,                              // FIRMA_OPERADOR
      ]);
    } catch (err) {
      console.error('Sheets append failed (DVIR):', err);
    }

    if (otId) {
      setToastMessage(`Inspección registrada — OT ${otId} generada`);
    } else {
      setToastMessage(`Inspección registrada — Score: ${okCount}/12`);
    }

    setToastVisible(true);
  }

  function handleToastDismiss() {
    setToastVisible(false);
    navigate(-1);
  }

  return (
    <div className="flex flex-col pb-4 animate-fade-up">
      <SuccessToast
        message={toastMessage}
        visible={toastVisible}
        onDismiss={handleToastDismiss}
      />

      <ConfirmModal
        open={showConfirm}
        title="Confirmar inspección"
        message={`¿Confirmar inspección de ${unit_id || 'la unidad'}?`}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <h1 className="text-xl font-bold text-text">Checklist</h1>
      </div>

      {/* Unit & type card */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border mb-4 flex flex-col gap-3">
        {/* Fecha / Hora */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-secondary">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-xl border border-border p-3 text-text bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-secondary">Hora</label>
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="w-full rounded-xl border border-border p-3 text-text bg-white"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Unidad</label>
          <select
            value={unit_id}
            onChange={(e) => setUnitId(e.target.value)}
            className="w-full rounded-xl border border-border p-3 bg-white text-text"
          >
            <option value="">Seleccionar unidad...</option>
            {equipment.map((eq) => (
              <option key={eq.unit_id} value={eq.unit_id}>
                {eq.unit_id} — {eq.model}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Tipo</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType('pre-operacion')}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
                type === 'pre-operacion'
                  ? 'bg-amber text-white'
                  : 'bg-gray-100 text-text-secondary'
              }`}
            >
              Pre-Operación
            </button>
            <button
              type="button"
              onClick={() => setType('post-operacion')}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
                type === 'post-operacion'
                  ? 'bg-amber text-white'
                  : 'bg-gray-100 text-text-secondary'
              }`}
            >
              Post-Operación
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Horómetro actual</label>
          <input
            type="number"
            value={horometro}
            onChange={(e) => setHorometro(e.target.value)}
            placeholder="Ej: 3240"
            className="w-full rounded-xl border border-border p-3 bg-white text-text"
          />
        </div>
      </div>

      {/* Systems */}
      <div className="flex flex-col">
        {DVIR_SYSTEMS.map((system, index) => (
          <SystemCheckRow
            key={system.id}
            system={system}
            value={checks[index].status}
            onChange={(status) => updateCheck(index, status)}
            photos={checks[index].photos}
            onPhotoCapture={(file) => handlePhotoCapture(index, file)}
            onPhotoRemove={(photoIndex) => handlePhotoRemove(index, photoIndex)}
            notes={checks[index].notes ?? ''}
            onNotesChange={(notes) => updateNotes(index, notes)}
          />
        ))}
      </div>

      {/* Observations */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border mt-2">
        <label className="text-sm font-medium text-text-secondary block mb-2">
          Observaciones generales
        </label>
        <textarea
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          placeholder="Observaciones adicionales..."
          rows={3}
          className="w-full rounded-xl border border-border p-3 text-sm text-text resize-none bg-white"
        />
      </div>

      {/* Result banner */}
      <DVIRResultBanner checks={checks} />

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmitIntent}
        disabled={!canSubmit}
        className="mt-4 w-full bg-amber text-white rounded-xl py-4 font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity btn-press"
        style={{ minHeight: 52 }}
      >
        Enviar Inspección
      </button>
    </div>
  );
}
```

---

## `src/pages/FallaPage.tsx`

```typescript
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useEquipmentList } from '../hooks/useEquipmentList';
import { generateOTId } from '../lib/ot-generator';
import { calculatePriority } from '../lib/priority-calculator';
import { mexicoDate, mexicoTime } from '../lib/date-utils';
import { appendRow, SHEET_TABS } from '../lib/sheets-api';
import { tryUploadPhotos } from '../lib/photo-upload-safe';
import { useAuthStore } from '../stores/auth-store';
import AutoPriorityIndicator from '../components/falla/AutoPriorityIndicator';
import PhotoCapture from '../components/ui/PhotoCapture';
import ConfirmModal from '../components/ui/ConfirmModal';
import SuccessToast from '../components/ui/SuccessToast';

const TIPO_FALLA_OPTIONS = [
  'Mecánica',
  'Hidráulica',
  'Eléctrica',
  'Motor',
  'Transmisión',
  'Neumáticos',
  'Estructura',
  'Otra',
];

const DOWNTIME_OPTIONS = ['<1 hora', '1-4 horas', '4-8 horas', '>8 horas'];

interface PhotoItem {
  file: File;
  preview: string;
}

export default function FallaPage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);
  const equipment = useEquipmentList();

  const [unidad, setUnidad] = useState('');
  const [tipoFalla, setTipoFalla] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [puedeMoverse, setPuedeMoverse] = useState<boolean | null>(null);
  const [clienteAfectado, setClienteAfectado] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [downtime, setDowntime] = useState('');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const mobilitySelected = puedeMoverse !== null;

  const priority = mobilitySelected
    ? calculatePriority({
        puede_moverse: puedeMoverse!,
        cliente_afectado: clienteAfectado,
        tipo_falla: tipoFalla,
      })
    : null;

  const canSubmit =
    unidad !== '' && tipoFalla !== '' && descripcion.trim() !== '' && puedeMoverse !== null;

  const handlePhotoCapture = useCallback((file: File) => {
    const preview = URL.createObjectURL(file);
    setPhotos((prev) => [...prev, { file, preview }]);
  }, []);

  const handlePhotoRemove = useCallback((index: number) => {
    setPhotos((prev) => {
      const updated = [...prev];
      const removed = updated.splice(index, 1);
      if (removed[0]) URL.revokeObjectURL(removed[0].preview);
      return updated;
    });
  }, []);

  function handleSubmitIntent() {
    if (!canSubmit) return;
    setShowConfirm(true);
  }

  async function handleConfirm() {
    setShowConfirm(false);
    const otId = generateOTId();
    const priorityValue = priority ?? 'media';

    // Upload photos to Supabase; embed URLs in Observaciones
    const photoUrls = photos.length > 0
      ? await tryUploadPhotos(photos.map((p) => p.file), 'falla-photos')
      : [];
    const obsBase = `Ubicación: ${ubicacion}. Cliente: ${clienteAfectado}. Puede moverse: ${puedeMoverse ? 'Sí' : 'No'}`;
    const observaciones = photoUrls.length > 0
      ? `${obsBase} | Fotos: ${photoUrls.join(', ')}`
      : obsBase;

    try {
      await appendRow(SHEET_TABS.AVERIAS, [
        mexicoDate(),      // FECHA
        mexicoTime(),      // HORA
        unidad,            // UNIDAD
        tipoFalla,         // TIPO AVERÍA
        descripcion,       // DESCRIPCIÓN
        priorityValue,     // SEVERIDAD
        userName,          // TÉCNICO
        downtime,          // TIEMPO PARO (hrs)
        '',                // COSTO ESTIMADO
        'Abierta',         // ESTADO
        '',                // SOLUCIÓN
        observaciones,     // OBSERVACIONES (includes photo URLs when present)
        '',                // PROVEEDOR PIEZA
        otId,              // OT_ID (cross-reference for auto-sync)
      ]);
    } catch (err) {
      console.error('Sheets append failed (Averias):', err);
    }

    try {
      await appendRow(SHEET_TABS.ORDENES_TRABAJO, [
        String(Date.now()),
        otId,
        mexicoDate(),
        unidad,
        tipoFalla,
        descripcion,
        priorityValue,
        priorityValue,
        '',
        'Abierta',
        '',
        '',
        '',
        '',
        '',
      ]);
    } catch (err) {
      console.error('Sheets append failed (OT):', err);
    }

    setToastMessage(`${otId} creada — Jefe de Taller notificado`);
    setToastVisible(true);
  }

  function handleToastDismiss() {
    setToastVisible(false);
    navigate(-1);
  }

  return (
    <div className="flex flex-col pb-4 animate-fade-up">
      <SuccessToast
        message={toastMessage}
        visible={toastVisible}
        onDismiss={handleToastDismiss}
      />

      <ConfirmModal
        open={showConfirm}
        title="Confirmar reporte de falla"
        message={`¿Enviar reporte de falla para ${unidad || 'la unidad'}?`}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <h1 className="text-xl font-bold text-text">Reportar Falla</h1>
      </div>

      {/* Form card */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border flex flex-col gap-4">
        {/* Unidad */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Unidad</label>
          <select
            value={unidad}
            onChange={(e) => setUnidad(e.target.value)}
            className="w-full rounded-xl border border-border p-3 bg-white text-text"
          >
            <option value="">Seleccionar unidad...</option>
            {equipment.map((eq) => (
              <option key={eq.unit_id} value={eq.unit_id}>
                {eq.unit_id} — {eq.model}
              </option>
            ))}
          </select>
        </div>

        {/* Tipo de falla */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Tipo de Falla</label>
          <select
            value={tipoFalla}
            onChange={(e) => setTipoFalla(e.target.value)}
            className="w-full rounded-xl border border-border p-3 bg-white text-text"
          >
            <option value="">Seleccionar tipo...</option>
            {TIPO_FALLA_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Descripción */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Descripción</label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Describe los síntomas observados..."
            rows={4}
            className="w-full rounded-xl border border-border p-3 text-sm text-text resize-none bg-white"
          />
        </div>

        {/* Puede moverse */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text-secondary">¿Puede moverse?</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPuedeMoverse(true)}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
                puedeMoverse === true
                  ? 'bg-amber text-white'
                  : 'bg-gray-100 text-text-secondary'
              }`}
            >
              Sí
            </button>
            <button
              type="button"
              onClick={() => setPuedeMoverse(false)}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
                puedeMoverse === false
                  ? 'bg-amber text-white'
                  : 'bg-gray-100 text-text-secondary'
              }`}
            >
              No
            </button>
          </div>

          {priority !== null && (
            <AutoPriorityIndicator priority={priority} />
          )}
        </div>

        {/* Cliente afectado */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Cliente afectado</label>
          <input
            type="text"
            value={clienteAfectado}
            onChange={(e) => setClienteAfectado(e.target.value)}
            placeholder="Nombre del cliente afectado"
            className="w-full rounded-xl border border-border p-3 text-sm text-text bg-white"
          />
        </div>

        {/* Ubicación */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Ubicación</label>
          <input
            type="text"
            value={ubicacion}
            onChange={(e) => setUbicacion(e.target.value)}
            placeholder="Frente 3, km 4.5"
            className="w-full rounded-xl border border-border p-3 text-sm text-text bg-white"
          />
        </div>

        {/* Downtime estimado */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Downtime estimado</label>
          <select
            value={downtime}
            onChange={(e) => setDowntime(e.target.value)}
            className="w-full rounded-xl border border-border p-3 bg-white text-text"
          >
            <option value="">Seleccionar...</option>
            {DOWNTIME_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Fotos */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Fotos</label>
          <PhotoCapture
            photos={photos}
            onCapture={handlePhotoCapture}
            onRemove={handlePhotoRemove}
            multiple={true}
          />
        </div>
      </div>

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmitIntent}
        disabled={!canSubmit}
        className="mt-4 w-full bg-amber text-white rounded-xl py-4 font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity btn-press"
        style={{ minHeight: 52 }}
      >
        Enviar Reporte
      </button>
    </div>
  );
}
```

---

## `src/pages/DieselPage.tsx`

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { useEquipmentList } from '../hooks/useEquipmentList';
import { isAnomalous } from '../data/fuel-benchmarks';
import { mexicoDateInput, mexicoTimeInput } from '../lib/date-utils';
import { appendRow, SHEET_TABS } from '../lib/sheets-api';
import { useAuthStore } from '../stores/auth-store';
import ConfirmModal from '../components/ui/ConfirmModal';
import SuccessToast from '../components/ui/SuccessToast';

type FuelType = 'Urea' | 'Diesel' | 'Gasolina';

const FUEL_TYPES: FuelType[] = ['Urea', 'Diesel', 'Gasolina'];

export default function DieselPage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);
  const equipment = useEquipmentList();

  const [fecha, setFecha] = useState(mexicoDateInput());
  const [hora, setHora] = useState(mexicoTimeInput());
  const [unidad, setUnidad] = useState('');
  const [fuelType, setFuelType] = useState<FuelType>('Urea');
  const [litros, setLitros] = useState('');
  const [costo, setCosto] = useState('');
  const [horometro, setHorometro] = useState('');
  const [kmActual, setKmActual] = useState('');
  const [estacion, setEstacion] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [anomalyWarning, setAnomalyWarning] = useState(false);

  const selectedEquipment = equipment.find((eq) => eq.unit_id === unidad);
  const isTruck = selectedEquipment?.type === 'Camión Pesado';

  const canSubmit = unidad !== '' && litros !== '' && horometro !== '';

  function handleSubmitIntent() {
    if (!canSubmit) return;

    if (selectedEquipment && litros) {
      const consumption = parseFloat(litros);
      const anomalous = isAnomalous(selectedEquipment.model, consumption);
      setAnomalyWarning(anomalous);
    }

    setShowConfirm(true);
  }

  async function handleConfirm() {
    setShowConfirm(false);

    const litrosNum = parseFloat(litros) || 0;
    const costoNum = parseFloat(costo) || 0;
    const horometroNum = parseFloat(horometro) || 0;
    const kmNum = parseFloat(kmActual) || 0;
    // Rendimiento requires horómetro delta which is calculated in the sheet
    const rendimiento = '';

    try {
      await appendRow(SHEET_TABS.COMBUSTIBLE, [
        String(Date.now()),
        fecha.split('-').reverse().join('/'),      // dd/MM/yyyy
        hora.length === 5 ? hora + ':00' : hora,   // HH:mm:ss
        unidad,
        userName,
        fuelType,
        String(litrosNum),
        String(costoNum),
        String(horometroNum),
        String(kmNum),
        String(rendimiento),
        estacion,
        observaciones,
      ]);
    } catch (err) {
      console.error('Sheets append failed (Combustible):', err);
    }

    setToastMessage('Combustible registrado ✓');
    setToastVisible(true);
  }

  function handleToastDismiss() {
    setToastVisible(false);
    navigate(-1);
  }

  return (
    <div className="flex flex-col pb-4 animate-fade-up">
      <SuccessToast
        message={toastMessage}
        visible={toastVisible}
        onDismiss={handleToastDismiss}
      />

      <ConfirmModal
        open={showConfirm}
        title="Confirmar registro de combustible"
        message={`¿Registrar ${litros}L de ${fuelType} para ${unidad || 'la unidad'}?`}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <h1 className="text-xl font-bold text-text">Registro Diesel</h1>
      </div>

      {/* Anomaly warning */}
      {anomalyWarning && (
        <div className="bg-amber-50 border border-amber rounded-xl p-3 flex items-center gap-2 mb-4">
          <AlertTriangle size={18} className="text-amber shrink-0" />
          <span className="text-sm font-medium text-amber">
            Consumo anómalo detectado — más del 30% sobre el benchmark
          </span>
        </div>
      )}

      {/* Form card */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border flex flex-col gap-4">
        {/* Fecha / Hora */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-secondary">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-xl border border-border p-3 text-text bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-secondary">Hora</label>
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="w-full rounded-xl border border-border p-3 text-text bg-white"
            />
          </div>
        </div>

        {/* Unidad */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Unidad</label>
          <select
            value={unidad}
            onChange={(e) => { setUnidad(e.target.value); setAnomalyWarning(false); }}
            className="w-full rounded-xl border border-border p-3 bg-white text-text"
          >
            <option value="">Seleccionar unidad...</option>
            {equipment.map((eq) => (
              <option key={eq.unit_id} value={eq.unit_id}>
                {eq.unit_id} — {eq.model}
              </option>
            ))}
          </select>
        </div>

        {/* Tipo combustible */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Tipo Combustible</label>
          <div className="flex gap-2">
            {FUEL_TYPES.map((ft) => (
              <button
                key={ft}
                type="button"
                onClick={() => setFuelType(ft)}
                className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
                  fuelType === ft
                    ? 'bg-amber text-white'
                    : 'bg-gray-100 text-text-secondary'
                }`}
              >
                {ft}
              </button>
            ))}
          </div>
        </div>

        {/* Litros */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Litros</label>
          <input
            type="number"
            value={litros}
            onChange={(e) => setLitros(e.target.value)}
            placeholder="0"
            className="w-full rounded-xl border border-border p-4 text-3xl font-semibold text-text bg-white text-center"
          />
        </div>

        {/* Costo */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Costo $ (opcional)</label>
          <input
            type="number"
            value={costo}
            onChange={(e) => setCosto(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-xl border border-border p-3 text-text bg-white"
          />
        </div>

        {/* Horómetro actual */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Horómetro actual</label>
          <input
            type="number"
            value={horometro}
            onChange={(e) => setHorometro(e.target.value)}
            placeholder="Ej: 8450"
            className="w-full rounded-xl border border-border p-3 text-text bg-white"
          />
        </div>

        {/* KM actual — trucks only */}
        {isTruck && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-secondary">KM actual</label>
            <input
              type="number"
              value={kmActual}
              onChange={(e) => setKmActual(e.target.value)}
              placeholder="Ej: 125400"
              className="w-full rounded-xl border border-border p-3 text-text bg-white"
            />
          </div>
        )}

        {/* Estación */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Estación</label>
          <input
            type="text"
            value={estacion}
            onChange={(e) => setEstacion(e.target.value)}
            placeholder="PEMEX Km 12"
            className="w-full rounded-xl border border-border p-3 text-text bg-white"
          />
        </div>

        {/* Observaciones */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Observaciones</label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Observaciones adicionales..."
            rows={3}
            className="w-full rounded-xl border border-border p-3 text-sm text-text resize-none bg-white"
          />
        </div>
      </div>

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmitIntent}
        disabled={!canSubmit}
        className="mt-4 w-full bg-amber text-white rounded-xl py-4 font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity btn-press"
        style={{ minHeight: 52 }}
      >
        Registrar Combustible
      </button>
    </div>
  );
}
```

---

## `src/pages/HorometroPage.tsx`

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock } from 'lucide-react';
import { useEquipmentList } from '../hooks/useEquipmentList';
import { getNextPM } from '../data/pm-rules';
import { mexicoDate, mexicoTime } from '../lib/date-utils';
import { appendRow, SHEET_TABS } from '../lib/sheets-api';
import { useAuthStore } from '../stores/auth-store';
import ConfirmModal from '../components/ui/ConfirmModal';
import SuccessToast from '../components/ui/SuccessToast';

type TurnoType = 'inicio' | 'final';

export default function HorometroPage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);
  const equipment = useEquipmentList();

  const [turno, setTurno] = useState<TurnoType>('inicio');
  const [unidad, setUnidad] = useState('');
  const [horometro, setHorometro] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const selectedEquipment = equipment.find((eq) => eq.unit_id === unidad);
  const horasActual = horometro ? parseFloat(horometro) : null;

  const pmInfo =
    selectedEquipment && horasActual !== null
      ? getNextPM(selectedEquipment.model, horasActual)
      : null;

  const prevPMLevel = pmInfo
    ? `PM-${Math.max(1, parseInt(pmInfo.level.replace('PM-', ''), 10) - 1)}`
    : null;

  const prevPMHours = pmInfo && horasActual !== null ? horasActual - pmInfo.hours_remaining : null;

  function getPMColor(hoursRemaining: number): string {
    if (hoursRemaining <= 0) return 'text-critical';
    if (hoursRemaining <= 50) return 'text-amber';
    return 'text-success';
  }

  function getPMBgColor(hoursRemaining: number): string {
    if (hoursRemaining <= 0) return 'bg-red-50 border-critical';
    if (hoursRemaining <= 50) return 'bg-amber-50 border-amber';
    return 'bg-green-50 border-success';
  }

  const canSubmit = unidad !== '' && horometro !== '';

  function handleSubmitIntent() {
    if (!canSubmit) return;
    setShowConfirm(true);
  }

  async function handleConfirm() {
    setShowConfirm(false);

    try {
      await appendRow(SHEET_TABS.HOROMETROS, [
        mexicoDate(),          // FECHA
        mexicoTime(),          // HORA
        unidad,                                   // UNIDAD
        selectedEquipment?.model || '',           // MODELO
        userName,                                 // OPERADOR
        turno,                                    // TURNO (inicio/final)
        String(horometro),                        // HORÓMETRO
        pmInfo ? pmInfo.level : '',               // PRÓXIMO PM
        pmInfo ? String(pmInfo.hours_remaining) : '', // FALTAN
      ]);
    } catch (err) {
      console.error('Sheets append failed (Horometros):', err);
    }

    const label = turno === 'inicio' ? 'Inicio' : 'Final';
    setToastMessage(`Horómetro ${label} de Turno registrado ✓`);
    setToastVisible(true);
  }

  function handleToastDismiss() {
    setToastVisible(false);
    navigate(-1);
  }

  return (
    <div className="flex flex-col pb-4 animate-fade-up">
      <SuccessToast
        message={toastMessage}
        visible={toastVisible}
        onDismiss={handleToastDismiss}
      />

      <ConfirmModal
        open={showConfirm}
        title="Confirmar horómetro"
        message={`¿Registrar horómetro ${turno === 'inicio' ? 'inicio' : 'final'} de turno para ${unidad || 'la unidad'}?`}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <h1 className="text-xl font-bold text-text">Registro Horómetro</h1>
      </div>

      {/* Turno toggle */}
      <div className="bg-white rounded-xl p-3 shadow-sm border border-border mb-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTurno('inicio')}
            className={`flex-1 rounded-xl py-3 text-sm font-semibold transition-colors ${
              turno === 'inicio'
                ? 'bg-amber text-white'
                : 'bg-gray-100 text-text-secondary'
            }`}
          >
            Inicio de Turno
          </button>
          <button
            type="button"
            onClick={() => setTurno('final')}
            className={`flex-1 rounded-xl py-3 text-sm font-semibold transition-colors ${
              turno === 'final'
                ? 'bg-amber text-white'
                : 'bg-gray-100 text-text-secondary'
            }`}
          >
            Final de Turno
          </button>
        </div>
      </div>

      {/* Unit selector */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border mb-4">
        <label className="text-sm font-medium text-text-secondary block mb-2">Unidad</label>
        <select
          value={unidad}
          onChange={(e) => setUnidad(e.target.value)}
          className="w-full rounded-xl border border-border p-4 bg-white text-text text-lg font-semibold"
        >
          <option value="">Seleccionar unidad...</option>
          {equipment.map((eq) => (
            <option key={eq.unit_id} value={eq.unit_id}>
              {eq.unit_id} — {eq.model}
            </option>
          ))}
        </select>
      </div>

      {/* Horómetro large input */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border mb-4">
        <label className="text-sm font-medium text-text-secondary block mb-2">Horómetro</label>
        <input
          type="number"
          value={horometro}
          onChange={(e) => setHorometro(e.target.value)}
          placeholder="12,500"
          className="w-full rounded-xl border border-border p-4 text-4xl font-mono font-semibold text-text bg-white text-center tracking-wider"
        />
        <p className="text-xs text-text-secondary text-center mt-2">horas</p>
      </div>

      {/* PM proximity card */}
      {pmInfo && horasActual !== null && (
        <div className={`rounded-xl p-4 border mb-4 ${getPMBgColor(pmInfo.hours_remaining)}`}>
          <div className="flex items-center gap-2 mb-3">
            <Clock size={18} className={getPMColor(pmInfo.hours_remaining)} />
            <span className="font-semibold text-text">Proximidad de PM</span>
          </div>

          {prevPMLevel && prevPMHours !== null && (
            <p className="text-sm text-text-secondary mb-1">
              Último PM: {prevPMLevel} completado
            </p>
          )}

          <p className={`text-sm font-medium ${getPMColor(pmInfo.hours_remaining)}`}>
            Próximo PM: {pmInfo.level} a {pmInfo.due_at.toLocaleString()} hrs
          </p>

          <p className={`text-base font-bold mt-1 ${getPMColor(pmInfo.hours_remaining)}`}>
            {pmInfo.hours_remaining <= 0
              ? `VENCIDO ${Math.abs(pmInfo.hours_remaining)} hrs`
              : `Faltan ${pmInfo.hours_remaining} hrs`}
          </p>
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmitIntent}
        disabled={!canSubmit}
        className="mt-2 w-full bg-amber text-white rounded-xl py-4 font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity btn-press"
        style={{ minHeight: 52 }}
      >
        Registrar Horómetro
      </button>
    </div>
  );
}
```

---

## `src/pages/WorkOrdersPage.tsx`

```typescript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkOrderStore } from '../stores/workorder-store';
import OTCard from '../components/ui/OTCard';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonList } from '../components/ui/Skeleton';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import PullIndicator from '../components/ui/PullIndicator';

type FilterKey = 'Todas' | 'CRITICA' | 'ALTA' | 'MEDIA' | 'Abierta' | 'En Reparación' | 'Esperando Pieza' | 'Resuelta';

const FILTER_OPTIONS: FilterKey[] = ['Todas', 'CRITICA', 'ALTA', 'MEDIA', 'Abierta', 'En Reparación', 'Esperando Pieza', 'Resuelta'];

const FILTER_LABELS: Record<FilterKey, string> = {
  Todas: 'Todas',
  CRITICA: 'Critica',
  ALTA: 'Alta',
  MEDIA: 'Media',
  Abierta: 'Abierta',
  'En Reparación': 'En Reparación',
  'Esperando Pieza': 'Esperando Pieza',
  Resuelta: 'Resuelta',
};

export default function WorkOrdersPage() {
  const navigate = useNavigate();
  const { workorders, loading, error, fetched, fetchWorkOrders } = useWorkOrderStore();
  const [filter, setFilter] = useState<FilterKey>('Todas');

  const { scrollRef, onTouchStart, onTouchMove, onTouchEnd, pullDistance, refreshing, pullIndicatorStyle, isReady } =
    usePullToRefresh({ onRefresh: fetchWorkOrders });

  useEffect(() => {
    if (!fetched) {
      fetchWorkOrders();
    }
  }, [fetched, fetchWorkOrders]);

  // Never show completed OTs in the app — they stay in the sheet only
  const active = workorders.filter((ot) => ot.estado !== 'Completado');
  const filtered = filter === 'Todas'
    ? active
    : active.filter((ot) =>
        ot.prioridad === filter || ot.prioridad?.toUpperCase() === filter || ot.estado === filter
      );

  if (loading && !fetched) {
    return (
      <div className="py-4">
        <h2 className="font-semibold text-lg text-text mb-3">Órdenes de Trabajo</h2>
        <SkeletonList count={4} />
      </div>
    );
  }

  if (error && workorders.length === 0) {
    return (
      <div className="py-4">
        <h2 className="font-semibold text-lg text-text mb-3">Ordenes de Trabajo</h2>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-border text-center">
          <p className="text-red-600 text-sm mb-2">Error al cargar ordenes</p>
          <p className="text-xs text-text-secondary mb-3">{error}</p>
          <button
            type="button"
            onClick={() => fetchWorkOrders()}
            className="px-4 py-2 bg-amber text-white rounded-xl text-sm font-medium"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="py-4 animate-fade-up overflow-y-auto"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <PullIndicator
        pullDistance={pullDistance}
        refreshing={refreshing}
        isReady={isReady}
        style={pullIndicatorStyle}
      />

      <h2 className="font-semibold text-lg text-text mb-3">Órdenes de Trabajo</h2>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1 mb-2">
        {FILTER_OPTIONS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap shrink-0 transition-colors ${
              filter === key
                ? 'bg-amber text-white'
                : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
            }`}
          >
            {FILTER_LABELS[key]}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          type="workorders"
          title="Sin órdenes"
          description="No hay órdenes de trabajo con este filtro"
        />
      ) : (
        filtered.map((ot) => (
          <OTCard
            key={ot.ot_id}
            workorder={ot}
            onClick={() => navigate(`/workorders/${ot.ot_id}`)}
          />
        ))
      )}
    </div>
  );
}
```

---

## `src/pages/WorkOrderDetailPage.tsx`

```typescript
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Wrench, ChevronRight } from 'lucide-react';
import { useWorkOrderStore } from '../stores/workorder-store';
import { useAuthStore } from '../stores/auth-store';
import { useEquipmentById } from '../hooks/useEquipmentList';
import { PRIORITY_CONFIG, ESTADO_CONFIG, OT_STATUS_FLOW, getNextStatuses } from '../types/workorder';
import type { OTEstado, OTStatusField, StatusLogEntry } from '../types/workorder';

const FIELD_LABELS: Record<OTStatusField, string> = {
  estado: 'Estado',
  mecanico_asignado: 'Mecánico',
  progreso: 'Progreso',
  observaciones: 'Observaciones',
  costo_estimado: 'Costo estimado',
  prioridad: 'Prioridad',
};

function canEditField(_role: string | null, _field: OTStatusField): boolean {
  // All roles can edit all fields
  return true;
}

function StatusPillRow({ current }: { current: OTEstado }) {
  const allStatuses: OTEstado[] = ['Abierta', 'En Reparación', 'Esperando Pieza', 'Resuelta', 'Completado'];
  const currentIdx = allStatuses.indexOf(current);

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
      {allStatuses.map((s, idx) => {
        const isCurrent = s === current;
        const isPast = idx < currentIdx;
        const config = ESTADO_CONFIG[s];
        return (
          <span
            key={s}
            className="text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap shrink-0"
            style={{
              color: isCurrent ? '#fff' : isPast ? config.color : '#9CA3AF',
              backgroundColor: isCurrent ? config.color : isPast ? config.bg : '#F3F4F6',
            }}
          >
            {s}
          </span>
        );
      })}
    </div>
  );
}

function TimelineEntry({ entry }: { entry: StatusLogEntry }) {
  const label = FIELD_LABELS[entry.field] ?? entry.field;
  return (
    <div className="flex gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <div className="flex flex-col items-center shrink-0 pt-0.5">
        <div className="w-2 h-2 rounded-full bg-amber" />
        <div className="flex-1 w-px bg-gray-200 mt-1" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text">
          {label}: <span className="text-text-secondary">{entry.old_value || '(vacío)'}</span>
          {' '}<ChevronRight size={12} className="inline text-text-secondary" />{' '}
          <span className="text-amber font-semibold">{entry.new_value}</span>
        </p>
        <p className="text-xs text-text-secondary mt-0.5">
          {entry.changed_by} &middot; {entry.timestamp}
        </p>
      </div>
    </div>
  );
}

export default function WorkOrderDetailPage() {
  const { otId } = useParams<{ otId: string }>();
  const navigate = useNavigate();
  const { statusLog, loading, fetched, fetchWorkOrders, updateOTField, getWorkOrderById } = useWorkOrderStore();
  const role = useAuthStore((s) => s.role);
  const userName = useAuthStore((s) => s.userName);

  const [editEstado, setEditEstado] = useState('');
  const [editMecanico, setEditMecanico] = useState('');
  const [editCosto, setEditCosto] = useState('');
  const [editNotas, setEditNotas] = useState('');
  const [saving, setSaving] = useState<OTStatusField | null>(null);

  useEffect(() => {
    if (!fetched) {
      fetchWorkOrders();
    }
  }, [fetched, fetchWorkOrders]);

  const wo = otId ? getWorkOrderById(otId) : undefined;
  const equipment = useEquipmentById(wo?.unidad ?? '');

  // Initialize edit fields when workorder loads
  useEffect(() => {
    if (wo) {
      setEditEstado(wo.estado);
      setEditMecanico(wo.mecanico_asignado);
      setEditCosto(String(wo.costo_estimado || ''));
      setEditNotas(wo.observaciones);
    }
  }, [wo?.ot_id, wo?.estado, wo?.mecanico_asignado, wo?.costo_estimado, wo?.observaciones]);

  const otLog = statusLog
    .filter((e) => e.ot_id === otId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  async function handleSave(field: OTStatusField, value: string) {
    if (!otId || !wo) return;
    setSaving(field);
    await updateOTField(otId, field, value, userName, role ?? '');
    setSaving(null);
  }

  if (loading && !fetched) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber border-t-transparent" />
      </div>
    );
  }

  if (!wo) {
    return (
      <div className="py-4">
        <div className="flex items-center gap-3 mb-4">
          <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-xl bg-white border border-border shadow-sm">
            <ArrowLeft size={20} className="text-text" />
          </button>
          <h1 className="text-xl font-bold text-text">OT no encontrada</h1>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-border text-center">
          <p className="text-text-secondary">No se encontro la orden de trabajo {otId}</p>
        </div>
      </div>
    );
  }

  const prioKey = wo.prioridad?.toUpperCase() as keyof typeof PRIORITY_CONFIG;
  const priorityConfig = PRIORITY_CONFIG[prioKey] ?? { color: '#6B7280', bg: '#F3F4F6', label: wo.prioridad, time: '' };
  const canEdit = true; // All roles can edit
  const nextStatuses = getNextStatuses(OT_STATUS_FLOW.includes(wo.estado as OTEstado) ? wo.estado as OTEstado : 'Abierta');

  return (
    <div className="flex flex-col gap-4 pb-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-xl bg-white border border-border shadow-sm">
          <ArrowLeft size={20} className="text-text" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-text truncate">{wo.ot_id}</h1>
          <p className="text-xs text-text-secondary">{wo.fecha}</p>
        </div>
        {priorityConfig && (
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
            style={{ color: priorityConfig.color, backgroundColor: priorityConfig.bg }}
          >
            {priorityConfig.label}
          </span>
        )}
      </div>

      {/* Status flow */}
      <div className="bg-white rounded-xl p-3 shadow-sm border border-border">
        <StatusPillRow current={wo.estado} />
      </div>

      {/* Info card */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-text-secondary">Unidad</p>
            <p className="text-sm font-semibold text-text">{wo.unidad}</p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Modelo</p>
            <p className="text-sm font-semibold text-text">{equipment?.model ?? '-'}</p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Tipo</p>
            <p className="text-sm font-semibold text-text">{wo.tipo_averia}</p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Prioridad</p>
            <p className="text-sm font-semibold" style={{ color: priorityConfig?.color }}>
              {priorityConfig?.label ?? wo.prioridad}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Mecanico</p>
            <div className="flex items-center gap-1">
              <Wrench size={12} className="text-text-secondary" />
              <p className="text-sm font-semibold text-text">
                {wo.mecanico_asignado || 'Sin asignar'}
              </p>
            </div>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Progreso</p>
            <p className="text-sm font-semibold text-text">{wo.progreso}%</p>
          </div>
        </div>

        <div>
          <p className="text-xs text-text-secondary mb-1">Descripcion</p>
          <p className="text-sm text-text">{wo.descripcion}</p>
        </div>

        {wo.partes_necesarias && (
          <div>
            <p className="text-xs text-text-secondary mb-1">Partes necesarias</p>
            <p className="text-sm text-text">{wo.partes_necesarias}</p>
          </div>
        )}

        {wo.costo_estimado > 0 && (
          <div>
            <p className="text-xs text-text-secondary mb-1">Costo estimado</p>
            <p className="text-sm font-semibold text-text">${wo.costo_estimado.toLocaleString()}</p>
          </div>
        )}

        {wo.foto_url && (
          <div>
            <p className="text-xs text-text-secondary mb-1">Fotos</p>
            <div className="flex gap-2 overflow-x-auto">
              {wo.foto_url.split(',').filter(Boolean).map((url, i) => (
                <img
                  key={i}
                  src={url.trim()}
                  alt={`Foto ${i + 1}`}
                  className="w-20 h-20 rounded-lg object-cover border border-border"
                />
              ))}
            </div>
          </div>
        )}

        {wo.observaciones && (
          <div>
            <p className="text-xs text-text-secondary mb-1">Observaciones</p>
            <p className="text-sm text-text">{wo.observaciones}</p>
          </div>
        )}
      </div>

      {/* Edit panel */}
      {canEdit && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-border flex flex-col gap-4">
          <h3 className="text-sm font-bold text-text">Actualizar OT</h3>

          {/* Status */}
          {canEditField(role, 'estado') && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">Estado</label>
              <div className="flex gap-2">
                <select
                  value={editEstado}
                  onChange={(e) => setEditEstado(e.target.value)}
                  className="flex-1 rounded-xl border border-border p-2.5 text-sm bg-white text-text"
                >
                  {nextStatuses.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={editEstado === wo.estado || saving === 'estado'}
                  onClick={() => handleSave('estado', editEstado)}
                  className="px-4 py-2 bg-amber text-white rounded-xl text-sm font-medium disabled:opacity-40"
                >
                  {saving === 'estado' ? '...' : 'Guardar'}
                </button>
              </div>
            </div>
          )}

          {/* Mechanic */}
          {canEditField(role, 'mecanico_asignado') && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">Mecanico asignado</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editMecanico}
                  onChange={(e) => setEditMecanico(e.target.value)}
                  className="flex-1 rounded-xl border border-border p-2.5 text-sm bg-white text-text"
                  placeholder="Nombre del mecanico"
                />
                <button
                  type="button"
                  disabled={editMecanico === wo.mecanico_asignado || saving === 'mecanico_asignado'}
                  onClick={() => handleSave('mecanico_asignado', editMecanico)}
                  className="px-4 py-2 bg-amber text-white rounded-xl text-sm font-medium disabled:opacity-40"
                >
                  {saving === 'mecanico_asignado' ? '...' : 'Reasignar'}
                </button>
              </div>
            </div>
          )}

          {/* Progress */}
          {canEditField(role, 'progreso') && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">Progreso</label>
              <div className="flex gap-2">
                {[0, 25, 50, 75, 100].map((val) => (
                  <button
                    key={val}
                    type="button"
                    disabled={saving === 'progreso'}
                    onClick={() => handleSave('progreso', String(val))}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                      wo.progreso === val
                        ? 'bg-amber text-white'
                        : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
                    }`}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cost */}
          {canEditField(role, 'costo_estimado') && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">Costo estimado ($)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={editCosto}
                  onChange={(e) => setEditCosto(e.target.value)}
                  className="flex-1 rounded-xl border border-border p-2.5 text-sm bg-white text-text"
                  placeholder="0"
                />
                <button
                  type="button"
                  disabled={editCosto === String(wo.costo_estimado || '') || saving === 'costo_estimado'}
                  onClick={() => handleSave('costo_estimado', editCosto)}
                  className="px-4 py-2 bg-amber text-white rounded-xl text-sm font-medium disabled:opacity-40"
                >
                  {saving === 'costo_estimado' ? '...' : 'Guardar'}
                </button>
              </div>
            </div>
          )}

          {/* Notes */}
          {canEditField(role, 'observaciones') && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">Observaciones</label>
              <textarea
                value={editNotas}
                onChange={(e) => setEditNotas(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-border p-2.5 text-sm text-text resize-none bg-white"
                placeholder="Notas adicionales..."
              />
              <button
                type="button"
                disabled={editNotas === wo.observaciones || saving === 'observaciones'}
                onClick={() => handleSave('observaciones', editNotas)}
                className="w-full py-2.5 bg-amber text-white rounded-xl text-sm font-medium disabled:opacity-40"
              >
                {saving === 'observaciones' ? '...' : 'Guardar notas'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      {otLog.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-amber" />
            <h3 className="text-sm font-bold text-text">Historial</h3>
          </div>
          <div className="flex flex-col">
            {otLog.map((entry, i) => (
              <TimelineEntry key={`${entry.timestamp}-${i}`} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## `src/pages/PMSchedulePage.tsx`

```typescript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wrench, RefreshCw } from 'lucide-react';
import { useEquipmentList } from '../hooks/useEquipmentList';
import { getNextPM } from '../data/pm-rules';
import { readRange, SHEET_TABS } from '../lib/sheets-api';
import { SkeletonList } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';

interface PMEntry {
  unit_id: string;
  model: string;
  type: string;
  currentHours: number;
  pmLevel: string;
  dueAt: number;
  hoursRemaining: number;
  source: 'sheets' | 'catalog'; // where the horómetro came from
}

/**
 * Read the latest horómetro for each unit from Google Sheets.
 * Tab: 04B Registro Horómetros
 * Columns: FECHA, HORA, UNIDAD, MODELO, OPERADOR, TURNO, HORÓMETRO, ...
 */
async function fetchLatestHorometros(): Promise<Record<string, number>> {
  const rows = await readRange(SHEET_TABS.HOROMETROS);
  const latest: Record<string, { hours: number; date: string }> = {};

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const unidad = (row[2] ?? '').trim();   // UNIDAD column
    const fecha = (row[0] ?? '').trim();     // FECHA column
    const horoStr = (row[6] ?? '').trim();   // HORÓMETRO column
    const horo = parseFloat(horoStr);

    if (!unidad || isNaN(horo) || horo <= 0) continue;

    // Keep the most recent reading per unit
    const existing = latest[unidad];
    if (!existing || fecha >= existing.date || horo > existing.hours) {
      latest[unidad] = { hours: horo, date: fecha };
    }
  }

  const result: Record<string, number> = {};
  for (const [unit, data] of Object.entries(latest)) {
    result[unit] = data.hours;
  }
  return result;
}

function getBorderColor(hrs: number): string {
  if (hrs <= 0) return 'border-l-critical';
  if (hrs <= 50) return 'border-l-amber';
  return 'border-l-success';
}

function getStatusPill(hrs: number): { label: string; cls: string } {
  if (hrs <= 0) return { label: 'Vencido', cls: 'bg-red-100 text-critical' };
  return { label: 'Próximo', cls: 'bg-amber-100 text-amber' };
}

function getBarColor(hrs: number): string {
  if (hrs <= 0) return 'bg-critical';
  if (hrs <= 50) return 'bg-amber';
  return 'bg-success';
}

function getCountdownText(hrs: number): string {
  if (hrs <= 0) return `VENCIDO ${Math.abs(hrs)} hrs`;
  return `Faltan ${hrs} hrs`;
}

export default function PMSchedulePage() {
  const navigate = useNavigate();
  const equipment = useEquipmentList();
  const [entries, setEntries] = useState<PMEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadPMData() {
    setLoading(true);
    setError(null);

    try {
      // Try to get live horómetro data from Google Sheets
      let sheetHorometros: Record<string, number> = {};
      try {
        sheetHorometros = await fetchLatestHorometros();
      } catch {
        // If sheet read fails, we'll use catalog data as fallback
      }

      const pmEntries: PMEntry[] = equipment.map((eq) => {
        // Use sheet horómetro if available, otherwise catalog
        const hasSheetData = sheetHorometros[eq.unit_id] !== undefined;
        const currentHours = hasSheetData
          ? sheetHorometros[eq.unit_id]
          : eq.current_horometro;

        const pm = getNextPM(eq.model, currentHours);

        return {
          unit_id: eq.unit_id,
          model: eq.model,
          type: eq.type,
          currentHours,
          pmLevel: pm.level,
          dueAt: pm.due_at,
          hoursRemaining: pm.hours_remaining,
          source: (hasSheetData ? 'sheets' : 'catalog') as 'sheets' | 'catalog',
        };
      })
        // Only show units within less than 50 hours of a PM (or overdue)
        .filter((entry) => entry.hoursRemaining < 50)
        .sort((a, b) => a.hoursRemaining - b.hoursRemaining);

      setEntries(pmEntries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPMData();
  }, []);

  return (
    <div className="flex flex-col pb-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <h1 className="text-xl font-bold text-text">Programa de Mantenimiento</h1>
        <button
          type="button"
          onClick={loadPMData}
          disabled={loading}
          className="ml-auto p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <RefreshCw size={18} className={`text-text-secondary ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-xs text-blue-700">
        Mostrando equipos con PM a menos de 50 horas. Datos de horómetro desde Google Sheets.
      </div>

      {loading && <SkeletonList count={4} />}

      {error && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-border text-center">
          <p className="text-red-600 text-sm mb-2">Error al cargar</p>
          <p className="text-xs text-text-secondary mb-3">{error}</p>
          <button
            type="button"
            onClick={loadPMData}
            className="px-4 py-2 bg-amber text-white rounded-xl text-sm font-medium"
          >
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && entries.length === 0 && (
        <EmptyState
          type="workorders"
          title="Sin PMs próximos"
          description="Ningún equipo tiene mantenimiento preventivo a menos de 50 horas"
        />
      )}

      {/* PM cards */}
      {!loading && (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => {
            const pill = getStatusPill(entry.hoursRemaining);
            const progressPct = Math.max(
              0,
              Math.min(
                100,
                entry.hoursRemaining <= 0
                  ? 100
                  : Math.round(((entry.dueAt - entry.hoursRemaining) / entry.dueAt) * 100)
              )
            );

            return (
              <div
                key={entry.unit_id}
                className={`bg-white rounded-xl shadow-sm border border-border border-l-4 ${getBorderColor(entry.hoursRemaining)} p-4`}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-text">{entry.unit_id}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pill.cls}`}>
                        {pill.label}
                      </span>
                      {entry.source === 'sheets' && (
                        <span className="text-xs text-success font-medium">● Live</span>
                      )}
                    </div>
                    <p className="text-text-secondary text-xs mt-0.5">{entry.model}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5 text-text-secondary">
                    <Wrench size={14} />
                    <span className="text-sm font-semibold text-text">{entry.pmLevel}</span>
                  </div>
                </div>

                {/* PM target */}
                <p className="text-sm text-text-secondary mb-1">
                  a {entry.dueAt.toLocaleString()} hrs
                </p>

                {/* Current + countdown */}
                <div className="flex items-center justify-between text-sm mb-3">
                  <span className="text-text-secondary font-mono">
                    Actual: {entry.currentHours.toLocaleString()} hrs
                  </span>
                  <span
                    className={`font-bold ${
                      entry.hoursRemaining <= 0
                        ? 'text-critical'
                        : entry.hoursRemaining <= 50
                        ? 'text-amber'
                        : 'text-success'
                    }`}
                  >
                    {getCountdownText(entry.hoursRemaining)}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getBarColor(entry.hoursRemaining)} rounded-full transition-all`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

---

## `src/pages/PMWorkOrderPage.tsx`

```typescript
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wrench, Package, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { useEquipmentList } from '../hooks/useEquipmentList';
import { getNextPM } from '../data/pm-rules';
import { getCumulativePMParts, getAvailablePMLevels, type PMPart } from '../data/pm-parts-catalog';
import { generateOTId } from '../lib/ot-generator';
import { mexicoDate } from '../lib/date-utils';
import { appendRow, SHEET_TABS } from '../lib/sheets-api';
import { useAuthStore } from '../stores/auth-store';
import { printPMOrder } from '../lib/print-pm-order';
import ConfirmModal from '../components/ui/ConfirmModal';
import SuccessToast from '../components/ui/SuccessToast';

const CATEGORY_ICONS: Record<string, string> = {
  Filtro: '🔧',
  Aceite: '🛢️',
  Grasa: '🧴',
  Correa: '⛓️',
  Refrigerante: '❄️',
  Otro: '📦',
};

const CATEGORY_ORDER: string[] = ['Filtro', 'Aceite', 'Grasa', 'Correa', 'Refrigerante', 'Otro'];

function groupByCategory(parts: PMPart[]): Record<string, PMPart[]> {
  const groups: Record<string, PMPart[]> = {};
  for (const part of parts) {
    if (!groups[part.category]) groups[part.category] = [];
    groups[part.category].push(part);
  }
  return groups;
}

export default function PMWorkOrderPage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);
  const equipment = useEquipmentList();

  const [unidad, setUnidad] = useState('');
  const [pmLevel, setPmLevel] = useState('');
  const [mecanico, setMecanico] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [printData, setPrintData] = useState<Parameters<typeof printPMOrder>[0] | null>(null);

  const selectedEquipment = equipment.find((eq) => eq.unit_id === unidad);
  const model = selectedEquipment?.model ?? '';

  // Get PM proximity info for selected unit
  const pmInfo = useMemo(() => {
    if (!selectedEquipment) return null;
    return getNextPM(selectedEquipment.model, selectedEquipment.current_horometro);
  }, [selectedEquipment]);

  // Available PM levels for selected model
  const availableLevels = useMemo(() => getAvailablePMLevels(model), [model]);

  // Auto-suggest the recommended PM level when unit changes
  const suggestedLevel = pmInfo?.level ?? '';

  // Cumulative parts for selected level
  const partsKit = useMemo(() => {
    if (!model || !pmLevel) return null;
    return getCumulativePMParts(model, pmLevel);
  }, [model, pmLevel]);

  const groupedParts = useMemo(() => {
    if (!partsKit) return {};
    return groupByCategory(partsKit.parts);
  }, [partsKit]);

  const canSubmit = unidad !== '' && pmLevel !== '';

  function handleUnitChange(newUnit: string) {
    setUnidad(newUnit);
    setPmLevel('');
  }

  function handleLevelSelect(level: string) {
    setPmLevel(level);
  }

  function useSuggested() {
    if (suggestedLevel) setPmLevel(suggestedLevel);
  }

  function handleSubmitIntent() {
    if (!canSubmit) return;
    setShowConfirm(true);
  }

  async function handleConfirm() {
    setShowConfirm(false);

    const otId = generateOTId();
    const date = mexicoDate();
    const partsListStr = partsKit
      ? partsKit.parts.map((p) => `${p.partNumber} x${p.quantity}`).join(', ')
      : '';
    const levelsStr = partsKit ? partsKit.levelsIncluded.join('+') : pmLevel;

    // Write to Ordenes Mantenimiento tab
    try {
      await appendRow(SHEET_TABS.ORDENES_MANTENIMIENTO, [
        otId,                              // OT_ID
        date,                              // FECHA
        unidad,                            // UNIDAD
        model,                             // MODELO
        pmLevel,                           // NIVEL PM
        levelsStr,                         // NIVELES INCLUIDOS
        String(selectedEquipment?.current_horometro ?? ''), // HORÓMETRO
        `Mantenimiento Preventivo ${pmLevel}. Incluye: ${levelsStr}`, // DESCRIPCIÓN
        String(partsKit?.totalEstimatedHours ?? ''),  // HORAS ESTIMADAS
        mecanico || 'Por asignar',         // MECÁNICO
        userName,                          // AUTORIZADO POR
        'Programada',                      // ESTADO
        partsListStr,                      // PARTES NECESARIAS
        observaciones,                     // OBSERVACIONES
      ]);
    } catch (err) {
      console.error('Sheets append failed (Ordenes Mantenimiento):', err);
    }

    // Write to Historial PM
    try {
      await appendRow(SHEET_TABS.HISTORIAL_PM, [
        date,                                     // FECHA
        otId,                                     // OT_ID
        unidad,                                   // UNIDAD
        model,                                    // MODELO
        pmLevel,                                  // NIVEL PM
        levelsStr,                                // NIVELES INCLUIDOS
        String(selectedEquipment?.current_horometro ?? ''), // HORÓMETRO
        String(partsKit?.totalEstimatedHours ?? ''),        // HORAS ESTIMADAS
        mecanico || 'Por asignar',                // MECÁNICO
        userName,                                 // AUTORIZADO POR
        'Programada',                             // ESTADO
        partsListStr,                             // PARTES
        observaciones,                            // OBSERVACIONES
      ]);
    } catch (err) {
      console.error('Sheets append failed (PM History):', err);
    }

    // Save print data so user can trigger PDF on click
    if (partsKit) {
      setPrintData({
        otId,
        date,
        unidad,
        model,
        pmLevel,
        levelsIncluded: partsKit.levelsIncluded,
        horometro: selectedEquipment?.current_horometro ?? 0,
        estimatedHours: partsKit.totalEstimatedHours,
        mecanico,
        autorizadoPor: userName,
        observaciones,
        parts: partsKit.parts,
      });
    }

    setToastMessage(`${otId} — PM ${pmLevel} programado para ${unidad}`);
    setToastVisible(true);
  }

  function handleToastDismiss() {
    setToastVisible(false);
    navigate(-1);
  }

  return (
    <div className="flex flex-col pb-4 animate-fade-up">
      <SuccessToast
        message={toastMessage}
        visible={toastVisible}
        onDismiss={handleToastDismiss}
      />

      <ConfirmModal
        open={showConfirm}
        title="Activar Orden de Mantenimiento"
        message={`¿Generar OT de ${pmLevel} para ${unidad} (${model})?\n\nSe ordenarán ${partsKit?.parts.length ?? 0} refacciones automáticamente.`}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-text">Orden de PM</h1>
          <p className="text-xs text-text-secondary">Genera OT + ordena refacciones automáticamente</p>
        </div>
      </div>

      {/* Step 1: Select Unit */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border mb-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-amber text-white flex items-center justify-center text-xs font-bold">1</div>
          <span className="font-semibold text-text">Seleccionar Equipo</span>
        </div>
        <select
          value={unidad}
          onChange={(e) => handleUnitChange(e.target.value)}
          className="w-full rounded-xl border border-border p-3 bg-white text-text"
        >
          <option value="">Seleccionar unidad...</option>
          {equipment.map((eq) => (
            <option key={eq.unit_id} value={eq.unit_id}>
              {eq.unit_id} — {eq.model} ({eq.current_horometro.toLocaleString()} hrs)
            </option>
          ))}
        </select>

        {/* PM proximity card */}
        {pmInfo && selectedEquipment && (
          <div className={`mt-3 rounded-xl p-3 border flex items-center gap-3 ${
            pmInfo.hours_remaining <= 0
              ? 'bg-red-50 border-critical'
              : pmInfo.hours_remaining <= 50
              ? 'bg-amber-50 border-amber'
              : 'bg-blue-50 border-blue-300'
          }`}>
            <Clock size={18} className={
              pmInfo.hours_remaining <= 0 ? 'text-critical' :
              pmInfo.hours_remaining <= 50 ? 'text-amber' : 'text-blue-500'
            } />
            <div className="flex-1">
              <p className="text-sm font-medium text-text">
                Próximo: {pmInfo.level} a {pmInfo.due_at.toLocaleString()} hrs
              </p>
              <p className="text-xs text-text-secondary">
                {pmInfo.hours_remaining <= 0
                  ? `VENCIDO ${Math.abs(pmInfo.hours_remaining)} hrs`
                  : `Faltan ${pmInfo.hours_remaining} hrs`}
              </p>
            </div>
            <button
              type="button"
              onClick={useSuggested}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber text-white whitespace-nowrap"
            >
              Usar {pmInfo.level}
            </button>
          </div>
        )}
      </div>

      {/* Step 2: Select PM Level */}
      {unidad && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-border mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-amber text-white flex items-center justify-center text-xs font-bold">2</div>
            <span className="font-semibold text-text">Nivel de PM</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {availableLevels.map((level) => {
              const isSelected = pmLevel === level;
              const isSuggested = level === suggestedLevel;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => handleLevelSelect(level)}
                  className={`relative px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                    isSelected
                      ? 'bg-amber text-white border-amber'
                      : 'bg-white text-text-secondary border-border hover:border-amber'
                  }`}
                >
                  {level}
                  {isSuggested && !isSelected && (
                    <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-amber rounded-full border-2 border-white" />
                  )}
                </button>
              );
            })}
          </div>
          {pmLevel && (
            <p className="text-xs text-text-secondary mt-2">
              Incluye: {partsKit?.levelsIncluded.join(' + ')} — ~{partsKit?.totalEstimatedHours ?? 0} hrs estimadas
            </p>
          )}
        </div>
      )}

      {/* Step 3: Auto-populated parts list */}
      {partsKit && partsKit.parts.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-border mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-amber text-white flex items-center justify-center text-xs font-bold">3</div>
            <span className="font-semibold text-text">Refacciones ({partsKit.parts.length})</span>
            <CheckCircle size={16} className="text-success ml-auto" />
            <span className="text-xs text-success font-medium">Auto-generado</span>
          </div>

          {CATEGORY_ORDER.filter((cat) => groupedParts[cat]).map((category) => (
            <div key={category} className="mb-3 last:mb-0">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-sm">{CATEGORY_ICONS[category]}</span>
                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  {category}
                </span>
              </div>
              {groupedParts[category].map((part, idx) => (
                <div
                  key={`${part.partNumber}-${idx}`}
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg mb-1 last:mb-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text truncate">{part.description}</p>
                    <p className="text-xs text-amber font-mono">{part.partNumber}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-3">
                    <span className="text-sm font-bold text-text">{part.quantity}</span>
                    <span className="text-xs text-text-secondary">{part.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* Summary row */}
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package size={16} className="text-text-secondary" />
              <span className="text-sm text-text-secondary">
                {partsKit.parts.length} ítems
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-text-secondary" />
              <span className="text-sm text-text-secondary">
                ~{partsKit.totalEstimatedHours} hrs
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Assign mechanic + notes */}
      {partsKit && partsKit.parts.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-border mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-amber text-white flex items-center justify-center text-xs font-bold">4</div>
            <span className="font-semibold text-text">Asignar</span>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-secondary">Mecánico (opcional)</label>
              <input
                type="text"
                value={mecanico}
                onChange={(e) => setMecanico(e.target.value)}
                placeholder="Nombre del mecánico asignado"
                className="w-full rounded-xl border border-border p-3 text-sm text-text bg-white"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-secondary">Observaciones</label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Notas adicionales para el mecánico..."
                rows={3}
                className="w-full rounded-xl border border-border p-3 text-sm text-text resize-none bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Warning for overdue PM */}
      {pmInfo && pmInfo.hours_remaining <= 0 && pmLevel === suggestedLevel && (
        <div className="bg-red-50 border border-critical rounded-xl p-3 flex items-center gap-2 mb-4">
          <AlertTriangle size={18} className="text-critical shrink-0" />
          <span className="text-sm font-medium text-critical">
            PM VENCIDO — Prioridad máxima. Equipo no debe operar sin este mantenimiento.
          </span>
        </div>
      )}

      {/* Submit */}
      {/* Submit or Print */}
      {printData ? (
        <button
          type="button"
          onClick={() => printPMOrder(printData)}
          className="w-full bg-amber text-white rounded-xl py-4 font-semibold text-lg transition-opacity flex items-center justify-center gap-2 btn-press"
          style={{ minHeight: 52 }}
        >
          <Wrench size={20} />
          Imprimir Orden de PM
        </button>
      ) : (
        <button
          type="button"
          onClick={handleSubmitIntent}
          disabled={!canSubmit}
          className="w-full bg-amber text-white rounded-xl py-4 font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2 btn-press"
          style={{ minHeight: 52 }}
        >
          <Wrench size={20} />
          Activar Orden de PM
        </button>
      )}
    </div>
  );
}
```

---

## `src/pages/InventoryPage.tsx`

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface StockItem {
  partNumber: string;
  description: string;
  oemRef: string;
  stock: number;
  minimum: number;
  status: 'critical' | 'low' | 'ok';
}

const STOCK_ITEMS: StockItem[] = [
  {
    partNumber: 'FLT-HYD-001',
    description: 'Filtro Hidráulico Komatsu',
    oemRef: 'KOM-207-60-71181',
    stock: 0,
    minimum: 4,
    status: 'critical',
  },
  {
    partNumber: 'FREIN-001',
    description: 'Pastillas de Freno CAT 740B',
    oemRef: 'CAT-9W-2620',
    stock: 2,
    minimum: 5,
    status: 'critical',
  },
  {
    partNumber: 'FLT-ACE-002',
    description: 'Filtro Aceite Motor D155',
    oemRef: 'KOM-600-211-5240',
    stock: 3,
    minimum: 6,
    status: 'low',
  },
  {
    partNumber: 'EMP-001',
    description: 'Empaque Cabeza Motor',
    oemRef: 'MACK-21893456',
    stock: 1,
    minimum: 3,
    status: 'low',
  },
  {
    partNumber: 'COR-HYD-003',
    description: 'Correa Alternador Doosan',
    oemRef: 'DOO-K9002983',
    stock: 4,
    minimum: 6,
    status: 'low',
  },
  {
    partNumber: 'NEU-CAM-001',
    description: 'Neumático 23.5R25',
    oemRef: 'BRI-OTR-23525',
    stock: 2,
    minimum: 4,
    status: 'low',
  },
  {
    partNumber: 'ACE-MOT-001',
    description: 'Aceite Motor 15W40 (bidón 5L)',
    oemRef: 'SHELL-RIM-X-15W40',
    stock: 5,
    minimum: 8,
    status: 'low',
  },
  {
    partNumber: 'BAT-24V-001',
    description: 'Batería 24V 170Ah',
    oemRef: 'BOSCH-S5-A08',
    stock: 6,
    minimum: 4,
    status: 'ok',
  },
  {
    partNumber: 'FLT-COM-001',
    description: 'Filtro Combustible Komatsu',
    oemRef: 'KOM-600-311-3750',
    stock: 12,
    minimum: 6,
    status: 'ok',
  },
  {
    partNumber: 'SEL-HYD-001',
    description: 'Sello Cilindro Hidráulico',
    oemRef: 'KOM-707-99-01340',
    stock: 8,
    minimum: 4,
    status: 'ok',
  },
];

type FilterType = 'all' | 'critical' | 'low' | 'ok';

const STATUS_BORDER: Record<StockItem['status'], string> = {
  critical: 'border-l-critical',
  low: 'border-l-amber',
  ok: 'border-l-transparent',
};

const STATUS_BADGE: Record<StockItem['status'], string> = {
  critical: 'bg-red-100 text-critical',
  low: 'bg-amber-100 text-amber',
  ok: 'bg-green-100 text-success',
};

const STATUS_LABEL: Record<StockItem['status'], string> = {
  critical: 'CRÍTICO',
  low: 'BAJO',
  ok: 'OK',
};

export default function InventoryPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterType>('all');

  const criticalCount = STOCK_ITEMS.filter((i) => i.status === 'critical').length;
  const lowCount = STOCK_ITEMS.filter((i) => i.status === 'low').length;
  const okCount = STOCK_ITEMS.filter((i) => i.status === 'ok').length;

  const filtered =
    filter === 'all'
      ? STOCK_ITEMS
      : STOCK_ITEMS.filter((i) => i.status === filter);

  return (
    <div className="flex flex-col pb-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <h1 className="text-xl font-bold text-text">Inventario Repuestos</h1>
      </div>

      {/* Summary pills */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setFilter(filter === 'critical' ? 'all' : 'critical')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors border ${
            filter === 'critical'
              ? 'bg-red-100 border-critical text-critical'
              : 'bg-white border-border text-text-secondary'
          }`}
        >
          <span className="text-base">🔴</span>
          CRÍTICO {criticalCount}
        </button>
        <button
          type="button"
          onClick={() => setFilter(filter === 'low' ? 'all' : 'low')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors border ${
            filter === 'low'
              ? 'bg-amber-100 border-amber text-amber'
              : 'bg-white border-border text-text-secondary'
          }`}
        >
          <span className="text-base">🟡</span>
          BAJO {lowCount}
        </button>
        <button
          type="button"
          onClick={() => setFilter(filter === 'ok' ? 'all' : 'ok')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors border ${
            filter === 'ok'
              ? 'bg-green-100 border-success text-success'
              : 'bg-white border-border text-text-secondary'
          }`}
        >
          <span className="text-base">✅</span>
          OK {okCount}
        </button>
      </div>

      {/* Stock items */}
      <div className="flex flex-col gap-3">
        {filtered.map((item) => (
          <div
            key={item.partNumber}
            className={`bg-white rounded-xl shadow-sm border border-border border-l-4 ${STATUS_BORDER[item.status]} p-4 flex items-center gap-3`}
          >
            {/* Left: part info */}
            <div className="flex-1 min-w-0">
              <p className="font-mono text-xs font-semibold text-amber">{item.partNumber}</p>
              <p className="font-medium text-text text-sm mt-0.5">{item.description}</p>
              <p className="text-text-secondary text-xs mt-0.5">{item.oemRef}</p>
            </div>

            {/* Right: stock info */}
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[item.status]}`}>
                {STATUS_LABEL[item.status]}
              </span>
              <span className="text-xl font-bold text-text">{item.stock}</span>
              <span className="text-xs text-text-secondary">Mín: {item.minimum}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## `src/pages/NeumaticosPage.tsx`

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Disc3,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  Gauge,
  Ruler,
  Loader2,
} from 'lucide-react';
import { appendRow, SHEET_TABS } from '../lib/sheets-api';
import { useEquipmentList } from '../hooks/useEquipmentList';
import { mexicoDate } from '../lib/date-utils';

// ── Column order matches Sheet "13 Neumáticos" cols A→S ─────────────────────
// A  #
// B  CÓDIGO UNIDAD
// C  MODELO
// D  POSICIÓN
// E  MARCA NEUMÁTICO
// F  MODELO NEUMÁTICO
// G  MEDIDA
// H  N° SERIE
// I  FECHA INSTALACIÓN        (blank — filled when tire is installed)
// J  HORÓMETRO INSTALACIÓN    (blank — filled when tire is installed)
// K  HORÓMETRO ACTUAL
// L  HORAS USO                (blank — sheet calculates K-J)
// M  PROFUNDIDAD ORIGINAL(mm)
// N  PROFUNDIDAD ACTUAL (mm)
// O  DESGASTE %               (blank — sheet calculates (M-N)/M*100)
// P  PRESIÓN RECOMENDADA(PSI)
// Q  ÚLTIMA PRESIÓN (PSI)
// R  FECHA ÚLT. INSPECCIÓN
// S  ESTADO

// ── Positions by equipment type ──────────────────────────────────────────────
// Camión Articulado (CAT 740B, HM400-3): 6 llantas
//   I1 D2 — Delanteras
//   I3 D4 — Trasera eje 2
//   I5 D6 — Trasera eje 3
// Camión Pesado Mack GR84B 8x4: 12 llantas
//   I1 D2 — Delanteras
//   I3 D4 — Eje 2 simples
//   DE5 DI6 — Eje 3 duales derecha (Exterior / Interior)
//   LI7 LE8 — Eje 3 duales izquierda (Interior / Exterior)
//   DE9 DI10 — Eje 4 duales derecha
//   LI11 LE12 — Eje 4 duales izquierda
// Cargador DL420A: 4 llantas
//   I1 D2 — Delanteras
//   I3 D4 — Traseras
const POSITIONS_BY_TYPE: Record<string, string[]> = {
  'Camión Articulado': ['I1', 'D2', 'I3', 'D4', 'I5', 'D6'],
  Cargador:            ['I1', 'D2', 'I3', 'D4'],
  'Camión Pesado':     ['I1', 'D2', 'I3', 'D4', 'DE5', 'DI6', 'LI7', 'LE8', 'DE9', 'DI10', 'LI11', 'LE12'],
  default:             ['I1', 'D2', 'I3', 'D4'],
};

// ── Recommended PSI by type + position ──────────────────────────────────────
function getPresionRecomendada(tipo: string, posicion: string): string {
  const esFrontal = posicion.startsWith('F');
  if (tipo === 'Camión Pesado') return esFrontal ? '120' : '115';
  if (tipo === 'Camión Articulado') return esFrontal ? '115' : '110';
  if (tipo === 'Cargador') return '80';
  return '115';
}

// ── Auto-calculate ESTADO from form values ───────────────────────────────────
function calcEstado(condicion: string, profActual: string, presion: string): string {
  const d = parseFloat(profActual);
  const p = parseFloat(presion);
  if (condicion === 'Cambio Urgente' || (!isNaN(d) && d < 5)) return 'Cambio Urgente';
  if (condicion === 'Dañada') return 'Dañada';
  if (!isNaN(p) && (p < 70 || p > 135)) return 'Desgaste Irregular';
  if (condicion === 'Desgaste Irregular' || (!isNaN(d) && d < 10)) return 'Desgaste Irregular';
  if (condicion === 'Desgaste Normal') return 'Desgaste Normal';
  return 'Buena';
}

// ── Visual helpers ───────────────────────────────────────────────────────────
const CONDICIONES = [
  { value: 'Buena',              color: '#16A34A', bg: '#F0FDF4' },
  { value: 'Desgaste Normal',    color: '#2563EB', bg: '#EFF6FF' },
  { value: 'Desgaste Irregular', color: '#F59E0B', bg: '#FFFBEB' },
  { value: 'Dañada',             color: '#DC2626', bg: '#FEF2F2' },
  { value: 'Cambio Urgente',     color: '#9B1C1C', bg: '#FEF2F2' },
];

const MARCAS = ['Bridgestone', 'Michelin', 'Goodyear', 'Continental', 'Hankook', 'Firestone', 'Otra'];

function depthColor(mm: string) {
  const v = parseFloat(mm);
  if (isNaN(v)) return '#9CA3AF';
  if (v >= 10) return '#16A34A';
  if (v >= 5) return '#F59E0B';
  return '#DC2626';
}

function psiColor(psi: string) {
  const v = parseFloat(psi);
  if (isNaN(v)) return '#9CA3AF';
  if (v >= 80 && v <= 130) return '#16A34A';
  if (v >= 65) return '#F59E0B';
  return '#DC2626';
}

// ── Types ────────────────────────────────────────────────────────────────────
interface LlantaForm {
  posicion: string;
  marca: string;
  modeloLlanta: string;   // F: MODELO NEUMÁTICO  (e.g. M729, R297, XDN2)
  medida: string;         // G: MEDIDA
  serie: string;          // H: N° SERIE / DOT
  profundidadOrig: string;// M: PROFUNDIDAD ORIGINAL (mm)
  profundidad: string;    // N: PROFUNDIDAD ACTUAL (mm)
  presionRec: string;     // P: PRESIÓN RECOMENDADA — auto-filled, editable
  presion: string;        // Q: ÚLTIMA PRESIÓN (PSI)
  condicion: string;      // drives S: ESTADO
  observaciones: string;
}

const emptyLlanta = (tipo = '', posicion = ''): LlantaForm => ({
  posicion,
  marca: '',
  modeloLlanta: '',
  medida: '',
  serie: '',
  profundidadOrig: '',
  profundidad: '',
  presionRec: getPresionRecomendada(tipo, posicion),
  presion: '',
  condicion: '',
  observaciones: '',
});

type Step = 'equipo' | 'llanta' | 'success';

let _seq = 1;
function nextSeq() { return String(_seq++); }

// ════════════════════════════════════════════════════════════════════════════
export default function NeumaticosPage() {
  const navigate = useNavigate();
  const equipmentList = useEquipmentList();

  const [step, setStep]             = useState<Step>('equipo');
  const [selectedUnit, setSelected] = useState('');
  const [horometro, setHorometro]   = useState('');
  const [llanta, setLlanta]         = useState<LlantaForm>(emptyLlanta());
  const [submitting, setSubmitting] = useState(false);
  const [registradas, setRegistradas] = useState<string[]>([]);
  const [errors, setErrors]         = useState<Partial<Record<keyof LlantaForm, string>>>({});

  const equipment       = equipmentList.find((e) => e.unit_id === selectedUnit);
  const positions       = equipment ? (POSITIONS_BY_TYPE[equipment.type] ?? POSITIONS_BY_TYPE.default) : [];
  const available       = positions.filter((p) => !registradas.includes(p));
  const autoEstado      = calcEstado(llanta.condicion, llanta.profundidad, llanta.presion);
  const estadoMeta      = CONDICIONES.find((c) => c.value === llanta.condicion);

  // Set presionRec whenever position changes
  function handlePosicion(pos: string) {
    setLlanta((f) => ({
      ...f,
      posicion: pos,
      presionRec: getPresionRecomendada(equipment?.type ?? '', pos),
    }));
  }

  // ── Validation ─────────────────────────────────────────────────────────
  function validate(): boolean {
    const e: Partial<Record<keyof LlantaForm, string>> = {};
    if (!llanta.posicion)        e.posicion        = 'Requerido';
    if (!llanta.profundidadOrig) e.profundidadOrig = 'Requerido';
    if (!llanta.profundidad)     e.profundidad     = 'Requerido';
    if (!llanta.presion)         e.presion         = 'Requerido';
    if (!llanta.condicion)       e.condicion       = 'Requerido';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Submit — writes cols A→S (19 values) ───────────────────────────────
  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);

    const fecha = mexicoDate();

    const values: string[] = [
      nextSeq(),                  // A  #
      selectedUnit,               // B  CÓDIGO UNIDAD
      equipment?.model ?? '',     // C  MODELO
      llanta.posicion,            // D  POSICIÓN
      llanta.marca,               // E  MARCA NEUMÁTICO
      llanta.modeloLlanta,        // F  MODELO NEUMÁTICO
      llanta.medida,              // G  MEDIDA
      llanta.serie,               // H  N° SERIE
      '',                         // I  FECHA INSTALACIÓN  (blank)
      '',                         // J  HORÓMETRO INSTALACIÓN (blank)
      horometro,                  // K  HORÓMETRO ACTUAL
      '',                         // L  HORAS USO  (sheet calculates)
      llanta.profundidadOrig,     // M  PROFUNDIDAD ORIGINAL (mm)
      llanta.profundidad,         // N  PROFUNDIDAD ACTUAL (mm)
      '',                         // O  DESGASTE %  (sheet calculates)
      llanta.presionRec,          // P  PRESIÓN RECOMENDADA (PSI)
      llanta.presion,             // Q  ÚLTIMA PRESIÓN (PSI)
      fecha,                      // R  FECHA ÚLT. INSPECCIÓN
      autoEstado,                 // S  ESTADO
    ];

    // Append observaciones as extra col if needed
    if (llanta.observaciones) values.push(llanta.observaciones);

    try {
      await appendRow(SHEET_TABS.NEUMATICOS, values);
      setRegistradas((prev) => [...prev, llanta.posicion]);
      setLlanta(emptyLlanta(equipment?.type ?? '', ''));
      setErrors({});
    } catch {
      // offline-queue will retry
    } finally {
      setSubmitting(false);
    }
  }

  // ── STEP 1: Equipment ──────────────────────────────────────────────────
  if (step === 'equipo') {
    const wheeled = equipmentList.filter(
      (e) => e.type !== 'Tractor de Cadena' && e.type !== 'Excavadora'
    );

    return (
      <div className="flex flex-col py-4 animate-fade-up">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-1">
            <ChevronLeft size={24} color="#162252" />
          </button>
          <Disc3 size={24} color="#162252" />
          <h1 className="text-xl font-bold text-text">Reporte de Neumáticos</h1>
        </div>

        <p className="text-sm text-text-secondary mb-4">Selecciona la unidad a inspeccionar</p>

        <div className="flex flex-col gap-2 mb-6">
          {wheeled.map((eq) => (
            <button
              key={eq.unit_id}
              onClick={() => setSelected(eq.unit_id)}
              className="flex items-center justify-between p-4 rounded-xl border transition-all btn-press"
              style={{
                backgroundColor: selectedUnit === eq.unit_id ? '#EFF6FF' : '#FFFFFF',
                borderColor:     selectedUnit === eq.unit_id ? '#2563EB' : '#E5E7EB',
              }}
            >
              <div className="text-left">
                <p className="font-semibold text-text">{eq.unit_id}</p>
                <p className="text-xs text-text-secondary">{eq.model} · {eq.type}</p>
              </div>
              <span
                className="text-xs font-medium px-2 py-1 rounded-full"
                style={{
                  backgroundColor: eq.status === 'operativo' ? '#DCFCE7' : eq.status === 'alerta' ? '#FEF9C3' : '#FEE2E2',
                  color:           eq.status === 'operativo' ? '#16A34A' : eq.status === 'alerta' ? '#92400E' : '#DC2626',
                }}
              >
                {eq.status}
              </span>
            </button>
          ))}
        </div>

        {selectedUnit && (
          <div className="mb-6 animate-fade-up">
            <label className="block text-sm font-semibold text-text mb-1">
              Horómetro actual (hrs)
            </label>
            <input
              type="number"
              value={horometro}
              onChange={(e) => setHorometro(e.target.value)}
              placeholder={String(equipment?.current_horometro ?? '')}
              className="w-full border border-border rounded-xl px-4 py-3 text-text bg-white"
            />
            <p className="text-xs text-text-secondary mt-1">
              Se registra como "Horómetro Actual" en el Sheet
            </p>
          </div>
        )}

        <button
          disabled={!selectedUnit}
          onClick={() => setStep('llanta')}
          className="w-full py-3 rounded-xl font-semibold text-white"
          style={{ backgroundColor: selectedUnit ? '#162252' : '#9CA3AF' }}
        >
          Continuar → {selectedUnit && `(${positions.length} posiciones)`}
        </button>
      </div>
    );
  }

  // ── SUCCESS ────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="flex flex-col items-center justify-center py-16 animate-fade-up gap-6">
        <CheckCircle2 size={64} color="#16A34A" />
        <h2 className="text-2xl font-bold text-text text-center">Reporte Completado</h2>
        <p className="text-text-secondary text-center">
          {registradas.length} llanta{registradas.length !== 1 ? 's' : ''} guardada{registradas.length !== 1 ? 's' : ''} en el Sheet
        </p>
        <div className="w-full bg-white rounded-xl p-4 border border-border">
          {registradas.map((pos) => (
            <div key={pos} className="flex items-center gap-2 py-1">
              <CheckCircle2 size={16} color="#16A34A" />
              <span className="text-sm text-text">{pos}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => navigate('/workshop')}
          className="w-full py-3 rounded-xl font-semibold text-white"
          style={{ backgroundColor: '#162252' }}
        >
          Volver al Inicio
        </button>
      </div>
    );
  }

  // ── STEP 2: Per-tire form ──────────────────────────────────────────────
  return (
    <div className="flex flex-col py-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setStep('equipo')} className="p-1">
            <ChevronLeft size={24} color="#162252" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-text">{selectedUnit} · Neumáticos</h1>
            <p className="text-xs text-text-secondary">{equipment?.model}</p>
          </div>
        </div>
        <span
          className="text-xs font-semibold px-2 py-1 rounded-full"
          style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}
        >
          {registradas.length}/{positions.length}
        </span>
      </div>

      {/* Registered summary */}
      {registradas.length > 0 && (
        <div className="mb-3 p-3 rounded-xl border" style={{ backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }}>
          <p className="text-xs font-medium text-success mb-1">Registradas:</p>
          <div className="flex flex-wrap gap-1">
            {registradas.map((p) => (
              <span key={p} className="text-xs px-2 py-0.5 rounded-full bg-white border border-success text-success">{p}</span>
            ))}
          </div>
        </div>
      )}

      {available.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-8">
          <CheckCircle2 size={48} color="#16A34A" />
          <p className="font-semibold text-text text-center">Todas las posiciones registradas</p>
          <button onClick={() => setStep('success')} className="w-full py-3 rounded-xl font-semibold text-white" style={{ backgroundColor: '#162252' }}>
            Finalizar Reporte
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">

          {/* ─ D: POSICIÓN ─ */}
          <div>
            <label className="block text-sm font-semibold text-text mb-1">
              Posición (col D) *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {available.map((pos) => (
                <button
                  key={pos}
                  onClick={() => handlePosicion(pos)}
                  className="text-sm px-2 py-2.5 rounded-xl border transition-all font-mono"
                  style={{
                    backgroundColor: llanta.posicion === pos ? '#162252' : '#FFFFFF',
                    borderColor:     llanta.posicion === pos ? '#162252' : '#E5E7EB',
                    color:           llanta.posicion === pos ? '#FFFFFF'  : '#374151',
                    fontWeight:      llanta.posicion === pos ? '700' : '400',
                  }}
                >
                  {pos}
                </button>
              ))}
            </div>
            {errors.posicion && <p className="text-xs text-red-500 mt-1">{errors.posicion}</p>}
          </div>

          {/* ─ E + F: MARCA + MODELO NEUMÁTICO ─ */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                E · Marca Neumático
              </label>
              <select
                value={llanta.marca}
                onChange={(e) => setLlanta((f) => ({ ...f, marca: e.target.value }))}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-text bg-white text-sm"
              >
                <option value="">Seleccionar</option>
                {MARCAS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                F · Modelo Neumático
              </label>
              <input
                type="text"
                value={llanta.modeloLlanta}
                onChange={(e) => setLlanta((f) => ({ ...f, modeloLlanta: e.target.value }))}
                placeholder="M729, R297, XDN2..."
                className="w-full border border-border rounded-xl px-3 py-2.5 text-text bg-white text-sm"
              />
            </div>
          </div>

          {/* ─ G + H: MEDIDA + N° SERIE ─ */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                G · Medida
              </label>
              <input
                type="text"
                value={llanta.medida}
                onChange={(e) => setLlanta((f) => ({ ...f, medida: e.target.value }))}
                placeholder="26.5R25 / 11R22.5"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-text bg-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                H · N° Serie / DOT
              </label>
              <input
                type="text"
                value={llanta.serie}
                onChange={(e) => setLlanta((f) => ({ ...f, serie: e.target.value }))}
                placeholder="DOT 4320"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-text bg-white text-sm"
              />
            </div>
          </div>

          {/* ─ M + N: PROFUNDIDAD ORIGINAL + ACTUAL ─ */}
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Ruler size={14} color="#162252" />
              <span className="text-sm font-semibold text-text">Profundidad de Banda *</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  M · Original (mm)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={llanta.profundidadOrig}
                  onChange={(e) => setLlanta((f) => ({ ...f, profundidadOrig: e.target.value }))}
                  placeholder="18"
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-text bg-white text-sm"
                />
                {errors.profundidadOrig && <p className="text-xs text-red-500 mt-0.5">{errors.profundidadOrig}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  N · Actual (mm)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    value={llanta.profundidad}
                    onChange={(e) => setLlanta((f) => ({ ...f, profundidad: e.target.value }))}
                    placeholder="12"
                    className="w-full border rounded-xl px-3 py-2.5 text-text bg-white text-sm"
                    style={{ borderColor: llanta.profundidad ? depthColor(llanta.profundidad) : '#E5E7EB' }}
                  />
                  {llanta.profundidad && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: depthColor(llanta.profundidad) }}>mm</span>
                  )}
                </div>
                {errors.profundidad && <p className="text-xs text-red-500 mt-0.5">{errors.profundidad}</p>}
              </div>
            </div>

            {/* Visual depth bar */}
            {llanta.profundidad && (
              <div className="mt-2">
                <div className="w-full h-2.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min((parseFloat(llanta.profundidad) / 20) * 100, 100)}%`,
                      backgroundColor: depthColor(llanta.profundidad),
                    }}
                  />
                </div>
                <p className="text-xs mt-0.5" style={{ color: depthColor(llanta.profundidad) }}>
                  {parseFloat(llanta.profundidad) < 5 ? '⚠️ Crítico — Cambio inmediato'
                    : parseFloat(llanta.profundidad) < 10 ? '⚠️ Advertencia — Programar cambio'
                    : '✓ En rango aceptable'}
                </p>

                {/* Desgaste % preview */}
                {llanta.profundidadOrig && (
                  <p className="text-xs text-text-secondary mt-0.5">
                    Desgaste:{' '}
                    <strong>
                      {Math.round(
                        ((parseFloat(llanta.profundidadOrig) - parseFloat(llanta.profundidad)) /
                          parseFloat(llanta.profundidadOrig)) * 100
                      )}%
                    </strong>
                    {' '}(col O — el Sheet lo calcula automáticamente)
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ─ P + Q: PRESIÓN RECOMENDADA + ÚLTIMA PRESIÓN ─ */}
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Gauge size={14} color="#162252" />
              <span className="text-sm font-semibold text-text">Presión (PSI) *</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  P · Recomendada (PSI)
                </label>
                <input
                  type="number"
                  value={llanta.presionRec}
                  onChange={(e) => setLlanta((f) => ({ ...f, presionRec: e.target.value }))}
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-text bg-gray-50 text-sm"
                />
                <p className="text-xs text-text-secondary mt-0.5">Auto por tipo/posición</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Q · Medida hoy (PSI)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={llanta.presion}
                    onChange={(e) => setLlanta((f) => ({ ...f, presion: e.target.value }))}
                    placeholder="115"
                    className="w-full border rounded-xl px-3 py-2.5 text-text bg-white text-sm"
                    style={{ borderColor: llanta.presion ? psiColor(llanta.presion) : '#E5E7EB' }}
                  />
                  {llanta.presion && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: psiColor(llanta.presion) }}>PSI</span>
                  )}
                </div>
                {errors.presion && <p className="text-xs text-red-500 mt-0.5">{errors.presion}</p>}
                {llanta.presion && (
                  <p className="text-xs mt-0.5" style={{ color: psiColor(llanta.presion) }}>
                    {parseFloat(llanta.presion) < 70 ? '⚠️ Muy baja — Riesgo reventón'
                      : parseFloat(llanta.presion) < 80 ? '⚠️ Baja — Revisar'
                      : parseFloat(llanta.presion) > 130 ? '⚠️ Alta — Liberar presión'
                      : '✓ Rango normal'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ─ S: ESTADO — auto-calculated, shown as preview ─ */}
          <div>
            <label className="block text-sm font-semibold text-text mb-1">
              Condición Visual → <span style={{ color: '#2563EB' }}>col S ESTADO</span> *
            </label>
            <div className="flex flex-col gap-2">
              {CONDICIONES.map(({ value, color, bg }) => (
                <button
                  key={value}
                  onClick={() => setLlanta((f) => ({ ...f, condicion: value }))}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-sm font-medium"
                  style={{
                    backgroundColor: llanta.condicion === value ? bg : '#FFFFFF',
                    borderColor:     llanta.condicion === value ? color : '#E5E7EB',
                    color:           llanta.condicion === value ? color : '#374151',
                  }}
                >
                  {value}
                  {llanta.condicion === value && <CheckCircle2 size={16} color={color} />}
                </button>
              ))}
            </div>
            {errors.condicion && <p className="text-xs text-red-500 mt-1">{errors.condicion}</p>}

            {/* ESTADO preview */}
            {llanta.condicion && (
              <div
                className="mt-2 flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold"
                style={{
                  backgroundColor: estadoMeta?.bg ?? '#F9FAFB',
                  borderColor: estadoMeta?.color ?? '#E5E7EB',
                  border: '1px solid',
                }}
              >
                <span style={{ color: '#6B7280' }}>Columna S → ESTADO:</span>
                <span style={{ color: estadoMeta?.color ?? '#374151' }}>{autoEstado}</span>
              </div>
            )}
          </div>

          {/* ─ Observaciones ─ */}
          <div>
            <label className="block text-sm font-semibold text-text mb-1">Observaciones</label>
            <textarea
              value={llanta.observaciones}
              onChange={(e) => setLlanta((f) => ({ ...f, observaciones: e.target.value }))}
              placeholder="Cortes, bultos, mordidas, desgaste irregular, hora de reencauche..."
              rows={3}
              className="w-full border border-border rounded-xl px-3 py-2.5 text-text bg-white text-sm resize-none"
            />
          </div>

          {/* ─ Critical warning ─ */}
          {(parseFloat(llanta.profundidad) < 5 || parseFloat(llanta.presion) < 70 || llanta.condicion === 'Cambio Urgente') && (
            <div className="flex items-start gap-2 p-3 rounded-xl" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
              <AlertTriangle size={18} color="#DC2626" className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700">Atención crítica</p>
                <p className="text-xs text-red-600">Notifica al Supervisor inmediatamente. No operar la unidad hasta revisión.</p>
              </div>
            </div>
          )}

          {/* ─ Buttons ─ */}
          <div className="flex gap-3 mt-1 pb-8">
            <button
              disabled={submitting}
              onClick={handleSubmit}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white"
              style={{ backgroundColor: '#162252' }}
            >
              {submitting
                ? <Loader2 size={18} className="animate-spin" />
                : <><Disc3 size={18} /> Registrar Llanta</>}
            </button>
            {registradas.length > 0 && (
              <button
                onClick={() => setStep('success')}
                className="px-5 py-3 rounded-xl font-semibold border"
                style={{ borderColor: '#162252', color: '#162252', backgroundColor: '#FFFFFF' }}
              >
                Finalizar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## `src/pages/AlertsPage.tsx`

```typescript
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell } from 'lucide-react';

export default function AlertsPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col pb-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <h1 className="text-xl font-bold text-text">Alertas</h1>
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
          <Bell size={28} className="text-text-secondary" />
        </div>
        <p className="text-base font-semibold text-text">Sin alertas activas</p>
        <p className="text-sm text-text-secondary text-center max-w-xs">
          Las alertas de PM vencido, stock bajo y fallas críticas aparecerán aquí.
        </p>
      </div>
    </div>
  );
}
```

---

## `src/pages/OperatorHomePage.tsx`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  Camera,
  Fuel,
  Gauge,
  MapPin,
  FileText,
  CheckCircle,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { readRange, SHEET_TABS } from '../lib/sheets-api';
import { mexicoDate } from '../lib/date-utils';

interface ActionCard {
  label: string;
  icon: React.ReactNode;
  path: string;
}

const ACTION_CARDS: ActionCard[] = [
  { label: 'Checklist', icon: <ClipboardCheck size={32} className="text-amber" />, path: '/dvir' },
  { label: 'Reportar Falla', icon: <Camera size={32} className="text-amber" />, path: '/falla' },
  { label: 'Diesel', icon: <Fuel size={32} className="text-amber" />, path: '/diesel' },
  { label: 'Horómetro', icon: <Gauge size={32} className="text-amber" />, path: '/horometro' },
  { label: 'Fletes', icon: <MapPin size={32} className="text-amber" />, path: '/flete' },
  { label: 'Mis Reportes', icon: <FileText size={32} className="text-amber" />, path: '/my-reports' },
];

export default function OperatorHomePage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);

  const [dvirDone, setDvirDone] = useState<boolean | null>(null); // null = loading
  const [reportCount, setReportCount] = useState(0);

  const checkDVIRStatus = useCallback(async () => {
    try {
      const rows = await readRange(SHEET_TABS.INSPECCIONES);
      const today = mexicoDate();
      let todayCount = 0;
      let foundDVIR = false;

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowDate = (row[2] ?? '').trim();  // FECHA column (index 2)
        const rowOperator = (row[6] ?? '').trim(); // OPERADOR column (index 6)

        if (rowDate === today && rowOperator === userName) {
          foundDVIR = true;
          todayCount++;
        }
      }

      setDvirDone(foundDVIR);
      setReportCount(todayCount);
    } catch {
      // If fetch fails, hide the banner rather than show false alarm
      setDvirDone(null);
    }
  }, [userName]);

  useEffect(() => {
    checkDVIRStatus();
  }, [checkDVIRStatus]);

  const greeting = new Date().getHours() < 12 ? 'Buenos días' : new Date().getHours() < 18 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div className="flex flex-col py-4 animate-fade-up">
      {/* Greeting */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-text">{greeting}, {userName}</h1>
        <p className="text-text-secondary text-sm mt-0.5">Operador</p>
      </div>

      {/* DVIR status — dynamic from Google Sheets */}
      {dvirDone === false && (
        <div className="bg-red-50 border-l-4 border-critical rounded-lg p-3 mb-4">
          <p className="text-sm font-medium text-critical">
            ⚠️ Tu Checklist de hoy no ha sido completado
          </p>
        </div>
      )}
      {dvirDone === true && (
        <div className="bg-green-50 border-l-4 border-success rounded-lg p-3 mb-4 flex items-center gap-2">
          <CheckCircle size={16} className="text-success shrink-0" />
          <p className="text-sm font-medium text-success">
            Checklist completado hoy ✓
          </p>
        </div>
      )}

      {/* Action grid 2x3 */}
      <div className="grid grid-cols-2 gap-3">
        {ACTION_CARDS.map(({ label, icon, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex flex-col items-center justify-center gap-2 bg-white rounded-xl p-4 shadow-sm border border-border btn-press"
            style={{ minHeight: 100 }}
          >
            {icon}
            <span className="text-sm font-medium text-center text-text">{label}</span>
          </button>
        ))}
      </div>

      {/* Footer counter — dynamic */}
      {reportCount > 0 && (
        <p className="text-sm text-success text-center mt-4 font-medium">
          Reportes hoy: {reportCount} ✓
        </p>
      )}
    </div>
  );
}
```

---

## `src/pages/MechanicPage.tsx`

```typescript
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
```

---

## `src/pages/SupervisorHomePage.tsx`

```typescript
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  MapPin,
  AlertTriangle,
  Activity,
  Wrench,
  ShieldAlert,
  ShieldOff,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { useEquipmentList } from '../hooks/useEquipmentList';
import KPICard from '../components/ui/KPICard';
import EquipmentCard from '../components/ui/EquipmentCard';

interface ActionCard {
  label: string;
  icon: React.ReactNode;
  path: string;
}

const ACTION_CARDS: ActionCard[] = [
  { label: 'Equipos', icon: <Truck size={32} className="text-amber" />, path: '/fleet' },
  { label: 'Viajes Peña', icon: <MapPin size={32} className="text-amber" />, path: '/viajes-pena' },
  { label: 'Alertas', icon: <AlertTriangle size={32} className="text-amber" />, path: '/alerts' },
];

export default function SupervisorHomePage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);
  const equipment = useEquipmentList();

  const total = equipment.length;
  const operativo = equipment.filter((e) => e.status === 'operativo').length;
  const alerta = equipment.filter((e) => e.status === 'alerta').length;
  const taller = equipment.filter((e) => e.status === 'taller').length;
  const inactivo = equipment.filter((e) => e.status === 'inactivo').length;
  const disponibilidad = total > 0 ? Math.round(((operativo + alerta) / total) * 100) : 0;

  const equiposTaller = equipment.filter((e) => e.status === 'taller');
  const equiposAlerta = equipment.filter((e) => e.status === 'alerta');

  const greeting =
    new Date().getHours() < 12
      ? 'Buenos días'
      : new Date().getHours() < 18
        ? 'Buenas tardes'
        : 'Buenas noches';

  return (
    <div className="flex flex-col py-4 animate-fade-up">
      {/* Greeting */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-text">{greeting}, {userName}</h1>
        <p className="text-text-secondary text-sm mt-0.5">Supervisor de Producción</p>
      </div>

      {/* KPI grid 2x2 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <KPICard
          icon={<Activity size={20} />}
          value={`${disponibilidad}%`}
          label="Disponibilidad"
          color="#16A34A"
        />
        <KPICard
          icon={<Wrench size={20} />}
          value={taller}
          label="En Taller"
          color="#DC2626"
        />
        <KPICard
          icon={<ShieldAlert size={20} />}
          value={alerta}
          label="Alertas"
          color="#F59E0B"
        />
        <KPICard
          icon={<ShieldOff size={20} />}
          value={inactivo}
          label="Inactivos"
          color="#9CA3AF"
        />
      </div>

      {/* Quick actions 2-column grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {ACTION_CARDS.map(({ label, icon, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex flex-col items-center justify-center gap-2 bg-white rounded-xl p-4 shadow-sm border border-border btn-press"
            style={{ minHeight: 100 }}
          >
            {icon}
            <span className="text-sm font-medium text-center text-text">{label}</span>
          </button>
        ))}
      </div>

      {/* Equipos en Taller */}
      <h2 className="font-semibold text-text mt-2 mb-3">Equipos en Taller</h2>
      <div className="flex flex-col gap-3 mb-6">
        {equiposTaller.length > 0 ? (
          equiposTaller.map((equipment) => (
            <EquipmentCard key={equipment.unit_id} equipment={equipment} />
          ))
        ) : (
          <div className="bg-green-50 border border-success rounded-lg p-3">
            <p className="text-sm font-medium text-success text-center">
              Todos los equipos operativos ✓
            </p>
          </div>
        )}
      </div>

      {/* Equipos en Alerta */}
      <h2 className="font-semibold text-text mt-2 mb-3">Equipos en Alerta</h2>
      <div className="flex flex-col gap-3">
        {equiposAlerta.length > 0 ? (
          equiposAlerta.map((equipment) => (
            <EquipmentCard key={equipment.unit_id} equipment={equipment} />
          ))
        ) : (
          <div className="bg-green-50 border border-success rounded-lg p-3">
            <p className="text-sm font-medium text-success text-center">
              Sin alertas activas ✓
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## `src/pages/CoordinatorHomePage.tsx`

```typescript
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wrench,
  CalendarCheck,
  Package,
  Clock,
  ShoppingCart,
  AlertTriangle,
  ClipboardList,
  Flame,
  Timer,
  Archive,
  RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { useWorkOrderStore } from '../stores/workorder-store';
import { useEquipmentList } from '../hooks/useEquipmentList';
import { getNextPM } from '../data/pm-rules';
import KPICard from '../components/ui/KPICard';
import OTCard from '../components/ui/OTCard';

interface ActionCard {
  label: string;
  icon: React.ReactNode;
  path: string;
}

const ACTION_CARDS: ActionCard[] = [
  { label: 'Órdenes',    icon: <Wrench       size={32} className="text-amber" />, path: '/workorders' },
  { label: 'Orden PM',   icon: <CalendarCheck size={32} className="text-amber" />, path: '/pm-order' },
  { label: 'Inventario', icon: <Package      size={32} className="text-amber" />, path: '/inventory' },
  { label: 'Programa PM',icon: <Clock        size={32} className="text-amber" />, path: '/pm' },
  { label: 'Pedidos',    icon: <ShoppingCart size={32} className="text-amber" />, path: '/pedidos' },
  { label: 'Alertas',    icon: <AlertTriangle size={32} className="text-amber" />, path: '/alerts' },
];

export default function CoordinatorHomePage() {
  const navigate  = useNavigate();
  const userName  = useAuthStore((s) => s.userName);
  const equipment = useEquipmentList();
  const { workorders, fetched, fetchWorkOrders, loading } = useWorkOrderStore();

  useEffect(() => {
    if (!fetched) fetchWorkOrders();
  }, [fetched, fetchWorkOrders]);

  const openOTs     = workorders.filter((ot) => ot.estado !== 'Completado');
  const criticalOTs = workorders.filter((ot) => ot.prioridad === 'CRITICA' && ot.estado !== 'Completado');

  const pmProximos = equipment.filter((e) => {
    const pm = getNextPM(e.model, e.current_horometro);
    return pm.hours_remaining <= 50;
  }).length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div className="flex flex-col py-4 animate-fade-up">
      {/* Greeting */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-text">{greeting}, {userName}</h1>
          <p className="text-text-secondary text-sm mt-0.5">Coordinador de Mantenimiento</p>
        </div>
        <button
          onClick={() => useWorkOrderStore.setState({ fetched: false })}
          className="p-2 rounded-full"
          style={{ color: '#162252' }}
          aria-label="Actualizar"
        >
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* KPI grid 2×2 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <KPICard
          icon={<ClipboardList size={20} />}
          value={loading ? '…' : openOTs.length}
          label="OTs Abiertas"
          color="#2563EB"
        />
        <KPICard
          icon={<Flame size={20} />}
          value={loading ? '…' : criticalOTs.length}
          label="OTs Críticas"
          color="#DC2626"
        />
        <KPICard
          icon={<Timer size={20} />}
          value={pmProximos}
          label="PM Próximos"
          color="#F59E0B"
        />
        <KPICard
          icon={<Archive size={20} />}
          value="—"
          label="Stock Crítico"
          color="#EA580C"
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {ACTION_CARDS.map(({ label, icon, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex flex-col items-center justify-center gap-2 bg-white rounded-xl p-4 shadow-sm border border-border btn-press"
            style={{ minHeight: 100 }}
          >
            {icon}
            <span className="text-sm font-medium text-center text-text">{label}</span>
          </button>
        ))}
      </div>

      {/* OTs Pendientes */}
      <h2 className="font-semibold text-text mt-2 mb-3">OTs Pendientes</h2>
      <div className="flex flex-col">
        {loading ? (
          <div className="text-center py-6 text-text-secondary text-sm">Cargando…</div>
        ) : openOTs.length > 0 ? (
          openOTs.map((ot) => (
            <OTCard
              key={ot.ot_id}
              workorder={ot}
              onClick={() => navigate(`/workorders/${ot.ot_id}`)}
            />
          ))
        ) : (
          <div className="bg-green-50 border border-success rounded-lg p-3">
            <p className="text-sm font-medium text-success text-center">
              Sin órdenes pendientes ✓
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## `src/pages/WorkshopHomePage.tsx`

```typescript
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wrench,
  Clock,
  Package,
  CalendarCheck,
  BookOpen,
  FileImage,
  HardHat,
  ClipboardList,
  Users,
  PackageSearch,
  Disc3,
  RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { useWorkOrderStore } from '../stores/workorder-store';
import { readRange, SHEET_TABS } from '../lib/sheets-api';
import { useEquipmentList } from '../hooks/useEquipmentList';
import KPICard from '../components/ui/KPICard';
import EquipmentCard from '../components/ui/EquipmentCard';
import OTCard from '../components/ui/OTCard';

const MECANICOS_HEADCOUNT = 12;

interface ActionCard {
  label: string;
  icon: React.ReactNode;
  path: string;
}

const ACTION_CARDS: ActionCard[] = [
  { label: 'Órdenes',  icon: <Wrench       size={32} className="text-amber" />, path: '/workorders' },
  { label: 'PM',       icon: <Clock        size={32} className="text-amber" />, path: '/pm' },
  { label: 'Partes',   icon: <Package      size={32} className="text-amber" />, path: '/parts' },
  { label: 'Orden PM', icon: <CalendarCheck size={32} className="text-amber" />, path: '/pm-order' },
  { label: 'Manuales', icon: <BookOpen     size={32} className="text-amber" />, path: '/manuals' },
  { label: 'Diagramas',icon: <FileImage    size={32} className="text-amber" />, path: '/diagrams' },
  { label: 'Neumáticos',icon: <Disc3       size={32} className="text-amber" />, path: '/neumaticos' },
];

export default function WorkshopHomePage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);
  const equipment = useEquipmentList();

  // ── Real OT data ────────────────────────────────────────────────────────
  const { workorders, fetched, fetchWorkOrders, loading: otLoading } = useWorkOrderStore();

  useEffect(() => {
    if (!fetched) fetchWorkOrders();
  }, [fetched, fetchWorkOrders]);

  const otsActivas   = workorders.filter((ot) => ot.estado !== 'Completado');
  const otsEnProceso = workorders.filter((ot) => ot.estado === 'En Reparación');

  // ── En Taller: unique units with active OTs, resolved from catalog ──────
  const unitsEnTaller = [...new Set(otsActivas.map((ot) => ot.unidad).filter(Boolean))];
  const equiposTaller = unitsEnTaller
    .map((uid) => equipment.find((e) => e.unit_id === uid))
    .filter((e): e is (typeof equipment)[0] => e !== undefined);

  // ── Partes Pendientes from Cotizaciones_Pendientes ──────────────────────
  const [partesPendientes, setPartesPendientes] = useState<number | null>(null);

  useEffect(() => {
    readRange(SHEET_TABS.COTIZACIONES)
      .then((rows) => {
        const count = rows.slice(1).filter((r) => (r[6] ?? '').trim() === 'Pendiente').length;
        setPartesPendientes(count);
      })
      .catch(() => setPartesPendientes(0));
  }, []);

  // ── Refresh all ─────────────────────────────────────────────────────────
  function handleRefresh() {
    useWorkOrderStore.setState({ fetched: false });
    fetchWorkOrders();
    setPartesPendientes(null);
    readRange(SHEET_TABS.COTIZACIONES)
      .then((rows) => {
        const count = rows.slice(1).filter((r) => (r[6] ?? '').trim() === 'Pendiente').length;
        setPartesPendientes(count);
      })
      .catch(() => setPartesPendientes(0));
  }

  // ── Greeting ────────────────────────────────────────────────────────────
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';

  const isLoading = otLoading || partesPendientes === null;

  return (
    <div className="flex flex-col py-4 animate-fade-up">
      {/* Greeting */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-text">{greeting}, {userName}</h1>
          <p className="text-text-secondary text-sm mt-0.5">Jefe de Taller</p>
        </div>
        <button
          onClick={handleRefresh}
          className="p-2 rounded-full"
          style={{ color: '#162252' }}
          aria-label="Actualizar"
        >
          <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* KPI grid 2×2 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <KPICard
          icon={<HardHat size={20} />}
          value={otLoading ? '…' : equiposTaller.length}
          label="En Taller"
          color="#DC2626"
        />
        <KPICard
          icon={<ClipboardList size={20} />}
          value={otLoading ? '…' : otsActivas.length}
          label="OTs Activas"
          color="#2563EB"
        />
        <KPICard
          icon={<Users size={20} />}
          value={MECANICOS_HEADCOUNT}
          label="Mecánicos"
          color="#16A34A"
        />
        <KPICard
          icon={<PackageSearch size={20} />}
          value={partesPendientes === null ? '…' : partesPendientes}
          label="Partes Pendientes"
          color="#F59E0B"
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {ACTION_CARDS.map(({ label, icon, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex flex-col items-center justify-center gap-2 bg-white rounded-xl p-4 shadow-sm border border-border btn-press"
            style={{ minHeight: 100 }}
          >
            {icon}
            <span className="text-sm font-medium text-center text-text">{label}</span>
          </button>
        ))}
      </div>

      {/* En el Taller Ahora */}
      <h2 className="font-semibold text-text mt-2 mb-3">En el Taller Ahora</h2>
      <div className="flex flex-col gap-3 mb-6">
        {otLoading ? (
          <div className="text-center py-6 text-text-secondary text-sm">Cargando…</div>
        ) : equiposTaller.length > 0 ? (
          equiposTaller.map((equipment) => (
            <EquipmentCard key={equipment.unit_id} equipment={equipment} />
          ))
        ) : (
          <div className="bg-green-50 border border-success rounded-lg p-3">
            <p className="text-sm font-medium text-success text-center">Taller vacío ✓</p>
          </div>
        )}
      </div>

      {/* OTs en Proceso */}
      <h2 className="font-semibold text-text mt-2 mb-3">OTs en Proceso</h2>
      <div className="flex flex-col">
        {otLoading ? (
          <div className="text-center py-6 text-text-secondary text-sm">Cargando…</div>
        ) : otsEnProceso.length > 0 ? (
          otsEnProceso.map((ot) => (
            <OTCard
              key={ot.ot_id}
              workorder={ot}
              onClick={() => navigate(`/workorders/${ot.ot_id}`)}
            />
          ))
        ) : (
          <div className="bg-green-50 border border-success rounded-lg p-3">
            <p className="text-sm font-medium text-success text-center">Sin órdenes en proceso ✓</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

