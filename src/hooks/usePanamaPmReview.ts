import { useEffect, useState } from 'react';
import type { PmReview } from '../lib/panama-pm-review';
import { useAuthStore } from '../stores/auth-store';

export function usePanamaPmReview(reload: number) {
  const scope = useAuthStore(state => JSON.stringify([state.userId, state.role, state.project, state.allUnits, state.assignedUnits]));
  const [reply, setReply] = useState<{ key: string; data: PmReview | null; error: string }>();
  const key = JSON.stringify([scope, reload]);
  const current = reply?.key === key ? reply : undefined;

  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]);
    void fetch('/hermes-api/api/panama/pm-review', { credentials: 'same-origin', cache: 'no-store', signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result?.error || 'No se pudo consultar la revisión PM.');
        if (result?.project !== 'tmf-panama' || !Array.isArray(result.rows) || !result.sources || !result.catalog) {
          throw new Error('No se pudo verificar la respuesta PM.');
        }
        if (!controller.signal.aborted) setReply({ key, data: result as PmReview, error: '' });
      })
      .catch(cause => {
        if (!controller.signal.aborted) setReply({ key, data: null,
          error: cause instanceof Error && cause.name === 'Error' ? cause.message : 'Revisión PM no disponible.' });
      });
    return () => controller.abort();
  }, [key]);

  return { data: current?.data, error: current?.error, loading: !current };
}
