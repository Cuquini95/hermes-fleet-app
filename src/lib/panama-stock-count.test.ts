import { describe, expect, it } from 'vitest';
import { isCountStock, reviewStockCount, STOCK_COUNT_HEADERS, stockCountReport, stockCountTemplate, type CountStock } from './panama-stock-count';

const values = { SKU_interno: 'QA-001', Descripcion: 'Filtro ficticio', OEM_conocido: 'OEM-QA-001', Unidad: 'pza', Almacen: 'Almacén QA',
  Ubicacion: 'A-01', Cantidad_contada: '10', Fecha_conteo: '2026-11-17', Fuente_soporte: 'Conteo firmado ficticio QA',
  Contado_por: 'Persona QA', Revisado_por: 'Revisor QA', Aprobado_por: 'Autoridad QA', Costo_unitario_aprobado: '12.50',
  Moneda: 'USD', Referencia_valuacion: 'Referencia QA', Excepcion: '', Pais: 'Panamá', Proyecto: 'tmf-panama' };
const stock: CountStock[] = [{ partNumber: 'QA-001', warehouse: values.Almacen, measure: 'pza', oem: 'OEM-QA-001', physical: '8', reserved: '1' }];
const options = { today: '2026-11-17', fullScope: true };
const quote = (v: string) => '"' + v.replaceAll('"', '""') + '"';
function csv(rows: Partial<typeof values>[], separator = ',') {
  return '\ufeff' + [STOCK_COUNT_HEADERS.map(quote).join(separator), ...rows.map(overrides => {
    const row = { ...values, ...overrides }; return STOCK_COUNT_HEADERS.map(name => quote(row[name])).join(separator);
  })].join('\r\n');
}

describe('Panama stock count preflight', () => {
  it('rejects malformed reference data instead of treating it as a valid zero balance', () => {
    expect(isCountStock(stock[0])).toBe(true); expect(isCountStock({ ...stock[0], physical: null })).toBe(true);
    for (const invalid of [null, {}, { ...stock[0], physical: 0 }, { ...stock[0], warehouse: undefined }]) expect(isCountStock(invalid)).toBe(false);
  });
  it('compares exact quantities without mutating stock or treating declarations as approvals', () => {
    const before = structuredClone(stock); const review = reviewStockCount(csv([{}]), stock, options);
    expect(review.rows[0]?.errors).toEqual([]); expect(review.rows[0]?.difference).toBe('2');
    expect(stock).toEqual(before);
    const report = stockCountReport(review, { file: 'Conteo.csv', sha256: 'sha-ficticio', comparedAt: '2026-11-17T20:00:00Z' });
    expect(report).toContain('SOLO REVISION; NO APLICA SALDOS'); expect(report).toContain('sha-ficticio');
  });
  it('handles decimal arithmetic and genuine zero counts without floating point drift', () => {
    const review = reviewStockCount(csv([{ Cantidad_contada: '0.3' }]), [{ ...stock[0]!, physical: '0.1', reserved: '0' }], options);
    expect(review.rows[0]?.difference).toBe('0.2');
    const zero = reviewStockCount(csv([{ Cantidad_contada: '0' }]), [{ ...stock[0]!, reserved: '0' }], options);
    expect(zero.rows[0]?.counted).toBe('0'); expect(zero.rows[0]?.difference).toBe('-8');
  });
  it('preserves quoted multiline descriptions, escaped quotes, BOM and Spanish CSV delimiters', () => {
    for (const separator of [',', ';', '\t']) {
      const review = reviewStockCount(csv([{ Descripcion: 'Filtro, con "sello"\r\nsegunda línea' }], separator), stock, options);
      expect(review.errors).toEqual([]); expect(review.rows[0]?.values.Descripcion).toBe('Filtro, con "sello"\r\nsegunda línea');
      expect(review.rows[0]?.errors).toEqual([]);
    }
  });
  it('marks both duplicate rows, permits separate warehouses and rejects conflicting SKU definitions', () => {
    const repeated = reviewStockCount(csv([{}, { SKU_interno: 'qa-001' }]), stock, options);
    expect(repeated.rows.every(row => row.errors.some(error => error.includes('repetido')))).toBe(true);
    const separate = reviewStockCount(csv([{}, { Almacen: 'Segundo almacén' }]), stock, options);
    expect(separate.rows.every(row => !row.errors.some(error => error.includes('repetido')))).toBe(true);
    const conflict = reviewStockCount(csv([{}, { Almacen: 'Segundo almacén', Unidad: 'L' }]), stock, options);
    expect(conflict.rows.every(row => row.errors.some(error => error.includes('unidad u OEM')))).toBe(true);
  });
  it('keeps an unknown baseline unavailable and scoped comparisons explicit', () => {
    const missing = reviewStockCount(csv([{}]), null, { ...options, fullScope: false });
    expect(missing.rows[0]?.physical).toBeNull(); expect(missing.rows[0]?.difference).toBeNull();
    expect(missing.warnings.join(' ')).toContain('no acredita la unicidad');
    const fresh = reviewStockCount(csv([{}]), [], options); expect(fresh.rows[0]?.physical).toBeNull();
    expect(fresh.rows[0]?.warnings.join(' ')).toContain('confirmar alta');
  });
  it('rejects ambiguous numbers, negative values, future dates, foreign scope and self review', () => {
    for (const row of [{ Cantidad_contada: '-1' }, { Cantidad_contada: '1,000' }, { Cantidad_contada: '1e3' },
      { Cantidad_contada: '0.0001' }, { Fecha_conteo: '2026-02-30' }, { Fecha_conteo: '2026-11-18' },
      { Pais: 'México' }, { Proyecto: 'tcm' }, { Moneda: 'MXN' }, { Revisado_por: values.Contado_por }]) {
      expect(reviewStockCount(csv([row]), stock, options).rows[0]?.errors.length).toBeGreaterThan(0);
    }
  });
  it('requires reconciliation of measurement units, OEM, reservations and invalid catalog balances', () => {
    for (const baseline of [{ ...stock[0]!, measure: 'L' }, { ...stock[0]!, oem: 'OTRO-OEM' }, { ...stock[0]!, reserved: '12' }]) {
      expect(reviewStockCount(csv([{}]), [baseline], options).rows[0]?.errors.length).toBeGreaterThan(0);
    }
    const unknown = reviewStockCount(csv([{}]), [{ ...stock[0]!, physical: null }], options).rows[0];
    expect(unknown?.physical).toBeNull(); expect(unknown?.warnings.join(' ')).toContain('por conciliar');
  });
  it('rejects broken columns, missing headings, unclosed quotes, empty and oversized counts', () => {
    for (const source of ['SKU,SKU\nA,B', 'SKU\nA', stockCountTemplate(), csv([{}]) + '\n"sin cerrar', csv(Array.from({ length: 501 }, () => ({})))]) {
      expect(reviewStockCount(source, stock, options).errors.length).toBeGreaterThan(0);
    }
  });
  it('preserves missing evidence and valuation instead of creating zero costs or a verified signature', () => {
    const row = reviewStockCount(csv([{ Fuente_soporte: '', Contado_por: '', Costo_unitario_aprobado: '', Moneda: '', Aprobado_por: '' }]), stock, options).rows[0];
    expect(row?.errors.join(' ')).toContain('Fuente_soporte'); expect(row?.warnings.join(' ')).toContain('Valuación por revisar');
  });
  it('neutralizes spreadsheet formulas while preserving the original text during review', () => {
    const review = reviewStockCount(csv([{ Descripcion: '=HYPERLINK("sitio")' }]), stock, options);
    expect(review.rows[0]?.values.Descripcion).toBe('=HYPERLINK("sitio")');
    expect(stockCountReport(review, { file: 'Conteo.csv', sha256: 'sha', comparedAt: null })).toContain('"\'=HYPERLINK(""sitio"")"');
  });
});
