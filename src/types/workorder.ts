export type OTPriority = 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA';
export type OTEstado = 'Abierta' | 'En Espera de Asignación' | 'En Reparación' | 'Esperando Pieza' | 'Resuelta' | 'Completado';

export const OT_STATUS_FLOW: OTEstado[] = ['Abierta', 'En Reparación', 'Esperando Pieza', 'Resuelta', 'Completado'];

export type OTStatusField = 'estado' | 'mecanico_asignado' | 'progreso' | 'observaciones' | 'costo_estimado' | 'prioridad' | 'foto_url';

export interface StatusLogEntry {
  timestamp: string;
  ot_id: string;
  field: OTStatusField | 'programacion' | 'entrega_tecnica' | 'aceptacion_tecnica' | 'retorno_operativo';
  old_value: string;
  new_value: string;
  changed_by: string;
  role: string;
  actorId?: string;
}

export interface WorkshopExecutionInput {
  functionalTest: string;
  performedOn?: string;
  meter?: string;
  completedItems?: string[];
}

interface WorkshopActor {
  userId: string;
  userName: string;
}

export interface PMChecklist {
  reference: string;
  tasks: { id: string; label: string }[];
}

export interface PMChecklistDefinition {
  model: string;
  level: string;
  initialMeter: string;
  checklist: PMChecklist | null;
}

export interface OperationalReceipt extends WorkshopActor {
  decision: 'accepted' | 'returned';
  notes: string;
  recordedAt: string;
  returnedAt?: string;
  dueDate?: string;
}

export function getNextStatuses(current: OTEstado): OTEstado[] {
  const next: Record<OTEstado, OTEstado[]> = {
    Abierta: ['En Reparación', 'Esperando Pieza'],
    'En Espera de Asignación': ['En Reparación', 'Esperando Pieza'],
    'En Reparación': ['Esperando Pieza', 'Resuelta'],
    'Esperando Pieza': ['En Reparación', 'Resuelta'],
    Resuelta: ['En Reparación', 'Completado'],
    Completado: [],
  };
  return [current, ...(next[current] ?? [])];
}

export interface WorkOrder {
  ot_id: string;
  fecha: string;
  unidad: string;
  tipo_averia: string;
  descripcion: string;
  severidad: string;
  prioridad: OTPriority;
  mecanico_asignado: string;
  mecanico_usuario_id?: string;
  estado: OTEstado;
  foto_url: string;
  averia_ref: string;
  partes_necesarias: string;
  costo_estimado: number;
  fecha_cierre: string;
  observaciones: string;
  progreso: number;
  execution?: WorkshopExecutionInput & WorkshopActor & { submittedAt: string };
  technical?: WorkshopActor & { acceptedAt: string };
  operations?: OperationalReceipt;
}

export const PRIORITY_CONFIG: Record<OTPriority, { color: string; bg: string; label: string; time: string }> = {
  CRITICA: { color: '#DC2626', bg: '#FEE2E2', label: 'CRÍTICA', time: '< 4 horas' },
  ALTA: { color: '#EA580C', bg: '#FFEDD5', label: 'ALTA', time: '< 8 horas' },
  MEDIA: { color: '#F59E0B', bg: '#FEF3C7', label: 'MEDIA', time: '< 24 horas' },
  BAJA: { color: '#3B82F6', bg: '#DBEAFE', label: 'BAJA', time: '< 1 semana' },
};

export const ESTADO_CONFIG: Record<OTEstado, { color: string; bg: string }> = {
  'Abierta': { color: '#3B82F6', bg: '#DBEAFE' },
  'En Espera de Asignación': { color: '#3B82F6', bg: '#DBEAFE' },
  'En Reparación': { color: '#2563EB', bg: '#FEF3C7' },
  'Esperando Pieza': { color: '#EA580C', bg: '#FFEDD5' },
  'Resuelta': { color: '#8B5CF6', bg: '#EDE9FE' },
  'Completado': { color: '#16A34A', bg: '#DCFCE7' },
};
