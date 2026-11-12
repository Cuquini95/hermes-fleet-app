import { describe, expect, it } from 'vitest';
import { buildDispatchReadinessMap } from './dispatch-readiness';

function stickerRow(overrides: Partial<Record<number, string>> = {}): string[] {
  const row: string[] = [];
  row[1] = 'STK-20260701-0800';
  row[3] = '01/07/2026';
  row[4] = '08:00';
  row[5] = 'EX-01';
  row[10] = 'Aprobado';
  row[12] = 'green';
  row[13] = 'si';
  row[14] = '16/07/2026';

  for (const [index, value] of Object.entries(overrides)) {
    row[Number(index)] = value;
  }
  return row;
}

function dvirRow(overrides: Partial<Record<number, string>> = {}): string[] {
  const row: string[] = [];
  row[2] = '07/07/2026';
  row[3] = '06:30';
  row[4] = 'EX-01';
  row[22] = 'aprobado';
  row[23] = '';
  row[26] = 'cerrado';

  for (const [index, value] of Object.entries(overrides)) {
    row[Number(index)] = value;
  }
  return row;
}

describe('buildDispatchReadinessMap', () => {
  const today = new Date(2026, 6, 7);

  it('blocks dispatch when the latest sticker is expired', () => {
    const map = buildDispatchReadinessMap([
      stickerRow({ 14: '06/07/2026' }),
    ], [], today);

    const readiness = map.get('EX-01');
    expect(readiness?.level).toBe('blocked');
    expect(readiness?.label).toBe('Sticker vencido');
    expect(readiness?.effectiveStatus).toBe('taller');
  });

  it('blocks dispatch when a daily DVIR reprobado is newer than a green sticker', () => {
    const map = buildDispatchReadinessMap([
      stickerRow(),
    ], [
      dvirRow({ 22: 'reprobado', 23: 'Fuga de combustible' }),
    ], today);

    const readiness = map.get('EX-01');
    expect(readiness?.level).toBe('blocked');
    expect(readiness?.source).toBe('dvir');
    expect(readiness?.label).toBe('Sticker suspendido');
    expect(readiness?.reason).toContain('Fuga de combustible');
  });

  it('restricts dispatch for a yellow sticker', () => {
    const map = buildDispatchReadinessMap([
      stickerRow({ 12: 'yellow' }),
    ], [], today);

    const readiness = map.get('EX-01');
    expect(readiness?.level).toBe('restricted');
    expect(readiness?.effectiveStatus).toBe('alerta');
  });

  it('keeps dispatch open for a current green sticker and approved DVIR', () => {
    const map = buildDispatchReadinessMap([
      stickerRow(),
    ], [
      dvirRow(),
    ], today);

    const readiness = map.get('EX-01');
    expect(readiness?.level).toBe('ok');
    expect(readiness?.label).toBe('Sticker vigente');
  });

  it('keeps a green sticker blocked until a supervisor approves the inspection', () => {
    const map = buildDispatchReadinessMap([
      stickerRow({ 10: 'pendiente_supervisor', 13: 'no' }),
    ], [], today);
    expect(map.get('EX-01')?.level).toBe('blocked');
    expect(map.get('EX-01')?.reason).toContain('pendiente de aprobación');
  });

  it('blocks a conditional sticker when a commitment expires', () => {
    const map = buildDispatchReadinessMap([
      stickerRow({ 12: 'yellow', 17: '2026-07-06' }),
    ], [], today);
    expect(map.get('EX-01')?.level).toBe('blocked');
  });

  it('preserves an unresolved failed DVIR even after a later passing inspection', () => {
    const map = buildDispatchReadinessMap([], [
      dvirRow({ 2: '05/07/2026', 22: 'reprobado', 26: 'Pendiente' }),
      dvirRow(),
    ], today);
    expect(map.get('EX-01')?.level).toBe('blocked');
  });

});
