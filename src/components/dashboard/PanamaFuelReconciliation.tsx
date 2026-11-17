import type { DashboardData } from '../../hooks/useDashboardData';

const display = new Intl.NumberFormat('es-PA', { maximumFractionDigits: 2 });
const localStamp = new Intl.DateTimeFormat('es-PA', { timeZone: 'America/Panama', dateStyle: 'short', timeStyle: 'short' });

export default function PanamaFuelReconciliation({ data }: { data: DashboardData['fuelReconciliation'] }) {
  return (
    <details className="rounded-xl border border-border bg-card p-4 text-sm">
      <summary className="cursor-pointer font-semibold">Conciliación de diésel · {data?.litersPerHour == null
        ? 'Sin L/h verificados' : `${display.format(data.litersPerHour)} L/h`}</summary>
      <p className="mt-2 text-text-secondary">
        Litros del despacho final de cada intervalo entre dos lecturas de la misma unidad, divididos entre el avance del horómetro.
      </p>
      {!data && <p className="mt-2 text-amber-800">No se pudo verificar la fuente de combustible o el inventario.</p>}
      {data && <>
        <p className="mt-2 font-medium">{display.format(data.liters)} L en {display.format(data.hours)} h conciliadas · hora de Panamá</p>
        <ul className="mt-2 divide-y divide-border" aria-label="Diésel por unidad">
          {data.units.map(({ unit, intervals, issues }) => <li key={unit} className="py-2">
            <p className="font-semibold">{unit}</p>
            {issues.map(issue => <p key={issue} className="text-amber-800">{issue}</p>)}
            {intervals.length > 0 && <details className="mt-1">
              <summary>{intervals.length} {intervals.length === 1 ? 'intervalo conciliado' : 'intervalos conciliados'}</summary>
              <ul className="mt-1 space-y-1 text-text-secondary">
                {intervals.map(interval => <li key={interval.to} className="break-words">
                  {localStamp.format(interval.from)} → {localStamp.format(interval.to)} ·
                  {' '}{display.format(interval.fromMeter)} → {display.format(interval.toMeter)} h ·
                  {' '}{display.format(interval.liters)} L / {display.format(interval.hours)} h
                  {interval.dispatchId && ` · despacho ${interval.dispatchId}`}
                </li>)}
              </ul>
            </details>}
          </li>)}
        </ul>
      </>}
    </details>
  );
}
