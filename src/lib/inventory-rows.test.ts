import { describe, expect, it } from 'vitest';
import { countCriticalInventory, parseInventoryRows } from './inventory-rows';

describe('inventory row parsing', () => {
  it('reads stock, minimum, and measurement unit from the Panama catalog header', () => {
    const rows = [
      ['Título'], ['SKU', 'Descripción', 'OEM', 'Serie', 'Unidad', 'Stock', 'Mínimo', 'Precio', 'Ubicación'],
      ['QA-001', 'Filtro', 'OEM-QA', '', 'pza', '2', '3', '5.5', 'Bodega QA'],
    ];
    expect(parseInventoryRows(rows)).toEqual([{
      partNumber: 'QA-001', description: 'Filtro', oemRef: 'OEM-QA', stock: 2, minimum: 3, unit: 'pza', category: 'Bodega QA',
    }]);
    expect(countCriticalInventory(rows)).toBe(1);
  });

  it('filters sheet title, instruction, and formula summary rows', () => {
    const rows = [
      ['GRUPO TRANS PLUS · INVENTARIO DE REPUESTOS — CONTROL DE BODEGA'],
      ['Stock mínimo en ROJO = generar OC inmediata | Conectado a Hermes Agent'],
      ['Total artículos: 28', '', '', '', '=COUNTIF(J6:J33 "🔴 REORDENAR")'],
      ['AF25129M', 'FILTRO DE AIRE', 'CAT', '2', '4', 'pz', 'Filtros'],
    ];

    expect(parseInventoryRows(rows)).toEqual([
      {
        partNumber: 'AF25129M',
        description: 'FILTRO DE AIRE',
        oemRef: 'CAT',
        stock: 2,
        minimum: 4,
        unit: 'pz',
        category: 'Filtros',
      },
    ]);
    expect(countCriticalInventory(rows)).toBe(1);
  });
});
