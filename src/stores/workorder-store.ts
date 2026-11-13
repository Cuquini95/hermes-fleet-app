import { create } from 'zustand';
import { OT_COL, OT_LOG_COL } from '../lib/data-adapter';
import { requestWorkshop, workshopActorId, WorkshopApiError } from '../lib/workshop-api';
import { useAuthStore } from './auth-store';
import type { WorkOrder, StatusLogEntry, OTStatusField, OTEstado, OTPriority, WorkshopExecutionInput } from '../types/workorder';

export function orderHistoryTime(value: string): number {
  const sheet = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?: (\d{2}:\d{2}(?::\d{2})?))?$/.exec(value);
  const local = sheet
    ? `${sheet[3]}-${sheet[2]?.padStart(2, '0')}-${sheet[1]?.padStart(2, '0')}T${sheet[4] || '00:00:00'}`
    : value.replace(' ', 'T');
  const zone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(local) ? '-06:00' : '';
  return Date.parse(`${local}${zone}`) || 0;
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
    newValue: string | string[],
    execution?: WorkshopExecutionInput,
  ) => Promise<void>;
  getWorkOrderById: (otId: string) => WorkOrder | undefined;
  initRealtime: () => () => void;
}

function readOrderDetail<T>(value: string | undefined): T | undefined {
  try { return value ? JSON.parse(value) as T : undefined; } catch { return undefined; }
}

function parseWorkOrderRow(row: string[]): WorkOrder | null {
  const otId = row[OT_COL.OT_ID];
  if (!otId || !otId.startsWith('OT-')) return null;
  return {
    ot_id:             row[OT_COL.OT_ID]          ?? '',
    fecha:             row[OT_COL.FECHA]           ?? '',
    unidad:            row[OT_COL.UNIDAD]          ?? '',
    tipo_averia:       row[OT_COL.TIPO_AVERIA]     ?? '',
    descripcion:       row[OT_COL.DESCRIPCION]     ?? '',
    severidad:         row[OT_COL.SEVERIDAD]       ?? '',
    prioridad:         (row[OT_COL.PRIORIDAD]      ?? 'MEDIA') as OTPriority,
    mecanico_asignado: row[OT_COL.MECANICO]        ?? '',
    mecanico_usuario_id: row[17]                  ?? '',
    estado:            (row[OT_COL.ESTADO]         ?? 'Abierta') as OTEstado,
    foto_url:          row[OT_COL.FOTO_URL]        ?? '',
    averia_ref:        row[OT_COL.AVERIA_REF]      ?? '',
    partes_necesarias: row[OT_COL.PARTES]          ?? '',
    costo_estimado:    Number(row[OT_COL.COSTO_ESTIMADO]) || 0,
    fecha_cierre:      row[OT_COL.FECHA_CIERRE]    ?? '',
    observaciones:     row[OT_COL.OBSERVACIONES]   ?? '',
    progreso:          Number(row[OT_COL.PROGRESO]) || 0,
    execution:         readOrderDetail(row[20]),
    technical:         readOrderDetail(row[21]),
    operations:        readOrderDetail(row[22]),
    previousOtId:      row[24] || undefined,
  };
}

function parseStatusLogRow(row: string[]): StatusLogEntry | null {
  const otId = row[OT_LOG_COL.OT_ID];
  if (!otId || !otId.startsWith('OT-')) return null;
  return {
    timestamp:   row[OT_LOG_COL.TIMESTAMP]   ?? '',
    ot_id:       row[OT_LOG_COL.OT_ID]       ?? '',
    field:       (row[OT_LOG_COL.FIELD]      ?? 'estado') as StatusLogEntry['field'],
    old_value:   row[OT_LOG_COL.OLD_VALUE]   ?? '',
    new_value:   row[OT_LOG_COL.NEW_VALUE]   ?? '',
    changed_by:  row[OT_LOG_COL.CHANGED_BY]  ?? '',
    role:        row[OT_LOG_COL.ROLE]        ?? '',
    actorId:     row[7]                      ?? '',
  };
}

function applyStatusLog(workorders: WorkOrder[], log: StatusLogEntry[]): WorkOrder[] {
  const sorted = [...log].sort((a, b) => orderHistoryTime(a.timestamp) - orderHistoryTime(b.timestamp));
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
      case 'foto_url':
        wo.foto_url = entry.new_value;
        break;
      case 'prioridad':
        wo.prioridad = entry.new_value as OTPriority;
        break;
    }
    woMap.set(wo.ot_id, wo);
  }
  return Array.from(woMap.values());
}

const emptyState = { workorders: [], statusLog: [], loading: false, error: null, fetched: false };
const pendingUpdates = new Map<string, string>();
let requestSequence = 0;

export const useWorkOrderStore = create<WorkOrderState>((set, get) => ({
  ...emptyState,

  fetchWorkOrders: async () => {
    const actorId = workshopActorId();
    if (!actorId || useAuthStore.getState().role === 'operador') return;
    const sequence = ++requestSequence;
    set({ loading: true, error: null });
    try {
      const { orders, history } = await requestWorkshop<{ orders: string[][]; history: string[][] }>('orders');
      if (actorId !== workshopActorId() || sequence !== requestSequence) return;
      const workorders = orders.map(parseWorkOrderRow).filter((row): row is WorkOrder => row !== null);
      const statusLog = history.map(parseStatusLogRow).filter((row): row is StatusLogEntry => row !== null);
      set({ workorders: applyStatusLog(workorders, statusLog), statusLog, loading: false, fetched: true });
    } catch (error) {
      if (actorId !== workshopActorId() || sequence !== requestSequence) return;
      set({
        workorders: [], statusLog: [], loading: false, fetched: true,
        error: error instanceof Error ? error.message : 'Error al cargar órdenes',
      });
    }
  },

  updateOTField: async (otId, field, newValue, execution) => {
    const actorId = workshopActorId();
    if (!actorId) throw new Error('Abre una sesión individual para actualizar la OT.');
    const key = JSON.stringify([actorId, otId, field, newValue, execution]);
    const mutationId = pendingUpdates.get(key) ?? crypto.randomUUID();
    pendingUpdates.set(key, mutationId);
    try {
      await requestWorkshop('transition', { mutationId, otId, field, value: newValue, execution });
      pendingUpdates.delete(key);
      if (actorId === workshopActorId()) await get().fetchWorkOrders();
    } catch (error) {
      if (error instanceof WorkshopApiError && [400, 403, 404, 409].includes(error.status)) pendingUpdates.delete(key);
      throw error;
    }
  },

  getWorkOrderById: (otId) => get().workorders.find((wo) => wo.ot_id === otId),

  initRealtime: () => {
    let actor = workshopActorId();
    const unsubscribe = useAuthStore.subscribe(() => {
      const next = workshopActorId();
      if (next === actor) return;
      actor = next;
      requestSequence++;
      pendingUpdates.clear();
      set(emptyState);
    });
    const refresh = () => {
      if (get().fetched && !get().loading && document.visibilityState === 'visible') void get().fetchWorkOrders();
    };
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    return () => {
      unsubscribe();
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
    };
  },
}));
