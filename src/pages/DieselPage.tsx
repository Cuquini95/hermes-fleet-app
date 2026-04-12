import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { useEquipmentList } from '../hooks/useEquipmentList';
import { isAnomalous } from '../data/fuel-benchmarks';
import { mexicoDateInput, mexicoTimeInput } from '../lib/date-utils';
import { appendRow, SHEET_TABS } from '../lib/sheets-api';
import { useAuthStore } from '../stores/auth-store';
import ConfirmModal from '../components/ui/ConfirmModal';
import SuccessToast from '../components/ui/SuccessToast';

type FuelType = 'Urea' | 'Diesel' | 'Gasolina';

const FUEL_TYPES: FuelType[] = ['Urea', 'Diesel', 'Gasolina'];

export default function DieselPage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);
  const equipment = useEquipmentList();

  const [fecha, setFecha] = useState(mexicoDateInput());
  const [hora, setHora] = useState(mexicoTimeInput());
  const [unidad, setUnidad] = useState('');
  const [fuelType, setFuelType] = useState<FuelType>('Urea');
  const [litros, setLitros] = useState('');
  const [costo, setCosto] = useState('');
  const [horometro, setHorometro] = useState('');
  const [kmActual, setKmActual] = useState('');
  const [estacion, setEstacion] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [anomalyWarning, setAnomalyWarning] = useState(false);

  const selectedEquipment = equipment.find((eq) => eq.unit_id === unidad);
  const isTruck = selectedEquipment?.type === 'Camión Pesado';

  const canSubmit = unidad !== '' && litros !== '' && horometro !== '';

  function handleSubmitIntent() {
    if (!canSubmit) return;

    if (selectedEquipment && litros) {
      const consumption = parseFloat(litros);
      const anomalous = isAnomalous(selectedEquipment.model, consumption);
      setAnomalyWarning(anomalous);
    }

    setShowConfirm(true);
  }

  function handleConfirm() {
    setShowConfirm(false);

    const litrosNum = parseFloat(litros) || 0;
    const costoNum = parseFloat(costo) || 0;
    const horometroNum = parseFloat(horometro) || 0;
    const kmNum = parseFloat(kmActual) || 0;

    const row = [
      String(Date.now()),
      fecha.split('-').reverse().join('/'),      // dd/MM/yyyy
      hora.length === 5 ? hora + ':00' : hora,   // HH:mm:ss
      unidad,
      userName,
      fuelType,
      String(litrosNum),
      String(costoNum),
      String(horometroNum),
      String(kmNum),
      '',                                        // Rendimiento — sheet calculates
      estacion,
      observaciones,
    ];

    // Show success immediately — write happens in background
    setToastMessage('Combustible registrado ✓');
    setToastVisible(true);

    appendRow(SHEET_TABS.COMBUSTIBLE, row).catch((err: unknown) => {
      console.error('Background write failed (Combustible):', err);
    });
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
        title="Confirmar registro de combustible"
        message={`¿Registrar ${litros}L de ${fuelType} para ${unidad || 'la unidad'}?`}
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
        <h1 className="text-xl font-bold text-text">Registro Diesel</h1>
      </div>

      {/* Anomaly warning */}
      {anomalyWarning && (
        <div className="bg-amber-50 border border-amber rounded-xl p-3 flex items-center gap-2 mb-4">
          <AlertTriangle size={18} className="text-amber shrink-0" />
          <span className="text-sm font-medium text-amber">
            Consumo anómalo detectado — más del 30% sobre el benchmark
          </span>
        </div>
      )}

      {/* Form card */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border flex flex-col gap-4">
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

        {/* Unidad */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Unidad</label>
          <select
            value={unidad}
            onChange={(e) => { setUnidad(e.target.value); setAnomalyWarning(false); }}
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

        {/* Tipo combustible */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Tipo Combustible</label>
          <div className="flex gap-2">
            {FUEL_TYPES.map((ft) => (
              <button
                key={ft}
                type="button"
                onClick={() => setFuelType(ft)}
                className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
                  fuelType === ft
                    ? 'bg-amber text-white'
                    : 'bg-gray-100 text-text-secondary'
                }`}
              >
                {ft}
              </button>
            ))}
          </div>
        </div>

        {/* Litros */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Litros</label>
          <input
            type="number"
            value={litros}
            onChange={(e) => setLitros(e.target.value)}
            placeholder="0"
            className="w-full rounded-xl border border-border p-4 text-3xl font-semibold text-text bg-white text-center"
          />
        </div>

        {/* Costo */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Costo $ (opcional)</label>
          <input
            type="number"
            value={costo}
            onChange={(e) => setCosto(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-xl border border-border p-3 text-text bg-white"
          />
        </div>

        {/* Horómetro actual */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Horómetro actual</label>
          <input
            type="number"
            value={horometro}
            onChange={(e) => setHorometro(e.target.value)}
            placeholder="Ej: 8450"
            className="w-full rounded-xl border border-border p-3 text-text bg-white"
          />
        </div>

        {/* KM actual — trucks only */}
        {isTruck && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-secondary">KM actual</label>
            <input
              type="number"
              value={kmActual}
              onChange={(e) => setKmActual(e.target.value)}
              placeholder="Ej: 125400"
              className="w-full rounded-xl border border-border p-3 text-text bg-white"
            />
          </div>
        )}

        {/* Estación */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Estación</label>
          <input
            type="text"
            value={estacion}
            onChange={(e) => setEstacion(e.target.value)}
            placeholder="PEMEX Km 12"
            className="w-full rounded-xl border border-border p-3 text-text bg-white"
          />
        </div>

        {/* Observaciones */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Observaciones</label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Observaciones adicionales..."
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
        Registrar Combustible
      </button>
    </div>
  );
}
