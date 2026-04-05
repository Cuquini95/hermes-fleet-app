import type { PartResult } from '../../lib/hermes-api';

interface PartCardProps {
  part: PartResult;
}

export default function PartCard({ part }: PartCardProps) {
  const stockStatus =
    part.stock_quantity === 0
      ? { label: 'Agotado', color: '#DC2626', bg: '#FEE2E2' }
      : part.stock_quantity <= part.stock_minimum
      ? { label: `Bajo: ${part.stock_quantity}`, color: '#2563EB', bg: '#FEF3C7' }
      : { label: `En stock: ${part.stock_quantity}`, color: '#16A34A', bg: '#DCFCE7' };

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-4 mb-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Row 1: part number + description */}
          <div className="flex items-baseline gap-2 flex-wrap mb-1">
            <span className="font-mono font-semibold text-amber text-sm">{part.part_number}</span>
            <span className="text-sm font-medium text-text truncate">{part.description}</span>
          </div>

          {/* Row 2: OEM ref + location */}
          <div className="flex gap-3 text-xs text-text-secondary mb-1 flex-wrap">
            <span>OEM: {part.oem_ref}</span>
            <span>Ubicación: {part.location}</span>
          </div>

          {/* Row 3: alternatives */}
          {part.alternatives.length > 0 && (
            <p className="text-xs text-amber">
              Alternativas: {part.alternatives.join(', ')}
            </p>
          )}
        </div>

        {/* Right: stock badge + price */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
            style={{ color: stockStatus.color, backgroundColor: stockStatus.bg }}
          >
            {stockStatus.label}
          </span>
          <span className="text-sm font-bold text-text">${part.unit_price.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
