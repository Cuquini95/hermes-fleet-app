import { useAuthStore } from '../stores/auth-store';

export type CmmsSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface CmmsDamageReport {
  assetId: string;
  title: string;
  severity: CmmsSeverity;
  description?: string;
  photoUrl?: string;
  relatedWorkOrderId?: string;
  downtime?: string;
  reason?: string;
  externalEventId?: string;
}

export interface CmmsDamageResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
  cmms?: unknown;
}

export function cmmsSeverityFromHermesPriority(priority: string): CmmsSeverity {
  const normalized = priority.trim().toLocaleUpperCase('es-MX');
  if (normalized === 'CRITICA' || normalized === 'CRÍTICA') return 'critical';
  if (normalized === 'ALTA') return 'high';
  if (normalized === 'BAJA') return 'low';
  return 'medium';
}

export async function reportCmmsDamage(report: CmmsDamageReport): Promise<CmmsDamageResult> {
  const { authMode, sessionToken } = useAuthStore.getState();
  if (authMode !== 'server' || !sessionToken) {
    throw new Error('Sesión Hermes no disponible; vuelve a iniciar sesión.');
  }

  const response = await fetch('/api/cmms/damage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({
      asset_id: report.assetId,
      title: report.title,
      severity: report.severity,
      description: report.description,
      photo_url: report.photoUrl,
      related_work_order_id: report.relatedWorkOrderId,
      downtime: report.downtime,
      reason: report.reason,
      external_event_id: report.externalEventId,
    }),
  });

  const payload = await safeJson(response);
  if (!response.ok) {
    throw new Error(payloadMessage(payload) || `CMMS handoff failed (${response.status})`);
  }
  if (payload?.success === false && !payload.skipped) {
    throw new Error(payloadMessage(payload) || 'CMMS handoff failed');
  }
  return {
    success: Boolean(payload?.success),
    skipped: Boolean(payload?.skipped),
    reason: typeof payload?.reason === 'string' ? payload.reason : undefined,
    error: typeof payload?.error === 'string' ? payload.error : undefined,
    cmms: payload?.cmms,
  };
}

async function safeJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function payloadMessage(payload: Record<string, unknown> | null): string {
  const value = payload?.error ?? payload?.detail ?? payload?.reason;
  return typeof value === 'string' ? value : '';
}
