export type OTPriority = 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA';
export type OTEstado = 'Nuevo' | 'Asignado' | 'En Proceso' | 'Esperando Pieza' | 'Completado' | 'Cerrado';

export const OT_STATUS_FLOW: OTEstado[] = ['Nuevo', 'Asignado', 'En Proceso', 'Esperando Pieza', 'Completado', 'Cerrado'];

export type OTStatusField = 'estado' | 'mecanico_asignado' | 'progreso' | 'observaciones' | 'costo_estimado' | 'prioridad';

export interface StatusLogEntry {
  timestamp: string;
  ot_id: string;
  field: OTStatusField;
  old_value: string;
  new_value: string;
  changed_by: string;
  role: string;
}

export function getNextStatuses(current: OTEstado): OTEstado[] {
  const idx = OT_STATUS_FLOW.indexOf(current);
  if (idx < 0) return OT_STATUS_FLOW;
  return OT_STATUS_FLOW.slice(idx);
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
  estado: OTEstado;
  foto_url: string;
  averia_ref: string;
  partes_necesarias: string;
  costo_estimado: number;
  fecha_cierre: string;
  observaciones: string;
  progreso: number;
}

export const PRIORITY_CONFIG: Record<OTPriority, { color: string; bg: string; label: string; time: string }> = {
  CRITICA: { color: '#DC2626', bg: '#FEE2E2', label: 'CRÍTICA', time: '< 4 horas' },
  ALTA: { color: '#EA580C', bg: '#FFEDD5', label: 'ALTA', time: '< 8 horas' },
  MEDIA: { color: '#F59E0B', bg: '#FEF3C7', label: 'MEDIA', time: '< 24 horas' },
  BAJA: { color: '#3B82F6', bg: '#DBEAFE', label: 'BAJA', time: '< 1 semana' },
};

export const ESTADO_CONFIG: Record<OTEstado, { color: string; bg: string }> = {
  'Nuevo': { color: '#3B82F6', bg: '#DBEAFE' },
  'Asignado': { color: '#8B5CF6', bg: '#EDE9FE' },
  'En Proceso': { color: '#2563EB', bg: '#FEF3C7' },
  'Esperando Pieza': { color: '#EA580C', bg: '#FFEDD5' },
  'Completado': { color: '#16A34A', bg: '#DCFCE7' },
  'Cerrado': { color: '#6B7280', bg: '#F3F4F6' },
};
