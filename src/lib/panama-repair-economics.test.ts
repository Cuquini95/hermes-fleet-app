import { describe, expect, it } from 'vitest';
import { compareInterventions, documentedRepairCost } from './panama-repair-economics';

const sample = {
  repair: { currency: 'USD', cash: '1250', cashSource: 'OT-QA-0910 conciliada', life: '500', lifeSource: 'Informe QA 01',
    downtime: '12', downtimeSource: 'Programa QA 01', productiveHoursLost: '10' },
  rebuild: { currency: 'USD', cash: '2100.05', cashSource: 'Cotización QA 02', life: '1200', lifeSource: 'Informe QA 02',
    downtime: '20', downtimeSource: 'Programa QA 02', productiveHoursLost: '15.25' },
  replace: { currency: 'USD', cash: '5000', cashSource: 'Cotización QA 03', life: '2000', lifeSource: 'Informe QA 03',
    downtime: '8', downtimeSource: 'Programa QA 03', productiveHoursLost: '0' },
};

describe('economía de intervenciones TMF', () => {
  it('cuadra desembolso, costo por hora, vida y parada sin convertir parada en horas facturables', () => {
    const result = compareInterventions(sample, { rate: '22,50', currency: 'USD', source: 'Corte QA de contribución marginal' });
    expect(result).toMatchObject({
      currency: 'USD', lowest: ['rebuild'],
      rows: [
        { kind: 'repair', cashCents: 125000, costPerHourCents: 250, life: 500, downtime: 12, impactCents: 22500 },
        { kind: 'rebuild', cashCents: 210005, costPerHourCents: 175, life: 1200, downtime: 20, impactCents: 34313 },
        { kind: 'replace', cashCents: 500000, costPerHourCents: 250, life: 2000, downtime: 8, impactCents: 0 },
      ],
    });
  });

  it('detecta un empate exacto y separa la parada aun sin estimar su efecto económico', () => {
    const result = compareInterventions({ ...sample, rebuild: { ...sample.rebuild, cash: '3000' } });
    expect(result).toMatchObject({ lowest: ['repair', 'rebuild', 'replace'], rows: [
      { impactCents: null }, { impactCents: null }, { impactCents: null },
    ] });
  });

  it('compara importes exactos antes de redondear el costo mostrado', () => {
    const result = compareInterventions({ ...sample, rebuild: { ...sample.rebuild, cash: '3001' } });
    expect(result).toMatchObject({ lowest: ['repair', 'replace'], rows: [
      { costPerHourCents: 250 }, { costPerHourCents: 250 }, { costPerHourCents: 250 },
    ] });
  });

  it('rechaza monedas cruzadas, campos vacíos, horas cero y fuentes ausentes', () => {
    expect(compareInterventions({ ...sample, rebuild: { ...sample.rebuild, currency: 'PAB' } }))
      .toMatchObject({ error: 'Usa una sola moneda para las tres alternativas.' });
    expect(compareInterventions({ ...sample, repair: { ...sample.repair, cash: '' } })).toHaveProperty('error');
    expect(compareInterventions({ ...sample, repair: { ...sample.repair, life: '0' } })).toHaveProperty('error');
    expect(compareInterventions({ ...sample, repair: { ...sample.repair, downtime: '' } })).toHaveProperty('error');
    expect(compareInterventions({ ...sample, repair: { ...sample.repair, lifeSource: ' ' } })).toHaveProperty('error');
    expect(compareInterventions({ ...sample, repair: { ...sample.repair, cash: '1,250.00' } })).toHaveProperty('error');
  });

  it('exige fuente y datos de horas productivas cuando se valora el efecto de parar', () => {
    expect(compareInterventions(sample, { rate: '15', currency: 'USD', source: '' })).toHaveProperty('error');
    expect(compareInterventions(sample, { rate: '15', currency: 'PAB', source: 'Corte QA' })).toHaveProperty('error');
    expect(compareInterventions({ ...sample, repair: { ...sample.repair, productiveHoursLost: '' } },
      { rate: '15', currency: 'USD', source: 'Corte QA' })).toHaveProperty('error');
    expect(compareInterventions({ ...sample, repair: { ...sample.repair, productiveHoursLost: '12.01' } },
      { rate: '15', currency: 'USD', source: 'Corte QA' })).toHaveProperty('error');
  });
});

describe('reutilización del respaldo conciliado de una OT', () => {
  const context = { ot: 'OT-QA-915', unit: 'DZ203', folio: 'OT-0915' };
  const response = {
    ...context, project: 'tmf-panama', pending: [], totals: [{ currency: 'USD', amount: '48.18' }],
    lines: [{ currency: 'USD', amount: '35.68', reference: 'Trabajo 2.5 h', valuationReference: 'LISTA QA' },
      { currency: 'USD', amount: '25.00', reference: 'Salida 1' }, { currency: 'USD', amount: '-12.50', reference: 'Devolución 1' }],
  };

  it('reusa el total contra sus partidas y conserva una referencia a cada respaldo', () => {
    expect(documentedRepairCost(context, response)).toEqual({
      cash: '48.18', currency: 'USD', cashSource: 'OT-0915 · Trabajo 2.5 h (LISTA QA) · Salida 1 · Devolución 1',
    });
  });

  it('deja ingreso manual ante diferencias de unidad, conciliación o moneda', () => {
    expect(documentedRepairCost({ ...context, unit: 'EX401' }, response)).toBeNull();
    expect(documentedRepairCost(context, { ...response, pending: [{ reason: 'Valuar mano de obra' }] })).toBeNull();
    expect(documentedRepairCost(context, { ...response, totals: [{ currency: 'USD', amount: '48.17' }] })).toBeNull();
    expect(documentedRepairCost(context, { ...response, totals: [...response.totals, { currency: 'PAB', amount: '53.50' }] })).toBeNull();
    expect(documentedRepairCost(context, { ...response, totals: [{ currency: 'USD', amount: '-48.18' }] })).toBeNull();
  });
});
