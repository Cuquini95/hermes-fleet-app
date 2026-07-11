const LOCAL_HERMES_API_BASE = '/hermes-api';

interface HermesApiEnv {
  PROD?: boolean;
  VITE_HERMES_API_URL?: string;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function resolveHermesApiBase(env: HermesApiEnv = import.meta.env): string {
  const configured = env.VITE_HERMES_API_URL?.trim();
  if (configured) {
    return trimTrailingSlash(configured);
  }

  return LOCAL_HERMES_API_BASE;
}

export const HERMES_API_BASE = resolveHermesApiBase();

export function hermesApiUrl(path = ''): string {
  const normalizedPath = path ? `/${path.replace(/^\/+/, '')}` : '';
  return `${HERMES_API_BASE}${normalizedPath}`;
}
