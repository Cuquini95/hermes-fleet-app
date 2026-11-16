export const WARRANTY_TAB = 'HERMES_PA_GARANTIAS';
export const WARRANTY_EVENT = 'garantia_ot';
export const warrantyReaders = new Set(['jefe_taller', 'coordinador', 'supervisor', 'gerencia']);
export const warrantyWriters = new Set(['jefe_taller', 'coordinador', 'gerencia']);

export function warrantyEvents(rows, otId) {
  return rows.filter(row => row[1] === otId && row[2] === WARRANTY_EVENT).map(row => {
    const event = JSON.parse(row[4]);
    return { ...event, recordedAt: row[0], recordedBy: row[5], actorId: row[7] };
  });
}

export function coverageApplicability(coverage, orderDate) {
  if (!orderDate) return 'unknown-date';
  return orderDate >= coverage.starts && orderDate <= coverage.ends ? 'within-period' : 'outside-period';
}

export function warrantyCases(events, orderDate, canSeeRecovery) {
  const cases = new Map();
  for (const { action, caseId, requestId: _requestId, actorId: _actorId, ...record } of events) {
    if (action === 'coverage') {
      cases.set(caseId, { id: caseId, coverage: record, applicability: coverageApplicability(record, orderDate), recoveries: [] });
      continue;
    }
    const entry = cases.get(caseId);
    if (!entry) throw new Error('El reclamo no tiene una cobertura registrada');
    if (action === 'recovery') entry.recoveries.push(record);
    else entry[action] = record;
  }
  return Array.from(cases.values(), ({ recoveries, ...entry }) => {
    if (!canSeeRecovery) return { ...entry, recoveryCount: recoveries.length };
    const totals = new Map();
    for (const { currency, cents } of recoveries) totals.set(currency, (totals.get(currency) ?? 0) + cents);
    return { ...entry, recoveries, totals: Array.from(totals, ([currency, cents]) => ({ currency, cents })) };
  }).reverse();
}

export function warrantyEvidenceLinked(rows, { record_id: order, operation_id: operation, actor_id: actor }, url, role) {
  return warrantyEvents(rows, order).some(event => event.requestId === operation && event.actorId === actor
    && (event.action !== 'recovery' || role === 'gerencia') && event.attachments?.includes(url));
}
