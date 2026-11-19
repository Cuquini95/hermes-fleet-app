import { panamaRoleHome, type PanamaHomeAction, type PanamaHomeProfile } from '../data/panama-role-homes.js';
import { canOpenPanamaPayables } from './purchasing-home';
import type { AppRole, NavItem } from '../types/roles';

export interface PanamaAccessProfile extends PanamaHomeProfile {
  canApprovePurchases?: boolean;
  canReceivePurchases?: boolean;
  canRecordPurchaseInvoices?: boolean;
  canRecordPurchasePayments?: boolean;
  canReviewPanamaHse?: boolean;
  previewDemo?: boolean;
}

interface Action extends Omit<NavItem, 'id'> {
  navLabel?: string;
  roles?: readonly AppRole[];
  canOpen?: (profile: PanamaAccessProfile) => boolean;
}

const management = ['gerencia', 'supervisor', 'coordinador', 'jefe_taller'] as const;
const workshop = [...management, 'mecanico'] as const;
const finance = ['gerencia'] as const;
const operations = ['gerencia', 'supervisor', 'coordinador'] as const;
const field = ['gerencia', 'supervisor', 'operador'] as const;
const receives = (profile: PanamaAccessProfile) => !!profile.canReceivePurchases && !profile.canApprovePurchases;

const actions: Record<PanamaHomeAction, Action> = {
  command: { label: 'Centro de mando', navLabel: 'Tablero', path: '/dashboard', icon: 'BarChart3', roles: ['gerencia', 'supervisor'] },
  fleet: { label: 'Disponibilidad de equipos', navLabel: 'Equipos', path: '/fleet', icon: 'Truck', roles: operations },
  payables: { label: 'Cuentas por pagar', navLabel: 'Pagos', path: '/panama/cuentas-por-pagar', icon: 'Receipt', canOpen: canOpenPanamaPayables },
  masters: { label: 'Maestros TMF', navLabel: 'Maestros', path: '/panama', icon: 'Table2', roles: workshop },
  approve: { label: 'OC por aprobar', navLabel: 'Compras', path: '/admin/ordenes-compra?bandeja=aprobar', icon: 'ShoppingCart', roles: finance,
    canOpen: profile => profile.canApprovePurchases === true },
  shifts: { label: 'Partes de turno', navLabel: 'Partes', path: '/panama/turnos', icon: 'ClipboardCheck', roles: [...operations, 'operador'] },
  returns: { label: 'Retornos pendientes', navLabel: 'Retornos', path: '/workorders?bandeja=retornos', icon: 'Truck', roles: ['supervisor', 'gerencia'] },
  reviewShift: { label: 'Partes por revisar', navLabel: 'Partes', path: '/panama/turnos?estado=por-revisar', icon: 'ClipboardCheck', roles: ['supervisor'] },
  dispatch: { label: 'Asignaciones del turno', navLabel: 'Despacho', path: '/panama/turnos', icon: 'ClipboardCheck', roles: operations },
  accepted: { label: 'Partes aceptados', navLabel: 'Partes', path: '/panama/turnos?estado=aceptados', icon: 'ClipboardCheck', roles: operations },
  expenses: { label: 'Control de gastos', navLabel: 'Gastos', path: '/gastos', icon: 'Receipt', roles: ['gerencia', 'coordinador', 'jefe_taller'] },
  orders: { label: 'Órdenes de trabajo', navLabel: 'Trabajos', path: '/workorders', icon: 'Wrench', roles: workshop },
  reviewRepair: { label: 'Reparaciones por revisar', navLabel: 'Revisión', path: '/workorders?estado=Resuelta', icon: 'Wrench', roles: management },
  downtime: { label: 'Paradas de equipos', navLabel: 'Paradas', path: '/panama/tiempo-caido', icon: 'Clock', roles: management },
  haulage: { label: 'Viajes y boletas', navLabel: 'Viajes', path: '/flete', icon: 'Truck', roles: field },
  inspection: { label: 'Nueva inspección', navLabel: 'Inspecciones', path: '/dvir', icon: 'ClipboardCheck', roles: field },
  pm: { label: 'Mantenimiento PM', navLabel: 'PM', path: '/pm', icon: 'Clock', roles: management },
  tires: { label: 'Llantas y componentes', navLabel: 'Llantas', path: '/neumaticos', icon: 'Disc3', roles: management },
  partQueue: { label: 'Revisar solicitudes de repuestos', navLabel: 'Solicitudes', path: '/workshop?bandeja=repuestos', icon: 'Package', roles: ['jefe_taller'] },
  planner: { label: 'Calendario de Taller', navLabel: 'Calendario', path: '/calendar', icon: 'CalendarDays', roles: management },
  pmOrder: { label: 'Preparar una OT PM', navLabel: 'Orden PM', path: '/pm-order', icon: 'CalendarCheck', roles: ['coordinador', 'jefe_taller', 'gerencia'] },
  manuals: { label: 'Manuales técnicos', navLabel: 'Manuales', path: '/manuals', icon: 'BookOpen', roles: workshop },
  profile: { label: 'Mi perfil', navLabel: 'Perfil', path: '/perfil', icon: 'UserRound' },
  inventory: { label: 'Existencias por almacén', navLabel: 'Existencias', path: '/inventory', icon: 'Boxes', roles: [...management, 'almacen'] },
  requests: { label: 'Pedidos pendientes', navLabel: 'Pedidos', path: '/pedidos', icon: 'ShoppingCart', roles: management },
  quotes: { label: 'Comparar cotizaciones', navLabel: 'Cotizar', path: '/panama/comparar-cotizaciones', icon: 'FileText', roles: finance },
  purchaseOrders: { label: 'Órdenes de compra', navLabel: 'Compras', path: '/admin/ordenes-compra', icon: 'ShoppingCart', roles: finance },
  vendors: { label: 'Proveedores', navLabel: 'Proveedores', path: '/admin/proveedores', icon: 'FileText', roles: finance },
  warehouseQueue: { label: 'Atender solicitudes de OT', navLabel: 'Solicitudes', path: '/inventory?bandeja=solicitudes', icon: 'Package', canOpen: receives },
  receive: { label: 'Recibir compras por partida', navLabel: 'Recepciones', path: '/panama/recepciones', icon: 'Boxes', canOpen: receives },
  count: { label: 'Revisar conteo', navLabel: 'Conteo', path: '/inventory?bandeja=conteo', icon: 'ClipboardCheck', canOpen: receives },
  hseReview: { label: 'Revisar inspecciones HSE', navLabel: 'HSE', path: '/sticker-inspection', icon: 'BadgeCheck',
    roles: ['gerencia', 'supervisor'], canOpen: profile => profile.canReviewPanamaHse === true },
  alerts: { label: 'Alertas', path: '/alerts', icon: 'AlertTriangle', roles: management },
  sticker: { label: 'Inspección de equipos', navLabel: 'Sticker', path: '/sticker-inspection', icon: 'BadgeCheck', roles: ['gerencia', 'supervisor'] },
  payment: { label: 'Registrar pagos', navLabel: 'Pagos', path: '/panama/cuentas-por-pagar?bandeja=pagar#facturas', icon: 'Receipt',
    roles: finance, canOpen: profile => profile.canRecordPurchasePayments === true && canOpenPanamaPayables(profile) },
  invoices: { label: 'Conciliar facturas', navLabel: 'Facturas', path: '/panama/cuentas-por-pagar?bandeja=conciliar#facturas', icon: 'Receipt',
    roles: finance, canOpen: profile => profile.canRecordPurchaseInvoices === true && canOpenPanamaPayables(profile) },
  meter: { label: 'Registrar horómetro', navLabel: 'Horómetro', path: '/horometro', icon: 'Gauge', roles: field },
  failure: { label: 'Reportar una falla', navLabel: 'Fallas', path: '/falla', icon: 'Camera', roles: field },
  reports: { label: 'Mis reportes', path: '/my-reports', icon: 'FileText', roles: field },
};

export function panamaHomeActions(profile: PanamaAccessProfile): (NavItem & { id: PanamaHomeAction; navLabel?: string })[] {
  const home = panamaRoleHome(profile);
  if (!home || !profile.role) return [];
  const role = profile.role;
  const paths = new Set<string>();
  return home.actions.flatMap(id => {
    const { roles, canOpen, ...item } = actions[id];
    if ((roles && !roles.includes(role)) || (canOpen && !canOpen(profile)) || paths.has(item.path)) return [];
    paths.add(item.path);
    return [{ id, ...item }];
  });
}
