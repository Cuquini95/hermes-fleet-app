import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { openAveriaUnitSet } from '../lib/averias';
import { mexicoDateInput } from '../lib/date-utils';
import { applyDispatchReadiness, buildDispatchReadinessMap, normalizeUnitId, type PendingOperationalReturn, type UnitDispatchReadiness } from '../lib/dispatch-readiness';
import { requestWorkshop } from '../lib/workshop-api';
import type { Equipment } from '../types/equipment';

type DispatchSource = 'failures' | 'stickers' | 'inspections' | 'returns';
interface ReadinessSources {
  failures: string[][];
  stickers: string[][];
  inspections: string[][];
  returns: PendingOperationalReturn[];
  unavailable: DispatchSource[];
}

export interface FleetDispatch {
  effectiveEquipment: Equipment[];
  readiness: Map<string, UnitDispatchReadiness>;
  pendingReturns: PendingOperationalReturn[];
  verified: boolean;
  loading: boolean;
  message: string;
  refresh: () => Promise<void>;
}

const LABELS: Record<DispatchSource, string> = {
  failures: 'Averías',
  stickers: 'Sticker',
  inspections: 'DVIR',
  returns: 'Retorno de Taller',
};

export function useFleetDispatch(equipment: Equipment[], enabled = true): FleetDispatch {
  const [sources, setSources] = useState<ReadinessSources>();
  const [loading, setLoading] = useState(enabled);
  const sequence = useRef(0);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const current = ++sequence.current;
    setLoading(true);
    try {
      const result = await requestWorkshop<ReadinessSources>('readiness');
      if (sequence.current === current) {
        setSources((previous) => {
          if (!previous) return result;
          // Keep known restrictions from a source until it responds again.
          const merged = { ...result };
          for (const name of result.unavailable) {
            if (name === 'returns') merged.returns = previous.returns;
            else merged[name] = previous[name];
          }
          return merged;
        });
      }
    } catch {
      if (sequence.current === current) {
        setSources((previous) => ({
          failures: previous?.failures ?? [], stickers: previous?.stickers ?? [], inspections: previous?.inspections ?? [],
          returns: previous?.returns ?? [], unavailable: ['failures', 'stickers', 'inspections', 'returns'],
        }));
      }
    } finally {
      if (sequence.current === current) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const check = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', check);
    window.addEventListener('online', check);
    return () => {
      sequence.current++;
      window.removeEventListener('focus', check);
      window.removeEventListener('online', check);
    };
  }, [enabled, refresh]);

  const readiness = useMemo(() => {
    const map = buildDispatchReadinessMap(sources?.stickers ?? [], sources?.inspections ?? [],
      new Date(`${mexicoDateInput()}T12:00:00`), sources?.returns ?? []);
    for (const unitId of openAveriaUnitSet(sources?.failures ?? [])) {
      if (map.get(unitId)?.level === 'blocked') continue;
      map.set(unitId, {
        unitId, source: 'averia', level: 'blocked', label: 'No despachar',
        reason: 'Avería sin cierre', effectiveStatus: 'taller',
      });
    }
    return map;
  }, [sources]);

  const verified = !!sources && sources.unavailable.length === 0;
  const effectiveEquipment = equipment.map((unit) => applyDispatchReadiness(unit, readiness.get(normalizeUnitId(unit.unit_id))));
  const message = sources?.unavailable.length
    ? `Disponibilidad sin verificar. Fuentes no disponibles: ${sources.unavailable.map((source) => LABELS[source]).join(', ')}.`
    : '';
  return { effectiveEquipment, readiness, pendingReturns: sources?.returns ?? [], verified, loading, message, refresh };
}
