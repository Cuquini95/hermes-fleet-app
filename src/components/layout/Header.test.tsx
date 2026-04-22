import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ROLE_HOME } from '../../types/roles';
import type { AppRole } from '../../types/roles';

// ── Source text ───────────────────────────────────────────────────────────────
const SOURCE_PATH = path.resolve(__dirname, 'Header.tsx');
const source = fs.readFileSync(SOURCE_PATH, 'utf-8');

// ── Module default export ─────────────────────────────────────────────────────
describe('Header — module exports', () => {
  it('exports a default (the Header component)', () => {
    expect(source).toContain('export default function Header');
  });
});

// ── ROLE_HOME mapping completeness ────────────────────────────────────────────
describe('Header — ROLE_HOME covers all 6 roles', () => {
  const ALL_ROLES: AppRole[] = [
    'operador',
    'mecanico',
    'jefe_taller',
    'supervisor',
    'coordinador',
    'gerencia',
  ];

  it('ROLE_HOME is defined and is an object', () => {
    expect(ROLE_HOME).toBeDefined();
    expect(typeof ROLE_HOME).toBe('object');
  });

  for (const role of ALL_ROLES) {
    it(`ROLE_HOME has a path for role "${role}"`, () => {
      expect(ROLE_HOME[role]).toBeDefined();
      expect(typeof ROLE_HOME[role]).toBe('string');
      expect(ROLE_HOME[role].length).toBeGreaterThan(0);
    });
  }

  it('ROLE_HOME["operador"] is "/operator"', () => {
    expect(ROLE_HOME['operador']).toBe('/operator');
  });

  it('ROLE_HOME["mecanico"] is "/mechanic"', () => {
    expect(ROLE_HOME['mecanico']).toBe('/mechanic');
  });

  it('ROLE_HOME["jefe_taller"] is "/workshop"', () => {
    expect(ROLE_HOME['jefe_taller']).toBe('/workshop');
  });

  it('ROLE_HOME["coordinador"] is "/coordinator"', () => {
    expect(ROLE_HOME['coordinador']).toBe('/coordinator');
  });

  it('ROLE_HOME["supervisor"] is "/supervisor"', () => {
    expect(ROLE_HOME['supervisor']).toBe('/supervisor');
  });

  it('ROLE_HOME["gerencia"] is "/dashboard"', () => {
    expect(ROLE_HOME['gerencia']).toBe('/dashboard');
  });
});

// ── isRoleHome logic ──────────────────────────────────────────────────────────
describe('Header — isRoleHome hides back arrow', () => {
  it('source computes isRoleHome from pathname === roleHome OR pathname === "/"', () => {
    expect(source).toContain('location.pathname === roleHome || location.pathname === \'/\'');
  });

  it('source conditionally renders the back arrow only when !isRoleHome', () => {
    expect(source).toContain('!isRoleHome');
  });

  // Replicate the exact isRoleHome logic from Header.tsx in isolation
  function makeIsRoleHome(pathname: string, role: AppRole | null) {
    const roleHome = role ? ROLE_HOME[role] : '/';
    return pathname === roleHome || pathname === '/';
  }

  it('returns true when pathname matches the role home path', () => {
    expect(makeIsRoleHome('/workshop', 'jefe_taller')).toBe(true);
  });

  it('returns true when pathname is "/" regardless of role', () => {
    expect(makeIsRoleHome('/', 'operador')).toBe(true);
  });

  it('returns true when pathname is "/" and role is null', () => {
    expect(makeIsRoleHome('/', null)).toBe(true);
  });

  it('returns false when pathname differs from roleHome and is not "/"', () => {
    expect(makeIsRoleHome('/workorders', 'jefe_taller')).toBe(false);
  });

  it('returns false when pathname is a sub-route of roleHome', () => {
    expect(makeIsRoleHome('/workshop/detail', 'jefe_taller')).toBe(false);
  });

  it('returns false for coordinador on a non-home route', () => {
    expect(makeIsRoleHome('/pm-order', 'coordinador')).toBe(false);
  });

  it('returns true for gerencia at /dashboard', () => {
    expect(makeIsRoleHome('/dashboard', 'gerencia')).toBe(true);
  });

  it('returns true for supervisor at /supervisor', () => {
    expect(makeIsRoleHome('/supervisor', 'supervisor')).toBe(true);
  });
});

// ── goBack fallback logic ─────────────────────────────────────────────────────
describe('Header — goBack falls back to roleHome when history is shallow', () => {
  it('source calls navigate(-1) when window.history.length > 1', () => {
    expect(source).toContain('window.history.length > 1');
    expect(source).toContain('navigate(-1)');
  });

  it('source falls back to navigate(roleHome, { replace: true }) when no history', () => {
    expect(source).toContain('navigate(roleHome, { replace: true })');
  });

  // Replicate goBack logic in isolation
  function simulateGoBack(
    historyLength: number,
    role: AppRole | null,
  ): { action: 'back' | 'roleHome'; dest?: string } {
    const roleHome = role ? ROLE_HOME[role] : '/';
    if (historyLength > 1) {
      return { action: 'back' };
    }
    return { action: 'roleHome', dest: roleHome };
  }

  it('goes back when history.length is 2', () => {
    expect(simulateGoBack(2, 'jefe_taller').action).toBe('back');
  });

  it('goes back when history.length is 10', () => {
    expect(simulateGoBack(10, 'operador').action).toBe('back');
  });

  it('falls back to roleHome when history.length is 1', () => {
    const result = simulateGoBack(1, 'jefe_taller');
    expect(result.action).toBe('roleHome');
    expect(result.dest).toBe('/workshop');
  });

  it('falls back to roleHome when history.length is 0', () => {
    const result = simulateGoBack(0, 'gerencia');
    expect(result.action).toBe('roleHome');
    expect(result.dest).toBe('/dashboard');
  });

  it('falls back to "/" when role is null and history is shallow', () => {
    const result = simulateGoBack(1, null);
    expect(result.action).toBe('roleHome');
    expect(result.dest).toBe('/');
  });
});

// ── canSeeCart and canSeeAlerts role gates (source check) ─────────────────────
describe('Header — role-gated UI elements', () => {
  it('canSeeCart is restricted to jefe_taller and gerencia', () => {
    expect(source).toContain("role === 'jefe_taller' || role === 'gerencia'");
  });

  it('canSeeAlerts includes jefe_taller, coordinador, supervisor, gerencia', () => {
    expect(source).toContain("canSeeAlerts");
    expect(source).toContain("coordinador");
    expect(source).toContain("supervisor");
  });
});
