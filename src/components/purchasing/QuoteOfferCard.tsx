import type { PurchaseVendor } from '../../lib/purchasing-api';
import { quoteVendorKey, quoteVendorLabel, type ComparedOfferInput, type compareQuotes } from '../../lib/panama-quote-comparison';

export const quoteInput = 'mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700';
export const quoteLabel = 'block min-w-0 text-sm font-medium text-slate-800';
export const quoteButton = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-sm font-semibold text-[#162252] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-50';
export const quotePrimary = 'inline-flex min-h-11 items-center justify-center rounded-lg bg-[#162252] px-4 py-2 text-center text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700';

interface Props {
  number: number;
  offer: ComparedOfferInput;
  result: ReturnType<typeof compareQuotes>['offers'][number];
  vendors: PurchaseVendor[];
  cheapestLanded: boolean;
  cheapestWithDowntime: boolean;
  selected: boolean;
  onChange: (patch: Partial<ComparedOfferInput>) => void;
  onSelect: () => void;
  onRemove?: () => void;
}

function amount(value: bigint | null, currency: string) {
  if (value === null) return 'Pendiente';
  const format = new Intl.NumberFormat('es-MX', {
    style: 'currency', currency, currencyDisplay: 'code', minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  const cents = (value % 100n).toString().padStart(2, '0');
  return format.formatToParts(value / 100n).map(part => part.type === 'fraction' ? cents : part.value).join('');
}

function days(value: number | null) {
  return value === null ? 'Pendiente' : `${value} ${value === 1 ? 'día' : 'días'}`;
}

export default function QuoteOfferCard(props: Props) {
  const { number, offer, result, vendors, cheapestLanded, cheapestWithDowntime, selected, onChange, onSelect, onRemove } = props;
  return (
    <fieldset className="min-w-0 rounded-xl border border-slate-300 bg-white p-3 sm:p-4">
      <legend className="px-2 text-base font-bold text-[#162252]">Cotización {number}</legend>
      <div className="grid min-w-0 grid-cols-2 gap-3">
        <label className={quoteLabel + ' col-span-2'}>
          Proveedor
          <select className={quoteInput} value={offer.vendor} onChange={event => onChange({ vendor: event.target.value })}>
            <option value="">Seleccionar</option>
            {vendors.map(vendor => <option key={quoteVendorKey(vendor)} value={quoteVendorKey(vendor)}>
              {quoteVendorLabel(vendor, vendors)}
            </option>)}
          </select>
        </label>
        <label className={quoteLabel + ' col-span-2'}>
          Referencia
          <input className={quoteInput} maxLength={100} value={offer.reference} onChange={event => onChange({ reference: event.target.value })} />
        </label>
        <label className={quoteLabel}>
          Moneda
          <select className={quoteInput} value={offer.currency} onChange={event => onChange({ currency: event.target.value as ComparedOfferInput['currency'] })}>
            <option>USD</option><option>PAB</option>
          </select>
        </label>
        <label className={quoteLabel}>
          Cantidad ofrecida
          <input className={quoteInput} type="number" inputMode="decimal" min="0.001" step="0.001" value={offer.quantity}
            onChange={event => onChange({ quantity: event.target.value })} />
        </label>
        <label className={quoteLabel}>
          Precio unitario
          <input className={quoteInput} type="number" inputMode="decimal" min="0.01" step="0.01" value={offer.unitPrice}
            onChange={event => onChange({ unitPrice: event.target.value })} />
        </label>
        <label className={quoteLabel}>
          Flete total
          <input className={quoteInput} type="number" inputMode="decimal" min="0" step="0.01" placeholder="0 si está incluido"
            value={offer.freight} onChange={event => onChange({ freight: event.target.value })} />
        </label>
        <label className={quoteLabel + ' col-span-2 sm:col-span-1'}>
          Entrega prometida
          <input className={quoteInput} type="date" value={offer.promisedDate} onChange={event => onChange({ promisedDate: event.target.value })} />
        </label>
        <label className={quoteLabel + ' col-span-2'}>
          Compatibilidad
          <select className={quoteInput} value={offer.compatibility}
            onChange={event => onChange({ compatibility: event.target.value as ComparedOfferInput['compatibility'] })}>
            <option value="pending">Por confirmar</option>
            <option value="confirmed">Confirmada</option>
            <option value="incompatible">Incompatible</option>
          </select>
        </label>
        {offer.compatibility === 'confirmed' && (
          <label className={quoteLabel + ' col-span-2'}>
            Respaldo de compatibilidad
            <input className={quoteInput} maxLength={200} value={offer.compatibilityEvidence} placeholder="Parte, modelo o serie"
              onChange={event => onChange({ compatibilityEvidence: event.target.value })} />
          </label>
        )}
        <details className="col-span-2 text-sm text-slate-700">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold">Garantía y otros cargos</summary>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <label className={quoteLabel}>
              Garantía
              <input className={quoteInput} maxLength={140} value={offer.warranty}
                onChange={event => onChange({ warranty: event.target.value })} />
            </label>
            <label className={quoteLabel}>
              Otros cargos sin ITBMS
              <input className={quoteInput} type="number" inputMode="decimal" min="0" step="0.01"
                value={offer.other} onChange={event => onChange({ other: event.target.value })} />
            </label>
          </div>
        </details>
      </div>
      {(result.landedCents !== null || result.leadDays !== null) && <dl className="mt-4 grid min-w-0 grid-cols-2 gap-2 rounded-lg bg-slate-100 p-3 text-sm">
        <div><dt>Costo puesto en obra</dt><dd className="break-words font-bold">{amount(result.landedCents, offer.currency)}</dd></div>
        <div><dt>Entrega en</dt><dd>{days(result.leadDays)}</dd></div>
        <div><dt>Atraso previsto</dt><dd>{days(result.delayDays)}</dd></div>
        <div><dt>Costo del paro</dt><dd className="break-words">{amount(result.downtimeCents, offer.currency)}</dd></div>
        {result.totalWithDowntimeCents !== null && (
          <div className="col-span-2"><dt>Costo con paro</dt><dd className="break-words font-bold">{amount(result.totalWithDowntimeCents, offer.currency)}</dd></div>
        )}
      </dl>}
      {cheapestLanded && <p className="mt-2 text-sm font-semibold text-emerald-800">Menor costo puesto en obra</p>}
      {cheapestWithDowntime && <p className="mt-2 text-sm font-semibold text-emerald-800">Menor costo con paro</p>}
      {(offer.vendor || offer.reference || offer.unitPrice) && result.issues.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-900">
          {result.issues.map(issue => <li key={issue}>{issue}</li>)}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={quoteButton} disabled={!result.eligible} onClick={onSelect} aria-pressed={selected}>
          {selected ? 'Cotización elegida' : 'Elegir cotización'}
        </button>
        {onRemove && <button type="button" className={quoteButton} onClick={onRemove}>Quitar cotización</button>}
      </div>
    </fieldset>
  );
}
