import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { DVIRCheck, CheckStatus } from '../types/dvir';
import { DVIR_SYSTEMS } from '../data/dvir-systems';
import { useEquipmentList } from '../hooks/useEquipmentList';
import { generateOTId } from '../lib/ot-generator';
import { mexicoDate, mexicoTime, mexicoDateCompact, mexicoTimeCompact } from '../lib/date-utils';
import { appendRow, SHEET_TABS } from '../lib/sheets-api';
import { tryUploadPhotos } from '../lib/photo-upload-safe';
import { useAuthStore } from '../stores/auth-store';
import SystemCheckRow from '../components/dvir/SystemCheckRow';
import DVIRResultBanner from '../components/dvir/DVIRResultBanner';
import ConfirmModal from '../components/ui/ConfirmModal';
import SuccessToast from '../components/ui/SuccessToast';

interface PhotoItem {
  file: File;
  preview: string;
}

interface CheckState extends DVIRCheck {
  photos: PhotoItem[];
}

function buildInitialChecks(): CheckState[] {
  return DVIR_SYSTEMS.map((sys) => ({
    system_id: sys.id,
    status: null,
    notes: '',
    photos: [],
  }));
}

export default function DVIRPage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);
  const equipment = useEquipmentList();
  const [unit_id, setUnitId] = useState('');
  const [type, setType] = useState<'pre-operacion' | 'post-operacion'>('pre-operacion');
  const [horometro, setHorometro] = useState('');
  const [checks, setChecks] = useState<CheckState[]>(buildInitialChecks);
  const [observations, setObservations] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const allChecked = checks.every((c) => c.status !== null);
  const canSubmit = allChecked && unit_id !== '';

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

  const handlePhotoCapture = useCallback((index: number, file: File) => {
    const preview = URL.createObjectURL(file);
    setChecks((prev) =>
      prev.map((c, i) =>
        i === index ? { ...c, photos: [{ file, preview }] } : c
      )
    );
  }, []);

  const handlePhotoRemove = useCallback((checkIndex: number, photoIndex: number) => {
    setChecks((prev) =>
      prev.map((c, i) => {
        if (i !== checkIndex) return c;
        const updated = [...c.photos];
        const removed = updated.splice(photoIndex, 1);
        if (removed[0]) URL.revokeObjectURL(removed[0].preview);
        return { ...c, photos: updated };
      })
    );
  }, []);

  function handleSubmitIntent() {
    if (!canSubmit) return;
    setShowConfirm(true);
  }

  async function handleConfirm() {
    setShowConfirm(false);

    const fallaCount = checks.filter((c) => c.status === 'falla').length;
    const alertaCount = checks.filter((c) => c.status === 'alerta').length;
    const okCount = checks.filter((c) => c.status === 'ok').length;

    let result: string;
    if (fallaCount > 0) result = 'reprobado';
    else if (alertaCount > 0) result = 'condicional';
    else result = 'aprobado';

    let otId: string | null = null;
    if (fallaCount > 0) {
      otId = generateOTId();
    }

    const now = new Date();
    const date = mexicoDate(now);
    const time = mexicoTime(now);
    const inspId = `INS-${mexicoDateCompact(now)}-${mexicoTimeCompact(now)}`;
    const selectedEquipment = equipment.find((eq) => eq.unit_id === unit_id);
    const modelo = selectedEquipment?.model ?? '';

    const allPhotos = checks.flatMap((c) => c.photos.map((p) => p.file));
    const photoUrls = await tryUploadPhotos(allPhotos, 'dvir-photos');
    const photoUrlStr = photoUrls.join(', ');

    try {
      await appendRow(SHEET_TABS.INSPECCIONES, [
        '',                                    // # (auto-number)
        inspId,                                // INSP_ID
        date,                                  // FECHA
        time,                                  // HORA
        unit_id,                               // CÓDIGO UNIDAD
        modelo,                                // MODELO
        userName,                              // OPERADOR
        type,                                  // TIPO
        String(horometro),                     // HORÓMETRO
        ...checks.map((c) => c.status || 'N/A'), // MOTOR through TREN RODAJE (12 cols)
        `${okCount}/12`,                       // SCORE TOTAL
        result,                                // RESULTADO
        observations,                          // DEFECTOS ENCONTRADOS
        photoUrlStr,                           // FOTO_URL
        otId || '',                            // ACCIÓN REQUERIDA
        otId ? 'Pendiente' : '',               // ESTADO ACCIÓN
        userName,                              // FIRMA_OPERADOR
      ]);
    } catch (err) {
      console.error('Sheets append failed (DVIR):', err);
    }

    if (otId) {
      setToastMessage(`Inspección registrada — OT ${otId} generada`);
    } else {
      setToastMessage(`Inspección registrada — Score: ${okCount}/12`);
    }

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
        <h1 className="text-xl font-bold text-text">Inspección DVIR</h1>
      </div>

      {/* Unit & type card */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Unidad</label>
          <select
            value={unit_id}
            onChange={(e) => setUnitId(e.target.value)}
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

      {/* Systems */}
      <div className="flex flex-col">
        {DVIR_SYSTEMS.map((system, index) => (
          <SystemCheckRow
            key={system.id}
            system={system}
            value={checks[index].status}
            onChange={(status) => updateCheck(index, status)}
            photos={checks[index].photos}
            onPhotoCapture={(file) => handlePhotoCapture(index, file)}
            onPhotoRemove={(photoIndex) => handlePhotoRemove(index, photoIndex)}
            notes={checks[index].notes ?? ''}
            onNotesChange={(notes) => updateNotes(index, notes)}
          />
        ))}
      </div>

      {/* Observations */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border mt-2">
        <label className="text-sm font-medium text-text-secondary block mb-2">
          Observaciones generales
        </label>
        <textarea
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          placeholder="Observaciones adicionales..."
          rows={3}
          className="w-full rounded-xl border border-border p-3 text-sm text-text resize-none bg-white"
        />
      </div>

      {/* Result banner */}
      <DVIRResultBanner checks={checks} />

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmitIntent}
        disabled={!canSubmit}
        className="mt-4 w-full bg-amber text-white rounded-xl py-4 font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity btn-press"
        style={{ minHeight: 52 }}
      >
        Enviar Inspección
      </button>
    </div>
  );
}
