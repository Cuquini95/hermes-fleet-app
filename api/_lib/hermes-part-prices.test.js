import { describe, expect, it } from 'vitest';
import { compareQuote, recoverExpensePrices, searchInventory } from './hermes-part-prices.js';

function expense(id, date, supplier, items, status = 'Aprobado') {
  const row = [id, date, '', 'Refaccion', supplier];
  row[14] = items;
  row[16] = status;
  return row;
}

describe('recovered part prices', () => {
  it('reads inventory using either the SKU or OEM reference', () => {
    const inventory = [['FLT-1', 'Filtro hidráulico', 'OEM-1', 'CROSS-1', 'Pieza', 3, 1, 82.5, 247.5, '', 'Komatsu', '', '', 'Proveedor']];
    expect(searchInventory(inventory, 'OEM-1', 'Komatsu')).toMatchObject([{ part_number: 'FLT-1', unit_price: 82.5 }]);
    expect(searchInventory(inventory, 'hidraulico', 'Mack')).toEqual([]);
  });

  it('compares with the latest approved expense from the same supplier and excludes the new save', () => {
    const rows = [
      expense('CURRENT', '2026-11-11', 'Proveedor A', '[OEM-1] Filtro x2 $300.00'),
      expense('OLD', '10/11/2026', 'Proveedor A', '[OEM-1] Filtro x2 $200.00'),
      expense('OTHER', '11/11/2026', 'Proveedor B', '[OEM-1] Filtro x1 $20.00'),
      expense('CANCELLED', '11/11/2026', 'Proveedor A', '[OEM-1] Filtro x1 $21.00', 'Eliminado'),
      expense('TEST-1', '11/11/2026', 'Proveedor A', '[OEM-1] Filtro x1 $22.00'),
      expense('INVALID-DATE', '31/02/2026', 'Proveedor A', '[OEM-2] Filtro x1 $23.00'),
      expense('OLDER', '1/10/2026', 'Proveedor A', '[OEM-1] Filtro x2 $120.00'),
    ];
    const prices = recoverExpensePrices(rows, 'proveedor a', ['CURRENT']);
    expect(compareQuote([
      { part_number: 'oem-1', unit_price: 110 },
      { part_number: 'OEM-2', unit_price: 200 },
    ], 'Proveedor A', prices)).toEqual({
      compared: 1,
      unmatched: ['OEM-2'],
      changes: [{ part_number: 'OEM-1', description: 'Filtro', old_price: 100, new_price: 110, pct_change: 10, supplier: 'Proveedor A', source_date: '10/11/2026' }],
    });
  });
});
