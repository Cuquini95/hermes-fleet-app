import { describe, expect, it } from 'vitest';
import { compareQuotes, validateQuoteOrderPrefill, type ComparedOfferInput, type QuoteComparisonInput, type QuoteOrderPrefill } from './panama-quote-comparison';
import type { PurchaseIssuer, PurchaseRequestLine, PurchaseVendor } from './purchasing-api';

const quote: ComparedOfferInput = {
  id: 'long', vendor: 'P1', reference: 'COT-100', currency: 'USD', quantity: '10.125',
  unitPrice: '10.00', freight: '5.75', other: '0.25', promisedDate: '2026-11-21',
  compatibility: 'confirmed', compatibilityEvidence: 'Serie 128 y parte A-01 confirmadas', warranty: '6 meses',
};

const input: QuoteComparisonInput = {
  quantity: '10.125', currency: 'USD', comparisonDate: '2026-11-16', neededDate: '2026-11-18',
  downtime: { hoursPerDay: '8', hourlyCost: '15.00', source: 'Supuesto de la OT', basis: 'estimate' },
  offers: [quote, { ...quote, id: 'fast', vendor: 'P2', unitPrice: '14.00', promisedDate: '2026-11-18' }],
};

describe('comparar cotizaciones Panamá', () => {
  it('redondea la cantidad fraccionada y permite que el paro estimado cambie el orden', () => {
    const result = compareQuotes(input);
    expect(result.cheapestLanded).toEqual(['long']);
    expect(result.cheapestWithDowntime).toEqual(['fast']);
    expect(result.offers.map(({ landedCents, leadDays, delayDays, downtimeCents, totalWithDowntimeCents }) =>
      [landedCents, leadDays, delayDays, downtimeCents, totalWithDowntimeCents],
    )).toEqual([[10725n, 5, 3, 36000n, 46725n], [14775n, 2, 0, 0n, 14775n]]);
  });

  it('conserva un precio documentado sin inventar una estimación de paro', () => {
    const result = compareQuotes({ ...input, neededDate: '', downtime: { ...input.downtime, source: '' } });
    expect(result.offers[0]).toMatchObject({ landedCents: 10725n, delayDays: null, downtimeCents: null });
    expect(result.cheapestLanded).toEqual(['long']);
    expect(result.cheapestWithDowntime).toEqual([]);
  });

  it('excluye partidas con otra moneda, una cantidad distinta o compatibilidad sin sustento', () => {
    const result = compareQuotes({ ...input, offers: [
      quote,
      { ...quote, id: 'currency', currency: 'PAB' },
      { ...quote, id: 'qty', quantity: '10' },
      { ...quote, id: 'pending', compatibility: 'pending' },
      { ...quote, id: 'evidence', compatibilityEvidence: '' },
      { ...quote, id: 'freight', freight: '' },
    ] });
    expect(result.offers.map(offer => offer.eligible)).toEqual([true, false, false, false, false, false]);
    expect(result.offers.at(1)).toMatchObject({ landedCents: 10725n, downtimeCents: null, totalWithDowntimeCents: null });
    expect(result.offers.at(4)?.issues).toContain('Falta el respaldo de compatibilidad.');
    expect(result.offers.at(5)?.landedCents).toBeNull();
    expect(result.cheapestLanded).toEqual([]);
  });

  it('identifica empates y rechaza fechas que no existen o ya vencieron', () => {
    const result = compareQuotes({ ...input, offers: [
      quote, { ...quote, id: 'tie', vendor: 'P2' },
      { ...quote, id: 'invalid-date', promisedDate: '2026-11-31' },
      { ...quote, id: 'past-date', promisedDate: '2026-11-15' },
    ] });
    expect(result.cheapestLanded).toEqual(['long', 'tie']);
    expect(result.cheapestWithDowntime).toEqual(['long', 'tie']);
    expect(result.offers.at(2)?.eligible).toBe(false);
    expect(result.offers.at(3)?.eligible).toBe(false);
  });
});

describe('preparar la OC desde la cotización', () => {
  const request = {
    id: 'PED-1-L1', version: 'v2', cantidad: '14', unallocatedQuantity: '10.125',
  } as PurchaseRequestLine;
  const issuer: PurchaseIssuer = {
    id: 'TP', name: 'Trans Plus Panamá', currency: 'USD', address: '', phone: '', taxLabel: 'ITBMS', template: 'transplus',
  };
  const vendor: PurchaseVendor = { name: 'Proveedor A', rfc: 'QA-001', address: '' };
  const prefill: QuoteOrderPrefill = {
    requestLineId: request.id, requestVersion: request.version, quantity: '10.125',
    entityId: issuer.id, currency: 'USD', vendor, unitPrice: '10.00', shipping: '5.75', other: '0.25',
    deliveryDate: '2026-11-21', quoteReference: 'COT-100', rationale: 'Entrega antes del paro previsto',
  };

  it('traspasa al borrador solo la cotización del saldo vigente y con proveedor del catálogo', () => {
    expect(validateQuoteOrderPrefill(prefill, request, [issuer], [vendor])).toEqual({
      issuer, vendor, unitPrice: '10.00', shipping: '5.75', other: '0.25', deliveryDate: '2026-11-21',
      reference: 'COT-100', rationale: 'Entrega antes del paro previsto',
    });
    for (const invalid of [
      { ...prefill, requestVersion: 'v1' }, { ...prefill, quantity: '14' }, { ...prefill, currency: 'PAB' },
      { ...prefill, shipping: '-1.00' }, { ...prefill, deliveryDate: '2026-11-31' }, { ...prefill, rationale: '' },
      { ...prefill, vendor: { ...vendor, rfc: 'OTHER' } },
    ]) expect(validateQuoteOrderPrefill(invalid, request, [issuer], [vendor])).toBeUndefined();
  });
});
