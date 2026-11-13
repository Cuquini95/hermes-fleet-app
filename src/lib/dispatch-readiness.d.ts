import type { Equipment } from '../types/equipment';

export type DispatchReadinessLevel = 'ok' | 'restricted' | 'blocked';
export type DispatchReadinessSource = 'sticker' | 'dvir' | 'averia' | 'retorno' | 'none';

export interface UnitDispatchReadiness {
  unitId: string;
  level: DispatchReadinessLevel;
  source: DispatchReadinessSource;
  label: string;
  reason: string;
  effectiveStatus?: Equipment['status'];
  folio?: string;
  expiresOn?: string;
}

export interface PendingOperationalReturn { otId: string; unit: string }

export function normalizeUnitId(value: string): string;
export function buildDispatchReadinessMap(stickerRows: string[][], dvirRows: string[][], today?: Date,
  pendingReturns?: PendingOperationalReturn[], failureRows?: string[][]): Map<string, UnitDispatchReadiness>;
export function activeFailureUnits(rows: string[][]): Set<string>;
export function applyDispatchReadiness(unit: Equipment, readiness: UnitDispatchReadiness | undefined): Equipment;
