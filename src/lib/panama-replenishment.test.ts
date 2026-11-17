import { describe, expect, it } from 'vitest';
import { calculateReplenishment, type ReplenishmentInput, type ReplenishmentSource } from './panama-replenishment';

const input: ReplenishmentInput = { unit: 'DZ203', life: '30', lifeMeasure: 'h', dailyUse: '5', readingDate: '2026-11-15',
  lifeReference: 'Inspección I-04 y plan de turnos', quantity: '14', leadDays: '8', leadReference: 'Cotización C-14' };
const source: ReplenishmentSource = {
  today: '2026-11-15', readAt: '2026-11-15T18:00:00Z',
  stock: { physical: '12', reserved: '3', available: '9', minimum: '2', measure: 'pza' },
  openOrders: [
    { folio: 'OC-1', lineId: 'L-1', remaining: '3', inTransit: '2', due: '2026-11-20' },
    { folio: 'OC-2', lineId: 'L-2', remaining: '2', inTransit: '0', due: '2026-11-22' },
  ],
  issues: [],
};

describe('reposición crítica C45', () => {
  it('descuenta el saldo pendiente una sola vez y separa adelantar una OC de comprar más', () => {
    expect(calculateReplenishment(source, input)).toMatchObject({ needDate: '2026-11-21', orderBy: '2026-11-13',
      needed: '16', timely: '3', late: '2', gap: '4', expedite: '2', additional: '2', leadRisk: true });
  });

  it('no recomienda con datos desconocidos, vencidos, incompatibles ni redondeos de piezas', () => {
    for (const bad of [
      { ...source, stock: { ...source.stock, available: null } },
      { ...source, openOrders: [{ ...source.openOrders[0]!, due: '2026-11-14' }] },
      { ...source, openOrders: [{ ...source.openOrders[0]!, due: null }] },
      { ...source, issues: [{ reason: 'Ubicación pendiente' }] },
    ]) expect(calculateReplenishment(bad, input)).toHaveProperty('error');
    expect(calculateReplenishment(source, { ...input, quantity: '2.25' })).toHaveProperty('error');
    expect(calculateReplenishment(source, { ...input, lifeReference: ' ' })).toHaveProperty('error');
    expect(calculateReplenishment(source, { ...input, readingDate: '2026-11-16' })).toHaveProperty('error');
  });

  it('conserva cantidades fraccionarias de una unidad métrica y reconoce vida agotada', () => {
    const metric = { ...source, stock: { physical: '8.9', reserved: '3.2', available: '5.7', minimum: '0.75', measure: 'm' }, openOrders: [] };
    const result = calculateReplenishment(metric, { ...input, life: '0', quantity: '6.125' });
    expect(result).toMatchObject({ needDate: '2026-11-15', coverageDate: '2026-11-15', additional: '1.175' });
    expect(calculateReplenishment({ ...metric, stock: { ...metric.stock, measure: '' } }, input)).toHaveProperty('error');
  });
});
