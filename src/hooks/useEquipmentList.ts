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
