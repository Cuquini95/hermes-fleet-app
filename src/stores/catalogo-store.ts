import { create } from 'zustand';
import { readRange, upsertRow, SHEET_TABS } from '../lib/sheets-api';
import { mexicoDate } from '../lib/date-utils';
import type { OcrLineItem } from '../lib/sheets-api';

// ── Catalog schema ────────────────────────────────────────────────────────────
// Catalogo_Precios sheet columns:
// A(0) Clave           — part_number or slug(description)
// B(1) Descripcion
// C(2) Precio_Unitario — latest seen price
// D(3) Precio_Min
// E(4) Precio_Max
// F(5) Proveedor       — latest supplier
// G(6) Fecha_Actualizacion
// H(7) Veces_Comprado

export interface CatalogoEntry {
  clave:        string;
  descripcion:  string;
  precio:       number;
  precioMin:    number;
  precioMax:    number;
  proveedor:    string;
  fechaActual:  string;
  vecesComprado: number;
}

interface CatalogoState {
  entries:  CatalogoEntry[];
  fetched:  boolean;
  loading:  boolean;
  fetchCatalogo: () => Promise<void>;
  syncLineItems: (items: OcrLineItem[], proveedor: string) => Promise<void>;
  search: (query: string) => CatalogoEntry[];
}

// ── Row key: part_number if available, otherwise normalised description ────────

export function catalogKey(partNumber: string, description: string): string {
  const pn = partNumber.trim().toUpperCase();
  if (pn) return pn;
  return description.trim().toUpperCase().replace(/\s+/g, '_').slice(0, 40);
}

function parseNum(v: string | undefined): number {
  return Number(String(v ?? '').replace(/[$,\s]/g, '')) || 0;
}

function parseRow(row: string[]): CatalogoEntry | null {
  if (!row[0] || row[0] === 'Clave') return null;
  return {
    clave:         row[0] ?? '',
    descripcion:   row[1] ?? '',
    precio:        parseNum(row[2]),
    precioMin:     parseNum(row[3]),
    precioMax:     parseNum(row[4]),
    proveedor:     row[5] ?? '',
    fechaActual:   row[6] ?? '',
    vecesComprado: parseInt(row[7] ?? '0') || 0,
  };
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useCatalogoStore = create<CatalogoState>((set, get) => ({
  entries: [],
  fetched: false,
  loading: false,

  fetchCatalogo: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const rows = await readRange(SHEET_TABS.CATALOGO_PRECIOS);
      const entries: CatalogoEntry[] = [];
      for (const row of rows) {
        const e = parseRow(row);
        if (e) entries.push(e);
      }
      set({ entries, fetched: true, loading: false });
    } catch {
      set({ loading: false, fetched: true });
    }
  },

  /**
   * Called after saving a gasto. For each line item with a description,
   * upserts the catalog entry: updates price/supplier/date/count, or inserts new.
   */
  syncLineItems: async (items: OcrLineItem[], proveedor: string) => {
    const today = mexicoDate();
    const { entries } = get();

    for (const item of items) {
      if (!item.description.trim()) continue;

      const clave  = catalogKey(item.part_number, item.description);
      const precio = item.unit_price > 0 ? item.unit_price : item.subtotal / Math.max(item.qty, 1);

      // Look up existing entry in local cache for min/max tracking
      const existing = entries.find((e) => e.clave === clave);
      const precioMin = existing ? Math.min(existing.precioMin || precio, precio) : precio;
      const precioMax = existing ? Math.max(existing.precioMax || precio, precio) : precio;
      const veces     = (existing?.vecesComprado ?? 0) + 1;

      const row = [
        clave,
        item.description.trim(),
        precio.toFixed(2),
        precioMin.toFixed(2),
        precioMax.toFixed(2),
        proveedor,
        today,
        String(veces),
      ];

      // Fire-and-forget — catalog sync failure must not block gasto save
      upsertRow(SHEET_TABS.CATALOGO_PRECIOS, clave, row).catch((err) => {
        console.warn('Catalog sync failed for', clave, err);
      });
    }

    // Optimistically update local cache
    set((state) => {
      const updated = [...state.entries];
      for (const item of items) {
        if (!item.description.trim()) continue;
        const clave  = catalogKey(item.part_number, item.description);
        const precio = item.unit_price > 0 ? item.unit_price : item.subtotal / Math.max(item.qty, 1);
        const idx    = updated.findIndex((e) => e.clave === clave);
        const entry: CatalogoEntry = {
          clave,
          descripcion:   item.description.trim(),
          precio,
          precioMin:     idx >= 0 ? Math.min(updated[idx].precioMin || precio, precio) : precio,
          precioMax:     idx >= 0 ? Math.max(updated[idx].precioMax || precio, precio) : precio,
          proveedor,
          fechaActual:   today,
          vecesComprado: (idx >= 0 ? updated[idx].vecesComprado : 0) + 1,
        };
        if (idx >= 0) updated[idx] = entry;
        else updated.push(entry);
      }
      return { entries: updated };
    });
  },

  search: (query: string): CatalogoEntry[] => {
    if (!query.trim()) return [];
    const q = query.toUpperCase();
    return get().entries.filter(
      (e) =>
        e.clave.includes(q) ||
        e.descripcion.toUpperCase().includes(q) ||
        e.proveedor.toUpperCase().includes(q)
    ).slice(0, 8);
  },
}));
