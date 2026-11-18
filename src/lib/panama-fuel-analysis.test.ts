import { describe, expect, it } from 'vitest';
import { analyzeFuelPeriod, fuelFamily, fuelPeriod } from './panama-fuel-analysis';
import { reconcileDieselDispatches } from './panama-fuel-reconciliation';

const fill = (id: string, day: number, unit: string, liters: number, meter: number, time = '08:00') =>
  [id, `${day}/11/2026`, time, unit, '', 'Diesel', String(liters), '', String(meter)];
const assets = [
  { unit_id: 'DZ01', model: 'Komatsu D155AX-6', type: 'Dozer' },
  { unit_id: 'DZ02', model: 'Komatsu D155AX-6', type: 'Dozer' },
  { unit_id: 'CA01', model: 'Caterpillar 745', type: 'Camión' },
];

describe('Consumption over matching Panama intervals', () => {
  it('keeps equal L/h equal despite different litres and separates articulated trucks', () => {
    const data = reconcileDieselDispatches([
      fill('a', 11, 'DZ01', 100, 1000), fill('b', 12, 'DZ01', 200, 1020),
      fill('c', 11, 'DZ02', 100, 500), fill('d', 12, 'DZ02', 100, 510),
      fill('e', 11, 'CA01', 100, 100), fill('f', 12, 'CA01', 500, 110),
    ], assets.map(asset => asset.unit_id));
    for (const days of [7, 15] as const) {
      const report = analyzeFuelPeriod(data, assets, '2026-11-17', days)!;
      const dozers = report.families.find(group => group.family === 'Dozers')!;
      expect(dozers.units.map(unit => unit.litersPerHour)).toEqual([10, 10]);
      expect([dozers.liters, dozers.hours, dozers.litersPerHour]).toEqual([300, 30, 10]);
      expect(report.families.find(group => group.family === 'Camiones articulados')?.litersPerHour).toBe(50);
    }
  });

  it('weights by hours and excludes a record with an unresolved conflicting duplicate', () => {
    const data = reconcileDieselDispatches([
      fill('a', 11, 'DZ01', 100, 1000), fill('b', 12, 'DZ01', 200, 1020),
      fill('c', 11, 'DZ02', 100, 500), fill('d', 12, 'DZ02', 100, 505),
    ], ['DZ01', 'DZ02']);
    expect(analyzeFuelPeriod(data, assets, '2026-11-17', 7)?.families[0]?.litersPerHour).toBe(12);
    const invalid = reconcileDieselDispatches([
      fill('a', 11, 'DZ01', 100, 1000), fill('b', 12, 'DZ01', 200, 1020), fill('b', 12, 'DZ01', 500, 1020),
    ], ['DZ01']);
    expect(analyzeFuelPeriod(invalid, assets, '2026-11-17', 7)?.families[0]?.litersPerHour).toBeNull();
  });

  it('uses Panama calendar boundaries and does not assign a crossing interval to one day', () => {
    expect(fuelPeriod('2026-11-17', 1)).toMatchObject({ from: Date.parse('2026-11-17T05:00:00Z'), to: Date.parse('2026-11-18T05:00:00Z') });
    expect(fuelPeriod('2026-11-31', 7)).toBeNull();
    const data = reconcileDieselDispatches([
      fill('a', 16, 'DZ01', 100, 1000), fill('b', 17, 'DZ01', 200, 1020),
    ], ['DZ01']);
    expect(analyzeFuelPeriod(data, assets, '2026-11-17', 1)?.families[0]?.litersPerHour).toBeNull();
    const sameDay = reconcileDieselDispatches([
      fill('a', 17, 'DZ01', 100, 1000), fill('b', 17, 'DZ01', 200, 1020, '18:00'),
    ], ['DZ01']);
    expect(analyzeFuelPeriod(sameDay, assets, '2026-11-17', 1)?.families[0]?.litersPerHour).toBe(10);
    expect(fuelFamily({ unit_id: 'CV01', model: 'Mack Granite', type: 'Volquete' })).toBe('Camiones rígidos');
  });
});
