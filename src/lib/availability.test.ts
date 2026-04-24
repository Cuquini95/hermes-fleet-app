import { describe, expect, it } from 'vitest';
import type { Equipment } from '../types/equipment';
import { buildAvailabilityTrend, calculateAvailability } from './availability';

function unit(unit_id: string, status: Equipment['status'] = 'operativo'): Equipment {
  return {
    unit_id,
    model: unit_id,
    type: 'Equipo',
    client: 'GTP',
    status,
    current_horometro: 0,
    next_pm_level: '',
    next_pm_horometro: 0,
    last_inspection_date: '',
    last_inspection_result: '',
    assigned_operator: '',
  };
}

function averiaRow(unidad: string, fecha: string, estado = 'Abierta'): string[] {
  return [
    fecha,
    '12:06:41',
    unidad,
    'Estructura',
    'Golpe',
    'CRITICA',
    'Operador',
    '>8 horas',
    '',
    estado,
    '',
    '',
    '',
    'OT-20260424-1206-df7f',
    'https://example.test/foto.jpg',
  ];
}

describe('calculateAvailability', () => {
  it('treats open averias as unavailable even when inventory says operativo', () => {
    const equipment = [unit('CV102'), unit('CA20'), unit('TR15', 'taller')];
    const openAverias = new Set(['CV102']);

    expect(calculateAvailability(equipment, openAverias)).toBe(33);
  });
});

describe('buildAvailabilityTrend', () => {
  it('uses live averia dates instead of static demo values', () => {
    const equipment = [
      unit('CV102'),
      unit('CA20'),
      unit('CA21', 'taller'),
      unit('CA22'),
    ];
    const rows = [
      averiaRow('CV102', '24/04/2026'),
      averiaRow('CA22', '22/04/2026'),
      averiaRow('CA20', '21/04/2026', 'Cerrada'),
    ];

    const trend = buildAvailabilityTrend(equipment, rows, new Date(2026, 3, 24));

    expect(trend).toHaveLength(7);
    expect(trend.map((point) => point.day)).toEqual(['Sab', 'Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie']);
    expect(trend[4]?.pct).toBe(75);
    expect(trend[6]?.pct).toBe(25);
  });
});
