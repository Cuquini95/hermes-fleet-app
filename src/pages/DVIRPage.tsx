import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { z } from 'zod';
import type { DVIRCheck, CheckStatus } from '../types/dvir';
import { DVIR_SYSTEMS } from '../data/dvir-systems';
import { useEquipmentList } from '../hooks/useEquipmentList';
import { usePanamaCaptureUnit } from '../hooks/usePanamaCaptureUnit';
import { mexicoDateInput, mexicoTimeInput } from '../lib/date-utils';
import { saveWorkshopCapture } from '../lib/offline-queue';
import { WorkshopApiError } from '../lib/workshop-api';
import { EVIDENCE_IMAGE_TYPES } from '../lib/evidence-upload';
import { useAuthStore } from '../stores/auth-store';
import { useEquipmentStore } from '../stores/equipment-store';
import SystemCheckRow from '../components/dvir/SystemCheckRow';
import DVIRResultBanner from '../components/dvir/DVIRResultBanner';
import ConfirmModal from '../components/ui/ConfirmModal';
import PhotoCapture from '../components/ui/PhotoCapture';
import SuccessToast, { type ToastType } from '../components/ui/SuccessToast';

const dvirSchema = z.object({
  unit_id: z.string().min(1, 'Selecciona una unidad'),
  allChecked: z.literal(true, 'Completa todos los sistemas'),
});

const MAX_INSPECTION_PHOTOS = 40;

interface InspectionPhoto {
  file: File;
  preview: string;
  systemId?: string;
}

function buildInitialChecks(): DVIRCheck[] {
  return DVIR_SYSTEMS.map((sys) => ({
    system_id: sys.id,
    status: null,
    notes: '',
  }));
}

export default function DVIRPage() {
  const navigate = useNavigate();
  const isPanama = useAuthStore(state => state.project === 'tmf-panama');
  const accept = isPanama ? EVIDENCE_IMAGE_TYPES.join(',') : undefined;
  const equipment = useEquipmentList();
  const reportUnits = useEquipmentStore(state => state.reportUnits);
  const units = equipment.length === 0 && reportUnits
    ? reportUnits.map(({ code, model }) => ({ unit_id: code, model }))
    : equipment;
  const mutationId = useRef('');
  const sending = useRef(false);
  const previews = useRef(new Set<string>());
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState('');
  const [saved, setSaved] = useState(false);
  const [receipt, setReceipt] = useState<{ inspectionId?: string; otId?: string }>();
  const [fecha, setFecha] = useState(mexicoDateInput());
  const [hora, setHora] = useState(mexicoTimeInput());
  const [unit_id, setUnitId] = usePanamaCaptureUnit(units);
  const [type, setType] = useState<'pre-operacion' | 'post-operacion'>('pre-operacion');
  const [horometro, setHorometro] = useState('');
  const [checks, setChecks] = useState(buildInitialChecks);
  const [photos, setPhotos] = useState<InspectionPhoto[]>([]);
  const [observations, setObservations] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<ToastType>('success');
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    const urls = previews.current;
    return () => {
      urls.forEach(url => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  const inspectionPhotos = photos.filter(photo => !photo.systemId);
  const allChecked = checks.every((c) => c.status !== null);
  const validation = dvirSchema.safeParse({
    unit_id,
    allChecked: allChecked || undefined,
  });
  const canSubmit = validation.success;

  function updateCheck(index: number, status: CheckStatus) {
    setChecks((prev) =>
      prev.map((c, i) => (i === index ? { ...c, status } : c))
    );
  }

  function updateNotes(index: number, notes: string) {
    setChecks((prev) =>
      prev.map((c, i) => (i === index ? { ...c, notes } : c))
    );
  }

  function addPhoto(file: File, systemId?: string) {
    if (!file.size || (isPanama && !EVIDENCE_IMAGE_TYPES.includes(file.type))) {
      showToast(isPanama ? 'Elige una foto JPG, PNG o WebP.' : 'Elige una foto válida.', 'error');
      return;
    }
    if (previews.current.size >= MAX_INSPECTION_PHOTOS) {
      showToast(`Máximo ${MAX_INSPECTION_PHOTOS} fotos por inspección.`, 'error');
      return;
    }
    const preview = URL.createObjectURL(file);
    previews.current.add(preview);
    setPhotos(current => [...current, { file, preview, systemId }]);
  }

  function removePhoto(photo: InspectionPhoto | undefined) {
    if (!photo) return;
    URL.revokeObjectURL(photo.preview);
    previews.current.delete(photo.preview);
    setPhotos(current => current.filter(item => item.preview !== photo.preview));
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
    mutationId.current ||= crypto.randomUUID();
    try {
      const response = await saveWorkshopCapture<{ inspectionId?: string; otId?: string }>({
        endpoint: 'dvir',
        mutationId: mutationId.current,
        input: {
          unit: unit_id, date: fecha, time: hora, type, meter: horometro,
          checks: checks.map(({ status, notes }) => ({ status, notes })), observations,
        },
        photos: photos.map(({ file }) => ({ file })),
      });
      if (response.kind === 'pending') {
        setPending(response.reason);
        return;
      }
      setPending('');
      setSaved(true);
      if (isPanama) setReceipt(response.result);
      showToast(response.result.otId ? 'Inspección registrada. OT creada.' : 'Inspección registrada.');
    } catch (error) {
      if (error instanceof WorkshopApiError && [400, 413, 415].includes(error.status)) {
        mutationId.current = '';
        setPending('');
      }
      showToast(error instanceof Error ? error.message : 'No se pudo preparar la inspección', 'error');
    } finally {
      sending.current = false;
      setSaving(false);
    }
  }

  function handleToastDismiss() {
    setToastVisible(false);
    if (toastType === 'success' && !isPanama) navigate(-1);
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
        title="Confirmar inspección"
        message={`¿Confirmar inspección de ${unit_id || 'la unidad'}?`}
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
        <h1 className="text-xl font-bold text-text">Inspección</h1>
      </div>
      {receipt && <section aria-label="Comprobante de inspección" className="mb-3 min-w-0 space-y-1 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
        <p className="text-sm font-semibold">{receipt.otId ? 'Inspección guardada y vinculada a Taller' : 'Inspección guardada'}</p>
        <Link to="/my-reports" className="inline-flex min-h-11 items-center text-sm font-semibold underline">Ver mis reportes</Link>
        {receipt.inspectionId && <details className="min-w-0 text-sm">
          <summary className="min-h-11 cursor-pointer py-2">Referencia</summary>
          <p className="break-words">{receipt.inspectionId}</p>
          {receipt.otId && <p className="break-words">{receipt.otId}</p>}
        </details>}
      </section>}

      <fieldset disabled={saving || !!pending || saved} className="min-w-0">
      {/* Unit & type card */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border mb-4 flex flex-col gap-3">
        {/* Fecha / Hora */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-secondary">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-xl border border-border p-3 text-text bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-secondary">Hora</label>
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="w-full rounded-xl border border-border p-3 text-text bg-white"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Unidad</label>
          <select
            value={unit_id}
            onChange={(e) => setUnitId(e.target.value)}
            className="w-full rounded-xl border border-border p-3 bg-white text-text"
          >
            <option value="">Seleccionar unidad...</option>
            {units.map((eq) => (
              <option key={eq.unit_id} value={eq.unit_id}>
                {eq.unit_id}{eq.model && ` — ${eq.model}`}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Tipo</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType('pre-operacion')}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
                type === 'pre-operacion'
                  ? 'bg-amber text-white'
                  : 'bg-gray-100 text-text-secondary'
              }`}
            >
              Pre-Operación
            </button>
            <button
              type="button"
              onClick={() => setType('post-operacion')}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
                type === 'post-operacion'
                  ? 'bg-amber text-white'
                  : 'bg-gray-100 text-text-secondary'
              }`}
            >
              Post-Operación
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Horómetro actual</label>
          <input
            type="number"
            value={horometro}
            onChange={(e) => setHorometro(e.target.value)}
            placeholder="Ej: 3240"
            className="w-full rounded-xl border border-border p-3 bg-white text-text"
          />
        </div>
      </div>

      <section aria-label="Fotos de la inspección" className="mb-4 flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-white p-3 shadow-sm">
        <h2 className="text-sm font-semibold text-text">
          Fotos{inspectionPhotos.length > 0 && <span className="ml-2 text-xs font-normal text-text-secondary">{inspectionPhotos.length}</span>}
        </h2>
        <PhotoCapture
          photos={inspectionPhotos}
          onCapture={addPhoto}
          onRemove={index => removePhoto(inspectionPhotos[index])}
          accept={accept}
          labels={{ camera: 'Tomar foto', gallery: 'Galería' }}
          multiple
        />
      </section>

      {/* Systems */}
      <div className="flex flex-col">
        {DVIR_SYSTEMS.map((system, index) => {
          const check = checks[index];
          if (!check) return null;
          const systemPhotos = photos.filter(photo => photo.systemId === system.id);
          return (
            <SystemCheckRow
              key={system.id}
              system={system}
              value={check.status}
              onChange={(status) => updateCheck(index, status)}
              photos={systemPhotos}
              accept={accept}
              onPhotoCapture={file => addPhoto(file, system.id)}
              onPhotoRemove={index => removePhoto(systemPhotos[index])}
              notes={check.notes ?? ''}
              onNotesChange={(notes) => updateNotes(index, notes)}
            />
          );
        })}
      </div>

      {/* Observations */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border mt-2">
        <label htmlFor="inspection-notes" className="text-sm font-medium text-text-secondary block mb-2">
          Observaciones
        </label>
        <textarea
          id="inspection-notes"
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-border p-3 text-sm text-text resize-none bg-white"
        />
      </div>

      {/* Result banner */}
      <DVIRResultBanner checks={checks} />

      </fieldset>
      {pending && (
        <p role="status" className="mt-3 rounded-xl bg-amber/10 p-3 text-sm text-text">
          Guardado pendiente. {pending}
        </p>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={pending ? handleConfirm : handleSubmitIntent}
        disabled={!canSubmit || saving || saved}
        className="mt-4 w-full bg-amber text-white rounded-xl py-4 font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity btn-press"
        style={{ minHeight: 52 }}
      >
        {saved ? 'Inspección guardada' : saving ? 'Guardando…' : pending ? 'Reintentar' : 'Enviar Inspección'}
      </button>
    </div>
  );
}
