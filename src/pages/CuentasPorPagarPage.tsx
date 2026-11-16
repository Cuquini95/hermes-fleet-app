import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { mexicoDateInput } from '../lib/date-utils';
import { displayMoney, panamaApPendingKey, PurchaseApiError, purchaseRead, purchaseWrite, type PurchaseIssuer } from '../lib/purchasing-api';
import { useAuthStore } from '../stores/auth-store';

interface InvoiceLine {
  lineId: string;
  quantity: string;
  unitPrice: string;
}

interface PayableOrder {
  folio: string;
  number?: string;
  version: string;
  unit: string;
  vendorName: string;
  issuer: Pick<PurchaseIssuer, 'id' | 'name' | 'currency' | 'taxLabel'>;
  unbilledTotal?: string;
  legacy?: boolean;
  lines: {
    id: string;
    number: string;
    description: string;
    partNumber: string;
    ordered: string;
    received: string;
    invoiced: string;
    available: string;
    unitPrice: string;
  }[];
}

interface PayableInvoice {
  id: string;
  folio: string;
  number?: string;
  version: string;
  unit: string;
  vendorName: string;
  vendorTaxId?: string;
  entity: string;
  entityId?: string;
  currency: string;
  reference: string;
  issueDate: string;
  dueDate: string;
  total: string;
  paid: string;
  balance: string;
  status: 'Pendiente' | 'Parcial' | 'Pagada';
  legacy?: boolean;
  payments: { id: string; reference: string; date: string; amount: string }[];
}

interface Payables {
  orders: PayableOrder[];
  invoices: PayableInvoice[];
  canRecordInvoice: boolean;
  canRecordPayment: boolean;
}

type PendingWrite =
  | { action: 'ap-invoice'; body: {
    folio: string; version: string; reference: string; issueDate: string; dueDate: string;
    currency: string; amount: string; tax: string; discount?: string; shipping?: string; other?: string; lines: InvoiceLine[];
  } }
  | { action: 'ap-payment'; body: {
    invoiceId: string; version: string; reference: string; date: string; amount: string;
  } };

const button = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-400 bg-white px-3 py-2 text-sm font-semibold text-[#162252] disabled:opacity-60';
const primary = 'inline-flex min-h-11 items-center justify-center rounded-lg bg-[#162252] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60';
const input = 'mt-1 w-full min-w-0 rounded-lg border border-slate-400 bg-white px-3 py-2 text-base font-normal';
const label = 'block min-w-0 text-sm font-medium';
const card = 'min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:p-4';
const formFields = 'grid gap-3 sm:grid-cols-2';

const amountForDisplay = (cents: bigint, currency: string) => displayMoney(Number(cents) / 100, currency);

function decimalUnits(value: string, precision: number) {
  const [whole = '', fraction = ''] = value.split('.');
  return BigInt(whole + fraction.padEnd(precision, '0'));
}

function dateLabel(value: string) {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value || 'Sin fecha';
}

function isOverdue(invoice: PayableInvoice, today: string) {
  return invoice.status !== 'Pagada' && Boolean(invoice.dueDate) && invoice.dueDate < today;
}

function supplierBalances(invoices: PayableInvoice[], today: string) {
  const balances = new Map<string, {
    key: string; vendor: string; taxId?: string; entity: string; currency: string; open: bigint; overdue: bigint; count: number;
  }>();
  for (const invoice of invoices) {
    const amount = decimalUnits(invoice.balance, 2);
    if (amount <= 0n) continue;
    const taxId = invoice.vendorTaxId?.trim();
    const vendorKey = (taxId || invoice.vendorName.trim()).toLocaleUpperCase('es-PA');
    const key = JSON.stringify([vendorKey, invoice.entityId ?? invoice.entity, invoice.currency]);
    const entry = balances.get(key) ?? { key, vendor: invoice.vendorName, taxId, entity: invoice.entity, currency: invoice.currency, open: 0n, overdue: 0n, count: 0 };
    entry.open += amount;
    if (isOverdue(invoice, today)) entry.overdue += amount;
    entry.count += 1;
    balances.set(key, entry);
  }
  return [...balances.values()].sort((left, right) => left.vendor.localeCompare(right.vendor, 'es-PA')
    || left.entity.localeCompare(right.entity, 'es-PA') || left.currency.localeCompare(right.currency));
}

function trackedWrite(key: string): PendingWrite | undefined {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? 'null') as PendingWrite | null;
    if (value?.action === 'ap-invoice' && value.body?.folio) return value;
    if (value?.action === 'ap-payment' && value.body?.invoiceId) return value;
  } catch { /* A write can still be retried on the current page. */ }
}

function trackWrite(key: string, write?: PendingWrite) {
  try {
    if (write) sessionStorage.setItem(key, JSON.stringify(write));
    else sessionStorage.removeItem(key);
  } catch { /* A write can still be retried on the current page. */ }
}

export default function CuentasPorPagarPage() {
  const project = useAuthStore((state) => state.project);
  const previewDemo = useAuthStore((state) => state.previewDemo);
  const userId = useAuthStore((state) => state.userId);
  if (project !== 'tmf-panama' || previewDemo) return <Navigate to="/admin/ordenes-compra" replace />;
  return <PayablesQueue key={userId} userId={userId} />;
}

function PayablesQueue({ userId }: { userId: string }) {
  const operationKey = panamaApPendingKey(userId);
  const [pending, setPending] = useState(() => trackedWrite(operationKey));
  const [data, setData] = useState<Payables>();
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [message, setMessage] = useState('');
  const [active, setActive] = useState<{ type: 'invoice' } | { type: 'payment'; invoiceId: string }>();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const writeLock = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    void purchaseRead<Payables>('ap', undefined, controller.signal)
      .then((result) => { if (!controller.signal.aborted) setData(result); })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setData(undefined);
        setLoadError(cause instanceof PurchaseApiError ? cause.message : 'No se pudieron consultar las cuentas por pagar.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);

  function refresh() {
    setLoading(true);
    setLoadError('');
    setRevision((previous) => previous + 1);
  }

  function closeForm() {
    setActive(undefined);
    setSaveError('');
  }

  async function save(write: PendingWrite) {
    if (writeLock.current || loading || (pending && write !== pending)) return;
    writeLock.current = true;
    setSaving(true);
    setSaveError('');
    setMessage('');
    setPending(write);
    trackWrite(operationKey, write);
    try {
      await purchaseWrite(write.action, write.body);
      setMessage((write.action === 'ap-invoice' ? 'Factura registrada' : 'Pago registrado') + ' · ' + write.body.reference);
      closeForm();
      setPending(undefined);
      trackWrite(operationKey);
      refresh();
    } catch (cause) {
      setSaveError(cause instanceof PurchaseApiError ? cause.message : 'No se pudo confirmar el registro. Reintenta con los mismos datos.');
      if (cause instanceof PurchaseApiError && !cause.confirmationPending) {
        setPending(undefined);
        trackWrite(operationKey);
        if ([403, 404, 409].includes(cause.status)) refresh();
      }
    } finally {
      setSaving(false);
      writeLock.current = false;
    }
  }

  const today = mexicoDateInput();
  const orders = data?.orders.filter(order => !order.legacy && order.lines.some(line => Number(line.available) > 0)
    && (order.unbilledTotal === undefined || Number(order.unbilledTotal) > 0)) ?? [];
  const billableFolios = new Set(orders.map(order => order.folio));
  const pendingOrders = (data?.orders ?? []).filter(order => !order.legacy).flatMap(order => {
    const awaitingReceipt = order.lines.some(line => Number(line.received) < Number(line.ordered));
    const hasReceipt = order.lines.some(line => Number(line.received) > 0);
    const canInvoice = billableFolios.has(order.folio);
    return awaitingReceipt || canInvoice ? [{ order, awaitingReceipt, hasReceipt, canInvoice }] : [];
  });
  const invoices = data?.invoices ?? [];
  const balances = supplierBalances(invoices, today);
  const query = search.trim().toLocaleLowerCase('es-PA');
  const visible = invoices.filter(invoice => {
    if (status === 'open' && invoice.status === 'Pagada') return false;
    if (status === 'overdue' && !isOverdue(invoice, today)) return false;
    if (status === 'paid' && invoice.status !== 'Pagada') return false;
    return [invoice.reference, invoice.vendorName, invoice.vendorTaxId, invoice.number, invoice.folio, invoice.entity, invoice.unit]
      .some(value => value?.toLocaleLowerCase('es-PA').includes(query));
  }).sort((left, right) =>
    Number(left.status === 'Pagada') - Number(right.status === 'Pagada')
    || (left.dueDate || '9999').localeCompare(right.dueDate || '9999')
    || left.reference.localeCompare(right.reference, 'es-PA'));
  const busy = loading || saving || Boolean(pending);
  const mayRetry = pending && (pending.action === 'ap-invoice' ? data?.canRecordInvoice : data?.canRecordPayment);
  const showInvoiceForm = active?.type === 'invoice' && data?.canRecordInvoice;
  const activePayment = active?.type === 'payment' && data?.canRecordPayment
    ? visible.find(invoice => invoice.id === active.invoiceId && !invoice.legacy && invoice.status !== 'Pagada') : undefined;

  return (
    <div className="mx-auto max-w-6xl space-y-4 py-3 sm:py-4">
      <header className="rounded-xl bg-[#162252] p-4 text-white">
        <Link to="/admin/ordenes-compra" className="inline-flex min-h-11 items-center text-sm font-medium text-slate-200 underline underline-offset-4">Volver a Órdenes de Compra</Link>
        <h1 className="text-xl font-bold sm:text-2xl">Cuentas por pagar</h1>
        <nav aria-label="Cuentas por pagar" className="mt-1 flex flex-wrap gap-x-4 text-sm">
          <a className="inline-flex min-h-11 items-center underline underline-offset-4" href="#facturas">Facturas</a>
          <a className="inline-flex min-h-11 items-center underline underline-offset-4" href="#saldos">Saldos por proveedor</a>
        </nav>
      </header>

      <div className="space-y-2" aria-live="polite">
        {loading && <p role="status" className="text-sm text-slate-600">Consultando cuentas por pagar…</p>}
        {message && <p role="status" className="wrap-anywhere rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
      </div>
      {loadError && <div className={card + ' space-y-2'}>
        <p role="alert" className="text-sm text-red-800">{loadError}</p>
        <button type="button" className={button} onClick={refresh}>Reintentar consulta</button>
      </div>}
      {pending && <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
        <p className="wrap-anywhere text-sm text-amber-950">Confirmación pendiente · {pending.body.reference}</p>
        {saveError && <p role="alert" className="text-sm text-red-800">{saveError}</p>}
        {mayRetry && <button type="button" className={button} onClick={() => void save(pending)} disabled={loading || saving}>Reintentar confirmación</button>}
      </div>}
      {data && !data.canRecordInvoice && !data.canRecordPayment && <p className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
        <strong>Solo consulta.</strong> Contabilidad registra facturas y Tesorería registra pagos confirmados.
      </p>}
      {pendingOrders.length > 0 && <section className={card + ' space-y-2'} aria-labelledby="titulo-ordenes-pendientes">
        <h2 id="titulo-ordenes-pendientes" className="text-lg font-bold">Órdenes por procesar</h2>
        <p className="text-sm text-slate-600">Almacén registra las recepciones. Contabilidad puede facturar las cantidades ya recibidas.</p>
        <ul className="divide-y divide-slate-200">
          {pendingOrders.map(({ order, awaitingReceipt, hasReceipt, canInvoice }) => <li key={order.folio}
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm">
            <div className="min-w-0 wrap-anywhere">
              <Link className="font-semibold text-[#162252] underline underline-offset-2"
                to={'/admin/ordenes-compra/' + encodeURIComponent(order.number || order.folio)}>
                OC {order.number || order.folio}
              </Link>
              <span className="ml-2 text-slate-600">{order.vendorName} · {order.unit}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {awaitingReceipt && <span className="rounded-md bg-amber-100 px-2 py-1 font-medium text-amber-950">
                {hasReceipt ? 'Recepción parcial' : 'Por recibir'}
              </span>}
              {canInvoice && <span className="rounded-md bg-emerald-100 px-2 py-1 font-medium text-emerald-950">Lista para facturar</span>}
            </div>
          </li>)}
        </ul>
      </section>}
      {data && <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section id="facturas" aria-labelledby="titulo-facturas" className="min-w-0 scroll-mt-24 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="titulo-facturas" className="text-lg font-bold">Facturas</h2>
            {data.canRecordInvoice && active?.type !== 'invoice' && (
              <button type="button" className={primary} disabled={busy} onClick={() => { setSaveError(''); setActive({ type: 'invoice' }); }}>Registrar factura</button>
            )}
          </div>
          {showInvoiceForm && (
            <InvoiceForm orders={orders} today={today} disabled={busy} error={pending ? '' : saveError} onSave={save} onCancel={closeForm} />
          )}
          {saveError && !pending && !showInvoiceForm && !activePayment && <p role="alert" className="text-sm text-red-800">{saveError}</p>}
          <div className="grid min-w-0 grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <label className={label}>Buscar facturas
              <input type="search" className={input} value={search} onChange={event => setSearch(event.target.value)} />
            </label>
            <label className={label}>Estado
              <select className={input} value={status} onChange={event => setStatus(event.target.value)}>
                <option value="all">Todas</option><option value="open">Con saldo</option><option value="overdue">Vencidas</option><option value="paid">Pagadas</option>
              </select>
            </label>
          </div>
          {visible.length === 0 && <p className="rounded-xl bg-white p-3 text-sm text-slate-600">Sin facturas para mostrar.</p>}
          {visible.map(invoice => {
            const recording = data.canRecordPayment && !invoice.legacy && invoice.status !== 'Pagada';
            const selected = activePayment?.id === invoice.id;
            return <article key={invoice.id} className={card + ' space-y-3'}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="wrap-anywhere font-bold">{invoice.reference}</h3>
                  <p className="wrap-anywhere text-sm text-slate-700">{invoice.vendorName} · {invoice.entity}</p>
                </div>
                <div className="flex flex-wrap gap-1 text-xs font-semibold">
                  <span className={`rounded-md px-2 py-1 ${invoice.status === 'Pagada' ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-800'}`}>{invoice.status}</span>
                  {isOverdue(invoice, today) && <span className="rounded-md bg-red-100 px-2 py-1 text-red-900">Vencida</span>}
                </div>
              </div>
              <p className="wrap-anywhere text-sm text-slate-700">
                <Link className="font-medium underline" to={'/admin/ordenes-compra/' + encodeURIComponent(invoice.number || invoice.folio)}>{invoice.number || invoice.folio}</Link>
                {invoice.unit && ` · ${invoice.unit}`}{invoice.legacy && ' · Registro histórico'}
              </p>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div><dt className="text-slate-600">Emisión</dt><dd>{dateLabel(invoice.issueDate)}</dd></div>
                <div><dt className="text-slate-600">Vence</dt><dd>{dateLabel(invoice.dueDate)}</dd></div>
              </dl>
              <dl className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2 text-sm">
                <div><dt className="text-slate-600">Total</dt><dd className="wrap-anywhere">{displayMoney(invoice.total, invoice.currency)}</dd></div>
                <div><dt className="text-slate-600">Pagado</dt><dd className="wrap-anywhere">{displayMoney(invoice.paid, invoice.currency)}</dd></div>
                <div><dt className="text-slate-600">Saldo</dt><dd className="wrap-anywhere font-bold">{displayMoney(invoice.balance, invoice.currency)}</dd></div>
              </dl>
              {invoice.payments.length > 0 && <details>
                <summary className="cursor-pointer text-sm font-semibold text-[#162252]">Pagos registrados ({invoice.payments.length})</summary>
                <ul className="mt-2 divide-y divide-slate-200 text-sm text-slate-700">
                  {invoice.payments.map(payment => <li key={payment.id} className="flex flex-wrap justify-between gap-x-2 gap-y-1 py-2">
                    <span className="min-w-0 wrap-anywhere">{payment.reference} · {dateLabel(payment.date)}</span>
                    <strong>{displayMoney(payment.amount, invoice.currency)}</strong>
                  </li>)}
                </ul>
              </details>}
              {selected ? <PaymentForm invoice={invoice} today={today} disabled={busy}
                error={pending ? '' : saveError} onSave={save} onCancel={closeForm} /> : recording && (
                <div className="flex justify-end">
                  <button type="button" className={button} disabled={busy} onClick={() => {
                    setSaveError('');
                    setActive({ type: 'payment', invoiceId: invoice.id });
                  }}>Registrar pago</button>
                </div>
              )}
            </article>;
          })}
        </section>

        <section id="saldos" aria-labelledby="titulo-saldos" className="min-w-0 scroll-mt-24 space-y-3">
          <h2 id="titulo-saldos" className="flex min-h-11 items-center text-lg font-bold">Saldos por proveedor</h2>
          {balances.length === 0 && <p className="rounded-xl bg-white p-3 text-sm text-slate-600">No hay saldos abiertos.</p>}
          {balances.map(balance => <article className={card + ' space-y-2'} key={balance.key}>
            <h3 className="wrap-anywhere font-bold">{balance.vendor}</h3>
            {balance.taxId && <p className="wrap-anywhere text-xs text-slate-600">RUC {balance.taxId}</p>}
            <p className="wrap-anywhere text-sm text-slate-700">{balance.entity} · {balance.currency} · {balance.count} {balance.count === 1 ? 'factura abierta' : 'facturas abiertas'}</p>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-slate-600">Saldo abierto</dt><dd className="wrap-anywhere font-bold">{amountForDisplay(balance.open, balance.currency)}</dd></div>
              <div><dt className="text-slate-600">Saldo vencido</dt><dd className={`wrap-anywhere font-semibold ${balance.overdue ? 'text-red-800' : ''}`}>{amountForDisplay(balance.overdue, balance.currency)}</dd></div>
            </dl>
          </article>)}
        </section>
      </div>}
    </div>
  );
}

type FormActions = {
  disabled: boolean;
  error: string;
  onSave: (write: PendingWrite) => Promise<void>;
  onCancel: () => void;
};

function AmountField({ name, title, min = '0', max, required, defaultValue }: {
  name: string; title: string; min?: string; max?: string; required?: boolean; defaultValue?: string;
}) {
  return <label className={label}>{title}
    <input name={name} className={input} type="number" inputMode="decimal" min={min} max={max} step="0.01" required={required} defaultValue={defaultValue} />
  </label>;
}

function captureFields(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const fields = new FormData(event.currentTarget);
  return (name: string) => String(fields.get(name) ?? '').trim();
}

function documentNumber(value: string, precision = 2) {
  const normalized = value.replace(',', '.').replace(/^0+(?=\d)/, '');
  return new RegExp(`^\\d{1,12}(?:\\.\\d{1,${precision}})?$`).test(normalized) ? normalized : '';
}

function InvoiceForm({ orders, today, disabled, error, onSave, onCancel }: FormActions & { orders: PayableOrder[]; today: string }) {
  const [folio, setFolio] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [validation, setValidation] = useState('');
  const order = orders.find(entry => entry.folio === folio);
  const available = order?.lines.filter(line => Number(line.available) > 0) ?? [];

  function submit(event: FormEvent<HTMLFormElement>) {
    const get = captureFields(event);
    if (!order) return;
    const { currency } = order.issuer;
    const reference = get('reference');
    const dueDate = get('dueDate');
    const amount = documentNumber(get('amount'));
    const tax = documentNumber(get('tax'));
    const discount = documentNumber(get('discount'));
    const shipping = documentNumber(get('shipping'));
    const other = documentNumber(get('other'));
    if (!reference || !amount || !tax || ['discount', 'shipping', 'other'].some(name => get(name) && !documentNumber(get(name)))) {
      setValidation('Revisa la referencia, el total y los importes de la factura.');
      return;
    }
    const lines: InvoiceLine[] = [];
    let subtotal = 0n;
    for (const line of available) {
      const rawQuantity = get('quantity:' + line.id);
      if (!rawQuantity) continue;
      const quantity = documentNumber(rawQuantity, 3);
      const unitPrice = documentNumber(get('price:' + line.id));
      if (!quantity || Number(quantity) <= 0 || Number(quantity) > Number(line.available)) {
        setValidation(`Revisa la cantidad de la partida ${line.number}. Disponible ${line.available}.`);
        return;
      }
      if (!unitPrice || Number(unitPrice) !== Number(line.unitPrice)) {
        setValidation(`El precio de la partida ${line.number} debe coincidir con el de la OC.`);
        return;
      }
      lines.push({ lineId: line.id, quantity, unitPrice });
      subtotal += (decimalUnits(quantity, 3) * decimalUnits(unitPrice, 2) + 500n) / 1000n;
    }
    if (lines.length === 0) {
      setValidation('Indica la cantidad facturada de al menos una partida recibida.');
      return;
    }
    if (decimalUnits(discount, 2) > subtotal) {
      setValidation('El descuento supera el subtotal de las partidas.');
      return;
    }
    const calculated = subtotal - decimalUnits(discount, 2) + decimalUnits(tax, 2) + decimalUnits(shipping, 2) + decimalUnits(other, 2);
    if (decimalUnits(amount, 2) !== calculated) {
      setValidation(`Las partidas y cargos suman ${amountForDisplay(calculated, currency)}. Revisa el total de factura.`);
      return;
    }
    setValidation('');
    void onSave({ action: 'ap-invoice', body: {
      folio: order.folio, version: order.version, reference, issueDate, dueDate, currency, amount, tax,
      ...(discount && { discount }), ...(shipping && { shipping }), ...(other && { other }), lines,
    } });
  }

  return <form className={card + ' space-y-3'} aria-label="Registro de factura" onSubmit={submit}>
    <h3 className="font-bold">Factura de proveedor</h3>
    {orders.length ? <fieldset disabled={disabled} className="min-w-0 space-y-3">
      <label className={label}>Orden de compra
        <select className={input} required value={order?.folio ?? ''} onChange={event => {
          setFolio(event.target.value);
          setIssueDate('');
          setValidation('');
        }}>
          <option value="">Selecciona una orden con recepción disponible</option>
          {orders.map(entry => <option key={entry.folio} value={entry.folio}>{entry.number || entry.folio} · {entry.vendorName}</option>)}
        </select>
      </label>
      {order && <div key={order.folio} className="space-y-3">
        <p className="wrap-anywhere rounded-lg bg-slate-50 p-2 text-sm text-slate-700">{order.issuer.name} · {order.unit} · {order.issuer.currency}
          {order.unbilledTotal && <span className="block">Total disponible en la OC {displayMoney(order.unbilledTotal, order.issuer.currency)}</span>}
        </p>
        <label className={label}>Referencia de factura
          <input name="reference" className={input} maxLength={160} required />
        </label>
        <div className={formFields}>
          <label className={label}>Fecha de emisión
            <input name="issueDate" className={input} type="date" max={today} required value={issueDate} onChange={event => setIssueDate(event.target.value)} />
          </label>
          <label className={label}>Fecha de vencimiento
            <input name="dueDate" className={input} type="date" min={issueDate || undefined} required />
          </label>
          <AmountField name="amount" title="Total de factura" min="0.01" max={order.unbilledTotal} required />
          <AmountField name="tax" title={order.issuer.taxLabel || 'ITBMS'} required />
          <AmountField name="discount" title="Descuento" />
          <AmountField name="shipping" title="Envío" />
          <AmountField name="other" title="Otros cargos" />
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Partidas con recepción disponible</h4>
          <p className="text-sm text-slate-700">Deja vacía la cantidad de las partidas que no figuran en la factura.</p>
          {available.map(line => <fieldset key={line.id} className="min-w-0 space-y-2 rounded-lg border border-slate-300 p-2">
            <legend className="max-w-full wrap-anywhere px-1 text-sm font-semibold">Partida {line.number} · {line.description}</legend>
            {line.partNumber && <p className="wrap-anywhere text-sm text-slate-700">{line.partNumber}</p>}
            <p className="flex flex-wrap gap-x-3 text-xs text-slate-700">
              <span>Ordenada {line.ordered}</span><span>Recibida {line.received}</span><span>Facturada {line.invoiced}</span><strong>Disponible {line.available}</strong>
            </p>
            <div className={formFields}>
              <label className={label}>Cantidad facturada
                <input name={'quantity:' + line.id} className={input} type="number" inputMode="decimal" min="0.001" max={line.available} step="0.001" />
              </label>
              <AmountField name={'price:' + line.id} title="Precio unitario facturado" defaultValue={line.unitPrice} />
            </div>
          </fieldset>)}
        </div>
        {(validation || error) && <p role="alert" className="text-sm text-red-800">{validation || error}</p>}
        <button type="submit" className={primary}>Guardar factura</button>
      </div>}
    </fieldset> : <p className="text-sm text-slate-600">No hay órdenes con cantidades recibidas disponibles para facturar.</p>}
    {!order && error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    <button type="button" className={button} disabled={disabled} onClick={onCancel}>Cancelar</button>
  </form>;
}

function PaymentForm({ invoice, today, disabled, error, onSave, onCancel }: FormActions & { invoice: PayableInvoice; today: string }) {
  const [validation, setValidation] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    const get = captureFields(event);
    const reference = get('reference');
    const date = get('date');
    const amount = documentNumber(get('amount'));
    if (!reference || !amount) {
      setValidation('Revisa la referencia bancaria y el importe confirmado.');
      return;
    }
    setValidation('');
    void onSave({ action: 'ap-payment', body: { invoiceId: invoice.id, version: invoice.version, reference, date, amount } });
  }

  return <form aria-label="Registro de pago" onSubmit={submit} className="rounded-lg bg-slate-100 p-3">
    <fieldset disabled={disabled} className="min-w-0 space-y-3">
      <p className="text-sm text-slate-700">Registra un pago ya confirmado en el banco. El saldo de la factura está en {invoice.currency}.</p>
      <label className={label}>Referencia bancaria
        <input name="reference" className={input} maxLength={160} required />
      </label>
      <div className={formFields}>
        <label className={label}>Fecha de pago
          <input name="date" className={input} type="date" min={invoice.issueDate || undefined} max={today} required />
        </label>
        <AmountField name="amount" title="Importe confirmado" min="0.01" max={invoice.balance} required />
      </div>
      {(validation || error) && <p role="alert" className="text-sm text-red-800">{validation || error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={primary}>Guardar pago</button>
        <button type="button" className={button} onClick={onCancel}>Cancelar</button>
      </div>
    </fieldset>
  </form>;
}
