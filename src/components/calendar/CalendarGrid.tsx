/**
 * CalendarGrid
 *
 * Renders a week view as a CSS grid:
 *   - Rows = Mechanics
 *   - Columns = Mon – Fri (or Mon – Sun when showWeekend is true)
 *   - Each cell shows assigned schedule entries as compact cards
 *   - Over-capacity days show a red "sobrecargado" badge
 *
 * Sheet: WORKSHOP_SCHEDULE
 * Headers: #, FECHA_PROGRAMADA, OT_ID, UNIDAD, MECANICO, HORAS_ESTIMADAS,
 *           PRIORIDAD, ESTADO, NOTAS
 */

import React, { useMemo } from 'react';
import type { ScheduleEntry } from '../../pages/CalendarPage';
import type { WorkOrder, OTPriority } from '../../types/workorder';

// ── Constants ─────────────────────────────────────────────────────────────────

const DAILY_HOUR_CAP = 8;

const PRIORITY_STYLES: Record<OTPriority, { border: string; bg: string; text: string }> = {
  CRITICA: { border: 'border-red-500',   bg: 'bg-red-50',    text: 'text-red-700'   },
  ALTA:    { border: 'border-amber-500', bg: 'bg-amber-50',  text: 'text-amber-700' },
  MEDIA:   { border: 'border-blue-500',  bg: 'bg-white',     text: 'text-blue-700'  },
  BAJA:    { border: 'border-gray-300',  bg: 'bg-white',     text: 'text-gray-600'  },
};

const DAY_NAMES_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// ── Types ─────────────────────────────────────────────────────────────────────

interface CalendarGridProps {
  weekDays: Date[];
  mechanics: string[];
  entries: ScheduleEntry[];
  workorders: WorkOrder[];
  onCellClick: (mechanic: string, date: Date) => void;
  onCardClick: (entry: ScheduleEntry) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function totalHours(cellEntries: ScheduleEntry[]): number {
  return cellEntries.reduce((sum, e) => sum + (Number(e.horas_estimadas) || 0), 0);
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface OTCardProps {
  entry: ScheduleEntry;
  ot: WorkOrder | undefined;
  onClick: (e: React.MouseEvent) => void;
}

function OTCard({ entry, ot, onClick }: OTCardProps) {
  const priority = (ot?.prioridad ?? entry.prioridad) as OTPriority;
  const styles = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.MEDIA;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full text-left rounded border-l-4 px-1.5 py-1 mb-1 text-xs leading-tight',
        'hover:brightness-95 active:scale-95 transition-transform',
        styles.border,
        styles.bg,
        styles.text,
      ].join(' ')}
    >
      <div className="font-semibold truncate">{entry.ot_id}</div>
      <div className="truncate opacity-80">{entry.unidad}</div>
      {entry.horas_estimadas ? (
        <div className="opacity-60">{entry.horas_estimadas}h</div>
      ) : null}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CalendarGrid({
  weekDays,
  mechanics,
  entries,
  workorders,
  onCellClick,
  onCardClick,
}: CalendarGridProps) {
  // Build a lookup: mechanic + dateISO → entries[]
  const cellMap = useMemo(() => {
    const map = new Map<string, ScheduleEntry[]>();
    for (const entry of entries) {
      const key = `${entry.mecanico}||${entry.fecha_programada}`;
      const existing = map.get(key) ?? [];
      map.set(key, [...existing, entry]);
    }
    return map;
  }, [entries]);

  // Build a WO lookup by OT_ID
  const woMap = useMemo(() => {
    const map = new Map<string, WorkOrder>();
    for (const wo of workorders) {
      map.set(wo.ot_id, wo);
    }
    return map;
  }, [workorders]);

  const numCols = weekDays.length;

  return (
    // Outer wrapper: horizontal scroll on small screens
    <div className="overflow-x-auto -mx-4 px-4">
      {/* Grid container */}
      <div
        className="min-w-[640px]"
        style={{
          display: 'grid',
          gridTemplateColumns: `120px repeat(${numCols}, minmax(110px, 1fr))`,
          gap: '1px',
          backgroundColor: '#e2e8f0',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        {/* ── Header row ── */}
        {/* Corner cell */}
        <div
          className="bg-[#162252] text-white text-xs font-semibold flex items-center justify-center px-2 py-3"
          style={{ minHeight: 44 }}
        >
          Mecánico
        </div>

        {weekDays.map((day, i) => {
          const today = toISO(new Date());
          const isToday = toISO(day) === today;
          return (
            <div
              key={i}
              className={[
                'flex flex-col items-center justify-center px-1 py-3 text-xs font-semibold',
                isToday
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#162252] text-slate-200',
              ].join(' ')}
            >
              <span>{DAY_NAMES_ES[day.getDay() === 0 ? 6 : day.getDay() - 1]}</span>
              <span className={isToday ? 'text-white font-bold' : 'text-slate-300'}>
                {day.getDate()}
              </span>
            </div>
          );
        })}

        {/* ── Mechanic rows ── */}
        {mechanics.map((mechanic) => (
          <>
            {/* Mechanic label cell */}
            <div
              key={`label-${mechanic}`}
              className="bg-white flex items-start justify-start px-2 py-2 text-xs font-medium text-slate-700 border-r border-slate-200"
              style={{ minHeight: 80 }}
            >
              <span className="leading-tight">{mechanic}</span>
            </div>

            {/* Day cells */}
            {weekDays.map((day, di) => {
              const dateISO = toISO(day);
              const key = `${mechanic}||${dateISO}`;
              const cellEntries = cellMap.get(key) ?? [];
              const hours = totalHours(cellEntries);
              const overloaded = hours > DAILY_HOUR_CAP;

              return (
                <div
                  key={`${mechanic}-${di}`}
                  className="bg-white p-1.5 relative cursor-pointer hover:bg-slate-50 transition-colors"
                  style={{ minHeight: 80 }}
                  onClick={() => onCellClick(mechanic, day)}
                >
                  {/* Overload badge */}
                  {overloaded && (
                    <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-full leading-none z-10">
                      {hours}h
                    </span>
                  )}

                  {/* Hours indicator bar */}
                  {cellEntries.length > 0 && (
                    <div className="mb-1 h-1 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={[
                          'h-full rounded-full transition-all',
                          overloaded ? 'bg-red-500' : 'bg-green-500',
                        ].join(' ')}
                        style={{
                          width: `${Math.min((hours / DAILY_HOUR_CAP) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  )}

                  {/* OT Cards */}
                  {cellEntries.map((entry, ei) => (
                    <OTCard
                      key={`${entry.ot_id}-${ei}`}
                      entry={entry}
                      ot={woMap.get(entry.ot_id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCardClick(entry);
                      }}
                    />
                  ))}

                  {/* Empty cell plus hint */}
                  {cellEntries.length === 0 && (
                    <div className="flex items-center justify-center h-full opacity-0 hover:opacity-100 transition-opacity">
                      <span className="text-slate-300 text-lg leading-none">+</span>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}
