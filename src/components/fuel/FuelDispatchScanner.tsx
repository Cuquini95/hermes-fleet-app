/**
 * @fileoverview Monolithic by design (> 400 LOC).
 * Scanner UI + OCR + confirmation flow — tightly coupled state machine.
 */
import { useRef, useState } from 'react';
import { Camera, Upload, CheckCircle, X, Loader2, AlertCircle } from 'lucide-react';
import { useEquipmentList } from '../../hooks/useEquipmentList';
import { useAuthStore } from '../../stores/auth-store';
import { ocrFuelDispatch, appendRow, SHEET_TABS, type OcrFuelRow } from '../../lib/sheets-api';
import { queueSubmission } from '../../lib/offline-queue';
import { getNextPM } from '../../data/pm-rules';
import { mexicoTime } from '../../lib/date-utils';
import type { Equipment } from '../../types/equipment';

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'scanning' | 'review' | 'submitting' | 'done' | 'error';

interface EditableRow {
  equipo: string;
  unidad: string;       // matched unit_id from equipment catalog
  modelo: string;
  horometro: string;
  litros: string;
  hora: string;
  confidence: number;
  fecha: string;        // inherited from fecha_hoja
}

interface ProgressState {
  sent: number;
  total: number;
}

interface FuelDispatchScannerProps {
  onClose: () => void;
}

// ── Fuzzy unit matching ───────────────────────────────────────────────────────

function matchUnit(noEconomico: string, equipment: Equipment[]): string {
  if (!noEconomico) return '';
  const normalized = noEconomico.replace(/#/g, '').replace(/\s+/g, '').toLowerCase();

  // Exact match (case-insensitive, ignoring non-alphanumeric)
  let match = equipment.find(
    (e) =>
      e.unit_id.toLowerCase() === normalized ||
      e.unit_id.toLowerCase().replace(/[^a-z0-9]/g, '') === normalized.replace(/[^a-z0-9]/g, ''),
  );
  if (match) return match.unit_id;

  // Suffix match — "103" matches "CV103"
  match = equipment.find((e) => e.unit_id.toLowerCase().endsWith(normalized));
  if (match) return match.unit_id;

  // Numeric match — find equipment whose unit_id ends in the same number
  const num = normalized.match(/\d+/)?.[0];
  if (num) {
    match = equipment.find((e) => e.unit_id.match(new RegExp(`${num}$`)));
    if (match) return match.unit_id;
  }

  return '';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateDDMMYYYY(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

/** Convert YYYY-MM-DD → DD/MM/YYYY for sheet storage */
function isoToDDMMYYYY(iso: string): string {
  if (!iso || !iso.includes('-')) return iso;
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function confidenceDot(c: number): string {
  if (c >= 0.8) return '🟢';
  if (c >= 0.5) return '🟡';
  return '🔴';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FuelDispatchScanner({ onClose }: FuelDispatchScannerProps) {
  const equipment = useEquipmentList();
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [fechaHoja, setFechaHoja] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [progress, setProgress] = useState<ProgressState>({ sent: 0, total: 0 });

  // ── File handling ───────────────────────────────────────────────────────────

  async function handleFile(file: File) {
    setPhase('scanning');
    setErrorMsg('');
    try {
      const result = await ocrFuelDispatch(file);
      const editableRows: EditableRow[] = result.rows.map((r: OcrFuelRow) => ({
        equipo: r.equipo,
        unidad: matchUnit(r.no_economico, equipment),
        modelo: r.modelo,
        horometro: r.horometro != null ? String(r.horometro) : '',
        litros: r.litros != null ? String(r.litros) : '',
        hora: r.hora ?? '',
        confidence: r.confidence,
        fecha: result.fecha_hoja,
      }));
      setFechaHoja(result.fecha_hoja);
      setRows(editableRows);
      setPhase('review');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setErrorMsg(msg);
      setPhase('error');
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    void handleFile(file);
  }

  // ── Row editing ─────────────────────────────────────────────────────────────

  function updateRow(index: number, field: keyof EditableRow, value: string) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  }

  function deleteRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Batch submit ────────────────────────────────────────────────────────────

  async function handleConfirmAll() {
    setPhase('submitting');
    const userName = useAuthStore.getState().userName;
    const validRows = rows.filter((r) => r.unidad && r.litros && r.horometro);
    setProgress({ sent: 0, total: validRows.length });

    let sent = 0;
    for (const row of validRows) {
      // ── Combustible row (existing, 13 cols) ──────────────────────────────────
      const combRow = [
        String(Date.now() + sent),
        row.fecha ? isoToDDMMYYYY(row.fecha) : formatDateDDMMYYYY(new Date()),
        row.hora ? `${row.hora}:00` : '00:00:00',
        row.unidad,
        userName,
        'Diesel',
        String(row.litros),
        '0',
        String(row.horometro),
        '0',
        '',
        '',
        'Despacho OCR',
      ];

      // ── Horómetro row (new, 9 cols) ──────────────────────────────────────────
      const matchedEquipment = equipment.find((e) => e.unit_id === row.unidad);
      const model = matchedEquipment?.model ?? '';
      const horometroNum = parseFloat(row.horometro) || 0;
      const pmInfo =
        matchedEquipment && horometroNum > 0
          ? getNextPM(model, horometroNum)
          : null;

      const horomRow = [
        row.fecha ? isoToDDMMYYYY(row.fecha) : formatDateDDMMYYYY(new Date()),
        row.hora ? `${row.hora}:00` : mexicoTime(),
        row.unidad,
        model,
        userName,
        '',                                         // TURNO — OCR no captura turno
        String(horometroNum),
        pmInfo ? pmInfo.level : '',
        pmInfo ? String(pmInfo.hours_remaining) : '',
      ];

      // ── Parallel writes — one failure must not block the other ───────────────
      const results = await Promise.allSettled([
        appendRow(SHEET_TABS.COMBUSTIBLE, combRow),
        appendRow(SHEET_TABS.HOROMETROS, horomRow),
      ]);

      // Queue whichever write(s) failed for offline retry
      if (results[0].status === 'rejected') {
        queueSubmission({
          type: 'fuel',
          data: { tab: SHEET_TABS.COMBUSTIBLE, values: combRow },
          timestamp: new Date().toISOString(),
        }).catch(() => {});
      }
      if (results[1].status === 'rejected') {
        queueSubmission({
          type: 'horometro',
          data: { tab: SHEET_TABS.HOROMETROS, values: horomRow },
          timestamp: new Date().toISOString(),
        }).catch(() => {});
      }

      sent++;
      setProgress({ sent, total: validRows.length });
    }

    setPhase('done');
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  // Idle phase
  if (phase === 'idle') {
    return (
      <div className="bg-white rounded-xl border-2 border-dashed border-amber p-6 flex flex-col items-center gap-4 mb-4"
           style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.04) 0%, rgba(255,255,255,1) 100%)' }}>
        <div className="text-center">
          <p className="font-semibold text-text">Escanear hoja de despacho</p>
          <p className="text-xs text-text-secondary mt-1">
            Fotografía el clipboard — se extraerán todas las filas automáticamente
          </p>
        </div>
        <div className="flex gap-3 w-full">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex-1 flex flex-col items-center gap-2 py-4 rounded-xl bg-amber text-white font-medium text-sm transition-opacity active:opacity-80"
          >
            <Camera size={22} />
            Tomar foto
          </button>
          <button
            type="button"
            onClick={() => uploadRef.current?.click()}
            className="flex-1 flex flex-col items-center gap-2 py-4 rounded-xl border border-amber text-amber font-medium text-sm transition-opacity active:opacity-80"
          >
            <Upload size={22} />
            Subir archivo
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-text-secondary underline"
        >
          Cancelar
        </button>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileInput}
        />
        <input
          ref={uploadRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileInput}
        />
      </div>
    );
  }

  // Scanning phase
  if (phase === 'scanning') {
    return (
      <div className="bg-white rounded-xl border border-border p-8 flex flex-col items-center gap-4 mb-4">
        <Loader2 size={36} className="text-amber animate-spin" />
        <p className="text-sm font-medium text-text">Leyendo hoja de despacho...</p>
        <p className="text-xs text-text-secondary">Esto puede tardar unos segundos</p>
      </div>
    );
  }

  // Error phase
  if (phase === 'error') {
    return (
      <div className="bg-white rounded-xl border border-border p-6 flex flex-col items-center gap-4 mb-4">
        <AlertCircle size={36} className="text-red-500" />
        <p className="text-sm font-medium text-text text-center">No se pudo leer la hoja</p>
        <p className="text-xs text-red-500 text-center break-words max-w-xs">{errorMsg}</p>
        <div className="flex gap-3 w-full">
          <button
            type="button"
            onClick={() => setPhase('idle')}
            className="flex-1 py-3 rounded-xl bg-amber text-white font-semibold text-sm"
          >
            Reintentar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-border text-text-secondary font-semibold text-sm"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  // Review phase
  if (phase === 'review') {
    return (
      <div className="flex flex-col gap-3 mb-4">
        {/* Header */}
        <div className="bg-white rounded-xl border border-border p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-text-secondary">Fecha de hoja</p>
            <p className="font-semibold text-text">{fechaHoja ? isoToDDMMYYYY(fechaHoja) : '—'}</p>
          </div>
          <span className="text-xs bg-amber/10 text-amber rounded-full px-3 py-1 font-medium">
            {rows.length} {rows.length === 1 ? 'fila' : 'filas'}
          </span>
        </div>

        {/* Rows */}
        {rows.map((row, i) => (
          <div key={i} className="bg-white rounded-xl border border-border p-4 flex flex-col gap-3">
            {/* Row header */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                {row.equipo || `Fila ${i + 1}`}
              </span>
              <div className="flex items-center gap-2">
                <span title={`Confianza: ${Math.round(row.confidence * 100)}%`}>
                  {confidenceDot(row.confidence)}
                </span>
                <button
                  type="button"
                  onClick={() => deleteRow(i)}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-red-50 text-red-500 active:bg-red-100"
                  aria-label="Eliminar fila"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Unidad select */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-secondary">Unidad</label>
              <select
                value={row.unidad}
                onChange={(e) => updateRow(i, 'unidad', e.target.value)}
                className="w-full rounded-lg border border-border p-2 bg-white text-sm text-text"
              >
                <option value="">Seleccionar...</option>
                {equipment.map((eq) => (
                  <option key={eq.unit_id} value={eq.unit_id}>
                    {eq.unit_id} — {eq.model}
                  </option>
                ))}
              </select>
            </div>

            {/* Horómetro / Litros / Hora */}
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-text-secondary">Horómetro</label>
                <input
                  type="number"
                  value={row.horometro}
                  onChange={(e) => updateRow(i, 'horometro', e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-border p-2 text-sm text-text bg-white"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-text-secondary">Litros</label>
                <input
                  type="number"
                  value={row.litros}
                  onChange={(e) => updateRow(i, 'litros', e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-border p-2 text-sm text-text bg-white"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-text-secondary">Hora</label>
                <input
                  type="text"
                  value={row.hora}
                  onChange={(e) => updateRow(i, 'hora', e.target.value)}
                  placeholder="07:00"
                  maxLength={5}
                  className="w-full rounded-lg border border-border p-2 text-sm text-text bg-white"
                />
              </div>
            </div>
          </div>
        ))}

        {/* Actions */}
        <button
          type="button"
          onClick={() => void handleConfirmAll()}
          disabled={rows.filter((r) => r.unidad && r.litros && r.horometro).length === 0}
          className="w-full bg-amber text-white rounded-xl py-4 font-semibold text-base disabled:opacity-40 disabled:cursor-not-allowed transition-opacity btn-press"
        >
          Confirmar todo ({rows.filter((r) => r.unidad && r.litros && r.horometro).length} filas)
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-full border border-border rounded-xl py-3 font-medium text-sm text-text-secondary"
        >
          Cancelar
        </button>
      </div>
    );
  }

  // Submitting phase
  if (phase === 'submitting') {
    const pct = progress.total > 0 ? Math.round((progress.sent / progress.total) * 100) : 0;
    return (
      <div className="bg-white rounded-xl border border-border p-8 flex flex-col items-center gap-4 mb-4">
        <Loader2 size={36} className="text-amber animate-spin" />
        <p className="text-sm font-medium text-text">
          {progress.sent}/{progress.total} enviados...
        </p>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="bg-amber h-2 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  // Done phase
  return (
    <div className="bg-white rounded-xl border border-border p-8 flex flex-col items-center gap-4 mb-4">
      <CheckCircle size={48} className="text-green-500" />
      <p className="text-base font-semibold text-text">
        {progress.total} {progress.total === 1 ? 'fila guardada' : 'filas guardadas'}
      </p>
      <p className="text-xs text-text-secondary text-center">
        Los registros se han enviado al servidor y se sincronizarán automáticamente.
      </p>
      <button
        type="button"
        onClick={onClose}
        className="w-full bg-amber text-white rounded-xl py-3 font-semibold text-sm"
      >
        Cerrar
      </button>
    </div>
  );
}
