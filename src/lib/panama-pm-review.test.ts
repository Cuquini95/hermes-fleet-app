import { describe, expect, it } from 'vitest';
import { pmReviewCsv, type PmReview } from './panama-pm-review';

describe('PM review export', () => {
  it('retains missing serial, pending approval, issue ownership and source dates', () => {
    const data: PmReview = { project: 'tmf-panama', sources: { maintenancePlan: { available: true, capturedAt: '2026-11-17T20:00:00Z' } },
      catalog: { available: false, capturedAt: null }, rows: [{ unit: 'EX401', model: '=MODELO', planModel: '=MODELO', equipmentModel: null, serial: null,
        approved: false, active: true, intervals: [250, 500], unsupportedIntervals: [500], checklist: null, revision: null,
        issues: [{ code: 'approval', label: 'Pendiente', action: 'Taller: revisar "tareas"\ny aprobar.' }] }] };
    const csv = pmReviewCsv(data);
    expect(csv).toContain('"\'=MODELO"');
    expect(csv).toContain('"Por verificar","Pendiente","250 / 500"');
    expect(csv).toContain('"Taller: revisar ""tareas""\ny aprobar."');
    expect(csv).toContain('2026-11-17T20:00:00Z');
    expect(csv).toContain('Sin fecha de corte');
    expect(data.rows[0]?.approved).toBe(false);
  });
});
