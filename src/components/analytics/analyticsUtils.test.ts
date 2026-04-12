// src/components/analytics/analyticsUtils.test.ts
import { describe, it, expect } from 'vitest'
import {
  parseSheetDate,
  getPeriodCutoff,
  isInPeriod,
  isDataRow,
  parseCurrency,
  parseNum,
  aggregateByUnit,
  computeKpiTotals,
  buildTrend,
  extractUnits,
} from './analyticsUtils'

describe('parseSheetDate', () => {
  it('parses a valid DD/MM/YYYY date', () => {
    const d = parseSheetDate('12/04/2026')
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2026)
    expect(d!.getMonth()).toBe(3) // April = 3
    expect(d!.getDate()).toBe(12)
  })
  it('returns null for header text', () => {
    expect(parseSheetDate('Fecha')).toBeNull()
    expect(parseSheetDate('')).toBeNull()
    expect(parseSheetDate('01-04-2026')).toBeNull()
  })
})

describe('isDataRow', () => {
  it('returns true for rows with a date in col 0', () => {
    expect(isDataRow(['12/04/2026', 'CV103', '42000'])).toBe(true)
  })
  it('returns false for header row', () => {
    expect(isDataRow(['Fecha', 'Unidad', 'Total'])).toBe(false)
  })
  it('returns false for empty row', () => {
    expect(isDataRow([])).toBe(false)
  })
})

describe('parseCurrency', () => {
  it('parses $3,356.00', () => expect(parseCurrency('$3,356.00')).toBe(3356))
  it('parses 42000', () => expect(parseCurrency('42000')).toBe(42000))
  it('returns 0 for empty string', () => expect(parseCurrency('')).toBe(0))
})

describe('parseNum', () => {
  it('parses 8,420', () => expect(parseNum('8,420')).toBe(8420))
  it('parses 47.07', () => expect(parseNum('47.07')).toBeCloseTo(47.07))
  it('returns 0 for empty', () => expect(parseNum('')).toBe(0))
})

describe('aggregateByUnit', () => {
  const gastos = [
    ['12/04/2026', '', '', '', '', '', '', '', '', '42000', 'CV103'],
    ['11/04/2026', '', '', '', '', '', '', '', '', '31000', 'CV104'],
    ['10/04/2026', '', '', '', '', '', '', '', '', '51000', 'CV103'],
  ]
  const combustible = [
    ['12/04/2026', '', '', 'CV103', '', '', '1200', '15000'],
    ['11/04/2026', '', '', 'CV104', '', '', '800', '10000'],
  ]
  const fletes = [
    ['12/04/2026', '', 'CV103', '', '', '', '', '', '100', '', '', '47'],
    ['11/04/2026', '', 'CV103', '', '', '', '', '', '80', '', '', '30'],
    ['10/04/2026', '', 'CV104', '', '', '', '', '', '90', '', '', '25'],
  ]
  const averias = [
    ['09/04/2026', '', 'CV104'],
    ['08/04/2026', '', 'CV104'],
    ['07/04/2026', '', 'CV103'],
  ]

  it('aggregates gastos per unit correctly', () => {
    const result = aggregateByUnit(gastos, [], [], [])
    const cv103 = result.find(u => u.unit === 'CV103')!
    const cv104 = result.find(u => u.unit === 'CV104')!
    expect(cv103.gastos).toBe(93000) // 42000 + 51000
    expect(cv104.gastos).toBe(31000)
  })

  it('aggregates combustible litros per unit', () => {
    const result = aggregateByUnit([], combustible, [], [])
    expect(result.find(u => u.unit === 'CV103')!.combustibleLitros).toBe(1200)
    expect(result.find(u => u.unit === 'CV104')!.combustibleLitros).toBe(800)
  })

  it('counts fletes per unit', () => {
    const result = aggregateByUnit([], [], fletes, [])
    expect(result.find(u => u.unit === 'CV103')!.fletes).toBe(2)
    expect(result.find(u => u.unit === 'CV104')!.fletes).toBe(1)
  })

  it('counts averias per unit', () => {
    const result = aggregateByUnit([], [], [], averias)
    expect(result.find(u => u.unit === 'CV104')!.averias).toBe(2)
    expect(result.find(u => u.unit === 'CV103')!.averias).toBe(1)
  })
})

describe('computeKpiTotals', () => {
  it('sums all units into fleet totals', () => {
    const units = [
      { unit: 'CV103', gastos: 42000, combustibleLitros: 1200, combustibleCosto: 15000, fletes: 2, tonelaje: 77, averias: 1 },
      { unit: 'CV104', gastos: 31000, combustibleLitros: 800, combustibleCosto: 10000, fletes: 1, tonelaje: 25, averias: 2 },
    ]
    const totals = computeKpiTotals(units)
    expect(totals.gastosTotal).toBe(73000)
    expect(totals.combustibleLitros).toBe(2000)
    expect(totals.fletesCount).toBe(3)
    expect(totals.averiasCount).toBe(3)
  })
})

describe('buildTrend', () => {
  it('returns an array of week points', () => {
    const rows = [
      ['05/04/2026', '', '', 'CV103', '', '', '500'],
      ['06/04/2026', '', '', 'CV104', '', '', '300'],
    ]
    const trend = buildTrend(rows, 'month')
    expect(trend.length).toBeGreaterThan(0)
    expect(trend[0]).toHaveProperty('label')
    expect(trend[0]).toHaveProperty('litros')
  })
})

describe('extractUnits', () => {
  it('returns sorted unique units across all collections', () => {
    const gastos = [['01/04/2026', '', '', '', '', '', '', '', '', '', 'CV105']]
    const combustible = [['01/04/2026', '', '', 'CV103']]
    const fletes = [['01/04/2026', '', 'CV104']]
    const averias = [['01/04/2026', '', 'CV103']]
    const units = extractUnits(gastos, combustible, fletes, averias)
    expect(units).toEqual(['CV103', 'CV104', 'CV105'])
  })
})
