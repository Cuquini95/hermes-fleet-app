import { describe, it, expect } from 'vitest';
import { useEquipmentList, useEquipmentById } from './useEquipmentList';
import { EQUIPMENT_CATALOG } from '../data/equipment-catalog';
import type { Equipment } from '../types/equipment';

// useEquipmentList is a pure function returning the hardcoded catalog.
// No React context is needed — we can call it directly in unit tests.

describe('useEquipmentList', () => {
  it('returns an array of Equipment objects', () => {
    const list = useEquipmentList();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  it('returns the same reference as EQUIPMENT_CATALOG (no copy created)', () => {
    const list = useEquipmentList();
    expect(list).toBe(EQUIPMENT_CATALOG);
  });

  it('each item has the required Equipment shape', () => {
    const list = useEquipmentList();
    const requiredKeys: (keyof Equipment)[] = [
      'unit_id',
      'model',
      'type',
      'client',
      'status',
      'current_horometro',
      'next_pm_level',
      'next_pm_horometro',
      'last_inspection_date',
      'last_inspection_result',
      'assigned_operator',
    ];
    for (const item of list) {
      for (const key of requiredKeys) {
        expect(item, `item ${item.unit_id} should have key ${key}`).toHaveProperty(key);
      }
    }
  });

  it('all unit_ids are non-empty strings', () => {
    const list = useEquipmentList();
    for (const item of list) {
      expect(typeof item.unit_id).toBe('string');
      expect(item.unit_id.length).toBeGreaterThan(0);
    }
  });

  it('all unit_ids are unique', () => {
    const list = useEquipmentList();
    const ids = list.map((e) => e.unit_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all current_horometro values are numbers', () => {
    const list = useEquipmentList();
    for (const item of list) {
      expect(typeof item.current_horometro).toBe('number');
    }
  });

  it('returns at least one Camión Articulado', () => {
    const list = useEquipmentList();
    const trucks = list.filter((e) => e.type === 'Camión Articulado');
    expect(trucks.length).toBeGreaterThan(0);
  });

  it('returns consistent results across multiple calls (memoized/stable)', () => {
    const first = useEquipmentList();
    const second = useEquipmentList();
    expect(first).toBe(second);
  });
});

describe('useEquipmentById', () => {
  it('returns the equipment with the given unit_id', () => {
    const list = useEquipmentList();
    const firstId = list[0].unit_id;
    const found = useEquipmentById(firstId);
    expect(found).toBeDefined();
    expect(found?.unit_id).toBe(firstId);
  });

  it('returns undefined for a unit_id that does not exist', () => {
    const found = useEquipmentById('NONEXISTENT-999');
    expect(found).toBeUndefined();
  });

  it('returns the correct item when multiple units exist', () => {
    const list = useEquipmentList();
    if (list.length < 2) return; // guard for small catalogs
    const target = list[list.length - 1];
    const found = useEquipmentById(target.unit_id);
    expect(found?.unit_id).toBe(target.unit_id);
    expect(found?.model).toBe(target.model);
  });
});
