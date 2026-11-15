import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { z } from 'zod';
import { useEquipmentList } from '../hooks/useEquipmentList';
import { calculatePriority } from '../lib/priority-calculator';
import { saveWorkshopCapture } from '../lib/offline-queue';
import { WorkshopApiError } from '../lib/workshop-api';
import { checkpointFallaClear, checkpointFallaDraft, clearFallaDraft, loadFallaDraft, saveFallaDraft, type FallaDraft } from '../lib/falla-draft';
import { useAuthStore } from '../stores/auth-store';
import AutoPriorityIndicator from '../components/falla/AutoPriorityIndicator';
import PhotoCapture from '../components/ui/PhotoCapture';
import ConfirmModal from '../components/ui/ConfirmModal';
import SuccessToast, { type ToastType } from '../components/ui/SuccessToast';

const TIPO_FALLA_OPTIONS = [
  'Mecánica',
  'Hidráulica',
  'Eléctrica',
  'Motor',
  'Transmisión',
  'Neumáticos',
  'Estructura',
  'Otra',
];

const DOWNTIME_OPTIONS = ['<1 hora', '1-4 horas', '4-8 horas', '>8 horas'];

const fallaSchema = z.object({
  unidad: z.string().min(1, 'Selecciona una unidad'),
  tipoFalla: z.string().min(1, 'Selecciona el tipo de falla'),
  descripcion: z.string().min(1, 'Describe la falla'),
  puedeMoverse: z.boolean(),
});

interface PhotoItem {
  file: File;
  preview: string;
}

const emptyDraft: FallaDraft = {
  unidad: '', tipoFalla: '', descripcion: '', puedeMoverse: null, clienteAfectado: '',
  ubicacion: '', downtime: '', previousOtId: '', photos: [], mutationId: '', pending: '',
};

export default function FallaPage() {
  const [params] = useSearchParams();
  const userId = useAuthStore((s) => s.userId);
  const project = useAuthStore((s) => s.project);
  const scope = JSON.stringify([project, userId]);
  return <FallaForm key={scope} scope={scope} isPanama={project === 'tmf-panama'}
    requestedUnit={project === 'tmf-panama' ? params.get('unit')?.trim().toUpperCase() : undefined} />;
}

function FallaForm({ scope, isPanama, requestedUnit }: { scope: string; isPanama: boolean; requestedUnit?: string }) {
  const navigate = useNavigate();
  const equipment = useEquipmentList();
  const sending = useRef(false);
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);
  const [draftError, setDraftError] = useState(false);
  const [draft, setDraft] = useState<FallaDraft>(emptyDraft);
  const currentDraft = useRef(draft);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const { unidad, tipoFalla, descripcion, puedeMoverse, clienteAfectado, ubicacion, downtime, previousOtId, pending } = draft;
  const stopped = isPanama && (puedeMoverse === false || draft.stopped === true);
  const localStart = stopped && draft.stopStartedAt
    ? Date.parse(`${draft.stopStartedAt}:00-05:00`) : null;
  const validStart = localStart === null || (Number.isFinite(localStart) && localStart <= Date.now());

  useEffect(() => {
    let active = true;
    void loadFallaDraft(scope).then((stored) => {
      if (active && stored) {
        const restored = { ...emptyDraft, ...stored };
        currentDraft.current = restored;
        setDraft(restored);
      }
    }).catch(() => {
      if (active) setDraftError(true);
    }).finally(() => {
      if (active) setReady(true);
    });
    return () => { active = false; };
  }, [scope]);

  useEffect(() => {
    if (!ready || !requestedUnit || !equipment.some(unit => unit.unit_id === requestedUnit)) return;
    const current = currentDraft.current;
    const hasExistingCapture = current.unidad || current.tipoFalla || current.descripcion || current.puedeMoverse !== null
      || current.clienteAfectado || current.ubicacion || current.downtime || current.previousOtId || current.photos.length
      || current.mutationId || current.pending;
    if (hasExistingCapture) return;
    const next = { ...current, unidad: requestedUnit };
    currentDraft.current = next;
    setDraft(next);
  }, [equipment, ready, requestedUnit]);

  useEffect(() => {
    const previews = draft.photos.map(file => ({ file, preview: URL.createObjectURL(file) }));
    setPhotos(previews);
    return () => previews.forEach(photo => URL.revokeObjectURL(photo.preview));
  }, [draft.photos]);

  function updateDraft(fields: Partial<FallaDraft>) {
    const next = { ...currentDraft.current, ...fields };
    currentDraft.current = next;
    setDraft(next);
    const checkpoint = checkpointFallaDraft(scope, next);
    const write = writes.current.then(() => saveFallaDraft(scope, next, checkpoint));
    writes.current = write.then(() => setDraftError(false), () => setDraftError(true));
    return writes.current;
  }

  const [showConfirm, setShowConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<ToastType>('success');
  const [toastVisible, setToastVisible] = useState(false);

  const mobilitySelected = puedeMoverse !== null;

  const priority = mobilitySelected
    ? calculatePriority({
        puede_moverse: puedeMoverse!,
        cliente_afectado: clienteAfectado,
        tipo_falla: tipoFalla,
      })
    : null;

  const validation = fallaSchema.safeParse({
    unidad,
    tipoFalla,
    descripcion: descripcion.trim(),
    puedeMoverse: puedeMoverse === null ? undefined : puedeMoverse,
  });
  const canSubmit = validation.success && validStart;

  function handlePhotoCapture(file: File) {
    void updateDraft({ photos: [...currentDraft.current.photos, file] });
  }

  function handlePhotoRemove(index: number) {
    void updateDraft({ photos: draft.photos.filter((_, photoIndex) => photoIndex !== index) });
  }

  function handleSubmitIntent() {
    if (!canSubmit || saving || saved) return;
    setShowConfirm(true);
  }

  function showToast(message: string, type: ToastType = 'success') {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  }

  async function handleConfirm() {
    if (sending.current || saved || !canSubmit) return;
    sending.current = true;
    setSaving(true);
    setShowConfirm(false);
    const mutationId = draft.mutationId || crypto.randomUUID();
    const reportedAt = draft.reportedAt || (stopped && localStart === null && !draft.mutationId ? new Date().toISOString() : undefined);
    const stopInput = localStart !== null ? { stopped: true, stopStartedAt: new Date(localStart).toISOString() }
      : reportedAt ? { stopped: true, stopReportedAt: reportedAt } : {};
    try {
      await updateDraft({ mutationId, reportedAt, pending: draft.pending || 'Aún falta confirmación del servidor.' });
      const response = await saveWorkshopCapture<{ otId: string }>({
        endpoint: 'report',
        mutationId,
        input: {
          unit: unidad, type: tipoFalla, description: descripcion.trim(), canMove: puedeMoverse,
          customer: clienteAfectado, location: ubicacion, downtime,
          ...(stopped ? stopInput : {}),
          ...(isPanama && previousOtId.trim() ? { previousOtId: previousOtId.trim().toUpperCase() } : {}),
        },
        photos: draft.photos.map(file => ({ file })),
      });
      if (response.kind === 'pending') {
        await updateDraft({ pending: response.reason });
        return;
      }
      setSaved(true);
      checkpointFallaClear(scope);
      const write = writes.current.then(() => clearFallaDraft(scope));
      writes.current = write.catch(() => setDraftError(true));
      showToast(`OT creada. ${response.result.otId} disponible en Órdenes`);
    } catch (error) {
      if (error instanceof WorkshopApiError && [400, 413, 415].includes(error.status)) {
        await updateDraft({ mutationId: '', reportedAt: undefined, pending: '' });
      }
      showToast(error instanceof Error ? error.message : 'No se pudo preparar el reporte', 'error');
    } finally {
      sending.current = false;
      setSaving(false);
    }
  }

  function discardDraft() {
    currentDraft.current = emptyDraft;
    setDraft(emptyDraft);
    checkpointFallaClear(scope);
    const write = writes.current.then(() => clearFallaDraft(scope));
    writes.current = write.then(() => setDraftError(false), () => setDraftError(true));
  }

  function handleToastDismiss() {
    setToastVisible(false);
    if (toastType === 'success') navigate(-1);
  }

  return (
    <div className="flex flex-col pb-4 animate-fade-up">
      <SuccessToast
        message={toastMessage}
        visible={toastVisible}
        onDismiss={handleToastDismiss}
        type={toastType}
      />

      <ConfirmModal
        open={showConfirm}
        title="Confirmar reporte de falla"
        message={`¿Enviar reporte de falla para ${unidad || 'la unidad'}?`}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          aria-label="Volver"
          onClick={() => navigate(-1)}
          className="min-h-12 min-w-12 p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <h1 className="text-xl font-bold text-text">Reportar Falla</h1>
      </div>

      <fieldset disabled={!ready || saving || !!pending || saved} className="min-w-0">
      {/* Form card */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border flex flex-col gap-4">
        {/* Unidad */}
        <div className="flex flex-col gap-1">
          <label htmlFor="falla-unidad" className="text-sm font-medium text-text-secondary">Unidad</label>
          <select id="falla-unidad"
            value={unidad}
            onChange={(e) => void updateDraft({ unidad: e.target.value })}
            className="w-full rounded-xl border border-border p-3 bg-white text-text"
          >
            <option value="">Seleccionar unidad...</option>
            {equipment.map((eq) => (
              <option key={eq.unit_id} value={eq.unit_id}>
                {eq.unit_id} — {eq.model}
              </option>
            ))}
          </select>
        </div>

        {/* Tipo de falla */}
        <div className="flex flex-col gap-1">
          <label htmlFor="falla-tipo" className="text-sm font-medium text-text-secondary">Tipo de Falla</label>
          <select id="falla-tipo"
            value={tipoFalla}
            onChange={(e) => void updateDraft({ tipoFalla: e.target.value })}
            className="w-full rounded-xl border border-border p-3 bg-white text-text"
          >
            <option value="">Seleccionar tipo...</option>
            {TIPO_FALLA_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Descripción */}
        <div className="flex flex-col gap-1">
          <label htmlFor="falla-descripcion" className="text-sm font-medium text-text-secondary">Descripción</label>
          <textarea id="falla-descripcion"
            value={descripcion}
            onChange={(e) => void updateDraft({ descripcion: e.target.value })}
            placeholder="Describe los síntomas observados..."
            rows={4}
            className="w-full rounded-xl border border-border p-3 text-sm text-text resize-none bg-white"
          />
        </div>

        {isPanama && (
          <div className="flex flex-col gap-1">
            <label htmlFor="falla-ot-anterior" className="text-sm font-medium text-text-secondary">OT anterior si la falla se repitió</label>
            <input
              id="falla-ot-anterior"
              type="text"
              maxLength={90}
              value={previousOtId}
              onChange={(event) => void updateDraft({ previousOtId: event.target.value })}
              placeholder="Folio de la OT cerrada (opcional)"
              className="w-full rounded-xl border border-border bg-white p-3 text-sm text-text"
            />
          </div>
        )}

        {/* Puede moverse */}
        <div className="flex flex-col gap-2">
          <span id="falla-movilidad" className="text-sm font-medium text-text-secondary">¿Puede moverse?</span>
          <div className="flex gap-2" role="group" aria-labelledby="falla-movilidad">
            <button
              type="button"
              aria-pressed={puedeMoverse === true}
              onClick={() => void updateDraft({ puedeMoverse: true, ...(draft.stopped ? {} : { stopStartedAt: '' }) })}
              className={`min-h-12 flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
                puedeMoverse === true
                  ? 'bg-[#9A5706] text-white'
                  : 'bg-gray-100 text-text-secondary'
              }`}
            >
              Sí
            </button>
            <button
              type="button"
              aria-pressed={puedeMoverse === false}
              onClick={() => void updateDraft({ puedeMoverse: false })}
              className={`min-h-12 flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
                puedeMoverse === false
                  ? 'bg-[#9A5706] text-white'
                  : 'bg-gray-100 text-text-secondary'
              }`}
            >
              No
            </button>
          </div>

          {priority !== null && (
            <AutoPriorityIndicator priority={priority} />
          )}
        </div>

        {isPanama && puedeMoverse === true && (
          <label className="flex min-h-12 items-center gap-2 text-sm font-medium text-text">
            <input type="checkbox" checked={draft.stopped === true}
              onChange={event => void updateDraft({ stopped: event.target.checked, ...(event.target.checked ? {} : { stopStartedAt: '' }) })} />
            La falla detuvo la operación
          </label>
        )}

        {stopped && (
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor="falla-started-at" className="text-sm font-medium text-text-secondary">Inicio de parada · hora de Panamá</label>
            <input id="falla-started-at" type="datetime-local" value={draft.stopStartedAt ?? ''}
              onChange={event => void updateDraft({ stopStartedAt: event.target.value })}
              aria-invalid={!validStart} aria-describedby="falla-started-at-hint"
              className="w-full min-w-0 rounded-xl border border-border bg-white p-3 text-sm text-text" />
            <p id="falla-started-at-hint" className={`text-xs ${validStart ? 'text-text-secondary' : 'text-critical'}`}>
              {validStart ? 'Si lo dejas vacío, se usará la hora en que confirmes el reporte.' : 'La hora de inicio debe ser anterior o igual a la hora actual.'}
            </p>
          </div>
        )}

        {/* Cliente afectado */}
        <div className="flex flex-col gap-1">
          <label htmlFor="falla-cliente" className="text-sm font-medium text-text-secondary">Cliente afectado</label>
          <input id="falla-cliente"
            type="text"
            value={clienteAfectado}
            onChange={(e) => void updateDraft({ clienteAfectado: e.target.value })}
            placeholder="Nombre del cliente afectado"
            className="w-full rounded-xl border border-border p-3 text-sm text-text bg-white"
          />
        </div>

        {/* Ubicación */}
        <div className="flex flex-col gap-1">
          <label htmlFor="falla-ubicacion" className="text-sm font-medium text-text-secondary">Ubicación</label>
          <input id="falla-ubicacion"
            type="text"
            value={ubicacion}
            onChange={(e) => void updateDraft({ ubicacion: e.target.value })}
            placeholder="Frente 3, km 4.5"
            className="w-full rounded-xl border border-border p-3 text-sm text-text bg-white"
          />
        </div>

        {/* Downtime estimado */}
        <div className="flex flex-col gap-1">
          <label htmlFor="falla-downtime" className="text-sm font-medium text-text-secondary">{isPanama ? 'Tiempo de paro estimado' : 'Downtime estimado'}</label>
          <select id="falla-downtime"
            value={downtime}
            onChange={(e) => void updateDraft({ downtime: e.target.value })}
            className="w-full rounded-xl border border-border p-3 bg-white text-text"
          >
            <option value="">Seleccionar...</option>
            {DOWNTIME_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Fotos */}
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text-secondary">Fotos</span>
          <PhotoCapture
            photos={photos}
            onCapture={handlePhotoCapture}
            onRemove={handlePhotoRemove}
            multiple={true}
          />
        </div>
      </div>

      </fieldset>
      {!pending && !saved && ready && (unidad || tipoFalla || descripcion || puedeMoverse !== null || clienteAfectado || ubicacion || downtime || previousOtId || photos.length > 0) && (
        <button type="button" onClick={discardDraft} disabled={saving} className="mt-2 min-h-12 self-end px-2 text-sm font-semibold text-text-secondary underline">
          Descartar borrador
        </button>
      )}
      {draftError && (
        <p role="alert" className="mt-3 text-sm text-critical">
          No se pudo conservar el borrador en este dispositivo. Mantén la pantalla abierta hasta confirmar el reporte.
        </p>
      )}
      {pending && !saved && (
        <p role="status" className="mt-3 rounded-xl bg-amber/10 p-3 text-sm text-text">
          Guardado pendiente. {pending}
        </p>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={pending ? handleConfirm : handleSubmitIntent}
        disabled={!ready || !canSubmit || saving || saved}
        className="mt-4 w-full bg-[#9A5706] text-white rounded-xl py-4 font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity btn-press"
        style={{ minHeight: 52 }}
      >
        {saving ? 'Guardando…' : pending ? 'Reintentar' : 'Enviar Reporte'}
      </button>
    </div>
  );
}
