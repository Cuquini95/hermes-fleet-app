import { afterEach, describe, expect, it, vi } from 'vitest';
import { diagnose, normalizePartResult } from './hermes-api';
import { hermesApiUrl, resolveHermesApiBase } from './hermes-api-base';
import { useAuthStore } from '../stores/auth-store';

afterEach(() => {
  vi.restoreAllMocks();
  useAuthStore.setState({ authMode: null, sessionToken: null, sessionExpiresAt: null });
});

describe('normalizePartResult', () => {
  it('fills missing catalog fields for supplier price rows', () => {
    const part = normalizePartResult({
      part_number: 'HF6101',
      description: 'FILTRO HIDRAULICO',
      supplier: 'Megamak',
      unit_price: 498.4,
      last_updated: '2026-04-12',
    });

    expect(part).toMatchObject({
      part_number: 'HF6101',
      description: 'FILTRO HIDRAULICO',
      supplier: 'Megamak',
      oem_ref: 'Megamak',
      compatible_units: [],
      stock_quantity: 0,
      stock_minimum: 1,
      location: 'Proveedor: Megamak',
      unit_price: 498.4,
      alternatives: [],
    });
  });
});

describe('Hermes API base URL', () => {
  it('uses the local proxy in production when no override is configured', () => {
    expect(resolveHermesApiBase({ PROD: true })).toBe('/hermes-api');
  });

  it('uses the local proxy in development when no override is configured', () => {
    expect(resolveHermesApiBase({ PROD: false })).toBe('/hermes-api');
  });

  it('normalizes configured API URLs and request paths', () => {
    expect(resolveHermesApiBase({ VITE_HERMES_API_URL: 'https://api.example.com/hermes-api///' }))
      .toBe('https://api.example.com/hermes-api');
    expect(hermesApiUrl('/health')).toBe('/hermes-api/health');
  });
});

describe('Hermes authenticated AI client', () => {
  it('forwards the server session to protected AI routes', async () => {
    useAuthStore.setState({ authMode: 'server', sessionToken: 'signed-session' });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        causas_probables: ['Causa 1'],
        checklist_diagnostico: ['Prueba 1'],
        partes_probables: ['Parte 1'],
        prioridad: 'MEDIA',
      }), { status: 200 }),
    );

    await diagnose({ equipo: 'CA20', sintoma: 'falla de prueba' });

    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(options.headers).get('Authorization')).toBe('Bearer signed-session');
  });
});
