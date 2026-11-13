import { describe, expect, it } from 'vitest';
import { buildPanamaMaintenance } from '../../lib/panama-maintenance';
import { briefingPmAlerts } from './briefing-pm';

describe('alertas PM en Briefing', () => {
  it('retiene alerta del maestro y muestra que quedan datos provisionales', () => {
    const data = buildPanamaMaintenance({
      maintenance: [{ unit: 'EX401', status: 'VENCIDO · PROVISIONAL', next: 'PM 500', due: '2000', hours: '2210', remaining: '-210', reading: 'ATRASADA' }],
    }, []);
    const result = briefingPmAlerts(data);
    expect(result).toMatchObject({
      verified: false,
      alerts: [{ unit: 'EX401', state: 'overdue', remaining: -210 }],
    });
  });
  it('mantiene la fuente ausente como no verificable', () => {
    expect(briefingPmAlerts(buildPanamaMaintenance({}, null))).toEqual({ verified: false, alerts: [] });
  });
});
