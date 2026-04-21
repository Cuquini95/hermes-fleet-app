/**
 * Pure helper functions for the DataManager feature:
 * row filtering, CSV/TSV export, cell formatting, and badge styling.
 */

import type { ColumnDef } from './data-manager-types';

// ── Row utilities ────────────────────────────────────────────────────────────

/** Returns true when every cell in the row is blank. */
export function isRowEmpty(row: string[]): boolean {
  return row.every((cell) => !cell || cell.trim() === '');
}

/**
 * Returns true when the first cell matches the expected header label,
 * so we can skip the sheet's own header row.
 */
export function looksLikeHeaderRow(row: string[], columns: ColumnDef[]): boolean {
  const first = (row[0] ?? '').toLowerCase().trim();
  if (!first) return false;
  const expected = columns[0]?.label.toLowerCase().trim() ?? '';
  if (!expected) return false;
  return first === expected || first.startsWith('fecha');
}

// ── Formatters ───────────────────────────────────────────────────────────────

/** Formats a raw numeric string as MXN currency. */
export function formatCurrency(raw: string): string {
  const cleaned = raw.replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n)) return raw;
  return n.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ── Badge styles ─────────────────────────────────────────────────────────────

interface BadgeStyle {
  bg: string;
  text: string;
  ring: string;
}

/** Returns Tailwind classes for a severity badge (Alta / Media / Baja). */
export function severityBadge(value: string): BadgeStyle {
  const v = value.toLowerCase();
  if (v.includes('alta') || v.includes('crítica') || v.includes('critica')) {
    return { bg: 'bg-red-500/15', text: 'text-red-300', ring: 'ring-red-500/30' };
  }
  if (v.includes('media') || v.includes('moderad')) {
    return { bg: 'bg-amber-500/15', text: 'text-amber-300', ring: 'ring-amber-500/30' };
  }
  if (v.includes('baja') || v.includes('leve')) {
    return { bg: 'bg-emerald-500/15', text: 'text-emerald-300', ring: 'ring-emerald-500/30' };
  }
  return { bg: 'bg-slate-500/15', text: 'text-slate-300', ring: 'ring-slate-500/30' };
}

/** Returns Tailwind classes for a status badge (Activo / Pendiente / Cancelado). */
export function statusBadge(value: string): BadgeStyle {
  const v = value.toLowerCase();
  if (v.includes('activ') || v.includes('pagad') || v.includes('cerrad') || v.includes('complet')) {
    return { bg: 'bg-emerald-500/15', text: 'text-emerald-300', ring: 'ring-emerald-500/30' };
  }
  if (v.includes('pend') || v.includes('progres') || v.includes('abiert')) {
    return { bg: 'bg-amber-500/15', text: 'text-amber-300', ring: 'ring-amber-500/30' };
  }
  if (v.includes('cancel') || v.includes('rechaz') || v.includes('falla')) {
    return { bg: 'bg-red-500/15', text: 'text-red-300', ring: 'ring-red-500/30' };
  }
  return { bg: 'bg-slate-500/15', text: 'text-slate-300', ring: 'ring-slate-500/30' };
}

/** Returns Tailwind classes for a resultado badge (Aprobado / Condicional / Rechazado). */
export function resultadoBadge(value: string): BadgeStyle {
  const v = value.toLowerCase();
  if (v.includes('aprob') || v.includes('ok') || v.includes('pas')) {
    return { bg: 'bg-emerald-500/15', text: 'text-emerald-300', ring: 'ring-emerald-500/30' };
  }
  if (v.includes('condic') || v.includes('observ')) {
    return { bg: 'bg-amber-500/15', text: 'text-amber-300', ring: 'ring-amber-500/30' };
  }
  if (v.includes('rechaz') || v.includes('falla') || v.includes('no')) {
    return { bg: 'bg-red-500/15', text: 'text-red-300', ring: 'ring-red-500/30' };
  }
  return { bg: 'bg-slate-500/15', text: 'text-slate-300', ring: 'ring-slate-500/30' };
}

// ── Export utilities ─────────────────────────────────────────────────────────

/**
 * Triggers a browser download of the visible rows as a UTF-8 CSV file
 * (BOM-prefixed for Excel compatibility).
 */
export function downloadCSV(filename: string, columns: ColumnDef[], rows: string[][]): void {
  const escape = (s: string) => {
    const needsQuotes = /[",\n]/.test(s);
    const v = s.replace(/"/g, '""');
    return needsQuotes ? `"${v}"` : v;
  };
  const header = columns.map((c) => escape(c.label)).join(',');
  const body = rows
    .map((r) => columns.map((c) => escape(r[c.index] ?? '')).join(','))
    .join('\n');
  const csv = `${header}\n${body}`;
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Builds a TSV string suitable for pasting directly into Excel. */
export function buildTSV(columns: ColumnDef[], rows: string[][]): string {
  const header = columns.map((c) => c.label).join('\t');
  const body = rows
    .map((r) => columns.map((c) => (r[c.index] ?? '').replace(/\t/g, ' ')).join('\t'))
    .join('\n');
  return `${header}\n${body}`;
}
