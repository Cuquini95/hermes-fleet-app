import { useCallback, useEffect, useRef, useState } from 'react';
import { isWorkshopExceptionSnapshot, reconcileWorkshopExceptions, type WorkshopExceptionView } from '../lib/panama-workshop-exceptions';
import { requestWorkshop, WorkshopApiError } from '../lib/workshop-api';
import { useAuthStore } from '../stores/auth-store';

interface ExceptionLoad {
  identity: string;
  view?: WorkshopExceptionView;
  loading: boolean;
  unavailable: boolean;
}

export function usePanamaWorkshopExceptions(enabled: boolean) {
  const actor = useAuthStore(state => state.userId);
  const role = useAuthStore(state => state.role);
  const units = useAuthStore(state => state.assignedUnits);
  const allUnits = useAuthStore(state => state.allUnits);
  const demo = useAuthStore(state => state.previewDemo);
  const identity = enabled && actor ? JSON.stringify([actor, role, demo, allUnits, [...units].sort()]) : '';
  const sequence = useRef(0);
  const invalidate = useCallback(() => { sequence.current++; }, []);
  const [load, setLoad] = useState<ExceptionLoad>();
  const current = load?.identity === identity ? load : undefined;

  const refresh = useCallback(async () => {
    if (!identity) return;
    const request = ++sequence.current;
    setLoad(previous => ({ identity, loading: true, unavailable: false,
      view: previous?.identity === identity ? previous.view : undefined }));
    try {
      const snapshot = await requestWorkshop<unknown>('exceptions');
      if (sequence.current !== request) return;
      if (!isWorkshopExceptionSnapshot(snapshot)) throw new Error('Respuesta incompleta de Taller');
      setLoad(previous => {
        const prior = previous?.identity === identity ? previous.view : undefined;
        const older = !!prior && Date.parse(snapshot.observedAt) < Date.parse(prior.observedAt);
        return { identity, loading: false, unavailable: older, view: reconcileWorkshopExceptions(prior, snapshot) };
      });
    } catch (error) {
      if (sequence.current !== request) return;
      const denied = error instanceof WorkshopApiError && [401, 403, 404].includes(error.status);
      setLoad(previous => ({
        identity, loading: false, unavailable: true,
        view: !denied && previous?.identity === identity ? previous.view : undefined,
      }));
    }
  }, [identity]);

  useEffect(() => {
    if (!identity) return;
    let active = true;
    void Promise.resolve().then(() => { if (active) void refresh(); });
    const check = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', check);
    window.addEventListener('online', check);
    return () => {
      active = false;
      invalidate();
      window.removeEventListener('focus', check);
      window.removeEventListener('online', check);
    };
  }, [identity, refresh, invalidate]);

  return { view: current?.view, loading: current?.loading ?? Boolean(identity), unavailable: current?.unavailable ?? false, refresh };
}
