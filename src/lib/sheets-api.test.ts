import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SHEET_TABS, appendRow } from './sheets-api';

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

  it('AVERIAS maps to the gateway-safe tab key', () => {
    expect(SHEET_TABS.AVERIAS).toBe('Averias');
  });

  it('sticker inspection tabs are present', () => {
    expect(SHEET_TABS.INSPECCION_STICKERS).toBe('Inspeccion_Stickers');
    expect(SHEET_TABS.INSPECCION_HALLAZGOS).toBe('Inspeccion_Hallazgos');
  });

  it('contains all expected keys (no accidental deletion)', () => {
    const expectedKeys = [
      'FLOTA', 'INSPECCIONES', 'INSPECCION_STICKERS', 'INSPECCION_HALLAZGOS',
      'AVERIAS', 'ORDENES_TRABAJO', 'OT_STATUS_LOG',
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

  it('attaches Authorization Bearer from auth-store sessionToken', async () => {
    const { useAuthStore } = await import('../stores/auth-store');
    useAuthStore.setState({ authMode: 'server', sessionToken: 'test-session-token-xyz' });
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await appendRow('AuthTab', ['a']);

    const [, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const headers = new Headers(options.headers);
    expect(headers.get('Authorization')).toBe('Bearer test-session-token-xyz');
    useAuthStore.setState({ authMode: null, sessionToken: null });
  });

  it('clears a stale server session when Sheets rejects it', async () => {
    const { useAuthStore } = await import('../stores/auth-store');
    useAuthStore.setState({
      role: 'gerencia',
      userName: 'Gerencia',
      isAuthenticated: true,
      authMode: 'server',
      sessionToken: 'stale-session-token',
      sessionExpiresAt: '2099-01-01T00:00:00.000Z',
    });
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Invalid session.' }), { status: 401 }),
    );

    await expect(appendRow('AuthTab', ['a'])).rejects.toThrow('401');

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().authMode).toBeNull();
    expect(useAuthStore.getState().sessionToken).toBeNull();
  });

  it('clears an offline-mode session when Sheets rejects it', async () => {
    const { useAuthStore } = await import('../stores/auth-store');
    useAuthStore.setState({
      role: 'gerencia',
      userName: 'Gerencia',
      isAuthenticated: true,
      authMode: 'offline',
      sessionToken: null,
      sessionExpiresAt: null,
    });
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Authentication required.' }), { status: 401 }),
    );

    await expect(appendRow('AuthTab', ['a'])).rejects.toThrow('401');

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().authMode).toBeNull();
  });

  it('clears a legacy session that predates authMode when Sheets rejects it', async () => {
    const { useAuthStore } = await import('../stores/auth-store');
    useAuthStore.setState({
      role: 'gerencia',
      userName: 'Gerencia',
      isAuthenticated: true,
      authMode: null,
      sessionToken: null,
      sessionExpiresAt: null,
    });
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Authentication required.' }), { status: 401 }),
    );

    await expect(appendRow('AuthTab', ['a'])).rejects.toThrow('401');

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
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
