/**
 * Canonical meter shape exchanged between Hermes and CMMS.
 * Sheet rows are intentionally parsed here so headers and malformed legacy
 * rows cannot become fabricated zero-hour readings.
 */
export interface CmmsMeterReading {
  unit: string;
  hours: number;
  recorded_at: string;
}

const MEXICO_CITY_STANDARD_OFFSET_MS = 6 * 60 * 60 * 1000;

function parsePositiveNumber(value: unknown): number | null {
  const raw = String(value ?? '').trim().replace(/\s+/g, '');
  if (!raw) return null;

  // Horometer entries are normally written as 12,500.5. Also accept a
  // Spanish decimal comma when it is unambiguously fractional (12,5).
  const normalized = raw.includes('.')
    ? raw.replace(/,/g, '')
    : /,\d{1,2}$/.test(raw)
      ? raw.replace(',', '.')
      : raw.replace(/,/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 1_000_000 ? parsed : null;
}

function parseDateParts(value: unknown): [number, number, number] | null {
  const raw = String(value ?? '').trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (isoMatch) return [Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3])];

  const mexicoMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (!mexicoMatch) return null;
  return [Number(mexicoMatch[3]), Number(mexicoMatch[2]), Number(mexicoMatch[1])];
}

function parseMexicoTimestamp(dateValue: unknown, timeValue: unknown): string | null {
  const dateParts = parseDateParts(dateValue);
  if (!dateParts) return null;

  const timeMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(timeValue ?? '').trim());
  if (!timeMatch) return null;

  const [year, month, day] = dateParts;
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const second = Number(timeMatch[3] ?? '0');
  if (
    month < 1 || month > 12 || day < 1 || day > 31
    || hour < 0 || hour > 23 || minute < 0 || minute > 59
    || second < 0 || second > 59
  ) return null;

  // The source sheet stores Mexico City wall-clock time. Mexico City is UTC-6
  // for the current operating period; applying the offset explicitly avoids
  // machine-local timezone drift during the backfill.
  const localAsUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    localAsUtc.getUTCFullYear() !== year
    || localAsUtc.getUTCMonth() !== month - 1
    || localAsUtc.getUTCDate() !== day
    || localAsUtc.getUTCHours() !== hour
    || localAsUtc.getUTCMinutes() !== minute
    || localAsUtc.getUTCSeconds() !== second
  ) return null;

  return new Date(localAsUtc.getTime() + MEXICO_CITY_STANDARD_OFFSET_MS).toISOString();
}

/** Convert one `04B Registro Horómetros` row into a CMMS meter reading. */
export function parseHorometroSheetRow(row: readonly unknown[]): CmmsMeterReading | null {
  const unit = String(row[2] ?? '').trim().toUpperCase();
  if (!unit || unit.length > 40) return null;

  const hours = parsePositiveNumber(row[6]);
  const recordedAt = parseMexicoTimestamp(row[0], row[1]);
  if (hours === null || !recordedAt) return null;

  return { unit, hours: Math.round(hours * 100) / 100, recorded_at: recordedAt };
}

/**
 * Parse the historical tab and keep only its latest valid reading per unit.
 * The bounded result prevents a single manual backfill from exceeding the
 * handoff endpoint limit while preserving the value shown by CMMS.
 */
export function parseHorometroSheetRows(rows: readonly (readonly unknown[])[]): CmmsMeterReading[] {
  const latest = new Map<string, CmmsMeterReading>();
  for (const row of rows) {
    const reading = parseHorometroSheetRow(row);
    if (!reading) continue;
    const previous = latest.get(reading.unit);
    if (!previous || reading.recorded_at > previous.recorded_at) latest.set(reading.unit, reading);
  }
  return [...latest.values()];
}

export function isCmmsMeterReading(value: unknown): value is CmmsMeterReading {
  if (!value || typeof value !== 'object') return false;
  const reading = value as Partial<CmmsMeterReading>;
  return (
    typeof reading.unit === 'string'
    && reading.unit.trim().length > 0
    && typeof reading.hours === 'number'
    && Number.isFinite(reading.hours)
    && reading.hours > 0
    && typeof reading.recorded_at === 'string'
    && Number.isFinite(Date.parse(reading.recorded_at))
  );
}
