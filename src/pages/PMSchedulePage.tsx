import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wrench } from 'lucide-react';
import { EQUIPMENT_CATALOG } from '../data/equipment-catalog';
import { getNextPM } from '../data/pm-rules';

interface PMEntry {
  unit_id: string;
  model: string;
  type: string;
  currentHours: number;
  pmLevel: string;
  dueAt: number;
  hoursRemaining: number;
}

function buildPMEntries(): PMEntry[] {
  return EQUIPMENT_CATALOG.map((eq) => {
    const pm = getNextPM(eq.model, eq.current_horometro);
    return {
      unit_id: eq.unit_id,
      model: eq.model,
      type: eq.type,
      currentHours: eq.current_horometro,
      pmLevel: pm.level,
      dueAt: pm.due_at,
      hoursRemaining: pm.hours_remaining,
    };
  }).sort((a, b) => a.hoursRemaining - b.hoursRemaining);
}

function getBorderColor(hrs: number): string {
  if (hrs <= 0) return 'border-l-critical';
  if (hrs <= 50) return 'border-l-amber';
  return 'border-l-success';
}

function getStatusPill(hrs: number): { label: string; cls: string } {
  if (hrs <= 0) return { label: 'Vencido', cls: 'bg-red-100 text-critical' };
  if (hrs <= 50) return { label: 'Próximo', cls: 'bg-amber-100 text-amber' };
  return { label: 'Pendiente', cls: 'bg-blue-100 text-blue-600' };
}

function getBarColor(hrs: number): string {
  if (hrs <= 0) return 'bg-critical';
  if (hrs <= 50) return 'bg-amber';
  return 'bg-success';
}

function getCountdownText(hrs: number): string {
  if (hrs <= 0) return `VENCIDO ${Math.abs(hrs)} hrs`;
  return `Faltan ${hrs} hrs`;
}

export default function PMSchedulePage() {
  const navigate = useNavigate();
  const entries = buildPMEntries();

  return (
    <div className="flex flex-col pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <h1 className="text-xl font-bold text-text">Programa de Mantenimiento</h1>
      </div>

      {/* PM cards */}
      <div className="flex flex-col gap-3">
        {entries.map((entry) => {
          const pill = getStatusPill(entry.hoursRemaining);
          const progressPct = Math.max(
            0,
            Math.min(
              100,
              entry.hoursRemaining <= 0
                ? 100
                : Math.round(((entry.dueAt - entry.hoursRemaining) / entry.dueAt) * 100)
            )
          );

          return (
            <div
              key={entry.unit_id}
              className={`bg-white rounded-xl shadow-sm border border-border border-l-4 ${getBorderColor(entry.hoursRemaining)} p-4`}
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text">{entry.unit_id}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pill.cls}`}>
                      {pill.label}
                    </span>
                  </div>
                  <p className="text-text-secondary text-xs mt-0.5">{entry.model}</p>
                </div>
                <div className="shrink-0 flex items-center gap-1.5 text-text-secondary">
                  <Wrench size={14} />
                  <span className="text-sm font-semibold text-text">{entry.pmLevel}</span>
                </div>
              </div>

              {/* PM target */}
              <p className="text-sm text-text-secondary mb-1">
                a {entry.dueAt.toLocaleString()} hrs
              </p>

              {/* Current + countdown */}
              <div className="flex items-center justify-between text-sm mb-3">
                <span className="text-text-secondary font-mono">
                  Actual: {entry.currentHours.toLocaleString()} hrs
                </span>
                <span
                  className={`font-bold ${
                    entry.hoursRemaining <= 0
                      ? 'text-critical'
                      : entry.hoursRemaining <= 50
                      ? 'text-amber'
                      : 'text-success'
                  }`}
                >
                  {getCountdownText(entry.hoursRemaining)}
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getBarColor(entry.hoursRemaining)} rounded-full transition-all`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
