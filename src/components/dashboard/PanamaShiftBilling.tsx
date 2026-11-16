import { useEffect, useId, useState } from 'react';

type Valuation = {
  periodStart: string;
  periodEnd: string;
  reportedHours: string;
  adjustmentHours: string;
  valuedHours: string;
  rate: string;
  total: string;
  currency: 'USD';
  status?: string;
  reference: string;
  link?: string;
};

type Invoice = {
  id: string;
  reference: string;
  date: string;
  baseAmount: string;
  currency: 'USD';
  verification: string;
  link?: string;
};

type Billing = {
  status: 'linked' | 'unlinked' | 'review' | 'unavailable';
  message?: string;
  reference?: string;
  valuation: Valuation | null;
  invoice: Invoice | null;
  invoiceStatus?: 'linked' | 'unlinked' | 'missing' | 'review' | 'unavailable';
};

const invoiceMessages = {
  linked: 'Consulta el registro de facturación.',
  unlinked: 'Sin factura asociada en el cruce autorizado.',
  missing: 'La línea asociada no figura en DOCUMENTOS COBRO.',
  review: 'La factura asociada requiere conciliación.',
  unavailable: 'El maestro de facturación no está disponible.',
};

function FinanceSource({ href, children }: { href?: string; children: string }) {
  const safe = href && /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[\w-]+\/edit#gid=\d+&range=A\d+:[OP]\d+$/.test(href);
  return safe
    ? <a href={href} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center font-semibold text-blue-800 underline">{children}</a>
    : <p className="text-slate-600">{children}</p>;
}

function BillingRecord({ folio, hours, id }: { folio: string; hours: number; id: string }) {
  const [data, setData] = useState<Billing>();
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    fetch('/hermes-api/api/panama/turnos/valorizacion?' + new URLSearchParams({ parte: folio }), {
      cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.any([abort.signal, AbortSignal.timeout(20000)]),
    }).then(async response => {
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.status) throw new Error(body?.error || 'No se pudo consultar la valorización.');
      if (!abort.signal.aborted) setData(body as Billing);
    }).catch(reason => {
      if (!abort.signal.aborted) setError(reason instanceof Error && reason.name !== 'TimeoutError' ? reason.message : 'No se pudo consultar la valorización.');
    });
    return () => abort.abort();
  }, [folio, retry]);

  const valuation = data?.valuation;
  const invoice = data?.invoice;
  return <section id={id} aria-label="Valorización y factura" className="min-w-0 space-y-3 break-words rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
    {error && <>
      <p role="alert" className="text-red-800">{error}</p>
      <button type="button" className="min-h-11 font-semibold text-blue-800 underline" onClick={() => { setError(''); setRetry(n => n + 1); }}>
        Reintentar consulta
      </button>
    </>}
    {!data && !error && <p role="status">Consultando valorización…</p>}
    {data && <p><strong>Horas aceptadas del parte</strong> · {hours} h</p>}
    {data?.message && <p role="status" className="text-amber-900">{data.message}</p>}
    {valuation && <div className="space-y-2">
      <h4 className="font-semibold">Valorización del equipo en el período</h4>
      <dl className="grid gap-x-3 gap-y-1 sm:grid-cols-2">
        <div><dt className="font-medium">Período</dt><dd>{valuation.periodStart} a {valuation.periodEnd}</dd></div>
        <div><dt className="font-medium">Horas reportadas</dt><dd>{valuation.reportedHours} h</dd></div>
        <div><dt className="font-medium">Ajuste</dt><dd>{valuation.adjustmentHours} h</dd></div>
        <div><dt className="font-medium">Horas a valorizar</dt><dd>{valuation.valuedHours} h</dd></div>
        <div><dt className="font-medium">Tarifa</dt><dd>{valuation.currency} {valuation.rate}/h</dd></div>
        <div><dt className="font-medium">Valor del período</dt><dd>{valuation.currency} {valuation.total}</dd></div>
      </dl>
      {valuation.status && <p>Estado en el maestro · {valuation.status}</p>}
      <FinanceSource href={valuation.link}>{valuation.reference}</FinanceSource>
    </div>}
    {valuation && <div className="space-y-1 border-t border-slate-200 pt-2">
      <h4 className="font-semibold">Factura</h4>
      {invoice ? <>
        <p>{invoice.reference} · {invoice.date}</p>
        <p>Base registrada · {invoice.currency} {invoice.baseAmount}</p>
        <p>Verificación · {invoice.verification}</p>
        <FinanceSource href={invoice.link}>{'DOCUMENTOS COBRO · ' + invoice.id}</FinanceSource>
      </> : <p className="text-amber-900">{invoiceMessages[data?.invoiceStatus ?? 'unlinked']}</p>}
    </div>}
    {data?.reference && <p className="text-slate-700">Respaldo del cruce · {data.reference}</p>}
  </section>;
}

export default function PanamaShiftBilling({ folio, hours }: { folio: string; hours: number }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <div className="space-y-2">
    <button type="button" className="min-h-11 rounded-lg border border-slate-400 bg-white px-4 py-2 text-sm font-semibold text-[#162252]"
      aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(value => !value)}>
      {open ? 'Ocultar valorización y factura' : 'Ver valorización y factura'}
    </button>
    {open && <BillingRecord folio={folio} hours={hours} id={id} />}
  </div>;
}
