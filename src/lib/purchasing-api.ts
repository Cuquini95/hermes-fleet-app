export interface PurchaseIssuer {
  id: string;
  name: string;
  currency: string;
  address: string;
  phone: string;
  taxId?: string;
  taxBps: number;
  taxLabel: string;
  template: 'ultratk' | 'transplus';
}

export interface PurchaseVendor {
  name: string;
  rfc: string;
  address: string;
}

export interface PurchaseReceipt {
  id: string;
  at: string;
  by: string;
  actorId: string;
  quantity: string;
  reference: string;
}

export interface PurchaseLine {
  id: string;
  number: string;
  description: string;
  quantity: string;
  unitPrice: string;
  total: string;
  partNumber: string;
  requestId: string;
  requestLineId: string;
  received: string;
  receipts: PurchaseReceipt[];
}

export interface PurchaseOrder {
  folio: string;
  date: string;
  deliveryDate: string;
  vendorName: string;
  vendorRfc: string;
  vendorAddress: string;
  unit: string;
  subtotal: string;
  tax: string;
  shipping: string;
  other: string;
  total: string;
  status: string;
  receiptStatus: string;
  comments: string;
  issuer: PurchaseIssuer | null;
  approvedBy: string;
  approvedById: string;
  approvedAt: string;
  requestedBy: string;
  version: string;
  lines: PurchaseLine[];
}

export interface PurchaseRequestLine {
  id: string;
  version: string;
  pedidoId: string;
  fecha: string;
  hora: string;
  solicitante: string;
  partNum: string;
  descripcion: string;
  equipo: string;
  cantidad: string;
  precioUnit: string;
  unitPrice: string;
  total: string;
  urgencia: string;
  fuente: string;
  notas: string;
  estado: string;
  ocFolio: string;
}

export interface PurchaseOverview {
  orders: PurchaseOrder[];
  vendors: PurchaseVendor[];
  issuers: PurchaseIssuer[];
  orphanFolios: string[];
  canApprove: boolean;
}

const BASE = '/hermes-api/api/purchasing/';
const pending = new Map<string, string>();
let sessionOwner = '';
let sessionGeneration = 0;
const receiptUploadPath = String(import.meta.env.VITE_HERMES_EXPENSE_RECEIPT_UPLOAD_PATH ?? '');
export const canAttachExpenseReceipt = /^\/(?!\/)[a-zA-Z0-9/_-]+$/.test(receiptUploadPath);

export function setPurchaseSession(owner: string) {
  if (sessionOwner === owner) return;
  sessionOwner = owner;
  sessionGeneration++;
  pending.clear();
}

export class PurchaseApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const message = data?.error || 'No se pudo confirmar la operación. Reintenta con los mismos datos.';
    throw new PurchaseApiError(response.status, message);
  }
  return data as T;
}

export async function purchaseRead<T>(action: string, query?: Record<string, string>, signal?: AbortSignal): Promise<T> {
  const url = BASE + action + (query ? '?' + new URLSearchParams(query) : '');
  return readResponse<T>(await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal }));
}

function storedOperation(key: string): string | undefined {
  try {
    return sessionStorage.getItem(key) || pending.get(key);
  } catch {
    return pending.get(key);
  }
}

/** Keep the same operation after an interrupted response or a page reload. */
export async function purchaseWrite<T>(action: string, body: object): Promise<T> {
  const generation = sessionGeneration;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(body)));
  if (generation !== sessionGeneration) throw new DOMException('Cambió la sesión', 'AbortError');
  const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const key = 'hermes:purchase:' + sessionOwner + ':' + action + ':' + fingerprint;
  const operationId = storedOperation(key) || crypto.randomUUID();
  pending.set(key, operationId);
  try { sessionStorage.setItem(key, operationId); } catch { /* use the in-memory key */ }
  const response = await fetch(BASE + action, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, operationId }),
  });
  const data = await readResponse<T>(response);
  pending.delete(key);
  try { sessionStorage.removeItem(key); } catch { /* already cleared in memory */ }
  return data;
}

export function purchaseOrder(folio: string, signal?: AbortSignal) {
  return purchaseRead<{ order: PurchaseOrder }>('order', { folio }, signal);
}

export function purchaseRequests(signal?: AbortSignal) {
  return purchaseRead<{ items: PurchaseRequestLine[] }>('requests', undefined, signal);
}

export async function uploadExpenseReceipt(file: File, operationId: string) {
  if (!canAttachExpenseReceipt) throw new Error('Adjuntos de Gastos pendientes de activar.');
  const generation = sessionGeneration;
  const body = new FormData();
  body.set('file', file);
  body.set('operationId', operationId);
  const response = await fetch(receiptUploadPath, { method: 'POST', credentials: 'same-origin', body });
  const { receiptUrl } = await readResponse<{ receiptUrl: string }>(response);
  if (generation !== sessionGeneration) throw new DOMException('Cambió la sesión', 'AbortError');
  if (!/^https:\/\//.test(receiptUrl)) throw new Error('No se confirmó el adjunto del recibo.');
  return receiptUrl;
}

export function displayMoney(value: string | number, currency = 'MXN') {
  const amount = Number(String(value).replace(/[$,\s]/g, ''));
  if (!Number.isFinite(amount)) return '—';
  return amount.toLocaleString('es-MX', {
    style: 'currency', currency, currencyDisplay: 'code', minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

export function pendingQuantity(line: Pick<PurchaseLine, 'quantity' | 'received'>) {
  return Math.max(0, Math.round((Number(line.quantity) - Number(line.received)) * 1000) / 1000);
}

export function isApprovalRecorded(order: Pick<PurchaseOrder, 'status' | 'approvedBy' | 'approvedById' | 'approvedAt'>) {
  return ['Aprobada', 'Recibida parcial', 'Recibida', 'Pagada'].includes(order.status)
    && Boolean(order.approvedBy.trim() && order.approvedById.trim() && order.approvedAt.trim())
    && Number.isFinite(Date.parse(order.approvedAt));
}
