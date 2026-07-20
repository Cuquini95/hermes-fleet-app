import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SHEET_TABS, appendRow, readRange, updateCell } from './sheets-api';
import { useAuthStore } from '../stores/auth-store';

// ── SHEET_TABS constants ──────────────────────────────────────────────────────

describe('SHEET_TABS constants', () => {
  it('FLOTA maps to "01 Inventario"', () => {
    expect(SHEET_TABS.FLOTA).toBe('01 Inventario');
  });

  it('ORDENES_TRABAJO maps to "ORDENES_TRABAJO"', () => {
    expect(SHEET_TABS.ORDENES_TRABAJO).toBe('ORDENES_TRABAJO');
  });

  it('OT_STATUS_LOG maps to "OT_STATUS_LOG"', () => {
    expect(SHEET_TABS.OT_STATUS_LOG).toBe('OT_STATUS_LOG');
  });

  it('COMBUSTIBLE maps to "Combustible"', () => {
    expect(SHEET_TABS.COMBUSTIBLE).toBe('Combustible');
  });

  it('GASTOS maps to "02 Gastos"', () => {
    expect(SHEET_TABS.GASTOS).toBe('02 Gastos');
  });

  it('AVERIAS maps to "Averías"', () => {
    expect(SHEET_TABS.AVERIAS).toBe('Averías');
  });

  it('contains all expected keys (no accidental deletion)', () => {
    const expectedKeys = [
      'FLOTA', 'INSPECCIONES', 'AVERIAS', 'ORDENES_TRABAJO', 'OT_STATUS_LOG',
      'COMBUSTIBLE', 'VIAJES', 'HOROMETROS', 'HISTORIAL_PM', 'ORDENES_MANTENIMIENTO',
      'INVENTARIO', 'FLETES', 'INCIDENTES', 'TURNOS', 'COTIZACIONES',
      'NEUMATICOS', 'GASTOS', 'WORKSHOP_SCHEDULE',
    ] as const;
    for (const key of expectedKeys) {
      expect(SHEET_TABS).toHaveProperty(key);
    }
  });

  it('all values are non-empty strings', () => {
    for (const [key, val] of Object.entries(SHEET_TABS)) {
      expect(typeof val, `SHEET_TABS.${key} should be a string`).toBe('string');
      expect((val as string).length, `SHEET_TABS.${key} should not be empty`).toBeGreaterThan(0);
    }
  });
});

// ── appendRow error handling ──────────────────────────────────────────────────
// appendRow uses an internal fetchWithRetry helper that calls global fetch.
// We stub fetch globally and use fake timers to skip retry backoff delays.

describe('appendRow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
    // Stub localStorage used by the cache invalidation layer
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  afterEach(() => {
    useAuthStore.getState().logout();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('throws on 4xx responses', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('Unauthorized', { status: 401 }),
    );
    await expect(appendRow('SomeTab', ['a', 'b'])).rejects.toThrow('401');
  });

  it('throws on 5xx responses', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('Internal Server Error', { status: 500 }),
    );
    await expect(appendRow('SomeTab', ['a', 'b'])).rejects.toThrow('500');
  });

  it('throws when response.ok but json.success is false', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: 'Row not written' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await expect(appendRow('SomeTab', ['a', 'b'])).rejects.toThrow('Row not written');
  });

  it('resolves successfully when json.success is true', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await expect(appendRow('SomeTab', ['val1', 'val2'])).resolves.toBeUndefined();
  });

  it('sends POST to /api/sheets/append with correct body', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await appendRow('TestTab', ['colA', 'colB']);

    const [url, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/sheets/append');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body as string);
    expect(body.tab).toBe('TestTab');
    expect(body.values).toEqual(['colA', 'colB']);
  });

  it('sends the current server session token to the gateway', async () => {
    useAuthStore.getState().setSession({
      token: 'server-session-token-1234567890',
      role: 'gerencia',
      user_name: 'Gerencia',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    });
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await appendRow('TestTab', ['value']);

    const [, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>).Authorization).toBe(
      'Bearer server-session-token-1234567890',
    );
  });

  it('normalizes Fletes customer aliases before append', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const row = Array.from({ length: 15 }, (_, i) => `col${i}`);
    row[9] = 'La Sabida';
    await appendRow(SHEET_TABS.FLETES, row);

    const [, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.values[9]).toBe('SBM Constructora');
  });

  it('uses fallback error message when json.success=false with no error field', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await expect(appendRow('SomeTab', ['a'])).rejects.toThrow('appendRow failed');
  });
});

describe('readRange', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes Fletes customer aliases on read', async () => {
    const row = Array.from({ length: 15 }, (_, i) => `col${i}`);
    row[9] = 'lla Sallada';
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: [row] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(readRange(SHEET_TABS.FLETES)).resolves.toEqual([
      expect.arrayContaining(['SBM Constructora']),
    ]);
  });
});

describe('updateCell', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes Fletes customer aliases before update', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await updateCell(SHEET_TABS.FLETES, 0, '25/04/2026', 9, 'La Saladala');

    const [, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.update_value).toBe('SBM Constructora');
  });
});
