import { describe, expect, it } from 'vitest';
import { reconcileWorkshopExceptions, type WorkshopExceptionRecord } from './panama-workshop-exceptions';

const order: WorkshopExceptionRecord = {
  id: 'OT-EXCEPTION-QA', unit: 'DZ203', state: 'active', kind: 'critical',
  folio: 'OT-0892', owner: 'Mecánico QA', status: 'En Reparación', description: '', dueHours: 1500,
};
const resolved = { id: order.id, unit: order.unit, state: 'resolved' as const };
const cut = (minute: string, records: WorkshopExceptionRecord[], units: string[] | null = null) => ({
  observedAt: `2026-11-16T02:${minute}:00.000Z`, records, units,
});

describe('excepciones confirmadas por la OT de origen', () => {
  it('retiene el aviso cuando falta la fila y lo retira con el cierre explícito en una consulta posterior', () => {
    const first = reconcileWorkshopExceptions(undefined, cut('00', [order]));
    const missing = reconcileWorkshopExceptions(first, cut('01', []));
    expect(missing?.alerts).toEqual([{ ...order, pendingConfirmation: true }]);
    const unknown = reconcileWorkshopExceptions(missing, cut('02', [{ ...resolved, state: 'unknown' }]));
    expect(unknown?.alerts).toEqual(missing?.alerts);
    const close = reconcileWorkshopExceptions(unknown, cut('03', [resolved]));
    expect(close?.alerts).toEqual([]);
  });

  it('un corte viejo o repetido no borra un aviso ni reincorpora un cierre ya confirmado', () => {
    const first = reconcileWorkshopExceptions(undefined, cut('02', [order]));
    expect(reconcileWorkshopExceptions(first, cut('01', [resolved]))).toBe(first);
    expect(reconcileWorkshopExceptions(first, cut('02', [resolved]))).toBe(first);
    const closed = reconcileWorkshopExceptions(first, cut('03', [resolved]));
    expect(reconcileWorkshopExceptions(closed, cut('02', [order]))).toBe(closed);
  });

  it('el cambio de alcance limpia el aviso aunque el OT anterior no se incluya en la consulta', () => {
    const first = reconcileWorkshopExceptions(undefined, cut('02', [order]));
    const scopeChanged = reconcileWorkshopExceptions(first, cut('03', [], ['EX401']));
    expect(scopeChanged?.alerts).toEqual([]);
  });
});
