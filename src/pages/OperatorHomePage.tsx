import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  Camera,
  Fuel,
  Gauge,
  MapPin,
  FileText,
  CheckCircle,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { readRange, SHEET_TABS } from '../lib/sheets-api';
import { mexicoDate, mexicoDateInput } from '../lib/date-utils';
import { requestPanamaDispatch, type DispatchAssignment } from '../lib/panama-dispatch';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface ActionCard {
  label: string;
  panamaLabel?: string;
  icon: React.ReactNode;
  path: string;
}

const ACTION_CARDS: ActionCard[] = [
  { label: 'Checklist', icon: <ClipboardCheck size={32} className="text-amber" />, path: '/dvir' },
  { label: 'Reportar Falla', panamaLabel: 'Reportar falla', icon: <Camera size={32} className="text-amber" />, path: '/falla' },
  { label: 'Diesel', panamaLabel: 'Diésel', icon: <Fuel size={32} className="text-amber" />, path: '/diesel' },
  { label: 'Horómetro', icon: <Gauge size={32} className="text-amber" />, path: '/horometro' },
  { label: 'Fletes', icon: <MapPin size={32} className="text-amber" />, path: '/flete' },
  { label: 'Mis Reportes', panamaLabel: 'Mis reportes', icon: <FileText size={32} className="text-amber" />, path: '/my-reports' },
];

export default function OperatorHomePage() {
  const isPanama = useAuthStore((s) => s.project === 'tmf-panama');
  const userId = useAuthStore((s) => s.userId);
  return isPanama ? <PanamaOperatorHome key={userId} userId={userId} /> : <FleetOperatorHome />;
}

function PanamaOperatorHome({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const allowedUnits = useAuthStore(state => state.assignedUnits);
  const allUnits = useAuthStore(state => state.allUnits);
  const isOnline = useOnlineStatus();
  const date = mexicoDateInput();
  const [loaded, setLoaded] = useState<{ date: string; assignments: DispatchAssignment[] }>();
  const [choice, setChoice] = useState('');
  const [loadError, setLoadError] = useState(false);
  const assignments = loaded?.date === date ? loaded.assignments : [];
  const selected = assignments.length === 1 ? assignments[0] : assignments.find(item => item.id === choice);
  const fallbackUnit = assignments.length === 0 && !allUnits && allowedUnits.length === 1 ? allowedUnits[0] : undefined;
  const unit = selected?.unit ?? fallbackUnit;

  useEffect(() => {
    if (!isOnline) return;
    const controller = new AbortController();
    void requestPanamaDispatch(undefined, controller.signal, date).then(({ assignments: records }) => {
      if (controller.signal.aborted) return;
      setLoadError(false);
      setLoaded({ date, assignments: records.filter(item => item.date === date && item.operator.id === userId) });
    }).catch(() => { if (!controller.signal.aborted) setLoadError(true); });
    return () => controller.abort();
  }, [date, isOnline, userId]);

  const capture = (path: string) => unit ? `${path}?${new URLSearchParams({ unit })}` : path;
  const handoff = new URLSearchParams();
  if (unit) handoff.set('unit', unit);
  if (selected) handoff.set('shift', selected.shift);
  const primary = ACTION_CARDS.filter(item => ['/horometro', '/dvir', '/falla'].includes(item.path));
  const secondary = ACTION_CARDS.filter(item => ['/diesel', '/flete', '/my-reports'].includes(item.path));

  return <div className="space-y-4 py-4">
    <header className="space-y-2 rounded-xl border border-border bg-white p-4">
      <h1 className="text-xl font-bold text-text">Mi turno</h1>
      {assignments.length > 1 && <label className="block text-sm font-semibold">
        Asignación de turno
        <select value={choice} onChange={event => setChoice(event.target.value)}
          className="mt-1 block min-h-11 w-full rounded-lg border border-border bg-white px-2 text-base">
          <option value="">Selecciona tu turno</option>
          {assignments.map(item => <option key={item.id} value={item.id}>{item.unit} · {item.shift}</option>)}
        </select>
      </label>}
      <p className="break-words text-base font-semibold">
        {unit || 'Equipo por seleccionar'} · {selected?.shift ?? 'Turno por confirmar'}
      </p>
      {selected?.site && <p className="break-words text-sm text-text-secondary">{selected.site}</p>}
      {selected && selected.readiness.level !== 'ok' && (
        <p className="text-sm text-amber-900">{selected.readiness.reason}</p>
      )}
      {(!isOnline || loadError) && <p role="status" className="text-sm text-text-secondary">
        {isOnline ? 'No se pudo comprobar el turno.' : 'Sin señal'}
      </p>}
    </header>

    <div className="grid grid-cols-3 gap-2">
      {primary.map(({ path, label, icon }) => (
        <button type="button" key={path} onClick={() => navigate(capture(path))}
          className="flex min-h-24 min-w-0 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-white px-1 text-center text-sm font-semibold shadow-sm">
          {icon}
          {path === '/dvir' ? 'Inspección' : path === '/falla' ? 'Reportar falla' : label}
        </button>
      ))}
    </div>
    <div className="grid grid-cols-2 gap-2">
      {secondary.map(({ path, panamaLabel, label }) => (
        <button type="button" key={path} onClick={() => navigate(path)}
          className="min-h-11 rounded-lg border border-border bg-white p-2 text-sm font-medium">
          {panamaLabel ?? label}
        </button>
      ))}
      <button type="button" onClick={() => navigate(`/panama/turnos${handoff.size ? '?' + handoff : ''}`)}
        className="min-h-11 rounded-lg border border-border bg-white p-2 text-sm font-medium">Relevo de turno</button>
    </div>
  </div>;
}

function FleetOperatorHome() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);

  const [dvirDone, setDvirDone] = useState<boolean | null>(null); // null = loading
  const [reportCount, setReportCount] = useState(0);

  const checkDVIRStatus = useCallback(async () => {
    try {
      const rows = await readRange(SHEET_TABS.INSPECCIONES);
      const today = mexicoDate();
      let todayCount = 0;
      let foundDVIR = false;

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        const rowDate = (row[2] ?? '').trim();  // FECHA column (index 2)
        const rowOperator = (row[6] ?? '').trim(); // OPERADOR column (index 6)

        if (rowDate === today && rowOperator === userName) {
          foundDVIR = true;
          todayCount++;
        }
      }

      setDvirDone(foundDVIR);
      setReportCount(todayCount);
    } catch {
      // If fetch fails, hide the banner rather than show false alarm
      setDvirDone(null);
    }
  }, [userName]);

  useEffect(() => {
    checkDVIRStatus();
  }, [checkDVIRStatus]);

  const greeting = new Date().getHours() < 12 ? 'Buenos días' : new Date().getHours() < 18 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div className="flex flex-col py-4 animate-fade-up">
      {/* Greeting */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-text">{greeting}, {userName}</h1>
        <p className="text-text-secondary text-sm mt-0.5">Operador</p>
      </div>

      {/* DVIR status — dynamic from Google Sheets */}
      {dvirDone === false && (
        <div className="bg-red-50 border-l-4 border-critical rounded-lg p-3 mb-4">
          <p className="text-sm font-medium text-critical">
            ⚠️ Tu Checklist de hoy no ha sido completado
          </p>
        </div>
      )}
      {dvirDone === true && (
        <div className="bg-green-50 border-l-4 border-success rounded-lg p-3 mb-4 flex items-center gap-2">
          <CheckCircle size={16} className="text-success shrink-0" />
          <p className="text-sm font-medium text-success">
            Checklist completado hoy ✓
          </p>
        </div>
      )}

      {/* Action grid 2x3 */}
      <div className="grid grid-cols-2 gap-3">
        {ACTION_CARDS.map(({ label, icon, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex flex-col items-center justify-center gap-2 bg-white rounded-xl p-4 shadow-sm border border-border btn-press"
            style={{ minHeight: 100 }}
          >
            {icon}
            <span className="text-sm font-medium text-center text-text">{label}</span>
          </button>
        ))}
      </div>

      {/* Footer counter — dynamic */}
      {reportCount > 0 && (
        <p className="text-sm text-success text-center mt-4 font-medium">
          Reportes hoy: {reportCount} ✓
        </p>
      )}
    </div>
  );
}
