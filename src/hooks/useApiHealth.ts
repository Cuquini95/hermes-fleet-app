import { useState, useEffect, useCallback } from 'react';
import { hermesApiUrl } from '../lib/hermes-api-base';

export interface HealthDb {
  pocketbase: 'up' | 'down' | 'unknown';
  sheets: 'up' | 'down' | 'unknown';
}

export interface HealthIntegrations {
  openrouter: 'up' | 'down' | 'unknown';
  supabase: 'up' | 'down' | 'unknown';
  telegram: 'up' | 'down' | 'unknown';
}

export interface ApiHealth {
  status: 'ok' | 'degraded' | 'down' | 'loading';
  uptime_seconds?: number;
  db?: HealthDb;
  integrations?: HealthIntegrations;
  version?: string;
  lastChecked?: Date;
  error?: string;
}

const POLL_INTERVAL_MS = 60_000;

export function useApiHealth(): ApiHealth {
  const [health, setHealth] = useState<ApiHealth>({ status: 'loading' });

  const check = useCallback(async () => {
    try {
      const res = await fetch(hermesApiUrl('/health'), {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        setHealth({ status: 'down', lastChecked: new Date() });
        return;
      }
      const data = await res.json();
      setHealth({ ...data, lastChecked: new Date() });
    } catch {
      setHealth({ status: 'down', lastChecked: new Date() });
    }
  }, []);

  useEffect(() => {
    const initialCheck = window.setTimeout(() => {
      void check();
    }, 0);
    const id = window.setInterval(check, POLL_INTERVAL_MS);
    return () => {
      window.clearTimeout(initialCheck);
      window.clearInterval(id);
    };
  }, [check]);

  return health;
}
