import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, AlertTriangle } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '../stores/auth-store';
import { mexicoDateInput } from '../lib/date-utils';
import { requestWorkshop, type WorkshopMechanic } from '../lib/workshop-api';
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
  mechanicId?: string;
  horas_estimadas: number;
  prioridad: OTPriority;
  estado: string;
  notas: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

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

function formatWeekLabel(monday: Date, days: number): string {
  const friday = addDays(monday, days - 1);
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
    mecanico: row[4]?.trim() || 'Sin asignar',
    mechanicId: row[9]?.trim(),
    horas_estimadas: parseFloat(row[5] ?? '0') || 0,
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
    if (e.mecanico === 'Sin asignar' || e.estado === 'Completado') continue;
    const key = `${e.mecanico}||${e.fecha_programada}`;
    hourMap.set(key, (hourMap.get(key) ?? 0) + (e.horas_estimadas || 0));
  }
  const conflicts: ConflictItem[] = [];
  for (const [key, hours] of hourMap.entries()) {
    if (hours > DAILY_HOUR_CAP) {
      const [mechanic, date] = key.split('||');
      conflicts.push({ mechanic: mechanic ?? '', date: date ?? '', hours });
    }
  }
  return conflicts.sort((a, b) => b.hours - a.hours);
}

// ── Page component ────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { workorders, fetched, fetchWorkOrders } = useWorkOrderStore();
  const role = useAuthStore((state) => state.role);
  const canSchedule = role === 'jefe_taller' || role === 'coordinador' || role === 'gerencia';
  const today = mexicoDateInput();
  const localToday = new Date(`${today}T12:00:00`);
  const [roster, setRoster] = useState<WorkshopMechanic[]>([]);
  const [rosterError, setRosterError] = useState('');

  const [weekMonday, setWeekMonday] = useState<Date>(() => getMondayOfWeek(localToday));
  const [showWeekend, setShowWeekend] = useState(() => [0, 6].includes(localToday.getDay()));
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMechanic, setModalMechanic] = useState('');
  const [modalDate, setModalDate] = useState(today);

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

  const fetchSchedule = useCallback(async () => {
    setLoadingSchedule(true);
    setScheduleError(null);
    try {
      const { schedule } = await requestWorkshop<{ schedule: string[][] }>('schedule');
      setEntries(schedule.map(parseScheduleRow).filter((entry): entry is ScheduleEntry => entry !== null));
    } catch (error) {
      setEntries([]);
      setScheduleError(error instanceof Error ? error.message : 'Error al cargar calendario');
    } finally {
      setLoadingSchedule(false);
    }
  }, []);

  useEffect(() => {
    void fetchSchedule();
  }, [fetchSchedule]);

  useEffect(() => {
    if (!canSchedule) return;
    let active = true;
    requestWorkshop<{ mechanics: WorkshopMechanic[] }>('mechanics')
      .then(({ mechanics }) => { if (active) setRoster(mechanics); })
      .catch((error: unknown) => { if (active) setRosterError(error instanceof Error ? error.message : 'Padrón no disponible'); });
    return () => { active = false; };
  }, [canSchedule]);

  // Navigation
  function goToPrevWeek() {
    setWeekMonday((prev) => addDays(prev, -7));
  }
  function goToNextWeek() {
    setWeekMonday((prev) => addDays(prev, 7));
  }
  function goToToday() {
    setWeekMonday(getMondayOfWeek(localToday));
  }

  const visibleEntries = entries
    .filter((entry) => entry.fecha_programada >= weekStartISO && entry.fecha_programada <= weekEndISO)
    .map((entry) => {
      const order = workorders.find((wo) => wo.ot_id === entry.ot_id);
      return order?.estado === 'Completado' ? { ...entry, estado: 'Completado' } : entry;
    });
  const mechanics = Array.from(new Set(['Sin asignar', ...roster.map((item) => item.userName), ...visibleEntries.map((entry) => entry.mecanico)]));
  const conflicts = buildConflicts(visibleEntries);

  function handleCellClick(mechanic: string, date: Date) {
    if (!canSchedule) return;
    const matching = roster.filter((item) => item.userName === mechanic);
    setModalMechanic(matching.length === 1 ? matching[0]!.userId : '');
    setModalDate(toISO(date));
    setModalOpen(true);
  }

  function handleModalSave(row: string[]) {
    const entry = parseScheduleRow(row);
    if (entry) {
      setEntries((current) => [...current.filter((item) => item.ot_id !== entry.ot_id), entry]);
      const date = new Date(`${entry.fecha_programada}T12:00:00`);
      setWeekMonday(getMondayOfWeek(date));
      if ([0, 6].includes(date.getDay())) setShowWeekend(true);
    }
    setModalOpen(false);
    void fetchWorkOrders();
  }

  const isCurrentWeek =
    toISO(weekMonday) === toISO(getMondayOfWeek(localToday));

  return (
    <div className="pb-6">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4">
        <CalendarDays size={20} className="text-[#162252] shrink-0" />
        <h1 className="text-lg font-bold text-[#162252]">Calendario de Taller</h1>
      </div>

      {/* ── Week navigation bar ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goToPrevWeek}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
            aria-label="Semana anterior"
          >
            <ChevronLeft size={18} />
          </button>

          <span className="text-sm font-semibold text-slate-700 text-center capitalize">
            {formatWeekLabel(weekMonday, weekDays.length)}
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

      {rosterError && <p className="mb-3 text-sm text-slate-600">{rosterError}</p>}
      {canSchedule && !scheduleError && (
        <button
          type="button"
          onClick={() => handleCellClick('', isCurrentWeek ? localToday : weekMonday)}
          className="mb-3 w-full rounded-xl bg-[#162252] p-3 text-sm font-semibold text-white sm:w-auto"
        >
          Programar OT
        </button>
      )}
      {!loadingSchedule && !scheduleError && (
        <>
          <div className="space-y-3 sm:hidden">
            {weekDays.map((date) => {
              const iso = toISO(date);
              const dayEntries = visibleEntries.filter((entry) => entry.fecha_programada === iso);
              return (
                <section key={iso} className="rounded-xl border border-slate-200 bg-white p-3">
                  <h2 className="mb-2 text-sm font-semibold capitalize text-slate-700">{date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' })}</h2>
                  {dayEntries.length === 0 ? <p className="text-xs text-slate-500">Sin órdenes programadas.</p> : (
                    <ul className="space-y-2">
                      {dayEntries.map((entry) => (
                        <li key={entry.ot_id}>
                          <button type="button" onClick={() => setSelectedEntry(entry)} className="w-full rounded-lg bg-slate-100 p-2 text-left text-sm text-[#162252]">
                            <span className="block font-semibold">{entry.ot_id} · {entry.unidad}</span>
                            <span className="block text-xs">{entry.mecanico} · {entry.horas_estimadas} h</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
          <div className="hidden sm:block">
            <CalendarGrid
              weekDays={weekDays}
              mechanics={mechanics}
              entries={visibleEntries}
              workorders={workorders}
              onCellClick={canSchedule ? handleCellClick : undefined}
              onCardClick={setSelectedEntry}
            />
          </div>
        </>
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
      {selectedEntry && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40"
          onClick={() => setSelectedEntry(null)}
        >
          <div
            className="w-full sm:max-w-sm max-h-[calc(100dvh-1rem)] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5"
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
        , document.body
      )}

      {/* ── Assign Work Modal ──────────────────────────────────────────────── */}
      {modalOpen && (
        <AssignWorkModal
          mechanic={modalMechanic}
          date={modalDate}
          mechanics={roster}
          workorders={workorders}
          onSave={handleModalSave}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
