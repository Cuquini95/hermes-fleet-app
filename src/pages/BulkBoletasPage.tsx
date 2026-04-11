import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  Trash2,
  CheckSquare,
  Square,
  Loader2,
  AlertCircle,
  Upload,
} from 'lucide-react';
import { TRANSPORT_UNITS } from '../data/transport-units';
import { mexicoDateInput } from '../lib/date-utils';
import { appendRow, ocrBoleta, SHEET_TABS, type OcrBoletaResult } from '../lib/sheets-api';
import { useAuthStore } from '../stores/auth-store';
import ConfirmModal from '../components/ui/ConfirmModal';
import SuccessToast from '../components/ui/SuccessToast';

// ── Types ─────────────────────────────────────────────────────────────────────

type BoletaStatus = 'extracting' | 'ready' | 'error' | 'saved';

interface BoletaItem {
  id: string;
  thumbUrl: string;
  status: BoletaStatus;
  errorMsg?: string;
  selected: boolean;
  folio: string;
  hora: string;
  fletero: string;
  capacidad_m3: string;
  flete: string;
}

const MATERIAL_OPTIONS = [
  'Húmedo', 'Seco', 'Roca', 'Grava', 'Arena', 'Mineral', 'Caliza', 'Otro',
];

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BulkBoletasPage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sharedPopulated = useRef(false);

  // ── Shared fields (common to all boletas in a batch) ──────────────────────
  const [fecha, setFecha] = useState(mexicoDateInput());
  const [unidad, setUnidad] = useState('');
  const [rutaOrigen, setRutaOrigen] = useState('');
  const [rutaDestino, setRutaDestino] = useState('');
  const [kmTotal, setKmTotal] = useState('');
  const [material, setMaterial] = useState('');
  const [cliente, setCliente] = useState('');

  // ── Boleta list ────────────────────────────────────────────────────────────
  const [boletas, setBoletas] = useState<BoletaItem[]>([]);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  // ── Derived ────────────────────────────────────────────────────────────────
  const readyBoletas = boletas.filter((b) => b.status === 'ready');
  const selectedBoletas = readyBoletas.filter((b) => b.selected);
  const processingCount = boletas.filter((b) => b.status === 'extracting').length;
  const allDone = boletas.length > 0 && processingCount === 0;

  const canSubmit =
    selectedBoletas.length > 0 &&
    unidad !== '' &&
    rutaOrigen.trim() !== '' &&
    rutaDestino.trim() !== '';

  // ── Auto-populate shared fields from first successful OCR ─────────────────
  function applySharedFromOcr(ocr: OcrBoletaResult): void {
    if (sharedPopulated.current) return;
    sharedPopulated.current = true;
    if (ocr.fecha) setFecha(ocr.fecha);
    if (ocr.banco_carga) setRutaOrigen(ocr.banco_carga);
    if (ocr.banco_descarga) setRutaDestino(ocr.banco_descarga);
    if (ocr.distancia_km) setKmTotal(String(ocr.distancia_km));
    if (ocr.material) setMaterial(ocr.material);
    if (ocr.obra) setCliente(ocr.obra);
  }

  // ── Process uploaded photos ────────────────────────────────────────────────
  async function handleFiles(files: FileList): Promise<void> {
    const fileArr = Array.from(files);

    // Build placeholder items immediately so UI shows progress
    const items: BoletaItem[] = fileArr.map((file) => ({
      id: makeId(),
      thumbUrl: URL.createObjectURL(file),
      status: 'extracting',
      selected: true,
      folio: '',
      hora: '',
      fletero: '',
      capacidad_m3: '',
      flete: '',
    }));

    setBoletas((prev) => [...prev, ...items]);

    // OCR in batches of 5 concurrent
    const BATCH_SIZE = 5;
    for (let i = 0; i < fileArr.length; i += BATCH_SIZE) {
      const batchFiles = fileArr.slice(i, i + BATCH_SIZE);
      const batchItems = items.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batchFiles.map(async (file, j) => {
          const item = batchItems[j];
          try {
            const ocr = await ocrBoleta(file);
            applySharedFromOcr(ocr);
            setBoletas((prev) =>
              prev.map((b) =>
                b.id === item.id
                  ? {
                      ...b,
                      status: 'ready',
                      folio: ocr.folio ?? '',
                      hora: ocr.hora ?? '',
                      fletero: ocr.fletero ?? '',
                      capacidad_m3: ocr.capacidad_m3 ? String(ocr.capacidad_m3) : '',
                    }
                  : b
              )
            );
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error OCR';
            setBoletas((prev) =>
              prev.map((b) =>
                b.id === item.id ? { ...b, status: 'error', errorMsg: msg } : b
              )
            );
          }
        })
      );
    }
  }

  function updateBoleta(id: string, patch: Partial<BoletaItem>): void {
    setBoletas((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function removeBoleta(id: string): void {
    setBoletas((prev) => prev.filter((b) => b.id !== id));
  }

  function toggleAll(): void {
    const allSelected = readyBoletas.every((b) => b.selected);
    setBoletas((prev) =>
      prev.map((b) => (b.status === 'ready' ? { ...b, selected: !allSelected } : b))
    );
  }

  // ── Bulk submit ───────────────────────────────────────────────────────────
  async function handleConfirm(): Promise<void> {
    setShowConfirm(false);
    setSubmitting(true);
    setSubmitProgress(0);

    const fechaSheet = fecha.split('-').reverse().join('/'); // dd/MM/yyyy
    const ordered = [...selectedBoletas].sort((a, b) => a.hora.localeCompare(b.hora));
    let done = 0;
    let errors = 0;

    for (const b of ordered) {
      try {
        const hora = b.hora.length === 5 ? `${b.hora}:00` : (b.hora || '00:00:00');
        await appendRow(SHEET_TABS.FLETES, [
          fechaSheet,              // A  Fecha
          hora,                    // B  Hora
          unidad,                  // C  No. Unidad
          b.fletero || userName,   // D  Conductor
          kmTotal,                 // E  KM Cargado
          '0',                     // F  KM Vacío
          rutaOrigen,              // G  Origen
          rutaDestino,             // H  Destino
          kmTotal,                 // I  KM Total
          cliente,                 // J  Cliente
          material,                // K  Tipo Carga
          b.capacidad_m3 || '0',   // L  Tonelaje
          b.flete || '0',          // M  Flete $
          '',                      // N  Observaciones
          b.folio,                 // O  Ticket_Bascula (folio)
        ]);
        done++;
        setSubmitProgress(Math.round((done / ordered.length) * 100));
        setBoletas((prev) =>
          prev.map((x) => (x.id === b.id ? { ...x, status: 'saved' } : x))
        );
      } catch {
        errors++;
      }
    }

    setSubmitting(false);
    setToastMsg(
      errors === 0
        ? `${done} boleta${done !== 1 ? 's' : ''} registrada${done !== 1 ? 's' : ''} en Google Sheets ✓`
        : `${done} registradas · ${errors} con error`
    );
    setToastVisible(true);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col pb-6 animate-fade-up">
      <SuccessToast
        message={toastMsg}
        visible={toastVisible}
        onDismiss={() => { setToastVisible(false); navigate(-1); }}
      />
      <ConfirmModal
        open={showConfirm}
        title={`Registrar ${selectedBoletas.length} boleta${selectedBoletas.length !== 1 ? 's' : ''}`}
        message={`¿Confirmar ${selectedBoletas.length} boleta${selectedBoletas.length !== 1 ? 's' : ''} de ${rutaOrigen} → ${rutaDestino} para ${unidad || 'la unidad'}?`}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
      />

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-text">Registro de Boletas</h1>
          <p className="text-xs text-text-secondary">OCR automático · hasta 50 boletas</p>
        </div>
      </div>

      {/* ── Upload zone ──────────────────────────────────────────────────── */}
      {boletas.length === 0 ? (
        <div
          className="bg-white rounded-2xl border-2 border-dashed flex flex-col items-center justify-center py-14 gap-3 cursor-pointer"
          style={{ borderColor: '#F59E0B' }}
          onClick={() => fileInputRef.current?.click()}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: '#FEF3C7' }}
          >
            <Camera size={30} style={{ color: '#F59E0B' }} />
          </div>
          <p className="text-base font-bold text-text">Fotografiar boletas</p>
          <p className="text-sm text-text-secondary">Selecciona 1 a 50 imágenes</p>
          <button
            type="button"
            className="mt-2 px-6 py-2.5 rounded-xl font-semibold text-sm text-white"
            style={{ background: '#F59E0B' }}
          >
            Seleccionar fotos
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mb-3 w-full py-3 rounded-xl border border-dashed font-semibold text-sm flex items-center justify-center gap-2"
          style={{ borderColor: '#F59E0B', color: '#D97706', background: '#FFFBEB' }}
        >
          <Upload size={16} />
          Agregar más boletas
          <span
            className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold text-white"
            style={{ background: '#F59E0B' }}
          >
            {boletas.length}
          </span>
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {/* ── Thumbnail strip ───────────────────────────────────────────────── */}
      {boletas.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-3">
          {boletas.map((b) => (
            <div key={b.id} className="relative flex-shrink-0 w-14 h-14">
              <img
                src={b.thumbUrl}
                alt="boleta"
                className="w-14 h-14 rounded-lg object-cover border-2"
                style={{
                  borderColor:
                    b.status === 'ready' || b.status === 'saved'
                      ? '#22C55E'
                      : b.status === 'error'
                      ? '#EF4444'
                      : '#F59E0B',
                }}
              />
              {b.status === 'extracting' && (
                <div className="absolute inset-0 rounded-lg bg-black/40 flex items-center justify-center">
                  <Loader2 size={16} className="text-white animate-spin" />
                </div>
              )}
              {b.status === 'error' && (
                <div className="absolute inset-0 rounded-lg bg-red-500/50 flex items-center justify-center">
                  <AlertCircle size={14} className="text-white" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Shared fields card ────────────────────────────────────────────── */}
      {boletas.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-border flex flex-col gap-3 mb-3">
          <p className="text-xs font-bold text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
            Datos comunes — aplica a todas las boletas seleccionadas
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-secondary">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full rounded-xl border border-border p-2.5 text-text bg-white text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-secondary">KM Distancia</label>
              <input
                type="number"
                value={kmTotal}
                onChange={(e) => setKmTotal(e.target.value)}
                placeholder="6.5"
                className="w-full rounded-xl border border-border p-2.5 text-text bg-white text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text-secondary">
              Unidad / Camión <span className="text-red-500">*</span>
            </label>
            <select
              value={unidad}
              onChange={(e) => setUnidad(e.target.value)}
              className="w-full rounded-xl border border-border p-2.5 bg-white text-text text-sm"
            >
              <option value="">Seleccionar unidad...</option>
              {TRANSPORT_UNITS.map((u) => (
                <option key={u.unit_id} value={u.unit_id}>
                  {u.unit_id} — {u.type}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-secondary">
                Origen <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={rutaOrigen}
                onChange={(e) => setRutaOrigen(e.target.value)}
                placeholder="Banco de carga"
                className="w-full rounded-xl border border-border p-2.5 text-text bg-white text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-secondary">
                Destino <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={rutaDestino}
                onChange={(e) => setRutaDestino(e.target.value)}
                placeholder="Banco de descarga"
                className="w-full rounded-xl border border-border p-2.5 text-text bg-white text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-secondary">Material</label>
              <select
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                className="w-full rounded-xl border border-border p-2.5 bg-white text-text text-sm"
              >
                <option value="">Seleccionar...</option>
                {MATERIAL_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-secondary">Cliente / Obra</label>
              <input
                type="text"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Nombre de obra"
                className="w-full rounded-xl border border-border p-2.5 text-text bg-white text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Boleta review list ────────────────────────────────────────────── */}
      {boletas.length > 0 && (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ background: '#FFFBEB', borderColor: '#F59E0B' }}
        >
          {/* List header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ background: '#FEF3C7', borderBottom: '1px solid #FDE68A' }}
          >
            <div className="flex items-center gap-2">
              <button type="button" onClick={toggleAll} style={{ color: '#D97706' }}>
                {readyBoletas.length > 0 && selectedBoletas.length === readyBoletas.length ? (
                  <CheckSquare size={18} />
                ) : (
                  <Square size={18} />
                )}
              </button>
              <span className="text-sm font-bold" style={{ color: '#92400E' }}>
                {boletas.length} boleta{boletas.length !== 1 ? 's' : ''} ·{' '}
                {selectedBoletas.length} seleccionada{selectedBoletas.length !== 1 ? 's' : ''}
              </span>
            </div>
            {processingCount > 0 && (
              <span className="text-xs flex items-center gap-1" style={{ color: '#D97706' }}>
                <Loader2 size={12} className="animate-spin" />
                {processingCount} procesando...
              </span>
            )}
          </div>

          {/* Column headers */}
          <div
            className="grid gap-1 px-4 py-2 text-xs font-semibold text-text-secondary"
            style={{
              gridTemplateColumns: '20px 1fr 1fr 68px 68px 20px',
              borderBottom: '1px solid #FDE68A',
            }}
          >
            <span />
            <span>Folio</span>
            <span>Hora</span>
            <span className="text-center">M³</span>
            <span className="text-center">Flete $</span>
            <span />
          </div>

          {/* Rows */}
          <div className="flex flex-col">
            {boletas.map((b) => (
              <div
                key={b.id}
                className="px-4 py-2.5"
                style={{
                  borderBottom: '1px solid #FEF3C7',
                  opacity: b.status === 'saved' ? 0.45 : 1,
                }}
              >
                {b.status === 'extracting' ? (
                  <div className="flex items-center gap-2 py-1">
                    <Loader2 size={14} className="animate-spin flex-shrink-0" style={{ color: '#F59E0B' }} />
                    <span className="text-sm text-text-secondary">Extrayendo...</span>
                  </div>
                ) : b.status === 'error' ? (
                  <div className="flex items-center gap-2 py-1">
                    <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                    <span className="text-xs text-red-600 flex-1 truncate">
                      {b.errorMsg?.slice(0, 55) ?? 'Error OCR'}
                    </span>
                    <button type="button" onClick={() => removeBoleta(b.id)}>
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  </div>
                ) : (
                  <div
                    className="grid gap-1 items-center"
                    style={{ gridTemplateColumns: '20px 1fr 1fr 68px 68px 20px' }}
                  >
                    <button
                      type="button"
                      onClick={() => updateBoleta(b.id, { selected: !b.selected })}
                      style={{ color: '#D97706' }}
                    >
                      {b.selected ? <CheckSquare size={17} /> : <Square size={17} />}
                    </button>

                    {/* Folio */}
                    <input
                      type="text"
                      value={b.folio}
                      onChange={(e) => updateBoleta(b.id, { folio: e.target.value })}
                      placeholder="N°"
                      className="rounded-lg p-1.5 text-xs text-text bg-white text-center font-mono"
                      style={{ border: '1px solid #FDE68A' }}
                    />

                    {/* Hora */}
                    <input
                      type="time"
                      value={b.hora}
                      onChange={(e) => updateBoleta(b.id, { hora: e.target.value })}
                      className="rounded-lg p-1.5 text-xs text-text bg-white text-center"
                      style={{ border: '1px solid #FDE68A' }}
                    />

                    {/* M³ / Tonelaje */}
                    <input
                      type="number"
                      value={b.capacidad_m3}
                      onChange={(e) => updateBoleta(b.id, { capacidad_m3: e.target.value })}
                      placeholder="0"
                      className="rounded-lg p-1.5 text-xs font-semibold text-center bg-white"
                      style={{ border: '1px solid #FDE68A', color: '#D97706' }}
                    />

                    {/* Flete */}
                    <input
                      type="number"
                      value={b.flete}
                      onChange={(e) => updateBoleta(b.id, { flete: e.target.value })}
                      placeholder="0"
                      step="0.01"
                      className="rounded-lg p-1.5 text-xs text-center bg-white"
                      style={{ border: '1px solid #FDE68A' }}
                    />

                    <button type="button" onClick={() => removeBoleta(b.id)}>
                      <Trash2 size={13} className="text-red-400" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Totals footer */}
          {selectedBoletas.length > 0 && (
            <div
              className="px-4 py-3 flex justify-between items-center"
              style={{ borderTop: '1px dashed #FCD34D' }}
            >
              <span className="text-xs font-medium" style={{ color: '#92400E' }}>
                Total seleccionado
              </span>
              <span className="text-sm font-bold text-green-600">
                {selectedBoletas
                  .reduce((s, b) => s + (parseFloat(b.capacidad_m3) || 0), 0)
                  .toFixed(1)}{' '}
                m³ · $
                {selectedBoletas
                  .reduce((s, b) => s + (parseFloat(b.flete) || 0), 0)
                  .toFixed(2)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Progress bar ─────────────────────────────────────────────────── */}
      {submitting && (
        <div className="mt-3 bg-white rounded-xl p-3 border border-border">
          <div className="flex justify-between text-xs text-text-secondary mb-1.5">
            <span>Registrando en Google Sheets...</span>
            <span>{submitProgress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-300"
              style={{ width: `${submitProgress}%`, background: '#F59E0B' }}
            />
          </div>
        </div>
      )}

      {/* ── Submit button ────────────────────────────────────────────────── */}
      {boletas.length > 0 && (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          disabled={!canSubmit || submitting || !allDone}
          className="mt-4 w-full rounded-xl py-4 font-semibold text-lg text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity btn-press"
          style={{ background: '#F59E0B', minHeight: 52 }}
        >
          {submitting
            ? `Registrando... ${submitProgress}%`
            : !allDone
            ? `Procesando OCR (${processingCount} pendiente${processingCount !== 1 ? 's' : ''})...`
            : `Registrar ${selectedBoletas.length} boleta${selectedBoletas.length !== 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  );
}
