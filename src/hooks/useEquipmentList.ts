import { useEffect } from 'react';
import { useEquipmentStore } from '../stores/equipment-store';
import type { Equipment } from '../types/equipment';

/**
 * Returns the live equipment list from the "01 Inventario" Google Sheet.
 * Returns empty array while loading — no mock/static fallback.
 */
export function useEquipmentList(): Equipment[] {
  const { equipment, fetchEquipment } = useEquipmentStore();

  useEffect(() => {
    fetchEquipment();
  }, [fetchEquipment]);

  return equipment;
}

/**
 * Look up a single unit by ID from the live store (or static fallback).
 */
export function useEquipmentById(unit_id: string): Equipment | undefined {
  const equipment = useEquipmentList();
  return equipment.find((e) => e.unit_id === unit_id);
}
