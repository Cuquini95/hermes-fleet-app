// src/components/analytics/reportGenerator.ts
// 5-page jsPDF fleet management report — professional dark-accented design

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { KpiTotals, UnitMetrics } from './analyticsUtils'
import { formatPeso, formatLitros } from './analyticsUtils'

// ── Design System ─────────────────────────────────────────────────────────────

const COLORS = {
  // Primary
  navy:        [15, 23, 42]   as [number, number, number],   // #0f172a
  navyMid:     [30, 58, 95]   as [number, number, number],   // #1e3a5f
  navyLight:   [51, 65, 85]   as [number, number, number],   // #334155

  // Category — Gastos
  blue:        [59, 130, 246] as [number, number, number],   // #3b82f6
  blueLight:   [219, 234, 254] as [number, number, number],  // #dbeafe

  // Category — Combustible
  green:       [34, 197, 94]  as [number, number, number],   // #22c55e
  greenLight:  [220, 252, 231] as [number, number, number],  // #dcfce7

  // Category — Fletes
  orange:      [249, 115, 22] as [number, number, number],   // #f97316
  orangeLight: [255, 237, 213] as [number, number, number],  // #ffedd5

  // Category — Averías
  red:         [248, 113, 113] as [number, number, number],  // #f87171
  redLight:    [254, 226, 226] as [number, number, number],  // #fee2e2

  // Neutrals
  white:       [255, 255, 255] as [number, number, number],
  offWhite:    [248, 250, 252] as [number, number, number],  // #f8fafc
  gray100:     [241, 245, 249] as [number, number, number],  // #f1f5f9
  gray400:     [148, 163, 184] as [number, number, number],  // #94a3b8
  gray600:     [71, 85, 105]   as [number, number, number],  // #475569
  gray900:     [15, 23, 42]    as [number, number, number],  // text
} as const

const PERIOD_LABELS: Record<string, string> = {
  week: 'Última semana',
  month: 'Último mes',
  year: 'Último año',
}

function getPeriodLabel(period: string, dateFrom?: string, dateTo?: string): string {
  if (period === 'custom') return `${dateFrom ?? ''} — ${dateTo ?? ''}`
  return PERIOD_LABELS[period] ?? period
}

// ── Column indices in raw sheet data ─────────────────────────────────────────
// Row 0 is header — skip with .slice(1)
// Gastos:      Fecha=0, Unidad=10, Descripción=3, Monto=9
// Combustible: Fecha=0, Unidad=3,  Litros=6, Proveedor=2, Km=5
// Fletes:      Fecha=0, Unidad=2,  Conductor=4, Origen=5, Destino=6, Tonelaje=11, KM_Total=8
// Averías:     Fecha=0, Unidad=2,  Descripción=3, Estado=7

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildTimestamp(): string {
  const now = new Date()
  return now.toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function buildDateStr(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

function addFooters(doc: jsPDF, timestamp: string): void {
  const pageCount = doc.getNumberOfPages()
  const pageH = doc.internal.pageSize.height
  const pageW = doc.internal.pageSize.width
  const margin = 14

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)

    // Thin separator line
    doc.setDrawColor(...COLORS.navyLight)
    doc.setLineWidth(0.3)
    doc.line(margin, pageH - 10, pageW - margin, pageH - 10)

    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.gray400)
    doc.text(`Página ${i} de ${pageCount}`, margin, pageH - 6)
    doc.text(`Generado: ${timestamp}`, pageW - margin, pageH - 6, { align: 'right' })
  }
}

/**
 * Draws the page header strip used on detail pages (pages 2–5).
 * Returns the Y coordinate where content should begin.
 */
function addDetailPageHeader(
  doc: jsPDF,
  sectionLabel: string,
  periodLabel: string
): number {
  const pageW = doc.internal.pageSize.width
  const headerH = 14

  // Full-width navy strip
  doc.setFillColor(...COLORS.navy)
  doc.rect(0, 0, pageW, headerH, 'F')

  // "HERMES FLEET" small left
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.gray400)
  doc.text('HERMES FLEET', 14, 6)

  // Section name bold center
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.white)
  doc.text(sectionLabel, pageW / 2, 9.5, { align: 'center' })

  // Period right
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.gray400)
  doc.text(periodLabel, pageW - 14, 9.5, { align: 'right' })

  doc.setTextColor(0, 0, 0)
  return headerH + 6
}

// ── KPI Card Helper ───────────────────────────────────────────────────────────

interface KpiCardConfig {
  label: string
  value: string
  unit: string
  accentColor: [number, number, number]
  bgColor: [number, number, number]
}

function drawKpiCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  cfg: KpiCardConfig
): void {
  const barW = 3

  // Colored left bar
  doc.setFillColor(...cfg.accentColor)
  doc.rect(x, y, barW, h, 'F')

  // Card background
  doc.setFillColor(...cfg.bgColor)
  doc.rect(x + barW, y, w - barW, h, 'F')

  // Label — uppercase, gray600
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...COLORS.gray600)
  doc.text(cfg.label.toUpperCase(), x + w / 2, y + 5, { align: 'center' })

  // Value — large bold, category color
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...cfg.accentColor)
  doc.text(cfg.value, x + w / 2, y + 14, { align: 'center' })

  // Unit — small, gray600
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...COLORS.gray600)
  doc.text(cfg.unit, x + w / 2, y + 19, { align: 'center' })
}

// ── Page 1: Executive Summary ─────────────────────────────────────────────────

function buildExecutiveSummary(
  doc: jsPDF,
  period: string,
  unitFilter: string,
  kpiTotals: KpiTotals,
  unitMetrics: UnitMetrics[],
  timestamp: string,
  dateFrom?: string,
  dateTo?: string
): void {
  const pageW = doc.internal.pageSize.width
  const periodLabel = getPeriodLabel(period, dateFrom, dateTo)
  const unitLabel = unitFilter === 'all' ? 'Todas las unidades' : unitFilter
  const margin = 10

  // ── Full-width dark header (28mm) ─────────────────────────────────────────
  const headerH = 28
  doc.setFillColor(...COLORS.navy)
  doc.rect(0, 0, pageW, headerH, 'F')

  // Left accent bar
  doc.setFillColor(...COLORS.blue)
  doc.rect(0, 0, 4, headerH, 'F')

  // Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...COLORS.white)
  doc.text('HERMES FLEET', 12, 13)

  // Subtitle
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.gray400)
  doc.text('REPORTE GERENCIAL', 12, 22)

  // Right: period / unit / timestamp
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.gray400)
  doc.text(`${periodLabel}  ·  ${unitLabel}  ·  ${timestamp}`, pageW - margin, 17, { align: 'right' })

  doc.setTextColor(0, 0, 0)

  // ── KPI Cards (4 in a row) ─────────────────────────────────────────────────
  const cardGap = 3
  const totalGaps = cardGap * 3
  const cardW = (pageW - margin * 2 - totalGaps) / 4
  const cardH = 23
  const cardY = headerH + 6

  const cards: KpiCardConfig[] = [
    {
      label: 'Gastos',
      value: formatPeso(kpiTotals.gastosTotal),
      unit: '$',
      accentColor: COLORS.blue,
      bgColor: COLORS.blueLight,
    },
    {
      label: 'Combustible',
      value: formatLitros(kpiTotals.combustibleLitros),
      unit: 'Litros',
      accentColor: COLORS.green,
      bgColor: COLORS.greenLight,
    },
    {
      label: 'Fletes',
      value: String(kpiTotals.fletesCount),
      unit: 'viajes',
      accentColor: COLORS.orange,
      bgColor: COLORS.orangeLight,
    },
    {
      label: 'Averías',
      value: String(kpiTotals.averiasCount),
      unit: 'eventos',
      accentColor: COLORS.red,
      bgColor: COLORS.redLight,
    },
  ]

  cards.forEach((card, i) => {
    const x = margin + i * (cardW + cardGap)
    drawKpiCard(doc, x, cardY, cardW, cardH, card)
  })

  // ── Section label: Resumen por Unidad ─────────────────────────────────────
  const sectionY = cardY + cardH + 7
  doc.setFillColor(...COLORS.navyMid)
  doc.rect(margin, sectionY, pageW - margin * 2, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.white)
  doc.text('RESUMEN POR UNIDAD', margin + 3, sectionY + 5)
  doc.setTextColor(0, 0, 0)

  // ── Per-unit table ─────────────────────────────────────────────────────────
  autoTable(doc, {
    head: [['Unidad', 'Gastos', 'Combustible (L)', 'Fletes', 'Averías', 'Total (Gastos + Comb.)']],
    body: unitMetrics.map(u => [
      u.unit,
      formatPeso(u.gastos),
      formatLitros(u.combustibleLitros),
      String(u.fletes),
      String(u.averias),
      formatPeso(u.gastos + u.combustibleCosto),
    ]),
    startY: sectionY + 7,
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: COLORS.gray900,
      lineColor: COLORS.gray100,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: COLORS.navyMid,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: COLORS.offWhite,
    },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { textColor: COLORS.blue,   halign: 'right' },
      2: { textColor: COLORS.green,  halign: 'right' },
      3: { halign: 'right' },
      4: { textColor: COLORS.red,    halign: 'right' },
      5: { fontStyle: 'bold', textColor: COLORS.gray900, halign: 'right' },
    },
    margin: { left: margin, right: margin },
  })
}

// ── Page 2: Gastos Detail ─────────────────────────────────────────────────────

function buildGastosPage(
  doc: jsPDF,
  periodLabel: string,
  gastosRows: string[][]
): void {
  const startY = addDetailPageHeader(doc, 'GASTOS — DETALLE', periodLabel)
  const dataRows = gastosRows.slice(1)

  autoTable(doc, {
    head: [['Fecha', 'Unidad', 'Descripción', 'Monto']],
    body: dataRows.map(r => [r[0] ?? '', r[10] ?? '', r[3] ?? '', r[9] ?? '']),
    startY,
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: COLORS.gray900,
      lineColor: COLORS.gray100,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: COLORS.navyMid,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: COLORS.offWhite },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 32 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 30, halign: 'right', textColor: COLORS.blue },
    },
    margin: { left: 10, right: 10 },
  })
}

// ── Page 3: Combustible Detail ────────────────────────────────────────────────

function buildCombustiblePage(
  doc: jsPDF,
  periodLabel: string,
  combustibleRows: string[][]
): void {
  const startY = addDetailPageHeader(doc, 'COMBUSTIBLE — DETALLE', periodLabel)
  const dataRows = combustibleRows.slice(1)

  autoTable(doc, {
    head: [['Fecha', 'Unidad', 'Litros', 'Proveedor', 'Km']],
    body: dataRows.map(r => [r[0] ?? '', r[3] ?? '', r[6] ?? '', r[2] ?? '', r[5] ?? '']),
    startY,
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: COLORS.gray900,
      lineColor: COLORS.gray100,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: COLORS.navyMid,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: COLORS.offWhite },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 32 },
      2: { cellWidth: 22, halign: 'right', textColor: COLORS.green },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 22, halign: 'right' },
    },
    margin: { left: 10, right: 10 },
  })
}

// ── Page 4: Fletes Detail ─────────────────────────────────────────────────────

function buildFletesPage(
  doc: jsPDF,
  periodLabel: string,
  fletesRows: string[][]
): void {
  const startY = addDetailPageHeader(doc, 'FLETES — DETALLE', periodLabel)
  const dataRows = fletesRows.slice(1)

  autoTable(doc, {
    head: [['Fecha', 'Unidad', 'Conductor', 'Origen', 'Destino', 'Tonelaje', 'KM Total']],
    body: dataRows.map(r => [
      r[0] ?? '',
      r[2] ?? '',
      r[4] ?? '',
      r[5] ?? '',
      r[6] ?? '',
      r[11] ?? '',
      r[8] ?? '',
    ]),
    startY,
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: COLORS.gray900,
      lineColor: COLORS.gray100,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: COLORS.navyMid,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: COLORS.offWhite },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 28 },
      2: { cellWidth: 36 },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 'auto' },
      5: { cellWidth: 22, halign: 'right', textColor: COLORS.orange },
      6: { cellWidth: 22, halign: 'right' },
    },
    margin: { left: 10, right: 10 },
  })
}

// ── Page 5: Averías Detail ────────────────────────────────────────────────────

function buildAveriasPage(
  doc: jsPDF,
  periodLabel: string,
  averiasRows: string[][]
): void {
  const startY = addDetailPageHeader(doc, 'AVERÍAS — DETALLE', periodLabel)
  const dataRows = averiasRows.slice(1)

  autoTable(doc, {
    head: [['Fecha', 'Unidad', 'Descripción', 'Estado']],
    body: dataRows.map(r => [r[0] ?? '', r[2] ?? '', r[3] ?? '', r[7] ?? '']),
    startY,
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: COLORS.gray900,
      lineColor: COLORS.gray100,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: COLORS.navyMid,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: COLORS.offWhite },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 32 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 32, textColor: COLORS.red },
    },
    margin: { left: 10, right: 10 },
  })
}

// ── Public API ────────────────────────────────────────────────────────────────

export function generateReport(
  period: 'week' | 'month' | 'year' | 'custom',
  unitFilter: string,
  filteredRows: {
    gastos: string[][]
    combustible: string[][]
    fletes: string[][]
    averias: string[][]
  },
  kpiTotals: KpiTotals,
  unitMetrics: UnitMetrics[],
  dateFrom?: string,
  dateTo?: string
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const timestamp = buildTimestamp()
  const periodLabel = getPeriodLabel(period, dateFrom, dateTo)

  // Page 1 — Executive Summary
  buildExecutiveSummary(doc, period, unitFilter, kpiTotals, unitMetrics, timestamp, dateFrom, dateTo)

  // Page 2 — Gastos
  doc.addPage()
  buildGastosPage(doc, periodLabel, filteredRows.gastos)

  // Page 3 — Combustible
  doc.addPage()
  buildCombustiblePage(doc, periodLabel, filteredRows.combustible)

  // Page 4 — Fletes
  doc.addPage()
  buildFletesPage(doc, periodLabel, filteredRows.fletes)

  // Page 5 — Averías
  doc.addPage()
  buildAveriasPage(doc, periodLabel, filteredRows.averias)

  // Footers on all pages (must be last)
  addFooters(doc, timestamp)

  // Download
  const dateStr = buildDateStr()
  doc.save(`hermes-reporte-${period}-${dateStr}.pdf`)
}
