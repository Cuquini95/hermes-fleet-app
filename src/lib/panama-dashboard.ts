import type { FleetDispatch } from '../hooks/useFleetDispatch';
import type { Equipment } from '../types/equipment';
import { mexicoDateInput } from './date-utils';
import { normalizeUnitId } from './dispatch-readiness';
import type { PmReview } from './panama-pm-review';
import type { WorkshopExceptionView } from './panama-workshop-exceptions';
import type { PurchaseRequestLine } from './purchasing-api';

export type PendingFilter = 'all' | 'stopped' | 'unassigned' | 'pm' | 'parts';
type PendingKind = 'stopped' | 'assignment' | 'pm' | 'parts' | 'critical' | 'return';

interface PendingDate { day: string; label: 'Apertura' | 'Reporte' }

export interface DashboardPending {
  id: string;
  unit: string;
  kind: PendingKind;
  title: string;
  detail?: string;
  owner: string;
  href: string;
  action: string;
  date?: PendingDate;
  purchaseHref?: string;
  unassigned?: boolean;
  unverified?: boolean;
  priority: number;
}

const orderPriority = { return: 0, critical: 1, parts: 2, assignment: 3 };
const stoppedStatus = /^(detenido reportado|en reparaci[oó]n|esperando pieza)$/i;
const dayFormat = new Intl.DateTimeFormat('es-PA', { dateStyle: 'medium', timeZone: 'UTC' });

export function pendingAge(day: string, now = new Date()): string | null {
  const start = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(+start) || start.toISOString().slice(0, 10) !== day) return null;
  const age = (+new Date(`${mexicoDateInput(now)}T00:00:00Z`) - +start) / 86_400_000;
  if (age < 0) return null;
  return age === 0 ? 'Hoy' : age === 1 ? 'Hace 1 día' : `Hace ${age} días`;
}

export function pendingDateLabel(day: string) {
  return dayFormat.format(new Date(`${day}T00:00:00Z`));
}

export function isPendingFilter(item: DashboardPending, filter: PendingFilter) {
  if (filter === 'all') return true;
  if (filter === 'unassigned') return item.unassigned === true;
  return item.kind === filter;
}

export function pmReviewIsComplete(review: PmReview) {
  return review.catalog.available && ['fleet', 'maintenance', 'maintenancePlan', 'equipmentDetails']
    .every(name => review.sources[name]?.available);
}

function hasPendingPurchase(lines: PurchaseRequestLine[], unit: string, reference: string) {
  return lines.some(line => line.ot?.trim().toUpperCase() === reference && normalizeUnitId(line.equipo) === unit
    && !line.allocationReview && (line.estado === 'Pendiente' || line.estado === 'Pedido')
    && (!line.receivedQuantity || Number(line.receivedQuantity) < Number(line.cantidad)));
}

export function panamaDashboardPendings({ equipment, dispatch, fleetVerified, orders, ordersUnavailable,
  review, purchases }: {
  equipment: Equipment[];
  dispatch: FleetDispatch;
  fleetVerified: boolean;
  orders?: WorkshopExceptionView;
  ordersUnavailable: boolean;
  review?: PmReview;
  purchases: PurchaseRequestLine[];
}): DashboardPending[] {
  const rows: DashboardPending[] = [];
  for (const equipmentRow of equipment) {
    const unit = normalizeUnitId(equipmentRow.unit_id);
    if (dispatch.operatingStatuses?.get(unit) !== 'inoperativo') continue;
    const reported = dispatch.workshop?.failures.records
      .filter(row => row.unit === unit && row.date && !row.needsReview && stoppedStatus.test(row.status))
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0];
    const restriction = dispatch.readiness.get(unit);
    rows.push({
      id: `fleet:${unit}`, unit, kind: 'stopped', title: 'Equipo inoperativo',
      detail: restriction?.reason ?? equipmentRow.model, owner: 'Operaciones / Taller',
      href: `/fleet?${new URLSearchParams({ unit })}`, action: 'Ver equipo',
      date: reported?.date ? { day: reported.date, label: 'Reporte' } : undefined,
      unverified: !fleetVerified, priority: 4,
    });
  }

  for (const order of orders?.alerts ?? []) {
    const closedForReview = /^resuelt[ao]$/i.test(order.status);
    const titles = { critical: 'OT crítica', assignment: 'OT sin asignar', parts: 'Esperando repuesto', return: 'Retorno pendiente' };
    const actions = { critical: closedForReview ? 'Revisar cierre técnico' : 'Revisar OT', assignment: 'Revisar asignación',
      parts: 'Ver OT y repuesto', return: 'Revisar retorno' };
    const responsible = { critical: 'Taller', parts: 'Taller / Almacén', assignment: 'Taller · por asignar', return: 'Operaciones' };
    const reference = order.folio.trim().toUpperCase();
    const purchaseHref = order.kind === 'parts' && !order.pendingConfirmation && !ordersUnavailable
      && hasPendingPurchase(purchases, order.unit, reference)
      ? `/pedidos?${new URLSearchParams({ otPedido: reference, equipo: order.unit })}` : undefined;
    rows.push({
      id: `order:${order.unit}:${order.id}`, unit: order.unit, kind: order.kind, title: titles[order.kind],
      detail: [order.folio, order.description].filter(Boolean).join(' · '),
      owner: order.owner ?? responsible[order.kind],
      href: `/workorders/${encodeURIComponent(order.id)}`,
      action: order.unassigned && order.kind === 'critical' ? 'Revisar asignación' : actions[order.kind],
      date: order.openedOn ? { day: order.openedOn, label: 'Apertura' } : undefined,
      purchaseHref, unassigned: order.unassigned, unverified: order.pendingConfirmation || ordersUnavailable,
      priority: order.critical && order.kind === 'parts' ? orderPriority.critical : orderPriority[order.kind],
    });
  }

  for (const plan of review?.rows ?? []) {
    if (!plan.issues.length) continue;
    const detail = plan.issues[0]?.label;
    const more = plan.issues.length - 1;
    rows.push({
      id: `pm:${plan.unit}`, unit: plan.unit, kind: 'pm', title: 'Plan PM por revisar',
      detail: more > 0 ? `${detail} · +${more}` : detail, owner: 'Planificación / Taller',
      href: `/pm?${new URLSearchParams({ vista: 'revisar', equipo: plan.unit })}`,
      action: 'Revisar plan', priority: 5,
    });
  }
  return rows.sort((a, b) => Number(Boolean(a.unverified)) - Number(Boolean(b.unverified))
    || a.priority - b.priority
    || (a.date?.day ?? '9999').localeCompare(b.date?.day ?? '9999')
    || a.unit.localeCompare(b.unit, 'es', { numeric: true }));
}
