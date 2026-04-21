/**
 * DataTable — interactive spreadsheet-style table for the DataManager page.
 * Supports inline editing, row selection, flash feedback, and virtual paging.
 */

import { useEffect, useRef } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import {
  formatCurrency,
  severityBadge,
  statusBadge,
  resultadoBadge,
} from './data-manager-helpers';
import type {
  ColumnAlign,
  ColumnDef,
  EditingCell,
  FlashCell,
  SavingCell,
} from './data-manager-types';

// ── renderCell ───────────────────────────────────────────────────────────────

/**
 * Renders a single cell value: handles empty, currency, and badge display modes.
 */
function renderCell(raw: string, col: ColumnDef) {
  if (!raw) {
    return <span className="text-[#9CA3AF]">—</span>;
  }
  if (col.currency) {
    return <span className="text-[#1A2B2B]">{formatCurrency(raw)}</span>;
  }
  if (col.badge === 'severity') {
    const style = severityBadge(raw);
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${style.bg} ${style.text} ${style.ring}`}
      >
        {raw}
      </span>
    );
  }
  if (col.badge === 'status') {
    const style = statusBadge(raw);
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${style.bg} ${style.text} ${style.ring}`}
      >
        {raw}
      </span>
    );
  }
  if (col.badge === 'resultado') {
    const style = resultadoBadge(raw);
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${style.bg} ${style.text} ${style.ring}`}
      >
        {raw}
      </span>
    );
  }
  return raw;
}

// ── EditableInput ────────────────────────────────────────────────────────────

interface EditableInputProps {
  value: string;
  align?: ColumnAlign;
  mono?: boolean;
  onChange: (value: string) => void;
  onSave: (value: string) => void;
  onCancel: () => void;
}

/** Auto-focuses inline editor; uses a textarea for long values. */
function EditableInput({
  value,
  align,
  mono,
  onChange,
  onSave,
  onCancel,
}: EditableInputProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const isLongText = value.length > 40;

  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.focus();
      if ('select' in el) el.select();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const baseClasses = [
    'w-full border-0 outline-none bg-transparent text-[#1A2B2B] text-sm p-0',
    align === 'right' ? 'text-right' : 'text-left',
    mono ? 'font-mono text-[13px]' : '',
  ].join(' ');

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSave((e.target as HTMLInputElement | HTMLTextAreaElement).value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }

  if (isLongText) {
    return (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        value={value}
        rows={2}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onSave(e.target.value)}
        onKeyDown={handleKeyDown}
        className={`${baseClasses} resize-none`}
      />
    );
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onSave(e.target.value)}
      onKeyDown={handleKeyDown}
      className={baseClasses}
    />
  );
}

// ── DataTable ────────────────────────────────────────────────────────────────

export interface DataTableProps {
  columns: ColumnDef[];
  rows: string[][];
  editingCell: EditingCell;
  savingCell: SavingCell;
  flashCell: FlashCell;
  onCellClick: (rowIndex: number, colIndex: number, value: string) => void;
  onCellChange: (value: string) => void;
  onCellSave: (rowIndex: number, colIndex: number, value: string) => void;
  onCellCancel: () => void;
  selectedRows: Set<number>;
  onToggleRow: (rowIndex: number) => void;
  onToggleAll: () => void;
}

/** Full interactive data table with inline editing and row selection. */
export function DataTable({
  columns,
  rows,
  editingCell,
  savingCell,
  flashCell,
  onCellClick,
  onCellChange,
  onCellSave,
  onCellCancel,
  selectedRows,
  onToggleRow,
  onToggleAll,
}: DataTableProps) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#F8FAFC]">
              <th className="w-10 px-3 py-3 border-b-2 border-[#162252]/20 bg-[#F8FAFC]">
                <input
                  type="checkbox"
                  checked={rows.length > 0 && selectedRows.size === rows.length}
                  onChange={onToggleAll}
                  className="w-4 h-4 rounded accent-[#162252] cursor-pointer"
                />
              </th>
              {columns.map((col, i) => (
                <th
                  key={i}
                  style={{ minWidth: col.minWidth }}
                  className={[
                    'px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-[#162252]',
                    'border-b-2 border-[#162252]/20',
                    col.align === 'right' ? 'text-right' : 'text-left',
                    col.sticky ? 'sticky left-0 bg-[#F8FAFC] z-20 border-r border-[#E5E7EB]' : '',
                    col.hideOnMobile ? 'hidden md:table-cell' : '',
                  ].join(' ')}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={ri}
                className={`group transition-colors ${
                  selectedRows.has(ri)
                    ? 'bg-blue-50 ring-1 ring-inset ring-blue-200'
                    : ri % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'
                } hover:bg-[#EFF6FF]`}
              >
                <td className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedRows.has(ri)}
                    onChange={() => onToggleRow(ri)}
                    className="w-4 h-4 rounded accent-[#162252] cursor-pointer"
                  />
                </td>
                {columns.map((col, ci) => {
                  const raw = row[col.index] ?? '';
                  const isEditable = !col.sticky && !col.badge;
                  const isEditing =
                    editingCell?.rowIndex === ri && editingCell?.colIndex === ci;
                  const isSaving =
                    savingCell?.rowIndex === ri && savingCell?.colIndex === ci;
                  const flash =
                    flashCell?.rowIndex === ri && flashCell?.colIndex === ci
                      ? flashCell.type
                      : null;

                  let flashClass = '';
                  if (flash === 'success') {
                    flashClass = 'bg-[#F0FDF4] ring-1 ring-inset ring-[#16A34A]';
                  } else if (flash === 'error') {
                    flashClass = 'bg-[#FEF2F2] ring-1 ring-inset ring-[#DC2626]';
                  }

                  const baseClasses = [
                    'relative px-3 py-2.5 text-[#1A2B2B] border-b border-[#F3F4F6] whitespace-nowrap transition-colors',
                    col.align === 'right' ? 'text-right' : 'text-left',
                    col.mono ? 'font-mono text-[13px]' : '',
                    col.sticky
                      ? `sticky left-0 z-[1] border-r border-[#E5E7EB] font-medium text-[#1A2B2B] ${
                          ri % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'
                        } group-hover:bg-[#EFF6FF]`
                      : '',
                    col.hideOnMobile ? 'hidden md:table-cell' : '',
                    isEditable && !isEditing && !isSaving
                      ? 'cursor-pointer hover:bg-[#EFF6FF] hover:ring-1 hover:ring-inset hover:ring-[#162252]/30'
                      : '',
                    isEditing
                      ? 'bg-white ring-2 ring-inset ring-[#162252] shadow-sm'
                      : '',
                    flashClass,
                  ].join(' ');

                  if (isEditing && editingCell) {
                    return (
                      <td key={ci} className={baseClasses}>
                        <EditableInput
                          value={editingCell.value}
                          align={col.align}
                          mono={col.mono}
                          onChange={onCellChange}
                          onSave={(v) => onCellSave(ri, ci, v)}
                          onCancel={onCellCancel}
                        />
                      </td>
                    );
                  }

                  if (isSaving) {
                    return (
                      <td key={ci} className={baseClasses}>
                        <span className="inline-flex items-center gap-1.5 text-[#9CA3AF]">
                          <Loader2 size={12} className="animate-spin" />
                          <span className="text-xs">{raw || '—'}</span>
                        </span>
                      </td>
                    );
                  }

                  return (
                    <td
                      key={ci}
                      className={`group/cell ${baseClasses}`}
                      onClick={isEditable ? () => onCellClick(ri, ci, raw) : undefined}
                    >
                      {renderCell(raw, col)}
                      {isEditable && (
                        <Pencil
                          size={11}
                          className="absolute top-1 right-1 text-[#162252]/60 opacity-0 group-hover/cell:opacity-100 transition-opacity pointer-events-none"
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
