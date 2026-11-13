import { describe, expect, it } from 'vitest';
import { tireHistory } from './panama-tires';

function row(unit: string, position: string, serial: string, date: string, pressure: string) {
  const values = Array<string>(26).fill('');
  values[1] = unit;
  values[3] = position;
  values[7] = serial;
  values[13] = '11';
  values[16] = pressure;
  values[17] = date;
  values[18] = 'Buena';
  return values;
}

describe('historial de neumático por serie', () => {
  it('reconstruye el traslado y conserva presión cero como lectura', () => {
    const result = tireHistory([
      row('DZ205','D2','FUEGO-99','04/11/2026','0'),
      row('DZ203','I1','fuego-99','25/10/2026','105'),
      row('DZ203','I3','OTRA','06/11/2026','95'),
    ], ' fuego-99 ');
    expect(result.map(item => [item.unit, item.position, item.pressure])).toEqual([
      ['DZ205','D2','0'],['DZ203','I1','105'],
    ]);
  });
  it('no atribuye filas sin serie ni usa coincidencia parcial', () => {
    expect(tireHistory([row('DZ203','I1','','','')], '')).toEqual([]);
    expect(tireHistory([row('DZ203','I1','T-123','','')], 'T-12')).toEqual([]);
  });
});
