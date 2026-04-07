import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useEquipmentList } from '../hooks/useEquipmentList';
import { generateOTId } from '../lib/ot-generator';
import { calculatePriority } from '../lib/priority-calculator';
import { mexicoDate, mexicoTime } from '../lib/date-utils';
import { appendRow, SHEET_TABS } from '../lib/sheets-api';
import { tryUploadPhotos } from '../lib/photo-upload-safe';
import { useAuthStore } from '../stores/auth-store';
import AutoPriorityIndicator from '../components/falla/AutoPriorityIndicator';
import PhotoCapture from '../components/ui/PhotoCapture';
import ConfirmModal from '../components/ui/ConfirmModal';
import SuccessToast from '../components/ui/SuccessToast';

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

interface PhotoItem {
  file: File;
  preview: string;
}

export default function FallaPage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);
  const equipment = useEquipmentList();

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
  const [toastVisible, setToastVisible] = useState(false);

  const mobilitySelected = puedeMoverse !== null;

  const priority = mobilitySelected
    ? calculatePriority({
        puede_moverse: puedeMoverse!,
        cliente_afectado: clienteAfectado,
        tipo_falla: tipoFalla,
      })
    : null;

  const canSubmit =
    unidad !== '' && tipoFalla !== '' && descripcion.trim() !== '' && puedeMoverse !== null;

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

  async function handleConfirm() {
    setShowConfirm(false);
    const otId = generateOTId();
    const priorityValue = priority ?? 'media';

    // Upload photos to Supabase; embed URLs in Observaciones
    const photoUrls = photos.length > 0
      ? await tryUploadPhotos(photos.map((p) => p.file), 'falla-photos')
      : [];
    const obsBase = `Ubicación: ${ubicacion}. Cliente: ${clienteAfectado}. Puede moverse: ${puedeMoverse ? 'Sí' : 'No'}`;
    const observaciones = photoUrls.length > 0
      ? `${obsBase} | Fotos: ${photoUrls.join(', ')}`
      : obsBase;

    try {
      await appendRow(SHEET_TABS.AVERIAS, [
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
        observaciones,     // OBSERVACIONES (includes photo URLs when present)
        '',                // PROVEEDOR PIEZA
        otId,              // OT_ID (cross-reference for auto-sync)
      ]);
    } catch (err) {
      console.error('Sheets append failed (Averias):', err);
    }

    try {
      await appendRow(SHEET_TABS.ORDENES_TRABAJO, [
        String(Date.now()),
        otId,
        mexicoDate(),
        unidad,
        tipoFalla,
        descripcion,
        priorityValue,
        priorityValue,
        '',
        'Abierta',
        '',
        '',
        '',
        '',
        '',
      ]);
    } catch (err) {
      console.error('Sheets append failed (OT):', err);
    }

    setToastMessage(`${otId} creada — Jefe de Taller notificado`);
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
