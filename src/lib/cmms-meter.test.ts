import { describe, expect, it } from 'vitest';
import { parseHorometroSheetRow, parseHorometroSheetRows } from './cmms-meter';

describe('CMMS meter sheet mapping', () => {
  it('maps a valid Mexico sheet row to an ISO reading', () => {
    expect(parseHorometroSheetRow([
      '25/07/2026',
      '13:15:00',
      ' ca26 ',
      'Komatsu WA470',
      'Operador',
      'inicio',
      '12,500.5',
    ])).toEqual({
      unit: 'CA26',
      hours: 12500.5,
      recorded_at: '2026-07-25T19:15:00.000Z',
    });
  });

  it('ignores headers, empty units, invalid dates, and non-positive meters', () => {
    const rows = [
      ['FECHA', 'HORA', 'UNIDAD', 'MODELO', 'OPERADOR', 'TURNO', 'HORÓMETRO'],
      ['25/07/2026', '13:15:00', '', '', '', '', '100'],
      ['not-a-date', '13:15:00', 'CA26', '', '', '', '100'],
      ['25/07/2026', '13:15:00', 'CA26', '', '', '', '0'],
    ];

    expect(parseHorometroSheetRows(rows)).toEqual([]);
  });

  it('keeps only the newest reading per unit for a bounded backfill', () => {
    const rows = [
      ['25/07/2026', '09:00:00', 'CA26', '', '', '', '12400'],
      ['25/07/2026', '13:15:00', 'ca26', '', '', '', '12500'],
      ['25/07/2026', '12:00:00', 'TR17', '', '', '', '4100'],
    ];

    expect(parseHorometroSheetRows(rows)).toEqual([
      {
        unit: 'CA26',
        hours: 12500,
        recorded_at: '2026-07-25T19:15:00.000Z',
      },
      {
        unit: 'TR17',
        hours: 4100,
        recorded_at: '2026-07-25T18:00:00.000Z',
      },
    ]);
  });
});
