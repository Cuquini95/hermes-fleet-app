import { describe, expect, it, vi } from 'vitest';
import { timeSince } from './OTCard';

describe('timeSince', () => {
  it('formats Sheets dd/mm/yyyy dates without NaN', () => {
    vi.setSystemTime(new Date('2026-04-24T18:00:00.000Z'));

    expect(timeSince('24/04/2026 08:00:00')).toMatch(/^Hace \d+h$/);
    expect(timeSince('not-a-date')).toBe('Sin fecha');
  });
});
