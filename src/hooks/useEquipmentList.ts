import { useEffect } from 'react';
import { useEquipmentStore } from '../stores/equipment-store';
import type { Equipment } from '../types/equipment';

/**
 * Returns the live fleet roster from Google Sheets ("01 Inventario").
 * Triggers a one-time fetch on first mount; subsequent calls reuse store state.
 */
export function useEquipmentList(): Equipment[] {
  const equipment = useEquipmentStore((s) => s.equipment);
  const fetchEquipment = useEquipmentStore((s) => s.fetchEquipment);

  useEffect(() => {
    void fetchEquipment();
  }, [fetchEquipment]);

  return equipment;
}

/** Look up a single unit by ID from the live roster. */
export function useEquipmentById(unit_id: string): Equipment | undefined {
  const equipment = useEquipmentList();
  return equipment.find((e) => e.unit_id === unit_id);
}
