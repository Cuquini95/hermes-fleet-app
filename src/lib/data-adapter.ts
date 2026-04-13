/**
 * Named column constants for each sheet tab.
 * Use these instead of raw magic numbers in store/parse functions.
 *
 * Example:
 *   row[OT_COL.ESTADO]  instead of  row[9]
 */

// ── ORDENES_TRABAJO ───────────────────────────────────────────────────────────
export const OT_COL = {
  ROW_ID:          0,
  OT_ID:           1,
  FECHA:           2,
  UNIDAD:          3,
  TIPO_AVERIA:     4,
  DESCRIPCION:     5,
  SEVERIDAD:       6,
  PRIORIDAD:       7,
  MECANICO:        8,
  ESTADO:          9,
  FOTO_URL:        10,
  AVERIA_REF:      11,
  PARTES:          12,
  COSTO_ESTIMADO:  13,
  FECHA_CIERRE:    14,
  OBSERVACIONES:   15,
  PROGRESO:        16,
} as const;

// ── OT_STATUS_LOG ─────────────────────────────────────────────────────────────
export const OT_LOG_COL = {
  TIMESTAMP:   0,
  OT_ID:       1,
  FIELD:       2,
  OLD_VALUE:   3,
  NEW_VALUE:   4,
  CHANGED_BY:  5,
  ROLE:        6,
} as const;

// ── AVERIAS ───────────────────────────────────────────────────────────────────
export const AVERIA_COL = {
  FECHA:          0,
  HORA:           1,
  UNIDAD:         2,
  TIPO:           3,
  DESCRIPCION:    4,
  SEVERIDAD:      5,
  TECNICO:        6,
  TIEMPO_PARO:    7,
  COSTO_ESTIMADO: 8,
  ESTADO:         9,
  SOLUCION:       10,
  OBSERVACIONES:  11,
  PROVEEDOR:      12,
  OT_ID:          13,
  FOTO_URL:       14,
} as const;

// ── COMBUSTIBLE ───────────────────────────────────────────────────────────────
export const COMBUSTIBLE_COL = {
  TIMESTAMP:   0,
  FECHA:       1,
  HORA:        2,
  UNIDAD:      3,
  OPERADOR:    4,
  TIPO:        5,
  LITROS:      6,
  COSTO:       7,
  PU:          8,
  HOROMETRO:   9,
  KM:          10,
  ESTACION:    11,
  FOLIO:       12,
} as const;

// ── INSPECCIONES (DVIR) ───────────────────────────────────────────────────────
export const INSPECCION_COL = {
  FECHA:       0,
  HORA:        1,
  FOLIO:       2,
  TIPO:        3,
  UNIDAD:      4,
  MODELO:      5,
  OPERADOR:    6,
  TIPO_INSP:   7,
  SCORE:       8,
  RESULTADO:   9,
} as const;

// ── FIELD → COLUMN mapping for updateOTField ─────────────────────────────────
export const OT_FIELD_COLUMN: Record<string, number> = {
  estado:            OT_COL.ESTADO,
  mecanico_asignado: OT_COL.MECANICO,
  prioridad:         OT_COL.PRIORIDAD,
  observaciones:     OT_COL.OBSERVACIONES,
  progreso:          OT_COL.PROGRESO,
  costo_estimado:    OT_COL.COSTO_ESTIMADO,
};
