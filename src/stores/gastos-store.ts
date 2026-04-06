import { create } from 'zustand';
import { readRange, appendRow, SHEET_TABS } from '../lib/sheets-api';
import type { OcrLineItem } from '../lib/sheets-api';
import { mexicoDate, mexicoTime } from '../lib/date-utils';

// ── Types ─────────────────────────────────────────────────────────────────────

export type GastoTipo = 'Refaccion' | 'Combustible' | 'Servicio' | 'Otro';
export type GastoStatus = 'Borrador' | 'Aprobado' | 'Rechazado';
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
  subtotal: number;
  iva: number;
  total: number;
  unidad: string;
  ot_id: string;
  solicitante: string;
  metodo_pago: MetodoPago;
  items: string;       // human-readable line items, e.g. "Filtro aceite x2 $450 | Bujías x4 $280"
  imagen_url: string;
  status: GastoStatus;
}

export interface NuevoGastoPayload {
  tipo: GastoTipo;
  proveedor: string;
  rfc_proveedor: string;
  folio_factura: string;
  subtotal: number;
  iva: number;
  total: number;
  unidad: string;
  ot_id: string;
  metodo_pago: MetodoPago;
  imagen_url: string;
  solicitante: string;
  line_items: OcrLineItem[];
}

// ── State ─────────────────────────────────────────────────────────────────────

interface GastosState {
  gastos: GastoCompra[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  fetched: boolean;
  fetchGastos: () => Promise<void>;
  saveGasto: (payload: NuevoGastoPayload) => Promise<string>;
}

// ── Row parser ────────────────────────────────────────────────────────────────

function parseGastoRow(row: string[]): GastoCompra | null {
  if (!row[0] || row[0] === 'Gasto_ID') return null;
  return {
    gasto_id:      row[0] ?? '',
    fecha:         row[1] ?? '',
    hora:          row[2] ?? '',
    tipo:          (row[3] ?? 'Otro') as GastoTipo,
    proveedor:     row[4] ?? '',
    rfc_proveedor: row[5] ?? '',
    folio_factura: row[6] ?? '',
    subtotal:      Number(row[7]) || 0,
    iva:           Number(row[8]) || 0,
    total:         Number(row[9]) || 0,
    unidad:        row[10] ?? '',
    ot_id:         row[11] ?? '',
    solicitante:   row[12] ?? '',
    metodo_pago:   (row[13] ?? 'Efectivo') as MetodoPago,
    items:         row[14] ?? '',
    imagen_url:    row[15] ?? '',
    status:        (row[16] ?? 'Aprobado') as GastoStatus,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeGastoId(): string {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 4).toUpperCase();
  return `GST-${ym}-${rand}`;
}

/**
 * Serialize line items as a readable string for the single Items column.
 * Example: "Filtro aceite x2 $450.00 | Bujías x4 $280.00"
 */
function serializeItems(items: OcrLineItem[]): string {
  return items
    .filter((i) => i.description.trim())
    .map((i) => {
      const desc = i.part_number ? `[${i.part_number}] ${i.description}` : i.description;
      return `${desc} x${i.qty} $${i.subtotal.toFixed(2)}`;
    })
    .join(' | ');
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useGastosStore = create<GastosState>((set, get) => ({
  gastos: [],
  loading: false,
  saving: false,
  error: null,
  fetched: false,

  fetchGastos: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const rows = await readRange(SHEET_TABS.GASTOS);
      const gastos: GastoCompra[] = [];
      for (const row of rows) {
        const g = parseGastoRow(row);
        if (g) gastos.push(g);
      }
      set({ gastos, loading: false, fetched: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar gastos';
      set({ error: message, loading: false, fetched: true });
    }
  },

  saveGasto: async (payload: NuevoGastoPayload): Promise<string> => {
    set({ saving: true, error: null });
    const gastoId = makeGastoId();
    const fecha = mexicoDate();
    const hora = mexicoTime();

    try {
      await appendRow(SHEET_TABS.GASTOS, [
        gastoId,                          // A: Gasto_ID
        fecha,                            // B: Fecha
        hora,                             // C: Hora
        payload.tipo,                     // D: Tipo
        payload.proveedor,                // E: Proveedor
        payload.rfc_proveedor,            // F: RFC_Proveedor
        payload.folio_factura,            // G: Folio_Factura
        payload.subtotal.toFixed(2),      // H: Subtotal
        payload.iva.toFixed(2),           // I: IVA
        payload.total.toFixed(2),         // J: Total
        payload.unidad,                   // K: Unidad
        payload.ot_id,                    // L: OT_ID
        payload.solicitante,              // M: Solicitante
        payload.metodo_pago,              // N: Metodo_Pago
        serializeItems(payload.line_items), // O: Items
        payload.imagen_url,               // P: Imagen_URL
        'Aprobado',                       // Q: Status
      ]);

      const newGasto: GastoCompra = {
        gasto_id:      gastoId,
        fecha,
        hora,
        tipo:          payload.tipo,
        proveedor:     payload.proveedor,
        rfc_proveedor: payload.rfc_proveedor,
        folio_factura: payload.folio_factura,
        subtotal:      payload.subtotal,
        iva:           payload.iva,
        total:         payload.total,
        unidad:        payload.unidad,
        ot_id:         payload.ot_id,
        solicitante:   payload.solicitante,
        metodo_pago:   payload.metodo_pago,
        items:         serializeItems(payload.line_items),
        imagen_url:    payload.imagen_url,
        status:        'Aprobado',
      };

      set((state) => ({
        gastos: [newGasto, ...state.gastos],
        saving: false,
      }));

      return gastoId;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al guardar gasto';
      set({ error: message, saving: false });
      throw err;
    }
  },
}));
