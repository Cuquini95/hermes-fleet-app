import { isPmAlert, type PanamaMaintenance } from '../../lib/panama-maintenance';

export function briefingPmAlerts(data: PanamaMaintenance) {
  const verified = !!data.entries?.length && data.historyAvailable && data.entries.every((row) =>
    row.state !== 'unknown' && !row.reconciliationPending &&
    !/provisional|atrasad/i.test(`${row.sourceStatus} ${row.reading}`));
  return { verified, alerts: (data.entries ?? []).filter(isPmAlert) };
}
