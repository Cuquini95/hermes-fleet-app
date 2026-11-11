import type { AppRole } from '../types/roles';

export const ALL: AppRole[] = ['operador', 'mecanico', 'jefe_taller', 'coordinador', 'supervisor', 'gerencia'];
export const ADMIN: AppRole[] = ['jefe_taller', 'coordinador', 'supervisor', 'gerencia'];
export const WORKSHOP: AppRole[] = ['mecanico', ...ADMIN];
export const MANAGEMENT: AppRole[] = ['jefe_taller', 'coordinador', 'gerencia'];
export const FIELD: AppRole[] = ['operador', 'supervisor', 'gerencia'];
const OFFICE: AppRole[] = ['gerencia'];

export interface AppAction {
  label: string;
  path: string;
  icon: string;
  roles: AppRole[];
}

interface HermesApp {
  id: string;
  label: string;
  icon: string;
  actions: AppAction[];
  related?: string[];
}

export const APPS: HermesApp[] = [
  { id: 'flete', label: 'Flete', icon: 'Truck', actions: [
    { label: 'Registrar viaje', path: '/flete', icon: 'MapPin', roles: FIELD },
    { label: 'Cargar boletas', path: '/bulk-boletas', icon: 'FileText', roles: [...FIELD, 'coordinador'] },
  ], related: ['/viaje'] },
  { id: 'pm', label: 'PM', icon: 'CalendarCheck', actions: [
    { label: 'Programa PM', path: '/pm', icon: 'CalendarDays', roles: ADMIN },
    { label: 'Crear orden PM', path: '/pm-order', icon: 'CalendarCheck', roles: ADMIN },
    { label: 'Registrar horómetro', path: '/horometro', icon: 'Gauge', roles: FIELD },
  ] },
  { id: 'averias', label: 'Averías', icon: 'Wrench', actions: [
    { label: 'Reportar falla', path: '/falla', icon: 'Camera', roles: ALL },
    { label: 'Ver órdenes', path: '/workorders', icon: 'Wrench', roles: WORKSHOP },
  ], related: ['/workorders/:otId'] },
  { id: 'inspecciones', label: 'Inspecciones', icon: 'ClipboardCheck', actions: [
    { label: 'Checklist diario', path: '/dvir', icon: 'ClipboardCheck', roles: FIELD },
    { label: 'Inspección de 15 días', path: '/sticker-inspection', icon: 'BadgeCheck', roles: ALL },
  ], related: ['/dvir-compliance'] },
  { id: 'llantas', label: 'Llantas', icon: 'Disc3', actions: [
    { label: 'Revisar llantas', path: '/neumaticos', icon: 'Disc3', roles: ADMIN },
  ] },
  { id: 'partes', label: 'Partes', icon: 'Package', actions: [
    { label: 'Buscar parte', path: '/parts', icon: 'Package', roles: WORKSHOP },
    { label: 'Inventario', path: '/inventory', icon: 'Table2', roles: ADMIN },
    { label: 'Solicitar partes', path: '/pedidos', icon: 'ShoppingCart', roles: ADMIN },
  ], related: ['/parts/import', '/manuals', '/diagrams'] },
  { id: 'compras-oc', label: 'Compras OC', icon: 'ShoppingCart', actions: [
    { label: 'Órdenes de compra', path: '/admin/ordenes-compra', icon: 'FileText', roles: OFFICE },
    { label: 'Proveedores', path: '/admin/proveedores', icon: 'Package', roles: OFFICE },
  ], related: ['/admin/ordenes-compra/:ocId'] },
  { id: 'gastos', label: 'Gastos', icon: 'Receipt', actions: [
    { label: 'Nuevo gasto', path: '/gastos/nuevo', icon: 'Receipt', roles: MANAGEMENT },
    { label: 'Ver gastos', path: '/gastos', icon: 'FileText', roles: MANAGEMENT },
  ] },
];

export const appUrl = (app: HermesApp) => `/apps/${app.id}`;

export function getActiveApp(pathname: string) {
  const [, section, id] = pathname.split('/');
  return section === 'apps' ? APPS.find((app) => app.id === id) : undefined;
}
