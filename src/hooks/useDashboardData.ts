import { useState, useEffect, useCallback, useRef } from 'react';
import { readRange, SHEET_TABS } from '../lib/sheets-api';
import type { Equipment } from '../types/equipment';
import { mexicoDate } from '../lib/date-utils';
import { buildAvailabilityTrend, type AvailabilityPoint } from '../lib/availability';
import { parseAveriaRow } from '../lib/averias';
import { useEquipmentStore } from '../stores/equipment-store';

export interface DashboardData {
  criticalOTs: number | null;
  avgConsumption: string;
  alertsToday: number | null;
  availabilityTrend: AvailabilityPoint[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

async function fetchCriticalOTs(signal?: AbortSignal, offset?: number): Promise<number> {
  const rows = await readRange(SHEET_TABS.ORDENES_TRABAJO, signal, undefined, offset);
  let count = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const priority = (row[7] ?? '').trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const status = (row[9] ?? '').trim().toLowerCase();
    if (priority === 'critica' && !['completado', 'cerrada', 'cerrado'].includes(status)) {
      count++;
    }
  }
  return count;
}

async function fetchAvgConsumption(signal?: AbortSignal, offset?: number): Promise<string> {
  const rows = await readRange(SHEET_TABS.COMBUSTIBLE, signal, undefined, offset);
  let total = 0;
  let count = 0;
  for (const row of rows) {
    const raw = (row[6] ?? '').trim();
    const litros = Number(raw.replace(/,(?=\d{3}(?:\D|$))/g, '').replace(',', '.'));
    if (Number.isFinite(litros) && litros > 0) {
      total += litros;
      count++;
    }
  }
  if (count === 0) return '—';
  return `${(total / count).toFixed(2)} L/carga`;
}

function countAlertsToday(rows: string[][]): number {
  const today = mexicoDate();
  return rows.filter((row) => parseAveriaRow(row)?.fecha === today).length;
}

export function useDashboardData(equipmentList: Equipment[]): DashboardData {
  const [criticalOTs, setCriticalOTs] = useState<number | null>(null);
  const [avgConsumption, setAvgConsumption] = useState('—');
  const [averiaRows, setAveriaRows] = useState<string[][] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const equipmentError = useEquipmentStore((state) => state.error);
  const hasAvailability = averiaRows !== null && equipmentList.length > 0 && !equipmentError;
  const scope = new Set(equipmentList.map((equipment) => equipment.unit_id.toUpperCase()));
  const scopedRows = (averiaRows ?? []).filter((row) => scope.has((row[2] ?? '').trim().toUpperCase()));
  const availabilityTrend = hasAvailability ? buildAvailabilityTrend(equipmentList, scopedRows) : [];
  const alertsToday = averiaRows === null ? null : countAlertsToday(averiaRows);

  const fetchAll = useCallback(async (signal: AbortSignal, refresh = false) => {
    setLoading(true);
    setError(null);
    const offset = refresh ? 0 : undefined;
    const results = await Promise.allSettled([
      fetchCriticalOTs(signal, offset),
      fetchAvgConsumption(signal, offset),
      readRange(SHEET_TABS.AVERIAS, signal, undefined, offset),
    ]);
    if (signal.aborted) return;

    const [orders, fuel, breakdowns] = results;
    setCriticalOTs(orders.status === 'fulfilled' ? orders.value : null);
    setAvgConsumption(fuel.status === 'fulfilled' ? fuel.value : '—');
    setAveriaRows(breakdowns.status === 'fulfilled' ? breakdowns.value : null);
    setError(results.some((result) => result.status === 'rejected') ? 'Algunos indicadores no se pudieron cargar.' : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    void fetchAll(controller.signal);
    return () => {
      controller.abort();
      abortRef.current = null;
    };
  }, [fetchAll]);

  const refresh = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    void fetchAll(controller.signal, true);
    void useEquipmentStore.getState().refetch();
  }, [fetchAll]);

  return {
    criticalOTs,
    avgConsumption,
    alertsToday,
    availabilityTrend,
    loading,
    error: error || (equipmentError ? 'No se pudo cargar la flota para calcular la disponibilidad.' : null),
    refresh,
  };
}
