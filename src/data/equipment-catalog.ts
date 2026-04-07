import type { Equipment } from '../types/equipment';

export const EQUIPMENT_CATALOG: Equipment[] = [
  // ── Camiones Articulados ────────────────────────────────────────────────────
  { unit_id: 'CA20', model: 'Caterpillar 745',      type: 'Camión Articulado', client: 'GTP', status: 'operativo', current_horometro: 0, next_pm_level: '', next_pm_horometro: 0, last_inspection_date: '', last_inspection_result: '', assigned_operator: '' },
  { unit_id: 'CA21', model: 'Komatsu HM400-3MO',    type: 'Camión Articulado', client: 'GTP', status: 'operativo', current_horometro: 0, next_pm_level: '', next_pm_horometro: 0, last_inspection_date: '', last_inspection_result: '', assigned_operator: '' },
  { unit_id: 'CA22', model: 'Komatsu HM400-3MO',    type: 'Camión Articulado', client: 'GTP', status: 'operativo', current_horometro: 0, next_pm_level: '', next_pm_horometro: 0, last_inspection_date: '', last_inspection_result: '', assigned_operator: '' },
  { unit_id: 'CA23', model: 'Caterpillar 740B',     type: 'Camión Articulado', client: 'GTP', status: 'operativo', current_horometro: 0, next_pm_level: '', next_pm_horometro: 0, last_inspection_date: '', last_inspection_result: '', assigned_operator: '' },
  { unit_id: 'CA24', model: 'Caterpillar 735B',     type: 'Camión Articulado', client: 'GTP', status: 'operativo', current_horometro: 0, next_pm_level: '', next_pm_horometro: 0, last_inspection_date: '', last_inspection_result: '', assigned_operator: '' },
  { unit_id: 'CA25', model: 'Komatsu HM400-3MO',    type: 'Camión Articulado', client: 'GTP', status: 'operativo', current_horometro: 0, next_pm_level: '', next_pm_horometro: 0, last_inspection_date: '', last_inspection_result: '', assigned_operator: '' },
  { unit_id: 'CA26', model: 'Komatsu HM400-3MO',    type: 'Camión Articulado', client: 'GTP', status: 'operativo', current_horometro: 0, next_pm_level: '', next_pm_horometro: 0, last_inspection_date: '', last_inspection_result: '', assigned_operator: '' },
  { unit_id: 'CA27', model: 'Komatsu HM400-3MO',    type: 'Camión Articulado', client: 'GTP', status: 'operativo', current_horometro: 0, next_pm_level: '', next_pm_horometro: 0, last_inspection_date: '', last_inspection_result: '', assigned_operator: '' },
  { unit_id: 'CA28', model: 'Caterpillar 740B',     type: 'Camión Articulado', client: 'GTP', status: 'operativo', current_horometro: 0, next_pm_level: '', next_pm_horometro: 0, last_inspection_date: '', last_inspection_result: '', assigned_operator: '' },

  // ── Tractores de Cadena ─────────────────────────────────────────────────────
  { unit_id: 'TR16', model: 'Komatsu D65EX-16',     type: 'Tractor de Cadena', client: 'GTP', status: 'operativo', current_horometro: 0, next_pm_level: '', next_pm_horometro: 0, last_inspection_date: '', last_inspection_result: '', assigned_operator: '' },
  { unit_id: 'TR17', model: 'Komatsu D155AX-6',     type: 'Tractor de Cadena', client: 'GTP', status: 'operativo', current_horometro: 0, next_pm_level: '', next_pm_horometro: 0, last_inspection_date: '', last_inspection_result: '', assigned_operator: '' },

  // ── Excavadoras s/ Orugas ───────────────────────────────────────────────────
  { unit_id: 'EH40', model: 'Doosan DX360LCA',      type: 'Excavadora',        client: 'GTP', status: 'operativo', current_horometro: 0, next_pm_level: '', next_pm_horometro: 0, last_inspection_date: '', last_inspection_result: '', assigned_operator: '' },
  { unit_id: 'EH41', model: 'Doosan DX360LCA',      type: 'Excavadora',        client: 'GTP', status: 'operativo', current_horometro: 0, next_pm_level: '', next_pm_horometro: 0, last_inspection_date: '', last_inspection_result: '', assigned_operator: '' },
  { unit_id: 'EH42', model: 'Volvo EC480DL',        type: 'Excavadora',        client: 'GTP', status: 'operativo', current_horometro: 0, next_pm_level: '', next_pm_horometro: 0, last_inspection_date: '', last_inspection_result: '', assigned_operator: '' },
  { unit_id: 'EH43', model: 'Doosan DX225LCA',      type: 'Excavadora',        client: 'GTP', status: 'operativo', current_horometro: 0, next_pm_level: '', next_pm_horometro: 0, last_inspection_date: '', last_inspection_result: '', assigned_operator: '' },
  { unit_id: 'EH44', model: 'Doosan DX360LCA',      type: 'Excavadora',        client: 'GTP', status: 'operativo', current_horometro: 0, next_pm_level: '', next_pm_horometro: 0, last_inspection_date: '', last_inspection_result: '', assigned_operator: '' },
  { unit_id: 'EH45', model: 'Doosan DX360LCA',      type: 'Excavadora',        client: 'GTP', status: 'operativo', current_horometro: 0, next_pm_level: '', next_pm_horometro: 0, last_inspection_date: '', last_inspection_result: '', assigned_operator: '' },

  // ── Cargadores Frontales ────────────────────────────────────────────────────
  { unit_id: 'CF01', model: 'Doosan DL420A',        type: 'Cargador Frontal',  client: 'GTP', status: 'operativo', current_horometro: 0, next_pm_level: '', next_pm_horometro: 0, last_inspection_date: '', last_inspection_result: '', assigned_operator: '' },
  { unit_id: 'CF02', model: 'Doosan DL420A',        type: 'Cargador Frontal',  client: 'GTP', status: 'operativo', current_horometro: 0, next_pm_level: '', next_pm_horometro: 0, last_inspection_date: '', last_inspection_result: '', assigned_operator: '' },

  // ── Camiones Volteo ─────────────────────────────────────────────────────────
  { unit_id: 'CV100', model: 'Mack 8x4',            type: 'Camion Volteo',     client: 'GTP', status: 'operativo', current_horometro: 0, next_pm_level: '', next_pm_horometro: 0, last_inspection_date: '', last_inspection_result: '', assigned_operator: '' },
  { unit_id: 'CV101', model: 'Mack 8x4',            type: 'Camion Volteo',     client: 'GTP', status: 'operativo', current_horometro: 0, next_pm_level: '', next_pm_horometro: 0, last_inspection_date: '', last_inspection_result: '', assigned_operator: '' },
  { unit_id: 'CV102', model: 'Mack 8x4',            type: 'Camion Volteo',     client: 'GTP', status: 'operativo', current_horometro: 0, next_pm_level: '', next_pm_horometro: 0, last_inspection_date: '', last_inspection_result: '', assigned_operator: '' },
  { unit_id: 'CV103', model: 'Mack 8x4',            type: 'Camion Volteo',     client: 'GTP', status: 'operativo', current_horometro: 0, next_pm_level: '', next_pm_horometro: 0, last_inspection_date: '', last_inspection_result: '', assigned_operator: '' },
  { unit_id: 'CV104', model: 'Mack 8x4',            type: 'Camion Volteo',     client: 'GTP', status: 'operativo', current_horometro: 0, next_pm_level: '', next_pm_horometro: 0, last_inspection_date: '', last_inspection_result: '', assigned_operator: '' },
  { unit_id: 'CV105', model: 'Mack 8x4',            type: 'Camion Volteo',     client: 'GTP', status: 'operativo', current_horometro: 0, next_pm_level: '', next_pm_horometro: 0, last_inspection_date: '', last_inspection_result: '', assigned_operator: '' },
  { unit_id: 'CV106', model: 'Mack 8x4',            type: 'Camion Volteo',     client: 'GTP', status: 'operativo', current_horometro: 0, next_pm_level: '', next_pm_horometro: 0, last_inspection_date: '', last_inspection_result: '', assigned_operator: '' },
  { unit_id: 'CV107', model: 'Mack 8x4',            type: 'Camion Volteo',     client: 'GTP', status: 'operativo', current_horometro: 0, next_pm_level: '', next_pm_horometro: 0, last_inspection_date: '', last_inspection_result: '', assigned_operator: '' },
  { unit_id: 'CV108', model: 'Mack 8x4',            type: 'Camion Volteo',     client: 'GTP', status: 'operativo', current_horometro: 0, next_pm_level: '', next_pm_horometro: 0, last_inspection_date: '', last_inspection_result: '', assigned_operator: '' },
  { unit_id: 'CV109', model: 'Mack 8x4',            type: 'Camion Volteo',     client: 'GTP', status: 'operativo', current_horometro: 0, next_pm_level: '', next_pm_horometro: 0, last_inspection_date: '', last_inspection_result: '', assigned_operator: '' },
  { unit_id: 'CV110', model: 'Mack 8x4',            type: 'Camion Volteo',     client: 'GTP', status: 'operativo', current_horometro: 0, next_pm_level: '', next_pm_horometro: 0, last_inspection_date: '', last_inspection_result: '', assigned_operator: '' },
];

export function getEquipmentById(id: string): Equipment | undefined {
  return EQUIPMENT_CATALOG.find((e) => e.unit_id === id);
}
