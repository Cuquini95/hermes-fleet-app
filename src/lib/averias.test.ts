import { describe, expect, it } from 'vitest';
import { firstPhotoUrl, openAveriaUnitSet, parseAveriaRow } from './averias';

const PHOTO_URL = 'https://xwrhkxecykuuutuitlnd.supabase.co/storage/v1/object/public/falla-photos/1777054000012-0.jpg';

function makeRow(overrides: Partial<Record<number, string>> = {}): string[] {
  const row = [
    '24/04/2026',
    '12:06:41',
    'CV102',
    'Estructura',
    'Golpe en el frontal del Camion',
    'CRITICA',
    'Operador',
    '>8 horas',
    '',
    'Abierta',
    '',
    'Ubicacion: Asmoles. Cliente: SBM Constructora. Puede moverse: No',
    '',
    'OT-20260424-1206-df7f',
    PHOTO_URL,
  ];
  for (const [index, value] of Object.entries(overrides)) {
    row[Number(index)] = value;
  }
  return row;
}

describe('parseAveriaRow', () => {
  it('reads canonical OT_ID and photo columns', () => {
    const result = parseAveriaRow(makeRow());

    expect(result?.unidad).toBe('CV102');
    expect(result?.ot_id).toBe('OT-20260424-1206-df7f');
    expect(result?.foto_url).toBe(PHOTO_URL);
  });

  it('recovers legacy rows where photo was written into OT_ID', () => {
    const result = parseAveriaRow(makeRow({
      11: 'Ubicacion: Asmoles. Cliente: SBM Constructora. Puede moverse: No | OT: OT-20260424-1206-df7f',
      13: PHOTO_URL,
      14: '',
    }));

    expect(result?.ot_id).toBe('OT-20260424-1206-df7f');
    expect(result?.foto_url).toBe(PHOTO_URL);
    expect(result?.observaciones).toBe('Ubicacion: Asmoles. Cliente: SBM Constructora. Puede moverse: No');
  });

  it('builds active unit set from open averias only', () => {
    const units = openAveriaUnitSet([
      makeRow(),
      makeRow({ 2: 'CA22', 9: 'Cerrada' }),
    ]);

    expect(units.has('CV102')).toBe(true);
    expect(units.has('CA22')).toBe(false);
  });

  it('returns first photo URL when multiple photos are comma-separated', () => {
    expect(firstPhotoUrl(`${PHOTO_URL}, https://example.test/second.jpg`)).toBe(PHOTO_URL);
  });
});
