import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock } from 'lucide-react';
import { EQUIPMENT_CATALOG } from '../data/equipment-catalog';
import { getNextPM } from '../data/pm-rules';
import ConfirmModal from '../components/ui/ConfirmModal';
import SuccessToast from '../components/ui/SuccessToast';

type TurnoType = 'inicio' | 'final';

export default function HorometroPage() {
  const navigate = useNavigate();

  const [turno, setTurno] = useState<TurnoType>('inicio');
  const [unidad, setUnidad] = useState('');
  const [horometro, setHorometro] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const selectedEquipment = EQUIPMENT_CATALOG.find((eq) => eq.unit_id === unidad);
  const horasActual = horometro ? parseFloat(horometro) : null;

  const pmInfo =
    selectedEquipment && horasActual !== null
      ? getNextPM(selectedEquipment.model, horasActual)
      : null;

  const prevPMLevel = pmInfo
    ? `PM-${Math.max(1, parseInt(pmInfo.level.replace('PM-', ''), 10) - 1)}`
    : null;

  const prevPMHours = pmInfo && horasActual !== null ? horasActual - pmInfo.hours_remaining : null;

  function getPMColor(hoursRemaining: number): string {
    if (hoursRemaining <= 0) return 'text-critical';
    if (hoursRemaining <= 50) return 'text-amber';
    return 'text-success';
  }

  function getPMBgColor(hoursRemaining: number): string {
    if (hoursRemaining <= 0) return 'bg-red-50 border-critical';
    if (hoursRemaining <= 50) return 'bg-amber-50 border-amber';
    return 'bg-green-50 border-success';
  }

  const canSubmit = unidad !== '' && horometro !== '';

  function handleSubmitIntent() {
    if (!canSubmit) return;
    setShowConfirm(true);
  }

  function handleConfirm() {
    setShowConfirm(false);
    const label = turno === 'inicio' ? 'Inicio' : 'Final';
    setToastMessage(`Horómetro ${label} de Turno registrado ✓`);
    setToastVisible(true);
  }

  function handleToastDismiss() {
    setToastVisible(false);
    navigate(-1);
  }

  return (
    <div className="flex flex-col pb-4">
      <SuccessToast
        message={toastMessage}
        visible={toastVisible}
        onDismiss={handleToastDismiss}
      />

      <ConfirmModal
        open={showConfirm}
        title="Confirmar horómetro"
        message={`¿Registrar horómetro ${turno === 'inicio' ? 'inicio' : 'final'} de turno para ${unidad || 'la unidad'}?`}
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
        <h1 className="text-xl font-bold text-text">Registro Horómetro</h1>
      </div>

      {/* Turno toggle */}
      <div className="bg-white rounded-xl p-3 shadow-sm border border-border mb-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTurno('inicio')}
            className={`flex-1 rounded-xl py-3 text-sm font-semibold transition-colors ${
              turno === 'inicio'
                ? 'bg-amber text-white'
                : 'bg-gray-100 text-text-secondary'
            }`}
          >
            Inicio de Turno
          </button>
          <button
            type="button"
            onClick={() => setTurno('final')}
            className={`flex-1 rounded-xl py-3 text-sm font-semibold transition-colors ${
              turno === 'final'
                ? 'bg-amber text-white'
                : 'bg-gray-100 text-text-secondary'
            }`}
          >
            Final de Turno
          </button>
        </div>
      </div>

      {/* Unit selector */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border mb-4">
        <label className="text-sm font-medium text-text-secondary block mb-2">Unidad</label>
        <select
          value={unidad}
          onChange={(e) => setUnidad(e.target.value)}
          className="w-full rounded-xl border border-border p-4 bg-white text-text text-lg font-semibold"
        >
          <option value="">Seleccionar unidad...</option>
          {EQUIPMENT_CATALOG.map((eq) => (
            <option key={eq.unit_id} value={eq.unit_id}>
              {eq.unit_id} — {eq.model}
            </option>
          ))}
        </select>
      </div>

      {/* Horómetro large input */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border mb-4">
        <label className="text-sm font-medium text-text-secondary block mb-2">Horómetro</label>
        <input
          type="number"
          value={horometro}
          onChange={(e) => setHorometro(e.target.value)}
          placeholder="12,500"
          className="w-full rounded-xl border border-border p-4 text-4xl font-mono font-semibold text-text bg-white text-center tracking-wider"
        />
        <p className="text-xs text-text-secondary text-center mt-2">horas</p>
      </div>

      {/* PM proximity card */}
      {pmInfo && horasActual !== null && (
        <div className={`rounded-xl p-4 border mb-4 ${getPMBgColor(pmInfo.hours_remaining)}`}>
          <div className="flex items-center gap-2 mb-3">
            <Clock size={18} className={getPMColor(pmInfo.hours_remaining)} />
            <span className="font-semibold text-text">Proximidad de PM</span>
          </div>

          {prevPMLevel && prevPMHours !== null && (
            <p className="text-sm text-text-secondary mb-1">
              Último PM: {prevPMLevel} completado
            </p>
          )}

          <p className={`text-sm font-medium ${getPMColor(pmInfo.hours_remaining)}`}>
            Próximo PM: {pmInfo.level} a {pmInfo.due_at.toLocaleString()} hrs
          </p>

          <p className={`text-base font-bold mt-1 ${getPMColor(pmInfo.hours_remaining)}`}>
            {pmInfo.hours_remaining <= 0
              ? `VENCIDO ${Math.abs(pmInfo.hours_remaining)} hrs`
              : `Faltan ${pmInfo.hours_remaining} hrs`}
          </p>
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmitIntent}
        disabled={!canSubmit}
        className="mt-2 w-full bg-amber text-white rounded-xl py-4 font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        style={{ minHeight: 52 }}
      >
        Registrar Horómetro
      </button>
    </div>
  );
}
