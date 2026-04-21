/**
 * ManualPartForm — inline form for adding a part to the cart without
 * a catalog lookup. Supports typeahead suggestions from the local catalog.
 */

import { useState } from 'react';
import { useCatalogoStore } from '../../stores/catalogo-store';

/** Form field values for a manually-entered part. */
export interface ManualForm {
  part_number: string;
  description: string;
  quantity: string;
  unit_price: string;
  equipment: string;
  urgencia: 'Normal' | 'Urgente' | 'Crítico';
  notes: string;
}

/** Returns an empty ManualForm. */
export function emptyManual(): ManualForm {
  return {
    part_number: '',
    description: '',
    quantity: '1',
    unit_price: '0',
    equipment: '',
    urgencia: 'Normal',
    notes: '',
  };
}

interface ManualPartFormProps {
  form: ManualForm;
  errors: Partial<ManualForm>;
  onChange: (f: ManualForm) => void;
  onAdd: () => void;
  onCancel: () => void;
  unitIds: string[];
}

/** Form component for manually entering a spare-parts order line. */
export function ManualPartForm({
  form,
  errors,
  onChange,
  onAdd,
  onCancel,
  unitIds,
}: ManualPartFormProps) {
  const { search: searchCatalog } = useCatalogoStore();
  const [suggestions, setSuggestions] = useState<ReturnType<typeof searchCatalog>>([]);

  const f =
    (field: keyof ManualForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      onChange({ ...form, [field]: e.target.value });

  function handleSearchInput(value: string) {
    onChange({ ...form, description: value });
    setSuggestions(value.length >= 2 ? searchCatalog(value) : []);
  }

  function handlePartNumberInput(value: string) {
    onChange({ ...form, part_number: value });
    setSuggestions(value.length >= 2 ? searchCatalog(value) : []);
  }

  function applySuggestion(s: ReturnType<typeof searchCatalog>[0]) {
    onChange({
      ...form,
      part_number: s.clave.includes('_') ? '' : s.clave,
      description: s.descripcion,
      unit_price: s.precio > 0 ? String(s.precio) : form.unit_price,
    });
    setSuggestions([]);
  }

  return (
    <div
      className="rounded-xl border-2 p-4 flex flex-col gap-3 animate-fade-up"
      style={{ borderColor: '#2563EB', backgroundColor: '#EFF6FF' }}
    >
      <p className="font-semibold text-sm" style={{ color: '#1E3A8A' }}>
        ➕ Agregar parte manualmente
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">N° de Parte *</label>
          <input
            type="text"
            value={form.part_number}
            onChange={(e) => handlePartNumberInput(e.target.value)}
            placeholder="Ej: 6745-11-3102"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text"
          />
          {errors.part_number && <p className="text-xs text-red-500 mt-0.5">{errors.part_number}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">Cantidad *</label>
          <input
            type="number"
            min={1}
            value={form.quantity}
            onChange={f('quantity')}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text"
          />
          {errors.quantity && <p className="text-xs text-red-500 mt-0.5">{errors.quantity}</p>}
        </div>
      </div>

      <div className="relative">
        <label className="block text-xs font-semibold text-text-secondary mb-1">Descripción *</label>
        <input
          type="text"
          value={form.description}
          onChange={(e) => handleSearchInput(e.target.value)}
          placeholder="Nombre o descripción de la parte"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text"
          autoComplete="off"
        />
        {errors.description && <p className="text-xs text-red-500 mt-0.5">{errors.description}</p>}

        {/* Catalog suggestions dropdown */}
        {suggestions.length > 0 && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg overflow-hidden">
            {suggestions.map((s) => (
              <button
                key={s.clave}
                type="button"
                onMouseDown={() => applySuggestion(s)}
                className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-gray-50 last:border-0"
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="text-xs font-semibold text-text leading-tight">{s.descripcion}</p>
                    {!s.clave.includes('_') && (
                      <p className="text-xs text-blue-600 font-mono">{s.clave}</p>
                    )}
                    <p className="text-xs text-text-secondary">{s.proveedor}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold text-green-600">${s.precio.toFixed(2)}</p>
                    {s.precioMin !== s.precioMax && (
                      <p className="text-xs text-gray-400">${s.precioMin.toFixed(0)}–${s.precioMax.toFixed(0)}</p>
                    )}
                    <p className="text-xs text-gray-400">×{s.vecesComprado}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">Precio Unit. ($)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.unit_price}
            onChange={f('unit_price')}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">Urgencia</label>
          <select
            value={form.urgencia}
            onChange={f('urgencia')}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text"
          >
            <option>Normal</option>
            <option>Urgente</option>
            <option>Crítico</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-1">Equipo / Unidad</label>
        <select
          value={form.equipment}
          onChange={f('equipment')}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text"
        >
          <option value="">Sin asignar</option>
          {unitIds.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-1">Notas</label>
        <input
          type="text"
          value={form.notes}
          onChange={f('notes')}
          placeholder="Referencia, avería relacionada..."
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={onAdd}
          className="flex-1 py-2.5 rounded-xl font-semibold text-white text-sm"
          style={{ backgroundColor: '#162252' }}
        >
          Agregar al carrito
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl font-semibold text-sm border"
          style={{ borderColor: '#D1D5DB', color: '#6B7280' }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
