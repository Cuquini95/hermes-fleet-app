import { describe, expect, it } from 'vitest';
import { shiftHandoffCsv } from './finance-handoff';

const part = {
  id: 'TPA-0001', version: 2, unit: 'EX401', date: '2026-11-12', shift: 'Día',
  status: 'Aceptado por Supervisión', hours: 8.125, initialHours: 1920, finalHours: 1928.125,
  reviewedBy: { name: 'Supervisión QA' }, reviewedAt: '2026-11-12T23:30:00.000Z',
  client: 'Cliente "QA"', support: '=SUM(1+1)',
};

describe('entrega para conciliación de valorización', () => {
  it('conserva folio, unidad, corte y horas aceptadas sin declarar facturación', () => {
    const csv = shiftHandoffCsv(part);
    expect(csv).toContain('"TPA-0001";"2";"EX401";"2026-11-12";"Día"');
    expect(csv).toContain('"1920";"1928.125";"8.125";"Cliente ""QA"""');
    expect(csv).toContain('"Pendiente de conciliar en VALORIZACION"');
  });
  it('conserva las referencias como texto para abrir el CSV en una hoja', () => {
    expect(shiftHandoffCsv(part)).toContain(`"'=SUM(1+1)"`);
    expect(() => shiftHandoffCsv({ ...part, status: 'Devuelto' })).toThrow(/aceptado/i);
  });
});
