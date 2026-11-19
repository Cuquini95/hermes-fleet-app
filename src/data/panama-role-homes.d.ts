import type { AppRole } from '../types/roles';

export type PanamaHomeAction =
  | 'command' | 'fleet' | 'payables' | 'masters' | 'approve' | 'shifts' | 'returns' | 'reviewShift' | 'dispatch'
  | 'accepted' | 'expenses' | 'orders' | 'reviewRepair' | 'downtime' | 'haulage' | 'inspection'
  | 'pm' | 'tires' | 'partQueue' | 'planner' | 'pmOrder' | 'manuals' | 'profile'
  | 'inventory' | 'requests' | 'quotes' | 'purchaseOrders' | 'vendors'
  | 'warehouseQueue' | 'receive' | 'count' | 'hseReview' | 'alerts' | 'sticker'
  | 'payment' | 'invoices' | 'meter' | 'failure' | 'reports';

export interface PanamaHomeProfile {
  project: string;
  role: AppRole | null;
  positionCode?: string;
}

export interface PanamaRoleHome {
  title: string;
  roles: AppRole[];
  actions: PanamaHomeAction[];
  pending?: string;
}

export const PANAMA_ROLE_HOME: '/panama/inicio';
export const PANAMA_ROLE_HOMES: Readonly<Record<string, PanamaRoleHome>>;
export function panamaRoleHome(profile: PanamaHomeProfile): PanamaRoleHome | undefined;
