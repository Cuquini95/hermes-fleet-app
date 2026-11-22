import { describe, expect, it } from 'vitest';
import { nextWorkOrderAction, unitClosedWorkOrders } from './panama-case-status';
import type { WorkOrder } from '../types/workorder';

const order = (overrides: Partial<WorkOrder> = {}): WorkOrder => ({
  ot_id: 'OT-0001', fecha: '2026-11-20', unidad: 'DZ203', tipo_averia: 'Falla',
  descripcion: '', severidad: 'MEDIA', prioridad: 'MEDIA', mecanico_asignado: '',
  estado: 'Completado', foto_url: '', averia_ref: '', partes_necesarias: '',
  costo_estimado: 0, fecha_cierre: '', observaciones: '', progreso: 100,
  ...overrides,
});

describe('trazabilidad de caso Hermes Panamá', () => {
  it('no inventa una fecha de cierre para OT cerrada heredada', () => {
    const summary = unitClosedWorkOrders([order()], 'dz203');
    expect(summary.lastDated).toBeNull();
    expect(summary.missingClosingDate.map(row => row.ot_id)).toEqual(['OT-0001']);
  });
  it('muestra última OT fechada y separa cierres sin fecha', () => {
    const summary = unitClosedWorkOrders([
      order(),
      order({ ot_id: 'OT-0100', fecha_cierre: '2026-11-19' }),
      order({ ot_id: 'OT-0110', fecha_cierre: '2026-11-21' }),
    ], 'DZ203');
    expect(summary.lastDated?.ot_id).toBe('OT-0110');
    expect(summary.missingClosingDate).toHaveLength(1);
  });
  it('obliga a una aceptación operativa independiente, incluso con OT completada', () => {
    expect(nextWorkOrderAction(order()).operationalRelease).toBe('pending');
    expect(nextWorkOrderAction(order({ technical: { userId: 'u1', userName: 'Taller', acceptedAt: '2026-11-20' } })).responsible).toBe('Supervisión de Operaciones');
    expect(nextWorkOrderAction(order({ operations: { userId: 'ops', userName: 'Ops', decision: 'accepted', recordedAt: '2026-11-21', notes: '' } })).operationalRelease).toBe('verified');
  });
  it('asigna siguiente acción a Taller cuando una OT abierta no tiene mecánico', () => {
    const action = nextWorkOrderAction(order({ estado: 'Abierta', mecanico_asignado: '' }));
    expect(action.action).toContain('Asignar mecánico');
    expect(action.responsible).toBe('Jefatura de Taller');
  });
  it('no trata el cierre de un PM como liberación automática', () => {
    expect(nextWorkOrderAction(order({ tipo_averia: 'PM' })).operationalRelease).toBe('not_applicable');
  });
});
