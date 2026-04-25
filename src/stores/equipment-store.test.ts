import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock sheets-api before importing the store
vi.mock('../lib/sheets-api', () => ({
  readRange: vi.fn(),
  SHEET_TABS: {
    FLOTA: '01 Inventario',
  },
}));

const { readRange } = await import('../lib/sheets-api');
const { useEquipmentStore } = await import('./equipment-store');

// Minimal valid equipment row for "01 Inventario":
// 0=# 1=COD1 2=Descripción 3=Marca 4=Modelo 5=Año
// 6=Serie 7=Ubicación 8=Estado 9=Lectura 10=FechaLectura
function buildRow(overrides: Partial<Record<number, string>> = {}): string[] {
  const base = [
    '1',         // 0 #
    'CA20',      // 1 COD1
    'Camión Articulado', // 2 Descripción
    'Caterpillar',       // 3 Marca
    '745',               // 4 Modelo
    '2015',              // 5 Año
    '',                  // 6 Serie
    'GTP',               // 7 Ubicación
    'Operativo',         // 8 Estado
    '8500',              // 9 Lectura
    '05/04/2026',        // 10 Fecha Lectura
  ];
  for (const [idx, val] of Object.entries(overrides)) {
    if (val !== undefined) base[Number(idx)] = val;
  }
  return base;
}

// DATA_START is 3 in the store, so we need 3 header rows + data rows.
function withHeaders(dataRows: string[][]): string[][] {
  return [[], [], [], ...dataRows];
}

function resetStore() {
  useEquipmentStore.setState({
    equipment: [],
    fetched: false,
    loading: false,
    error: null,
  });
}

describe('useEquipmentStore — fetchEquipment', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('parses a valid equipment row into an Equipment object', async () => {
    vi.mocked(readRange).mockResolvedValueOnce(withHeaders([buildRow()]));
    await useEquipmentStore.getState().fetchEquipment();

    const { equipment } = useEquipmentStore.getState();
    expect(equipment).toHaveLength(1);
    expect(equipment[0]!.unit_id).toBe('CA20');
    expect(equipment[0]!.model).toBe('Caterpillar 745');
  });

  it('skips rows with empty unit_id (col 1)', async () => {
    vi.mocked(readRange).mockResolvedValueOnce(withHeaders([buildRow({ 1: '' })]));
    await useEquipmentStore.getState().fetchEquipment();
    expect(useEquipmentStore.getState().equipment).toHaveLength(0);
  });

  it('normalizes status: "Operativo" → "operativo"', async () => {
    vi.mocked(readRange).mockResolvedValueOnce(withHeaders([buildRow({ 8: 'Operativo' })]));
    await useEquipmentStore.getState().fetchEquipment();
    expect(useEquipmentStore.getState().equipment[0]!.status).toBe('operativo');
  });

  it('normalizes status: contains "reparac" → "taller"', async () => {
    vi.mocked(readRange).mockResolvedValueOnce(withHeaders([buildRow({ 8: 'En Reparación' })]));
    await useEquipmentStore.getState().fetchEquipment();
    expect(useEquipmentStore.getState().equipment[0]!.status).toBe('taller');
  });

  it('normalizes status: contains "taller" → "taller"', async () => {
    vi.mocked(readRange).mockResolvedValueOnce(withHeaders([buildRow({ 8: 'En taller' })]));
    await useEquipmentStore.getState().fetchEquipment();
    expect(useEquipmentStore.getState().equipment[0]!.status).toBe('taller');
  });

  it('normalizes status: contains "alerta" → "alerta"', async () => {
    vi.mocked(readRange).mockResolvedValueOnce(withHeaders([buildRow({ 8: 'Alerta mecánica' })]));
    await useEquipmentStore.getState().fetchEquipment();
    expect(useEquipmentStore.getState().equipment[0]!.status).toBe('alerta');
  });

  it('normalizes status: unknown → "inactivo"', async () => {
    vi.mocked(readRange).mockResolvedValueOnce(withHeaders([buildRow({ 8: 'Baja definitiva' })]));
    await useEquipmentStore.getState().fetchEquipment();
    expect(useEquipmentStore.getState().equipment[0]!.status).toBe('inactivo');
  });

  it('parses horometro removing commas', async () => {
    vi.mocked(readRange).mockResolvedValueOnce(withHeaders([buildRow({ 9: '12,500' })]));
    await useEquipmentStore.getState().fetchEquipment();
    expect(useEquipmentStore.getState().equipment[0]!.current_horometro).toBe(12500);
  });

  it('sets fetched=true after a successful load', async () => {
    vi.mocked(readRange).mockResolvedValueOnce(withHeaders([buildRow()]));
    await useEquipmentStore.getState().fetchEquipment();
    expect(useEquipmentStore.getState().fetched).toBe(true);
    expect(useEquipmentStore.getState().loading).toBe(false);
  });

  it('does not fetch again when already fetched (guard)', async () => {
    useEquipmentStore.setState({ fetched: true });
    await useEquipmentStore.getState().fetchEquipment();
    expect(vi.mocked(readRange)).not.toHaveBeenCalled();
  });

  it('does not fetch when loading=true (guard)', async () => {
    useEquipmentStore.setState({ loading: true });
    await useEquipmentStore.getState().fetchEquipment();
    expect(vi.mocked(readRange)).not.toHaveBeenCalled();
  });

  it('sets error on fetch failure', async () => {
    vi.mocked(readRange).mockRejectedValueOnce(new Error('Timeout'));
    await useEquipmentStore.getState().fetchEquipment();
    const state = useEquipmentStore.getState();
    expect(state.error).toContain('Timeout');
    expect(state.loading).toBe(false);
  });

  it('parses multiple rows', async () => {
    vi.mocked(readRange).mockResolvedValueOnce(
      withHeaders([buildRow({ 1: 'CA20' }), buildRow({ 1: 'CA21' })]),
    );
    await useEquipmentStore.getState().fetchEquipment();
    expect(useEquipmentStore.getState().equipment).toHaveLength(2);
  });
});

describe('useEquipmentStore — refetch', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('resets fetched flag and re-runs fetchEquipment', async () => {
    useEquipmentStore.setState({ fetched: true, equipment: [] });
    vi.mocked(readRange).mockResolvedValueOnce(withHeaders([buildRow()]));

    await useEquipmentStore.getState().refetch();

    expect(vi.mocked(readRange)).toHaveBeenCalledTimes(1);
    expect(useEquipmentStore.getState().equipment).toHaveLength(1);
  });
});
