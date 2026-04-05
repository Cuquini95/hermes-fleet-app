import { useState, useEffect, useCallback } from 'react';
import { readRange, SHEET_TABS } from '../lib/sheets-api';
import { EQUIPMENT_CATALOG } from '../data/equipment-catalog';
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

function computeAvailability(): number {
  const available = EQUIPMENT_CATALOG.filter(
    (e) => e.status === 'operativo' || e.status === 'alerta'
  ).length;
  return Math.round((available / EQUIPMENT_CATALOG.length) * 100);
}

async function fetchCriticalOTs(): Promise<number> {
  const rows = await readRange(SHEET_TABS.ORDENES_TRABAJO);
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

async function fetchAvgConsumption(): Promise<string> {
  const rows = await readRange(SHEET_TABS.COMBUSTIBLE);
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

async function fetchAlertsToday(): Promise<number> {
  const rows = await readRange(SHEET_TABS.AVERIAS);
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

  const availability = computeAvailability();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const results = await Promise.allSettled([
      fetchCriticalOTs(),
      fetchAvgConsumption(),
      fetchAlertsToday(),
    ]);

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
    fetchAll();
  }, [fetchAll]);

  return {
    availability,
    criticalOTs,
    avgConsumption,
    alertsToday,
    loading,
    error,
    refresh: fetchAll,
  };
}
