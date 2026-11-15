import { describe, expect, it } from 'vitest';
import { reconcileDieselDispatches } from './panama-fuel-reconciliation';

const fill = (id: string, day: number, unit: string, liters: string, meter: string) =>
  [id, `${day}/11/2026`, '08:00', unit, '', 'Diesel', liters, '', meter];

describe('Panama diesel reconciliation', () => {
  it('weights liters by the meter hours of matching intervals and excludes out-of-scope units', () => {
    const result = reconcileDieselDispatches([
      fill('1', 11, 'DZ203', '500', '1000'), fill('2', 12, 'DZ203', '80', '1004'),
      fill('3', 13, 'DZ203', '90', '1010'), fill('4', 11, 'EX401', '110', '2000'),
      fill('5', 12, 'EX401', '20', '2002'), fill('5', 12, 'EX401', '20', '2002'),
      fill('6', 11, 'OTRO1', '1000', '1'), fill('7', 12, 'OTRO1', '1000', '2'),
    ], ['DZ203', 'EX401']);
    expect(result.liters).toBe(190);
    expect(result.hours).toBe(12);
    expect(result.litersPerHour).toBeCloseTo(15.83);
    expect(result.units.map(({ unit, intervals }) => [unit, intervals.map(({ liters, hours }) => [liters, hours])])).toEqual([
      ['DZ203', [[80, 4], [90, 6]]], ['EX401', [[20, 2]]],
    ]);
  });

  it('flags missing readings, duplicate conflicts, and units without enough dispatches', () => {
    const result = reconcileDieselDispatches([
      fill('1', 11, 'DZ203', '90', '1000'), fill('2', 12, 'DZ203', '80', ''),
      fill('3', 13, 'DZ203', '90', '1010'), fill('4', 11, 'EX401', '20', '2000'),
      fill('5', 11, 'DZ204', '20', '2000'), fill('5', 11, 'DZ204', '40', '2000'),
    ], ['DZ203', 'EX401', 'DZ204']);
    expect(result.litersPerHour).toBeNull();
    expect(result.units.map(({ unit, issues }) => [unit, issues])).toEqual([
      ['DZ203', ['Horómetro faltante o sin avance cuadrable.']],
      ['DZ204', ['Hay un folio de despacho con datos contradictorios.']],
      ['EX401', ['Falta otro despacho para formar un intervalo.']],
    ]);
  });
});
