import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { TRANSPORT_UNITS } from '../data/transport-units';
import { mexicoDate, mexicoTime } from '../lib/date-utils';
import { appendRow, SHEET_TABS } from '../lib/sheets-api';
import { useAuthStore } from '../stores/auth-store';
import ConfirmModal from '../components/ui/ConfirmModal';
import SuccessToast from '../components/ui/SuccessToast';

const MATERIAL_OPTIONS = ['Tierra', 'Roca', 'Grava', 'Mineral', 'Caliza', 'Otro'];

// ── Column mapping for Reporte_Fletes_Transporte ──────────────────────────────
// A (0)  Fecha
// B (1)  Hora
// C (2)  No. Unidad
// D (3)  Conductor
// E (4)  KM Cargado
// F (5)  KM Vacío
// G (6)  ORIGEN          ← visible in sheet header
// H (7)  RUTA DESTINO    ← visible in sheet header
// I (8)  KM TOTAL        ← visible in sheet header
// J (9)  CLIENTE         ← visible in sheet header
// K (10) TIPO CARGA      ← visible in sheet header
// L (11) TONELAJE        ← visible in sheet header
// M (12) FLETE ($)       ← visible in sheet header
// N (13) OBSERVACIONES   ← visible in sheet header
// O (14) Ticket_Bascula  ← visible in sheet header

export default function ViajePage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);

  const [unidad, setUnidad] = useState('');
  const [rutaOrigen, setRutaOrigen] = useState('');
  const [rutaDestino, setRutaDestino] = useState('');
  const [kmCargado, setKmCargado] = useState('');
  const [kmVacio, setKmVacio] = useState('');
  const [material, setMaterial] = useState('');
  const [tonelaje, setTonelaje] = useState('');
  const [cliente, setCliente] = useState('');
  const [flete, setFlete] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const kmCargadoNum = parseFloat(kmCargado) || 0;
  const kmVacioNum   = parseFloat(kmVacio)   || 0;
  const kmTotal      = kmCargado !== '' && kmVacio !== '' ? kmCargadoNum + kmVacioNum : null;

  const canSubmit =
    unidad !== '' &&
    rutaOrigen.trim() !== '' &&
    rutaDestino.trim() !== '' &&
    kmCargado !== '' &&
    kmVacio !== '';

  function handleSubmitIntent() {
    if (!canSubmit) return;
    setShowConfirm(true);
  }

  async function handleConfirm() {
    setShowConfirm(false);

    try {
      await appendRow(SHEET_TABS.FLETES, [
        mexicoDate(),                              // A (0):  Fecha
        mexicoTime(),                              // B (1):  Hora
        unidad,                                    // C (2):  No. Unidad
        userName,                                  // D (3):  Conductor
        String(kmCargadoNum),                      // E (4):  KM Cargado
        String(kmVacioNum),                        // F (5):  KM Vacío
        rutaOrigen,                                // G (6):  ORIGEN         ✓
        rutaDestino,                               // H (7):  RUTA DESTINO   ✓
        String(kmCargadoNum + kmVacioNum),         // I (8):  KM TOTAL       ✓
        cliente,                                   // J (9):  CLIENTE        ✓
        material,                                  // K (10): TIPO CARGA     ✓
        String(parseFloat(tonelaje) || 0),         // L (11): TONELAJE       ✓
        String(parseFloat(flete) || 0),            // M (12): FLETE ($)      ✓
        observaciones,                             // N (13): OBSERVACIONES  ✓
        '',                                        // O (14): Ticket_Bascula
      ]);
    } catch (err) {
      console.error('Sheets append failed (Fletes):', err);
    }

    setToastMessage('Flete registrado ✓');
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
        title="Confirmar registro de flete"
        message={`¿Registrar flete de ${rutaOrigen} → ${rutaDestino} para ${unidad || 'la unidad'}?`}
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
        <h1 className="text-xl font-bold text-text">Registro de Flete</h1>
      </div>

      {/* Form card */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border flex flex-col gap-4">

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

        {/* Material + Tonelaje */}
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
        </div>

        {/* Cliente + Flete */}
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

        {/* Observaciones */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Observaciones</label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Observaciones del viaje..."
            rows={2}
            className="w-full rounded-xl border border-border p-3 text-sm text-text resize-none bg-white"
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
        Registrar Flete
      </button>
    </div>
  );
}
