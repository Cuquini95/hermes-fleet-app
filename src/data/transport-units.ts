// ── Fleet Mack Trucks (Camión Volteo) — used for Fletes / Viajes ─────────────
// These are the transport trucks that do haul routes (CV100-CV110).
// Managed separately from the heavy mining equipment in '01 Inventario'.

export interface TransportUnit {
  unit_id: string;
  type: string;
}

export const TRANSPORT_UNITS: TransportUnit[] = [
  { unit_id: 'CV100', type: 'Camion Volteo' },
  { unit_id: 'CV101', type: 'Camion Volteo' },
  { unit_id: 'CV102', type: 'Camion Volteo' },
  { unit_id: 'CV103', type: 'Camion Volteo' },
  { unit_id: 'CV104', type: 'Camion Volteo' },
  { unit_id: 'CV105', type: 'Camion Volteo' },
  { unit_id: 'CV106', type: 'Camion Volteo' },
  { unit_id: 'CV107', type: 'Camion Volteo' },
  { unit_id: 'CV108', type: 'Camion Volteo' },
  { unit_id: 'CV109', type: 'Camion Volteo' },
  { unit_id: 'CV110', type: 'Camion Volteo' },
];
