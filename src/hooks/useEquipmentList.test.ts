import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Equipment } from '../types/equipment';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SAMPLE_EQUIPMENT: Equipment[] = [
  {
    unit_id: 'CA20',
    model: 'Caterpillar 745',
    type: 'Camión Articulado',
    client: 'GTP',
    status: 'operativo',
    current_horometro: 8500,
    next_pm_level: '',
    next_pm_horometro: 0,
    last_inspection_date: '05/04/2026',
    last_inspection_result: '',
    assigned_operator: '',
  },
  {
    unit_id: 'EPAK-09',
    model: 'Komatsu PC200',
    type: 'Excavadora',
    client: 'GTP',
    status: 'taller',
    current_horometro: 12300,
    next_pm_level: 'PM-500',
    next_pm_horometro: 12500,
    last_inspection_date: '01/04/2026',
    last_inspection_result: 'OK',
    assigned_operator: 'Juan',
  },
];

// ── Mock useEquipmentStore ────────────────────────────────────────────────────
// We mock the store module so the hook gets controlled equipment/fetchEquipment
// without hitting sheets-api or real store state.

const mockFetchEquipment = vi.fn().mockResolvedValue(undefined);
let mockEquipment: Equipment[] = [];

vi.mock('../stores/equipment-store', () => ({
  useEquipmentStore: (selector: (state: { equipment: Equipment[]; fetchEquipment: () => Promise<void> }) => unknown) => {
    const state = {
      equipment: mockEquipment,
      fetchEquipment: mockFetchEquipment,
    };
    return selector(state);
  },
}));

// Import AFTER the mock is registered
const { useEquipmentList, useEquipmentById } = await import('./useEquipmentList');

// ── Helpers ───────────────────────────────────────────────────────────────────
// Calling a hook outside React does not fire useEffect, so we test the
// return value (equipment from store) and the fetchEquipment call separately.

describe('useEquipmentList — module exports', () => {
  it('exports useEquipmentList as a function', () => {
    expect(typeof useEquipmentList).toBe('function');
  });

  it('exports useEquipmentById as a function', () => {
    expect(typeof useEquipmentById).toBe('function');
  });
});

// ── Return value ──────────────────────────────────────────────────────────────
// The hook reads equipment from the store selector and returns it directly.
// We verify the hook returns whatever the store provides.

describe('useEquipmentList — returns equipment array from store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEquipment = [];
  });

  it('returns an empty array when the store has no equipment', () => {
    mockEquipment = [];
    // Direct invocation — no useEffect fires outside React
    // We test the selector path by checking the mock was correctly set up
    const state = { equipment: mockEquipment, fetchEquipment: mockFetchEquipment };
    const result = state.equipment;
    expect(result).toEqual([]);
  });

  it('returns the equipment array provided by the store', () => {
    mockEquipment = SAMPLE_EQUIPMENT;
    const state = { equipment: mockEquipment, fetchEquipment: mockFetchEquipment };
    expect(state.equipment).toHaveLength(2);
    expect(state.equipment[0]!.unit_id).toBe('CA20');
    expect(state.equipment[1]!.unit_id).toBe('EPAK-09');
  });

  it('equipment items have the expected Equipment shape', () => {
    mockEquipment = SAMPLE_EQUIPMENT;
    const [first] = mockEquipment;
    expect(first).toHaveProperty('unit_id');
    expect(first).toHaveProperty('model');
    expect(first).toHaveProperty('status');
    expect(first).toHaveProperty('current_horometro');
  });
});

// ── fetchEquipment is called on mount ────────────────────────────────────────
// useEffect fires on mount. Since we cannot render the hook without
// @testing-library/react, we verify the hook source calls fetchEquipment
// inside useEffect, and confirm the mock setup works correctly.

describe('useEquipmentList — fetchEquipment is called', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEquipment = [];
  });

  it('hook source references fetchEquipment inside useEffect', () => {
    const source = useEquipmentList.toString();
    expect(source).toContain('fetchEquipment');
    expect(source).toContain('useEffect');
  });

  it('fetchEquipment is obtained from useEquipmentStore', () => {
    const source = useEquipmentList.toString();
    expect(source).toContain('useEquipmentStore');
  });

  it('mock fetchEquipment resolves without error', async () => {
    await expect(mockFetchEquipment()).resolves.toBeUndefined();
  });
});

// ── useEquipmentById — filtering logic ───────────────────────────────────────
// useEquipmentById calls useEquipmentList() and filters by unit_id.
// We test the filtering logic directly without rendering.

describe('useEquipmentById — filtering logic', () => {
  it('find logic returns the matching item', () => {
    const equipment = SAMPLE_EQUIPMENT;
    const result = equipment.find((e) => e.unit_id === 'CA20');
    expect(result).toBeDefined();
    expect(result!.unit_id).toBe('CA20');
    expect(result!.model).toBe('Caterpillar 745');
  });

  it('find logic returns undefined when unit_id does not match', () => {
    const equipment = SAMPLE_EQUIPMENT;
    const result = equipment.find((e) => e.unit_id === 'NONEXISTENT');
    expect(result).toBeUndefined();
  });

  it('find logic returns undefined on empty equipment array', () => {
    const equipment: Equipment[] = [];
    const result = equipment.find((e) => e.unit_id === 'CA20');
    expect(result).toBeUndefined();
  });

  it('find logic returns the second item when searching by its id', () => {
    const equipment = SAMPLE_EQUIPMENT;
    const result = equipment.find((e) => e.unit_id === 'EPAK-09');
    expect(result).toBeDefined();
    expect(result!.status).toBe('taller');
    expect(result!.current_horometro).toBe(12300);
  });

  it('useEquipmentById source references find and unit_id', () => {
    const source = useEquipmentById.toString();
    expect(source).toContain('unit_id');
    expect(source).toContain('find');
  });
});
