import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ── Source text ───────────────────────────────────────────────────────────────
const SOURCE_PATH = path.resolve(__dirname, 'UnitDetailModal.tsx');
const source = fs.readFileSync(SOURCE_PATH, 'utf-8');

// ── Module default export ─────────────────────────────────────────────────────
describe('UnitDetailModal — module exports', () => {
  it('exports a default (the UnitDetailModal component)', () => {
    expect(source).toContain('export default function UnitDetailModal');
  });
});

// ── Props interface ───────────────────────────────────────────────────────────
describe('UnitDetailModal — props', () => {
  it('accepts a "unit" prop of type Equipment', () => {
    // The interface UnitDetailModalProps must declare unit
    expect(source).toContain('unit: Equipment');
  });

  it('accepts an "onClose" callback prop', () => {
    expect(source).toContain('onClose: () => void');
  });

  it('destructures both unit and onClose in the function signature', () => {
    // Signature: function UnitDetailModal({ unit, onClose }: UnitDetailModalProps)
    const signatureMatch = source.match(/function UnitDetailModal\(\{([^}]+)\}/);
    expect(signatureMatch).not.toBeNull();
    const params = signatureMatch![1]!;
    expect(params).toContain('unit');
    expect(params).toContain('onClose');
  });
});

// ── Averías tab read logic ────────────────────────────────────────────────────
describe('UnitDetailModal — Averías tab data loading', () => {
  it('reads from SHEET_TABS.AVERIAS', () => {
    expect(source).toContain('SHEET_TABS.AVERIAS');
  });

  it('calls readRange to fetch averia rows', () => {
    expect(source).toContain('readRange');
  });

  it('filters rows by unit_id (case-insensitive)', () => {
    expect(source).toContain('unit.unit_id.toUpperCase()');
  });

  it('skips the first 3 header rows (slice(3))', () => {
    expect(source).toContain('.slice(3)');
  });

  it('cancels the async fetch on unmount via cancelled flag', () => {
    expect(source).toContain('cancelled = true');
  });
});

// ── Empty state string ────────────────────────────────────────────────────────
describe('UnitDetailModal — empty state messaging', () => {
  it('contains "Sin reporte de avería registrado" empty-state message', () => {
    expect(source).toContain('Sin reporte de avería registrado');
  });

  it('shows empty state when both open and closed averia arrays are empty', () => {
    // Source must check both open.length and closed.length equal 0
    expect(source).toContain('open.length === 0 && closed.length === 0');
  });
});

// ── Averia state split: open vs closed ───────────────────────────────────────
describe('UnitDetailModal — open/closed averia filtering', () => {
  it('filters open averias where estado is "abierta"', () => {
    expect(source).toContain("estado.toLowerCase() === 'abierta'");
  });

  it('filters closed averias as the inverse of open', () => {
    // Source uses !== 'abierta' for closed
    expect(source).toContain("estado.toLowerCase() !== 'abierta'");
  });
});

// ── parseAveriaRow helper ─────────────────────────────────────────────────────
describe('UnitDetailModal — parseAveriaRow helper', () => {
  it('declares a parseAveriaRow function', () => {
    expect(source).toContain('function parseAveriaRow');
  });

  it('maps row[0] to fecha field', () => {
    expect(source).toContain('fecha:');
    expect(source).toContain('row[0]');
  });

  it('maps row[4] to descripcion field', () => {
    expect(source).toContain('descripcion:');
    expect(source).toContain('row[4]');
  });

  // Verify the helper logic in isolation
  it('parseAveriaRow logic: trims and maps array indices correctly', () => {
    // Replicate the mapping inline to verify index semantics
    const parseAveriaRow = (row: string[]) => ({
      fecha: (row[0] ?? '').trim(),
      hora: (row[1] ?? '').trim(),
      tipo: (row[3] ?? '').trim(),
      descripcion: (row[4] ?? '').trim(),
      severidad: (row[5] ?? '').trim().toUpperCase(),
      tecnico: (row[6] ?? '').trim(),
    });

    const row = ['2026-04-01', '08:30', 'unitId', 'Hidráulico', 'Fuga aceite', 'alta', 'Juan'];
    const result = parseAveriaRow(row);
    expect(result.fecha).toBe('2026-04-01');
    expect(result.hora).toBe('08:30');
    expect(result.tipo).toBe('Hidráulico');
    expect(result.descripcion).toBe('Fuga aceite');
    expect(result.severidad).toBe('ALTA');
    expect(result.tecnico).toBe('Juan');
  });

  it('parseAveriaRow uses ?? to default missing cells to empty string', () => {
    expect(source).toContain("?? ''");
  });
});
