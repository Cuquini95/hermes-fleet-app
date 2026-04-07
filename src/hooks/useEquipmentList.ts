import { useEffect } from 'react';
import { useEquipmentStore } from '../stores/equipment-store';
import { EQUIPMENT_CATALOG } from '../data/equipment-catalog';
import type { Equipment } from '../types/equipment';

/**
 * Returns the live equipment list from the "01 Inventario" Google Sheet.
 * Falls back to the static EQUIPMENT_CATALOG while the sheet is loading
 * or if the fetch fails.
 */
export function useEquipmentList(): Equipment[] {
  const { equipment, fetched, fetchEquipment } = useEquipmentStore();

  useEffect(() => {
    fetchEquipment();
  }, [fetchEquipment]);

  // Use live data once available; static catalog while loading
  return fetched && equipment.length > 0 ? equipment : EQUIPMENT_CATALOG;
}

/**
 * Look up a single unit by ID from the live store (or static fallback).
 */
export function useEquipmentById(unit_id: string): Equipment | undefined {
  const equipment = useEquipmentList();
  return equipment.find((e) => e.unit_id === unit_id);
}
