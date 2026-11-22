import type { WorkOrder } from '../types/workorder';
import { orderHistoryTime } from '../stores/workorder-store';

export type NextWorkOrderAction = {
  action: string;
  responsible: string;
  operationalRelease: 'verified' | 'pending' | 'not_applicable';
};

/**
 * A closed work order never constitutes clearance to dispatch by itself.
 * An independently accepted operational return is still subject to HSE/PM/other restrictions.
 */
export function nextWorkOrderAction(order: Pick<WorkOrder, 'estado' | 'tipo_averia' | 'mecanico_asignado' | 'technical' | 'operations'>): NextWorkOrderAction {
  const assigned = order.mecanico_asignado?.trim();
  if (order.estado === 'Completado') {
    if (order.tipo_averia === 'PM') return {
      action: 'PM cerrada; revisar estado de mantenimiento y restricciones de despacho',
      responsible: 'Planeación / Operaciones', operationalRelease: 'not_applicable',
    };
    if (order.operations?.decision === 'accepted') return {
      action: 'Retorno confirmado; verificar restricciones HSE, PM y disponibilidad antes de despachar',
      responsible: 'Despacho / Operaciones', operationalRelease: 'verified',
    };
    if (order.operations?.decision === 'returned') return {
      action: 'Atender devolución de Operaciones y completar la corrección',
      responsible: 'Jefatura de Taller', operationalRelease: 'pending',
    };
    if (!order.technical) return {
      action: 'Registrar verificación técnica independiente antes del retorno',
      responsible: 'Jefatura de Taller', operationalRelease: 'pending',
    };
    return {
      action: 'Recibir equipo y confirmar o devolver el retorno operativo',
      responsible: 'Supervisión de Operaciones', operationalRelease: 'pending',
    };
  }
  if (!assigned && ['Abierta', 'En Espera de Asignación'].includes(order.estado)) return {
    action: 'Asignar mecánico y definir próxima intervención',
    responsible: 'Jefatura de Taller', operationalRelease: 'pending',
  };
  if (order.estado === 'Esperando Pieza') return {
    action: 'Dar seguimiento a solicitud, OC, almacén y entrega del repuesto',
    responsible: 'Compras / Almacén / Taller', operationalRelease: 'pending',
  };
  if (order.estado === 'Resuelta') return {
    action: 'Completar revisión y aceptación técnica independiente',
    responsible: 'Supervisión Técnica', operationalRelease: 'pending',
  };
  return {
    action: 'Continuar diagnóstico o intervención y registrar evidencia',
    responsible: assigned || 'Taller por asignar', operationalRelease: 'pending',
  };
}

export function unitClosedWorkOrders(orders: readonly WorkOrder[], unit: string) {
  const matching = orders.filter(row => row.unidad.trim().toUpperCase() === unit.trim().toUpperCase() && row.estado === 'Completado');
  const withClosingDate = matching.filter(row => orderHistoryTime(row.fecha_cierre) > 0)
    .sort((a, b) => orderHistoryTime(b.fecha_cierre) - orderHistoryTime(a.fecha_cierre));
  const missingClosingDate = matching.filter(row => !(orderHistoryTime(row.fecha_cierre) > 0));
  return {
    lastDated: withClosingDate[0] ?? null,
    missingClosingDate,
    complete: matching.length,
  };
}
