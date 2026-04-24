import type { Equipment } from '../types/equipment';
import { isOpenAveria, parseAveriaRow, type AveriaEntry } from './averias';

export interface AvailabilityPoint {
  day: string;
  pct: number;
  unavailable: number;
  total: number;
}

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

function unavailableFromCurrentStatus(equipment: Equipment[]): Set<string> {
  const units = new Set<string>();
  for (const unit of equipment) {
    if (unit.status !== 'operativo' && unit.status !== 'alerta') {
      units.add(unit.unit_id.toUpperCase());
    }
  }
  return units;
}

function pctFromUnavailable(total: number, unavailable: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((total - unavailable) / total) * 100)));
}

export function calculateAvailability(
  equipment: Equipment[],
  openAveriaUnits: Set<string>,
): number {
  const unavailable = unavailableFromCurrentStatus(equipment);
  for (const unitId of openAveriaUnits) {
    unavailable.add(unitId.toUpperCase());
  }
  return pctFromUnavailable(equipment.length, unavailable.size);
}

function parseSheetDate(value: string): Date | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const year = Number(match[3]);
  const date = new Date(year, month, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function sameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function buildAvailabilityTrend(
  equipment: Equipment[],
  averiaRows: string[][],
  today = new Date(),
): AvailabilityPoint[] {
  const total = equipment.length;
  const currentUnavailable = unavailableFromCurrentStatus(equipment);
  const openAverias = averiaRows
    .map(parseAveriaRow)
    .filter((averia): averia is AveriaEntry => averia !== null && isOpenAveria(averia))
    .map((averia) => ({
      unitId: averia.unidad.toUpperCase(),
      date: parseSheetDate(averia.fecha),
    }))
    .filter((entry): entry is { unitId: string; date: Date } => entry.date !== null);

  const todayStart = startOfDay(today);
  const firstDay = addDays(todayStart, -6);

  return Array.from({ length: 7 }, (_, index) => {
    const day = addDays(firstDay, index);
    const unavailable = new Set<string>();

    for (const averia of openAverias) {
      if (averia.date <= day) {
        unavailable.add(averia.unitId);
      }
    }

    if (sameDay(day, todayStart)) {
      for (const unitId of currentUnavailable) {
        unavailable.add(unitId);
      }
    }

    return {
      day: DAY_LABELS[day.getDay()] ?? '',
      pct: pctFromUnavailable(total, unavailable.size),
      unavailable: unavailable.size,
      total,
    };
  });
}
