import { useMemo, useState } from 'react';
import type { DashboardData } from '../../hooks/useDashboardData';
import { useEquipmentList } from '../../hooks/useEquipmentList';
import { analyzeFuelPeriod } from '../../lib/panama-fuel-analysis';
import { mexicoDateInput } from '../../lib/date-utils';

const display = new Intl.NumberFormat('es-PA', { maximumFractionDigits: 2 });
const localStamp = new Intl.DateTimeFormat('es-PA', { timeZone: 'America/Panama', dateStyle: 'short', timeStyle: 'short' });

export default function PanamaFuelReconciliation({ data }: { data: DashboardData['fuelReconciliation'] }) {
  const assets = useEquipmentList();
  const [days, setDays] = useState<1 | 7 | 15>(7);
  const [endDay, setEndDay] = useState(mexicoDateInput);
  const result = useMemo(() => data ? analyzeFuelPeriod(data, assets, endDay, days) : null, [data, assets, endDay, days]);
  return <section aria-label="Consumo de diésel por familia" className="min-w-0 rounded-xl border border-border bg-card p-4 text-sm">
    <h2 className="font-semibold">Diésel por familia</h2>
    <div className="mt-3 flex flex-wrap items-end gap-3">
      <fieldset className="min-w-0"><legend className="mb-1 text-xs text-text-secondary">Período</legend>
        <div className="flex flex-wrap gap-1">{([1, 7, 15] as const).map(value => <button key={value} type="button"
          aria-pressed={days === value} onClick={() => setDays(value)}
          className={`min-h-11 rounded-lg border px-3 font-medium ${days === value ? 'border-amber bg-amber text-white' : 'border-border bg-white'}`}>
          {value === 1 ? 'Día' : `${value} días`}
        </button>)}</div>
      </fieldset>
      <label className="min-w-0 flex-1"><span className="block text-xs text-text-secondary">Fecha final · Panamá</span>
        <input type="date" value={endDay} onChange={event => setEndDay(event.target.value)} className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-border bg-white px-2" />
      </label>
    </div>
    <p className="mt-3 text-xs text-text-secondary">Litros / horas de intervalos completos dentro del período. Los bordes no se prorratean. Se comparan equipos de la misma familia; revisa también modelo y condiciones de trabajo.</p>
    {!data && <p role="status" className="mt-3 text-amber-800">Combustible sin verificar.</p>}
    {data && !result && <p role="alert" className="mt-3 text-amber-800">Selecciona una fecha válida.</p>}
    {result && result.families.length === 0 && <p className="mt-3 text-text-secondary">Sin equipos en el alcance.</p>}
    {result?.families.map(group => <section key={group.family} className="mt-4 rounded-lg border border-border p-3">
      <h3 className="font-semibold">{group.family}</h3>
      <p className="mt-1 font-semibold">{group.litersPerHour === null ? 'Sin L/h verificados' : `${display.format(group.litersPerHour)} L/h`}</p>
      <p className="text-xs text-text-secondary">{group.verified > 0 ? `${display.format(group.liters)} L / ${display.format(group.hours)} h · ` : ''}{group.verified} de {group.total} equipos con datos conciliados</p>
      <ul className="mt-2 divide-y divide-border">{group.units.map(row => <li key={row.unit} className="min-w-0 py-2">
        <p className="flex flex-wrap justify-between gap-1 font-medium"><span>{row.unit}</span><span>{row.litersPerHour === null ? 'Por conciliar' : `${display.format(row.litersPerHour)} L/h`}</span></p>
        <p className="break-words text-xs text-text-secondary">{row.model}</p>
        {row.issues.map(issue => <p key={issue} className="mt-1 text-xs text-amber-800">{issue}</p>)}
        {row.intervals.length > 0 && <details className="mt-1 text-xs text-text-secondary">
          <summary className="flex min-h-11 cursor-pointer items-center">Ver {row.intervals.length} intervalos · {display.format(row.liters)} L / {display.format(row.hours)} h</summary>
          <ul className="space-y-2">{row.intervals.map(interval => <li key={`${interval.from}/${interval.to}`} className="break-words">
            {localStamp.format(interval.from)} → {localStamp.format(interval.to)} · {display.format(interval.fromMeter)} → {display.format(interval.toMeter)} h · {display.format(interval.liters)} L / {display.format(interval.hours)} h{interval.dispatchId && ` · despacho ${interval.dispatchId}`}
          </li>)}</ul>
        </details>}
      </li>)}</ul>
    </section>)}
  </section>;
}
