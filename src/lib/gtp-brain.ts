import { useAuthStore } from '../stores/auth-store';

export type HermesBrainEvidence = {
  label?: string;
  source?: string;
  field?: string;
  value?: string;
  freshness?: string;
};

export type HermesBrainInsight = {
  summary: string;
  confidence: 'low' | 'medium' | 'high';
  evidence: HermesBrainEvidence[];
  risk_flags: string[];
  recommended_action: string;
  write_preview?: Record<string, unknown> | null;
  requires_human_approval: boolean;
};

export type HermesBrainResponse = {
  app: 'hermes';
  agent_run_id: number;
  insight_id?: number | null;
  provider: string;
  model: string;
  route_reason: string;
  intent: string;
  response: string;
  tools_called: Array<Record<string, unknown>>;
  policy: string;
  success: boolean;
  insight: HermesBrainInsight;
};

export type HermesBrainAnalyzeRequest = {
  app: 'hermes';
  user_message: string;
  page: string;
  entity_type?: string;
  entity_id?: string;
  task_type?: string;
  user_context?: Record<string, unknown>;
  page_context?: Record<string, unknown>;
  requested_tools?: Array<string>;
  attachments?: Array<Record<string, unknown>>;
};

export type HermesBrainEventRequest = {
  app: 'hermes';
  event_type: string;
  page?: string;
  action?: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
};

const PROXY_BASE = ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_GTP_BRAIN_PROXY_BASE || '').replace(/\/$/, '');

function resolveProxyPath(path: string): string {
  if (PROXY_BASE) return `${PROXY_BASE}${path}`;
  return path;
}

async function request<T>(path: string, body: unknown): Promise<T> {
  const token = useAuthStore.getState().token;
  const response = await fetch(resolveProxyPath(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof payload?.detail === 'string' ? payload.detail : `Hermes AI request failed (${response.status}).`;
    throw new Error(detail);
  }
  return payload as T;
}

export async function analyzeHermesPage(payload: HermesBrainAnalyzeRequest): Promise<HermesBrainResponse> {
  return request<HermesBrainResponse>('/api/brain/analyze-page', payload);
}

export async function trackHermesAiEvent(payload: HermesBrainEventRequest): Promise<unknown> {
  return request('/api/brain/events', payload);
}
