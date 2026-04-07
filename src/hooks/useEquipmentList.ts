import { useEffect } from 'react';
import { useEquipmentStore } from '../stores/equipment-store';
import { EQUIPMENT_CATALOG } from '../data/equipment-catalog';
import type { Equipment } from '../types/equipment';

/**
 * Returns equipment instantly from the hardcoded catalog.
 * Also kicks off a background fetch from "01 Inventario" to overlay
 * live status / horómetro data on the fleet dashboard.
 */
export function useEquipmentList(): Equipment[] {
  const { equipment, fetchEquipment } = useEquipmentStore();

  useEffect(() => {
    fetchEquipment();
  }, [fetchEquipment]);

  // Live sheet data takes over once loaded; catalog is instant fallback
  return equipment.length > 0 ? equipment : EQUIPMENT_CATALOG;
}

/**
 * Look up a single unit by ID — instant from catalog, upgrades to live data.
 */
export function useEquipmentById(unit_id: string): Equipment | undefined {
  const equipment = useEquipmentList();
  return equipment.find((e) => e.unit_id === unit_id);
}
