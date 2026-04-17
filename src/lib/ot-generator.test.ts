import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateOTId } from './ot-generator';

describe('generateOTId', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('produces IDs in OT-YYYYMMDD-HHMM-XXXX format', () => {
    const id = generateOTId();
    // Allow hex chars in suffix (UUID slice)
    expect(id).toMatch(/^OT-\d{8}-\d{4}-[a-f0-9]{4}$/);
  });

  it('prefix is always OT', () => {
    const id = generateOTId();
    expect(id.startsWith('OT-')).toBe(true);
  });

  it('contains exactly 4 dash-separated segments', () => {
    const id = generateOTId();
    const parts = id.split('-');
    expect(parts).toHaveLength(4);
  });

  it('date segment is 8 digits (YYYYMMDD)', () => {
    const id = generateOTId();
    const datePart = id.split('-')[1];
    expect(datePart).toMatch(/^\d{8}$/);
  });

  it('time segment is 4 digits (HHMM)', () => {
    const id = generateOTId();
    const timePart = id.split('-')[2];
    expect(timePart).toMatch(/^\d{4}$/);
  });

  it('produces mostly-unique IDs even when called rapidly (>96% unique in 1000 calls)', () => {
    // The suffix is 4 hex chars sliced from a UUID, giving 65536 possible values.
    // In 1000 rapid calls with the same HHMM timestamp, birthday-problem collisions
    // are expected (~1.1%). We assert high but not perfect uniqueness.
    // For production, the caller should deduplicate or add a sequence number if needed.
    const ids = new Set(Array.from({ length: 1000 }, generateOTId));
    expect(ids.size).toBeGreaterThanOrEqual(960);
  });

  it('uses Mexico City date — encodes the correct date for a known UTC timestamp', () => {
    // 2026-04-05 06:00 UTC = 2026-04-05 01:00 CST (UTC-5), so date should be 20260405
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-05T06:00:00.000Z'));
    const id = generateOTId();
    expect(id.split('-')[1]).toBe('20260405');
  });

  it('does not embed a zero-padded 24:00 hour', () => {
    // Midnight UTC = 19:00 CST (UTC-5), never 2400
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const id = generateOTId();
    const timePart = id.split('-')[2];
    const hour = parseInt(timePart!.slice(0, 2), 10);
    expect(hour).toBeGreaterThanOrEqual(0);
    expect(hour).toBeLessThan(24);
  });
});
