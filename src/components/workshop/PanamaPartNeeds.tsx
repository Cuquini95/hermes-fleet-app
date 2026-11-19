import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { purchaseRead, purchaseWrite, visibleWorkOrderFolio, type WorkOrderPartContext } from '../../lib/purchasing-api';
import { useAuthStore } from '../../stores/auth-store';

interface PartNeed {
  id: string;
  ot: string;
  folio: string;
  unit: string;
  partNumber: string;
  description: string;
  quantity: string;
  reason: string;
  requestedBy: string;
  state: 'Por revisar en Taller' | 'Autorizada' | 'Devuelta';
  reviewReason?: string;
  needsReconciliation?: boolean;
  delivered?: string;
  reserved?: string;
  incoming?: string;
  forStock?: string;
  closed: boolean;
  purchases: { folio: string; quantity: string }[];
  reservations: { id: string; warehouse: string; quantity: string }[];
}

const field = 'mt-1 min-h-11 w-full min-w-0 rounded-lg border border-slate-400 bg-white p-2 text-base';
const button = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-400 bg-white px-3 py-2 text-sm font-semibold text-[#162252] disabled:opacity-50';
const primary = 'inline-flex min-h-11 items-center justify-center rounded-lg bg-[#162252] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50';

function message(error: unknown) {
  return error instanceof Error ? error.message : 'La operación sigue por confirmar. Reintenta con los mismos datos.';
}

export default function PanamaPartNeeds({
  ot, unit, folio, mayRequest = false, warehouse = false, onChanged,
}: {
  ot?: string; unit?: string; folio?: string; mayRequest?: boolean; warehouse?: boolean; onChanged?: () => void;
}) {
  const actor = useAuthStore(state => state.userId);
  const canReview = useAuthStore(state => state.role === 'jefe_taller') && !warehouse;
  const [items, setItems] = useState<PartNeed[]>();
  const [reload, setReload] = useState(0);
  const [form, setForm] = useState(false);
  const [returnId, setReturnId] = useState('');
  const [warehouseNeed, setWarehouseNeed] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [readError, setReadError] = useState('');
  const [writeError, setWriteError] = useState('');
  const running = useRef(false);

  useEffect(() => {
    const abort = new AbortController();
    void purchaseRead<{ items: PartNeed[] }>('ot-part-needs', ot ? { ot } : undefined, abort.signal)
      .then(data => { if (!abort.signal.aborted) { setItems(data.items); setReadError(''); } })
      .catch(error => { if (!abort.signal.aborted) setReadError(message(error)); });
    return () => abort.abort();
  }, [actor, ot, reload]);

  async function save(action: string, body: object, success: string) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setNotice('');
    setWriteError('');
    try {
      const reply = await purchaseWrite<{ folio?: string }>(action, body);
      setNotice(reply.folio ? 'Solicitud autorizada. Faltante enviado a Compras.' : success);
      setForm(false);
      setReturnId('');
      setWarehouseNeed('');
      setReload(value => value + 1);
      onChanged?.();
    } catch (error) {
      setWriteError(message(error));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  function request(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    void save('ot-part-notify', {
      ot, partNumber: values.get('partNumber'), description: values.get('description'),
      quantity: String(values.get('quantity')).replace(',', '.'), reason: values.get('reason'),
    }, 'Solicitud enviada a Taller.');
  }

  const displayed = ot ? items : items?.filter(item => !item.closed && item.state !== 'Devuelta');
  return <section className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-white p-3" aria-label="Solicitudes de repuestos">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-bold">Solicitudes de repuestos</h2>
      {mayRequest && <button type="button" className={button} aria-expanded={form} onClick={() => setForm(value => !value)}>Solicitar a Taller</button>}
    </div>
    {form && <form className="min-w-0 space-y-2" onSubmit={request}>
      <p className="break-words text-sm font-semibold">{unit}{folio && ' · ' + folio}</p>
      <fieldset className="grid min-w-0 gap-2" disabled={busy}>
        <label className="text-sm">Número de parte o SKU<input name="partNumber" className={field} required maxLength={120} /></label>
        <label className="text-sm">Repuesto<input name="description" className={field} required maxLength={500} /></label>
        <label className="text-sm">Cantidad<input name="quantity" className={field} type="number" min="0.001" step="0.001" required defaultValue="1" /></label>
        <label className="text-sm">Motivo<textarea name="reason" className={field} required maxLength={500} /></label>
        <button type="submit" className={primary}>Enviar a Taller</button>
      </fieldset>
    </form>}
    {readError && <div className="space-y-2"><p role="alert" className="text-sm text-red-800">{readError}</p>
      <button type="button" className={button} onClick={() => setReload(value => value + 1)}>Actualizar solicitudes</button></div>}
    {!displayed && !readError && <p className="text-sm text-slate-600">Consultando solicitudes…</p>}
    {displayed?.length === 0 && <p className="text-sm text-slate-600">Sin solicitudes {ot ? 'en esta OT' : 'pendientes'}.</p>}
    {displayed?.map(need => <article key={need.id} className="min-w-0 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
      <p className="break-words text-sm font-semibold">{need.description} · {need.quantity}</p>
      <p className="break-words text-sm">{need.partNumber} · {need.unit}
        {visibleWorkOrderFolio(need.folio) && ' · ' + need.folio}</p>
      <p className="break-words text-sm">{need.reason}</p>
      <p className="text-xs text-slate-600">{need.requestedBy}</p>
      <p className="text-sm font-semibold">{need.state}</p>
      {need.reviewReason && <p className="break-words text-sm">{need.reviewReason}</p>}
      {need.state === 'Autorizada' && (need.needsReconciliation
        ? <p className="text-sm text-amber-900">Saldo por conciliar</p>
        : <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-700">
          <span>Entregado {need.delivered}</span><span>Reservado {need.reserved}</span>
          <span>Por recibir {need.incoming}</span><span>Por reservar {need.forStock}</span>
        </div>)}
      {need.purchases.length > 0 && <details className="text-sm">
        <summary className="min-h-11 cursor-pointer py-2 font-medium">Pedidos a Compras</summary>
        {need.purchases.map(purchase => <p key={purchase.folio} className="break-all text-xs">{purchase.folio} · {purchase.quantity}</p>)}
      </details>}
      {canReview && !ot && <Link className={button} to={'/workorders/' + encodeURIComponent(need.folio)}>Abrir OT</Link>}
      {canReview && !need.closed && need.state === 'Por revisar en Taller' && <>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={primary} disabled={busy} onClick={() => void save('ot-part-review', { ot: need.ot, id: need.id, decision: 'approve' }, 'Solicitud autorizada para Almacén.')}>Autorizar solicitud</button>
          <button type="button" className={button} disabled={busy} onClick={() => setReturnId(returnId === need.id ? '' : need.id)}>Devolver</button>
        </div>
        {returnId === need.id && <form className="space-y-2" onSubmit={event => {
          event.preventDefault();
          const reason = new FormData(event.currentTarget).get('reason');
          void save('ot-part-review', { ot: need.ot, id: need.id, decision: 'return', reason }, 'Solicitud devuelta al mecánico.');
        }}>
          <label className="text-sm">Motivo de devolución<textarea name="reason" className={field} required maxLength={500} /></label>
          <button type="submit" className={primary} disabled={busy}>Confirmar devolución a Taller</button>
        </form>}
      </>}
      {canReview && !need.closed && need.state === 'Autorizada' && Number(need.forStock) > 0 && <button type="button"
        className={button} disabled={busy} onClick={() => void save('ot-part-review', { ot: need.ot, id: need.id, decision: 'shortfall' }, 'Faltante enviado a Compras.')}>
        Revisar faltante
      </button>}
      {warehouse && !need.closed && !need.needsReconciliation && (Number(need.forStock) > 0 || need.reservations.length > 0) && <>
        <button type="button" className={button} aria-expanded={warehouseNeed === need.id}
          onClick={() => setWarehouseNeed(warehouseNeed === need.id ? '' : need.id)}>Atender solicitud</button>
        {warehouseNeed === need.id && <WarehouseNeed need={need} save={save} busy={busy} />}
      </>}
    </article>)}
    {notice && <p role="status" className="text-sm font-semibold text-emerald-800">{notice}</p>}
    {writeError && <p role="alert" className="text-sm text-red-800">{writeError}</p>}
  </section>;
}

function WarehouseNeed({ need, busy, save }: {
  need: PartNeed; busy: boolean; save: (action: string, body: object, success: string) => Promise<void>;
}) {
  const [stock, setStock] = useState<WorkOrderPartContext>();
  const [failed, setFailed] = useState(false);
  const [allocation, setAllocation] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    void purchaseRead<WorkOrderPartContext>('ot-part', { ot: need.ot, partNumber: need.partNumber }, abort.signal)
      .then(data => { if (!abort.signal.aborted) setStock(data); })
      .catch(() => { if (!abort.signal.aborted) setFailed(true); });
    return () => abort.abort();
  }, [need.ot, need.partNumber]);
  const warehouses = (stock?.items ?? []).filter(item => item.warehouse && Number(item.available) > 0);
  const selected = warehouses.find(item => item.warehouse === allocation);
  return <div className="space-y-2">
    {need.reservations.map(reservation => <form key={reservation.id} className="space-y-2" onSubmit={event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      void save('inventory-move', {
        kind: 'Salida', ot: need.ot, partNumber: need.partNumber, warehouse: reservation.warehouse,
        reservationId: reservation.id, partNeedId: need.id, quantity: data.get('quantity'), reference: data.get('reference'),
      }, 'Entrega guardada contra la OT.');
    }}>
      <fieldset className="space-y-2" disabled={busy}>
        <p className="break-words text-sm font-medium">{reservation.warehouse} · Reserva {reservation.quantity}</p>
        <label className="block text-sm">Cantidad a entregar<input name="quantity" className={field} type="number" required min="0.001" step="0.001" max={reservation.quantity} defaultValue={reservation.quantity} /></label>
        <label className="block text-sm">Referencia de entrega<input name="reference" className={field} maxLength={160} required /></label>
        <button type="submit" className={primary}>Confirmar entrega</button>
      </fieldset>
    </form>)}
    {Number(need.forStock) > 0 && warehouses.length > 0 && <form className="space-y-2" onSubmit={event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      void save('inventory-reservation', {
        kind: 'Reserva', ot: need.ot, partNumber: need.partNumber, warehouse: data.get('warehouse'),
        quantity: data.get('quantity'), reference: data.get('reference'), partNeedId: need.id,
      }, 'Reserva guardada contra la OT.');
    }}>
      <fieldset className="space-y-2" disabled={busy}>
        <label className="block text-sm">Almacén<select className={field} name="warehouse" required value={allocation}
          onChange={event => setAllocation(event.target.value)}>
          <option value="">Selecciona</option>
          {warehouses.map(item => <option key={item.warehouse} value={item.warehouse}>{item.warehouse} · {item.available} disponibles</option>)}
        </select></label>
        <label className="block text-sm">Cantidad a reservar<input key={allocation} name="quantity" className={field} type="number" required min="0.001" step="0.001"
          max={Math.min(Number(need.forStock), Number(selected?.available ?? '0'))} defaultValue={selected ? Math.min(Number(need.forStock), Number(selected.available)) : ''} /></label>
        <label className="block text-sm">Referencia de reserva<input name="reference" className={field} maxLength={160} required /></label>
        <button type="submit" className={primary} disabled={!selected}>Confirmar reserva</button>
      </fieldset>
    </form>}
    {Number(need.forStock) > 0 && (failed ? <p role="alert" className="text-sm text-amber-900">Existencias por conciliar.</p>
      : !stock ? <p className="text-sm">Consultando existencias…</p> : !warehouses.length && <p className="text-sm">Saldo por revisar con Taller.</p>)}
  </div>;
}
