import { ChevronDown } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  compareInterventions, interventionCurrencies, interventionKinds, interventionLabels,
  type DowntimeImpactDraft, type InterventionComparison, type InterventionDraft, type InterventionKind,
} from '../../lib/panama-repair-economics';
import { displayMoney } from '../../lib/purchasing-api';

const fieldsetClass = 'min-w-0 space-y-2 rounded-lg border border-border p-3';
const fieldClass = 'min-w-0 text-sm font-medium';
const inputClass = 'mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-border bg-white px-2 text-sm text-text';
const hours = new Intl.NumberFormat('es-PA', { maximumFractionDigits: 2 });
const asMoney = (cents: number, currency: string) => displayMoney(cents / 100, currency);

type DocumentedCost = Pick<InterventionDraft, 'cash' | 'cashSource' | 'currency'>;

const blank: InterventionDraft = {
  currency: '', cash: '', cashSource: '', life: '', lifeSource: '', downtime: '', downtimeSource: '', productiveHoursLost: '',
};

const fields = [
  { name: 'cash', title: 'Desembolso estimado', decimal: true },
  { name: 'cashSource', title: 'Fuente del desembolso', placeholder: 'Cotización, orden o factura' },
  { name: 'life', title: 'Vida útil (horas de operación)', decimal: true },
  { name: 'lifeSource', title: 'Fuente de vida útil', placeholder: 'Informe técnico o historial' },
  { name: 'downtime', title: 'Parada estimada (horas)', decimal: true },
  { name: 'downtimeSource', title: 'Fuente de la parada', placeholder: 'Programa del taller o proveedor' },
  { name: 'productiveHoursLost', title: 'Horas productivas que se perderían', decimal: true },
] as const;

function CurrencyField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className={fieldClass}>
    Moneda
    <select value={value} onChange={e => onChange(e.target.value)} className={inputClass} required>
      <option value="">Seleccionar</option>
      {interventionCurrencies.map(currency => <option key={currency} value={currency}>{currency}</option>)}
    </select>
  </label>;
}

function ComparisonResult({ data }: { data: InterventionComparison }) {
  const { rows, currency, impact, lowest } = data;
  return <section aria-label="Resultado de la comparación" aria-live="polite" className="space-y-3">
    <div className="rounded-lg bg-slate-100 p-3 text-sm">
      <h3 className="font-semibold">Menor desembolso por hora</h3>
      <p>{lowest.map(kind => interventionLabels[kind]).join(' / ')}</p>
      <p className="mt-1 text-text-secondary">Desembolso ÷ horas de operación de la vida estimada. La comparación usa valores sin redondear.</p>
      {impact && <p className="mt-1 break-words">
        Contribución estimada de {asMoney(impact.rateCents, currency)} por hora productiva · {impact.source}
      </p>}
    </div>
    {rows.map(row => <article key={row.kind} aria-label={interventionLabels[row.kind]} className="min-w-0 rounded-lg border border-border p-3">
      <h4 className="font-semibold">{interventionLabels[row.kind]}</h4>
      <dl className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-sm">
        <dt>Desembolso estimado</dt><dd className="text-right tabular-nums">{asMoney(row.cashCents, currency)}</dd>
        <dt>Vida útil estimada</dt><dd className="text-right tabular-nums">{hours.format(row.life)} h de operación</dd>
        <dt className="font-semibold">Desembolso por hora de operación</dt>
        <dd className="text-right font-semibold tabular-nums">{asMoney(row.costPerHourCents, currency)}/h</dd>
        <dt>Parada estimada</dt><dd className="text-right tabular-nums">{hours.format(row.downtime)} h</dd>
        {row.impactCents !== null && row.productiveHoursLost !== null && <>
          <dt>Horas productivas perdidas</dt><dd className="text-right tabular-nums">{hours.format(row.productiveHoursLost)} h</dd>
          <dt>Contribución dejada de generar</dt><dd className="text-right tabular-nums">{asMoney(row.impactCents, currency)}</dd>
        </>}
      </dl>
      <dl className="mt-3 grid gap-2 border-t border-border pt-2 text-xs text-text-secondary">
        <div><dt className="font-semibold">Fuente del desembolso</dt><dd className="break-words">{row.cashSource}</dd></div>
        <div><dt className="font-semibold">Fuente de vida útil</dt><dd className="break-words">{row.lifeSource}</dd></div>
        <div><dt className="font-semibold">Fuente de la parada</dt><dd className="break-words">{row.downtimeSource}</dd></div>
      </dl>
    </article>)}
  </section>;
}

export default function PanamaInterventionComparison({ documentedCost }: { documentedCost: DocumentedCost | null }) {
  const [drafts, setDrafts] = useState<Record<InterventionKind, InterventionDraft>>({ repair: blank, rebuild: blank, replace: blank });
  const [includeImpact, setIncludeImpact] = useState(false);
  const [impact, setImpact] = useState<DowntimeImpactDraft>({ rate: '', currency: '', source: '' });
  const [result, setResult] = useState<InterventionComparison | { error: string }>();

  function editScenario(kind: InterventionKind, changes: Partial<InterventionDraft>) {
    setDrafts(current => ({ ...current, [kind]: { ...current[kind], ...changes } }));
    setResult(undefined);
  }

  function editImpact(changes: Partial<DowntimeImpactDraft>) {
    setImpact(current => ({ ...current, ...changes }));
    setResult(undefined);
  }

  function compare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(compareInterventions(drafts, includeImpact ? impact : undefined));
  }

  return <details className="group min-w-0 rounded-lg border border-border p-3">
    <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 text-sm font-semibold">
      Reparar, reconstruir o reemplazar
      <ChevronDown aria-hidden="true" size={16} className="shrink-0 group-open:rotate-180" />
    </summary>
    <form onSubmit={compare} noValidate className="space-y-3">
      <p className="text-sm text-text-secondary">
        Estima el desembolso incremental durante la vida útil de cada opción. Usa una sola moneda y documenta de dónde sale cada cifra.
      </p>
      <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={includeImpact} onChange={event => {
          setIncludeImpact(event.target.checked);
          setResult(undefined);
        }} />
        Estimar el efecto económico de parar
      </label>
      {includeImpact && <fieldset className={fieldsetClass}>
        <legend className="px-1 text-sm font-semibold">Contribución del equipo</legend>
        <CurrencyField value={impact.currency} onChange={currency => editImpact({ currency })} />
        <label className={fieldClass}>
          Contribución neta por hora productiva
          <input className={inputClass} inputMode="decimal" value={impact.rate}
            onChange={e => editImpact({ rate: e.target.value })} required />
        </label>
        <label className={fieldClass}>
          Fuente de la contribución
          <input className={inputClass} maxLength={500} value={impact.source}
            onChange={e => editImpact({ source: e.target.value })} required />
        </label>
      </fieldset>}
      {interventionKinds.map(kind => <fieldset key={kind} className={fieldsetClass}>
        <legend className="px-1 text-sm font-semibold">{interventionLabels[kind]}</legend>
        {kind === 'repair' && documentedCost && <button type="button" className="min-h-11 text-left text-sm font-semibold underline"
          onClick={() => editScenario(kind, documentedCost)}>Usar total documentado de esta OT</button>}
        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
          <CurrencyField value={drafts[kind].currency} onChange={currency => editScenario(kind, { currency })} />
          {fields.filter(field => field.name !== 'productiveHoursLost' || includeImpact).map(field => <label key={field.name} className={fieldClass}>
            {field.title}
            <input className={inputClass} value={drafts[kind][field.name]} required
              inputMode={'decimal' in field ? 'decimal' : 'text'}
              maxLength={'decimal' in field ? 12 : 500}
              placeholder={'placeholder' in field ? field.placeholder : undefined}
              onChange={e => editScenario(kind, { [field.name]: e.target.value })} />
          </label>)}
        </div>
      </fieldset>)}
      <button type="submit" className="min-h-11 w-full rounded-lg bg-[#162252] px-3 text-sm font-semibold text-white sm:w-auto">
        Comparar alternativas
      </button>
      {result && ('error' in result
        ? <p role="alert" className="text-sm text-red-700">{result.error}</p>
        : <ComparisonResult data={result} />)}
    </form>
  </details>;
}
