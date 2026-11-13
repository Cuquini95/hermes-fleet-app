import { describe, expect, it } from 'vitest';
import { buildPanamaMaintenance, isPmAlert, maintenanceFullyVerified, panamaPmLevel } from './panama-maintenance';

const official = {
  unit: 'DZ203', model: 'Komatsu D155AX-6', status: '🔴 VENCIDO · PROVISIONAL', next: 'PM 500',
  due: '2,225', hours: '2,280', remaining: '-55', last: 'PM 250 a 1,975.0 h · por confirmar', reading: 'AL DÍA', plan: 'Propuesto',
};
const other = { ...official, unit: 'EX401', status: '⚪ SIN PLAN', next: '—', due: '', remaining: '', last: '' };
const master = {
  maintenance: [official, other],
  maintenancePlan: [{ unit: 'DZ203', model: official.model, active: 'Sí', cycle: '250',
    level2: '500', level3: '1,000', level4: '2,000', approved: 'Sí',
    checklist: 'https://docs.google.com/spreadsheets/d/1AeTvqR052hJHhEQ7jbkJ3_VIxwPa5ftwGKeVxVlasYw/edit#gid=101' }],
  maintenanceAnchor: [{ unit: 'DZ203', anchor: '2250' }],
  dozers: [{ unit: 'DZ203', critical: '2', upcoming: '1', noData: '1' }],
  excavators: [],
};

function history(overrides: Record<number, string> = {}) {
  const cells = ['07/11/2026', 'OT-QA-1000', 'DZ203', official.model, 'PM-500', 'PM-500', '2250', '4', 'Mecánico', 'Jefe',
    'Completada', '', '', '2026-11-07', 'reviewer-id', 'Jefe', '2026-11-07T20:00:00Z', 'QA checklist'];
  for (const [column, value] of Object.entries(overrides)) cells[Number(column)] = value;
  return cells;
}

describe('Panama maintenance sources', () => {
  it('keeps the official overdue PM and exposes components and unknown units', () => {
    const result = buildPanamaMaintenance(master, []);
    expect(result.entries?.[0]).toMatchObject({ dueAt: 2225, currentHours: 2280, remaining: -55, state: 'overdue' });
    expect(result.entries?.filter(isPmAlert).map(row => row.unit)).toEqual(['DZ203']);
    expect(result.entries?.[1]?.state).toBe('unknown');
    expect(result.components).toEqual([{ unit: 'DZ203', critical: 2, upcoming: 1, noData: 1 }]);
    expect(maintenanceFullyVerified(result)).toBe(false);
  });

  it('exposes source outages, stale readings and unknown plans without inventing catalog values', () => {
    const result = buildPanamaMaintenance({ maintenance: null, dozers: [], excavators: null }, null);
    expect(result).toMatchObject({ entries: null, historyAvailable: false, components: [], componentSourcesAvailable: false });
    expect(maintenanceFullyVerified(result)).toBe(false);
    const stale = buildPanamaMaintenance({ ...master, maintenance: [{ ...official, status: 'ACTUALIZAR LECTURA', reading: 'ATRASADA', remaining: '100' }] }, []);
    expect(stale.entries?.[0]?.state).toBe('unknown');
  });

  it('shows current and previous master labels for an up-to-date PM', () => {
    const maintenance = [
      { ...official, status: 'Al día', reading: 'Al día', remaining: '100', plan: 'Por aprobar' },
      { ...official, unit: 'DZ204', status: 'BIEN', reading: 'AL DÍA', remaining: '100' },
      { ...official, unit: 'DZ205', status: 'Al día', reading: 'Lectura atrasada (105 días)', remaining: '100' },
    ];
    const result = buildPanamaMaintenance({ maintenance }, []);
    expect(result.entries?.map(({ state }) => state)).toEqual(['ok', 'ok', 'unknown']);
    expect(result.entries?.[0]?.plan).toBe('Por aprobar');
  });

  it('keeps known component exceptions visible when the other master is unavailable', () => {
    const result = buildPanamaMaintenance({ ...master, excavators: null }, []);
    expect(result.components).toEqual([{ unit: 'DZ203', critical: 2, upcoming: 1, noData: 1 }]);
    expect(maintenanceFullyVerified(result)).toBe(false);
  });

  it('reconciles an accepted service at its own meter and labels the calculated due as provisional', () => {
    const result = buildPanamaMaintenance(master, [history({ 10: 'Programada', 6: '2800' }), history()]);
    expect(result.entries?.[0]).toMatchObject({
      dueAt: 2225, state: 'overdue', reconciliationPending: true, latestAccepted: { folio: 'OT-QA-1000', meter: 2250, reference: 'QA checklist' },
      projectedNext: { dueAt: 2500, level: 'PM-250' },
    });
  });

  it('never promotes a scheduled or unaudited closure to a maintenance anchor', () => {
    const result = buildPanamaMaintenance(master, [history({ 10: 'Programada' }), history({ 14: '' }), history({ 17: '' })]);
    expect(result.entries?.[0]).toMatchObject({ latestAccepted: null, projectedNext: null, reconciliationPending: false });
  });

  it('normalizes only documented level numbers without mapping ordinal legacy levels', () => {
    expect(panamaPmLevel('PM 2,000')).toBe('PM-2000');
    expect(panamaPmLevel('PM-1')).toBe('');
    expect(panamaPmLevel('—')).toBe('');
  });
});
