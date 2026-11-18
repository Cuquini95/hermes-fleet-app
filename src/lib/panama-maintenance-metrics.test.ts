import { describe, expect, it } from 'vitest';
import { maintenanceMetricsCsv, type DowntimeReport } from './panama-maintenance-metrics';

const emptyReport = (): DowntimeReport => ({
  from: '2026-11-17', through: '2026-11-17', checkedAt: '2026-11-18T02:00:00Z', seconds: 0, intervals: [], pending: [], shiftStarts: null, masterAvailable: false,
  metrics: { version: 1, measuredSeconds: null, breakdown: [{ key: 'parts', label: 'Esperando repuesto', seconds: 0 }],
    coverage: { classifiedSeconds: 0, denominatorSeconds: 0, percent: null, pendingStops: 0, historyIssues: 0, partial: false },
    mttr: { seconds: null, numeratorSeconds: 0, denominator: 0, pendingStops: 0, cohort: [],
      exclusions: { open: 0, preventive: 0, ambiguous: 0, outsidePeriod: 0, withoutType: 0 }, basis: 'Muestra confirmada; incluye esperas.' },
    details: [], units: [], issues: [] },
});

describe('Detalle descargable de mantenimiento', () => {
  it('conserva el dato ausente y el filtro; no lo convierte en una parada de cero horas', () => {
    const csv = maintenanceMetricsCsv(emptyReport(), 'QA01');
    expect(csv).toContain('"Tiempo caído medido en el período","Sin dato verificable"');
    expect(csv).toContain('"Esperando repuesto","Sin dato verificable"');
    expect(csv).toContain('"2026-11-17","2026-11-17","2026-11-18T02:00:00Z","QA01"');
    expect(csv).toContain('Maestro de Taller: no disponible.');
  });
  it('permite auditar numerador completo, cohorte y pendientes sin fórmulas ejecutables', () => {
    const data = emptyReport();
    data.metrics.mttr = { ...data.metrics.mttr, seconds: 68400, numeratorSeconds: 68400, denominator: 1,
      cohort: [{ unit: 'QA01', folios: ['OT-0121'], startedAt: '2026-11-16T23:00:00Z', endedAt: '2026-11-17T18:00:00Z', seconds: 68400 }] };
    data.pending = [{ unit: '\t=EQUIPO', folio: '@folio', date: null, reason: 'Revisar "inicio"\ny retorno' }];
    const before = JSON.stringify(data);
    const csv = maintenanceMetricsCsv(data);
    expect(csv).toContain('"Numerador: duración completa acumulada","68400"');
    expect(csv).toContain('"Cohorte MTTR","QA01","OT-0121","Parada con retorno aceptado","68400","1","2026-11-16T23:00:00Z","2026-11-17T18:00:00Z"');
    expect(csv).toContain('"\'\t=EQUIPO","\'@folio","Revisar ""inicio""\ny retorno"');
    expect(JSON.stringify(data)).toBe(before);
  });
});
