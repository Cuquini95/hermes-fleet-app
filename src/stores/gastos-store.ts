import { create } from 'zustand';
import { readRange, appendRow, SHEET_TABS } from '../lib/sheets-api';
import type { OcrLineItem } from '../lib/sheets-api';
import { mexicoDate, mexicoTime } from '../lib/date-utils';

// ── Types ─────────────────────────────────────────────────────────────────────

export type GastoTipo = 'Refaccion' | 'Combustible' | 'Servicio' | 'Otro';
export type GastoStatus = 'Borrador' | 'Aprobado' | 'Rechazado';
export type MetodoPago = 'Efectivo' | 'Transferencia' | 'Tarjeta';

export interface GastoCompra {
  gasto_id: string;      // A
  fecha: string;         // B
  hora: string;          // C
  tipo: GastoTipo;       // D
  proveedor: string;     // E
  rfc_proveedor: string; // F
  folio_factura: string; // G
  iva: number;           // H
  subtotal: number;      // I
  total: number;         // J
  unidad: string;        // K
  ot_id: string;         // L
  solicitante: string;   // M
  aprobado_por: string;  // N
  metodo_pago: MetodoPago; // O
  imagen_url: string;    // P
  status: GastoStatus;   // Q
}

export interface GastoLinea {
  linea_id: string;            // A
  gasto_id: string;            // B
  part_number: string;         // C
  descripcion: string;         // D
  qty: number;                 // E
  precio_unit: number;         // F
  subtotal: number;            // G
  actualizo_inventario: boolean; // H
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
  lineas: GastoLinea[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  fetched: boolean;
  fetchGastos: () => Promise<void>;
  saveGasto: (payload: NuevoGastoPayload) => Promise<string>;
}

// ── Row parsers ───────────────────────────────────────────────────────────────

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
    iva:           Number(row[7]) || 0,
    subtotal:      Number(row[8]) || 0,
    total:         Number(row[9]) || 0,
    unidad:        row[10] ?? '',
    ot_id:         row[11] ?? '',
    solicitante:   row[12] ?? '',
    aprobado_por:  row[13] ?? '',
    metodo_pago:   (row[14] ?? 'Efectivo') as MetodoPago,
    imagen_url:    row[15] ?? '',
    status:        (row[16] ?? 'Borrador') as GastoStatus,
  };
}

function parseLineaRow(row: string[]): GastoLinea | null {
  if (!row[0] || row[0] === 'Linea_ID') return null;
  return {
    linea_id:             row[0] ?? '',
    gasto_id:             row[1] ?? '',
    part_number:          row[2] ?? '',
    descripcion:          row[3] ?? '',
    qty:                  Number(row[4]) || 0,
    precio_unit:          Number(row[5]) || 0,
    subtotal:             Number(row[6]) || 0,
    actualizo_inventario: row[7] === 'TRUE',
  };
}

// ── ID generator ──────────────────────────────────────────────────────────────

function makeGastoId(): string {
  // GST-YYYYMM-XXXX
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 4).toUpperCase();
  return `GST-${ym}-${rand}`;
}

function makeLineaId(): string {
  return `LIN-${crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useGastosStore = create<GastosState>((set, get) => ({
  gastos: [],
  lineas: [],
  loading: false,
  saving: false,
  error: null,
  fetched: false,

  fetchGastos: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const [gastosResult, lineasResult] = await Promise.allSettled([
        readRange(SHEET_TABS.GASTOS_COMPRAS),
        readRange(SHEET_TABS.GASTOS_LINEAS),
      ]);

      const gastos: GastoCompra[] = [];
      if (gastosResult.status === 'fulfilled') {
        for (const row of gastosResult.value) {
          const g = parseGastoRow(row);
          if (g) gastos.push(g);
        }
      }

      const lineas: GastoLinea[] = [];
      if (lineasResult.status === 'fulfilled') {
        for (const row of lineasResult.value) {
          const l = parseLineaRow(row);
          if (l) lineas.push(l);
        }
      }

      set({ gastos, lineas, loading: false, fetched: true });
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
      // Phase 1: write header as Borrador
      await appendRow(SHEET_TABS.GASTOS_COMPRAS, [
        gastoId,                          // A: Gasto_ID
        fecha,                            // B: Fecha
        hora,                             // C: Hora
        payload.tipo,                     // D: Tipo
        payload.proveedor,                // E: Proveedor
        payload.rfc_proveedor,            // F: RFC_Proveedor
        payload.folio_factura,            // G: Folio_Factura
        payload.iva.toFixed(2),           // H: IVA
        payload.subtotal.toFixed(2),      // I: Subtotal
        payload.total.toFixed(2),         // J: Total
        payload.unidad,                   // K: Unidad
        payload.ot_id,                    // L: OT_ID
        payload.solicitante,              // M: Solicitante
        '',                               // N: Aprobado_Por
        payload.metodo_pago,              // O: Metodo_Pago
        payload.imagen_url,               // P: Imagen_URL
        'Aprobado',                       // Q: Status
      ]);

      // Phase 2: write line items
      for (const item of payload.line_items) {
        const lineaId = makeLineaId();
        await appendRow(SHEET_TABS.GASTOS_LINEAS, [
          lineaId,                            // A: Linea_ID
          gastoId,                            // B: Gasto_ID
          item.part_number,                   // C: Part_Number
          item.description,                   // D: Descripcion
          String(item.qty),                   // E: Qty
          item.unit_price.toFixed(2),         // F: Precio_Unit
          item.subtotal.toFixed(2),           // G: Subtotal
          'FALSE',                            // H: Actualizo_Inventario
        ]);
      }

      // Optimistic local update
      const newGasto: GastoCompra = {
        gasto_id:      gastoId,
        fecha,
        hora,
        tipo:          payload.tipo,
        proveedor:     payload.proveedor,
        rfc_proveedor: payload.rfc_proveedor,
        folio_factura: payload.folio_factura,
        iva:           payload.iva,
        subtotal:      payload.subtotal,
        total:         payload.total,
        unidad:        payload.unidad,
        ot_id:         payload.ot_id,
        solicitante:   payload.solicitante,
        aprobado_por:  '',
        metodo_pago:   payload.metodo_pago,
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
