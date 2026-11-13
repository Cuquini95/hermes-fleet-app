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
  fuelTotalDiesel: number;
  dvirCompliantCount: number;
  dvirExpectedCount: number;
  missingChecklists: MissingChecklist[];
  criticalParts: CriticalPart[];
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function parseSheetDate(raw: string): Date | null {
  // Accepts dd/MM/yyyy
  const parts = raw.trim().split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y) return null;
  const dt = new Date(y, m - 1, d);
  if (isNaN(dt.getTime())) return null;
  return dt;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatTodayLabel(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m} hrs`;
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
  combustibleRows: string[][],
  inspeccionesRows: string[][],
  inventarioRows: string[][]
): BriefingData {
  // --- Fuel: last 7 days diesel ---
  const now = new Date();
  const sevenDaysAgo = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
  const dieselByUnit = new Map<string, number>();
  let fuelTotalDiesel = 0;

  for (const row of combustibleRows) {
    const dateStr = (row[0] ?? '').trim();
    const tipo = (row[5] ?? '').trim().toLowerCase();
    const unit = (row[2] ?? '').trim().toUpperCase();
    const liters = parseFloat((row[6] ?? '').replace(',', '.'));
    if (tipo !== 'diesel') continue;
    if (!unit || isNaN(liters)) continue;
    const date = parseSheetDate(dateStr);
    if (!date) continue;
    if (date < sevenDaysAgo) continue;
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
  const todayStart = startOfDay(now);
  const allUnitsToday = new Set<string>();
  const reportedUnitsToday = new Set<string>();
  const missingByUnit = new Map<string, string>();

  for (const row of inspeccionesRows) {
    const dateStr = (row[2] ?? '').trim();
    const unit = (row[4] ?? '').trim().toUpperCase();
    if (!unit) continue;
    const date = parseSheetDate(dateStr);
    if (!date) continue;
    if (startOfDay(date).getTime() !== todayStart.getTime()) continue;
    allUnitsToday.add(unit);
    reportedUnitsToday.add(unit);
    missingByUnit.delete(unit); // remove if found
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
  const criticalParts: CriticalPart[] = parseInventoryRows(inventarioRows)
    .filter((item) => item.stock <= item.minimum)
    .map((item) => ({
      partNumber: item.partNumber,
      description: item.description,
      stock: Math.round(item.stock),
      minimo: Math.round(item.minimum),
    }));

  return {
    fuelAnomalies,
    fuelTotalDiesel: Math.round(fuelTotalDiesel),
    dvirCompliantCount,
    dvirExpectedCount,
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
  const snapshot = dispatchAvailability(equipmentList, fleet.readiness, fleet.verified && !fleet.loading && !equipmentError);

  const [rows, setRows] = useState<[string[][], string[][], string[][]] | null>(null);
  const [pm, setPm] = useState<ReturnType<typeof briefingPmAlerts>>({ verified: false, alerts: [] });
  const data = rows ? buildBriefingFromSheets(equipmentList, ...rows) : null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [now, setNow] = useState(() => new Date());

  const abortRef = useRef<AbortController | null>(null);

  async function fetchAll() {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);


    try {
      const [maintenance, combustibleRows, inspeccionesRows, inventarioRows] =
        await Promise.all([
          fetchPanamaMaintenance(ctrl.signal),
          readRange(SHEET_TABS.COMBUSTIBLE, ctrl.signal),
          readRange(SHEET_TABS.INSPECCIONES, ctrl.signal),
          readRange(SHEET_TABS.INVENTARIO, ctrl.signal),
        ]);

      if (ctrl.signal.aborted) return;

      setRows([combustibleRows, inspeccionesRows, inventarioRows]);
      setPm(briefingPmAlerts(maintenance));
      setFetchedAt(new Date());
    } catch (err: unknown) {
      if (ctrl.signal.aborted) return;
      setRows(null);
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
    // Tick clock every minute
    const clockInterval = setInterval(() => setNow(new Date()), 60_000);
    return () => {
      abortRef.current?.abort();
      clearInterval(clockInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      ) : error ? (
        <div className="p-4">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => { void fetchAll(); void fleet.refresh(); }}
            className="mt-2 text-xs text-text-secondary underline hover:text-text"
          >
            Reintentar
          </button>
        </div>
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

          <Section label="ALERTAS PM:">
            {!pm.verified && <Line color="amber">Pendiente de verificar en PM FLOTA.</Line>}
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
          <Section label={`COMBUSTIBLE (semana): ${data.fuelTotalDiesel.toLocaleString()} L diesel total`}>
            {data.fuelAnomalies.length === 0 ? (
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
            label={`CHECKLIST COMPLIANCE: ${data.dvirExpectedCount > 0 ? Math.round((data.dvirCompliantCount / data.dvirExpectedCount) * 100) : 0}% (${data.dvirCompliantCount}/${data.dvirExpectedCount} unidades hoy)`}
          >
            {data.missingChecklists.length === 0 ? (
              <Line color="green">Todos los checklists reportados</Line>
            ) : (
              data.missingChecklists.slice(0, 5).map((m) => (
                <Line key={m.unit} color="amber">
                  ⚠ {m.unit} — {m.operator}
                </Line>
              ))
            )}
            {data.missingChecklists.length > 5 && (
              <Line color="default">+{data.missingChecklists.length - 5} unidades más sin reporte</Line>
            )}
          </Section>

          {/* Partes Críticas */}
          <Section label="PARTES CRÍTICAS:">
            {data.criticalParts.length === 0 ? (
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
      {(fetchedAt || error) && (
        <div className="px-4 pb-3 flex items-center justify-between">
          <p className="text-xs text-text-secondary">
            {updatedLabel ? `Actualizado ${updatedLabel}` : ''}
          </p>
          <button
            onClick={() => { void fetchAll(); void fleet.refresh(); }}
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
