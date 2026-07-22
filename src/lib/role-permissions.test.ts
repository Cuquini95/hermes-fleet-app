import { describe, expect, it } from 'vitest';
import { canEditAnyWorkOrderField, canEditWorkOrderField } from './role-permissions';

describe('work-order role permissions', () => {
  it('does not grant operational edits to the operator role', () => {
    expect(canEditAnyWorkOrderField('operador')).toBe(false);
  });

  it('limits mechanics to execution evidence', () => {
    expect(canEditWorkOrderField('mecanico', 'estado')).toBe(true);
    expect(canEditWorkOrderField('mecanico', 'progreso')).toBe(true);
    expect(canEditWorkOrderField('mecanico', 'observaciones')).toBe(true);
    expect(canEditWorkOrderField('mecanico', 'mecanico_asignado')).toBe(false);
    expect(canEditWorkOrderField('mecanico', 'costo_estimado')).toBe(false);
    expect(canEditWorkOrderField('mecanico', 'prioridad')).toBe(false);
  });

  it('gives planning and management roles assignment and commercial control', () => {
    for (const role of ['jefe_taller', 'coordinador', 'supervisor', 'gerencia'] as const) {
      expect(canEditWorkOrderField(role, 'mecanico_asignado')).toBe(true);
      expect(canEditWorkOrderField(role, 'costo_estimado')).toBe(true);
      expect(canEditWorkOrderField(role, 'prioridad')).toBe(true);
    }
  });

  it('fails closed for missing roles', () => {
    expect(canEditAnyWorkOrderField(null)).toBe(false);
    expect(canEditWorkOrderField(undefined, 'estado')).toBe(false);
  });
});
