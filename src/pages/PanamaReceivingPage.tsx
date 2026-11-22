import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { formatPanamaReceiptDate, pendingQuantity, PurchaseApiError, purchaseRead, purchaseWrite,
  type PurchaseReceivingLine, type PurchaseReceivingOrder } from '../lib/purchasing-api';
import { useAuthStore } from '../stores/auth-store';

const button = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-400 bg-white px-4 py-2 text-sm font-semibold text-[#162252] disabled:opacity-60';
const primary = 'inline-flex min-h-11 items-center justify-center rounded-lg bg-[#162252] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60';
const input = 'w-full rounded-lg border border-slate-400 bg-white px-3 py-2 text-base font-normal';
type ReceivingWrite = {
  action: 'order-receive' | 'order-dispatch';
  label: string;
  body: { folio: string; version: string; lineId: string; quantity?: string; reference: string;
    warehouse?: string; dispatchId?: string; cancelDispatchId?: string };
};

function pendingWrite(key: string): ReceivingWrite | undefined {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? 'null') as ReceivingWrite | null;
    return value?.body?.folio && ['order-receive', 'order-dispatch'].includes(value.action) ? value : undefined;
  } catch { return undefined; }
}

function trackWrite(key: string, value?: ReceivingWrite) {
  try {
    if (value) sessionStorage.setItem(key, JSON.stringify(value));
    else sessionStorage.removeItem(key);
  } catch { /* The request remains available on the open page. */ }
}

export default function PanamaReceivingPage() {
  const userId = useAuthStore((state) => state.userId);
  const project = useAuthStore((state) => state.project);
  const canReceive = useAuthStore((state) => state.canReceivePurchases && !state.canApprovePurchases);
  if (project !== 'tmf-panama') return <Navigate to="/" replace />;
  if (!canReceive) return <Navigate to="/panama" replace />;
  return <ReceivingQueue key={userId} userId={userId} />;
}

function ReceivingQueue({ userId }: { userId: string }) {
  const operationKey = `hermes:panama:receiving:${userId}`;
  const [pending, setPending] = useState(() => pendingWrite(operationKey));
  const [orders, setOrders] = useState<PurchaseReceivingOrder[]>([]);
  const [filter, setFilter] = useState('');
  const [showReceived, setShowReceived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [active, setActive] = useState<{ folio: string; lineId: string; mode: 'receive' | 'dispatch' | 'cancel'; dispatchId?: string }>();
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

  async function write(order: PurchaseReceivingOrder, lineId: string, action: 'order-receive' | 'order-dispatch',
    payload: { quantity?: string; reference: string; warehouse?: string; dispatchId?: string; cancelDispatchId?: string }) {
    await save({ action, label: order.number || order.folio, body: { folio: order.folio, version: order.version, lineId, ...payload } });
  }

  async function save(write: ReceivingWrite) {
    if (writeLock.current || loading) return;
    if (pending && (pending.action !== write.action || JSON.stringify(pending.body) !== JSON.stringify(write.body))) {
      setSaveError('Confirma primero el movimiento pendiente.');
      return;
    }
    writeLock.current = true;
    setSaving(true);
    setSaveError('');
    setMessage('');
    setPending(write);
    trackWrite(operationKey, write);
    try {
      await purchaseWrite(write.action, write.body);
      const operation = write.action === 'order-receive' ? 'recepción registrada' : write.body.cancelDispatchId ? 'saldo en tránsito cancelado' : 'despacho confirmado';
      setMessage(`${write.label} · ${operation}`);
      setActive(undefined);
      setPending(undefined);
      trackWrite(operationKey);
      refresh();
    } catch (cause) {
      setSaveError(cause instanceof PurchaseApiError ? cause.message : 'No se pudo confirmar el movimiento. Reintenta con los mismos datos.');
      if (cause instanceof PurchaseApiError && [400, 403, 404, 409].includes(cause.status)) {
        setPending(undefined);
        trackWrite(operationKey);
        refresh();
      }
    } finally {
      writeLock.current = false;
      setSaving(false);
    }
  }

  const search = filter.trim().toLocaleLowerCase('es-PA');
  const visible = orders.filter((order) => (
    showReceived
      ? order.lines.some((line) => Number(line.received) > 0)
      : order.lines.some((line) => pendingQuantity(line) > 0)
  ) && [order.number ?? '', order.folio, order.unit, order.vendorName]
    .some((value) => value.toLocaleLowerCase('es-PA').includes(search)));

  return (
    <div className="py-3 text-slate-900 sm:py-4">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="rounded-2xl bg-[#162252] p-4 text-white">
          <Link to="/panama" className="inline-flex min-h-11 items-center text-sm text-slate-200 underline underline-offset-4">Volver a Maestros TMF</Link>
          <h1 className="text-xl font-bold">Recepciones de compras</h1>
          <p className="mt-1 text-sm text-slate-200">TMF Minera Panamá · Almacén</p>
        </header>
        <div role="group" aria-label="Bandejas de Almacén" className="flex flex-wrap gap-2">
          <button type="button" className={showReceived ? button : primary}
            aria-pressed={!showReceived} onClick={() => setShowReceived(false)}>Por recibir</button>
          <button type="button" className={showReceived ? primary : button}
            aria-pressed={showReceived} onClick={() => setShowReceived(true)}>Historial de recepciones</button>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-36 flex-1 flex-col gap-1 text-sm font-semibold">
            Buscar por folio, unidad o proveedor
            <input className={input} type="search" value={filter} onChange={(event) => setFilter(event.target.value)} />
          </label>
          <button type="button" className={button} onClick={refresh} disabled={loading || saving}>Actualizar</button>
        </div>
        {message && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 font-medium text-emerald-900">{message}</p>}
        {pending && <div className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm text-slate-800">
          <p>{pending.label} · Movimiento por confirmar</p>
          {!active && saveError && <p role="alert" className="text-red-700">{saveError}</p>}
          <button type="button" className={button} disabled={loading || saving} onClick={() => void save(pending)}>Confirmar movimiento pendiente</button>
        </div>}
        {loading && <p role="status" className="text-sm text-slate-600">Consultando órdenes aprobadas…</p>}
        {loadError && <p role="alert" className="text-sm text-red-700">{loadError}</p>}
        {!loading && !loadError && visible.length === 0 && <p className="text-sm text-slate-600">{search
          ? 'Sin órdenes para esta búsqueda.'
          : showReceived ? 'No hay recepciones registradas en tu asignación.' : 'No tienes órdenes pendientes de recibir.'}</p>}
        {visible.map((order) => (
          <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4" key={order.folio}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="break-words font-bold text-[#162252]">{order.number || order.folio}</h2>
                <p className="break-words text-sm text-slate-700">{order.unit} · {order.vendorName}</p>
                <p className="text-xs text-slate-600">Expediente OC: {order.folio} · Cada partida conserva movimientos de recepción independientes.</p>
                <p className="text-xs text-slate-700">{order.lines.filter(line => pendingQuantity(line) === 0).length}/{order.lines.length} partidas recibidas por completo.</p>
                {order.deliveryDate && <p className="text-sm text-slate-700">Entrega prevista {order.deliveryDate}</p>}
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-800">{order.receiptStatus}</span>
            </div>
            <ul className="divide-y divide-slate-200 border-t border-slate-200">
              {order.lines.map((line) => {
                const pending = pendingQuantity(line);
                const selected = active?.folio === order.folio && active.lineId === line.id ? active : undefined;
                const shipments = line.dispatches?.filter(item => Number(item.remaining) > 0) ?? [];
                const unshipped = Math.round((pending - shipments.reduce((sum, item) => sum + Number(item.remaining), 0)) * 1000) / 1000;
                const canDispatch = Boolean(line.warehouse || line.warehouses?.length) && unshipped > 0;
                const start = (mode: 'receive' | 'dispatch' | 'cancel', dispatchId?: string) => {
                  setSaveError('');
                  setMessage('');
                  setActive({ folio: order.folio, lineId: line.id, mode, dispatchId });
                };
                return (
                  <li className="space-y-2 py-3 last:pb-0" key={line.id}>
                    <h3 className="break-words font-semibold">{line.number}. {line.description}</h3>
                    {line.partNumber && <p className="break-words text-sm text-slate-600">{line.partNumber}</p>}
                    <p className="break-words text-xs text-slate-600">
                      {line.requestId || line.ot ? <>
                        {line.requestId && `Solicitud: ${line.requestId}`}
                        {line.requestId && line.ot ? ' · ' : ''}
                        {line.ot && `OT: ${line.ot}`}
                      </> : 'Solicitud/OT de origen sin vínculo: conciliar expediente heredado.'}
                    </p>
                    {line.warehouse && <p className="text-sm text-slate-700">Almacén {line.warehouse}</p>}
                    <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-700">
                      <span>Ordenadas {line.quantity}</span><span>Recibidas {line.received}</span><strong className={pending > 0 ? 'text-amber-900' : 'text-emerald-800'}>Pendientes {pending}</strong>
                    </p>
                    {line.receipts.length > 0 && <ul className="space-y-1 rounded-lg bg-slate-50 p-2 text-sm text-slate-700">
                      {line.receipts.map((receipt) => <li key={receipt.id} className="break-words">
                        <details>
                          <summary className="min-h-8 cursor-pointer py-1">
                            {receipt.quantity} recibidas{receipt.reference && ` · ${receipt.reference}`}
                            {receipt.stockDisposition === 'unregistered' && ' · SKU sin alta en inventario'}
                          </summary>
                          <p>{receipt.by} · <time dateTime={receipt.at}>{formatPanamaReceiptDate(receipt.at)}</time></p>
                          {receipt.stockDisposition === 'posted' && <p>Inventario actualizado</p>}
                        </details>
                      </li>)}
                    </ul>}
                    {shipments.length > 0 && <ul className="space-y-1 rounded-lg bg-slate-50 p-2 text-sm">
                      {shipments.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-1">
                        <span className="break-words">{item.reference} · {item.remaining} en tránsito</span>
                        {!selected && <button type="button" className={button} disabled={loading || saving}
                          onClick={() => start('cancel', item.id)}>Cancelar saldo</button>}
                      </li>)}
                    </ul>}
                    {line.dispatchReview && <p role="alert" className="text-sm text-red-700">Concilia las guías y recepciones de la partida.</p>}
                    {pending > 0 && !line.dispatchReview && (selected ? <ReceiptForm
                      key={selected.mode + (selected.dispatchId ?? '')} line={line} mode={selected.mode} pending={pending}
                      unshipped={unshipped} shipments={shipments} disabled={loading || saving} error={saveError}
                      onSave={(quantity, reference, warehouse, dispatchId) => write(order, line.id, selected.mode === 'receive' ? 'order-receive' : 'order-dispatch', {
                        reference, ...(quantity && { quantity }), ...(warehouse && { warehouse }), ...(dispatchId && { dispatchId }),
                        ...(selected.dispatchId && { cancelDispatchId: selected.dispatchId }),
                      })} onCancel={() => setActive(undefined)}
                    /> : <div className="flex flex-wrap gap-2">
                      <button type="button" className={button} disabled={loading || saving} onClick={() => start('receive')}>Recibir partida</button>
                      {canDispatch && <button type="button" className={button} disabled={loading || saving} onClick={() => start('dispatch')}>Confirmar despacho</button>}
                    </div>)}
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}

function ReceiptForm({ line, mode, pending, unshipped, shipments, disabled, error, onSave, onCancel }: {
  line: PurchaseReceivingLine;
  mode: 'receive' | 'dispatch' | 'cancel';
  pending: number;
  unshipped: number;
  shipments: NonNullable<PurchaseReceivingLine['dispatches']>;
  disabled: boolean;
  error: string;
  onSave: (quantity: string, reference: string, warehouse: string, dispatchId: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [quantity, setQuantity] = useState('');
  const [reference, setReference] = useState('');
  const options = line.warehouse ? [] : (line.warehouses ?? []);
  const [warehouse, setWarehouse] = useState(options.length === 1 ? options[0] ?? '' : '');
  const [dispatchId, setDispatchId] = useState('');
  const [invalid, setInvalid] = useState(false);
  const max = mode === 'dispatch' || (mode === 'receive' && shipments.length && !dispatchId) ? unshipped
    : dispatchId ? Number(shipments.find(item => item.id === dispatchId)?.remaining ?? 0) : pending;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = quantity.trim().replace(',', '.').replace(/^0+(?=\d)/, '');
    if (mode !== 'cancel' && (!/^\d+(\.\d{1,3})?$/.test(normalized) || Number(normalized) <= 0 || Number(normalized) > max)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    void onSave(mode === 'cancel' ? '' : normalized, reference.trim(), mode === 'cancel' ? '' : warehouse, dispatchId);
  }

  return (
    <form className="space-y-3 rounded-xl bg-slate-100 p-3" onSubmit={submit}>
      <fieldset disabled={disabled} className="min-w-0 space-y-3">
        {mode !== 'cancel' && options.length > 0 && <label className="block text-sm font-medium">Almacén de destino
          <select required className={input + ' mt-1'} value={warehouse} onChange={event => setWarehouse(event.target.value)}>
            <option value="">Selecciona un almacén</option>
            {options.map(item => <option key={item}>{item}</option>)}
          </select>
        </label>}
        {mode === 'receive' && shipments.length > 0 && <label className="block text-sm font-medium">Guía a recibir
          <select className={input + ' mt-1'} value={dispatchId} onChange={event => { setDispatchId(event.target.value); setInvalid(false); }}>
            <option value="">Sin guía previa · saldo {unshipped}</option>
            {shipments.map(item => <option key={item.id} value={item.id}>{item.reference} · {item.remaining}</option>)}
          </select>
        </label>}
        {mode !== 'cancel' && <label className="block text-sm font-medium">
          {mode === 'receive' ? 'Cantidad recibida' : 'Cantidad despachada'}
          <input className={input + ' mt-1'} inputMode="decimal" required value={quantity} aria-invalid={invalid || undefined}
            onChange={(event) => { setQuantity(event.target.value); setInvalid(false); }} />
        </label>}
        <label className="block text-sm font-medium">
          {mode === 'receive' ? 'Referencia o remisión' : mode === 'dispatch' ? 'Guía del proveedor' : 'Motivo de cancelación'}
          <input className={input + ' mt-1'} maxLength={160} required value={reference} onChange={(event) => setReference(event.target.value)} />
        </label>
        {invalid && <p role="alert" className="text-sm text-red-700">
          {max > 0 ? `Ingresa una cantidad de 0.001 a ${max}, con hasta tres decimales.` : 'Selecciona la guía que estás recibiendo.'}
        </p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={primary} disabled={!reference.trim()}>
            {mode === 'receive' ? 'Registrar recepción' : mode === 'dispatch' ? 'Registrar despacho' : 'Confirmar cancelación'}
          </button>
          <button type="button" className={button} onClick={onCancel}>Cancelar</button>
        </div>
      </fieldset>
    </form>
  );
}
