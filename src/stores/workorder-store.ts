import { create } from 'zustand';
import { readRange, appendRow, updateCell, SHEET_TABS } from '../lib/sheets-api';
import { OT_COL, OT_LOG_COL, OT_FIELD_COLUMN, AVERIA_COL } from '../lib/data-adapter';
import { supabase } from '../lib/supabase';
import type { WorkOrder, StatusLogEntry, OTStatusField, OTEstado, OTPriority } from '../types/workorder';
import { mexicoDate, mexicoTime } from '../lib/date-utils';

/** Wrap a promise with a timeout. Rejects if not resolved in ms. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms)
    ),
  ]);
}

interface WorkOrderState {
  workorders: WorkOrder[];
  statusLog: StatusLogEntry[];
  loading: boolean;
  error: string | null;
  fetched: boolean;
  fetchWorkOrders: () => Promise<void>;
  updateOTField: (
    otId: string,
    field: OTStatusField,
    newValue: string,
    changedBy: string,
    role: string,
  ) => Promise<void>;
  getWorkOrderById: (otId: string) => WorkOrder | undefined;
}

function parseWorkOrderRow(row: string[]): WorkOrder | null {
  if (!row[OT_COL.OT_ID] || !row[OT_COL.OT_ID].startsWith('OT-')) return null;
  return {
    ot_id:             row[OT_COL.OT_ID]          ?? '',
    fecha:             row[OT_COL.FECHA]           ?? '',
    unidad:            row[OT_COL.UNIDAD]          ?? '',
    tipo_averia:       row[OT_COL.TIPO_AVERIA]     ?? '',
    descripcion:       row[OT_COL.DESCRIPCION]     ?? '',
    severidad:         row[OT_COL.SEVERIDAD]       ?? '',
    prioridad:         (row[OT_COL.PRIORIDAD]      ?? 'MEDIA') as OTPriority,
    mecanico_asignado: row[OT_COL.MECANICO]        ?? '',
    estado:            (row[OT_COL.ESTADO]         ?? 'Abierta') as OTEstado,
    foto_url:          row[OT_COL.FOTO_URL]        ?? '',
    averia_ref:        row[OT_COL.AVERIA_REF]      ?? '',
    partes_necesarias: row[OT_COL.PARTES]          ?? '',
    costo_estimado:    Number(row[OT_COL.COSTO_ESTIMADO]) || 0,
    fecha_cierre:      row[OT_COL.FECHA_CIERRE]    ?? '',
    observaciones:     row[OT_COL.OBSERVACIONES]   ?? '',
    progreso:          Number(row[OT_COL.PROGRESO]) || 0,
  };
}

function parseStatusLogRow(row: string[]): StatusLogEntry | null {
  if (!row[OT_LOG_COL.OT_ID] || !row[OT_LOG_COL.OT_ID].startsWith('OT-')) return null;
  return {
    timestamp:   row[OT_LOG_COL.TIMESTAMP]   ?? '',
    ot_id:       row[OT_LOG_COL.OT_ID]       ?? '',
    field:       (row[OT_LOG_COL.FIELD]      ?? 'estado') as OTStatusField,
    old_value:   row[OT_LOG_COL.OLD_VALUE]   ?? '',
    new_value:   row[OT_LOG_COL.NEW_VALUE]   ?? '',
    changed_by:  row[OT_LOG_COL.CHANGED_BY]  ?? '',
    role:        row[OT_LOG_COL.ROLE]        ?? '',
  };
}

function applyStatusLog(workorders: WorkOrder[], log: StatusLogEntry[]): WorkOrder[] {
  const sorted = [...log].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const woMap = new Map<string, WorkOrder>();
  for (const wo of workorders) {
    woMap.set(wo.ot_id, { ...wo });
  }
  for (const entry of sorted) {
    const wo = woMap.get(entry.ot_id);
    if (!wo) continue;
    switch (entry.field) {
      case 'estado':
        wo.estado = entry.new_value as OTEstado;
        break;
      case 'mecanico_asignado':
        wo.mecanico_asignado = entry.new_value;
        break;
      case 'progreso':
        wo.progreso = Number(entry.new_value) || 0;
        break;
      case 'observaciones':
        wo.observaciones = entry.new_value;
        break;
      case 'costo_estimado':
        wo.costo_estimado = Number(entry.new_value) || 0;
        break;
      case 'prioridad':
        wo.prioridad = entry.new_value as OTPriority;
        break;
    }
    woMap.set(wo.ot_id, wo);
  }
  return Array.from(woMap.values());
}

export const useWorkOrderStore = create<WorkOrderState>((set, get) => ({
  workorders: [],
  statusLog: [],
  loading: false,
  error: null,
  fetched: false,

  fetchWorkOrders: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const [otResult, logResult] = await Promise.allSettled([
        withTimeout(readRange(SHEET_TABS.ORDENES_TRABAJO), 10000),
        withTimeout(readRange(SHEET_TABS.OT_STATUS_LOG), 10000),
      ]);

      const otRows = otResult.status === 'fulfilled' ? otResult.value : [];
      const logRows = logResult.status === 'fulfilled' ? logResult.value : [];

      const baseWorkorders: WorkOrder[] = [];
      for (const row of otRows) {
        const wo = parseWorkOrderRow(row);
        if (wo) baseWorkorders.push(wo);
      }

      const statusLog: StatusLogEntry[] = [];
      for (const row of logRows) {
        const entry = parseStatusLogRow(row);
        if (entry) statusLog.push(entry);
      }

      const workorders = applyStatusLog(baseWorkorders, statusLog);
      set({ workorders, statusLog, loading: false, fetched: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar órdenes';
      set({ workorders: [], statusLog: [], error: message, loading: false, fetched: true });
    }
  },

  updateOTField: async (otId, field, newValue, changedBy, role) => {
    const wo = get().workorders.find((w) => w.ot_id === otId);
    if (!wo) return;

    const oldValue = String(wo[field] ?? '');
    const timestamp = `${mexicoDate()} ${mexicoTime()}`;

    const entry: StatusLogEntry = {
      timestamp,
      ot_id: otId,
      field,
      old_value: oldValue,
      new_value: newValue,
      changed_by: changedBy,
      role,
    };

    // Optimistic update
    set((state) => {
      const updatedLog = [...state.statusLog, entry];
      const updatedWOs = state.workorders.map((w) => {
        if (w.ot_id !== otId) return w;
        const updated = { ...w };
        switch (field) {
          case 'estado':
            updated.estado = newValue as OTEstado;
            break;
          case 'mecanico_asignado':
            updated.mecanico_asignado = newValue;
            break;
          case 'progreso':
            updated.progreso = Number(newValue) || 0;
            break;
          case 'observaciones':
            updated.observaciones = newValue;
            break;
          case 'costo_estimado':
            updated.costo_estimado = Number(newValue) || 0;
            break;
          case 'prioridad':
            updated.prioridad = newValue as OTPriority;
            break;
        }
        return updated;
      });
      return { workorders: updatedWOs, statusLog: updatedLog };
    });

    try {
      await appendRow(SHEET_TABS.OT_STATUS_LOG, [
        timestamp,
        otId,
        field,
        oldValue,
        newValue,
        changedBy,
        role,
      ]);

      const col = OT_FIELD_COLUMN[field];
      if (col !== undefined) {
        try {
          await updateCell(SHEET_TABS.ORDENES_TRABAJO, 1, otId, col, newValue);
        } catch {
          // Non-critical — the log is the source of truth
        }
      }

      // Auto-sync Averías sheet when estado changes
      if (field === 'estado') {
        try {
          await updateCell(SHEET_TABS.AVERIAS, AVERIA_COL.OT_ID, otId, AVERIA_COL.ESTADO, newValue);
        } catch {
          // Non-critical — Averías row may not exist for older OTs
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al guardar';
      set({ error: message });
    }
  },

  getWorkOrderById: (otId) => {
    return get().workorders.find((w) => w.ot_id === otId);
  },
}));

// ── Supabase Realtime subscription ────────────────────────────────────────────
// Activates only when real Supabase credentials are configured (T1-4).
// When credentials are placeholders, the subscription silently no-ops.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
if (supabaseUrl && !supabaseUrl.includes('placeholder')) {
  supabase
    .channel('workorders-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'workorders' },
      (payload) => {
        const store = useWorkOrderStore.getState();
        if (!store.fetched) return;

        if (payload.eventType === 'INSERT') {
          const newWO = payload.new as WorkOrder;
          useWorkOrderStore.setState((s) => ({
            workorders: [...s.workorders, newWO],
          }));
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as WorkOrder;
          useWorkOrderStore.setState((s) => ({
            workorders: s.workorders.map((w) =>
              w.ot_id === updated.ot_id ? { ...w, ...updated } : w
            ),
          }));
        }
      }
    )
    .subscribe();
}
