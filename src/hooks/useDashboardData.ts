import { useState, useEffect, useCallback, useRef } from 'react';
import { readRange, SHEET_TABS } from '../lib/sheets-api';
import { useEquipmentList } from './useEquipmentList';
import { mexicoDate } from '../lib/date-utils';
import { buildAvailabilityTrend, calculateAvailability, type AvailabilityPoint } from '../lib/availability';
import { openAveriaUnitSet } from '../lib/averias';

export interface DashboardData {
  availability: number;
  criticalOTs: number;
  avgConsumption: string;
  alertsToday: number;
  availabilityTrend: AvailabilityPoint[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

// ── Module-level TTL session cache ────────────────────────────────────────────
// Survives component unmounts (e.g. navigating away and back).
// Cleared on explicit refresh() or after CACHE_TTL_MS.
interface CacheEntry {
  criticalOTs: number;
  avgConsumption: string;
  alertsToday: number;
  averiaRows: string[][];
  ts: number;
}

const CACHE_TTL_MS = 30_000; // 30 seconds
let _cache: CacheEntry | null = null;

// ── Sheets fetchers ───────────────────────────────────────────────────────────

async function fetchCriticalOTs(signal?: AbortSignal): Promise<number> {
  const rows = await readRange(SHEET_TABS.ORDENES_TRABAJO, signal);
  let count = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const priority = (row[7] ?? '').toLowerCase();
    const status = (row[9] ?? '').toLowerCase();
    if (
      priority === 'critica' &&
      status !== 'completado'
    ) {
      count++;
    }
  }
  return count;
}

async function fetchAvgConsumption(signal?: AbortSignal): Promise<string> {
  const rows = await readRange(SHEET_TABS.COMBUSTIBLE, signal);
  let total = 0;
  let count = 0;
  for (let i = 2; i < rows.length; i++) {
    const raw = rows[i]?.[6] ?? '';
    const litros = parseFloat(raw.replace(',', '.'));
    if (!isNaN(litros) && litros > 0) {
      total += litros;
      count++;
    }
  }
  if (count === 0) return '--';
  return `${(total / count).toFixed(2)} L/avg`;
}

function countAlertsToday(rows: string[][]): number {
  const today = mexicoDate();
  let count = 0;
  for (let i = 1; i < rows.length; i++) {
    const dateCell = (rows[i]?.[0] ?? '').trim();
    if (dateCell === today) {
      count++;
    }
  }
  return count;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDashboardData(): DashboardData {
  const [criticalOTs, setCriticalOTs] = useState(0);
  const [avgConsumption, setAvgConsumption] = useState('--');
  const [alertsToday, setAlertsToday] = useState(0);
  const [averiaRows, setAveriaRows] = useState<string[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const equipmentList = useEquipmentList();
  const openAveriaUnits = openAveriaUnitSet(averiaRows);
  const availability = calculateAvailability(equipmentList, openAveriaUnits);
  const availabilityTrend = buildAvailabilityTrend(equipmentList, averiaRows);

  const fetchAll = useCallback(async (signal?: AbortSignal) => {
    // Serve from cache if still fresh — avoids redundant Sheets API calls
    // when the user navigates away and back within the TTL window.
    const now = Date.now();
    if (_cache !== null && now - _cache.ts < CACHE_TTL_MS) {
      setCriticalOTs(_cache.criticalOTs);
      setAvgConsumption(_cache.avgConsumption);
      setAlertsToday(_cache.alertsToday);
      setAveriaRows(_cache.averiaRows);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const results = await Promise.allSettled([
      fetchCriticalOTs(signal),
      fetchAvgConsumption(signal),
      readRange(SHEET_TABS.AVERIAS, signal),
    ]);

    if (signal?.aborted) return;

    const [otsResult, consumptionResult, averiasResult] = results;

    const newOTs          = otsResult.status          === 'fulfilled' ? otsResult.value          : 0;
    const newConsumption  = consumptionResult.status   === 'fulfilled' ? consumptionResult.value   : '--';
    const newAveriaRows   = averiasResult.status       === 'fulfilled' ? averiasResult.value       : [];
    const newAlerts       = countAlertsToday(newAveriaRows);

    setCriticalOTs(newOTs);
    setAvgConsumption(newConsumption);
    setAlertsToday(newAlerts);
    setAveriaRows(newAveriaRows);

    const anyFailed = results.some((r) => r.status === 'rejected');
    setError(anyFailed ? 'Algunos datos no pudieron cargarse' : null);

    // Populate cache so the next mount within TTL is instant.
    _cache = {
      criticalOTs: newOTs,
      avgConsumption: newConsumption,
      alertsToday: newAlerts,
      averiaRows: newAveriaRows,
      ts: Date.now(),
    };

    setLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    fetchAll(controller.signal).catch(() => {});
    return () => {
      controller.abort();
      abortRef.current = null;
    };
  }, [fetchAll]);

  const refresh = useCallback(() => {
    _cache = null; // invalidate so next fetch hits Sheets
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    fetchAll(controller.signal).catch(() => {});
  }, [fetchAll]);

  return {
    availability,
    criticalOTs,
    avgConsumption,
    alertsToday,
    availabilityTrend,
    loading,
    error,
    refresh,
  };
}
