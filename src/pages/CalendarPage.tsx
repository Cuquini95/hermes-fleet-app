/**
 * CalendarPage — Workshop Scheduling View
 *
 * Roles: jefe_taller, coordinador, gerencia, supervisor
 *
 * Layout:
 *   - Header with week navigation (< Apr 13-19 >) + Hoy button
 *   - CalendarGrid: mechanics × days, OT cards per cell
 *   - Conflicts section: over-scheduled mechanics listed at the bottom
 *
 * Data sources:
 *   - workorder-store  → full OT data
 *   - WORKSHOP_SCHEDULE sheet tab → schedule entries for the week
 *
 * Sheet tab: WORKSHOP_SCHEDULE
 * Columns (0-based index):
 *   0: #
 *   1: FECHA_PROGRAMADA  (YYYY-MM-DD)
 *   2: OT_ID
 *   3: UNIDAD
 *   4: MECANICO
 *   5: HORAS_ESTIMADAS
 *   6: PRIORIDAD
 *   7: ESTADO
 *   8: NOTAS
 */

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, AlertTriangle } from 'lucide-react';
import { readRange, SHEET_TABS } from '../lib/sheets-api';
import { useWorkOrderStore } from '../stores/workorder-store';
import CalendarGrid from '../components/calendar/CalendarGrid';
import AssignWorkModal from '../components/calendar/AssignWorkModal';
import type { OTPriority } from '../types/workorder';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScheduleEntry {
  fecha_programada: string;   // YYYY-MM-DD
  ot_id: string;
  unidad: string;
  mecanico: string;
  horas_estimadas: number;
  prioridad: OTPriority;
  estado: string;
  notas: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

// Hardcoded mechanic list — replace with a PERSONAL tab read when available
const DEFAULT_MECHANICS = [
  'Sin asignar',
  'Juan García',
  'Pedro López',
  'Carlos Martínez',
  'Roberto Sánchez',
  'Miguel Torres',
];

const DAILY_HOUR_CAP = 8;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatWeekLabel(monday: Date): string {
  const friday = addDays(monday, 4);
  const sameMonth = monday.getMonth() === friday.getMonth();
  const monthFmt = new Intl.DateTimeFormat('es-MX', { month: 'long' });
  if (sameMonth) {
    return `${monday.getDate()} – ${friday.getDate()} de ${monthFmt.format(monday)} ${monday.getFullYear()}`;
  }
  return (
    `${monday.getDate()} ${monthFmt.format(monday)} – ` +
    `${friday.getDate()} ${monthFmt.format(friday)} ${friday.getFullYear()}`
  );
}

function parseScheduleRow(row: string[]): ScheduleEntry | null {
  const fecha = row[1]?.trim();
  const otId = row[2]?.trim();
  if (!fecha || !otId || !otId.startsWith('OT-')) return null;
  return {
    fecha_programada: fecha,
    ot_id: otId,
    unidad: row[3]?.trim() ?? '',
    mecanico: row[4]?.trim() ?? 'Sin asignar',
    horas_estimadas: parseFloat(row[5]) || 0,
    prioridad: (row[6]?.trim() as OTPriority) || 'MEDIA',
    estado: row[7]?.trim() || 'Programado',
    notas: row[8]?.trim() ?? '',
  };
}

// ── Conflicts section ─────────────────────────────────────────────────────────

interface ConflictItem {
  mechanic: string;
  date: string;
  hours: number;
}

function buildConflicts(entries: ScheduleEntry[]): ConflictItem[] {
  const hourMap = new Map<string, number>();
  for (const e of entries) {
    const key = `${e.mecanico}||${e.fecha_programada}`;
    hourMap.set(key, (hourMap.get(key) ?? 0) + (e.horas_estimadas || 0));
  }
  const conflicts: ConflictItem[] = [];
  for (const [key, hours] of hourMap.entries()) {
    if (hours > DAILY_HOUR_CAP) {
      const [mechanic, date] = key.split('||');
      conflicts.push({ mechanic, date, hours });
    }
  }
  return conflicts.sort((a, b) => b.hours - a.hours);
}

// ── Page component ────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { workorders, fetched, fetchWorkOrders } = useWorkOrderStore();

  const [weekMonday, setWeekMonday] = useState<Date>(() => getMondayOfWeek(new Date()));
  const [showWeekend, setShowWeekend] = useState(false);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMechanic, setModalMechanic] = useState('');
  const [modalDate, setModalDate] = useState<Date>(new Date());

  // Detail drawer state (view/edit an existing entry)
  const [selectedEntry, setSelectedEntry] = useState<ScheduleEntry | null>(null);

  // Fetch base work orders once
  useEffect(() => {
    if (!fetched) { fetchWorkOrders(); }
  }, [fetched, fetchWorkOrders]);

  // Derive week days
  const weekDays = Array.from({ length: showWeekend ? 7 : 5 }, (_, i) =>
    addDays(weekMonday, i)
  );

  const weekStartISO = toISO(weekMonday);
  const weekEndISO = toISO(addDays(weekMonday, weekDays.length - 1));

  // Fetch schedule for the visible week
  const fetchSchedule = useCallback(async () => {
    setLoadingSchedule(true);
    setScheduleError(null);
    try {
      const rows = await readRange(SHEET_TABS.WORKSHOP_SCHEDULE);
      const parsed = rows
        .slice(1) // skip header row
        .map(parseScheduleRow)
        .filter((e): e is ScheduleEntry => e !== null)
        .filter(
          (e) => e.fecha_programada >= weekStartISO && e.fecha_programada <= weekEndISO
        );
      setEntries(parsed);
    } catch (err: unknown) {
      setScheduleError(err instanceof Error ? err.message : 'Error al cargar horario');
    } finally {
      setLoadingSchedule(false);
    }
  }, [weekStartISO, weekEndISO]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  // Navigation
  function goToPrevWeek() {
    setWeekMonday((prev) => addDays(prev, -7));
  }
  function goToNextWeek() {
    setWeekMonday((prev) => addDays(prev, 7));
  }
  function goToToday() {
    setWeekMonday(getMondayOfWeek(new Date()));
  }

  // Derive unique mechanics from entries + default list
  const mechanics = Array.from(
    new Set([...DEFAULT_MECHANICS, ...entries.map((e) => e.mecanico)])
  ).filter(Boolean);

  // Conflicts
  const conflicts = buildConflicts(entries);

  // Cell click → open assign modal
  function handleCellClick(mechanic: string, date: Date) {
    setModalMechanic(mechanic === 'Sin asignar' ? '' : mechanic);
    setModalDate(date);
    setModalOpen(true);
  }

  // Card click → show detail drawer
  function handleCardClick(entry: ScheduleEntry) {
    setSelectedEntry(entry);
  }

  // After a new assignment is saved, optimistically add it
  function handleModalSave(entry: ScheduleEntry) {
    setEntries((prev) => [...prev, entry]);
    setModalOpen(false);
  }

  const isCurrentWeek =
    toISO(weekMonday) === toISO(getMondayOfWeek(new Date()));

  return (
    <div className="pb-6">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4">
        <CalendarDays size={20} className="text-[#162252] shrink-0" />
        <h1 className="text-lg font-bold text-[#162252]">Calendario de Taller</h1>
      </div>

      {/* ── Week navigation bar ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goToPrevWeek}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
            aria-label="Semana anterior"
          >
            <ChevronLeft size={18} />
          </button>

          <span className="text-sm font-semibold text-slate-700 min-w-[180px] text-center capitalize">
            {formatWeekLabel(weekMonday)}
          </span>

          <button
            type="button"
            onClick={goToNextWeek}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
            aria-label="Siguiente semana"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Weekend toggle */}
          <button
            type="button"
            onClick={() => setShowWeekend((v) => !v)}
            className={[
              'text-xs px-2.5 py-1.5 rounded-lg border transition-colors',
              showWeekend
                ? 'bg-[#162252] text-white border-[#162252]'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50',
            ].join(' ')}
          >
            {showWeekend ? 'L–D' : 'L–V'}
          </button>

          {/* Hoy button */}
          {!isCurrentWeek && (
            <button
              type="button"
              onClick={goToToday}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Hoy
            </button>
          )}

          {/* Refresh */}
          <button
            type="button"
            onClick={fetchSchedule}
            disabled={loadingSchedule}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {loadingSchedule ? '...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* ── Loading / error states ─────────────────────────────────────────── */}
      {loadingSchedule && (
        <div className="text-center py-4 text-sm text-slate-400">
          Cargando horario...
        </div>
      )}
      {scheduleError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 mb-3">
          {scheduleError}
        </div>
      )}

      {/* ── Calendar grid ─────────────────────────────────────────────────── */}
      {!loadingSchedule && (
        <CalendarGrid
          weekDays={weekDays}
          mechanics={mechanics}
          entries={entries}
          workorders={workorders}
          onCellClick={handleCellClick}
          onCardClick={handleCardClick}
        />
      )}

      {/* ── Conflicts section ──────────────────────────────────────────────── */}
      {conflicts.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-red-500" />
            <h2 className="text-sm font-bold text-red-600">
              Conflictos ({conflicts.length})
            </h2>
          </div>
          <div className="space-y-2">
            {conflicts.map((c, i) => (
              <div
                key={i}
                className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-3 py-2"
              >
                <div>
                  <span className="text-sm font-medium text-red-800">{c.mechanic}</span>
                  <span className="text-xs text-red-600 ml-2">{c.date}</span>
                </div>
                <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                  {c.hours}h / {DAILY_HOUR_CAP}h
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Entry detail drawer ────────────────────────────────────────────── */}
      {selectedEntry && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
          onClick={() => setSelectedEntry(null)}
        >
          <div
            className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-[#162252]">{selectedEntry.ot_id}</h2>
              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500"
              >
                ✕
              </button>
            </div>
            <dl className="text-sm space-y-1.5">
              <div className="flex justify-between">
                <dt className="text-slate-500">Unidad</dt>
                <dd className="font-medium text-slate-800">{selectedEntry.unidad}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Mecánico</dt>
                <dd className="font-medium text-slate-800">{selectedEntry.mecanico}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Fecha</dt>
                <dd className="font-medium text-slate-800">{selectedEntry.fecha_programada}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Horas</dt>
                <dd className="font-medium text-slate-800">{selectedEntry.horas_estimadas}h</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Prioridad</dt>
                <dd className="font-medium text-slate-800">{selectedEntry.prioridad}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Estado</dt>
                <dd className="font-medium text-slate-800">{selectedEntry.estado}</dd>
              </div>
              {selectedEntry.notas && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Notas</dt>
                  <dd className="font-medium text-slate-800 text-right max-w-[60%]">{selectedEntry.notas}</dd>
                </div>
              )}
            </dl>
            <button
              type="button"
              onClick={() => setSelectedEntry(null)}
              className="mt-4 w-full py-2.5 rounded-xl bg-[#162252] text-white text-sm font-semibold"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* ── Assign Work Modal ──────────────────────────────────────────────── */}
      {modalOpen && (
        <AssignWorkModal
          mechanic={modalMechanic}
          date={modalDate}
          mechanics={mechanics.filter((m) => m !== 'Sin asignar')}
          workorders={workorders}
          onSave={handleModalSave}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
