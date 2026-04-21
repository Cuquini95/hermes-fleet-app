/**
 * PedidoRowCard — displays a submitted order row in the historial / Gerencia view.
 * Gerencia users can advance the status through Pendiente → Pedido → Completado.
 */

import { useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { updateCell, SHEET_TABS } from '../../lib/sheets-api';

// ── Status flow ───────────────────────────────────────────────────────────────

const STATUS_NEXT: Record<string, string | null> = {
  Pendiente:  'Pedido',
  Pedido:     'Completado',
  Completado: null,
};

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  Pendiente:  { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  Pedido:     { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  Completado: { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
};

const STATUS_LABEL: Record<string, string> = {
  Pendiente:  'Marcar como Pedido',
  Pedido:     'Marcar Completado',
  Completado: '',
};

const URGENCIA_CONFIG: Record<string, { color: string; bg: string }> = {
  Normal:  { color: '#16A34A', bg: '#F0FDF4' },
  Urgente: { color: '#D97706', bg: '#FFFBEB' },
  Crítico: { color: '#DC2626', bg: '#FEF2F2' },
};

// ── Types ────────────────────────────────────────────────────────────────────

/** A single row from the Cotizaciones_Pendientes sheet. */
export interface PedidoRow {
  id: string;
  pedidoId: string;
  fecha: string;
  hora: string;
  solicitante: string;
  partNum: string;
  descripcion: string;
  equipo: string;
  cantidad: string;
  precioUnit: string;
  total: string;
  urgencia: string;
  fuente: string;
  notas: string;
  estado: string;
}

interface PedidoRowCardProps {
  row: PedidoRow;
  isGerencia: boolean;
  onStatusChange: (id: string, newStatus: string) => void;
}

/** Card that shows a submitted order row, with optional status advance button for Gerencia. */
export function PedidoRowCard({ row, isGerencia, onStatusChange }: PedidoRowCardProps) {
  const [updating, setUpdating] = useState(false);
  const urgCfg = URGENCIA_CONFIG[row.urgencia] ?? URGENCIA_CONFIG['Normal']!;
  const sCfg = STATUS_STYLE[row.estado] ?? STATUS_STYLE['Pendiente']!;
  const nextStatus = STATUS_NEXT[row.estado] ?? null;

  async function handleAdvance() {
    if (!nextStatus || updating) return;
    setUpdating(true);
    try {
      // Column J (index 9) = PEDIDO_ID; Column G (index 6) = Status
      await updateCell(SHEET_TABS.COTIZACIONES, 9, row.pedidoId, 6, nextStatus);
      onStatusChange(row.id, nextStatus);
    } catch {
      // Silently fail — optimistic update is not applied, user can retry.
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div
      className="bg-white rounded-xl shadow-sm overflow-hidden"
      style={{ border: `1.5px solid ${sCfg.border}` }}
    >
      {/* Status bar */}
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{ backgroundColor: sCfg.bg }}
      >
        <span className="text-xs font-bold" style={{ color: sCfg.color }}>
          {row.estado}
        </span>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ color: urgCfg.color, backgroundColor: urgCfg.bg }}
        >
          {row.urgencia}
        </span>
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="mb-2">
          <p className="font-mono text-sm font-semibold text-amber">{row.partNum}</p>
          <p className="text-sm text-text font-medium">{row.descripcion}</p>
          <p className="text-xs text-text-secondary mt-0.5">
            {row.pedidoId} · {row.fecha} · {row.solicitante}
          </p>
        </div>
        <div className="flex gap-4 text-xs text-text-secondary mb-3">
          {row.equipo && <span>📍 {row.equipo}</span>}
          <span>×{row.cantidad}</span>
          {row.total && <span className="font-semibold text-text">${row.total}</span>}
          {row.fuente && <span>{row.fuente}</span>}
        </div>
        {row.notas && <p className="text-xs text-text-secondary mb-3 italic">{row.notas}</p>}

        {/* Gerencia status advance */}
        {isGerencia && nextStatus && (
          <button
            onClick={handleAdvance}
            disabled={updating}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-opacity"
            style={{
              backgroundColor: STATUS_STYLE[nextStatus]?.bg ?? '#F1F5F9',
              color: STATUS_STYLE[nextStatus]?.color ?? '#162252',
              border: `1.5px solid ${STATUS_STYLE[nextStatus]?.border ?? '#E5E7EB'}`,
              opacity: updating ? 0.6 : 1,
            }}
          >
            {updating ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <>
                <ArrowRight size={15} />
                {STATUS_LABEL[row.estado]}
              </>
            )}
          </button>
        )}

        {isGerencia && row.estado === 'Completado' && (
          <div
            className="flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold"
            style={{ color: '#16A34A' }}
          >
            <CheckCircle2 size={14} />
            Pedido completado
          </div>
        )}
      </div>
    </div>
  );
}
