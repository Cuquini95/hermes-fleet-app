interface WorkshopExceptionIdentity {
  id: string;
  unit: string;
}

interface OpenWorkshopException extends WorkshopExceptionIdentity {
  state: 'active';
  kind: 'critical' | 'parts' | 'return';
  folio: string;
  owner: string | null;
  dueHours: number | null;
  status: string;
  description: string;
}

export type WorkshopExceptionRecord = OpenWorkshopException | (WorkshopExceptionIdentity & { state: 'resolved' | 'unknown' });
export type WorkshopExceptionAlert = OpenWorkshopException & { pendingConfirmation: boolean };

export interface WorkshopExceptionSnapshot {
  observedAt: string;
  units: string[] | null;
  records: WorkshopExceptionRecord[];
}

export interface WorkshopExceptionView {
  alerts: WorkshopExceptionAlert[];
  observedAt: string;
  unconfirmed: boolean;
}

const kinds = ['critical', 'parts', 'return'];
const recordKey = ({ id, unit }: WorkshopExceptionIdentity) => JSON.stringify([unit, id]);

export function isWorkshopExceptionSnapshot(value: unknown): value is WorkshopExceptionSnapshot {
  if (!value || typeof value !== 'object') return false;
  const { observedAt, units, records } = value as Partial<WorkshopExceptionSnapshot>;
  if (typeof observedAt !== 'string' || !Number.isFinite(Date.parse(observedAt))
    || (units !== null && (!Array.isArray(units) || !units.every(unit => typeof unit === 'string')))
    || !Array.isArray(records)) return false;
  return records.every(record => record && typeof record.id === 'string' && typeof record.unit === 'string'
    && (record.state === 'resolved' || record.state === 'unknown'
      || (record.state === 'active' && kinds.includes(record.kind) && typeof record.folio === 'string'
        && typeof record.status === 'string' && typeof record.description === 'string'
        && (record.owner === null || typeof record.owner === 'string')
        && (record.dueHours === null || (Number.isFinite(record.dueHours) && record.dueHours > 0)))));
}

export function reconcileWorkshopExceptions(previous: WorkshopExceptionView | undefined, snapshot: WorkshopExceptionSnapshot): WorkshopExceptionView {
  if (previous && Date.parse(snapshot.observedAt) <= Date.parse(previous.observedAt)) return previous;
  const allowed = (unit: string) => snapshot.units === null || snapshot.units.includes(unit);
  const active = new Map((previous?.alerts ?? []).filter(row => allowed(row.unit))
    .map(row => [recordKey(row), { ...row, pendingConfirmation: true }]));
  for (const row of snapshot.records) {
    if (!allowed(row.unit)) continue;
    const id = recordKey(row);
    if (row.state === 'active') active.set(id, { ...row, pendingConfirmation: false });
    if (row.state === 'resolved') active.delete(id);
  }
  const alerts = [...active.values()].sort((a, b) => a.unit.localeCompare(b.unit) || a.folio.localeCompare(b.folio));
  return { observedAt: snapshot.observedAt, alerts,
    unconfirmed: snapshot.records.some(row => allowed(row.unit) && row.state === 'unknown') };
}
