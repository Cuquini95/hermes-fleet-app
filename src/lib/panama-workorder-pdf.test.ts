import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { WorkOrder } from '../types/workorder';
import { makeWorkOrderPdf, workOrderDocumentRows } from './panama-workorder-pdf';
import { makePmChecklistPdf, type PrintablePmChecklist } from './panama-pm-checklist-pdf';

const order: WorkOrder = { ot_id: 'OT-PRUEBA', folio: 'OT-0100', fecha: '17/11/2026', unidad: 'DZ01', tipo_averia: 'Mecánica',
  descripcion: 'Prueba ficticia de diagnóstico', severidad: 'ALTA', prioridad: 'ALTA', mecanico_asignado: 'Técnico de prueba',
  estado: 'Abierta', foto_url: '', averia_ref: '', partes_necesarias: 'PART01', costo_estimado: 0, fecha_cierre: '', observaciones: '', progreso: 0 };

describe('Work order and PM print records', () => {
  it('preserves pending approval, equipment identity and unavailable costs instead of inventing completion', () => {
    const rows = workOrderDocumentRows({ order, equipment: { model: 'Komatsu D155AX-6', serial: 'FICTICIA-DZ01' }, history: [] });
    expect(rows).toContainEqual(['Serie / PIN', 'FICTICIA-DZ01']);
    expect(rows).toContainEqual(['Revisión de Taller', 'Pendiente']);
    expect(rows).toContainEqual(['Aceptación de Operaciones', 'Pendiente']);
    expect(rows).toContainEqual(['Costos', 'No incluidos en esta exportación.']);
    expect(rows).not.toContainEqual(['Costos', '0']);
  });

  it('includes recorded reviewers and exact before/after history without changing the order', () => {
    const reviewed: WorkOrder = { ...order, estado: 'Completado',
      technical: { userId: 'reviewer-qa', userName: 'Taller de prueba', acceptedAt: '2026-11-17T20:00:00Z' },
      operations: { userId: 'operations-qa', userName: 'Operaciones de prueba', decision: 'accepted', notes: 'Prueba funcional aceptada', recordedAt: '2026-11-17T21:00:00Z' } };
    const original = structuredClone(reviewed);
    const rows = workOrderDocumentRows({ order: reviewed, history: [{ timestamp: '2026-11-17T20:00:00Z',
      ot_id: reviewed.ot_id, field: 'estado', old_value: 'Resuelta', new_value: 'Completado', changed_by: 'Taller de prueba', role: 'jefe_taller' }] });
    expect(JSON.stringify(rows)).toContain('Antes: Resuelta');
    expect(JSON.stringify(rows)).toContain('Después: Completado');
    expect(JSON.stringify(rows)).toContain('Operaciones de prueba');
    expect(reviewed).toEqual(original);
    const doc = makeWorkOrderPdf({ order: reviewed, history: [], exportedAt: new Date('2026-11-17T23:00:00Z') });
    expect(doc.getNumberOfPages()).toBeGreaterThan(0);
    expect(doc.getNumberOfPages()).toBeLessThan(5);
    if (process.env.HERMES_PDF_QA_DIR) {
      mkdirSync(process.env.HERMES_PDF_QA_DIR, { recursive: true });
      writeFileSync(join(process.env.HERMES_PDF_QA_DIR, 'OT-0100.pdf'), Buffer.from(doc.output('arraybuffer')));
    }
  });

  it('generates three cumulative PM copies with identity, revision and review status', () => {
    const base = { unit: 'DZ01', model: 'Komatsu D155AX-6', serial: 'FICTICIA-DZ01', identityVerified: true,
      sheet: 'Plan ficticio', capturedAt: '2026-11-17T20:00:00Z', approved: false, revision: 'ficticia-rev-01', folio: 'OT-0100' };
    for (const hours of [250, 1000]) {
      const value: PrintablePmChecklist = { ...base, hours, sections: [
        { title: 'PREPARACIÓN', tasks: [{ id: '1', label: 'Preparación ficticia', reference: '', observation: '' }] },
        ...[250, 500, 1000].filter(level => level <= hours).map(level => ({ title: `PM ${level}`, tasks: [{ id: String(level), label: `Tarea ficticia ${level}`, reference: '', observation: '' }] })),
        { title: 'CIERRE', tasks: [{ id: '2', label: 'Cierre ficticio', reference: '', observation: '' }] },
      ] };
      for (let repeat = 1; repeat <= 3; repeat++) {
        const doc = makePmChecklistPdf(value);
        expect(doc.getNumberOfPages()).toBe(1);
        if (process.env.HERMES_PDF_QA_DIR) {
          mkdirSync(process.env.HERMES_PDF_QA_DIR, { recursive: true });
          writeFileSync(join(process.env.HERMES_PDF_QA_DIR, `DZ01-${hours}-${repeat}.pdf`), Buffer.from(doc.output('arraybuffer')));
        }
      }
    }
  });
});
