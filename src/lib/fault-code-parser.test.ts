import { describe, expect, it } from 'vitest';
import { normalizeFaultCode, extractFaultCodeLabel, isFaultCodeLike } from './fault-code-parser';

describe('normalizeFaultCode', () => {
  it('normalizes J1939 SPN/FMI codes from mechanic text', () => {
    const result = normalizeFaultCode('Unidad T-42 marca SPN 3216 FMI 9 y pierde fuerza');

    expect(result).toMatchObject({
      code_type: 'J1939',
      spn: '3216',
      fmi: '9',
      normalized_label: 'SPN 3216 FMI 9',
      likely_system: 'Postratamiento / sensor NOx',
      needs_manual_lookup: true,
    });
  });

  it('normalizes MID/PID/FMI codes', () => {
    const result = normalizeFaultCode('MID 128 PID 100 FMI 1 activo');

    expect(result).toMatchObject({
      code_type: 'MID_PID_FMI',
      mid: '128',
      pid: '100',
      fmi: '1',
      normalized_label: 'MID 128 PID 100 FMI 1',
      likely_system: 'Motor / presion de aceite',
    });
  });

  it('normalizes CID/FMI codes', () => {
    const result = normalizeFaultCode('Caterpillar CID 0041 FMI 03');

    expect(result).toMatchObject({
      code_type: 'CID_FMI',
      cid: '0041',
      fmi: '03',
      normalized_label: 'CID 0041 FMI 03',
    });
  });

  it('normalizes OBD powertrain codes', () => {
    const result = normalizeFaultCode('Check engine P0087 en ruta');

    expect(result).toMatchObject({
      code_type: 'OBD',
      obd_code: 'P0087',
      normalized_label: 'P0087',
      likely_system: 'Combustible / presion de riel',
    });
  });

  it('keeps known OEM heavy-equipment text codes', () => {
    const result = normalizeFaultCode('HM400 codigo 15K0MW al cambiar a primera');

    expect(result).toMatchObject({
      code_type: 'OEM',
      oem_code: '15K0MW',
      normalized_label: '15K0MW',
      needs_manual_lookup: true,
    });
  });

  it('normalizes Komatsu monitor failure codes like DK51L5', () => {
    const result = normalizeFaultCode('diagnostica fallo DK51L5');

    expect(result).toMatchObject({
      code_type: 'OEM',
      oem_code: 'DK51L5',
      normalized_label: 'DK51L5',
      likely_system: 'Retardador / controlador RHC (Komatsu HM400)',
      needs_manual_lookup: true,
    });
  });
});

describe('fault-code helpers', () => {
  it('extracts the normalized label when a code exists', () => {
    expect(extractFaultCodeLabel('SPN 5246 FMI 0')).toBe('SPN 5246 FMI 0');
    expect(extractFaultCodeLabel('codigo P0420')).toBe('P0420');
    expect(extractFaultCodeLabel('diagnostica fallo DK51L5')).toBe('DK51L5');
  });

  it('detects explicit code language even before a concrete code is parsed', () => {
    expect(isFaultCodeLike('que significa este codigo de motor')).toBe(true);
    expect(isFaultCodeLike('revisar manguera hidraulica')).toBe(false);
  });
});
