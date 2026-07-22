import type { AppRole } from '../types/roles';
import type { OTStatusField } from '../types/workorder';

/**
 * Field-level work-order permissions mirror the maintenance role policy:
 * technicians can update execution evidence, while planning and management
 * roles own assignment, priority, and estimated-cost changes.
 */
const WORK_ORDER_FIELD_ROLES: Record<OTStatusField, readonly AppRole[]> = {
  estado: ['mecanico', 'jefe_taller', 'coordinador', 'supervisor', 'gerencia'],
  mecanico_asignado: ['jefe_taller', 'coordinador', 'supervisor', 'gerencia'],
  progreso: ['mecanico', 'jefe_taller', 'coordinador', 'supervisor', 'gerencia'],
  observaciones: ['mecanico', 'jefe_taller', 'coordinador', 'supervisor', 'gerencia'],
  costo_estimado: ['jefe_taller', 'coordinador', 'supervisor', 'gerencia'],
  prioridad: ['jefe_taller', 'coordinador', 'supervisor', 'gerencia'],
};

export function canEditWorkOrderField(
  role: AppRole | null | undefined,
  field: OTStatusField,
): boolean {
  return Boolean(role && WORK_ORDER_FIELD_ROLES[field].includes(role));
}

export function canEditAnyWorkOrderField(role: AppRole | null | undefined): boolean {
  return (Object.keys(WORK_ORDER_FIELD_ROLES) as OTStatusField[]).some((field) =>
    canEditWorkOrderField(role, field),
  );
}
