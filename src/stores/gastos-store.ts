import { create } from 'zustand';
import { purchaseRead, purchaseWrite } from '../lib/purchasing-api';
import type { OcrLineItem } from '../lib/sheets-api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type GastoTipo = 'Refaccion' | 'Combustible' | 'Servicio' | 'Otro';
export type GastoStatus = 'Pendiente' | 'Borrador' | 'Aprobado' | 'Rechazado' | 'Eliminado';
export type MetodoPago = 'Efectivo' | 'Transferencia' | 'Tarjeta';

// Single flat row per receipt — stored in the "Gastos" tab
// A  Gasto_ID | B Fecha | C Hora | D Tipo | E Proveedor | F RFC_Proveedor
// G  Folio_Factura | H Subtotal | I IVA | J Total | K Unidad | L OT_ID
// M  Solicitante | N Metodo_Pago | O Items | P Imagen_URL | Q Status
export interface GastoCompra {
  gasto_id: string;
  fecha: string;
  hora: string;
  tipo: GastoTipo;
  proveedor: string;
  rfc_proveedor: string;
  folio_factura: string;
  subtotal: number | null | null;
  iva: number | null;
  total: number | null;
  unidad: string;
  ot_id: string;
  solicitante: string;
  metodo_pago: MetodoPago;
  items: string;       // human-readable line items, e.g. "Filtro aceite x2 $450 | Bujías x4 $280"
  imagen_url: string;
  receipt_group: string;
  status: GastoStatus;
  entity: string;
  currency: string;
  taxLabel: string;
  authorId: string;
  reviewedAt: string;
  reviewReason: string;
}

export interface ExpenseEntity {
  id: string;
  name: string;
  currency: string;
  taxLabel: string;
}

export interface ExpenseOptions {
  entities: ExpenseEntity[];
  canReview: boolean;
  closedThrough: string;
}

export interface NuevoGastoPayload {
  entity: string;
  currency: string;
  document_date: string;
  tipo: GastoTipo;
  proveedor: string;
  rfc_proveedor: string;
  folio_factura: string;
  subtotal: number;
  iva: number;
  total: number;
  ot_id: string;
  metodo_pago: MetodoPago;
  imagen_url: string;
  line_items: OcrLineItem[];
}

// ── State ─────────────────────────────────────────────────────────────────────

interface GastosState {
  gastos: GastoCompra[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  fetched: boolean;
  canReview: boolean;
  closedThrough: string;
  fetchGastos: () => Promise<void>;
  saveGasto: (payload: NuevoGastoPayload, allocations: { unit: string; amount: string }[], attachmentOperationId?: string) => Promise<string[]>;
  deleteGasto: (gastoId: string) => Promise<void>;
  reviewGasto: (gastoId: string, status: 'Aprobado' | 'Rechazado', reason: string) => Promise<void>;
}

// ── Row parser ────────────────────────────────────────────────────────────────

/** Strip currency symbols, commas, and whitespace before parsing — gspread
 *  returns FORMATTED_VALUE by default (e.g. "$3,356.00"). */
function parseNum(v: string | undefined): number | null {
  const value = String(v ?? '').replace(/[$,\s]/g, '');
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

export type VerifiedExpense = GastoCompra & { subtotal: number; iva: number; total: number };

export function verifiedExpense(expense: GastoCompra): expense is VerifiedExpense {
  return !!expense.entity && ['USD', 'PAB'].includes(expense.currency) &&
    expense.subtotal !== null && expense.iva !== null && expense.total !== null &&
    Math.round(expense.subtotal * 100) + Math.round(expense.iva * 100) === Math.round(expense.total * 100);
}

export function parseGastoRow(row: string[]): GastoCompra | null {
  if (!row[0] || /^(?:ID|Gasto_ID)$/i.test(row[0])) return null;
  return {
    gasto_id:      row[0] ?? '',
    fecha:         row[1] ?? '',
    hora:          row[2] ?? '',
    tipo:          (row[3] ?? 'Otro') as GastoTipo,
    proveedor:     row[4] ?? '',
    rfc_proveedor: row[5] ?? '',
    folio_factura: row[6] ?? '',
    subtotal:      parseNum(row[7]),
    iva:           parseNum(row[8]),
    total:         parseNum(row[9]),
    unidad:        row[10] ?? '',
    ot_id:         row[11] ?? '',
    solicitante:   row[12] ?? '',
    metodo_pago:   (row[13] ?? 'Efectivo') as MetodoPago,
    items:         row[14] ?? '',
    imagen_url:    row[15] ?? '',
    receipt_group: row[17] ?? '',
    status:        (row[16] ?? 'Borrador') as GastoStatus,
    entity:        row[21] ?? '',
    currency:      row[22] ?? '',
    taxLabel:      row[23] ?? '',
    authorId:      row[18] ?? '',
    reviewedAt:    row[26] ?? '',
    reviewReason:  row[27] ?? '',
  };
}

let sessionOwner = '';
let generation = 0;

export function setGastosSession(owner: string) {
  if (sessionOwner === owner) return;
  sessionOwner = owner;
  generation++;
  useGastosStore.setState({ gastos: [], loading: false, saving: false, error: null, fetched: false, canReview: false, closedThrough: '' });
}

export const useGastosStore = create<GastosState>((set, get) => ({
  gastos: [],
  loading: false,
  saving: false,
  error: null,
  fetched: false,
  canReview: false,
  closedThrough: '',

  fetchGastos: async () => {
    if (get().loading) return;
    const startedIn = generation;
    set({ loading: true, error: null });
    try {
      const { rows, canReview, closedThrough } = await purchaseRead<{ rows: string[][] } & ExpenseOptions>('expenses');
      if (startedIn !== generation) return;
      const gastos: GastoCompra[] = [];
      for (const row of rows) {
        const g = parseGastoRow(row);
        if (g) gastos.push(g);
      }
      set({ gastos, loading: false, fetched: true, canReview: canReview === true, closedThrough: closedThrough || '' });
    } catch (err: unknown) {
      if (startedIn !== generation) return;
      const message = err instanceof Error ? err.message : 'Error al cargar gastos';
      set({ gastos: [], error: message, loading: false, fetched: true, canReview: false, closedThrough: '' });
    }
  },

  saveGasto: async (payload, allocations, attachmentOperationId) => {
    const startedIn = generation;
    set({ saving: true, error: null });
    try {
      const result = await purchaseWrite<{ ids: string[] }>('expense-save', {
        expense: {
          ...payload,
          subtotal: payload.subtotal.toFixed(2),
          iva: payload.iva.toFixed(2),
          total: payload.total.toFixed(2),
        },
        allocations,
      }, attachmentOperationId, ({ ids }) => Array.isArray(ids) && ids.length === allocations.length
        && new Set(ids).size === ids.length && ids.every(id => typeof id === 'string' && Boolean(id)));
      if (startedIn !== generation) throw new DOMException('Cambió la sesión', 'AbortError');
      set({ fetched: false });
      return result.ids;
    } finally {
      if (startedIn === generation) set({ saving: false });
    }
  },

  reviewGasto: async (id, status, reason) => {
    const startedIn = generation;
    await purchaseWrite('expense-review', { id, status, reason });
    if (startedIn === generation) await get().fetchGastos();
  },

  deleteGasto: async (id) => {
    const startedIn = generation;
    const { removed } = await purchaseWrite<{ removed: string[] }>('expense-delete', { id });
    if (startedIn !== generation) return;
    set((state) => ({ gastos: state.gastos.filter((gasto) => !removed.includes(gasto.gasto_id)) }));
  },
}));
