import { describe, expect, it } from 'vitest';
import { shouldUseBusinessIntake } from './intake-chat';

describe('shouldUseBusinessIntake', () => {
  it('routes greetings so Hermes can explain capabilities', () => {
    expect(shouldUseBusinessIntake('Hi')).toBe(true);
  });

  it('routes structured operating messages', () => {
    expect(shouldUseBusinessIntake('diesel unit=DT-210 operator=Luis litros=123 cost=456')).toBe(true);
  });

  it('does not steal pure part-number lookups', () => {
    expect(shouldUseBusinessIntake('7861-93-1812')).toBe(false);
  });

  it('routes evidence photos when the user asks to register them', () => {
    expect(shouldUseBusinessIntake('registrar falla con evidencia', true)).toBe(true);
  });
});
