import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, RefreshCw } from 'lucide-react';
import { useEquipmentList } from '../hooks/useEquipmentList';
import { getNextPM } from '../data/pm-rules';
import { mexicoDate, mexicoTime } from '../lib/date-utils';
import { appendRow, handoffMeterReadings, SheetAppendError, SHEET_TABS, syncExistingHorometros } from '../lib/sheets-api';
import type { CmmsMeterReading } from '../lib/cmms-meter';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { queueSubmission, flushQueue } from '../lib/offline-queue';
import { useAuthStore } from '../stores/auth-store';
import ConfirmModal from '../components/ui/ConfirmModal';
import SuccessToast, { type ToastType } from '../components/ui/SuccessToast';

type TurnoType = 'inicio' | 'final';

export default function HorometroPage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);
  const userId = useAuthStore((s) => s.userId);
  const role = useAuthStore((s) => s.role);
  const isPanama = useAuthStore((s) => s.project === 'tmf-panama');
  const equipment = useEquipmentList();
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (isOnline) {
      flushQueue().catch(() => {});
    }
  }, [isOnline]);

  const [turno, setTurno] = useState<TurnoType>('inicio');
  const [unidad, setUnidad] = useState('');
  const [horometro, setHorometro] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastType, setToastType] = useState<ToastType>('info');
  const [submitting, setSubmitting] = useState(false);
  const [retry, setRetry] = useState<{ row: string[]; meterReading: CmmsMeterReading; label: string }>();
  const [syncingExisting, setSyncingExisting] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const selectedEquipment = equipment.find((eq) => eq.unit_id === unidad);
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

  const canSubmit = unidad !== '' && horasActual !== null && Number.isFinite(horasActual)
    && horasActual >= (isPanama ? 0 : 0.01) && horasActual <= 1_000_000;

  function handleSubmitIntent() {
    if (!canSubmit) return;
    setShowConfirm(true);
  }

  async function handleHistoricalSync() {
    if (syncingExisting || (role !== 'supervisor' && role !== 'gerencia')) return;
    setSyncingExisting(true);
    setSyncMessage('');
    try {
      const result = await syncExistingHorometros();
      const unresolved = [...result.unmatched, ...result.ambiguous, ...result.rejected.map(unit => unit ?? 'unidad sin identificar')];
      setSyncMessage(
        unresolved.length > 0
          ? `CMMS confirmó ${result.accepted - result.unmatched.length - result.ambiguous.length} lectura(s). Revisar ${unresolved.join(', ')}.`
          : `CMMS recibió ${result.accepted} lectura(s) históricas.`,
      );
    } catch (error: unknown) {
      console.error('CMMS historical meter sync failed:', error);
      setSyncMessage('No se pudo sincronizar el histórico; se puede reintentar.');
    } finally {
      setSyncingExisting(false);
    }
  }

  async function handleConfirm() {
    if (submitting) return;
    setShowConfirm(false);
    setToastVisible(false);
    setSubmitting(true);

    const now = new Date();
    const meterReading: CmmsMeterReading = retry?.meterReading ?? {
      unit: unidad,
      hours: Number(horometro),
      recorded_at: now.toISOString(),
    };
    const row = retry?.row ?? [
      mexicoDate(now),          // FECHA
      mexicoTime(now),          // HORA
      unidad,                                   // UNIDAD
      selectedEquipment?.model || '',           // MODELO
      userName,                                 // OPERADOR
      turno,                                    // TURNO (inicio/final)
      String(horometro),                        // HORÓMETRO
      pmInfo ? pmInfo.level : '',               // PRÓXIMO PM
      pmInfo ? String(pmInfo.hours_remaining) : '', // FALTAN
    ];

    const label = retry?.label ?? (turno === 'inicio' ? 'inicial' : 'final');
    const show = (message: string, type: ToastType) => {
      setToastMessage(message);
      setToastType(type);
      setToastVisible(true);
    };
    try {
      try {
        if (!isOnline) throw new Error('Sin conexión.');
        await appendRow(SHEET_TABS.HOROMETROS, row, userId);
      } catch (error) {
        if (error instanceof SheetAppendError && error.status < 500 && ![408, 429].includes(error.status)) {
          setRetry(undefined);
          show(error.reason, 'error');
          return;
        }
        try {
          await queueSubmission({ type: 'horometro', ownerId: userId, timestamp: now.toISOString(),
            data: { tab: SHEET_TABS.HOROMETROS, values: row, ...(isPanama ? {} : { meterReading }) } });
          setRetry(undefined);
          show(`Horómetro ${label} guardado en este dispositivo. Pendiente de sincronización.`, 'info');
        } catch {
          setRetry({ row, meterReading, label });
          show('No se pudo confirmar el horómetro ni guardarlo en este dispositivo.', 'error');
        }
        return;
      }
      setRetry(undefined);
      if (isPanama) {
        show(`Horómetro ${label} registrado en Hermes. Conciliación con REGISTRO TMF y enlace CMMS pendientes.`, 'info');
        return;
      }
      try {
        await handoffMeterReadings([meterReading]);
        show(`Horómetro ${label} registrado. CMMS confirmó la lectura.`, 'success');
      } catch {
        try {
          await queueSubmission({ type: 'cmms_meter', ownerId: userId, data: { readings: [meterReading] }, timestamp: now.toISOString() });
          show(`Horómetro ${label} registrado. Envío a CMMS pendiente de sincronización.`, 'info');
        } catch {
          show(`Horómetro ${label} registrado. El envío a CMMS requiere revisión.`, 'info');
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleToastDismiss() {
    setToastVisible(false);
    if (toastType !== 'error') navigate(-1);
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

      {isPanama && <p className="mb-4 rounded-xl border border-border bg-white p-3 text-sm text-text-secondary">
        Registra una lectura excepcional cuando falte en el origen automático. Para entregar lecturas y producción al cierre, abre{' '}
        <Link to="/panama/turnos" className="font-semibold text-primary underline">Relevo de turno</Link>.
      </p>}

      {!isPanama && (role === 'supervisor' || role === 'gerencia') && (
        <div className="bg-white rounded-xl p-3 shadow-sm border border-border mb-4">
          <button
            type="button"
            onClick={() => void handleHistoricalSync()}
            disabled={syncingExisting || !isOnline}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-amber text-amber py-3 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw size={16} className={syncingExisting ? 'animate-spin' : ''} />
            {syncingExisting ? 'Sincronizando histórico…' : 'Sincronizar histórico con CMMS'}
          </button>
          {syncMessage && <p className="text-xs text-text-secondary text-center mt-2">{syncMessage}</p>}
        </div>
      )}

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
          {equipment.map((eq) => (
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
        onClick={retry ? () => void handleConfirm() : handleSubmitIntent}
        disabled={submitting || (toastVisible && toastType !== 'error') || (!retry && !canSubmit)}
        className="mt-2 w-full bg-amber text-white rounded-xl py-4 font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity btn-press"
        style={{ minHeight: 52 }}
      >
        {submitting ? 'Confirmando lectura…' : retry ? 'Reintentar la misma lectura' : 'Registrar Horómetro'}
      </button>
    </div>
  );
}
