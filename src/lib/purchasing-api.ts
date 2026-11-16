import { uploadEvidence } from './evidence-upload';

export interface InventoryMovement {
  id: string;
  at: string;
  kind: string;
  partNumber: string;
  quantity: string;
  unit: string;
  order: string;
  orderNumber?: string;
  ot: string;
  otFolio?: string;
  reference: string;
  by: string;
  stockAfter: string;
  measurementUnit: string;
  originalIssueId?: string;
  warehouse?: string;
  reservationId?: string;
  dispatchId?: string;
  returnable?: string | null;
  valuation?: { unitCost: string; currency: string; reference: string; delta: string } | null;
}

export interface PurchaseIssuer {
  id: string;
  name: string;
  currency: string;
  address: string;
  phone: string;
  taxId?: string;
  taxBps?: number;
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
  stockDisposition?: 'posted' | 'unregistered' | 'document';
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
  ot?: string;
  received: string;
  receipts: PurchaseReceipt[];
}

export interface PurchaseReconciliation {
  reference: string;
  amount: string;
  currency: string;
  at: string;
  by: string;
  actorId: string;
  invoiceReference?: string;
  match?: {
    tax: string;
    lines: { lineId: string; quantity: string; unitPrice: string; receiptIds: string[]; receiptEvidence: string[] }[];
  };
}

export interface PurchaseOrder {
  folio: string;
  number?: string;
  date: string;
  deliveryDate: string;
  vendorName: string;
  vendorRfc: string;
  vendorAddress: string;
  vendorSource?: 'catalog' | 'manual';
  unit: string;
  subtotal: string;
  discount?: string;
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
  approvalReason?: string;
  invoice?: PurchaseReconciliation | null;
  invoiceReconciled?: boolean;
  payment?: PurchaseReconciliation | null;
  version: string;
  lines: PurchaseLine[];
}

export interface PurchaseDocument {
  order: PurchaseOrder;
  approvalSignature?: string;
  canSign?: boolean;
  usesRegisteredSignature?: boolean;
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
  ocNumber?: string;
  ot?: string;
  requiredDate?: string;
  equipmentSerial?: string;
  allocationReview?: boolean;
  allocatedQuantity?: string;
  receivedQuantity?: string;
  unallocatedQuantity?: string;
  allocations?: { folio: string; number?: string; vendor: string; quantity: string; received: string; status: string }[];
}

export function canAwardRequest(line: PurchaseRequestLine) {
  return !line.allocationReview && line.estado !== 'Completado'
    && (line.unallocatedQuantity === undefined ? !line.ocFolio : Number(line.unallocatedQuantity) > 0);
}

export interface PurchaseOverview {
  orders: PurchaseOrder[];
  vendors: PurchaseVendor[];
  issuers: PurchaseIssuer[];
  orphanFolios: string[];
  canApprove: boolean;
  usesRegisteredSignature?: boolean;
  canRecordInvoice?: boolean;
  canRecordPayment?: boolean;
}

export type PurchaseReceivingLine = Pick<PurchaseLine, 'id' | 'number' | 'description' | 'partNumber' | 'quantity' | 'received'> & {
  receipts: Omit<PurchaseReceipt, 'actorId'>[];
  warehouse?: string;
  warehouses?: string[];
  dispatches?: { id: string; reference: string; remaining: string }[];
  dispatchReview?: boolean;
};

export interface WarehouseStock {
  partNumber: string;
  description: string;
  oem: string;
  warehouse: string;
  measure: string;
  minimum: string | null;
  physical: string | null;
  reserved: string | null;
  available: string | null;
  inTransit: string | null;
  review?: string;
  reservations: { id: string; unit: string; ot: string; folio?: string; reference: string; remaining: string }[];
}

export type WorkOrderStock = Omit<WarehouseStock, 'reservations'> & { reservedForOt: string | null };

export interface WorkOrderPartContext {
  ot: string;
  folio: string;
  unit: string;
  serial: string;
  partNumber?: string;
  match?: 'verified' | 'ambiguous' | 'unverified';
  items?: WorkOrderStock[];
  transitScoped?: boolean;
}

export type PurchaseReceivingOrder = Pick<PurchaseOrder, 'folio' | 'number' | 'unit' | 'vendorName' | 'deliveryDate' | 'receiptStatus' | 'version'> & {
  lines: PurchaseReceivingLine[];
};

const BASE = '/hermes-api/api/purchasing/';
const pending = new Map<string, string>();
let sessionOwner = '';
let sessionGeneration = 0;
const receiptUploadPath = String(import.meta.env.VITE_HERMES_EXPENSE_RECEIPT_UPLOAD_PATH ?? '');
const legacyReceiptUpload = /^\/(?!\/)[a-zA-Z0-9/_-]+$/.test(receiptUploadPath);
export const canAttachExpenseReceipt = (project: string) => project === 'tmf-panama' || legacyReceiptUpload;

export const panamaApPendingKey = (owner: string) => 'hermes:panama:ap:' + owner;

export function setPurchaseSession(owner: string) {
  if (sessionOwner === owner) return;
  if (sessionOwner) {
    try { sessionStorage.removeItem(panamaApPendingKey(sessionOwner)); } catch { /* Session storage can be disabled. */ }
  }
  sessionOwner = owner;
  sessionGeneration++;
  pending.clear();
}

export class PurchaseApiError extends Error {
  status: number;
  readonly confirmationPending: boolean;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.confirmationPending = status < 400 || status >= 500 || status === 408;
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
export async function purchaseWrite<T>(
  action: string,
  body: object,
  attachmentOperationId?: string,
  confirm?: (data: T) => boolean | undefined,
): Promise<T> {
  const generation = sessionGeneration;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(body)));
  if (generation !== sessionGeneration) throw new DOMException('Cambió la sesión', 'AbortError');
  const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const key = 'hermes:purchase:' + sessionOwner + ':' + action + ':' + fingerprint;
  const operationId = attachmentOperationId || storedOperation(key) || crypto.randomUUID();
  pending.set(key, operationId);
  try { sessionStorage.setItem(key, operationId); } catch { /* use the in-memory key */ }
  const response = await fetch(BASE + action, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, operationId, ...(sessionOwner && { expectedUserId: sessionOwner }) }),
    ...(action === 'expense-save' && { signal: AbortSignal.timeout(25_000) }),
  });
  const data = await readResponse<T>(response);
  if (confirm && !confirm(data)) throw new PurchaseApiError(response.status, 'No se pudo confirmar el folio del gasto.');
  pending.delete(key);
  try { sessionStorage.removeItem(key); } catch { /* already cleared in memory */ }
  return data;
}

export function purchaseOrder(folio: string, signal?: AbortSignal) {
  return purchaseRead<PurchaseDocument>('order', { folio }, signal);
}

export function purchaseRequests(signal?: AbortSignal) {
  return purchaseRead<{ items: PurchaseRequestLine[] }>('requests', undefined, signal);
}

export async function uploadExpenseReceipt(file: File, operationId: string, units: string[], project: string, expectedUserId: string) {
  if (!canAttachExpenseReceipt(project)) throw new Error('Adjuntos de Gastos pendientes de activar.');
  const generation = sessionGeneration;
  if (project === 'tmf-panama') {
    const url = await uploadEvidence(file, { kind: 'receipt', units, operationId, expectedUserId, slot: 0 });
    if (generation !== sessionGeneration) throw new DOMException('Cambió la sesión', 'AbortError');
    return url;
  }
  const body = new FormData();
  body.set('file', file);
  body.set('operationId', operationId);
  const response = await fetch(receiptUploadPath, { method: 'POST', credentials: 'same-origin', body });
  const { receiptUrl } = await readResponse<{ receiptUrl: string }>(response);
  if (generation !== sessionGeneration) throw new DOMException('Cambió la sesión', 'AbortError');
  if (!/^https:\/\//.test(receiptUrl)) throw new Error('No se confirmó el adjunto del recibo.');
  return receiptUrl;
}

export function displayMoney(value: string | number, currency = 'USD') {
  const amount = Number(String(value).replace(/[$,\s]/g, ''));
  if (!Number.isFinite(amount)) return '—';
  return amount.toLocaleString('es-MX', {
    style: 'currency', currency, currencyDisplay: 'code', minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

export function pendingQuantity(line: Pick<PurchaseLine, 'quantity' | 'received'>) {
  return Math.max(0, Math.round((Number(line.quantity) - Number(line.received)) * 1000) / 1000);
}

const panamaReceiptDate = new Intl.DateTimeFormat('es-PA', {
  year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Panama',
});

export function formatPanamaReceiptDate(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? panamaReceiptDate.format(time) : value;
}

export function isApprovalRecorded(order: Pick<PurchaseOrder, 'status' | 'approvedBy' | 'approvedById' | 'approvedAt'>) {
  return ['Aprobada', 'Recibida parcial', 'Recibida', 'Pagada'].includes(order.status)
    && Boolean(order.approvedBy.trim() && order.approvedById.trim() && order.approvedAt.trim())
    && Number.isFinite(Date.parse(order.approvedAt));
}
