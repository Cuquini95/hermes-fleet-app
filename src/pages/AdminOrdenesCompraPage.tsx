import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Printer, Trash2 } from 'lucide-react';
import {
  displayMoney, formatPanamaReceiptDate, isApprovalRecorded, pendingQuantity, purchaseRead, purchaseRequests, purchaseWrite,
  type PurchaseOrder, type PurchaseOverview, type PurchaseRequestLine,
} from '../lib/purchasing-api';
import { useAuthStore } from '../stores/auth-store';

interface DraftLine {
  key: string;
  id?: string;
  description: string;
  partNumber: string;
  quantity: string;
  unitPrice: string;
  requestLineId?: string;
}

interface Draft {
  folio: string;
  version: string;
  date: string;
  deliveryDate: string;
  vendor: string;
  unit: string;
  entity: string;
  shipping: string;
  other: string;
  comments: string;
  lines: DraftLine[];
}

const input = 'w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm';
const button = 'rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium disabled:opacity-50';
const primary = 'rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';
const blankLine = (): DraftLine => ({ key: crypto.randomUUID(), description: '', partNumber: '', quantity: '1', unitPrice: '' });
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Panama' });
const isoDate = (dmy: string) => {
  const [day, month, year] = dmy.split('/');
  return year && month && day ? year + '-' + month.padStart(2, '0') + '-' + day.padStart(2, '0') : dmy;
};
const blankDraft = (entity = ''): Draft => ({
  folio: '', version: '', date: today(), deliveryDate: '', vendor: '', unit: 'FLOTA', entity,
  shipping: '0', other: '0', comments: '', lines: [blankLine()],
});
const vendorKey = (name: string, rfc: string) => JSON.stringify([name, rfc]);
const linkedLine = (line: PurchaseRequestLine): DraftLine => ({
  key: crypto.randomUUID(),
  description: line.descripcion,
  partNumber: line.partNum,
  quantity: line.cantidad,
  unitPrice: line.precioUnit || line.unitPrice || '0',
  requestLineId: line.id,
});

function cents(value: string) {
  return Math.round((Number(value.replace(/[$,\s]/g, '')) || 0) * 100);
}

export default function AdminOrdenesCompraPage() {
  const [params, setParams] = useSearchParams();
  const initialLine = params.get('partida') ?? '';
  const [data, setData] = useState<PurchaseOverview | null>(null);
  const [requests, setRequests] = useState<PurchaseRequestLine[]>([]);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [receiving, setReceiving] = useState('');
  const [confirmDelete, setConfirmDelete] = useState('');
  const locked = useRef(false);
  const converted = useRef('');
  const form = useRef<HTMLFormElement>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const result = await purchaseRead<PurchaseOverview>('orders', undefined, signal);
      if (signal?.aborted) return;
      setData(result);
      setDraft((old) => old.entity || result.issuers.length !== 1 ? old : { ...old, entity: result.issuers[0]?.id ?? '' });
      try {
        const { items } = await purchaseRequests(signal);
        if (!signal?.aborted) setRequests(items);
      } catch {
        // Orders remain available while the linked request list is retried.
        if (!signal?.aborted) setRequests([]);
      }
    } catch (reason) {
      if (!signal?.aborted) setError(reason instanceof Error ? reason.message : 'No se pudieron leer las órdenes.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    const selected = requests.find((line) => line.id === initialLine && !line.ocFolio && line.estado !== 'Completado');
    if (!selected || converted.current === initialLine) return;
    converted.current = initialLine;
    setDraft((old) => ({ ...blankDraft(old.entity), unit: selected.equipo || 'FLOTA', lines: [linkedLine(selected)] }));
  }, [initialLine, requests]);

  const issuer = data?.issuers.find((entry) => entry.id === draft.entity);
  const currency = issuer?.currency || 'USD';
  const vendor = data?.vendors.find((entry) => vendorKey(entry.name, entry.rfc) === draft.vendor);
  const subtotal = draft.lines.reduce((sum, line) => sum + Math.round(Math.round((Number(line.quantity) || 0) * 1000) * cents(line.unitPrice) / 1000), 0);
  const tax = Math.round(subtotal * (issuer?.taxBps || 0) / 10000);
  const total = subtotal + tax + cents(draft.shipping) + cents(draft.other);
  const openOrder = data?.orders.find((order) => order.folio === receiving);
  const candidateLines = requests.filter((line) =>
    line.estado !== 'Completado' && !line.ocFolio &&
    (line.equipo || 'FLOTA').toUpperCase() === draft.unit.trim().toUpperCase() &&
    !draft.lines.some((part) => part.requestLineId === line.id));

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((old) => ({ ...old, [key]: value }));
  }

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setDraft((old) => ({ ...old, lines: old.lines.map((line) => line.key === key ? { ...line, ...patch } : line) }));
  }

  function resetDraft() {
    setDraft(blankDraft(data?.issuers[0]?.id));
    if (initialLine) setParams({}, { replace: true });
  }

  function edit(order: PurchaseOrder) {
    setError('');
    setReceiving('');
    setDraft({
      folio: order.folio, version: order.version, date: isoDate(order.date), deliveryDate: isoDate(order.deliveryDate),
      vendor: vendorKey(order.vendorName, order.vendorRfc), unit: order.unit || 'FLOTA',
      entity: order.issuer?.id || data?.issuers[0]?.id || '',
      shipping: order.shipping.replace(/[$,\s]/g, '') || '0', other: order.other.replace(/[$,\s]/g, '') || '0', comments: order.comments,
      lines: order.lines.length ? order.lines.map((line) => ({
        ...line, key: line.id,
        unitPrice: line.unitPrice.replace(/[$,\s]/g, ''), quantity: line.quantity.replace(/,/g, ''),
      })) : [blankLine()],
    });
    form.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function run(action: string, payload: object, onSaved: (reply: { folio: string; total?: string; status?: string }) => void) {
    if (locked.current) return;
    locked.current = true;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const reply = await purchaseWrite<{ folio: string; total?: string; status?: string }>(action, payload);
      onSaved(reply);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo confirmar. Reintenta con los mismos datos.');
    } finally {
      locked.current = false;
      setSaving(false);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!vendor) { setError('Selecciona un proveedor.'); return; }
    const lines = draft.lines.map(({ id, description, partNumber, quantity, unitPrice, requestLineId }) => ({
      id, description: description.trim(), partNumber, quantity, unitPrice, requestLineId,
    }));
    await run('order-save', {
      folio: draft.folio || undefined, version: draft.version || undefined, date: draft.date,
      deliveryDate: draft.deliveryDate, vendorName: vendor.name, vendorRfc: vendor.rfc, unit: draft.unit,
      entity: draft.entity, shipping: draft.shipping || '0', other: draft.other || '0', comments: draft.comments, lines,
    }, (reply) => {
      setMessage(reply.folio + ' guardada · ' + displayMoney(reply.total || '0', currency));
      resetDraft();
    });
  }

  function changeStatus(order: PurchaseOrder, status: string) {
    return run('order-status', { folio: order.folio, version: order.version, status }, (reply) => {
      setMessage(reply.folio + ' · ' + status);
    });
  }

  function removeOrder(order: PurchaseOrder) {
    return run('order-delete', { folio: order.folio, version: order.version }, (reply) => {
      setConfirmDelete('');
      if (draft.folio === order.folio) resetDraft();
      setMessage(reply.folio + ' eliminada del listado. El historial se conserva.');
    });
  }

  return (
    <div className="mx-auto max-w-5xl p-3 pb-24 sm:p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-xl font-bold">Órdenes de Compra</h1>
        <Link to="/admin/proveedores" className={button}>Proveedores</Link>
      </div>
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
      {!!data?.orphanFolios.length && (
        <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Folios con partidas sin cabecera reservados para conciliación · {data.orphanFolios.join(', ')}
        </p>
      )}
      {loading && !data && <p role="status" className="text-sm text-gray-600">Cargando órdenes…</p>}
      {!data && !loading && <button type="button" onClick={() => void load()} className={button}>Reintentar</button>}
      {data && (
        <form ref={form} onSubmit={save} className="mb-6 space-y-4 rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
          <h2 className="text-lg font-semibold">{draft.folio ? 'Editar ' + draft.folio : 'Nueva orden de compra'}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Entidad emisora
              <select aria-label="Entidad emisora" required className={input} value={draft.entity} onChange={(event) => setField('entity', event.target.value)}>
                <option value="">Seleccionar</option>
                {data.issuers.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {entry.currency}</option>)}
              </select>
            </label>
            <label className="text-sm">Proveedor
              <select aria-label="Proveedor" required className={input} value={draft.vendor} onChange={(event) => setField('vendor', event.target.value)}>
                <option value="">Seleccionar</option>
                {data.vendors.map((entry, index) => <option key={index} value={vendorKey(entry.name, entry.rfc)}>{entry.name}</option>)}
              </select>
              {vendor && <span className="block text-xs text-gray-600">{vendor.rfc} · {vendor.address}</span>}
            </label>
            <label className="text-sm">Fecha de la orden
              <input type="date" required className={input} value={draft.date} onChange={(event) => setField('date', event.target.value)} />
            </label>
            <label className="text-sm">Fecha de entrega
              <input type="date" className={input} value={draft.deliveryDate} onChange={(event) => setField('deliveryDate', event.target.value)} />
            </label>
            <label className="text-sm">Unidad
              <input required className={input} value={draft.unit} onChange={(event) => setField('unit', event.target.value)} />
            </label>
          </div>
          {candidateLines.length > 0 && (
            <label className="block text-sm">Vincular partida del pedido
              <select className={input} value="" onChange={(event) => {
                const selected = candidateLines.find((line) => line.id === event.target.value);
                if (!selected) return;
                const prior = draft.lines.length === 1 && !draft.lines[0]?.description ? [] : draft.lines;
                setField('lines', [...prior, linkedLine(selected)]);
              }}>
                <option value="">Seleccionar partida</option>
                {candidateLines.map((line) => <option key={line.id} value={line.id}>{line.partNum} · {line.pedidoId || line.descripcion}</option>)}
              </select>
            </label>
          )}
          <div className="space-y-3">
            {draft.lines.map((line, index) => (
              <fieldset key={line.key} className="space-y-2 rounded-lg border border-gray-200 p-3">
                <legend className="px-1 text-sm font-semibold">Partida {index + 1}</legend>
                {line.requestLineId && <p className="break-all text-xs text-blue-700">Partida de pedido · {line.partNumber} · {line.requestLineId}</p>}
                <label className="block text-sm">Descripción
                  <input aria-label={'Descripción ' + (index + 1)} required className={input} readOnly={Boolean(line.requestLineId)} value={line.description} onChange={(event) => updateLine(line.key, { description: event.target.value })} />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-sm">Cantidad
                    <input aria-label={'Cantidad ' + (index + 1)} type="number" min="0.001" step="0.001" required className={input} readOnly={Boolean(line.requestLineId)} value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: event.target.value })} />
                  </label>
                  <label className="text-sm">Precio unitario
                    <input aria-label={'Precio unitario ' + (index + 1)} type="number" min="0" step="0.01" required className={input} value={line.unitPrice} onChange={(event) => updateLine(line.key, { unitPrice: event.target.value })} />
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">{displayMoney(Math.round(Math.round((Number(line.quantity) || 0) * 1000) * cents(line.unitPrice) / 1000) / 100, currency)}</span>
                  <button type="button" aria-label={'Quitar partida ' + (index + 1)} disabled={draft.lines.length < 2} className={button} onClick={() => setField('lines', draft.lines.filter((entry) => entry.key !== line.key))}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </fieldset>
            ))}
            <button type="button" className={button} onClick={() => setField('lines', [...draft.lines, blankLine()])}>
              <Plus size={16} className="inline" /> Agregar partida
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">Envío
              <input type="number" min="0" step="0.01" className={input} value={draft.shipping} onChange={(event) => setField('shipping', event.target.value)} />
            </label>
            <label className="text-sm">Otros cargos
              <input type="number" min="0" step="0.01" className={input} value={draft.other} onChange={(event) => setField('other', event.target.value)} />
            </label>
          </div>
          <label className="block text-sm">Comentarios
            <textarea className={input} value={draft.comments} onChange={(event) => setField('comments', event.target.value)} />
          </label>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{displayMoney(subtotal / 100, currency)}</dd></div>
            <div className="flex justify-between"><dt>{issuer?.taxLabel || 'Impuesto'}</dt><dd>{displayMoney(tax / 100, currency)}</dd></div>
            <div className="flex justify-between font-bold"><dt>Total</dt><dd>{displayMoney(total / 100, currency)}</dd></div>
          </dl>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving || !vendor || !issuer} className={primary}>{saving ? 'Guardando…' : 'Guardar orden'}</button>
            {draft.folio && <button type="button" className={button} onClick={resetDraft}>Cancelar edición</button>}
          </div>
        </form>
      )}

      <h2 className="mb-3 text-lg font-semibold">Órdenes guardadas</h2>
      {data && !data.orders.length && <p className="text-sm text-gray-600">Sin órdenes guardadas.</p>}
      <div className="space-y-3">
        {data?.orders.map((order) => (
          <article key={order.folio} className="space-y-2 rounded-xl border border-gray-200 bg-white p-3">
            <div className="flex flex-wrap justify-between gap-2">
              <h3 className="break-all font-semibold">{order.folio}</h3>
              <span className="font-semibold">{displayMoney(order.total, order.issuer?.currency)}</span>
            </div>
            <p className="text-sm text-gray-600">{order.vendorName} · {order.unit} · {order.status} · Recepción {order.receiptStatus.toLowerCase()}</p>
            {order.lines.some((line) => line.requestId) && <p className="break-all text-xs text-blue-700">Pedidos vinculados · {[...new Set(order.lines.map((line) => line.requestId).filter(Boolean))].join(', ')}</p>}
            <div className="flex flex-wrap gap-2">
              <Link className={button} to={'/admin/ordenes-compra/' + encodeURIComponent(order.folio)}><Printer size={15} className="inline" /> Ver / Imprimir</Link>
              {order.status === 'Borrador' && <button type="button" className={button} disabled={saving} onClick={() => edit(order)}>Editar</button>}
              {data.canApprove && order.status === 'Borrador' && (
                <>
                  <button type="button" className={primary} disabled={saving} onClick={() => void changeStatus(order, 'Aprobada')}>Aprobar</button>
                  <button type="button" className={button} disabled={saving} onClick={() => void changeStatus(order, 'Rechazada')}>Rechazar</button>
                </>
              )}
              {data.canApprove && isApprovalRecorded(order) && order.status !== 'Pagada' && <button type="button" className={button} disabled={saving} onClick={() => void changeStatus(order, 'Pagada')}>Marcar pagada</button>}
              {isApprovalRecorded(order) && <button type="button" className={button} disabled={saving} onClick={() => setReceiving(receiving === order.folio ? '' : order.folio)}>Recepciones</button>}
              {['Borrador', 'Rechazada'].includes(order.status) && <button type="button" className={button} disabled={saving} onClick={() => setConfirmDelete(order.folio)}>Eliminar orden</button>}
            </div>
            {confirmDelete === order.folio && (
              <div className="flex flex-wrap gap-2 rounded-lg bg-red-50 p-2 text-sm">
                <span className="w-full">Eliminar {order.folio} del listado</span>
                <button type="button" className={button} disabled={saving} onClick={() => void removeOrder(order)}>Confirmar eliminación</button>
                <button type="button" className={button} onClick={() => setConfirmDelete('')}>Cancelar</button>
              </div>
            )}
            {openOrder?.folio === order.folio && (
              <ReceptionForm key={openOrder.folio} order={openOrder} saving={saving} onReceive={(lineId, quantity, reference) =>
                run('order-receive', { folio: openOrder.folio, version: openOrder.version, lineId, quantity, reference }, (reply) => {
                  setMessage(reply.folio + ' · recepción registrada');
                })} />
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function ReceptionForm({ order, saving, onReceive }: {
  order: PurchaseOrder;
  saving: boolean;
  onReceive: (lineId: string, quantity: string, reference: string) => Promise<void>;
}) {
  const isPanama = useAuthStore((state) => state.project === 'tmf-panama');
  const [selected, setSelected] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reference, setReference] = useState('');
  const available = order.lines.filter((line) => pendingQuantity(line) > 0);
  const line = available.find((entry) => entry.id === selected) || available[0];
  return (
    <div className="space-y-3 rounded-lg border border-gray-200 p-3">
      <h4 className="text-sm font-semibold">Recepción por partida</h4>
      {order.lines.map((entry) => (
        <div key={entry.id} className="text-sm">
          <p>{entry.description} · Recibidas {entry.received} de {entry.quantity} · Pendientes {pendingQuantity(entry)}</p>
          {entry.receipts.map((receipt) => (
            <p key={receipt.id} className="break-words pl-2 text-xs text-gray-600">
              {receipt.quantity} · {receipt.by} · {isPanama ? <>
                {receipt.reference && `${receipt.reference} · `}<time dateTime={receipt.at}>{formatPanamaReceiptDate(receipt.at)}</time>
              </> : receipt.reference || receipt.at}
            </p>
          ))}
        </div>
      ))}
      {line && (
        <form className="space-y-2" onSubmit={async (event) => {
          event.preventDefault();
          await onReceive(line.id, quantity, reference);
        }}>
          <label className="block text-sm">Partida a recibir
            <select className={input} value={line.id} onChange={(event) => setSelected(event.target.value)}>
              {available.map((entry) => <option key={entry.id} value={entry.id}>{entry.description}</option>)}
            </select>
          </label>
          <label className="block text-sm">Cantidad recibida
            <input className={input} type="number" min="0.001" max={pendingQuantity(line)} step="0.001" required value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </label>
          <label className="block text-sm">Referencia
            <input className={input} value={reference} onChange={(event) => setReference(event.target.value)} />
          </label>
          <button type="submit" disabled={saving} className={primary}>Registrar recepción</button>
        </form>
      )}
    </div>
  );
}
