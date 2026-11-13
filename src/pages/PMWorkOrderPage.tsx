/**
 * @fileoverview Monolithic by design (> 400 LOC).
 * PM work-order creation with templated task list and equipment binding.
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Wrench, Package, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { useEquipmentList } from '../hooks/useEquipmentList';
import { getNextPM } from '../data/pm-rules';
import { getCumulativePMParts, getAvailablePMLevels, type PMPart } from '../data/pm-parts-catalog';
import { mexicoDateInput } from '../lib/date-utils';
import { requestWorkshop, WorkshopApiError, mechanicCoversUnit, PANAMA_PM_CHECKLIST_SOURCE, type WorkshopMechanic } from '../lib/workshop-api';
import type { PMChecklist } from '../types/workorder';
import { useAuthStore } from '../stores/auth-store';
import { PANAMA_PM_MASTER_URL, fetchPanamaMaintenance, type PanamaMaintenance } from '../lib/panama-maintenance';
import { printPMOrder } from '../lib/print-pm-order';
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
    const bucket = groups[part.category] ?? [];
    bucket.push(part);
    groups[part.category] = bucket;
  }
  return groups;
}

export default function PMWorkOrderPage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);
  const userId = useAuthStore((s) => s.userId);
  const isPanama = useAuthStore((s) => s.project === 'tmf-panama');
  const equipment = useEquipmentList();
  const [params] = useSearchParams();

  const [unidad, setUnidad] = useState(() => params.get('unidad') ?? '');
  const [pmLevel, setPmLevel] = useState(() => params.get('nivel') ?? '');
  const [mechanicId, setMechanicId] = useState('');
  const [mechanics, setMechanics] = useState<WorkshopMechanic[]>([]);
  const [mechanicsError, setMechanicsError] = useState('');
  const [scheduledDate, setScheduledDate] = useState(mexicoDateInput);
  const [hoursOverride, setHoursOverride] = useState('');
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const mutationId = useRef('');
  const sending = useRef(false);
  const [observaciones, setObservaciones] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [printData, setPrintData] = useState<Parameters<typeof printPMOrder>[0] | null>(null);
  const [checklistMissing, setChecklistMissing] = useState(false);
  const [official, setOfficial] = useState<PanamaMaintenance | null>(null);
  const [preflight, setPreflight] = useState<{ key: string; model?: string; checklist?: PMChecklist | null }>({ key: '' });

  const selectedEquipment = equipment.find((eq) => eq.unit_id === unidad);
  const model = selectedEquipment?.model ?? '';
  const officialEntry = official?.entries?.find(entry => entry.unit === unidad.toUpperCase());
  const templateKey = `${unidad}:${pmLevel}`;
  const selectedTemplate = preflight.key === templateKey ? preflight : null;
  const officialModel = officialEntry?.model || model;

  useEffect(() => {
    if (!isPanama) return;
    const controller = new AbortController();
    void fetchPanamaMaintenance(controller.signal)
      .then(result => { if (!controller.signal.aborted) setOfficial(result); })
      .catch(() => { if (!controller.signal.aborted) setOfficial(null); });
    return () => controller.abort();
  }, [isPanama, userId]);

  useEffect(() => {
    if (!isPanama || !unidad || !pmLevel) return;
    let active = true;
    void requestWorkshop<{ model: string; checklist: PMChecklist | null }>(`pmtemplate?${new URLSearchParams({ unit: unidad, level: pmLevel })}`)
      .then(result => { if (active) setPreflight({ key: templateKey, ...result }); })
      .catch(() => { if (active) setPreflight({ key: templateKey }); });
    return () => { active = false; };
  }, [isPanama, unidad, pmLevel, templateKey, userId]);

  // Get PM proximity info for selected unit
  const pmInfo = useMemo(() => {
    if (isPanama) {
      if (!officialEntry?.level || officialEntry.dueAt === null || officialEntry.remaining === null || officialEntry.state === 'unknown' || officialEntry.reconciliationPending) return null;
      return { level: officialEntry.level, due_at: officialEntry.dueAt, hours_remaining: officialEntry.remaining };
    }
    return selectedEquipment ? getNextPM(selectedEquipment.model, selectedEquipment.current_horometro) : null;
  }, [selectedEquipment, officialEntry, isPanama]);

  // Available PM levels for selected model
  const legacyLevels = useMemo(() => getAvailablePMLevels(model), [model]);
  const availableLevels = isPanama
    ? [...new Set([...(officialEntry?.allowedLevels ?? []), ...(officialEntry?.level ? [officialEntry.level] : [])])]
    : legacyLevels;
  const referenceFallback = isPanama && availableLevels.length === 0;
  const selectableLevels = referenceFallback ? legacyLevels : availableLevels;

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

  const estimatedHours = hoursOverride || String(partsKit?.totalEstimatedHours ?? '');
  const canSubmit = !!selectedEquipment && (selectableLevels.includes(pmLevel) || referenceFallback && /^PM-\d{2,5}$/.test(pmLevel))
    && !!scheduledDate && Number(estimatedHours) >= 0.25 && Number(estimatedHours) <= 240;

  useEffect(() => {
    let active = true;
    requestWorkshop<{ mechanics: WorkshopMechanic[] }>('mechanics')
      .then(({ mechanics }) => { if (active) setMechanics(mechanics); })
      .catch((err: unknown) => { if (active) setMechanicsError(err instanceof Error ? err.message : 'Padrón no disponible'); });
    return () => { active = false; };
  }, []);

  function handleUnitChange(newUnit: string) {
    setUnidad(newUnit);
    setPmLevel('');
    setMechanicId('');
    setHoursOverride('');
  }

  function handleLevelSelect(level: string) {
    setPmLevel(level);
    setHoursOverride('');
  }

  function useSuggested() {
    if (suggestedLevel) handleLevelSelect(suggestedLevel);
  }

  function handleSubmitIntent() {
    if (!canSubmit || saving || printData) return;
    setShowConfirm(true);
  }

  async function handleConfirm() {
    if (sending.current || !canSubmit || printData) return;
    sending.current = true;
    setShowConfirm(false);
    setSaving(true);
    setError('');
    mutationId.current ||= crypto.randomUUID();

    const levelsIncluded = partsKit?.levelsIncluded.length ? partsKit.levelsIncluded : [pmLevel];
    try {
      const { otId, schedule, checklist } = await requestWorkshop<{ otId: string; schedule: string[]; checklist?: PMChecklist | null }>('pm', {
        mutationId: mutationId.current, unit: unidad, level: pmLevel, includedLevels: levelsIncluded.join('+'),
        hours: estimatedHours, mechanicId, scheduledDate, notes: observaciones,
        parts: partsKit?.parts.map((part) => `${part.partNumber} x${part.quantity}`).join(', ') ?? '',
      });
      setPending(false);
      setChecklistMissing(checklist === null);
      setPrintData({
        otId, date: schedule[1] ?? scheduledDate, unidad, model: officialModel, pmLevel, levelsIncluded,
        horometro: isPanama ? officialEntry?.currentHours ?? null : selectedEquipment?.current_horometro ?? null, estimatedHours: Number(estimatedHours),
        mecanico: schedule[4] ?? '', autorizadoPor: userName, observaciones, parts: partsKit?.parts ?? [],
      });
      setToastMessage(`${otId} programada en Calendario para ${scheduledDate}`);
      setToastVisible(true);
    } catch (err) {
      const definitive = err instanceof WorkshopApiError && [400, 403, 404, 409].includes(err.status);
      if (definitive) mutationId.current = '';
      setPending(!definitive);
      setError(err instanceof Error ? err.message : 'No se pudo confirmar la Orden de PM');
    } finally {
      sending.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col pb-4 animate-fade-up">
      <SuccessToast
        message={toastMessage}
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
      />

      <ConfirmModal
        open={showConfirm}
        title="Activar Orden de Mantenimiento"
        message={`¿Programar ${pmLevel} para ${unidad} el ${scheduledDate}?`}
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
          <p className="text-xs text-text-secondary">Programa la OT en el Calendario de Taller</p>
        </div>
      </div>

      <fieldset disabled={saving || pending || !!printData} className="min-w-0">
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
          {equipment.map((eq) => (
            <option key={eq.unit_id} value={eq.unit_id}>
              {eq.unit_id} — {eq.model}{!isPanama ? ` (${eq.current_horometro.toLocaleString()} hrs)` : ''}
            </option>
          ))}
        </select>

        {isPanama && unidad && !pmInfo && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-text">
          El vencimiento no está verificado.{' '}
          {PANAMA_PM_MASTER_URL
            ? <a href={PANAMA_PM_MASTER_URL} target="_blank" rel="noreferrer" className="font-semibold underline">Revisar PM FLOTA</a>
            : <strong>Revisar PM FLOTA</strong>}
        </p>}

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
                {isPanama && <span className="block text-xs text-text-secondary">PM FLOTA · {officialEntry?.sourceStatus}</span>}
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
            {selectableLevels.map((level) => {
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
          {referenceFallback && <label className="mt-3 flex flex-col gap-1 text-sm font-medium text-text-secondary">
            Nivel del plan validado por Taller (horas)
            <input type="text" inputMode="numeric" value={/^PM-\d{1,5}$/.test(pmLevel) ? pmLevel.slice(3) : ''}
              onChange={(event) => handleLevelSelect(event.target.value.replace(/\D/g, '').slice(0, 5) ? `PM-${event.target.value.replace(/\D/g, '').slice(0, 5)}` : '')}
              className="w-full rounded-xl border border-border p-3 text-text" />
            <span className="text-xs">Plan oficial no disponible en esta consulta. Verifica el nivel y estima las horas antes de programar.</span>
          </label>}
          {isPanama && pmLevel && (
            <div className="mt-3 rounded-xl border border-border p-3 text-sm text-text">
              <p>{selectedTemplate?.checklist
                ? `Checklist configurado para ${selectedTemplate.model}: ${selectedTemplate.checklist.reference} (${selectedTemplate.checklist.tasks.length} tareas).`
                : selectedTemplate === null
                  ? 'Consultando checklist por modelo y nivel…'
                  : selectedTemplate.checklist === null
                    ? 'Checklist pendiente de validar para este modelo y nivel. La ejecución no se puede entregar hasta su validación.'
                    : 'No se pudo verificar el checklist en Hermes.'}</p>
              <a href={officialEntry?.checklistUrl ?? PANAMA_PM_CHECKLIST_SOURCE} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center font-medium underline">
                Consultar Flota Checklists PM
              </a>
            </div>
          )}
          {pmLevel && partsKit && partsKit.levelsIncluded.length > 0 && (
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
              {(groupedParts[category] ?? []).map((part, idx) => (
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
      {pmLevel && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-border mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-amber text-white flex items-center justify-center text-xs font-bold">4</div>
            <span className="font-semibold text-text">Asignar</span>
          </div>

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-text-secondary">
              Fecha programada
              <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="min-w-0 w-full rounded-xl border border-border p-3 text-text bg-white" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-text-secondary">
              Horas estimadas
              <input type="number" min="0.25" max="240" step="0.25" value={estimatedHours} onChange={(e) => setHoursOverride(e.target.value)} className="w-full rounded-xl border border-border p-3 text-text bg-white" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-text-secondary">
              Mecánico (opcional)
              <select value={mechanicId} onChange={(e) => setMechanicId(e.target.value)} className="w-full rounded-xl border border-border p-3 text-text bg-white">
                <option value="">Sin asignar</option>
                {mechanics.filter((mechanic) => mechanicCoversUnit(mechanic, unidad)).map((mechanic) => (
                  <option key={mechanic.userId} value={mechanic.userId}>{mechanic.userName}</option>
                ))}
              </select>
            </label>
            {mechanicsError && <p className="text-xs text-text-secondary">{mechanicsError}</p>}

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
            {isPanama ? 'PM vencido según PM FLOTA. Confirma la prioridad y el plan con Taller.' : 'PM VENCIDO — Prioridad máxima. Equipo no debe operar sin este mantenimiento.'}
          </span>
        </div>
      )}

      </fieldset>
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {printData && (
        <>
          {checklistMissing && <p className="mb-3 rounded-xl border border-border bg-white p-3 text-sm text-text">
            Checklist pendiente de validar para este modelo y nivel.{' '}
            <a href={PANAMA_PM_CHECKLIST_SOURCE} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">Consultar Flota Checklists PM</a>
          </p>}
          <button type="button" onClick={() => navigate(`/workorders/${encodeURIComponent(printData.otId)}`)} className="mb-3 w-full rounded-xl border border-border p-3 text-sm font-semibold text-text">
            Abrir orden {printData.otId}
          </button>
          <button type="button" onClick={() => navigate('/calendar')} className="mb-3 w-full rounded-xl border border-amber p-3 text-sm font-semibold text-amber">
            Abrir Calendario
          </button>
        </>
      )}

      {/* Submit */}
      {/* Submit or Print */}
      {printData ? (
        <button
          type="button"
          onClick={() => printPMOrder(printData)}
          className="w-full bg-amber text-white rounded-xl py-4 font-semibold text-lg transition-opacity flex items-center justify-center gap-2 btn-press"
          style={{ minHeight: 52 }}
        >
          <Wrench size={20} />
          Imprimir Orden de PM
        </button>
      ) : (
        <button
          type="button"
          onClick={pending ? handleConfirm : handleSubmitIntent}
          disabled={!canSubmit || saving}
          className="w-full bg-amber text-white rounded-xl py-4 font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2 btn-press"
          style={{ minHeight: 52 }}
        >
          <Wrench size={20} />
          {saving ? 'Guardando…' : pending ? 'Reintentar' : 'Activar Orden de PM'}
        </button>
      )}
    </div>
  );
}
