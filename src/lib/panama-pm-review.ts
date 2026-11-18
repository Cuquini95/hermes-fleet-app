export interface PmReviewIssue { code: string; label: string; action: string }
export interface PmReviewRow {
  unit: string; model: string; planModel: string | null; equipmentModel: string | null; serial: string | null;
  approved: boolean; active: boolean | null; intervals: number[]; unsupportedIntervals: number[];
  checklist: string | null; revision: string | null; issues: PmReviewIssue[];
}
export interface PmReview {
  project: 'tmf-panama';
  sources: Record<string, { available: boolean; capturedAt: string | null }>;
  catalog: { available: boolean; capturedAt: string | null };
  rows: PmReviewRow[];
}

// Quote every cell and neutralize spreadsheet formulas in imported master text.
function cell(value: unknown): string {
  let text = String(value ?? '');
  let first = text.trimStart();
  while (first && first.charCodeAt(0) < 32) first = first.slice(1).trimStart();
  if (/^[=+@-]/.test(first)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

export function pmReviewCsv(review: PmReview): string {
  const rows: unknown[][] = [['Equipo', 'Modelo del plan', 'Modelo del equipo', 'Serie', 'Aprobación en maestro',
    'Intervalos h', 'Revisión checklist', 'Pendiente', 'Siguiente paso', 'Corte plan', 'Corte equipo', 'Corte catálogo']];
  for (const row of review.rows) {
    const issues = row.issues.length ? row.issues : [{ label: 'Sin pendientes detectados', action: 'Conservar la revisión técnica y aprobación vigentes.' }];
    for (const issue of issues) rows.push([row.unit, row.planModel, row.equipmentModel, row.serial ?? 'Por verificar',
      row.approved ? 'Registrada' : 'Pendiente', row.intervals.join(' / '), row.revision ?? 'Sin dato', issue.label,
      issue.action, review.sources.maintenancePlan?.capturedAt ?? 'Sin fecha de corte',
      review.sources.equipmentDetails?.capturedAt ?? 'Sin fecha de corte', review.catalog.capturedAt ?? 'Sin fecha de corte']);
  }
  return '\ufeff' + rows.map(row => row.map(cell).join(',')).join('\r\n');
}
