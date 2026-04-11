import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Plus, ScanLine } from 'lucide-react';
import { TRANSPORT_UNITS } from '../data/transport-units';
import { mexicoDateInput, mexicoTimeInput } from '../lib/date-utils';
import { appendRow, SHEET_TABS } from '../lib/sheets-api';
import { useAuthStore } from '../stores/auth-store';
import ConfirmModal from '../components/ui/ConfirmModal';
import SuccessToast from '../components/ui/SuccessToast';

const MATERIAL_OPTIONS = ['Tierra', 'Roca', 'Grava', 'Mineral', 'Caliza', 'Otro'] as const;

// ── Column mapping for Reporte_Fletes_Transporte ──────────────────────────────
// A (0)  Fecha
// B (1)  Hora
// C (2)  No. Unidad
// D (3)  Conductor
// E (4)  KM Cargado
// F (5)  KM Vacío
// G (6)  ORIGEN
// H (7)  RUTA DESTINO
// I (8)  KM TOTAL
// J (9)  CLIENTE
// K (10) TIPO CARGA
// L (11) TONELAJE
// M (12) FLETE ($)
// N (13) OBSERVACIONES
// O (14) Ticket_Bascula

type Mode = 'single' | 'multi';

interface TripEntry {
  hora:     string;
  tonelaje: string;
  flete:    string;
}

const emptyTrip = (hora: string = ''): TripEntry => ({
  hora,
  tonelaje: '',
  flete:    '',
});

export default function ViajePage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);

  // ── Mode ──────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>('single');

  // ── Common fields ─────────────────────────────────────────────────────────
  const [fecha, setFecha] = useState<string>(mexicoDateInput());
  const [hora, setHora] = useState<string>(mexicoTimeInput());
  const [unidad, setUnidad] = useState<string>('');
  const [rutaOrigen, setRutaOrigen] = useState<string>('');
  const [rutaDestino, setRutaDestino] = useState<string>('');
  const [kmCargado, setKmCargado] = useState<string>('');
  const [kmVacio, setKmVacio] = useState<string>('');
  const [material, setMaterial] = useState<string>('');
  const [cliente, setCliente] = useState<string>('');
  const [observaciones, setObservaciones] = useState<string>('');

  // ── Single-mode fields ────────────────────────────────────────────────────
  const [tonelaje, setTonelaje] = useState<string>('');
  const [flete, setFlete] = useState<string>('');

  // ── Multi-mode trips ──────────────────────────────────────────────────────
  const [trips, setTrips] = useState<TripEntry[]>([emptyTrip(mexicoTimeInput())]);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastVisible, setToastVisible] = useState<boolean>(false);

  const kmCargadoNum = parseFloat(kmCargado) || 0;
  const kmVacioNum   = parseFloat(kmVacio)   || 0;
  const kmTotal      = kmCargado !== '' && kmVacio !== '' ? kmCargadoNum + kmVacioNum : null;

  // ── Totals in multi mode ──────────────────────────────────────────────────
  const totalTonelaje = trips.reduce((s, t) => s + (parseFloat(t.tonelaje) || 0), 0);
  const totalFlete    = trips.reduce((s, t) => s + (parseFloat(t.flete)    || 0), 0);

  const commonsFilled =
    unidad !== '' &&
    rutaOrigen.trim() !== '' &&
    rutaDestino.trim() !== '' &&
    kmCargado !== '' &&
    kmVacio !== '';

  const tripsValid = trips.length > 0 && trips.every(
    (t) => t.hora.trim() !== '' && (parseFloat(t.tonelaje) || 0) > 0
  );

  const canSubmit =
    mode === 'single'
      ? commonsFilled
      : commonsFilled && tripsValid;

  // ── Trip helpers ──────────────────────────────────────────────────────────

  function updateTrip(index: number, patch: Partial<TripEntry>): void {
    setTrips((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function addTrip(): void {
    // Pre-fill flete from the most recent trip if set (same client/route usually = same rate)
    const last = trips[trips.length - 1];
    setTrips((prev) => [
      ...prev,
      { hora: mexicoTimeInput(), tonelaje: '', flete: last?.flete ?? '' },
    ]);
  }

  function removeTrip(index: number): void {
    setTrips((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  function handleSubmitIntent(): void {
    if (!canSubmit) return;
    setShowConfirm(true);
  }

  async function handleConfirm(): Promise<void> {
    setShowConfirm(false);
    setSubmitting(true);

    const fechaSheet = fecha.split('-').reverse().join('/'); // dd/MM/yyyy
    const kmTotalStr = String(kmCargadoNum + kmVacioNum);

    /**
     * Builds a row with EXACTLY 15 columns in the order of Reporte_Fletes_Transporte:
     * A:Fecha B:Hora C:Unidad D:Conductor E:KM_Cargado F:KM_Vacio
     * G:Origen H:Destino I:KM_Total J:Cliente K:Tipo_Carga L:Tonelaje
     * M:Flete N:Observaciones O:Ticket_Bascula
     */
    const buildRow = (horaVal: string, tonelajeVal: string, fleteVal: string): string[] => {
      const horaNormalised = horaVal.length === 5 ? `${horaVal}:00` : horaVal;
      return [
        fechaSheet,                                // A (0)  Fecha
        horaNormalised,                            // B (1)  Hora
        unidad,                                    // C (2)  No. Unidad
        userName,                                  // D (3)  Conductor
        String(kmCargadoNum),                      // E (4)  KM Cargado
        String(kmVacioNum),                        // F (5)  KM Vacío
        rutaOrigen,                                // G (6)  ORIGEN
        rutaDestino,                               // H (7)  RUTA DESTINO
        kmTotalStr,                                // I (8)  KM TOTAL
        cliente,                                   // J (9)  CLIENTE
        material,                                  // K (10) TIPO CARGA
        String(parseFloat(tonelajeVal) || 0),      // L (11) TONELAJE
        String(parseFloat(fleteVal) || 0),         // M (12) FLETE ($)
        observaciones,                             // N (13) OBSERVACIONES
        '',                                        // O (14) Ticket_Bascula
      ];
    };

    try {
      if (mode === 'single') {
        await appendRow(SHEET_TABS.FLETES, buildRow(hora, tonelaje, flete));
        setToastMessage('Flete registrado ✓');
      } else {
        // Sort trips chronologically so the Google Sheet shows them in order —
        // operator may enter them out of order when catching up at home.
        const orderedTrips = [...trips].sort((a, b) => a.hora.localeCompare(b.hora));

        // Sequential await guarantees rows land in order (no parallel races).
        for (const t of orderedTrips) {
          await appendRow(SHEET_TABS.FLETES, buildRow(t.hora, t.tonelaje, t.flete));
        }
        setToastMessage(`${orderedTrips.length} viajes registrados ✓`);
      }
      setToastVisible(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar';
      setToastMessage(`Error: ${msg}`);
      setToastVisible(true);
    } finally {
      setSubmitting(false);
    }
  }

  function handleToastDismiss(): void {
    setToastVisible(false);
    navigate(-1);
  }

  const confirmMessage =
    mode === 'single'
      ? `¿Registrar flete de ${rutaOrigen} → ${rutaDestino} para ${unidad || 'la unidad'}?`
      : `¿Registrar ${trips.length} viajes de ${rutaOrigen} → ${rutaDestino} para ${unidad || 'la unidad'}? Total: ${totalTonelaje.toFixed(1)} ton · $${totalFlete.toFixed(2)}`;

  return (
    <div className="flex flex-col pb-4 animate-fade-up">
      <SuccessToast
        message={toastMessage}
        visible={toastVisible}
        onDismiss={handleToastDismiss}
      />

      <ConfirmModal
        open={showConfirm}
        title={mode === 'single' ? 'Confirmar registro de flete' : `Confirmar ${trips.length} viajes`}
        message={confirmMessage}
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
        <h1 className="text-xl font-bold text-text flex-1">Registro de Flete</h1>
        <button
          type="button"
          onClick={() => navigate('/bulk-boletas')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border"
          style={{ borderColor: '#F59E0B', color: '#D97706', background: '#FFFBEB' }}
          title="Registro masivo por OCR de boletas"
        >
          <ScanLine size={14} />
          Boletas OCR
        </button>
      </div>

      {/* ── Mode toggle ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl p-3 shadow-sm border border-border mb-3">
        <label className="text-xs font-medium text-text-secondary mb-2 block">Modo</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mode === 'single' ? 'bg-amber text-white' : 'bg-white border border-border text-text-secondary'
            }`}
          >
            Un viaje
          </button>
          <button
            type="button"
            onClick={() => setMode('multi')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mode === 'multi' ? 'bg-amber text-white' : 'bg-white border border-border text-text-secondary'
            }`}
          >
            Varios viajes del día
          </button>
        </div>
      </div>

      {/* ── Common fields card ────────────────────────────────────────── */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border flex flex-col gap-4">
        {mode === 'multi' && (
          <p className="text-xs font-semibold text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
            Datos comunes — aplica a todos los viajes
          </p>
        )}

        {/* Fecha + (single-mode Hora) */}
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
          {mode === 'single' && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-secondary">Hora</label>
              <input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="w-full rounded-xl border border-border p-3 text-text bg-white"
              />
            </div>
          )}
        </div>

        {/* Unidad */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Camión / Unidad</label>
          <select
            value={unidad}
            onChange={(e) => setUnidad(e.target.value)}
            className="w-full rounded-xl border border-border p-3 bg-white text-text"
          >
            <option value="">Seleccionar unidad...</option>
            {TRANSPORT_UNITS.map((eq) => (
              <option key={eq.unit_id} value={eq.unit_id}>
                {eq.unit_id} — {eq.type}
              </option>
            ))}
          </select>
        </div>

        {/* Origen / Destino */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-secondary">Origen</label>
            <input
              type="text"
              value={rutaOrigen}
              onChange={(e) => setRutaOrigen(e.target.value)}
              placeholder="Ej: Frente 3"
              className="w-full rounded-xl border border-border p-3 text-text bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-secondary">Destino</label>
            <input
              type="text"
              value={rutaDestino}
              onChange={(e) => setRutaDestino(e.target.value)}
              placeholder="Ej: Patio de acopio"
              className="w-full rounded-xl border border-border p-3 text-text bg-white"
            />
          </div>
        </div>

        {/* KM grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-secondary">KM Cargado</label>
            <input
              type="number"
              value={kmCargado}
              onChange={(e) => setKmCargado(e.target.value)}
              placeholder="0"
              className="w-full rounded-xl border border-border p-3 text-text bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-secondary">KM Vacío</label>
            <input
              type="number"
              value={kmVacio}
              onChange={(e) => setKmVacio(e.target.value)}
              placeholder="0"
              className="w-full rounded-xl border border-border p-3 text-text bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-secondary">KM Total</label>
            <div className="w-full rounded-xl border border-border p-3 bg-gray-50 text-text font-semibold text-center">
              {kmTotal !== null ? kmTotal : '—'}
            </div>
          </div>
        </div>

        {/* Tipo de Carga + (single-mode Tonelaje) */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-secondary">Tipo de Carga</label>
            <select
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              className="w-full rounded-xl border border-border p-3 bg-white text-text"
            >
              <option value="">Seleccionar...</option>
              {MATERIAL_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          {mode === 'single' ? (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-secondary">Tonelaje</label>
              <input
                type="number"
                value={tonelaje}
                onChange={(e) => setTonelaje(e.target.value)}
                placeholder="0"
                className="w-full rounded-xl border border-border p-3 text-text bg-white"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-secondary">Cliente</label>
              <input
                type="text"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Nombre del cliente"
                className="w-full rounded-xl border border-border p-3 text-text bg-white"
              />
            </div>
          )}
        </div>

        {/* Cliente + Flete (single only — in multi these live per-trip/in commons) */}
        {mode === 'single' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-secondary">Cliente</label>
              <input
                type="text"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Nombre del cliente"
                className="w-full rounded-xl border border-border p-3 text-text bg-white"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-secondary">Flete ($)</label>
              <input
                type="number"
                value={flete}
                onChange={(e) => setFlete(e.target.value)}
                placeholder="0.00"
                step="0.01"
                className="w-full rounded-xl border border-border p-3 text-text bg-white"
              />
            </div>
          </div>
        )}

        {/* Observaciones */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">
            Observaciones {mode === 'multi' && <span className="text-xs text-text-secondary">(del día)</span>}
          </label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Observaciones del viaje..."
            rows={2}
            className="w-full rounded-xl border border-border p-3 text-sm text-text resize-none bg-white"
          />
        </div>
      </div>

      {/* ── Multi-mode trips list ─────────────────────────────────────── */}
      {mode === 'multi' && (
        <div className="mt-3 rounded-xl p-4 border" style={{ background: '#FFFBEB', borderColor: '#F59E0B' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold" style={{ color: '#92400E' }}>
              🚚 Viajes del día
            </p>
            <span className="text-xs font-semibold" style={{ color: '#92400E' }}>
              {trips.length} {trips.length === 1 ? 'viaje' : 'viajes'}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {trips.map((t, i) => (
              <div
                key={i}
                className="bg-white rounded-lg p-3 border"
                style={{ borderColor: '#FDE68A' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold" style={{ color: '#92400E' }}>
                    Viaje {i + 1}
                  </span>
                  {trips.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTrip(i)}
                      className="w-7 h-7 rounded-full bg-red-50 text-red-500 flex items-center justify-center"
                      aria-label="Eliminar viaje"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-text-secondary block mb-1">Hora</label>
                    <input
                      type="time"
                      value={t.hora}
                      onChange={(e) => updateTrip(i, { hora: e.target.value })}
                      className="w-full rounded-lg border p-2 text-sm text-text bg-white text-center"
                      style={{ borderColor: '#FDE68A' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-secondary block mb-1">Tonelaje</label>
                    <input
                      type="number"
                      value={t.tonelaje}
                      onChange={(e) => updateTrip(i, { tonelaje: e.target.value })}
                      placeholder="0"
                      className="w-full rounded-lg border p-2 text-sm font-semibold text-center bg-white"
                      style={{ borderColor: '#FDE68A', color: '#D97706' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-secondary block mb-1">Flete $</label>
                    <input
                      type="number"
                      value={t.flete}
                      onChange={(e) => updateTrip(i, { flete: e.target.value })}
                      placeholder="0"
                      step="0.01"
                      className="w-full rounded-lg border p-2 text-sm text-center bg-white"
                      style={{ borderColor: '#FDE68A' }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addTrip}
            className="mt-3 w-full py-2.5 rounded-lg border border-dashed text-sm font-semibold flex items-center justify-center gap-2 bg-white"
            style={{ borderColor: '#F59E0B', color: '#D97706' }}
          >
            <Plus size={16} /> Agregar otro viaje
          </button>

          {/* Totals strip */}
          <div
            className="mt-3 pt-3 border-t border-dashed flex justify-between items-center"
            style={{ borderColor: '#FCD34D' }}
          >
            <span className="text-xs font-medium" style={{ color: '#92400E' }}>
              Total del día
            </span>
            <span className="text-sm font-bold text-green-600">
              {totalTonelaje.toFixed(1)} ton · ${totalFlete.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmitIntent}
        disabled={!canSubmit || submitting}
        className="mt-4 w-full bg-amber text-white rounded-xl py-4 font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity btn-press"
        style={{ minHeight: 52 }}
      >
        {submitting
          ? 'Guardando...'
          : mode === 'single'
            ? 'Registrar Flete'
            : `Registrar ${trips.length} Viajes`}
      </button>
    </div>
  );
}
