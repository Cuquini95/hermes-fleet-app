import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import QuoteOfferCard, { quoteButton, quoteInput, quoteLabel, quotePrimary } from '../components/purchasing/QuoteOfferCard';
import { mexicoDateInput } from '../lib/date-utils';
import { compareQuotes, comparisonQuantity, quoteVendorKey, type ComparedOfferInput, type QuoteCurrency, type QuoteOrderPrefill } from '../lib/panama-quote-comparison';
import { canAwardRequest, purchaseRead, purchaseRequests, visibleWorkOrderFolio, type PurchaseOverview, type PurchaseRequestLine } from '../lib/purchasing-api';
import { useAuthStore } from '../stores/auth-store';

const section = 'min-w-0 rounded-xl border border-slate-200 bg-white p-4';
const currency = z.enum(['USD', 'PAB']);
const draftSchema = z.object({
  entityId: z.string(), neededDate: z.string(),
  downtime: z.object({ hoursPerDay: z.string(), hourlyCost: z.string(), source: z.string(), basis: z.enum(['estimate', 'documented']) }),
  offers: z.array(z.object({
    id: z.string(), vendor: z.string(), reference: z.string(), currency, quantity: z.string(), unitPrice: z.string(),
    freight: z.string(), other: z.string(), promisedDate: z.string(), compatibility: z.enum(['pending', 'confirmed', 'incompatible']),
    compatibilityEvidence: z.string(), warranty: z.string(),
  })).min(2).max(10),
  selected: z.string(),
  rationale: z.string(),
});
type Draft = z.infer<typeof draftSchema>;
type PurchaseSources = Pick<PurchaseOverview, 'issuers' | 'vendors'>;

function newOffer(id: string, currency: QuoteCurrency, quantity: string): ComparedOfferInput {
  return {
    id, vendor: '', reference: '', currency, quantity, unitPrice: '', freight: '', other: '',
    promisedDate: '', compatibility: 'pending', compatibilityEvidence: '', warranty: '',
  };
}

function readDraft(key: string, initial: Draft) {
  try {
    return draftSchema.safeParse(JSON.parse(localStorage.getItem(key) ?? 'null')).data ?? initial;
  } catch {
    return initial;
  }
}

export default function PanamaQuoteComparisonPage() {
  const userId = useAuthStore(state => state.userId);
  const allowed = useAuthStore(state => state.project === 'tmf-panama' && state.role === 'gerencia');
  if (!allowed) return <Navigate to="/pedidos" replace />;
  return <QuoteWorkspace key={userId} userId={userId} />;
}

function QuoteWorkspace({ userId }: { userId: string }) {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<{ sources: PurchaseSources; requests: PurchaseRequestLine[] }>();
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const selectedId = params.get('partida') ?? '';

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      purchaseRead<PurchaseSources>('orders', undefined, controller.signal),
      purchaseRequests(controller.signal),
    ]).then(([sources, { items }]) => {
      if (!controller.signal.aborted) setData({ sources, requests: items.filter(canAwardRequest) });
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'No se pudieron consultar los pedidos y proveedores.');
    });
    return () => controller.abort();
  }, [reload]);

  const selected = data?.requests.find(request => request.id === selectedId);
  const labelOf = (request: PurchaseRequestLine) => [request.descripcion, request.equipo, visibleWorkOrderFolio(request.ot ?? '')].filter(Boolean).join(' · ');
  const options = data?.requests.map(request => ({ request, label: labelOf(request) })) ?? [];
  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-3 pt-3 sm:pt-4">
      <header className="rounded-xl bg-[#162252] p-4 text-white">
        <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-slate-200 underline underline-offset-4" to="/pedidos">Volver a Pedidos</Link>
        <h1 className="text-xl font-bold sm:text-2xl">Comparar cotizaciones</h1>
      </header>
      {error && <div className={section + ' space-y-2'} role="alert">
        <p>{error}</p>
        <button type="button" className={quoteButton} onClick={() => { setError(''); setReload(value => value + 1); }}>Reintentar consulta</button>
      </div>}
      {!data && !error && <p role="status">Consultando pedidos y proveedores…</p>}
      {data && <>
        {data.requests.length > 0 ? (
          <label className={section + ' ' + quoteLabel}>
            Partida del pedido
            <select className={quoteInput} value={selected?.id ?? ''} onChange={event => setParams(event.target.value ? { partida: event.target.value } : {})}>
              <option value="">Seleccionar partida</option>
              {options.map(({ request, label }) => <option key={request.id} value={request.id}>
                {label}{options.some(other => other.request.id !== request.id && other.label === label) && ` · ${request.pedidoId}`}
              </option>)}
            </select>
          </label>
        ) : <p className={section}>No hay partidas con saldo por cotizar.</p>}
        {selectedId && !selected && <p className={section} role="status">Esa partida no está disponible. Selecciona un pedido vigente.</p>}
        {selected && <QuoteDraft key={selected.id} userId={userId} request={selected} sources={data.sources} />}
      </>}
    </div>
  );
}

function QuoteDraft({ userId, request, sources }: { userId: string; request: PurchaseRequestLine; sources: PurchaseSources }) {
  const issuers = sources.issuers.filter(issuer => currency.safeParse(issuer.currency).success);
  const firstIssuer = issuers[0];
  const quantity = comparisonQuantity(request);
  const key = 'hermes:panama:quote-comparison:v1:' + JSON.stringify([userId, request.id]);
  const [draft, setDraft] = useState(() => {
    const initialCurrency = currency.safeParse(firstIssuer?.currency).data ?? 'USD';
    return readDraft(key, {
      entityId: firstIssuer?.id ?? '', neededDate: '',
      downtime: { hoursPerDay: '', hourlyCost: '', source: '', basis: 'estimate' },
      offers: ['initial-1', 'initial-2'].map(id => newOffer(id, initialCurrency, quantity)),
      selected: '', rationale: '',
    });
  });
  const [storageError, setStorageError] = useState(false);
  const issuer = issuers.find(entity => entity.id === draft.entityId);
  const comparisonCurrency = currency.safeParse(issuer?.currency).data;
  const neededDate = request.requiredDate || draft.neededDate;
  const vendorByKey = new Map(sources.vendors.map(vendor => [quoteVendorKey(vendor), vendor]));
  const comparison = compareQuotes({
    quantity, currency: comparisonCurrency ?? 'USD', comparisonDate: mexicoDateInput(), neededDate,
    downtime: draft.downtime,
    offers: draft.offers.map(offer => vendorByKey.has(offer.vendor) ? offer : { ...offer, vendor: '' }),
  });
  const selected = draft.offers.find(offer => offer.id === draft.selected);
  const selectedResult = comparison.offers.find(result => result.id === draft.selected);
  const vendor = selected && vendorByKey.get(selected.vendor);
  const publicOt = visibleWorkOrderFolio(request.ot ?? '');
  const prefill: QuoteOrderPrefill | undefined = selected && selectedResult?.eligible && vendor && issuer && comparisonCurrency && draft.rationale.trim()
    ? {
      requestLineId: request.id, requestVersion: request.version, quantity, entityId: issuer.id, currency: comparisonCurrency,
      vendor: { name: vendor.name, rfc: vendor.rfc }, unitPrice: selected.unitPrice, shipping: selected.freight,
      other: selected.other || '0', deliveryDate: selected.promisedDate, quoteReference: selected.reference.trim(),
      rationale: draft.rationale.trim(),
    } : undefined;

  function update(patch: Partial<Draft>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }

  return (
    <>
      <section className={section + ' space-y-3'} aria-label="Datos de la partida">
        <div>
          <h2 className="break-words font-bold">{request.descripcion}</h2>
          <p className="break-words text-sm text-slate-700">{[request.equipo, request.partNum, `Cantidad ${quantity}`].filter(Boolean).join(' · ')}</p>
          <div className="flex flex-wrap items-center gap-x-3 text-sm text-slate-700">
            {request.ot && <Link className="inline-flex min-h-11 items-center font-semibold text-[#162252] underline"
              to={'/workorders/' + encodeURIComponent(request.ot)}>{publicOt ?? 'Ver OT'}</Link>}
            <details className="min-w-0">
              <summary className="cursor-pointer py-2 font-semibold">Datos del pedido</summary>
              <p className="break-words">{request.pedidoId}{request.equipmentSerial && ` · Serie ${request.equipmentSerial}`}</p>
            </details>
          </div>
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className={quoteLabel}>
            Entidad y moneda
            <select className={quoteInput} value={issuer?.id ?? ''} onChange={event => {
              const entityId = event.target.value;
              const nextCurrency = currency.safeParse(issuers.find(entity => entity.id === entityId)?.currency).data;
              update({
                entityId, selected: '', rationale: '',
                offers: draft.offers.map(offer => !offer.vendor && !offer.unitPrice && nextCurrency ? { ...offer, currency: nextCurrency } : offer),
              });
            }}>
              <option value="">Seleccionar entidad</option>
              {issuers.map(entity => <option value={entity.id} key={entity.id}>{entity.name} · {entity.currency}</option>)}
            </select>
          </label>
          <label className={quoteLabel}>
            Fecha requerida
            <input className={quoteInput} type="date" value={neededDate} readOnly={Boolean(request.requiredDate)} onChange={event => update({ neededDate: event.target.value })} />
          </label>
        </div>
        <p className="text-xs text-slate-700">Costos antes de ITBMS.</p>
      </section>
      {comparisonCurrency && <>
        <details className={section}>
          <summary className="cursor-pointer font-bold">Costo del paro</summary>
          <div className="mt-3 grid min-w-0 grid-cols-2 gap-3">
            <label className={quoteLabel}>
              Horas de paro por día de atraso
              <input className={quoteInput} type="number" inputMode="decimal" min="0.01" max="24" step="0.01"
                value={draft.downtime.hoursPerDay} onChange={event => update({ downtime: { ...draft.downtime, hoursPerDay: event.target.value } })} />
            </label>
            <label className={quoteLabel}>
              Costo por hora ({comparisonCurrency})
              <input className={quoteInput} type="number" inputMode="decimal" min="0.01" step="0.01"
                value={draft.downtime.hourlyCost} onChange={event => update({ downtime: { ...draft.downtime, hourlyCost: event.target.value } })} />
            </label>
            <label className={quoteLabel + ' col-span-2 sm:col-span-1'}>
              Base del costo por hora
              <select className={quoteInput} value={draft.downtime.basis} onChange={event => update({
                downtime: { ...draft.downtime, basis: event.target.value === 'documented' ? 'documented' : 'estimate' },
              })}>
                <option value="estimate">Supuesto</option>
                <option value="documented">Costo documentado</option>
              </select>
            </label>
            <label className={quoteLabel + ' col-span-2 sm:col-span-1'}>
              Referencia del costo por hora
              <input className={quoteInput} maxLength={200} value={draft.downtime.source}
                onChange={event => update({ downtime: { ...draft.downtime, source: event.target.value } })} />
            </label>
          </div>
          {comparison.includesDowntime && <p className="mt-3 text-xs text-slate-700">
            {draft.downtime.basis === 'documented' ? 'Costo documentado' : 'Costo supuesto'} por día de atraso.
          </p>}
        </details>
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          {draft.offers.map((offer, index) => {
            const result = comparison.offers[index]!;
            return <QuoteOfferCard key={offer.id} number={index + 1} offer={offer} result={result} vendors={sources.vendors}
              cheapestLanded={comparison.cheapestLanded.includes(offer.id)} cheapestWithDowntime={comparison.cheapestWithDowntime.includes(offer.id)}
              selected={draft.selected === offer.id}
              onChange={patch => update({
                offers: draft.offers.map(item => item.id === offer.id ? { ...item, ...patch } : item),
                ...(draft.selected === offer.id ? { selected: '', rationale: '' } : {}),
              })}
              onSelect={() => update({ selected: offer.id, rationale: offer.id === draft.selected ? draft.rationale : '' })}
              onRemove={draft.offers.length > 2 ? () => update({
                offers: draft.offers.filter(item => item.id !== offer.id),
                ...(draft.selected === offer.id ? { selected: '', rationale: '' } : {}),
              }) : undefined}
            />;
          })}
        </div>
        <button type="button" className={quoteButton} disabled={draft.offers.length >= 10}
          onClick={() => update({ offers: [...draft.offers, newOffer(crypto.randomUUID(), comparisonCurrency, quantity)] })}>Agregar cotización</button>
      </>}
      {selected && selectedResult?.eligible && vendor && (
        <section className={section + ' space-y-3'} aria-label="Cotización elegida">
          <h2 className="break-words font-bold">{vendor.name} · {selected.reference}</h2>
          <label className={quoteLabel}>
            Motivo de selección
            <textarea className={quoteInput} rows={2} maxLength={400} value={draft.rationale}
              onChange={event => update({ rationale: event.target.value })} />
          </label>
          {prefill && <Link className={quotePrimary} to={'/admin/ordenes-compra?partida=' + encodeURIComponent(request.id)}
            state={{ quoteOrder: prefill }}>Preparar OC</Link>}
        </section>
      )}
      {storageError ? <p role="alert" className="text-sm text-amber-800">El navegador no guardó el borrador.</p>
        : <p className="text-xs text-slate-600">Borrador local.</p>}
    </>
  );
}
