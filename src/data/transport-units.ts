// ── Fleet Mack Trucks (Camión Volteo) — used for Fletes / Viajes ─────────────
// These are the transport trucks that do haul routes (CV100-CV110).
// Managed separately from the heavy mining equipment in '01 Inventario'.
//
// unit_id = CV100-CV110 (stable identifier for the physical truck)
// plates  = Mexican license plate (stable; used for OCR cross-reference)
// Drivers are NOT stored here — they rotate between units and come from the ticket.

export interface TransportUnit {
  unit_id: string;      // CV102, CV107, etc.
  mack_number: number;  // 102, 107, etc. (number painted on truck)
  type: string;
  plates: string;       // e.g. "FJ7797A" — empty string if not yet registered
}

export const TRANSPORT_UNITS: TransportUnit[] = [
  { unit_id: 'CV100', mack_number: 100, type: 'Camion Volteo', plates: 'FJ7794A' },
  { unit_id: 'CV101', mack_number: 101, type: 'Camion Volteo', plates: 'FJ7796A' },
  { unit_id: 'CV102', mack_number: 102, type: 'Camion Volteo', plates: 'FJ7797A' },
  { unit_id: 'CV103', mack_number: 103, type: 'Camion Volteo', plates: 'FJ7798A' },
  { unit_id: 'CV104', mack_number: 104, type: 'Camion Volteo', plates: 'FJ7793A' },
  { unit_id: 'CV105', mack_number: 105, type: 'Camion Volteo', plates: 'FJ7790A' },
  { unit_id: 'CV106', mack_number: 106, type: 'Camion Volteo', plates: '' },
  { unit_id: 'CV107', mack_number: 107, type: 'Camion Volteo', plates: 'FJ7788A' },
  { unit_id: 'CV108', mack_number: 108, type: 'Camion Volteo', plates: 'FJ7791A' },
  { unit_id: 'CV109', mack_number: 109, type: 'Camion Volteo', plates: '' },
  { unit_id: 'CV110', mack_number: 110, type: 'Camion Volteo', plates: 'FJ7792A' },
];

// ── Lookup helpers ────────────────────────────────────────────────────────────

/** Resolve a license plate → TransportUnit (case-insensitive, strips spaces/dashes) */
export function unitByPlates(plates: string): TransportUnit | undefined {
  const normalized = plates.toUpperCase().replace(/[\s-]/g, '');
  return TRANSPORT_UNITS.find(
    (u) => u.plates && u.plates.toUpperCase().replace(/[\s-]/g, '') === normalized
  );
}

/** Resolve a Mack number (102, "102", "CV102", "Mack 102") → TransportUnit */
export function unitByMackNumber(value: string | number): TransportUnit | undefined {
  const num = parseInt(String(value).replace(/\D/g, ''), 10);
  return TRANSPORT_UNITS.find((u) => u.mack_number === num);
}
