import { describe, expect, it } from 'vitest';
import { normalizeCustomerName, SBM_CONSTRUCTORA } from './customer-normalization';

describe('normalizeCustomerName', () => {
  it.each([
    'La Salada',
    'La salada',
    'LA SALADA',
    'la salada.',
    'La Sabida',
    'La Balada',
    'sin cliente',
    'La Saludo',
    'lla Sallada',
    'La Saladaily',
    'La Saladala',
    ' la salada ',
  ])('routes %s to SBM Constructora', (value) => {
    expect(normalizeCustomerName(value)).toBe(SBM_CONSTRUCTORA);
  });

  it('leaves unrelated customers unchanged', () => {
    expect(normalizeCustomerName('Pesadas')).toBe('Pesadas');
    expect(normalizeCustomerName('Peña Colorada')).toBe('Peña Colorada');
  });
});
