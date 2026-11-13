import { describe, expect, it } from 'vitest';
import { parseGastoRow, verifiedExpense } from './gastos-store';

describe('gastos documentados', () => {
  it('preserves a genuine zero and leaves an empty or malformed amount unknown', () => {
    const row = ['G1', '12/11/2026', '', 'Servicio', '', '', '', '0.00', '', 'inválido'];
    expect(parseGastoRow(row)).toMatchObject({ subtotal: 0, iva: null, total: null, entity: '', currency: '' });
  });

  it('requires source entity and currency for aggregated amounts', () => {
    const row = Array<string>(29).fill('');
    row[0] = 'G1';
    row[7] = '100';
    row[8] = '7';
    row[9] = '107';
    expect(verifiedExpense(parseGastoRow(row)!)).toBe(false);
    row[21] = 'TP_PA';
    row[22] = 'USD';
    row[23] = 'ITBMS';
    expect(verifiedExpense(parseGastoRow(row)!)).toBe(true);
  });
});
