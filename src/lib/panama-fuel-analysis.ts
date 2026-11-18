import type { Equipment } from '../types/equipment';
import type { reconcileDieselDispatches } from './panama-fuel-reconciliation';

type FuelData = ReturnType<typeof reconcileDieselDispatches>;
type Asset = Pick<Equipment, 'unit_id' | 'model' | 'type'>;

export function fuelFamily(asset?: Asset): string {
  if (!asset) return 'Por clasificar';
  const code = asset.unit_id.toUpperCase();
  const description = `${asset.type} ${asset.model}`.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();
  if (/ARTICULAD|\b(?:HM\d{3}|A(?:35|40|45)|7(?:25|30|35|40|45))\b/.test(description) || /^CA\d/.test(code)) return 'Camiones articulados';
  if (/DOZER|BULLDOZER|TRACTOR DE ORUGA/.test(description) || /^DZ\d/.test(code)) return 'Dozers';
  if (/EXCAVADOR/.test(description) || /^EX\d/.test(code)) return 'Excavadoras';
  if (/CARGADOR/.test(description) || /^WL\d/.test(code)) return 'Cargadores';
  if (/COMPACTADOR|RODILLO/.test(description) || /^(?:VC|CF)\d/.test(code)) return 'Compactadores';
  if (/CAMION|VOLQUETE|GRANITE/.test(description) || /^CV\d/.test(code)) return 'Camiones rígidos';
  return 'Por clasificar';
}

export function fuelPeriod(endDay: string, days: 1 | 7 | 15) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDay)) return null;
  const midnight = Date.parse(`${endDay}T00:00:00Z`);
  if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0, 10) !== endDay) return null;
  const end = midnight + 5 * 3_600_000 + 86_400_000;
  return { from: end - days * 86_400_000, to: end, endDay, days };
}

export function analyzeFuelPeriod(data: FuelData, assets: Asset[], endDay: string, days: 1 | 7 | 15) {
  const period = fuelPeriod(endDay, days);
  if (!period) return null;
  const byUnit = new Map(assets.map(asset => [asset.unit_id.trim().toUpperCase(), asset]));
  const units = data.units.map(row => {
    const asset = byUnit.get(row.unit);
    const intervals = row.intervals.filter(interval => interval.from >= period.from && interval.to < period.to);
    const issues = [...row.issues];
    if (!intervals.length && !issues.length) issues.push('Sin intervalos completos dentro del período.');
    const liters = intervals.reduce((sum, interval) => sum + interval.liters, 0);
    const hours = intervals.reduce((sum, interval) => sum + interval.hours, 0);
    return { ...row, intervals, issues, family: fuelFamily(asset), model: asset?.model ?? '', liters, hours,
      litersPerHour: issues.length === 0 && hours > 0 ? liters / hours : null };
  });
  const families = [...new Set(units.map(unit => unit.family))].sort().map(family => {
    const members = units.filter(unit => unit.family === family);
    const verified = members.filter(unit => unit.litersPerHour !== null);
    const liters = verified.reduce((sum, unit) => sum + unit.liters, 0);
    const hours = verified.reduce((sum, unit) => sum + unit.hours, 0);
    return { family, liters, hours, litersPerHour: hours > 0 ? liters / hours : null,
      verified: verified.length, total: members.length,
      units: members.sort((a, b) => (a.litersPerHour ?? Infinity) - (b.litersPerHour ?? Infinity) || a.unit.localeCompare(b.unit)) };
  });
  return { period, families };
}
