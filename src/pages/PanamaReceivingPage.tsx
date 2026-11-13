import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { formatPanamaReceiptDate, pendingQuantity, PurchaseApiError, purchaseRead, purchaseWrite, type PurchaseReceivingOrder } from '../lib/purchasing-api';
import { useAuthStore } from '../stores/auth-store';

const button = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-400 bg-white px-4 py-2 text-sm font-semibold text-[#162252] disabled:opacity-60';
const primary = 'inline-flex min-h-11 items-center justify-center rounded-lg bg-[#162252] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60';
const input = 'w-full rounded-lg border border-slate-400 bg-white px-3 py-2 text-base font-normal';

export default function PanamaReceivingPage() {
  const userId = useAuthStore((state) => state.userId);
  const project = useAuthStore((state) => state.project);
  const canReceive = useAuthStore((state) => state.canReceivePurchases);
  if (project !== 'tmf-panama') return <Navigate to="/" replace />;
  if (!canReceive) return <Navigate to="/panama" replace />;
  return <ReceivingQueue key={userId} />;
}

function ReceivingQueue() {
  const [orders, setOrders] = useState<PurchaseReceivingOrder[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [active, setActive] = useState<{ folio: string; lineId: string }>();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [message, setMessage] = useState('');
  const writeLock = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    purchaseRead<{ orders: PurchaseReceivingOrder[] }>('receiving', undefined, controller.signal)
      .then(({ orders }) => {
        if (!controller.signal.aborted) setOrders(orders);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setOrders([]);
        setLoadError(cause instanceof PurchaseApiError ? cause.message : 'No se pudieron consultar las órdenes. Intenta actualizar.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);

  function refresh() {
    setLoading(true);
    setLoadError('');
    setReload((value) => value + 1);
  }

  async function receive(order: PurchaseReceivingOrder, lineId: string, quantity: string, reference: string) {
    if (writeLock.current || loading) return;
    writeLock.current = true;
    setSaving(true);
    setSaveError('');
    setMessage('');
    try {
      await purchaseWrite('order-receive', { folio: order.folio, version: order.version, lineId, quantity, reference });
      setMessage(`${order.folio} · recepción registrada`);
      setActive(undefined);
      refresh();
    } catch (cause) {
      setSaveError(cause instanceof PurchaseApiError ? cause.message : 'No se pudo confirmar la recepción. Reintenta con los mismos datos.');
      if (cause instanceof PurchaseApiError && [403, 404, 409].includes(cause.status)) refresh();
    } finally {
      writeLock.current = false;
      setSaving(false);
    }
  }

  const search = filter.trim().toLocaleLowerCase('es-PA');
  const visible = orders.filter((order) => [order.folio, order.unit, order.vendorName].some((value) => value.toLocaleLowerCase('es-PA').includes(search)));

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="rounded-2xl bg-[#162252] p-4 text-white">
          <Link to="/panama" className="inline-flex min-h-11 items-center text-sm text-slate-200 underline underline-offset-4">Volver a Maestros TMF</Link>
          <h1 className="text-xl font-bold">Recepciones de compras</h1>
          <p className="mt-1 text-sm text-slate-200">TMF Minera Panamá · Almacén</p>
        </header>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-36 flex-1 flex-col gap-1 text-sm font-semibold">
            Buscar por folio, unidad o proveedor
            <input className={input} type="search" value={filter} onChange={(event) => setFilter(event.target.value)} />
          </label>
          <button type="button" className={button} onClick={refresh} disabled={loading || saving}>Actualizar</button>
        </div>
        {message && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 font-medium text-emerald-900">{message}</p>}
        {loading && <p role="status" className="text-sm text-slate-600">Consultando órdenes aprobadas…</p>}
        {loadError && <p role="alert" className="text-sm text-red-700">{loadError}</p>}
        {!loading && !loadError && visible.length === 0 && <p className="text-sm text-slate-600">{search ? 'Sin órdenes para esta búsqueda.' : 'Sin órdenes aprobadas en tu asignación.'}</p>}
        {visible.map((order) => (
          <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4" key={order.folio}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="break-words font-bold text-[#162252]">{order.folio}</h2>
                <p className="break-words text-sm text-slate-700">{order.unit} · {order.vendorName}</p>
                {order.deliveryDate && <p className="text-sm text-slate-700">Entrega prevista {order.deliveryDate}</p>}
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-800">{order.receiptStatus}</span>
            </div>
            <ul className="divide-y divide-slate-200 border-t border-slate-200">
              {order.lines.map((line) => {
                const pending = pendingQuantity(line);
                const isActive = active?.folio === order.folio && active.lineId === line.id;
                return (
                  <li className="space-y-2 py-3 last:pb-0" key={line.id}>
                    <h3 className="break-words font-semibold">{line.number}. {line.description}</h3>
                    {line.partNumber && <p className="break-words text-sm text-slate-600">{line.partNumber}</p>}
                    <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-700">
                      <span>Ordenadas {line.quantity}</span><span>Recibidas {line.received}</span><strong>Pendientes {pending}</strong>
                    </p>
                    {line.receipts.length > 0 && <ul className="space-y-1 rounded-lg bg-slate-50 p-2 text-sm text-slate-700">
                      {line.receipts.map((receipt) => <li key={receipt.id} className="break-words">
                        {receipt.quantity} · {receipt.by} · <time dateTime={receipt.at}>{formatPanamaReceiptDate(receipt.at)}</time>
                        {receipt.reference && ` · ${receipt.reference}`}
                        {receipt.stockDisposition === 'posted' && ' · Inventario actualizado'}
                        {receipt.stockDisposition === 'unregistered' && ' · SKU sin alta en inventario'}
                      </li>)}
                    </ul>}
                    {pending > 0 && (isActive ? <ReceiptForm
                      pending={pending} disabled={loading || saving} error={saveError}
                      onReceive={(quantity, reference) => receive(order, line.id, quantity, reference)} onCancel={() => setActive(undefined)}
                    /> : <button type="button" className={button} disabled={loading || saving} onClick={() => {
                      setSaveError('');
                      setMessage('');
                      setActive({ folio: order.folio, lineId: line.id });
                    }}>Recibir partida</button>)}
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </div>
    </main>
  );
}

function ReceiptForm({ pending, disabled, error, onReceive, onCancel }: {
  pending: number;
  disabled: boolean;
  error: string;
  onReceive: (quantity: string, reference: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [quantity, setQuantity] = useState('');
  const [reference, setReference] = useState('');
  const [invalid, setInvalid] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = quantity.trim().replace(',', '.').replace(/^0+(?=\d)/, '');
    if (!/^\d+(\.\d{1,3})?$/.test(normalized) || Number(normalized) <= 0 || Number(normalized) > pending) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    void onReceive(normalized, reference.trim());
  }

  return (
    <form className="space-y-3 rounded-xl bg-slate-100 p-3" onSubmit={submit}>
      <fieldset disabled={disabled} className="min-w-0 space-y-3">
        <label className="block text-sm font-medium">
          Cantidad recibida
          <input className={input + ' mt-1'} inputMode="decimal" required value={quantity} aria-invalid={invalid || undefined}
            onChange={(event) => { setQuantity(event.target.value); setInvalid(false); }} />
        </label>
        <label className="block text-sm font-medium">
          Referencia o remisión
          <input className={input + ' mt-1'} maxLength={160} required value={reference} onChange={(event) => setReference(event.target.value)} />
        </label>
        {invalid && <p role="alert" className="text-sm text-red-700">Ingresa una cantidad de 0.001 a {pending}, con hasta tres decimales.</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={primary} disabled={!reference.trim()}>Registrar recepción</button>
          <button type="button" className={button} onClick={onCancel}>Cancelar</button>
        </div>
      </fieldset>
    </form>
  );
}
