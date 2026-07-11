import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { z } from 'zod';
import { useEquipmentList } from '../hooks/useEquipmentList';
import { generateOTId } from '../lib/ot-generator';
import { calculatePriority } from '../lib/priority-calculator';
import { mexicoDate, mexicoTime } from '../lib/date-utils';
import { appendRow, SHEET_TABS } from '../lib/sheets-api';
import { tryUploadPhotos } from '../lib/photo-upload-safe';
import { sendPushEvent } from '../lib/push-notifications';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { queueSubmission, flushQueue } from '../lib/offline-queue';
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

export default function FallaPage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);
  const equipment = useEquipmentList();
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (isOnline) {
      flushQueue().catch(() => {});
    }
  }, [isOnline]);

  const [unidad, setUnidad] = useState('');
  const [tipoFalla, setTipoFalla] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [puedeMoverse, setPuedeMoverse] = useState<boolean | null>(null);
  const [clienteAfectado, setClienteAfectado] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [downtime, setDowntime] = useState('');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
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
  const canSubmit = validation.success;

  const handlePhotoCapture = useCallback((file: File) => {
    const preview = URL.createObjectURL(file);
    setPhotos((prev) => [...prev, { file, preview }]);
  }, []);

  const handlePhotoRemove = useCallback((index: number) => {
    setPhotos((prev) => {
      const updated = [...prev];
      const removed = updated.splice(index, 1);
      if (removed[0]) URL.revokeObjectURL(removed[0].preview);
      return updated;
    });
  }, []);

  function handleSubmitIntent() {
    if (!canSubmit) return;
    setShowConfirm(true);
  }

  function showToast(message: string, type: ToastType = 'success') {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  }

  async function handleConfirm() {
    setShowConfirm(false);
    const otId = generateOTId();
    const priorityValue = priority ?? 'MEDIA';

    if (photos.length > 0 && !isOnline) {
      showToast('Conectate para subir fotos. La OT no se guardo para no perder evidencia.', 'error');
      return;
    }

    // Photo upload must complete first; otherwise the row would save without evidence.
    const photoUrls = photos.length > 0
      ? await tryUploadPhotos(photos.map((p) => p.file), 'falla-photos')
      : [];
    if (photos.length > 0 && photoUrls.length !== photos.length) {
      showToast('No se pudieron subir todas las fotos. Revisa Supabase o la conexion e intenta de nuevo.', 'error');
      return;
    }
    const observacionesBase = `Ubicación: ${ubicacion}. Cliente: ${clienteAfectado}. Puede moverse: ${puedeMoverse ? 'Sí' : 'No'}`;
    const observaciones = observacionesBase;
    const fotoUrl = photoUrls.join(', ');

    // Sheet has 15 cols: FECHA HORA UNIDAD TIPO_AVERIA DESCRIPCION SEVERIDAD TECNICO
    //   TIEMPO_PARO COSTO_ESTIMADO ESTADO SOLUCION OBSERVACIONES PROVEEDOR_PIEZA OT_ID Foto_URL
    const averiaRow = [
      mexicoDate(),      // FECHA
      mexicoTime(),      // HORA
      unidad,            // UNIDAD
      tipoFalla,         // TIPO AVERÍA
      descripcion,       // DESCRIPCIÓN
      priorityValue,     // SEVERIDAD
      userName,          // TÉCNICO
      downtime,          // TIEMPO PARO (hrs)
      '',                // COSTO ESTIMADO
      'Abierta',         // ESTADO
      '',                // SOLUCIÓN
      observaciones,     // OBSERVACIONES
      '',                // PROVEEDOR PIEZA
      otId,              // OT_ID
      fotoUrl,           // Foto_URL
    ];

    const otRow = [
      String(Date.now()), // ROW_ID
      otId,               // OT_ID
      mexicoDate(),       // FECHA
      unidad,             // UNIDAD
      tipoFalla,          // TIPO_AVERIA
      descripcion,        // DESCRIPCION
      priorityValue,      // SEVERIDAD
      priorityValue,      // PRIORIDAD
      '',                 // MECANICO
      'Abierta',          // ESTADO
      fotoUrl,            // FOTO_URL
      otId,               // AVERIA_REF
      '',                 // PARTES
      '',                 // COSTO_ESTIMADO
      '',                 // FECHA_CIERRE
      observaciones,      // OBSERVACIONES
      '0',                // PROGRESO
    ];

    if (isOnline) {
      // Show success immediately — both sheet writes fire in parallel in background
      showToast(`${otId} creada — Jefe de Taller notificado`);

      // Push notification to fleet manager / workshop
      sendPushEvent('nueva_falla', { ot_id: otId, unidad, tipo: tipoFalla, prioridad: priorityValue });

      Promise.allSettled([
        appendRow(SHEET_TABS.AVERIAS, averiaRow),
        appendRow(SHEET_TABS.ORDENES_TRABAJO, otRow),
      ]).then((results) => {
        results.forEach((r, i) => {
          if (r.status === 'rejected') {
            console.error(`Background write failed (Falla row ${i}):`, r.reason);
            const tab = i === 0 ? SHEET_TABS.AVERIAS : SHEET_TABS.ORDENES_TRABAJO;
            const values = i === 0 ? averiaRow : otRow;
            queueSubmission({ type: 'falla', data: { tab, values }, timestamp: new Date().toISOString() }).catch(() => {});
          }
        });
      });
    } else {
      queueSubmission({ type: 'falla', data: { tab: SHEET_TABS.AVERIAS, values: averiaRow }, timestamp: new Date().toISOString() })
        .catch((err: unknown) => console.error('Queue failed (averias):', err));
      queueSubmission({ type: 'falla', data: { tab: SHEET_TABS.ORDENES_TRABAJO, values: otRow }, timestamp: new Date().toISOString() })
        .catch((err: unknown) => console.error('Queue failed (ordenes_trabajo):', err));
      showToast('Avería guardada — se sincronizará al reconectarse ✓');
    }
  }

  function handleToastDismiss() {
    const shouldNavigateBack = toastType === 'success';
    setToastVisible(false);
    if (shouldNavigateBack) navigate(-1);
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
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <h1 className="text-xl font-bold text-text">Reportar Falla</h1>
      </div>

      {/* Form card */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border flex flex-col gap-4">
        {/* Unidad */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Unidad</label>
          <select
            value={unidad}
            onChange={(e) => setUnidad(e.target.value)}
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
          <label className="text-sm font-medium text-text-secondary">Tipo de Falla</label>
          <select
            value={tipoFalla}
            onChange={(e) => setTipoFalla(e.target.value)}
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
          <label className="text-sm font-medium text-text-secondary">Descripción</label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Describe los síntomas observados..."
            rows={4}
            className="w-full rounded-xl border border-border p-3 text-sm text-text resize-none bg-white"
          />
        </div>

        {/* Puede moverse */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text-secondary">¿Puede moverse?</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPuedeMoverse(true)}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
                puedeMoverse === true
                  ? 'bg-amber text-white'
                  : 'bg-gray-100 text-text-secondary'
              }`}
            >
              Sí
            </button>
            <button
              type="button"
              onClick={() => setPuedeMoverse(false)}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
                puedeMoverse === false
                  ? 'bg-amber text-white'
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

        {/* Cliente afectado */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Cliente afectado</label>
          <input
            type="text"
            value={clienteAfectado}
            onChange={(e) => setClienteAfectado(e.target.value)}
            placeholder="Nombre del cliente afectado"
            className="w-full rounded-xl border border-border p-3 text-sm text-text bg-white"
          />
        </div>

        {/* Ubicación */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Ubicación</label>
          <input
            type="text"
            value={ubicacion}
            onChange={(e) => setUbicacion(e.target.value)}
            placeholder="Frente 3, km 4.5"
            className="w-full rounded-xl border border-border p-3 text-sm text-text bg-white"
          />
        </div>

        {/* Downtime estimado */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Downtime estimado</label>
          <select
            value={downtime}
            onChange={(e) => setDowntime(e.target.value)}
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
          <label className="text-sm font-medium text-text-secondary">Fotos</label>
          <PhotoCapture
            photos={photos}
            onCapture={handlePhotoCapture}
            onRemove={handlePhotoRemove}
            multiple={true}
          />
        </div>
      </div>

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmitIntent}
        disabled={!canSubmit}
        className="mt-4 w-full bg-amber text-white rounded-xl py-4 font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity btn-press"
        style={{ minHeight: 52 }}
      >
        Enviar Reporte
      </button>
    </div>
  );
}
