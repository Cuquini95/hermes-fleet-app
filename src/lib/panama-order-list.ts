import type { WorkOrder } from '../types/workorder';
import { hermesApiUrl } from './hermes-api-base';

export interface MasterOrder {
  id?: string; unit: string; description?: string; status?: string; priority?: string; check?: string;
}
export interface OrderCardData {
  ot_id: string; folio?: string; unidad: string; descripcion: string; prioridad?: string; estado: string;
  fecha?: string; mecanico_asignado?: string;
}
export interface ListedOrder {
  key: string; card: OrderCardData; native?: WorkOrder; detailReference?: string; masters: MasterOrder[]; notice?: string;
}
export type OrderListStatus = 'Abierta' | 'En Reparación' | 'Esperando Pieza' | 'Resuelta' | 'Completado' | 'Por verificar';
const clean = (value: string | undefined) => (value ?? '').trim();
const key = (value: string | undefined) => clean(value).normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').toUpperCase();
export function orderListPriority(value?: string): string | undefined {
  const normalized = key(value).replace(/^CRITICO$/, 'CRITICA');
  return ['CRITICA', 'ALTA', 'MEDIA', 'BAJA'].includes(normalized) ? normalized : undefined;
}
export function orderListStatus(value?: string): OrderListStatus {
  const normalized = key(value);
  if (['ABIERTA', 'ABIERTO', 'EN ESPERA DE ASIGNACION'].includes(normalized)) return 'Abierta';
  if (['EN REPARACION', 'EN PROCESO'].includes(normalized)) return 'En Reparación';
  if (['ESPERANDO PIEZA', 'ESPERANDO REPUESTO'].includes(normalized)) return 'Esperando Pieza';
  if (normalized === 'RESUELTA') return 'Resuelta';
  if (['COMPLETADO', 'COMPLETADA', 'CERRADA', 'CERRADO'].includes(normalized)) return 'Completado';
  return 'Por verificar';
}
const meaningfulCheck = (value?: string) => Boolean(clean(value)) && !['OK', 'COMPLETA', 'COMPLETO', 'SIN OBSERVACIONES'].includes(key(value));

export function masterOrderHref(unit: string, reference?: string): string {
  return `/workorders/maestro/${encodeURIComponent(unit.trim().toUpperCase())}?${new URLSearchParams({ ref: clean(reference) })}`;
}

export function nativeOrderForReference(orders: WorkOrder[], unit: string, reference: string): WorkOrder | undefined {
  if (!key(reference)) return undefined;
  const matches = orders.filter(row => key(row.unidad) === key(unit) && [key(row.folio), key(row.ot_id)].includes(key(reference)));
  return matches.length === 1 ? matches[0] : undefined;
}

export function masterOrderForReference(rows: MasterOrder[], unit: string, reference: string): ListedOrder | undefined {
  if (!key(reference)) return undefined;
  return unifiedPanamaOrders([], rows.filter(row => key(row.unit) === key(unit) && key(row.id) === key(reference)))[0];
}

export function masterOrderNotes(rows: MasterOrder[]): string[] {
  const notes = new Set<string>();
  for (const row of rows) for (const part of (row.check ?? '').split(/[·|\n]+/).map(value => value.trim()).filter(Boolean)) {
    if (!meaningfulCheck(part)) continue;
    if (key(part) === 'APERTURA INCOMPLETA') notes.add('Datos de apertura incompletos.');
    else {
      const age = /^OT ABIERTA\s*>\s*(\d+)\s*DIAS$/.exec(key(part));
      notes.add(age ? `El maestro señala más de ${age[1]} días abierta.` : part);
    }
  }
  return [...notes];
}

// Match only an exact reference on the same unit. Text similarity never proves that two orders are one.
export function unifiedPanamaOrders(operational: WorkOrder[], master: MasterOrder[]): ListedOrder[] {
  const folios = new Map<string, number>();
  for (const row of operational) if (key(row.folio)) folios.set(key(row.folio), (folios.get(key(row.folio)) ?? 0) + 1);
  const rows: ListedOrder[] = operational.map((native, index) => ({ key: `hermes:${key(native.unidad)}:${native.ot_id}:${index}`, card: native, native,
    detailReference: native.folio && folios.get(key(native.folio)) === 1 ? native.folio : native.ot_id, masters: [] }));
  const aliases = new Map<string, Set<number>>();
  operational.forEach((row, index) => {
    for (const reference of new Set([key(row.folio), key(row.ot_id)])) {
      if (!reference) continue;
      const alias = `${key(row.unidad)}\0${reference}`, matches = aliases.get(alias) ?? new Set<number>();
      matches.add(index); aliases.set(alias, matches);
    }
  });
  const groups = new Map<string, MasterOrder[]>();
  master.forEach((row, index) => {
    const reference = key(row.id), groupKey = `${key(row.unit)}\0${reference || `missing:${index}`}`;
    const group = groups.get(groupKey) ?? [];
    const fingerprint = JSON.stringify([key(row.id), key(row.unit), clean(row.description), key(row.status), key(row.priority), clean(row.check)]);
    if (!group.some(prior => JSON.stringify([key(prior.id), key(prior.unit), clean(prior.description), key(prior.status), key(prior.priority), clean(prior.check)]) === fingerprint)) group.push(row);
    groups.set(groupKey, group);
  });
  for (const [groupKey, group] of groups) {
    const first = group[0]!;
    const matches = key(first.id) ? aliases.get(groupKey) : undefined;
    if (matches?.size === 1) {
      const row = rows[[...matches][0]!]!;
      row.masters.push(...group);
      const mismatch = group.find(source => orderListStatus(source.status) !== orderListStatus(row.card.estado));
      const priorityMismatch = group.find(source => orderListPriority(source.priority) && orderListPriority(row.card.prioridad)
        && orderListPriority(source.priority) !== orderListPriority(row.card.prioridad));
      if (mismatch) row.notice = `Estado en el maestro: ${clean(mismatch.status) || 'sin dato'}. Por conciliar.`;
      else if (priorityMismatch) row.notice = `Prioridad en el maestro: ${clean(priorityMismatch.priority)}. Por conciliar.`;
      else if (group.length > 1 || group.some(source => meaningfulCheck(source.check))) row.notice = 'Datos del maestro por revisar.';
      continue;
    }
    const statuses = new Set(group.map(row => key(row.status)));
    const priorities = new Set(group.map(row => orderListPriority(row.priority)));
    const priority = priorities.size === 1 ? orderListPriority(first.priority) : undefined;
    const status = statuses.size === 1 ? clean(first.status) || 'Por verificar' : 'Por conciliar';
    rows.push({ key: `master:${groupKey}`, masters: group,
      card: { ot_id: clean(first.id), unidad: key(first.unit), descripcion: clean(first.description) || 'Trabajo sin descripción', estado: status, prioridad: priority },
      ...(matches?.size || group.length > 1 ? { notice: 'Referencia del maestro por conciliar.' }
        : group.some(row => meaningfulCheck(row.check)) ? { notice: 'Datos del maestro por revisar.' } : {}),
    });
  }
  return rows.sort((a, b) => key(a.card.unidad).localeCompare(key(b.card.unidad), 'es', { numeric: true })
    || key(a.card.folio ?? a.card.ot_id).localeCompare(key(b.card.folio ?? b.card.ot_id), 'es', { numeric: true }));
}

export function filterPanamaOrders(rows: ListedOrder[], { search = '', priority = '', status = '' } = {}) {
  const term = key(search);
  return rows.filter(row => (!priority || (priority === 'unknown' ? !orderListPriority(row.card.prioridad) : orderListPriority(row.card.prioridad) === priority))
    && (!status || orderListStatus(row.card.estado) === status)
    && (!term || key([row.card.unidad, row.card.folio, row.card.ot_id, row.card.descripcion,
      row.card.mecanico_asignado, ...row.masters.flatMap(master => [master.id, master.description])].filter(Boolean).join(' ')).includes(term)));
}

export async function readPanamaOrderMaster(signal: AbortSignal): Promise<{ rows: MasterOrder[]; capturedAt: string | null }> {
  const response = await fetch(hermesApiUrl('/api/panama/summary?sections=orders'), { credentials: 'same-origin', cache: 'no-store', signal });
  if (!response.ok) throw new Error('No se pudo consultar el Maestro de Taller.');
  const data = await response.json();
  const rows = data?.sections?.orders;
  if (data?.project !== 'tmf-panama' || !Array.isArray(rows) || !rows.every(row => row && typeof row === 'object'
    && typeof row.unit === 'string' && row.unit.trim() && ['id', 'description', 'status', 'priority', 'check'].every(field => row[field] === undefined || typeof row[field] === 'string'))) {
    throw new Error('No se pudo verificar la lista del Maestro de Taller.');
  }
  const cut = data.snapshots?.orders;
  return { rows, capturedAt: typeof cut === 'string' && Number.isFinite(Date.parse(cut)) ? cut : null };
}
