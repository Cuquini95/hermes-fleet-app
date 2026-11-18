export type MaintenancePhase = 'pending' | 'repair' | 'parts' | 'review' | 'return' | 'mixed' | 'unknown';
export interface MaintenancePhaseTime { key: MaintenancePhase; label: string; seconds: number }
export interface MaintenanceMetrics {
  version: 1;
  measuredSeconds: number | null;
  breakdown: MaintenancePhaseTime[];
  coverage: { classifiedSeconds: number; denominatorSeconds: number; percent: number | null; pendingStops: number; historyIssues: number; partial: boolean };
  mttr: {
    seconds: number | null; numeratorSeconds: number; denominator: number; pendingStops: number; basis: string;
    cohort: { unit: string; startedAt: string; endedAt: string; seconds: number; folios: string[] }[];
    exclusions: { open: number; preventive: number; ambiguous: number; outsidePeriod: number; withoutType: number };
  };
  details: { unit: string; id: string; seconds: number; phases: Record<MaintenancePhase, number> }[];
  units: { unit: string; seconds: number; phases: Record<MaintenancePhase, number> }[];
  issues: { unit: string; folio: string; reason: string }[];
}
export interface StopInterval {
  id: string; unit: string; startedAt: string; endedAt: string | null; seconds: number;
  orders: { id: string; folio: string; cause: string; source: 'Taller' | 'Reporte' }[];
  segments: { date: string; shift: string; from: string; seconds: number }[];
}
export interface DowntimeReport {
  from: string; through: string; checkedAt: string; seconds: number; intervals: StopInterval[];
  pending: { unit: string; folio: string; date: string | null; reason: string }[];
  shiftStarts: { day: string; night: string } | null;
  masterAvailable: boolean;
  metrics: MaintenanceMetrics;
}

function cell(value: unknown) {
  let text = String(value ?? '');
  const first = text.replace(/^[\s\u0000-\u001f]+/, '');
  if (/^[=+@-]/.test(first)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
const secondsCell = (seconds: number | null) => seconds === null ? 'Sin dato verificable' : seconds;

// Raw seconds preserve arithmetic; every section carries the same window and observation time.
export function maintenanceMetricsCsv(data: DowntimeReport, unitFilter = ''): string {
  const rows: unknown[][] = [['Sección', 'Unidad', 'Folios', 'Concepto', 'Segundos', 'Cantidad / porcentaje', 'Inicio UTC', 'Fin UTC', 'Detalle',
    'Desde Panamá', 'Hasta Panamá', 'Consulta UTC', 'Filtro unidad']];
  const add = (...values: unknown[]) => rows.push([...values, ...Array(Math.max(0, 9 - values.length)).fill(''), data.from, data.through, data.checkedAt, unitFilter || 'Todas las autorizadas']);
  add('Resumen', '', '', 'Tiempo caído medido en el período', secondsCell(data.metrics.measuredSeconds));
  add('Resumen', '', '', 'Cobertura de estados', data.metrics.coverage.classifiedSeconds, data.metrics.coverage.percent ?? 'Sin dato verificable', '', '',
    `Denominador: ${data.metrics.coverage.denominatorSeconds} segundos medidos. No incluye paradas sin intervalo confirmado.`);
  add('Resumen', '', '', 'Paradas sin intervalo confirmado', '', data.pending.length);
  for (const phase of data.metrics.breakdown) add('Estados', '', '', phase.label, data.metrics.measuredSeconds === null ? 'Sin dato verificable' : phase.seconds);
  add('MTTR', '', '', 'Promedio de duración completa de paradas correctivas', secondsCell(data.metrics.mttr.seconds), data.metrics.mttr.denominator, '', '', data.metrics.mttr.basis);
  add('MTTR', '', '', 'Numerador: duración completa acumulada', data.metrics.mttr.numeratorSeconds);
  for (const entry of data.metrics.mttr.cohort) add('Cohorte MTTR', entry.unit, entry.folios.join(' / '), 'Parada con retorno aceptado', entry.seconds, 1, entry.startedAt, entry.endedAt);
  for (const [reason, count] of Object.entries(data.metrics.mttr.exclusions)) add('Exclusiones MTTR', '', '', MTTR_EXCLUSION_LABELS[reason as keyof typeof MTTR_EXCLUSION_LABELS], '', count);
  for (const interval of data.intervals) {
    add('Parada medida', interval.unit, interval.orders.map(row => row.folio).join(' / '), 'Duración recortada al período', interval.seconds, '', interval.startedAt, interval.endedAt ?? 'Abierta', interval.orders.map(row => row.cause).join(' / '));
    for (const segment of interval.segments) add('Turno', interval.unit, interval.orders.map(row => row.folio).join(' / '), `${segment.date} ${segment.shift}`, segment.seconds, '', segment.from);
    const detail = data.metrics.details.find(row => row.id === interval.id && row.unit === interval.unit);
    if (detail) for (const phase of data.metrics.breakdown) add('Estado de parada', interval.unit, interval.orders.map(row => row.folio).join(' / '), phase.label, detail.phases[phase.key]);
  }
  for (const row of data.pending) add('Pendiente de confirmar', row.unit, row.folio, row.reason, '', '', '', '', row.date);
  for (const issue of data.metrics.issues) add('Historial por revisar', issue.unit, issue.folio, issue.reason);
  add('Método', '', '', 'Horas calendario en el estado registrado; no son horas de trabajo del mecánico.', '', '', '', '',
    `OT superpuestas por equipo se cuentan una vez. Estados contradictorios: simultáneos. Maestro de Taller: ${data.masterAvailable ? 'consultado' : 'no disponible'}.`);
  return '\ufeff' + rows.map(row => row.map(cell).join(',')).join('\r\n');
}

export const MTTR_EXCLUSION_LABELS = {
  open: 'Paradas abiertas', preventive: 'Paradas con PM', ambiguous: 'Vínculo de OT ambiguo',
  outsidePeriod: 'Retorno fuera del período', withoutType: 'Tipo de mantenimiento sin confirmar',
};
