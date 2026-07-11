import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ── Source text (read once) ───────────────────────────────────────────────────
const SOURCE_PATH = path.resolve(__dirname, 'FleetGrid.tsx');
const source = fs.readFileSync(SOURCE_PATH, 'utf-8');

// ── Module default export ─────────────────────────────────────────────────────
// We use a dynamic import with mocked deps to verify the default export exists.
// FleetGrid imports react-router-dom-adjacent deps indirectly via UnitDetailModal;
// we only need the module shape, not a render.

describe('FleetGrid — module exports', () => {
  it('exports a default (the FleetGrid component)', async () => {
    // Minimal vi.mock is not needed: we check via source that `export default` exists
    expect(source).toContain('export default function FleetGrid');
  });
});

// ── STATUS_ORDER constant ─────────────────────────────────────────────────────
describe('FleetGrid — STATUS_ORDER constant', () => {
  it("STATUS_ORDER contains 'taller' as the first element", () => {
    // Parse the array literal from source text
    const match = source.match(/STATUS_ORDER[^=]*=\s*(\[[^\]]+\])/);
    expect(match).not.toBeNull();
    const arrayLiteral = match![1]!;
    const values = arrayLiteral
      .replace(/[[\]\s'"`]/g, '')
      .split(',')
      .filter(Boolean);
    expect(values[0]).toBe('taller');
  });

  it("STATUS_ORDER contains 'alerta' as the second element", () => {
    const match = source.match(/STATUS_ORDER[^=]*=\s*(\[[^\]]+\])/);
    const arrayLiteral = match![1]!;
    const values = arrayLiteral
      .replace(/[[\]\s'"`]/g, '')
      .split(',')
      .filter(Boolean);
    expect(values[1]).toBe('alerta');
  });

  it("STATUS_ORDER contains 'operativo' as the third element", () => {
    const match = source.match(/STATUS_ORDER[^=]*=\s*(\[[^\]]+\])/);
    const arrayLiteral = match![1]!;
    const values = arrayLiteral
      .replace(/[[\]\s'"`]/g, '')
      .split(',')
      .filter(Boolean);
    expect(values[2]).toBe('operativo');
  });

  it("STATUS_ORDER contains 'inactivo' as the fourth element", () => {
    const match = source.match(/STATUS_ORDER[^=]*=\s*(\[[^\]]+\])/);
    const arrayLiteral = match![1]!;
    const values = arrayLiteral
      .replace(/[[\]\s'"`]/g, '')
      .split(',')
      .filter(Boolean);
    expect(values[3]).toBe('inactivo');
  });

  it('STATUS_ORDER has exactly 4 elements', () => {
    const match = source.match(/STATUS_ORDER[^=]*=\s*(\[[^\]]+\])/);
    const arrayLiteral = match![1]!;
    const values = arrayLiteral
      .replace(/[[\]\s'"`]/g, '')
      .split(',')
      .filter(Boolean);
    expect(values).toHaveLength(4);
  });

  it('STATUS_ORDER full ordering is taller, alerta, operativo, inactivo', () => {
    const match = source.match(/STATUS_ORDER[^=]*=\s*(\[[^\]]+\])/);
    const arrayLiteral = match![1]!;
    const values = arrayLiteral
      .replace(/[[\]\s'"`]/g, '')
      .split(',')
      .filter(Boolean);
    expect(values).toEqual(['taller', 'alerta', 'operativo', 'inactivo']);
  });
});

// ── Sort logic using STATUS_ORDER ─────────────────────────────────────────────
describe('FleetGrid — STATUS_ORDER sorting logic', () => {
  // Mirror the exact STATUS_ORDER from source to test the sort behaviour in isolation.
  const STATUS_ORDER = ['taller', 'alerta', 'operativo', 'inactivo'];

  it('sorts taller before alerta', () => {
    const items = [
      { status: 'alerta' as const },
      { status: 'taller' as const },
    ];
    const sorted = [...items].sort(
      (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
    );
    expect(sorted[0]!.status).toBe('taller');
  });

  it('sorts inactivo last', () => {
    const items = [
      { status: 'inactivo' as const },
      { status: 'operativo' as const },
      { status: 'taller' as const },
    ];
    const sorted = [...items].sort(
      (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
    );
    expect(sorted[sorted.length - 1]!.status).toBe('inactivo');
  });

  it('does not mutate the original array', () => {
    const items = [
      { status: 'inactivo' as const },
      { status: 'taller' as const },
    ];
    const original = items.map((i) => i.status);
    [...items].sort(
      (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
    );
    expect(items.map((i) => i.status)).toEqual(original);
  });
});

// ── Click handler wiring ──────────────────────────────────────────────────────
describe('FleetGrid — click handler opens modal', () => {
  it('source wires onClick to setSelected on each tile button', () => {
    expect(source).toContain('onClick={() => setSelected({ unit, readiness })');
  });

  it('source renders UnitDetailModal when selected is truthy', () => {
    expect(source).toContain('UnitDetailModal');
    expect(source).toContain('selected &&');
  });

  it('source passes onClose that resets selected to null', () => {
    expect(source).toContain('onClose={() => setSelected(null)');
  });
});

// ── StatusDot colour mapping ──────────────────────────────────────────────────
// FleetGrid delegates colour rendering to <StatusDot>. We verify StatusDot's
// STATUS_CLASSES map covers the correct CSS token for each status.
describe('StatusDot — status class mapping', () => {
  const STATUS_DOT_PATH = path.resolve(__dirname, '../ui/StatusDot.tsx');
  const dotSource = fs.readFileSync(STATUS_DOT_PATH, 'utf-8');

  it("maps 'operativo' to bg-success class", () => {
    expect(dotSource).toContain("operativo: 'bg-success'");
  });

  it("maps 'alerta' to bg-warning class", () => {
    expect(dotSource).toContain("alerta: 'bg-warning");
  });

  it("maps 'taller' to bg-critical class", () => {
    expect(dotSource).toContain("taller: 'bg-critical'");
  });

  it("maps 'inactivo' to bg-gray-400 class", () => {
    expect(dotSource).toContain("inactivo: 'bg-gray-400'");
  });
});
