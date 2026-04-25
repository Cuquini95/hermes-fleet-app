import { create } from 'zustand';
import { readRange, SHEET_TABS } from '../lib/sheets-api';
import type { Equipment } from '../types/equipment';

// ── Status normalization ───────────────────────────────────────────────────────

function normalizeStatus(raw: string): Equipment['status'] {
  const s = (raw ?? '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // strip accents
  if (s === 'operativo' || s.startsWith('en operac') || s === 'disponible') return 'operativo';
  if (s.includes('reparac') || s.includes('falla') || s.startsWith('en pm') || s === 'pm' || s.includes('mantenimiento') || s.includes('taller')) return 'taller';
  if (s.includes('traslado') || s.includes('alerta')) return 'alerta';
  return 'inactivo';
}

// ── Row parser ─────────────────────────────────────────────────────────────────
// Sheet "01 Inventario" columns (0-indexed) — verified live 2026-04-21:
//  0=#  1=COD1  2=Descripción  3=Marca  4=Modelo  5=Año
//  6=Serie  7=Ubicación  8=Estado  9=Lectura Hr/Km  10=Fecha Lectura  11=Últ Cambio

function parseEquipmentRow(row: string[]): Equipment | null {
  const unit_id = (row[1] ?? '').trim();
  if (!unit_id) return null;

  const marca = (row[3] ?? '').trim();
  const modelo = (row[4] ?? '').trim();

  return {
    unit_id,
    model: [marca, modelo].filter(Boolean).join(' ') || unit_id,
    type: (row[2] ?? '').trim() || 'Equipo',
    client: 'GTP',
    status: normalizeStatus(row[8] ?? ''),
    current_horometro: parseFloat((row[9] ?? '').replace(/,/g, '')) || 0,
    next_pm_level: '',
    next_pm_horometro: 0,
    last_inspection_date: (row[10] ?? '').trim(),
    last_inspection_result: '',
    assigned_operator: '',
  };
}

// ── Store ──────────────────────────────────────────────────────────────────────

interface EquipmentState {
  equipment: Equipment[];
  fetched: boolean;
  loading: boolean;
  error: string | null;
  fetchEquipment: () => Promise<void>;
  refetch: () => Promise<void>;
}

/** Equipment (unidades) store: fetch-from-sheet list plus fetched/loading/error flags and refetch helper. */
export const useEquipmentStore = create<EquipmentState>((set, get) => ({
  equipment: [],
  fetched: false,
  loading: false,
  error: null,

  refetch: async () => {
    set({ fetched: false });
    await get().fetchEquipment();
  },

  fetchEquipment: async () => {
    if (get().fetched || get().loading) return;
    set({ loading: true, error: null });
    try {
      const rows = await readRange(SHEET_TABS.FLOTA);
      // Sheet layout: rows 0-1 = title/section headers, row 2 = column headers,
      // data starts at row 3.
      const DATA_START = 3;
      const parsed = rows
        .slice(DATA_START)
        .map(parseEquipmentRow)
        .filter((e): e is Equipment => e !== null);
      set({ equipment: parsed, fetched: true, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },
}));
