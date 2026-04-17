import { describe, it, expect } from 'vitest';
import { calculatePriority } from './priority-calculator';

describe('calculatePriority', () => {
  // CRITICA: cannot move + real client
  it('returns CRITICA when unit cannot move and has a real client', () => {
    expect(calculatePriority({
      puede_moverse: false,
      cliente_afectado: 'Peña Colorada',
      tipo_falla: 'Motor',
    })).toBe('CRITICA');
  });

  it('returns CRITICA regardless of tipo_falla when immobile with real client', () => {
    expect(calculatePriority({
      puede_moverse: false,
      cliente_afectado: 'ACME Corp',
      tipo_falla: '',
    })).toBe('CRITICA');
  });

  // ALTA: cannot move + no real client (blocklisted values)
  it('returns ALTA when unit cannot move and client is empty string', () => {
    expect(calculatePriority({
      puede_moverse: false,
      cliente_afectado: '',
      tipo_falla: 'Hidráulico',
    })).toBe('ALTA');
  });

  it('returns ALTA when unit cannot move and client is "n/a"', () => {
    expect(calculatePriority({
      puede_moverse: false,
      cliente_afectado: 'n/a',
      tipo_falla: 'Eléctrico',
    })).toBe('ALTA');
  });

  it('returns ALTA when unit cannot move and client is "ninguno"', () => {
    expect(calculatePriority({
      puede_moverse: false,
      cliente_afectado: 'ninguno',
      tipo_falla: '',
    })).toBe('ALTA');
  });

  it('returns ALTA when unit cannot move and client is "--"', () => {
    expect(calculatePriority({
      puede_moverse: false,
      cliente_afectado: '--',
      tipo_falla: 'Motor',
    })).toBe('ALTA');
  });

  it('returns ALTA when unit cannot move and client is "na"', () => {
    expect(calculatePriority({
      puede_moverse: false,
      cliente_afectado: 'na',
      tipo_falla: '',
    })).toBe('ALTA');
  });

  it('returns ALTA when unit cannot move and client is "none"', () => {
    expect(calculatePriority({
      puede_moverse: false,
      cliente_afectado: 'none',
      tipo_falla: '',
    })).toBe('ALTA');
  });

  it('is case-insensitive for blocklist matching — "N/A" treated as blocklisted', () => {
    expect(calculatePriority({
      puede_moverse: false,
      cliente_afectado: 'N/A',
      tipo_falla: '',
    })).toBe('ALTA');
  });

  it('trims whitespace before blocklist check', () => {
    expect(calculatePriority({
      puede_moverse: false,
      cliente_afectado: '  ninguno  ',
      tipo_falla: '',
    })).toBe('ALTA');
  });

  // MEDIA: can move + has a tipo_falla
  it('returns MEDIA when unit can move and has a tipo_falla', () => {
    expect(calculatePriority({
      puede_moverse: true,
      cliente_afectado: 'Peña Colorada',
      tipo_falla: 'Frenos',
    })).toBe('MEDIA');
  });

  it('returns MEDIA even when client is blocklisted if unit can move and has falla type', () => {
    expect(calculatePriority({
      puede_moverse: true,
      cliente_afectado: '',
      tipo_falla: 'Hidráulico',
    })).toBe('MEDIA');
  });

  // BAJA: can move + no tipo_falla
  it('returns BAJA when unit can move and tipo_falla is empty', () => {
    expect(calculatePriority({
      puede_moverse: true,
      cliente_afectado: 'Peña Colorada',
      tipo_falla: '',
    })).toBe('BAJA');
  });

  it('returns BAJA when all conditions are minimal', () => {
    expect(calculatePriority({
      puede_moverse: true,
      cliente_afectado: '',
      tipo_falla: '',
    })).toBe('BAJA');
  });

  // Priority order: CRITICA > ALTA > MEDIA > BAJA
  it('CRITICA beats all other conditions', () => {
    const result = calculatePriority({
      puede_moverse: false,
      cliente_afectado: 'RealClient',
      tipo_falla: 'Something',
    });
    expect(result).toBe('CRITICA');
  });

  it('ALTA takes precedence over MEDIA/BAJA logic', () => {
    // immobile + no client + has falla type — ALTA, not MEDIA
    const result = calculatePriority({
      puede_moverse: false,
      cliente_afectado: '',
      tipo_falla: 'Motor',
    });
    expect(result).toBe('ALTA');
  });
});
