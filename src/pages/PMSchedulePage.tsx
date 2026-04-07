import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wrench, RefreshCw } from 'lucide-react';
import { useEquipmentList } from '../hooks/useEquipmentList';
import { getNextPM } from '../data/pm-rules';
import { readRange, SHEET_TABS } from '../lib/sheets-api';
import { SkeletonList } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';

interface PMEntry {
  unit_id: string;
  model: string;
  type: string;
  currentHours: number;
  pmLevel: string;
  dueAt: number;
  hoursRemaining: number;
  source: 'sheets' | 'catalog'; // where the horómetro came from
}

/**
 * Read the latest horómetro for each unit from Google Sheets.
 * Tab: 04B Registro Horómetros
 * Columns: FECHA, HORA, UNIDAD, MODELO, OPERADOR, TURNO, HORÓMETRO, ...
 */
async function fetchLatestHorometros(): Promise<Record<string, number>> {
  const rows = await readRange(SHEET_TABS.HOROMETROS);
  const latest: Record<string, { hours: number; date: string }> = {};

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const unidad = (row[2] ?? '').trim();   // UNIDAD column
    const fecha = (row[0] ?? '').trim();     // FECHA column
    const horoStr = (row[6] ?? '').trim();   // HORÓMETRO column
    const horo = parseFloat(horoStr);

    if (!unidad || isNaN(horo) || horo <= 0) continue;

    // Keep the most recent reading per unit
    const existing = latest[unidad];
    if (!existing || fecha >= existing.date || horo > existing.hours) {
      latest[unidad] = { hours: horo, date: fecha };
    }
  }

  const result: Record<string, number> = {};
  for (const [unit, data] of Object.entries(latest)) {
    result[unit] = data.hours;
  }
  return result;
}

function getBorderColor(hrs: number): string {
  if (hrs <= 0) return 'border-l-critical';
  if (hrs <= 50) return 'border-l-amber';
  return 'border-l-success';
}

function getStatusPill(hrs: number): { label: string; cls: string } {
  if (hrs <= 0) return { label: 'Vencido', cls: 'bg-red-100 text-critical' };
  return { label: 'Próximo', cls: 'bg-amber-100 text-amber' };
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
  const equipment = useEquipmentList();
  const [entries, setEntries] = useState<PMEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadPMData() {
    setLoading(true);
    setError(null);

    try {
      // Try to get live horómetro data from Google Sheets
      let sheetHorometros: Record<string, number> = {};
      try {
        sheetHorometros = await fetchLatestHorometros();
      } catch {
        // If sheet read fails, we'll use catalog data as fallback
      }

      const pmEntries: PMEntry[] = equipment.map((eq) => {
        // Use sheet horómetro if available, otherwise catalog
        const hasSheetData = sheetHorometros[eq.unit_id] !== undefined;
        const currentHours = hasSheetData
          ? sheetHorometros[eq.unit_id]
          : eq.current_horometro;

        const pm = getNextPM(eq.model, currentHours);

        return {
          unit_id: eq.unit_id,
          model: eq.model,
          type: eq.type,
          currentHours,
          pmLevel: pm.level,
          dueAt: pm.due_at,
          hoursRemaining: pm.hours_remaining,
          source: (hasSheetData ? 'sheets' : 'catalog') as 'sheets' | 'catalog',
        };
      })
        // Only show units within less than 50 hours of a PM (or overdue)
        .filter((entry) => entry.hoursRemaining < 50)
        .sort((a, b) => a.hoursRemaining - b.hoursRemaining);

      setEntries(pmEntries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPMData();
  }, []);

  return (
    <div className="flex flex-col pb-4 animate-fade-up">
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
        <button
          type="button"
          onClick={loadPMData}
          disabled={loading}
          className="ml-auto p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <RefreshCw size={18} className={`text-text-secondary ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-xs text-blue-700">
        Mostrando equipos con PM a menos de 50 horas. Datos de horómetro desde Google Sheets.
      </div>

      {loading && <SkeletonList count={4} />}

      {error && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-border text-center">
          <p className="text-red-600 text-sm mb-2">Error al cargar</p>
          <p className="text-xs text-text-secondary mb-3">{error}</p>
          <button
            type="button"
            onClick={loadPMData}
            className="px-4 py-2 bg-amber text-white rounded-xl text-sm font-medium"
          >
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && entries.length === 0 && (
        <EmptyState
          type="workorders"
          title="Sin PMs próximos"
          description="Ningún equipo tiene mantenimiento preventivo a menos de 50 horas"
        />
      )}

      {/* PM cards */}
      {!loading && (
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
                      {entry.source === 'sheets' && (
                        <span className="text-xs text-success font-medium">● Live</span>
                      )}
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
      )}
    </div>
  );
}
