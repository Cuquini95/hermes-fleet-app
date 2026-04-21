/**
 * LineItemsEditor — editable list of invoice line items (part number,
 * description, quantity, unit price, and computed subtotal).
 */

import { Plus, Trash2 } from 'lucide-react';
import type { OcrLineItem } from '../../lib/sheets-api';

interface LineItemsEditorProps {
  items: OcrLineItem[];
  onUpdate: (index: number, patch: Partial<OcrLineItem>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

/** Renders and allows inline editing of a list of OCR-extracted or manual line items. */
export function LineItemsEditor({ items, onUpdate, onAdd, onRemove }: LineItemsEditorProps) {
  return (
    <div className="bg-white rounded-xl border border-border p-4 shadow-sm flex flex-col gap-3">
      <p className="text-sm font-semibold text-text">Líneas del Recibo</p>

      {items.map((item, i) => (
        <div key={i} className="border border-border rounded-lg p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary font-medium">Línea {i + 1}</span>
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="text-red-400 hover:text-red-600"
                aria-label={`Eliminar línea ${i + 1}`}
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            )}
          </div>

          <input
            value={item.part_number}
            onChange={(e) => onUpdate(i, { part_number: e.target.value })}
            placeholder="Número de parte (opcional)"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm font-mono"
          />
          <input
            value={item.description}
            onChange={(e) => onUpdate(i, { description: e.target.value })}
            placeholder="Descripción *"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm"
            required
          />

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Cant.</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={item.qty || ''}
                onChange={(e) => onUpdate(i, { qty: parseFloat(e.target.value) || 0 })}
                className="w-full border border-border rounded-lg px-2 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Precio u.</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.unit_price || ''}
                onChange={(e) => onUpdate(i, { unit_price: parseFloat(e.target.value) || 0 })}
                className="w-full border border-border rounded-lg px-2 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Subtotal</label>
              <div className="w-full border border-border rounded-lg px-2 py-2 text-sm bg-gray-50">
                ${item.subtotal.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-2 text-sm text-amber font-medium py-2"
      >
        <Plus size={16} /> Agregar línea
      </button>
    </div>
  );
}
