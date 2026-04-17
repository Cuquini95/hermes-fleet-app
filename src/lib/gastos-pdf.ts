/**
 * @fileoverview Monolithic by design (> 400 LOC).
 * jsPDF report generator for expense PDFs. Procedural layout code that reads top-to-bottom; breaking into small helpers would obscure page flow.
 */
import type { jsPDF as JsPDFType } from 'jspdf';
import type { GastoCompra, GastoTipo } from '../stores/gastos-store';

// ── Logo loader ───────────────────────────────────────────────────────────────
// Load /logo-transplus.svg once, rasterise to PNG data URL, cache for reuse.

const LOGO_URL = '/logo-transplus.svg';
const LOGO_RENDER_SIZE = 256; // px; oversampled for crisp PDF embedding
let logoPromise: Promise<string | null> | null = null;

function loadLogoDataUrl(): Promise<string | null> {
  if (logoPromise) return logoPromise;
  logoPromise = new Promise<string | null>((resolve) => {
    fetch(LOGO_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`logo fetch ${res.status}`);
        return res.text();
      })
      .then((svgText) => {
        const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = LOGO_RENDER_SIZE;
          canvas.height = LOGO_RENDER_SIZE;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(svgUrl);
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0, LOGO_RENDER_SIZE, LOGO_RENDER_SIZE);
          const dataUrl = canvas.toDataURL('image/png');
          URL.revokeObjectURL(svgUrl);
          resolve(dataUrl);
        };
        img.onerror = () => {
          URL.revokeObjectURL(svgUrl);
          resolve(null);
        };
        img.src = svgUrl;
      })
      .catch(() => resolve(null));
  });
  return logoPromise;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GastoReportData {
  period: { year: number; month: number; label: string };
  generatedAt: string;
  generatedBy: string;
  selectedUnits: string[];
  gastos: GastoCompra[];
  totals: {
    total: number;
    count: number;
    averagePerRecord: number;
  };
  byType: Array<{
    tipo: GastoTipo;
    total: number;
    count: number;
    pct: number;
  }>;
  byUnit: Array<{
    unidad: string;
    total: number;
    count: number;
    gastos: GastoCompra[];
  }>;
}

// ── Colors (must match GastosPage palette) ────────────────────────────────────

const COLORS = {
  navy:        [22, 34, 82] as [number, number, number],
  navyDark:    [30, 58, 138] as [number, number, number],
  amber:       [245, 158, 11] as [number, number, number],
  green:       [5, 150, 105] as [number, number, number],
  textPrimary: [17, 24, 39] as [number, number, number],
  textMuted:   [107, 114, 128] as [number, number, number],
  divider:     [229, 231, 235] as [number, number, number],
  bgSoft:      [249, 250, 251] as [number, number, number],
};

const TYPE_COLORS: Record<string, [number, number, number]> = {
  Combustible: [59, 130, 246],
  Refaccion:   [245, 158, 11],
  Servicio:    [139, 92, 246],
  Otro:        [107, 114, 128],
};

const TYPE_LABELS: Record<string, string> = {
  Combustible: 'Combustible',
  Refaccion:   'Refacciones',
  Servicio:    'Servicio',
  Otro:        'Otros',
};

// ── Formatters ────────────────────────────────────────────────────────────────

const mxn = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });

const mxnCompact = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

// ── Page dimensions (A4 portrait at 72 DPI) ───────────────────────────────────

const PAGE = {
  width:  595.28,
  height: 841.89,
  margin: 40,
};

// ── Internal type alias ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AutoTableFn = (doc: JsPDFType, options: Record<string, any>) => void;

// ── Main generator ────────────────────────────────────────────────────────────

/**
 * Generates a Gastos PDF report and returns it as a Blob.
 * Async because it dynamically loads jspdf/jspdf-autotable on first call.
 */
export async function generateGastosPDF(data: GastoReportData): Promise<Blob> {
  const [{ jsPDF }, autoTableMod, logoDataUrl] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    loadLogoDataUrl(),
  ]);
  const autoTable = autoTableMod.default as AutoTableFn;

  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });

  drawHeader(doc, data, logoDataUrl);
  let y = 140;

  y = drawHeroKpi(doc, data, y);
  y = drawTypeBreakdown(doc, data, y + 16);
  y = drawUnitDetails(doc, data, y + 20, logoDataUrl, autoTable);

  drawFooters(doc);

  return doc.output('blob');
}

// ── Header (drawn on every page via event) ────────────────────────────────────

function drawHeader(doc: JsPDFType, data: GastoReportData, logoDataUrl: string | null): void {
  const m = PAGE.margin;

  // Logo — use real image if available, else fallback to text placeholder
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', m, m, 44, 44);
    } catch {
      // fall through to fallback
      doc.setFillColor(...COLORS.navy);
      doc.roundedRect(m, m, 44, 44, 5, 5, 'F');
    }
  } else {
    doc.setFillColor(...COLORS.navy);
    doc.roundedRect(m, m, 44, 44, 5, 5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('GTP', m + 22, m + 27, { align: 'center' });
  }

  // Brand text
  doc.setTextColor(...COLORS.textMuted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Hermes Fleet', m + 54, m + 18);
  doc.setTextColor(...COLORS.textPrimary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('GTP Transportes', m + 54, m + 33);

  // Right-side title block
  const rightX = PAGE.width - m;
  doc.setTextColor(...COLORS.textPrimary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Reporte de Gastos', rightX, m + 15, { align: 'right' });

  doc.setTextColor(...COLORS.textMuted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `Generado ${data.generatedAt} · por ${data.generatedBy}`,
    rightX,
    m + 28,
    { align: 'right' }
  );

  // Period badge (amber)
  doc.setTextColor(...COLORS.amber);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const unitsLabel =
    data.selectedUnits.length === 1
      ? `· ${data.selectedUnits[0]}`
      : `· ${data.selectedUnits.length} unidades`;
  doc.text(
    `${data.period.label.toUpperCase()} ${unitsLabel}`,
    rightX,
    m + 40,
    { align: 'right' }
  );

  // Separator line
  doc.setDrawColor(...COLORS.navy);
  doc.setLineWidth(1.5);
  doc.line(m, m + 55, PAGE.width - m, m + 55);
}

// ── Hero KPI card ─────────────────────────────────────────────────────────────

function drawHeroKpi(doc: JsPDFType, data: GastoReportData, y: number): number {
  const m = PAGE.margin;
  const w = PAGE.width - m * 2;
  const h = 70;

  // Gradient-ish: two rectangles to fake a gradient
  doc.setFillColor(...COLORS.navy);
  doc.roundedRect(m, y, w, h, 8, 8, 'F');

  // Left block
  doc.setTextColor(200, 220, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('TOTAL DEL PERÍODO', m + 18, y + 20);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.text(mxn(data.totals.total), m + 18, y + 48);

  doc.setTextColor(180, 200, 230);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `${data.totals.count} registros · ${data.byUnit.length} unidades`,
    m + 18,
    y + 62
  );

  // Right block — average per record
  const rightX = m + w - 18;
  doc.setTextColor(200, 220, 255);
  doc.setFontSize(8);
  doc.text('Promedio / registro', rightX, y + 20, { align: 'right' });

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(mxn(data.totals.averagePerRecord), rightX, y + 42, { align: 'right' });

  return y + h;
}

// ── Type breakdown (4-column grid) ────────────────────────────────────────────

function drawTypeBreakdown(doc: JsPDFType, data: GastoReportData, y: number): number {
  const m = PAGE.margin;
  const w = PAGE.width - m * 2;

  // Section header
  drawSectionHeader(doc, 'GASTO POR TIPO', y);
  y += 14;

  const cellW = (w - 9) / 4; // 3 gaps of 3pt
  const cellH = 52;

  const types = ['Combustible', 'Refaccion', 'Servicio', 'Otro'] as const;

  for (let i = 0; i < types.length; i++) {
    const tipo = types[i];
    if (tipo === undefined) continue;
    const entry = data.byType.find((t) => t.tipo === tipo);
    const total = entry?.total ?? 0;
    const count = entry?.count ?? 0;
    const pct   = entry?.pct   ?? 0;
    const color = TYPE_COLORS[tipo];

    const x = m + i * (cellW + 3);

    // Background
    doc.setFillColor(...COLORS.bgSoft);
    doc.roundedRect(x, y, cellW, cellH, 4, 4, 'F');

    // Left color border
    doc.setFillColor(...(color as [number, number, number]));
    doc.rect(x, y, 3, cellH, 'F');

    // Label
    doc.setTextColor(...COLORS.textMuted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text((TYPE_LABELS[tipo] ?? tipo).toUpperCase(), x + 10, y + 14);

    // Amount
    doc.setTextColor(...COLORS.textPrimary);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(mxnCompact(total), x + 10, y + 32);

    // Count + pct
    doc.setTextColor(...COLORS.textMuted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`${pct.toFixed(1)}% · ${count} reg`, x + 10, y + 44);
  }

  return y + cellH;
}

// ── Unit detail tables ────────────────────────────────────────────────────────

function drawUnitDetails(
  doc: JsPDFType,
  data: GastoReportData,
  y: number,
  logoDataUrl: string | null,
  autoTable: AutoTableFn,
): number {
  const m = PAGE.margin;
  const w = PAGE.width - m * 2;

  drawSectionHeader(doc, 'DETALLE POR UNIDAD', y);
  y += 20;

  // Sort units by total desc
  const sortedUnits = [...data.byUnit].sort((a, b) => b.total - a.total);

  for (const unit of sortedUnits) {
    // Page break check — need at least 80pt for the header + 1 row
    if (y > PAGE.height - 120) {
      doc.addPage();
      drawHeader(doc, data, logoDataUrl);
      y = 140;
    }

    // Unit header strip
    const stripH = 26;
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(m, y, w, stripH, 4, 4, 'F');
    doc.setFillColor(29, 78, 216);
    doc.rect(m, y, 4, stripH, 'F');

    doc.setTextColor(30, 58, 138);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(unit.unidad, m + 12, y + 12);

    doc.setTextColor(...COLORS.textMuted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(
      `${unit.count} ${unit.count === 1 ? 'gasto' : 'gastos'}`,
      m + 12,
      y + 22
    );

    doc.setTextColor(...COLORS.green);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(mxn(unit.total), m + w - 10, y + 17, { align: 'right' });

    y += stripH + 4;

    // Detail table
    const rows = unit.gastos
      .slice()
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((g) => [
        g.fecha,
        g.proveedor || '—',
        TYPE_LABELS[g.tipo] || g.tipo,
        g.folio_factura || '—',
        mxn(g.total),
      ]);

    autoTable(doc, {
      startY: y,
      head: [['Fecha', 'Proveedor', 'Tipo', 'Folio', 'Total']],
      body: rows,
      margin: { left: m, right: m },
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 5,
        textColor: COLORS.textPrimary,
        lineColor: COLORS.divider,
        lineWidth: 0.3,
      },
      headStyles: {
        fillColor: [243, 244, 246],
        textColor: [55, 65, 81],
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250],
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 70 },
        3: { cellWidth: 60 },
        4: { cellWidth: 70, halign: 'right', fontStyle: 'bold' },
      },
      didDrawPage: () => {
        // Re-draw the report header on each new page autotable creates
        drawHeader(doc, data, logoDataUrl);
      },
    });

    // @ts-expect-error — jspdf-autotable augments the jsPDF instance at runtime
    y = doc.lastAutoTable.finalY + 14;
  }

  return y;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function drawSectionHeader(doc: JsPDFType, label: string, y: number): void {
  const m = PAGE.margin;
  doc.setTextColor(...COLORS.navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(label, m, y);
  doc.setDrawColor(...COLORS.divider);
  doc.setLineWidth(0.5);
  doc.line(m, y + 4, PAGE.width - m, y + 4);
}

function drawFooters(doc: JsPDFType): void {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const y = PAGE.height - 25;
    doc.setDrawColor(...COLORS.divider);
    doc.setLineWidth(0.5);
    doc.line(PAGE.margin, y - 8, PAGE.width - PAGE.margin, y - 8);

    doc.setTextColor(...COLORS.textMuted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Hermes Fleet · Reporte automático', PAGE.margin, y);
    doc.text(`Página ${i} de ${pageCount}`, PAGE.width - PAGE.margin, y, { align: 'right' });
  }
}
