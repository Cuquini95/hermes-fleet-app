import { useState, useEffect, useCallback, useRef } from 'react';
import { readRange, SHEET_TABS } from '../lib/sheets-api';
import { useEquipmentList } from './useEquipmentList';
import { mexicoDate } from '../lib/date-utils';

export interface DashboardData {
  availability: number;
  criticalOTs: number;
  avgConsumption: string;
  alertsToday: number;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

async function fetchCriticalOTs(signal?: AbortSignal): Promise<number> {
  const rows = await readRange(SHEET_TABS.ORDENES_TRABAJO, signal);
  let count = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
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
    const raw = rows[i][6] ?? '';
    const litros = parseFloat(raw.replace(',', '.'));
    if (!isNaN(litros) && litros > 0) {
      total += litros;
      count++;
    }
  }
  if (count === 0) return '--';
  return `${(total / count).toFixed(2)} L/avg`;
}

async function fetchAlertsToday(signal?: AbortSignal): Promise<number> {
  const rows = await readRange(SHEET_TABS.AVERIAS, signal);
  const today = mexicoDate();
  let count = 0;
  for (let i = 1; i < rows.length; i++) {
    const dateCell = (rows[i][0] ?? '').trim();
    if (dateCell === today) {
      count++;
    }
  }
  return count;
}

export function useDashboardData(): DashboardData {
  const [criticalOTs, setCriticalOTs] = useState(0);
  const [avgConsumption, setAvgConsumption] = useState('--');
  const [alertsToday, setAlertsToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const equipmentList = useEquipmentList();
  const available = equipmentList.filter(
    (e) => e.status === 'operativo' || e.status === 'alerta'
  ).length;
  const availability = equipmentList.length > 0
    ? Math.round((available / equipmentList.length) * 100)
    : 0;

  const fetchAll = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    const results = await Promise.allSettled([
      fetchCriticalOTs(signal),
      fetchAvgConsumption(signal),
      fetchAlertsToday(signal),
    ]);

    if (signal?.aborted) return;

    const [otsResult, consumptionResult, alertsResult] = results;

    if (otsResult.status === 'fulfilled') {
      setCriticalOTs(otsResult.value);
    } else {
      setCriticalOTs(0);
    }

    if (consumptionResult.status === 'fulfilled') {
      setAvgConsumption(consumptionResult.value);
    } else {
      setAvgConsumption('--');
    }

    if (alertsResult.status === 'fulfilled') {
      setAlertsToday(alertsResult.value);
    } else {
      setAlertsToday(0);
    }

    const anyFailed = results.some((r) => r.status === 'rejected');
    if (anyFailed) {
      setError('Algunos datos no pudieron cargarse');
    }

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
    loading,
    error,
    refresh,
  };
}
