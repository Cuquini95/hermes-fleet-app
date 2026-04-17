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

// Minimal valid equipment row: 0=# 1=COD1 2=COD2 3=Desc 4=Marca 5=Modelo 6=Año
// 7=Serie 8=Ubicación 9=Estado 10=Lectura 11=FechaLectura
function buildRow(overrides: Partial<Record<number, string>> = {}): string[] {
  const base = [
    '1',         // 0 #
    'CA20',      // 1 COD1
    '',          // 2 COD2
    'Camión Articulado', // 3 Descripción
    'Caterpillar',       // 4 Marca
    '745',               // 5 Modelo
    '2015',              // 6 Año
    '',                  // 7 Serie
    'GTP',               // 8 Ubicación
    'Operativo',         // 9 Estado
    '8500',              // 10 Lectura
    '05/04/2026',        // 11 Fecha Lectura
  ];
  for (const [idx, val] of Object.entries(overrides)) {
    if (val !== undefined) base[Number(idx)] = val;
  }
  return base;
}

// DATA_START is 5 in the store, so we need 5 header rows + data rows
function withHeaders(dataRows: string[][]): string[][] {
  return [[], [], [], [], [], ...dataRows];
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
    expect(equipment[0].unit_id).toBe('CA20');
    expect(equipment[0].model).toBe('Caterpillar 745');
  });

  it('skips rows with empty unit_id (col 1)', async () => {
    vi.mocked(readRange).mockResolvedValueOnce(withHeaders([buildRow({ 1: '' })]));
    await useEquipmentStore.getState().fetchEquipment();
    expect(useEquipmentStore.getState().equipment).toHaveLength(0);
  });

  it('normalizes status: "Operativo" → "operativo"', async () => {
    vi.mocked(readRange).mockResolvedValueOnce(withHeaders([buildRow({ 9: 'Operativo' })]));
    await useEquipmentStore.getState().fetchEquipment();
    expect(useEquipmentStore.getState().equipment[0].status).toBe('operativo');
  });

  it('normalizes status: contains "reparac" → "taller"', async () => {
    vi.mocked(readRange).mockResolvedValueOnce(withHeaders([buildRow({ 9: 'En Reparación' })]));
    await useEquipmentStore.getState().fetchEquipment();
    expect(useEquipmentStore.getState().equipment[0].status).toBe('taller');
  });

  it('normalizes status: contains "taller" → "taller"', async () => {
    vi.mocked(readRange).mockResolvedValueOnce(withHeaders([buildRow({ 9: 'En taller' })]));
    await useEquipmentStore.getState().fetchEquipment();
    expect(useEquipmentStore.getState().equipment[0].status).toBe('taller');
  });

  it('normalizes status: contains "alerta" → "alerta"', async () => {
    vi.mocked(readRange).mockResolvedValueOnce(withHeaders([buildRow({ 9: 'Alerta mecánica' })]));
    await useEquipmentStore.getState().fetchEquipment();
    expect(useEquipmentStore.getState().equipment[0].status).toBe('alerta');
  });

  it('normalizes status: unknown → "inactivo"', async () => {
    vi.mocked(readRange).mockResolvedValueOnce(withHeaders([buildRow({ 9: 'Baja definitiva' })]));
    await useEquipmentStore.getState().fetchEquipment();
    expect(useEquipmentStore.getState().equipment[0].status).toBe('inactivo');
  });

  it('parses horometro removing commas', async () => {
    vi.mocked(readRange).mockResolvedValueOnce(withHeaders([buildRow({ 10: '12,500' })]));
    await useEquipmentStore.getState().fetchEquipment();
    expect(useEquipmentStore.getState().equipment[0].current_horometro).toBe(12500);
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
