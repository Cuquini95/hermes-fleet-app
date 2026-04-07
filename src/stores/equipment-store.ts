import { create } from 'zustand';
import { readRange, SHEET_TABS } from '../lib/sheets-api';
import type { Equipment } from '../types/equipment';

// ── Status normalization ───────────────────────────────────────────────────────

function normalizeStatus(raw: string): string {
  const s = (raw ?? '').toLowerCase().trim();
  if (s === 'operativo') return 'operativo';
  if (s.includes('reparac')) return 'taller';
  if (s.includes('traslado')) return 'alerta';
  if (s.includes('alerta')) return 'alerta';
  if (s.includes('taller')) return 'taller';
  return 'inactivo';
}

// ── Row parser ─────────────────────────────────────────────────────────────────
// Sheet columns (0-indexed):
//  0=#  1=COD1  2=COD2  3=Descripción  4=Marca  5=Modelo  6=Año
//  7=Serie  8=Ubicación  9=Estado  10=Lectura Actual Hr/Km  11=Fecha Lectura

function parseEquipmentRow(row: string[]): Equipment | null {
  const unit_id = (row[1] ?? '').trim();
  if (!unit_id) return null; // skip empty rows

  const marca = (row[4] ?? '').trim();
  const modelo = (row[5] ?? '').trim();

  return {
    unit_id,
    model: [marca, modelo].filter(Boolean).join(' ') || unit_id,
    type: (row[3] ?? '').trim() || 'Equipo',
    client: 'GTP',
    status: normalizeStatus(row[9] ?? ''),
    current_horometro: parseFloat((row[10] ?? '').replace(/,/g, '')) || 0,
    next_pm_level: '',
    next_pm_horometro: 0,
    last_inspection_date: (row[11] ?? '').trim(),
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
}

export const useEquipmentStore = create<EquipmentState>((set, get) => ({
  equipment: [],
  fetched: false,
  loading: false,
  error: null,

  fetchEquipment: async () => {
    if (get().fetched || get().loading) return;
    set({ loading: true, error: null });
    try {
      const rows = await readRange(SHEET_TABS.FLOTA);
      // Rows 0–4 are branding/headers; real data starts at row 5 (index 5)
      const DATA_START = 5;
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
