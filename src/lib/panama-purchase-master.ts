import { hermesApiUrl } from './hermes-api-base';
import { PurchaseApiError } from './purchasing-api';

export interface MasterPurchase {
  id: string;
  unit: string;
  description?: string;
  status?: string;
  amount?: string;
  currency?: string;
  order?: string;
  check?: string;
}

export interface PurchaseMaster {
  rows: MasterPurchase[];
  capturedAt: string | null;
}

const open = new Set([
  'PENDIENTE', 'POR COTIZAR', 'EN COTIZACION', 'COTIZADA', 'COTIZADO',
  'EN REVISION', 'POR APROBAR', 'POR COMPRAR', 'APROBADA', 'APROBADO',
  'PEDIDO', 'PEDIDA', 'EN COMPRA', 'ORDENADA', 'ORDENADO', 'OC EMITIDA',
  'EN TRANSITO', 'POR RECIBIR', 'RECEPCION PARCIAL', 'RECIBIDA PARCIAL', 'ENTREGA PARCIAL',
]);
const closed = new Set([
  'ENTREGADA', 'ENTREGADO', 'RECIBIDA', 'RECIBIDO', 'RECEPCION COMPLETA',
  'RECIBIDA TOTAL', 'RECIBIDO TOTAL', 'RECIBIDA COMPLETA', 'RECIBIDO COMPLETO',
  'COMPLETADA', 'COMPLETADO', 'CERRADA', 'CERRADO', 'CANCELADA', 'CANCELADO',
  'ANULADA', 'ANULADO', 'RECHAZADA', 'RECHAZADO', 'PAGADA', 'PAGADO',
]);

export function masterPurchaseState(status = ''): 'open' | 'closed' | 'unknown' {
  const value = status.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').toUpperCase();
  if (closed.has(value)) return 'closed';
  return open.has(value) || value.startsWith('PENDIENTE DE ') ? 'open' : 'unknown';
}

function isMasterPurchase(value: unknown): value is MasterPurchase {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string' && Boolean(row.id.trim()) && typeof row.unit === 'string' && Boolean(row.unit.trim())
    && ['description', 'status', 'amount', 'currency', 'order', 'check'].every(key => row[key] === undefined || typeof row[key] === 'string');
}

export async function readPanamaPurchaseMaster(signal: AbortSignal): Promise<PurchaseMaster> {
  const response = await fetch(hermesApiUrl('/api/panama/summary?sections=purchases'), {
    credentials: 'same-origin', cache: 'no-store', signal,
  });
  if (!response.ok) throw new PurchaseApiError(response.status, 'Maestro de Compras no disponible');
  const data = await response.json();
  const rows = data?.sections?.purchases;
  if (data?.project !== 'tmf-panama' || !Array.isArray(rows) || !rows.every(isMasterPurchase)) {
    throw new Error('Maestro de Compras no disponible');
  }
  const cut = data?.snapshots?.purchases;
  return { rows, capturedAt: typeof cut === 'string' && Number.isFinite(Date.parse(cut)) ? cut : null };
}
