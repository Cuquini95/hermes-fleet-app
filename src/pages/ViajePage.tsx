import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { EQUIPMENT_CATALOG } from '../data/equipment-catalog';
import { mexicoDate, mexicoTime } from '../lib/date-utils';
import { appendRow, SHEET_TABS } from '../lib/sheets-api';
import { useAuthStore } from '../stores/auth-store';
import ConfirmModal from '../components/ui/ConfirmModal';
import SuccessToast from '../components/ui/SuccessToast';

const MATERIAL_OPTIONS = ['Tierra', 'Roca', 'Grava', 'Mineral', 'Caliza', 'Otro'];

type TripType = 'pena' | 'flete';

export default function ViajePage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);

  const [tripType, setTripType] = useState<TripType>('pena');
  const [unidad, setUnidad] = useState('');
  const [rutaOrigen, setRutaOrigen] = useState('');
  const [rutaDestino, setRutaDestino] = useState('');
  const [kmCargado, setKmCargado] = useState('');
  const [kmVacio, setKmVacio] = useState('');
  const [material, setMaterial] = useState('');
  const [tonelaje, setTonelaje] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const kmTotal =
    kmCargado !== '' && kmVacio !== ''
      ? (parseFloat(kmCargado) || 0) + (parseFloat(kmVacio) || 0)
      : null;

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

    const kmCargadoNum = parseFloat(kmCargado) || 0;
    const kmVacioNum = parseFloat(kmVacio) || 0;

    const targetTab = tripType === 'pena' ? SHEET_TABS.VIAJES : SHEET_TABS.FLETES;

    try {
      await appendRow(targetTab, [
        String(Date.now()),
        mexicoDate(),
        mexicoTime(),
        unidad,
        userName,
        rutaOrigen,
        rutaDestino,
        String(kmCargadoNum),
        String(kmVacioNum),
        String(kmCargadoNum + kmVacioNum),
        material,
        String(parseFloat(tonelaje) || 0),
        observaciones,
      ]);
    } catch (err) {
      console.error('Sheets append failed (Viajes):', err);
    }

    const label = tripType === 'pena' ? 'Viaje Peña' : 'Flete Transporte';
    setToastMessage(`${label} registrado ✓`);
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
        title="Confirmar registro de viaje"
        message={`¿Registrar viaje de ${rutaOrigen} → ${rutaDestino} para ${unidad || 'la unidad'}?`}
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
        <h1 className="text-xl font-bold text-text">Registro de Viaje</h1>
      </div>

      {/* Trip type toggle */}
      <div className="bg-white rounded-xl p-3 shadow-sm border border-border mb-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTripType('pena')}
            className={`flex-1 rounded-xl py-3 text-sm font-semibold transition-colors ${
              tripType === 'pena'
                ? 'bg-amber text-white'
                : 'bg-gray-100 text-text-secondary'
            }`}
          >
            Viaje Peña
          </button>
          <button
            type="button"
            onClick={() => setTripType('flete')}
            className={`flex-1 rounded-xl py-3 text-sm font-semibold transition-colors ${
              tripType === 'flete'
                ? 'bg-amber text-white'
                : 'bg-gray-100 text-text-secondary'
            }`}
          >
            Flete Transporte
          </button>
        </div>
        <p className="text-xs text-text-secondary text-center mt-2">
          {tripType === 'pena' ? 'Reporte_Viajes_Peña' : 'Reporte_Fletes_Transporte'}
        </p>
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
            {EQUIPMENT_CATALOG.filter(
              (eq) => eq.type === 'Camión Articulado' || eq.type === 'Camión Pesado'
            ).map((eq) => (
              <option key={eq.unit_id} value={eq.unit_id}>
                {eq.unit_id} — {eq.model}
              </option>
            ))}
          </select>
        </div>

        {/* Ruta origen */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Ruta Origen</label>
          <input
            type="text"
            value={rutaOrigen}
            onChange={(e) => setRutaOrigen(e.target.value)}
            placeholder="Frente 3"
            className="w-full rounded-xl border border-border p-3 text-text bg-white"
          />
        </div>

        {/* Ruta destino */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Ruta Destino</label>
          <input
            type="text"
            value={rutaDestino}
            onChange={(e) => setRutaDestino(e.target.value)}
            placeholder="Patio de acopio"
            className="w-full rounded-xl border border-border p-3 text-text bg-white"
          />
        </div>

        {/* KM grid */}
        <div className="grid grid-cols-2 gap-3">
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
        </div>

        {/* KM total read-only */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">KM Total</label>
          <div className="w-full rounded-xl border border-border p-3 bg-gray-50 text-text font-semibold">
            {kmTotal !== null ? `${kmTotal} km` : '—'}
          </div>
        </div>

        {/* Material */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Material</label>
          <select
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            className="w-full rounded-xl border border-border p-3 bg-white text-text"
          >
            <option value="">Seleccionar material...</option>
            {MATERIAL_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Tonelaje */}
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

        {/* Observaciones */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Observaciones</label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Observaciones del viaje..."
            rows={3}
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
        Registrar Viaje
      </button>
    </div>
  );
}
