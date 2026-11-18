import { afterEach, describe, expect, it, vi } from 'vitest';
import { filterPanamaOrders, readPanamaOrderMaster, unifiedPanamaOrders } from './panama-order-list';
import type { MasterOrder } from './panama-order-list';
import type { WorkOrder } from '../types/workorder';

const native = (changes: Partial<WorkOrder> = {}): WorkOrder => ({ ot_id: 'OT-INTERNAL', folio: 'OT-0100', unidad: 'DZ209',
  fecha: '14/11/2026', tipo_averia: 'Avería', descripcion: 'Alarma activada', severidad: 'MEDIA', prioridad: 'MEDIA',
  mecanico_asignado: '', estado: 'Abierta', foto_url: '', averia_ref: '', partes_necesarias: '', costo_estimado: 0,
  fecha_cierre: '', observaciones: '', progreso: 0, ...changes });
const master: MasterOrder = { id: 'OT-0001', unit: 'DZ203', description: 'Diagnóstico hidráulico', status: 'Abierta', check: 'APERTURA INCOMPLETA' };

afterEach(() => vi.restoreAllMocks());
describe('Una lista de órdenes de Panamá', () => {
  it('conserva las dos órdenes distintas, con búsqueda y filtros comunes', () => {
    const rows = unifiedPanamaOrders([native()], [master]);
    expect(rows.map(row => row.card.ot_id)).toEqual(['OT-0001', 'OT-INTERNAL']);
    expect(filterPanamaOrders(rows, { search: 'hidraulico', status: 'Abierta' })).toHaveLength(1);
    expect(filterPanamaOrders(rows, { priority: 'MEDIA' }).map(row => row.native?.folio)).toEqual(['OT-0100']);
    expect(filterPanamaOrders(rows, { priority: 'unknown' })[0]?.card.ot_id).toBe('OT-0001');
    expect(rows[0]?.card.fecha).toBeUndefined();
    expect(rows[0]?.card.mecanico_asignado).toBeUndefined();
    expect(rows[0]?.card.prioridad).toBeUndefined();
  });
  it('una referencia exacta del mismo equipo se muestra una vez y conserva el estado operativo de Hermes', () => {
    const original = native();
    const rows = unifiedPanamaOrders([original], [{ ...master, id: 'ot-0100', unit: 'dz209', status: 'Cerrada' }]);
    expect(rows).toHaveLength(1); expect(rows[0]?.native).toBe(original); expect(rows[0]?.masters).toHaveLength(1);
    expect(rows[0]?.card.estado).toBe('Abierta'); expect(rows[0]?.notice).toContain('Cerrada');
    expect(filterPanamaOrders(rows, { status: 'Completado' })).toHaveLength(0);
  });
  it('no mezcla dos equipos ni une una referencia ambigua con varias órdenes reales', () => {
    const a = native(), b = native({ ot_id: 'OT-SECOND' });
    const rows = unifiedPanamaOrders([a, b], [{ ...master, id: 'OT-0100', unit: 'DZ209' }, { ...master, id: 'OT-0100', unit: 'EX401' }]);
    expect(rows).toHaveLength(4); expect(rows.filter(row => row.native)).toHaveLength(2);
    expect(rows.find(row => !row.native && row.card.unidad === 'DZ209')?.notice).toContain('conciliar');
    expect(rows.filter(row => row.native).every(row => row.masters.length === 0)).toBe(true);
    expect(rows.filter(row => row.native).map(row => row.detailReference)).toEqual(['OT-INTERNAL', 'OT-SECOND']);
  });
  it('omite copias idénticas pero conserva variantes contradictorias para consulta', () => {
    const rows = unifiedPanamaOrders([], [master, { ...master }, { ...master, status: 'Cerrada', description: 'Otro dato por conciliar' }]);
    expect(rows).toHaveLength(1); expect(rows[0]?.masters).toHaveLength(2);
    expect(rows[0]?.card.estado).toBe('Por conciliar');
    expect(filterPanamaOrders(rows, { status: 'Por verificar' })).toHaveLength(1);
  });
  it('la prioridad divergente se señala y no se copia al registro de Hermes', () => {
    const original = native(); const before = JSON.stringify(original);
    const rows = unifiedPanamaOrders([original], [{ ...master, id: 'OT-0100', unit: 'DZ209', priority: 'CRÍTICO' }]);
    expect(rows[0]?.notice).toContain('CRÍTICO'); expect(rows[0]?.card.prioridad).toBe('MEDIA'); expect(JSON.stringify(original)).toBe(before);
  });
  it('una orden solo del maestro participa en los filtros de cerradas y prioridad sin inventar permisos', () => {
    const rows = unifiedPanamaOrders([], [{ ...master, status: 'Cerrada', priority: 'Alta' }]);
    expect(filterPanamaOrders(rows, { status: 'Completado', priority: 'ALTA' })).toHaveLength(1);
    expect(rows[0]?.native).toBeUndefined();
  });
  it('rechaza proyectos o filas inválidas y trata un corte inválido como desconocido', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch');
    for (const body of [{ project: 'mexico', sections: { orders: [master] } }, { project: 'tmf-panama', sections: { orders: [{ unit: 42 }] } }, { project: 'tmf-panama', sections: { orders: null } }]) {
      fetcher.mockResolvedValueOnce(new Response(JSON.stringify(body)));
      await expect(readPanamaOrderMaster(new AbortController().signal)).rejects.toThrow();
    }
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ project: 'tmf-panama', sections: { orders: [master] }, snapshots: { orders: 'not-a-date' } })));
    await expect(readPanamaOrderMaster(new AbortController().signal)).resolves.toEqual({ rows: [master], capturedAt: null });
  });
});
