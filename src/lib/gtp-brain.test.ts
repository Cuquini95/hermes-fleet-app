import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeHermesPage } from './gtp-brain';
import { useAuthStore } from '../stores/auth-store';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  ));
  useAuthStore.getState().setSession({
    token: 'server-session-token-1234567890',
    role: 'gerencia',
    user_name: 'Gerencia',
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  });
});

afterEach(() => {
  useAuthStore.getState().logout();
  vi.unstubAllGlobals();
});

describe('gtp-brain client', () => {
  it('forwards the current Hermes session to the Vercel Brain proxy', async () => {
    await analyzeHermesPage({
      app: 'hermes',
      user_message: 'status',
      page: 'dashboard',
    });

    const [, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>).Authorization).toBe(
      'Bearer server-session-token-1234567890',
    );
  });
});
