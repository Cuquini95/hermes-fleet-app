import { describe, it, expect } from 'vitest';
import {
  OT_COL,
  OT_LOG_COL,
  AVERIA_COL,
  COMBUSTIBLE_COL,
  INSPECCION_COL,
  OT_FIELD_COLUMN,
} from './data-adapter';

describe('OT_COL column constants', () => {
  it('OT_ID is column 1', () => expect(OT_COL.OT_ID).toBe(1));
  it('FECHA is column 2', () => expect(OT_COL.FECHA).toBe(2));
  it('ESTADO is column 9', () => expect(OT_COL.ESTADO).toBe(9));
  it('MECANICO is column 8', () => expect(OT_COL.MECANICO).toBe(8));
  it('PRIORIDAD is column 7', () => expect(OT_COL.PRIORIDAD).toBe(7));

  it('all values are non-negative integers', () => {
    for (const [key, val] of Object.entries(OT_COL)) {
      expect(typeof val, `OT_COL.${key} should be a number`).toBe('number');
      expect(val, `OT_COL.${key} should be >= 0`).toBeGreaterThanOrEqual(0);
    }
  });

  it('all column indices are unique (no accidental duplicates)', () => {
    const values = Object.values(OT_COL);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});

describe('OT_LOG_COL column constants', () => {
  it('OT_ID is column 1', () => expect(OT_LOG_COL.OT_ID).toBe(1));
  it('TIMESTAMP is column 0', () => expect(OT_LOG_COL.TIMESTAMP).toBe(0));
  it('FIELD is column 2', () => expect(OT_LOG_COL.FIELD).toBe(2));
  it('OLD_VALUE is column 3', () => expect(OT_LOG_COL.OLD_VALUE).toBe(3));
  it('NEW_VALUE is column 4', () => expect(OT_LOG_COL.NEW_VALUE).toBe(4));

  it('all values are unique', () => {
    const values = Object.values(OT_LOG_COL);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('AVERIA_COL column constants', () => {
  it('ESTADO is column 9', () => expect(AVERIA_COL.ESTADO).toBe(9));
  it('OT_ID is column 13', () => expect(AVERIA_COL.OT_ID).toBe(13));

  it('all values are unique', () => {
    const values = Object.values(AVERIA_COL);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('COMBUSTIBLE_COL column constants', () => {
  it('UNIDAD is column 3', () => expect(COMBUSTIBLE_COL.UNIDAD).toBe(3));
  it('LITROS is column 6', () => expect(COMBUSTIBLE_COL.LITROS).toBe(6));
  it('HOROMETRO is column 9', () => expect(COMBUSTIBLE_COL.HOROMETRO).toBe(9));

  it('all values are unique', () => {
    const values = Object.values(COMBUSTIBLE_COL);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('INSPECCION_COL column constants', () => {
  it('FOLIO is column 2', () => expect(INSPECCION_COL.FOLIO).toBe(2));
  it('UNIDAD is column 4', () => expect(INSPECCION_COL.UNIDAD).toBe(4));
  it('RESULTADO is column 9', () => expect(INSPECCION_COL.RESULTADO).toBe(9));
});

describe('OT_FIELD_COLUMN mapping', () => {
  it('estado maps to OT_COL.ESTADO', () => {
    expect(OT_FIELD_COLUMN['estado']).toBe(OT_COL.ESTADO);
  });

  it('mecanico_asignado maps to OT_COL.MECANICO', () => {
    expect(OT_FIELD_COLUMN['mecanico_asignado']).toBe(OT_COL.MECANICO);
  });

  it('prioridad maps to OT_COL.PRIORIDAD', () => {
    expect(OT_FIELD_COLUMN['prioridad']).toBe(OT_COL.PRIORIDAD);
  });

  it('progreso maps to OT_COL.PROGRESO', () => {
    expect(OT_FIELD_COLUMN['progreso']).toBe(OT_COL.PROGRESO);
  });

  it('costo_estimado maps to OT_COL.COSTO_ESTIMADO', () => {
    expect(OT_FIELD_COLUMN['costo_estimado']).toBe(OT_COL.COSTO_ESTIMADO);
  });

  it('observaciones maps to OT_COL.OBSERVACIONES', () => {
    expect(OT_FIELD_COLUMN['observaciones']).toBe(OT_COL.OBSERVACIONES);
  });
});
