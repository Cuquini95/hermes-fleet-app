import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  mexicoDate,
  mexicoTime,
  mexicoDateCompact,
  mexicoDateInput,
  mexicoTimeInput,
  mexicoTimeCompact,
} from './date-utils';

// Mexico City is UTC-6 in standard time (CST) and UTC-5 in DST (CDT).
// DST in Mexico City starts the first Sunday in April and ends the last Sunday in October.

afterEach(() => {
  vi.useRealTimers();
});

describe('mexicoDate', () => {
  it('formats date as dd/MM/yyyy', () => {
    vi.useFakeTimers();
    // 2026-04-05 12:00 UTC = 2026-04-05 07:00 CDT (UTC-5)
    vi.setSystemTime(new Date('2026-04-05T12:00:00.000Z'));
    const result = mexicoDate();
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    // Year should be 2026
    expect(result.endsWith('2026')).toBe(true);
  });

  it('uses the provided date, not now', () => {
    const d = new Date('2026-01-15T20:00:00.000Z'); // 14:00 CST (UTC-6)
    const result = mexicoDate(d);
    expect(result).toContain('2026');
    expect(result).toMatch(/^15\/01\/2026$/);
  });

  it('handles the day/month/year parts separately', () => {
    const d = new Date('2026-03-31T12:00:00.000Z'); // 07:00 CST
    const result = mexicoDate(d);
    const [day, month, year] = result.split('/');
    expect(day).toBe('31');
    expect(month).toBe('03');
    expect(year).toBe('2026');
  });
});

describe('mexicoTime', () => {
  it('formats time as HH:mm:ss (24h)', () => {
    // 2026-04-05T15:30:45Z = 09:30:45 CST (UTC-6)
    const d = new Date('2026-04-05T15:30:45.000Z');
    const result = mexicoTime(d);
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    // Exact hour depends on DST; verify format and that seconds match
    const [, , sec] = result.split(':');
    expect(sec).toBe('45');
  });

  it('uses 24-hour format (hour is always 0-23, never 24)', () => {
    const d = new Date('2026-07-01T18:00:00.000Z'); // noon or later in Mexico
    const result = mexicoTime(d);
    const hour = parseInt(result.split(':')[0]!, 10);
    expect(hour).toBeGreaterThanOrEqual(0);
    expect(hour).toBeLessThan(24);
  });

  it('midnight UTC is displayed as evening in Mexico (before midnight)', () => {
    // 2026-04-06T00:00:00Z = 18:00 CST (UTC-6) — well before midnight
    const d = new Date('2026-04-06T00:00:00.000Z');
    const result = mexicoTime(d);
    const hour = parseInt(result.split(':')[0]!, 10);
    // Should be 18:xx or 19:xx depending on DST — either way, evening
    expect(hour).toBeGreaterThanOrEqual(17);
    expect(hour).toBeLessThan(24);
  });
});

describe('mexicoDateCompact', () => {
  it('returns exactly 8 digits (YYYYMMDD)', () => {
    const d = new Date('2026-04-05T12:00:00.000Z');
    const result = mexicoDateCompact(d);
    expect(result).toMatch(/^\d{8}$/);
  });

  it('encodes correct date: 2026-04-05T12:00Z = 20260405 in Mexico', () => {
    const d = new Date('2026-04-05T12:00:00.000Z');
    expect(mexicoDateCompact(d)).toBe('20260405');
  });

  it('rolls date correctly when UTC is ahead of Mexico', () => {
    // 2026-04-06T02:00Z = 2026-04-05T21:00 CDT — still Apr 5 in Mexico
    const d = new Date('2026-04-06T02:00:00.000Z');
    expect(mexicoDateCompact(d)).toBe('20260405');
  });

  it('crosses into next day when past 00:00 Mexico time', () => {
    // 2026-04-06T06:00Z = 2026-04-06T01:00 CDT — Apr 6
    const d = new Date('2026-04-06T06:00:00.000Z');
    expect(mexicoDateCompact(d)).toBe('20260406');
  });
});

describe('mexicoDateInput', () => {
  it('returns YYYY-MM-DD format', () => {
    const d = new Date('2026-09-15T12:00:00.000Z');
    const result = mexicoDateInput(d);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns the correct date in Mexico timezone', () => {
    const d = new Date('2026-01-20T20:00:00.000Z'); // 14:00 CST
    const result = mexicoDateInput(d);
    expect(result).toBe('2026-01-20');
  });

  it('produces a date compatible with <input type="date"> parsing', () => {
    const d = new Date('2026-04-05T12:00:00.000Z');
    const result = mexicoDateInput(d);
    const parsed = new Date(result + 'T00:00:00');
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(3); // April
    expect(parsed.getDate()).toBe(5);
  });
});

describe('mexicoTimeCompact', () => {
  it('returns exactly 4 digits (HHMM)', () => {
    const d = new Date('2026-04-05T15:30:00.000Z');
    const result = mexicoTimeCompact(d);
    expect(result).toMatch(/^\d{4}$/);
  });

  it('encodes correct time: 15:30 UTC in Mexico timezone (CST or CDT)', () => {
    // 2026-04-05T15:30Z = 09:30 CST (UTC-6) or 10:30 CDT (UTC-5)
    const d = new Date('2026-04-05T15:30:00.000Z');
    const result = mexicoTimeCompact(d);
    // Accept both CST and CDT results since DST depends on the runtime TZ database
    expect(result).toMatch(/^(0930|1030)$/);
  });

  it('hour is zero-padded so it is always 4 chars', () => {
    // 2026-01-15T08:05Z = 02:05 CST (UTC-6) — January is always standard time
    const d = new Date('2026-01-15T08:05:00.000Z');
    const result = mexicoTimeCompact(d);
    expect(result).toHaveLength(4);
    expect(result).toMatch(/^\d{4}$/);
    // Minutes must be "05" — this is timezone-independent
    expect(result.slice(2)).toBe('05');
  });
});

describe('mexicoTimeInput', () => {
  it('returns HH:mm format', () => {
    const d = new Date('2026-04-05T15:30:45.000Z');
    const result = mexicoTimeInput(d);
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });

  it('is the first 5 chars of mexicoTime', () => {
    const d = new Date('2026-04-05T15:30:45.000Z');
    const full = mexicoTime(d);
    const compact = mexicoTimeInput(d);
    expect(compact).toBe(full.slice(0, 5));
  });
});
