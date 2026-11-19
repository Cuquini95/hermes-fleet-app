const officials = ['gerencia'];
const fieldManagement = ['supervisor', 'coordinador', 'gerencia'];
const workshopManagement = ['jefe_taller', 'coordinador', 'supervisor', 'gerencia'];

export const PANAMA_ROLE_HOME = '/panama/inicio';

// Position selects an entry screen. Existing role and capability checks control every operation.
export const PANAMA_ROLE_HOMES = Object.freeze({
  'TP-PER-001': { title: 'Gerencia General', roles: officials, actions: ['command', 'fleet', 'payables', 'masters'] },
  'TP-PER-002': { title: 'Dirección de Operaciones', roles: ['gerencia', 'supervisor'], actions: ['approve', 'command', 'shifts', 'returns', 'fleet'] },
  'TP-PER-003': { title: 'Proyectos y contratos', roles: ['gerencia', 'coordinador'], actions: ['accepted', 'masters', 'expenses', 'fleet'],
    pending: 'Hitos, cambios y reclamos del contrato' },
  'TP-PER-004': { title: 'Administración de Proyecto', roles: fieldManagement, actions: ['shifts', 'fleet', 'masters'] },
  'TP-PER-005': { title: 'Control de costos', roles: ['gerencia', 'coordinador'], actions: ['expenses', 'orders', 'masters'],
    pending: 'Presupuesto y saldo comprometido por proyecto' },
  'TP-PER-006': { title: 'Movimiento de tierras', roles: fieldManagement, actions: ['fleet', 'shifts', 'downtime'] },
  'TP-PER-007': { title: 'Transporte y acarreo', roles: ['supervisor', 'gerencia'], actions: ['haulage', 'shifts', 'fleet'],
    pending: 'Conciliación con báscula y remisiones' },
  'TP-PER-008': { title: 'Despacho y producción', roles: fieldManagement, actions: ['dispatch', 'accepted', 'fleet', 'masters'] },
  'TP-PER-009': { title: 'Supervisión de turno', roles: ['supervisor'], actions: ['reviewShift', 'returns', 'shifts', 'inspection'] },
  'TP-PER-010': { title: 'Mantenimiento y activos', roles: workshopManagement, actions: ['orders', 'pm', 'downtime', 'tires'] },
  'TP-PER-011': { title: 'Jefatura de Taller', roles: ['jefe_taller'], actions: ['partQueue', 'orders', 'planner', 'pm'] },
  'TP-PER-012': { title: 'Planeación de mantenimiento', roles: ['coordinador', 'jefe_taller'], actions: ['pm', 'pmOrder', 'planner', 'orders'] },
  'TP-PER-013': { title: 'Supervisión técnica', roles: workshopManagement, actions: ['reviewRepair', 'orders', 'planner', 'manuals'] },
  'TP-PER-014': { title: 'Mis órdenes', roles: ['mecanico'], actions: ['orders', 'manuals', 'profile'] },
  'TP-PER-015': { title: 'Llantas y componentes', roles: workshopManagement, actions: ['tires', 'orders', 'inventory'] },
  'TP-PER-016': { title: 'Compras', roles: officials, actions: ['requests', 'quotes', 'purchaseOrders', 'vendors'] },
  'TP-PER-017': { title: 'Almacén', roles: ['almacen', 'jefe_taller'], actions: ['warehouseQueue', 'receive', 'inventory', 'count'] },
  'TP-PER-019': { title: 'Gerencia HSE', roles: ['supervisor', 'gerencia'], actions: ['hseReview', 'fleet', 'alerts'],
    pending: 'Registro corporativo de incidentes y acciones' },
  'TP-PER-020': { title: 'Supervisión HSE', roles: ['supervisor', 'gerencia'], actions: ['hseReview', 'sticker', 'fleet'] },
  'TP-PER-021': { title: 'Finanzas', roles: officials, actions: ['payables', 'expenses', 'accepted', 'masters'],
    pending: 'Caja y saldo de cobros en el corte financiero' },
  'TP-PER-022': { title: 'Tesorería', roles: officials, actions: ['payment', 'payables'],
    pending: 'Cobros de TMF en el maestro MOVIMIENTOS' },
  'TP-PER-023': { title: 'Contabilidad', roles: officials, actions: ['invoices', 'payables', 'expenses'] },
  'TP-PER-025': { title: 'Contratos y valorizaciones', roles: ['gerencia', 'coordinador'], actions: ['accepted', 'masters'],
    pending: 'Observaciones y retenciones del contrato' },
  'TP-PER-026': { title: 'Sistemas de Flota', roles: ['operador', 'coordinador', 'gerencia'], actions: ['profile'] },
  'TP-PER-027': { title: 'Mi turno', roles: ['operador'], actions: ['inspection', 'meter', 'failure', 'shifts', 'reports'] },
  'TP-PER-028': { title: 'Conductor de acarreo', roles: ['operador'], actions: ['haulage', 'inspection', 'shifts', 'reports'] },
});

export function panamaRoleHome(profile) {
  if (profile?.project !== 'tmf-panama' || !Object.hasOwn(PANAMA_ROLE_HOMES, profile.positionCode)) return undefined;
  const entry = PANAMA_ROLE_HOMES[profile.positionCode];
  return entry.roles.includes(profile.role) ? entry : undefined;
}
