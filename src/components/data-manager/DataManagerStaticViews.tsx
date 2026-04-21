/**
 * Stateless display components for the DataManager page:
 * SkeletonTable, EmptyState, and ErrorState.
 */

import { AlertCircle, Database, Loader2, RefreshCw } from 'lucide-react';
import type { ColumnDef } from './data-manager-types';

// ── SkeletonTable ────────────────────────────────────────────────────────────

interface SkeletonTableProps {
  columns: ColumnDef[];
}

/** Animated placeholder shown while data is loading for the first time. */
export function SkeletonTable({ columns }: SkeletonTableProps) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#F8FAFC]">
              {columns.map((col, i) => (
                <th
                  key={i}
                  className={`px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-[#162252] border-b-2 border-[#162252]/20 text-left ${
                    col.hideOnMobile ? 'hidden md:table-cell' : ''
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'}>
                {columns.map((col, ci) => (
                  <td
                    key={ci}
                    className={`px-3 py-3 border-b border-[#E5E7EB] ${
                      col.hideOnMobile ? 'hidden md:table-cell' : ''
                    }`}
                  >
                    <div
                      className="h-3 rounded bg-[#E5E7EB] animate-pulse"
                      style={{ width: `${40 + ((ri * 7 + ci * 13) % 50)}%` }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-center gap-2 py-3 text-xs text-[#9CA3AF] border-t border-[#E5E7EB]">
        <Loader2 size={13} className="animate-spin" />
        Cargando datos…
      </div>
    </div>
  );
}

// ── EmptyState ───────────────────────────────────────────────────────────────

interface EmptyStateProps {
  message: string;
}

/** Displayed when the collection has no rows (or no search results). */
export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-[#E5E7EB] bg-white py-16 flex flex-col items-center gap-3">
      <div className="w-12 h-12 rounded-full bg-[#162252]/10 flex items-center justify-center ring-1 ring-[#162252]/20">
        <Database size={20} className="text-[#162252]" />
      </div>
      <p className="text-sm text-[#6B7280]">{message}</p>
    </div>
  );
}

// ── ErrorState ───────────────────────────────────────────────────────────────

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

/** Displayed when a sheet load fails, with a retry button. */
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 py-12 flex flex-col items-center gap-3 px-6 text-center">
      <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center ring-1 ring-red-500/30">
        <AlertCircle size={20} className="text-red-400" />
      </div>
      <div>
        <p className="text-sm font-semibold text-red-400">Error al cargar</p>
        <p className="text-xs text-[#6B7280] mt-1 max-w-sm break-words">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#162252] text-white text-xs font-semibold hover:bg-[#1E3A8A] transition-colors"
      >
        <RefreshCw size={13} />
        Reintentar
      </button>
    </div>
  );
}
