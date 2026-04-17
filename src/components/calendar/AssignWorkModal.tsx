/**
 * AssignWorkModal
 *
 * Lightweight modal for scheduling a work order to a mechanic on a given day.
 *
 * On save: appendRow to WORKSHOP_SCHEDULE
 * Optionally updates mecanico_asignado on the OT via updateOTField.
 *
 * Props:
 *   mechanic   — pre-filled from clicked cell
 *   date       — pre-filled from clicked cell (Date object)
 *   mechanics  — list of available mechanics for the dropdown
 *   workorders — filtered list of open/pending OTs for the dropdown
 *   onSave     — callback after successful save
 *   onClose    — callback to dismiss
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import { appendRow, SHEET_TABS } from '../../lib/sheets-api';
import { useWorkOrderStore } from '../../stores/workorder-store';
import { useAuthStore } from '../../stores/auth-store';
import type { WorkOrder } from '../../types/workorder';
import type { ScheduleEntry } from '../../pages/CalendarPage';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AssignWorkModalProps {
  mechanic: string;
  date: Date;
  mechanics: string[];
  workorders: WorkOrder[];
  onSave: (entry: ScheduleEntry) => void;
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

// ── Assignable OT statuses ─────────────────────────────────────────────────

const ASSIGNABLE_ESTADOS = new Set(['Abierta', 'En Espera de Asignación', 'En Reparación']);

// ── Component ─────────────────────────────────────────────────────────────────

export default function AssignWorkModal({
  mechanic: initialMechanic,
  date,
  mechanics,
  workorders,
  onSave,
  onClose,
}: AssignWorkModalProps) {
  const updateOTField = useWorkOrderStore((s) => s.updateOTField);
  const userName = useAuthStore((s) => s.userName);
  const role = useAuthStore((s) => s.role);

  const [selectedOT, setSelectedOT] = useState('');
  const [selectedMechanic, setSelectedMechanic] = useState(initialMechanic);
  const [hours, setHours] = useState('2');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assignableOTs = workorders.filter((wo) => ASSIGNABLE_ESTADOS.has(wo.estado));
  const selectedWO = assignableOTs.find((wo) => wo.ot_id === selectedOT);
  const dateISO = toISO(date);

  async function handleSave() {
    if (!selectedOT) { setError('Selecciona una OT'); return; }
    if (!selectedMechanic) { setError('Selecciona un mecánico'); return; }
    const parsedHours = parseFloat(hours);
    if (isNaN(parsedHours) || parsedHours <= 0) {
      setError('Ingresa horas válidas (> 0)');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const wo = assignableOTs.find((w) => w.ot_id === selectedOT);
      const entry: ScheduleEntry = {
        fecha_programada: dateISO,
        ot_id: selectedOT,
        unidad: wo?.unidad ?? '',
        mecanico: selectedMechanic,
        horas_estimadas: parsedHours,
        prioridad: wo?.prioridad ?? 'MEDIA',
        estado: 'Programado',
        notas: notes,
      };

      // Append to WORKSHOP_SCHEDULE tab
      // Columns: #, FECHA_PROGRAMADA, OT_ID, UNIDAD, MECANICO, HORAS_ESTIMADAS, PRIORIDAD, ESTADO, NOTAS
      await appendRow(SHEET_TABS.WORKSHOP_SCHEDULE, [
        '',               // # — auto or left blank; server can fill
        dateISO,
        selectedOT,
        entry.unidad,
        selectedMechanic,
        String(parsedHours),
        entry.prioridad,
        'Programado',
        notes,
      ]);

      // Optionally sync mecanico_asignado on the OT itself
      if (wo && wo.mecanico_asignado !== selectedMechanic) {
        await updateOTField(
          selectedOT,
          'mecanico_asignado',
          selectedMechanic,
          userName || 'sistema',
          role ?? 'sistema',
        );
      }

      onSave(entry);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      onClick={onClose}
    >
      {/* Panel */}
      <div
        className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-[#162252]">Asignar trabajo</h2>
            <p className="text-xs text-slate-500 capitalize">{formatDateLabel(date)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-3">
          {/* OT selector */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Orden de Trabajo
            </label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedOT}
              onChange={(e) => setSelectedOT(e.target.value)}
            >
              <option value="">-- Selecciona OT --</option>
              {assignableOTs.map((wo) => (
                <option key={wo.ot_id} value={wo.ot_id}>
                  {wo.ot_id} · {wo.unidad} · {wo.tipo_averia}
                </option>
              ))}
            </select>
            {assignableOTs.length === 0 && (
              <p className="text-xs text-slate-400 mt-1">
                No hay OTs abiertas disponibles.
              </p>
            )}
          </div>

          {/* Selected OT details */}
          {selectedWO && (
            <div className="text-xs bg-slate-50 rounded-lg px-3 py-2 text-slate-600 space-y-0.5">
              <div><span className="font-medium">Unidad:</span> {selectedWO.unidad}</div>
              <div><span className="font-medium">Avería:</span> {selectedWO.tipo_averia}</div>
              <div><span className="font-medium">Prioridad:</span> {selectedWO.prioridad}</div>
            </div>
          )}

          {/* Mechanic selector */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Mecánico
            </label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedMechanic}
              onChange={(e) => setSelectedMechanic(e.target.value)}
            >
              <option value="">-- Selecciona mecánico --</option>
              {mechanics.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Hours */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Horas estimadas
            </label>
            <input
              type="number"
              min="0.5"
              max="12"
              step="0.5"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Notas (opcional)
            </label>
            <input
              type="text"
              maxLength={120}
              placeholder="Observaciones para el mecánico..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{error}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#162252] text-white text-sm font-semibold hover:bg-[#1e3275] disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Programar'}
          </button>
        </div>
      </div>
    </div>
  );
}
