import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WorkOrder, StatusLogEntry } from '../types/workorder';

// ── Mock external dependencies before importing the store ────────────────────

vi.mock('../lib/sheets-api', () => ({
  readRange: vi.fn(),
  appendRow: vi.fn().mockResolvedValue(undefined),
  updateCell: vi.fn().mockResolvedValue(undefined),
  SHEET_TABS: {
    ORDENES_TRABAJO: 'ORDENES_TRABAJO',
    OT_STATUS_LOG: 'OT_STATUS_LOG',
    AVERIAS: 'Averías',
  },
}));

vi.mock('../lib/supabase', () => ({
  supabase: null,
}));

vi.mock('../lib/date-utils', () => ({
  mexicoDate: vi.fn().mockReturnValue('05/04/2026'),
  mexicoTime: vi.fn().mockReturnValue('10:30:00'),
}));

const { readRange } = await import('../lib/sheets-api');
const { useWorkOrderStore } = await import('./workorder-store');

// ── Helper row builders ───────────────────────────────────────────────────────

function buildOTRow(overrides: Partial<Record<number, string>> = {}): string[] {
  // cols: 0=rowId 1=OT_ID 2=FECHA 3=UNIDAD 4=TIPO 5=DESC 6=SEV 7=PRIO 8=MEC 9=ESTADO
  const base = [
    '1',                    // 0 ROW_ID
    'OT-20260405-1030-ab12', // 1 OT_ID
    '05/04/2026',           // 2 FECHA
    'CA20',                 // 3 UNIDAD
    'Motor',                // 4 TIPO_AVERIA
    'Falla de motor',       // 5 DESCRIPCION
    'Alta',                 // 6 SEVERIDAD
    'MEDIA',                // 7 PRIORIDAD
    'Juan',                 // 8 MECANICO
    'Abierta',              // 9 ESTADO
    '',                     // 10 FOTO_URL
    '',                     // 11 AVERIA_REF
    '',                     // 12 PARTES
    '0',                    // 13 COSTO_ESTIMADO
    '',                     // 14 FECHA_CIERRE
    '',                     // 15 OBSERVACIONES
    '0',                    // 16 PROGRESO
  ];
  for (const [col, val] of Object.entries(overrides)) {
    if (val !== undefined) base[Number(col)] = val;
  }
  return base;
}

function buildLogRow(
  otId: string,
  field: string,
  oldVal: string,
  newVal: string,
  timestamp = '2026-04-05 10:35:00',
): string[] {
  // cols: 0=TIMESTAMP 1=OT_ID 2=FIELD 3=OLD 4=NEW 5=CHANGED_BY 6=ROLE
  return [timestamp, otId, field, oldVal, newVal, 'system', 'admin'];
}

function resetStore() {
  useWorkOrderStore.setState({
    workorders: [],
    statusLog: [],
    loading: false,
    error: null,
    fetched: false,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useWorkOrderStore — fetchWorkOrders', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('parses valid OT rows into workorders', async () => {
    vi.mocked(readRange)
      .mockResolvedValueOnce([buildOTRow()]) // ORDENES_TRABAJO
      .mockResolvedValueOnce([]);             // OT_STATUS_LOG

    await useWorkOrderStore.getState().fetchWorkOrders();

    const { workorders } = useWorkOrderStore.getState();
    expect(workorders).toHaveLength(1);
    expect(workorders[0].ot_id).toBe('OT-20260405-1030-ab12');
    expect(workorders[0].unidad).toBe('CA20');
    expect(workorders[0].estado).toBe('Abierta');
  });

  it('skips rows whose OT_ID does not start with "OT-"', async () => {
    const invalidRow = buildOTRow({ 1: 'INVALID-001' });
    vi.mocked(readRange)
      .mockResolvedValueOnce([invalidRow])
      .mockResolvedValueOnce([]);

    await useWorkOrderStore.getState().fetchWorkOrders();
    expect(useWorkOrderStore.getState().workorders).toHaveLength(0);
  });

  it('sets fetched=true and loading=false after successful fetch', async () => {
    vi.mocked(readRange).mockResolvedValue([]);
    await useWorkOrderStore.getState().fetchWorkOrders();

    const state = useWorkOrderStore.getState();
    expect(state.fetched).toBe(true);
    expect(state.loading).toBe(false);
  });

  it('still sets fetched=true and loading=false when both reads reject (allSettled)', async () => {
    // fetchWorkOrders uses Promise.allSettled, so individual failures don't throw.
    // The store proceeds with empty arrays and marks fetched=true.
    vi.mocked(readRange).mockRejectedValue(new Error('Network failure'));
    await useWorkOrderStore.getState().fetchWorkOrders();

    const state = useWorkOrderStore.getState();
    expect(state.loading).toBe(false);
    expect(state.fetched).toBe(true);
    // workorders and statusLog default to empty arrays on failure
    expect(state.workorders).toHaveLength(0);
  });

  it('does not fire a second fetch when loading=true', async () => {
    useWorkOrderStore.setState({ loading: true });
    await useWorkOrderStore.getState().fetchWorkOrders();
    expect(vi.mocked(readRange)).not.toHaveBeenCalled();
  });
});

describe('applyStatusLog — via fetchWorkOrders', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('applies estado change from log to workorder', async () => {
    const otId = 'OT-20260405-1030-ab12';
    vi.mocked(readRange)
      .mockResolvedValueOnce([buildOTRow({ 1: otId, 9: 'Abierta' })])
      .mockResolvedValueOnce([buildLogRow(otId, 'estado', 'Abierta', 'En Reparación')]);

    await useWorkOrderStore.getState().fetchWorkOrders();
    const wo = useWorkOrderStore.getState().workorders[0];
    expect(wo.estado).toBe('En Reparación');
  });

  it('applies mecanico_asignado change from log', async () => {
    const otId = 'OT-20260405-1030-ab12';
    vi.mocked(readRange)
      .mockResolvedValueOnce([buildOTRow({ 1: otId, 8: 'Juan' })])
      .mockResolvedValueOnce([buildLogRow(otId, 'mecanico_asignado', 'Juan', 'Pedro')]);

    await useWorkOrderStore.getState().fetchWorkOrders();
    expect(useWorkOrderStore.getState().workorders[0].mecanico_asignado).toBe('Pedro');
  });

  it('applies progreso change from log (numeric)', async () => {
    const otId = 'OT-20260405-1030-ab12';
    vi.mocked(readRange)
      .mockResolvedValueOnce([buildOTRow({ 1: otId, 16: '0' })])
      .mockResolvedValueOnce([buildLogRow(otId, 'progreso', '0', '75')]);

    await useWorkOrderStore.getState().fetchWorkOrders();
    expect(useWorkOrderStore.getState().workorders[0].progreso).toBe(75);
  });

  it('applies prioridad change from log', async () => {
    const otId = 'OT-20260405-1030-ab12';
    vi.mocked(readRange)
      .mockResolvedValueOnce([buildOTRow({ 1: otId, 7: 'MEDIA' })])
      .mockResolvedValueOnce([buildLogRow(otId, 'prioridad', 'MEDIA', 'CRITICA')]);

    await useWorkOrderStore.getState().fetchWorkOrders();
    expect(useWorkOrderStore.getState().workorders[0].prioridad).toBe('CRITICA');
  });

  it('applies costo_estimado change from log (numeric)', async () => {
    const otId = 'OT-20260405-1030-ab12';
    vi.mocked(readRange)
      .mockResolvedValueOnce([buildOTRow({ 1: otId, 13: '0' })])
      .mockResolvedValueOnce([buildLogRow(otId, 'costo_estimado', '0', '15000')]);

    await useWorkOrderStore.getState().fetchWorkOrders();
    expect(useWorkOrderStore.getState().workorders[0].costo_estimado).toBe(15000);
  });

  it('applies log entries in timestamp order (earliest first)', async () => {
    const otId = 'OT-20260405-1030-ab12';
    vi.mocked(readRange)
      .mockResolvedValueOnce([buildOTRow({ 1: otId, 9: 'Abierta' })])
      .mockResolvedValueOnce([
        // Deliberately out of order — later timestamp appears first in array
        buildLogRow(otId, 'estado', 'En Reparación', 'Resuelta', '2026-04-05 11:00:00'),
        buildLogRow(otId, 'estado', 'Abierta', 'En Reparación', '2026-04-05 10:35:00'),
      ]);

    await useWorkOrderStore.getState().fetchWorkOrders();
    // Final state should be "Resuelta" (last in timestamp order)
    expect(useWorkOrderStore.getState().workorders[0].estado).toBe('Resuelta');
  });

  it('ignores log entries for unknown OT IDs', async () => {
    const otId = 'OT-20260405-1030-ab12';
    vi.mocked(readRange)
      .mockResolvedValueOnce([buildOTRow({ 1: otId, 9: 'Abierta' })])
      .mockResolvedValueOnce([
        buildLogRow('OT-99999999-0000-zzzz', 'estado', 'Abierta', 'Resuelta'),
      ]);

    await useWorkOrderStore.getState().fetchWorkOrders();
    expect(useWorkOrderStore.getState().workorders[0].estado).toBe('Abierta');
  });
});

describe('useWorkOrderStore — getWorkOrderById', () => {
  beforeEach(() => resetStore());

  it('returns the workorder when found', () => {
    const wo: WorkOrder = {
      ot_id: 'OT-20260405-1030-ab12',
      fecha: '05/04/2026',
      unidad: 'CA20',
      tipo_averia: 'Motor',
      descripcion: '',
      severidad: 'Alta',
      prioridad: 'MEDIA',
      mecanico_asignado: 'Juan',
      estado: 'Abierta',
      foto_url: '',
      averia_ref: '',
      partes_necesarias: '',
      costo_estimado: 0,
      fecha_cierre: '',
      observaciones: '',
      progreso: 0,
    };
    useWorkOrderStore.setState({ workorders: [wo] });
    const found = useWorkOrderStore.getState().getWorkOrderById('OT-20260405-1030-ab12');
    expect(found).toEqual(wo);
  });

  it('returns undefined when OT ID not found', () => {
    useWorkOrderStore.setState({ workorders: [] });
    expect(useWorkOrderStore.getState().getWorkOrderById('OT-NOTFOUND')).toBeUndefined();
  });
});

describe('useWorkOrderStore — updateOTField (optimistic)', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('optimistically updates estado in the store immediately', async () => {
    const wo: WorkOrder = {
      ot_id: 'OT-20260405-1030-ab12',
      fecha: '',
      unidad: 'CA20',
      tipo_averia: '',
      descripcion: '',
      severidad: '',
      prioridad: 'MEDIA',
      mecanico_asignado: '',
      estado: 'Abierta',
      foto_url: '',
      averia_ref: '',
      partes_necesarias: '',
      costo_estimado: 0,
      fecha_cierre: '',
      observaciones: '',
      progreso: 0,
    };
    useWorkOrderStore.setState({ workorders: [wo], fetched: true });

    const { appendRow } = await import('../lib/sheets-api');
    vi.mocked(appendRow).mockResolvedValue(undefined);

    await useWorkOrderStore
      .getState()
      .updateOTField('OT-20260405-1030-ab12', 'estado', 'En Reparación', 'testUser', 'mecanico');

    expect(useWorkOrderStore.getState().workorders[0].estado).toBe('En Reparación');
  });

  it('adds a new statusLog entry after update', async () => {
    const wo: WorkOrder = {
      ot_id: 'OT-20260405-1030-ab12',
      fecha: '',
      unidad: 'CA20',
      tipo_averia: '',
      descripcion: '',
      severidad: '',
      prioridad: 'MEDIA',
      mecanico_asignado: '',
      estado: 'Abierta',
      foto_url: '',
      averia_ref: '',
      partes_necesarias: '',
      costo_estimado: 0,
      fecha_cierre: '',
      observaciones: '',
      progreso: 0,
    };
    useWorkOrderStore.setState({ workorders: [wo], statusLog: [] });

    await useWorkOrderStore
      .getState()
      .updateOTField('OT-20260405-1030-ab12', 'estado', 'Resuelta', 'admin', 'admin');

    const log = useWorkOrderStore.getState().statusLog;
    expect(log).toHaveLength(1);
    const entry: StatusLogEntry = log[0];
    expect(entry.ot_id).toBe('OT-20260405-1030-ab12');
    expect(entry.field).toBe('estado');
    expect(entry.new_value).toBe('Resuelta');
  });
});
