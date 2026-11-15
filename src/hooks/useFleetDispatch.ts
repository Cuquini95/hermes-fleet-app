import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { mexicoDateInput } from '../lib/date-utils';
import { applyDispatchReadiness, buildDispatchReadinessMap, normalizeUnitId, type PendingOperationalReturn, type UnitDispatchReadiness } from '../lib/dispatch-readiness';
import { requestWorkshop } from '../lib/workshop-api';
import { useAuthStore } from '../stores/auth-store';
import type { Equipment } from '../types/equipment';

type DispatchSource = 'failures' | 'stickers' | 'inspections' | 'returns' | 'workshopMaster';
export type OperatingStatus = 'operativo' | 'inoperativo';
export interface WorkshopRecord {
  id: string;
  unit: string;
  status: string;
  source: 'master' | 'hermes';
  description?: string;
  order?: string;
  date?: string | null;
  needsReview?: boolean;
  operationalStatus?: string;
  excludedFromCount?: boolean;
}
interface WorkshopSection {
  records: WorkshopRecord[];
  capturedAt: string | null;
  masterAvailable: boolean;
  operationalAvailable: boolean;
}
export interface WorkshopSummary {
  failures: WorkshopSection;
  orders: WorkshopSection;
  alertsToday: number | null;
  openOrders: number | null;
  criticalOTs: number | null;
  criticalOrders?: WorkshopRecord[];
  ordersWithoutPriority?: WorkshopRecord[];
}
interface ReadinessSources {
  failures: string[][];
  stickers: string[][];
  inspections: string[][];
  returns: PendingOperationalReturn[];
  unavailable: DispatchSource[];
  workshop?: WorkshopSummary;
  masterRestrictions?: UnitDispatchReadiness[];
  operatingStatuses?: [string, OperatingStatus][];
  operatingCheckedAt?: string;
}

export interface FleetDispatch {
  effectiveEquipment: Equipment[];
  readiness: Map<string, UnitDispatchReadiness>;
  pendingReturns: PendingOperationalReturn[];
  workshop?: WorkshopSummary;
  operatingStatuses?: ReadonlyMap<string, OperatingStatus>;
  operatingCheckedAt?: string;
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
  workshopMaster: 'Maestro de Taller',
};

export function useFleetDispatch(equipment: Equipment[], enabled = true): FleetDispatch {
  const user = useAuthStore(state => state.userId);
  const project = useAuthStore(state => state.project);
  const identity = user + '|' + project;
  const [loaded, setLoaded] = useState<{ identity: string; sources: ReadinessSources }>();
  const sources = loaded?.identity === identity ? loaded.sources : undefined;
  const [loading, setLoading] = useState(enabled);
  const sequence = useRef(0);
  const invalidate = useCallback(() => { sequence.current++; }, []);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const current = ++sequence.current;
    setLoading(true);
    try {
      const result = await requestWorkshop<ReadinessSources>('readiness');
      if (sequence.current === current) {
        setLoaded(previous => {
          if (previous?.identity !== identity) return { identity, sources: result };
          // Keep known restrictions from a source until it responds again.
          const merged = { ...result, operatingStatuses: result.operatingStatuses ?? previous.sources.operatingStatuses,
            operatingCheckedAt: result.operatingCheckedAt ?? previous.sources.operatingCheckedAt };
          for (const name of result.unavailable) {
            if (name === 'workshopMaster') {
              const restrictions = new Map(previous.sources.masterRestrictions?.map(row => [row.unitId, row]));
              for (const row of result.masterRestrictions ?? []) restrictions.set(row.unitId, row);
              merged.masterRestrictions = [...restrictions.values()];
            } else if (name === 'returns') merged.returns = previous.sources.returns;
            else merged[name] = previous.sources[name];
          }
          return { identity, sources: merged };
        });
      }
    } catch {
      if (sequence.current === current) {
        setLoaded(previous => {
          const last = previous?.identity === identity ? previous.sources : undefined;
          const workshop = last?.workshop;
          return { identity, sources: {
            failures: last?.failures ?? [], stickers: last?.stickers ?? [], inspections: last?.inspections ?? [],
            returns: last?.returns ?? [], masterRestrictions: last?.masterRestrictions,
            operatingStatuses: last?.operatingStatuses,
            operatingCheckedAt: last?.operatingCheckedAt,
            workshop: workshop && {
              ...workshop,
              failures: { ...workshop.failures, masterAvailable: false, operationalAvailable: false },
              orders: { ...workshop.orders, masterAvailable: false, operationalAvailable: false },
              alertsToday: null, openOrders: null, criticalOTs: null, criticalOrders: [],
            },
            unavailable: ['failures', 'stickers', 'inspections', 'returns'],
          } };
        });
      }
    } finally {
      if (sequence.current === current) setLoading(false);
    }
  }, [enabled, identity]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const check = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', check);
    window.addEventListener('online', check);
    return () => {
      invalidate();
      window.removeEventListener('focus', check);
      window.removeEventListener('online', check);
    };
  }, [enabled, refresh, invalidate]);

  const readiness = useMemo(() => {
    const map = buildDispatchReadinessMap(sources?.stickers ?? [], sources?.inspections ?? [],
      new Date(`${mexicoDateInput()}T12:00:00`), sources?.returns ?? [], sources?.failures ?? []);
    for (const restriction of sources?.masterRestrictions ?? []) {
      const previous = map.get(restriction.unitId);
      map.set(restriction.unitId, previous?.level === 'blocked' && previous.source !== 'averia'
        ? { ...restriction, reason: `${restriction.reason}. ${previous.reason}` } : restriction);
    }
    return map;
  }, [sources]);

  const verified = !!sources && sources.unavailable.length === 0;
  const effectiveEquipment = equipment.map((unit) => applyDispatchReadiness(unit, readiness.get(normalizeUnitId(unit.unit_id))));
  const message = sources?.unavailable.length
    ? `Disponibilidad sin verificar. Fuentes no disponibles: ${sources.unavailable.map((source) => LABELS[source]).join(', ')}.`
    : '';
  return { effectiveEquipment, readiness, pendingReturns: sources?.returns ?? [], workshop: sources?.workshop,
    operatingStatuses: sources?.operatingStatuses ? new Map(sources.operatingStatuses) : undefined,
    operatingCheckedAt: sources?.operatingCheckedAt,
    verified, loading, message, refresh };
}
