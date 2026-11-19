import { ROLE_HOME, type AppRole, type NavItem } from '../types/roles';
import { PANAMA_ROLE_HOME, panamaRoleHome } from '../data/panama-role-homes.js';

interface PurchasingProfile {
  project: string;
  role: AppRole | null;
  canApprovePurchases?: boolean;
  canReceivePurchases?: boolean;
  canRecordPurchaseInvoices?: boolean;
  canRecordPurchasePayments?: boolean;
  previewDemo?: boolean;
  positionCode?: string;
}

type PurchasingEntry = NavItem & { accessLabel: string };
const receiving: PurchasingEntry = {
  id: 'recepciones', label: 'Recepciones', accessLabel: 'Recepciones', icon: 'Package', path: '/panama/recepciones',
};
const orders: PurchasingEntry = {
  id: 'pedidos', label: 'Pedidos', accessLabel: 'Aprobación de OC', icon: 'ShoppingCart', path: '/pedidos',
};
const invoices: PurchasingEntry = {
  id: 'contabilidad', label: 'Por conciliar', accessLabel: 'Registro de facturas', icon: 'Receipt',
  path: '/panama/cuentas-por-pagar?bandeja=conciliar#facturas',
};
const payments: PurchasingEntry = {
  id: 'tesoreria', label: 'Por pagar', accessLabel: 'Registro de pagos', icon: 'Receipt',
  path: '/panama/cuentas-por-pagar?bandeja=pagar#facturas',
};

export function purchasingEntry(profile: PurchasingProfile): PurchasingEntry | undefined {
  if (!profile.role || profile.project !== 'tmf-panama') return undefined;
  if (profile.canReceivePurchases && !profile.canApprovePurchases) return receiving;
  if (profile.role !== 'gerencia') return undefined;
  if (profile.canApprovePurchases) return orders;
  if (profile.canRecordPurchaseInvoices && !profile.canRecordPurchasePayments) return invoices;
  if (profile.canRecordPurchasePayments && !profile.canRecordPurchaseInvoices) return payments;
}

export function canOpenPanamaPayables(profile: PurchasingProfile): boolean {
  if (profile.project !== 'tmf-panama' || profile.role !== 'gerencia') return false;
  if (!profile.previewDemo) return true;
  const entry = purchasingEntry(profile);
  return entry === invoices || entry === payments;
}

export function sessionHome(profile: PurchasingProfile, returnTo?: unknown): string {
  // eslint-disable-next-line no-control-regex -- reject control characters in saved destinations
  if (typeof returnTo === 'string' && /^\/(?![/\\])[^\\\x00-\x20]*$/.test(returnTo)) return returnTo;
  if (panamaRoleHome(profile)) return PANAMA_ROLE_HOME;
  return purchasingEntry(profile)?.path ?? (profile.role ? ROLE_HOME[profile.role] : '/');
}
