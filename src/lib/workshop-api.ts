import { useAuthStore } from '../stores/auth-store';

export const PANAMA_PM_CHECKLIST_SOURCE = 'https://docs.google.com/spreadsheets/d/1AeTvqR052hJHhEQ7jbkJ3_VIxwPa5ftwGKeVxVlasYw/edit';

export interface WorkshopMechanic {
  userId: string;
  userName: string;
  allUnits?: boolean;
  assignedUnits?: string[];
}

export class WorkshopApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function workshopActorId(): string | undefined {
  const session = useAuthStore.getState() as ReturnType<typeof useAuthStore.getState> & { userId?: string };
  return session.isAuthenticated ? session.userId : undefined;
}

export function mechanicCoversUnit(mechanic: WorkshopMechanic, unit: string): boolean {
  return mechanic.allUnits === true || !!mechanic.assignedUnits?.some((value) => value.toUpperCase() === unit.toUpperCase());
}

export async function requestWorkshop<T>(endpoint: string, input?: Record<string, unknown>): Promise<T> {
  const expectedUserId = workshopActorId();
  const response = await fetch(`/hermes-api/api/workshop/${endpoint}`, {
    method: input ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
    headers: input ? { 'Content-Type': 'application/json' } : undefined,
    body: input ? JSON.stringify({ ...input, ...(expectedUserId && { expectedUserId }) }) : undefined,
    signal: AbortSignal.timeout(25000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) {
    throw new WorkshopApiError(result?.error || 'No se pudo confirmar la operación de Taller', response.status);
  }
  return result as T;
}
