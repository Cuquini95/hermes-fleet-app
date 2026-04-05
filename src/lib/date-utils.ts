/**
 * Date formatting utilities — forces Mexico City timezone for all sheet entries.
 * Prevents UTC/locale mismatch when devices have different timezone settings.
 */

const MEXICO_TZ = 'America/Mexico_City';
const MEXICO_LOCALE = 'es-MX';

/** Returns formatted date string: "05/04/2026" (dd/MM/yyyy) */
export function mexicoDate(date: Date = new Date()): string {
  return date.toLocaleDateString(MEXICO_LOCALE, {
    timeZone: MEXICO_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Returns formatted time string: "07:41:00" (HH:mm:ss) */
export function mexicoTime(date: Date = new Date()): string {
  return date.toLocaleTimeString(MEXICO_LOCALE, {
    timeZone: MEXICO_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/** Returns ISO-style date for IDs: "20260405" */
export function mexicoDateCompact(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MEXICO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value ?? '';
  const m = parts.find((p) => p.type === 'month')?.value ?? '';
  const d = parts.find((p) => p.type === 'day')?.value ?? '';
  return `${y}${m}${d}`;
}

/** Returns compact time for IDs: "0741" */
export function mexicoTimeCompact(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MEXICO_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const h = parts.find((p) => p.type === 'hour')?.value ?? '';
  const min = parts.find((p) => p.type === 'minute')?.value ?? '';
  return `${h}${min}`;
}
