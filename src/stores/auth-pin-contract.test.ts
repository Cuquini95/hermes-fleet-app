import { describe, expect, it } from 'vitest';
import * as authStore from './auth-store';

describe('production authentication contract', () => {
  it('does not ship role PINs or MOCK_USERS in the browser bundle', () => {
    expect(authStore).not.toHaveProperty('MOCK_USERS');
  });

  it('exposes only the authenticated session store', () => {
    expect(authStore.useAuthStore).toBeDefined();
    expect(typeof authStore.useAuthStore.getState().login).toBe('function');
  });
});
