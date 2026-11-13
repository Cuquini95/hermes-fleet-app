/**
 * @fileoverview Monolithic by design (> 400 LOC).
 * Dashboard briefing card — fetches multiple ranges, computes KPIs, and renders them in one pass; extraction would create thin wrappers.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { readRange, SHEET_TABS } from '../../lib/sheets-api';
import { useEquipmentList } from '../../hooks/useEquipmentList';
import { useFleetDispatch, type FleetDispatch } from '../../hooks/useFleetDispatch';
import { dispatchAvailability } from '../../lib/availability';
import { normalizeUnitId } from '../../lib/dispatch-readiness';
import { useEquipmentStore } from '../../stores/equipment-store';
import { fetchPanamaMaintenance } from '../../lib/panama-maintenance';
import { briefingPmAlerts } from './briefing-pm';
import { parseInventoryRows } from '../../lib/inventory-rows';
import { mexicoDate, mexicoDateInput, mexicoTimeInput } from '../../lib/date-utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FuelAnomaly {
  unit: string;
  totalLiters: number;
  avgLiters: number;
  pctAbove: number;
}

interface MissingChecklist {
  unit: string;
  operator: string;
}

interface CriticalPart {
  partNumber: string;
  description: string;
  stock: number;
  minimo: number;
}

interface BriefingData {
  fuelAnomalies: FuelAnomaly[];
  fuelTotalDiesel: number | null;
  dvirCompliantCount: number;
  dvirExpectedCount: number | null;
  missingChecklists: MissingChecklist[];
  criticalParts: CriticalPart[];
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function sheetDateKey(raw: string): string {
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (!match) return '';
  const [, day = '', month = '', year = ''] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function formatTodayLabel(date: Date): string {
  const [day, month, year] = mexicoDate(date).split('/');
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  return `${day} ${months[Number(month) - 1]} ${year}`;
}

function formatTime(date: Date): string {
  return `${mexicoTimeInput(date)} hrs`;
}

function msAgo(date: Date): number {
  return Date.now() - date.getTime();
}

function formatMinutesAgo(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'justo ahora';
  if (minutes === 1) return 'hace 1 min';
  return `hace ${minutes} min`;
}

// ── Data processing helpers ───────────────────────────────────────────────────

function buildBriefingFromSheets(
  equipmentList: ReturnType<typeof useEquipmentList>,
  combustibleRows: string[][] | null,
  inspeccionesRows: string[][] | null,
  inventarioRows: string[][] | null,
  fleetAvailable: boolean,
): BriefingData {
  // --- Fuel: last 7 days diesel ---
  const now = new Date();
  const today = mexicoDateInput(now);
  const weekStart = mexicoDateInput(new Date(now.getTime() - 6 * 86_400_000));
  const dieselByUnit = new Map<string, number>();
  let fuelTotalDiesel = 0;

  for (const row of combustibleRows ?? []) {
    const date = sheetDateKey(row[1] ?? '');
    const type = (row[5] ?? '').trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const unit = (row[3] ?? '').trim().toUpperCase();
    const liters = Number((row[6] ?? '').trim().replace(/,(?=\d{3}(?:\D|$))/g, '').replace(',', '.'));
    if (type !== 'diesel' || !unit || !Number.isFinite(liters) || liters <= 0 || date < weekStart || date > today) continue;
    dieselByUnit.set(unit, (dieselByUnit.get(unit) ?? 0) + liters);
    fuelTotalDiesel += liters;
  }

  const fuelValues = Array.from(dieselByUnit.values());
  const fuelAvg = fuelValues.length > 0 ? fuelValues.reduce((a, b) => a + b, 0) / fuelValues.length : 0;
  const fuelAnomalies: FuelAnomaly[] = [];
  for (const [unit, totalLiters] of dieselByUnit) {
    if (fuelAvg > 0 && totalLiters > fuelAvg * 1.3) {
      fuelAnomalies.push({
        unit,
        totalLiters: Math.round(totalLiters),
        avgLiters: Math.round(fuelAvg),
        pctAbove: Math.round(((totalLiters - fuelAvg) / fuelAvg) * 100),
      });
    }
  }
  fuelAnomalies.sort((a, b) => b.pctAbove - a.pctAbove);

  // --- DVIR compliance today ---
  const reportedUnitsToday = new Set<string>();

  for (const row of inspeccionesRows ?? []) {
    const unit = (row[4] ?? '').trim().toUpperCase();
    if (unit && sheetDateKey(row[2] ?? '') === today) reportedUnitsToday.add(unit);
  }

  // Find active units not in today's reports
  const missingChecklists: MissingChecklist[] = [];
  for (const eq of equipmentList) {
    if (eq.status === 'inactivo') continue;
    if (!reportedUnitsToday.has(eq.unit_id.toUpperCase())) {
      missingChecklists.push({
        unit: eq.unit_id,
        operator: eq.assigned_operator || 'Sin asignar',
      });
    }
  }

  const dvirExpectedCount = equipmentList.filter((e) => e.status !== 'inactivo').length;
  const dvirCompliantCount = dvirExpectedCount - missingChecklists.length;

  // --- Critical parts ---
  const criticalParts: CriticalPart[] = parseInventoryRows(inventarioRows ?? [])
    .filter((item) => item.stock <= item.minimum)
    .map((item) => ({
      partNumber: item.partNumber,
      description: item.description,
      stock: Math.round(item.stock),
      minimo: Math.round(item.minimum),
    }));

  return {
    fuelAnomalies,
    fuelTotalDiesel: combustibleRows === null ? null : Math.round(fuelTotalDiesel),
    dvirCompliantCount,
    dvirExpectedCount: inspeccionesRows === null || !fleetAvailable ? null : dvirExpectedCount,
    missingChecklists,
    criticalParts,
  };
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonLine({ w = 'w-full' }: { w?: string }) {
  return <div className={`h-3.5 rounded bg-border animate-pulse ${w}`} />;
}

function BriefingSkeleton() {
  return (
    <div className="p-4 space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="space-y-1.5">
          <SkeletonLine w="w-1/3" />
          <SkeletonLine w="w-3/4" />
          <SkeletonLine w="w-1/2" />
        </div>
      ))}
    </div>
  );
}

// ── Section component ─────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-semibold text-text text-sm">{label}</p>
      <div className="mt-1 space-y-0.5">{children}</div>
    </div>
  );
}

function Line({
  color,
  children,
}: {
  color: 'red' | 'amber' | 'green' | 'default';
  children: React.ReactNode;
}) {
  const colorClass =
    color === 'red'
      ? 'text-red-600'
      : color === 'amber'
      ? 'text-amber-500'
      : color === 'green'
      ? 'text-green-600'
      : 'text-text-secondary';
  return <p className={`text-sm ${colorClass}`}>{children}</p>;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BriefingCard({ dispatch }: { dispatch?: FleetDispatch }) {
  const equipmentList = useEquipmentList();
  const fallback = useFleetDispatch(equipmentList, !dispatch);
  const fleet = dispatch ?? fallback;
  const equipmentError = useEquipmentStore((state) => state.error);
  const equipmentFetched = useEquipmentStore((state) => state.fetched);
  const snapshot = dispatchAvailability(equipmentList, fleet.readiness, fleet.verified && !fleet.loading && !equipmentError);

  const [rows, setRows] = useState<[string[][] | null, string[][] | null, string[][] | null] | null>(null);
  const [pm, setPm] = useState<ReturnType<typeof briefingPmAlerts> & { sourceDate?: string }>({ verified: false, alerts: [] });
  const rosterVerified = equipmentFetched && !equipmentError && equipmentList.every(unit => unit.status !== 'no_verificado');
  const data = rows ? buildBriefingFromSheets(equipmentList, ...rows, rosterVerified) : null;
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [now, setNow] = useState(() => new Date());

  const abortRef = useRef<AbortController | null>(null);

  async function fetchAll() {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const signal = AbortSignal.any([ctrl.signal, AbortSignal.timeout(8000)]);
    const [maintenance, fuel, inspections, inventory] = await Promise.allSettled([
      fetchPanamaMaintenance(ctrl.signal, signal),
      readRange(SHEET_TABS.COMBUSTIBLE, signal, undefined, 0),
      readRange(SHEET_TABS.INSPECCIONES, signal, undefined, 0),
      readRange(SHEET_TABS.INVENTARIO, signal, undefined, 0),
    ]);
    if (ctrl.signal.aborted) return;
    const values = (result: PromiseSettledResult<string[][]>) => result.status === 'fulfilled' ? result.value : null;
    setRows([values(fuel), values(inspections), values(inventory)]);
    setPm(maintenance.status === 'fulfilled'
      ? { ...briefingPmAlerts(maintenance.value), sourceDate: maintenance.value.sourceDate }
      : { verified: false, alerts: [] });
    setFetchedAt(new Date());
    setLoading(false);
  }

  function refresh() {
    setLoading(true);
    void fetchAll();
    void fleet.refresh();
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void fetchAll(); }, 0);
    // Tick clock every minute
    const clockInterval = setInterval(() => setNow(new Date()), 60_000);
    return () => {
      window.clearTimeout(initialLoad);
      abortRef.current?.abort();
      clearInterval(clockInterval);
    };
  }, []);

  const todayLabel = formatTodayLabel(now);
  const timeLabel = formatTime(now);
  const updatedLabel = fetchedAt ? formatMinutesAgo(msAgo(fetchedAt)) : null;

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
      {/* Header */}
      <div className="p-4" style={{ backgroundColor: '#162252' }}>
        <p className="font-bold text-white text-sm tracking-wide">BRIEFING FLOTA GTP</p>
        <p className="text-white text-xs mt-0.5 opacity-80">
          {todayLabel} · {timeLabel}
        </p>
      </div>

      {/* Body */}
      {loading && !data ? (
        <BriefingSkeleton />
      ) : data ? (
        <div className="p-4 space-y-4">
          <Section label={snapshot.pct === null ? 'DESPACHO SIN VERIFICAR' : `APTOS PARA DESPACHO: ${snapshot.pct}% (${snapshot.available}/${snapshot.total} equipos)`}>
            {snapshot.pct === null && <Line color="amber">{fleet.message || 'Verificando la flota y las restricciones.'}</Line>}
            {snapshot.exceptions.map((unit) => (
              <Line key={unit} color="amber">
                <Link to={`/fleet?unit=${encodeURIComponent(unit)}`} className="font-semibold underline">{unit}</Link>
                {' · '}{fleet.readiness.get(normalizeUnitId(unit))?.reason ?? 'Estado de flota no disponible para despacho'}
              </Line>
            ))}
            {snapshot.pct !== null && snapshot.exceptions.length === 0 && (
              <Line color="green">Todos los equipos del alcance están aptos para despacho.</Line>
            )}
          </Section>

          <Section label="ALERTAS PM">
            {pm.sourceDate && <Line color="default">Corte de PM FLOTA del {new Date(pm.sourceDate).toLocaleString('es-PA', { timeZone: 'America/Panama', dateStyle: 'short', timeStyle: 'short' })} · hora de Panamá</Line>}
            {!pm.verified && <Line color="amber">Verificación de PM pendiente.</Line>}
            {pm.alerts.length === 0 && pm.verified && <Line color="green">Sin alertas en el maestro.</Line>}
            {pm.alerts.slice(0, 5).map((entry) => (
              <Line key={entry.unit + entry.level} color={entry.state === 'overdue' ? 'red' : 'amber'}>
                <Link to="/pm" className="font-semibold underline">{entry.unit}</Link>
                {' · '}{entry.level || 'PM'} {entry.state === 'overdue' ? 'vencido' : 'próximo'}
                {entry.remaining !== null && ` · ${Math.abs(entry.remaining)} h ${entry.state === 'overdue' ? 'sobre límite' : 'restantes'}`}
              </Line>
            ))}
            {pm.alerts.length > 5 && <Line color="default">+{pm.alerts.length - 5} alertas más</Line>}
          </Section>

          {/* Combustible */}
          <Section label={data.fuelTotalDiesel === null ? 'COMBUSTIBLE (7 DÍAS)' : `COMBUSTIBLE (7 DÍAS) · ${data.fuelTotalDiesel.toLocaleString()} L diésel total`}>
            {data.fuelTotalDiesel === null ? <Line color="amber">Fuente de combustible no disponible.</Line> : data.fuelAnomalies.length === 0 ? (
              <Line color="green">Sin anomalías detectadas</Line>
            ) : (
              data.fuelAnomalies.slice(0, 4).map((f) => (
                <Line key={f.unit} color="amber">
                  ⚠ {f.unit}: {f.totalLiters.toLocaleString()} L (+{f.pctAbove}% sobre promedio de {f.avgLiters} L)
                </Line>
              ))
            )}
          </Section>

          {/* DVIR Compliance */}
          <Section
            label={data.dvirExpectedCount ? `INSPECCIONES DVIR · ${Math.round((data.dvirCompliantCount / data.dvirExpectedCount) * 100)}% (${data.dvirCompliantCount}/${data.dvirExpectedCount} unidades hoy)` : 'INSPECCIONES DVIR'}
          >
            {data.dvirExpectedCount === null ? <Line color="amber">Cobertura DVIR sin verificar.</Line> : data.dvirExpectedCount === 0 ? (
              <Line color="default">Sin equipos activos en el alcance.</Line>
            ) : data.missingChecklists.length === 0 ? (
              <Line color="green">Todos los checklists reportados</Line>
            ) : (
              data.missingChecklists.slice(0, 5).map((m) => (
                <Line key={m.unit} color="amber">
                  ⚠ {m.unit} — {m.operator}
                </Line>
              ))
            )}
            {data.dvirExpectedCount !== null && data.missingChecklists.length > 5 && (
              <Line color="default">+{data.missingChecklists.length - 5} unidades más sin reporte</Line>
            )}
          </Section>

          {/* Partes Críticas */}
          <Section label="PARTES CRÍTICAS">
            {rows?.[2] === null ? <Line color="amber">Inventario de repuestos no disponible.</Line> : data.criticalParts.length === 0 ? (
              <Line color="green">Sin partes críticas</Line>
            ) : (
              data.criticalParts.slice(0, 5).map((p) => (
                <Line key={p.partNumber} color={p.stock === 0 ? 'red' : 'amber'}>
                  {p.stock === 0 ? '🔴' : '🟡'} {p.partNumber} — {p.description} (stock: {p.stock}, mín: {p.minimo})
                </Line>
              ))
            )}
            {data.criticalParts.length > 5 && (
              <Line color="default">+{data.criticalParts.length - 5} partes más</Line>
            )}
          </Section>
        </div>
      ) : null}

      {/* Footer */}
      {fetchedAt && (
        <div className="px-4 pb-3 flex items-center justify-between">
          <p className="text-xs text-text-secondary">
            {updatedLabel ? `Consultado ${updatedLabel}` : ''}
          </p>
          <button
            onClick={refresh}
            disabled={loading}
            className="text-xs text-text-secondary hover:text-text underline disabled:opacity-40"
          >
            {loading ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      )}
    </div>
  );
}
