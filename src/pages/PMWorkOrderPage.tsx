import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wrench, Package, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { EQUIPMENT_CATALOG } from '../data/equipment-catalog';
import { getNextPM } from '../data/pm-rules';
import { getCumulativePMParts, getAvailablePMLevels, type PMPart } from '../data/pm-parts-catalog';
import { generateOTId } from '../lib/ot-generator';
import { mexicoDate } from '../lib/date-utils';
import { appendRow, SHEET_TABS } from '../lib/sheets-api';
import { useAuthStore } from '../stores/auth-store';
import ConfirmModal from '../components/ui/ConfirmModal';
import SuccessToast from '../components/ui/SuccessToast';

const CATEGORY_ICONS: Record<string, string> = {
  Filtro: '🔧',
  Aceite: '🛢️',
  Grasa: '🧴',
  Correa: '⛓️',
  Refrigerante: '❄️',
  Otro: '📦',
};

const CATEGORY_ORDER: string[] = ['Filtro', 'Aceite', 'Grasa', 'Correa', 'Refrigerante', 'Otro'];

function groupByCategory(parts: PMPart[]): Record<string, PMPart[]> {
  const groups: Record<string, PMPart[]> = {};
  for (const part of parts) {
    if (!groups[part.category]) groups[part.category] = [];
    groups[part.category].push(part);
  }
  return groups;
}

export default function PMWorkOrderPage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);

  const [unidad, setUnidad] = useState('');
  const [pmLevel, setPmLevel] = useState('');
  const [mecanico, setMecanico] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const selectedEquipment = EQUIPMENT_CATALOG.find((eq) => eq.unit_id === unidad);
  const model = selectedEquipment?.model ?? '';

  // Get PM proximity info for selected unit
  const pmInfo = useMemo(() => {
    if (!selectedEquipment) return null;
    return getNextPM(selectedEquipment.model, selectedEquipment.current_horometro);
  }, [selectedEquipment]);

  // Available PM levels for selected model
  const availableLevels = useMemo(() => getAvailablePMLevels(model), [model]);

  // Auto-suggest the recommended PM level when unit changes
  const suggestedLevel = pmInfo?.level ?? '';

  // Cumulative parts for selected level
  const partsKit = useMemo(() => {
    if (!model || !pmLevel) return null;
    return getCumulativePMParts(model, pmLevel);
  }, [model, pmLevel]);

  const groupedParts = useMemo(() => {
    if (!partsKit) return {};
    return groupByCategory(partsKit.parts);
  }, [partsKit]);

  const canSubmit = unidad !== '' && pmLevel !== '';

  function handleUnitChange(newUnit: string) {
    setUnidad(newUnit);
    setPmLevel('');
  }

  function handleLevelSelect(level: string) {
    setPmLevel(level);
  }

  function useSuggested() {
    if (suggestedLevel) setPmLevel(suggestedLevel);
  }

  function handleSubmitIntent() {
    if (!canSubmit) return;
    setShowConfirm(true);
  }

  async function handleConfirm() {
    setShowConfirm(false);

    const otId = generateOTId();
    const date = mexicoDate();
    const partsListStr = partsKit
      ? partsKit.parts.map((p) => `${p.partNumber} x${p.quantity}`).join(', ')
      : '';
    const levelsStr = partsKit ? partsKit.levelsIncluded.join('+') : pmLevel;

    // Write to ORDENES_TRABAJO
    try {
      await appendRow(SHEET_TABS.ORDENES_TRABAJO, [
        String(Date.now()),               // #
        otId,                              // OT_ID
        date,                              // FECHA
        unidad,                            // UNIDAD
        `PM - ${levelsStr}`,               // TIPO_AVERÍA
        `Mantenimiento Preventivo ${pmLevel} para ${model}. Hrs: ${selectedEquipment?.current_horometro ?? ''}. Incluye: ${levelsStr}`, // DESCRIPCIÓN
        'Preventivo',                      // SEVERIDAD
        'Programada',                      // PRIORIDAD
        mecanico,                          // MECÁNICO_ASIGNADO
        'Programada',                      // ESTADO
        '',                                // FOTO_URL
        '',                                // AVERÍA_REF
        partsListStr,                      // PARTES_NECESARIAS
        '',                                // COSTO_ESTIMADO
        '',                                // FECHA_CIERRE
        observaciones,                     // OBSERVACIONES
      ]);
    } catch (err) {
      console.error('Sheets append failed (PM OT):', err);
    }

    // Write to Historial PM
    try {
      await appendRow(SHEET_TABS.HISTORIAL_PM, [
        date,                                     // FECHA
        otId,                                     // OT_ID
        unidad,                                   // UNIDAD
        model,                                    // MODELO
        pmLevel,                                  // NIVEL PM
        levelsStr,                                // NIVELES INCLUIDOS
        String(selectedEquipment?.current_horometro ?? ''), // HORÓMETRO
        String(partsKit?.totalEstimatedHours ?? ''),        // HORAS ESTIMADAS
        mecanico || 'Por asignar',                // MECÁNICO
        userName,                                 // AUTORIZADO POR
        'Programada',                             // ESTADO
        partsListStr,                             // PARTES
        observaciones,                            // OBSERVACIONES
      ]);
    } catch (err) {
      console.error('Sheets append failed (PM History):', err);
    }

    setToastMessage(`${otId} — PM ${pmLevel} programado para ${unidad}`);
    setToastVisible(true);
  }

  function handleToastDismiss() {
    setToastVisible(false);
    navigate(-1);
  }

  return (
    <div className="flex flex-col pb-4 animate-fade-up">
      <SuccessToast
        message={toastMessage}
        visible={toastVisible}
        onDismiss={handleToastDismiss}
      />

      <ConfirmModal
        open={showConfirm}
        title="Activar Orden de Mantenimiento"
        message={`¿Generar OT de ${pmLevel} para ${unidad} (${model})?\n\nSe ordenarán ${partsKit?.parts.length ?? 0} refacciones automáticamente.`}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-text">Orden de PM</h1>
          <p className="text-xs text-text-secondary">Genera OT + ordena refacciones automáticamente</p>
        </div>
      </div>

      {/* Step 1: Select Unit */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border mb-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-amber text-white flex items-center justify-center text-xs font-bold">1</div>
          <span className="font-semibold text-text">Seleccionar Equipo</span>
        </div>
        <select
          value={unidad}
          onChange={(e) => handleUnitChange(e.target.value)}
          className="w-full rounded-xl border border-border p-3 bg-white text-text"
        >
          <option value="">Seleccionar unidad...</option>
          {EQUIPMENT_CATALOG.map((eq) => (
            <option key={eq.unit_id} value={eq.unit_id}>
              {eq.unit_id} — {eq.model} ({eq.current_horometro.toLocaleString()} hrs)
            </option>
          ))}
        </select>

        {/* PM proximity card */}
        {pmInfo && selectedEquipment && (
          <div className={`mt-3 rounded-xl p-3 border flex items-center gap-3 ${
            pmInfo.hours_remaining <= 0
              ? 'bg-red-50 border-critical'
              : pmInfo.hours_remaining <= 50
              ? 'bg-amber-50 border-amber'
              : 'bg-blue-50 border-blue-300'
          }`}>
            <Clock size={18} className={
              pmInfo.hours_remaining <= 0 ? 'text-critical' :
              pmInfo.hours_remaining <= 50 ? 'text-amber' : 'text-blue-500'
            } />
            <div className="flex-1">
              <p className="text-sm font-medium text-text">
                Próximo: {pmInfo.level} a {pmInfo.due_at.toLocaleString()} hrs
              </p>
              <p className="text-xs text-text-secondary">
                {pmInfo.hours_remaining <= 0
                  ? `VENCIDO ${Math.abs(pmInfo.hours_remaining)} hrs`
                  : `Faltan ${pmInfo.hours_remaining} hrs`}
              </p>
            </div>
            <button
              type="button"
              onClick={useSuggested}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber text-white whitespace-nowrap"
            >
              Usar {pmInfo.level}
            </button>
          </div>
        )}
      </div>

      {/* Step 2: Select PM Level */}
      {unidad && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-border mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-amber text-white flex items-center justify-center text-xs font-bold">2</div>
            <span className="font-semibold text-text">Nivel de PM</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {availableLevels.map((level) => {
              const isSelected = pmLevel === level;
              const isSuggested = level === suggestedLevel;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => handleLevelSelect(level)}
                  className={`relative px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                    isSelected
                      ? 'bg-amber text-white border-amber'
                      : 'bg-white text-text-secondary border-border hover:border-amber'
                  }`}
                >
                  {level}
                  {isSuggested && !isSelected && (
                    <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-amber rounded-full border-2 border-white" />
                  )}
                </button>
              );
            })}
          </div>
          {pmLevel && (
            <p className="text-xs text-text-secondary mt-2">
              Incluye: {partsKit?.levelsIncluded.join(' + ')} — ~{partsKit?.totalEstimatedHours ?? 0} hrs estimadas
            </p>
          )}
        </div>
      )}

      {/* Step 3: Auto-populated parts list */}
      {partsKit && partsKit.parts.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-border mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-amber text-white flex items-center justify-center text-xs font-bold">3</div>
            <span className="font-semibold text-text">Refacciones ({partsKit.parts.length})</span>
            <CheckCircle size={16} className="text-success ml-auto" />
            <span className="text-xs text-success font-medium">Auto-generado</span>
          </div>

          {CATEGORY_ORDER.filter((cat) => groupedParts[cat]).map((category) => (
            <div key={category} className="mb-3 last:mb-0">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-sm">{CATEGORY_ICONS[category]}</span>
                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  {category}
                </span>
              </div>
              {groupedParts[category].map((part, idx) => (
                <div
                  key={`${part.partNumber}-${idx}`}
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg mb-1 last:mb-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text truncate">{part.description}</p>
                    <p className="text-xs text-amber font-mono">{part.partNumber}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-3">
                    <span className="text-sm font-bold text-text">{part.quantity}</span>
                    <span className="text-xs text-text-secondary">{part.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* Summary row */}
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package size={16} className="text-text-secondary" />
              <span className="text-sm text-text-secondary">
                {partsKit.parts.length} ítems
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-text-secondary" />
              <span className="text-sm text-text-secondary">
                ~{partsKit.totalEstimatedHours} hrs
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Assign mechanic + notes */}
      {partsKit && partsKit.parts.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-border mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-amber text-white flex items-center justify-center text-xs font-bold">4</div>
            <span className="font-semibold text-text">Asignar</span>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-secondary">Mecánico (opcional)</label>
              <input
                type="text"
                value={mecanico}
                onChange={(e) => setMecanico(e.target.value)}
                placeholder="Nombre del mecánico asignado"
                className="w-full rounded-xl border border-border p-3 text-sm text-text bg-white"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-secondary">Observaciones</label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Notas adicionales para el mecánico..."
                rows={3}
                className="w-full rounded-xl border border-border p-3 text-sm text-text resize-none bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Warning for overdue PM */}
      {pmInfo && pmInfo.hours_remaining <= 0 && pmLevel === suggestedLevel && (
        <div className="bg-red-50 border border-critical rounded-xl p-3 flex items-center gap-2 mb-4">
          <AlertTriangle size={18} className="text-critical shrink-0" />
          <span className="text-sm font-medium text-critical">
            PM VENCIDO — Prioridad máxima. Equipo no debe operar sin este mantenimiento.
          </span>
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmitIntent}
        disabled={!canSubmit}
        className="w-full bg-amber text-white rounded-xl py-4 font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2 btn-press"
        style={{ minHeight: 52 }}
      >
        <Wrench size={20} />
        Activar Orden de PM
      </button>
    </div>
  );
}
