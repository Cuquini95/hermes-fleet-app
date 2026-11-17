export type DispatchFields = Record<'unit' | 'date' | 'shift' | 'site' | 'operatorId', string>;
export type DispatchOperator = { userId: string; userName: string; allUnits: boolean; assignedUnits: string[] };
type Actor = { id: string; name: string };
export type DispatchAssignment = {
  id: string; unit: string; date: string; shift: string; site: string;
  operator: Actor; assignedBy: Actor; assignedAt: string;
  readiness: { level: 'ok' | 'restricted' | 'blocked'; reason: string };
};

export class ShiftRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function requestPanamaDispatch(
  data?: DispatchFields & { mutationId: string; expectedUserId: string }, signal?: AbortSignal, date?: string,
) {
  const path = '/hermes-api/api/panama/turnos/despacho' + (date && !data ? '?' + new URLSearchParams({ date }) : '');
  const response = await fetch(path, {
    method: data ? 'POST' : 'GET', cache: 'no-store', credentials: 'same-origin',
    headers: data ? { 'Content-Type': 'application/json' } : undefined,
    body: data ? JSON.stringify(data) : undefined,
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new ShiftRequestError(result?.error ?? 'No se pudo confirmar el despacho.', response.status);
  if (data ? !result?.assignment?.id : !Array.isArray(result?.assignments) || !Array.isArray(result?.operators)) {
    throw new Error('El servidor no confirmó el despacho.');
  }
  return result as { assignment: DispatchAssignment; assignments: DispatchAssignment[]; operators: DispatchOperator[]; captureAvailable?: boolean };
}
