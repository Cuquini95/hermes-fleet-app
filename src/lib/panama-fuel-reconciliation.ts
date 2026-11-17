type Dispatch = { id: string; stamp: number | null; liters: number | null; meter: number | null };
type Interval = { from: number; to: number; fromMeter: number; toMeter: number; dispatchId: string; liters: number; hours: number };

function readStamp(date: string, time: string): number | null {
  const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(date);
  const day = local ? `${local[3]}-${local[2]!.padStart(2, '0')}-${local[1]!.padStart(2, '0')}` : date;
  if (!/^\d{4}-\d\d-\d\d$/.test(day) || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)) return null;
  const midnight = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0, 10) !== day) return null;
  return Date.parse(`${day}T${time.length === 5 ? time + ':00' : time}-05:00`);
}

function quantity(value: string | undefined): number | null {
  const text = value?.trim() ?? '';
  if (!/^\d+(?:[.,]\d+)?$/.test(text)) return null;
  const parsed = Number(text.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export function reconcileDieselDispatches(rows: string[][], unitIds: string[]) {
  const unitsById = new Map([...new Set(unitIds.map(unit => unit.trim().toUpperCase()))].sort()
    .map(unit => [unit, { unit, dispatches: new Map<string, Dispatch>(), issues: new Set<string>() }]));
  for (const [index, row] of rows.entries()) {
    const item = unitsById.get((row[3] ?? '').trim().toUpperCase());
    const fuel = (row[5] ?? '').trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    if (!item || fuel !== 'diesel') continue;
    const id = (row[0] ?? '').trim();
    const key = id ? `id:${id}` : `row:${index}`;
    const captured = { id, stamp: readStamp((row[1] ?? '').trim(), (row[2] ?? '').trim()),
      liters: quantity(row[6]), meter: quantity(row[8]) };
    const prior = item.dispatches.get(key);
    if (prior && (prior.stamp !== captured.stamp || prior.liters !== captured.liters || prior.meter !== captured.meter)) {
      item.issues.add('Hay un folio de despacho con datos contradictorios.');
    }
    if (captured.stamp === null) item.issues.add('Hay un despacho sin fecha u hora válida.');
    item.dispatches.set(key, captured);
  }

  const units = [...unitsById.values()].map(({ unit, dispatches, issues }) => {
    const sorted = [...dispatches.values()].sort((a, b) => (a.stamp ?? 0) - (b.stamp ?? 0));
    const intervals: Interval[] = [];
    if (!issues.size && sorted.length === 0) issues.add('Sin despachos de diésel registrados.');
    if (!issues.size && sorted.length === 1) issues.add('Falta otro despacho para formar un intervalo.');
    if (!issues.size) {
      const ambiguousDates = new Set(sorted.slice(1).filter((row, index) => row.stamp === sorted[index]!.stamp).map(row => row.stamp));
      for (let index = 1; index < sorted.length; index++) {
        const before = sorted[index - 1]!;
        const after = sorted[index]!;
        if (ambiguousDates.has(before.stamp) || ambiguousDates.has(after.stamp)) {
          issues.add('Dos despachos tienen la misma fecha y hora.');
          continue;
        }
        if (before.meter === null || after.meter === null || after.meter <= before.meter) {
          issues.add('Horómetro faltante o sin avance cuadrable.');
          continue;
        }
        if (after.liters === null || after.liters <= 0) {
          issues.add('Litros de despacho faltantes o inválidos.');
          continue;
        }
        intervals.push({ from: before.stamp!, to: after.stamp!, fromMeter: before.meter, toMeter: after.meter,
          dispatchId: after.id, liters: after.liters, hours: after.meter - before.meter });
      }
    }
    return { unit, intervals, issues: [...issues] };
  });
  const intervals = units.flatMap(unit => unit.intervals);
  const liters = intervals.reduce((total, interval) => total + interval.liters, 0);
  const hours = intervals.reduce((total, interval) => total + interval.hours, 0);
  return { units, liters, hours, litersPerHour: hours > 0 ? liters / hours : null };
}
