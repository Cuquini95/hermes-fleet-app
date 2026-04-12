// src/components/analytics/reportGenerator.ts
// 5-page jsPDF fleet management report

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { KpiTotals, UnitMetrics } from './analyticsUtils'
import { formatPeso, formatLitros } from './analyticsUtils'

// ── Constants ─────────────────────────────────────────────────────────────────

const DARK_BLUE: [number, number, number] = [15, 23, 42]
const LIGHT_BLUE_BG: [number, number, number] = [241, 245, 249]
const PERIOD_LABELS: Record<string, string> = {
  week: 'Última semana',
  month: 'Último mes',
  year: 'Último año',
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

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text(
      `Página ${i} de ${pageCount}  |  Generado: ${timestamp}`,
      pageW / 2,
      pageH - 5,
      { align: 'center' }
    )
  }
}

function addPageHeader(
  doc: jsPDF,
  title: string,
  periodLabel: string
): number {
  const pageW = doc.internal.pageSize.width
  // Blue banner
  doc.setFillColor(...DARK_BLUE)
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('HERMES FLEET', 14, 10)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(title, 14, 17)
  // Period on right side
  doc.setFontSize(9)
  doc.text(`Período: ${periodLabel}`, pageW - 14, 17, { align: 'right' })
  doc.setTextColor(0, 0, 0)
  return 28 // return Y after header
}

// ── Page 1: Executive Summary ─────────────────────────────────────────────────

function buildExecutiveSummary(
  doc: jsPDF,
  period: string,
  unitFilter: string,
  kpiTotals: KpiTotals,
  unitMetrics: UnitMetrics[],
  timestamp: string
): void {
  const pageW = doc.internal.pageSize.width
  const periodLabel = PERIOD_LABELS[period] ?? period
  const unitLabel = unitFilter === 'all' ? 'Todas' : unitFilter

  // Full-width dark header
  doc.setFillColor(...DARK_BLUE)
  doc.rect(0, 0, pageW, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('HERMES FLEET — REPORTE GERENCIAL', pageW / 2, 14, { align: 'center' })
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Período: ${periodLabel}  |  Unidad: ${unitLabel}  |  Generado: ${timestamp}`, pageW / 2, 23, { align: 'center' })
  doc.setTextColor(0, 0, 0)

  // KPI boxes — 4 in a row
  const kpiData = [
    { label: 'Gastos Total', value: formatPeso(kpiTotals.gastosTotal) },
    { label: 'Combustible', value: formatLitros(kpiTotals.combustibleLitros) },
    { label: 'Fletes', value: String(kpiTotals.fletesCount) },
    { label: 'Averías', value: String(kpiTotals.averiasCount) },
  ]

  const boxMargin = 10
  const boxGap = 5
  const totalGap = boxGap * 3
  const boxW = (pageW - boxMargin * 2 - totalGap) / 4
  const boxH = 22
  const boxY = 34

  kpiData.forEach((kpi, i) => {
    const x = boxMargin + i * (boxW + boxGap)
    // Box background
    doc.setFillColor(241, 245, 249)
    doc.roundedRect(x, boxY, boxW, boxH, 2, 2, 'F')
    // Label
    doc.setFontSize(8)
    doc.setTextColor(80, 80, 80)
    doc.setFont('helvetica', 'normal')
    doc.text(kpi.label, x + boxW / 2, boxY + 7, { align: 'center' })
    // Value
    doc.setFontSize(13)
    doc.setTextColor(...DARK_BLUE)
    doc.setFont('helvetica', 'bold')
    doc.text(kpi.value, x + boxW / 2, boxY + 17, { align: 'center' })
  })

  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')

  // Per-unit summary table
  const tableY = boxY + boxH + 8
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Resumen por Unidad', boxMargin, tableY)

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
    startY: tableY + 4,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: DARK_BLUE, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: LIGHT_BLUE_BG },
    margin: { left: boxMargin, right: boxMargin },
  })
}

// ── Page 2: Gastos Detail ─────────────────────────────────────────────────────

function buildGastosPage(
  doc: jsPDF,
  period: string,
  gastosRows: string[][]
): void {
  const periodLabel = PERIOD_LABELS[period] ?? period
  const startY = addPageHeader(doc, 'Gastos — Detalle', periodLabel)

  const dataRows = gastosRows.slice(1)

  autoTable(doc, {
    head: [['Fecha', 'Unidad', 'Descripción', 'Monto']],
    body: dataRows.map(r => [
      r[0] ?? '',
      r[10] ?? '',
      r[3] ?? '',
      r[9] ?? '',
    ]),
    startY,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: DARK_BLUE, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: LIGHT_BLUE_BG },
    margin: { left: 10, right: 10 },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 30 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 28, halign: 'right' },
    },
  })
}

// ── Page 3: Combustible Detail ────────────────────────────────────────────────

function buildCombustiblePage(
  doc: jsPDF,
  period: string,
  combustibleRows: string[][]
): void {
  const periodLabel = PERIOD_LABELS[period] ?? period
  const startY = addPageHeader(doc, 'Combustible — Detalle', periodLabel)

  const dataRows = combustibleRows.slice(1)

  autoTable(doc, {
    head: [['Fecha', 'Unidad', 'Litros', 'Proveedor', 'Km']],
    body: dataRows.map(r => [
      r[0] ?? '',
      r[3] ?? '',
      r[6] ?? '',
      r[2] ?? '',
      r[5] ?? '',
    ]),
    startY,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: DARK_BLUE, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: LIGHT_BLUE_BG },
    margin: { left: 10, right: 10 },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 30 },
      2: { cellWidth: 20, halign: 'right' },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 20, halign: 'right' },
    },
  })
}

// ── Page 4: Fletes Detail ─────────────────────────────────────────────────────

function buildFletesPage(
  doc: jsPDF,
  period: string,
  fletesRows: string[][]
): void {
  const periodLabel = PERIOD_LABELS[period] ?? period
  const startY = addPageHeader(doc, 'Fletes — Detalle', periodLabel)

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
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: DARK_BLUE, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: LIGHT_BLUE_BG },
    margin: { left: 10, right: 10 },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 28 },
      2: { cellWidth: 35 },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 'auto' },
      5: { cellWidth: 20, halign: 'right' },
      6: { cellWidth: 20, halign: 'right' },
    },
  })
}

// ── Page 5: Averías Detail ────────────────────────────────────────────────────

function buildAveriasPage(
  doc: jsPDF,
  period: string,
  averiasRows: string[][]
): void {
  const periodLabel = PERIOD_LABELS[period] ?? period
  const startY = addPageHeader(doc, 'Averías — Detalle', periodLabel)

  const dataRows = averiasRows.slice(1)

  autoTable(doc, {
    head: [['Fecha', 'Unidad', 'Descripción', 'Estado']],
    body: dataRows.map(r => [
      r[0] ?? '',
      r[2] ?? '',
      r[3] ?? '',
      r[7] ?? '',
    ]),
    startY,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: DARK_BLUE, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: LIGHT_BLUE_BG },
    margin: { left: 10, right: 10 },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 30 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 30 },
    },
  })
}

// ── Public API ────────────────────────────────────────────────────────────────

export function generateReport(
  period: 'week' | 'month' | 'year',
  unitFilter: string,
  filteredRows: {
    gastos: string[][]
    combustible: string[][]
    fletes: string[][]
    averias: string[][]
  },
  kpiTotals: KpiTotals,
  unitMetrics: UnitMetrics[]
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const timestamp = buildTimestamp()

  // Page 1 — Executive Summary
  buildExecutiveSummary(doc, period, unitFilter, kpiTotals, unitMetrics, timestamp)

  // Page 2 — Gastos
  doc.addPage()
  buildGastosPage(doc, period, filteredRows.gastos)

  // Page 3 — Combustible
  doc.addPage()
  buildCombustiblePage(doc, period, filteredRows.combustible)

  // Page 4 — Fletes
  doc.addPage()
  buildFletesPage(doc, period, filteredRows.fletes)

  // Page 5 — Averías
  doc.addPage()
  buildAveriasPage(doc, period, filteredRows.averias)

  // Footers on all pages (must be last)
  addFooters(doc, timestamp)

  // Download
  const dateStr = buildDateStr()
  doc.save(`hermes-reporte-${period}-${dateStr}.pdf`)
}
