import { useEffect, useRef, useState, type FormEvent } from 'react';
import { displayMoney, formatPanamaReceiptDate, purchaseRead, purchaseWrite, type InventoryMovement, type WarehouseStock } from '../../lib/purchasing-api';
import { useAuthStore } from '../../stores/auth-store';

export default function PanamaPartsMovements({ ot = '', onMoved }: { ot?: string; onMoved?: () => void }) {
  const userId = useAuthStore((state) => state.userId);
  const project = useAuthStore((state) => state.project);
  const role = useAuthStore((state) => state.role);
  const canReceive = useAuthStore((state) => state.canReceivePurchases && !state.canApprovePurchases);
  if (project !== 'tmf-panama' || (!canReceive && !['jefe_taller','coordinador','supervisor','gerencia'].includes(role ?? ''))) return null;
  return <Movements key={userId + ':' + ot} ot={ot} canReceive={canReceive} onMoved={onMoved} />;
}

function Movements({ ot, canReceive, onMoved }: { ot: string; canReceive: boolean; onMoved?: () => void }) {
  const [items, setItems] = useState<InventoryMovement[]>([]);
  const [kind, setKind] = useState<'Salida' | 'Devolución'>('Salida');
  const [workOrder, setWorkOrder] = useState(ot);
  const [partNumber, setPartNumber] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [stock, setStock] = useState<WarehouseStock[]>([]);
  const [quantity, setQuantity] = useState('');
  const [reference, setReference] = useState('');
  const [originalIssueId, setOriginalIssueId] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const inFlight = useRef(false);
  const returns = kind === 'Devolución';
  const warehouseOptions = stock.filter(item => item.warehouse && item.available !== null
    && item.partNumber.toUpperCase() === partNumber.trim().toUpperCase()).map(item => item.warehouse);
  const requestedOt = workOrder.trim().toUpperCase();
  const eligible = items.filter(item => item.kind === 'Salida' && Number(item.returnable) > 0
    && [item.ot, item.otFolio].some(id => id?.toUpperCase() === requestedOt));
  const original = eligible.find(item => item.id === originalIssueId);
  const issueReference = new Map(items.filter(item => item.kind === 'Salida').map(item => [item.id, item.reference]));

  useEffect(() => {
    const abort = new AbortController();
    purchaseRead<{ items: InventoryMovement[] }>('inventory-movements', ot ? { ot } : undefined, abort.signal)
      .then(({ items: rows }) => { if (!abort.signal.aborted) setItems(rows); })
      .catch((cause: unknown) => {
        if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : 'No se pudo consultar el historial.');
      });
    return () => abort.abort();
  }, [ot, reload]);

  useEffect(() => {
    if (!canReceive) return;
    const abort = new AbortController();
    void purchaseRead<{ items: WarehouseStock[] }>('inventory-stock', undefined, abort.signal)
      .then(result => { if (!abort.signal.aborted) setStock(result.items); })
      .catch(() => { if (!abort.signal.aborted) setStock([]); });
    return () => abort.abort();
  }, [canReceive, reload]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || (returns && !original)) return;
    inFlight.current = true;
    setSaving(true);
    setStatus('');
    setError('');
    try {
      await purchaseWrite('inventory-move', {
        ot: workOrder.trim(), kind, partNumber: returns ? original?.partNumber : partNumber.trim(),
        quantity: quantity.trim().replace(',', '.'), reference: reference.trim(),
        ...(returns && { originalIssueId }),
        ...(!returns && warehouse && { warehouse }),
      });
      setStatus('Movimiento registrado.');
      setReference('');
      setQuantity('');
      setOriginalIssueId('');
      setReload((count) => count + 1);
      onMoved?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo registrar el movimiento.');
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  const input = 'w-full min-h-11 rounded-lg border border-slate-400 p-2 text-base';
  return (
    <section className="mb-4 space-y-3 rounded-xl border border-slate-200 bg-white p-3">
      <h2 className="font-semibold">Movimientos de repuestos</h2>
      {canReceive && <form onSubmit={submit}>
        <fieldset disabled={saving} className="grid gap-2 sm:grid-cols-2">
          <label className="text-sm">Movimiento<select aria-label="Movimiento" className={input} value={kind} onChange={(event) => {
            setKind(event.target.value === 'Devolución' ? 'Devolución' : 'Salida');
            setOriginalIssueId('');
            setQuantity('');
          }}>
            <option>Salida</option><option>Devolución</option>
          </select></label>
          {!ot && <label className="text-sm">Orden de trabajo<input required maxLength={90} className={input} value={workOrder} onChange={(event) => { setWorkOrder(event.target.value); setOriginalIssueId(''); }} /></label>}
          {returns ? <label className="text-sm">Salida original<select aria-label="Salida original" required className={input} value={originalIssueId} onChange={event => setOriginalIssueId(event.target.value)}>
            <option value="">{eligible.length ? 'Selecciona la salida' : 'Sin salidas con saldo verificable'}</option>
            {eligible.map(item => <option key={item.id} value={item.id}>{item.partNumber} · {item.reference} · saldo {item.returnable}</option>)}
          </select></label> : <label className="text-sm">SKU del catálogo<input required maxLength={120} className={input} value={partNumber} onChange={(event) => { setPartNumber(event.target.value); setWarehouse(''); }} /></label>}
          {!returns && warehouseOptions.length > 1 && <label className="text-sm">Almacén de salida
            <select required className={input} value={warehouse} onChange={event => setWarehouse(event.target.value)}>
              <option value="">Seleccionar almacén</option>
              {warehouseOptions.map(option => <option key={option}>{option}</option>)}
            </select>
          </label>}
          <label className="text-sm">Cantidad<input required className={input} inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
          <label className="text-sm">Referencia del movimiento<input required maxLength={160} className={input} value={reference} onChange={(event) => setReference(event.target.value)} /></label>
          {original && <p className="text-xs text-slate-700">Saldo de la salida {original.returnable} {original.measurementUnit}
            {original.valuation ? ` · Costo original ${displayMoney(original.valuation.unitCost, original.valuation.currency)} por unidad` : ' · Costo pendiente de conciliar'}
          </p>}
          <button type="submit" disabled={returns && !original} className="self-end min-h-11 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Registrar movimiento</button>
        </fieldset>
      </form>}
      {status && <p role="status" className="text-sm text-emerald-800">{status}</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {items.length === 0 && !error && <p className="text-sm text-slate-700">Sin movimientos registrados.</p>}
      {items.length > 0 && <ul className="space-y-2 text-sm">
        {items.slice(0, 30).map((item) => (
          <li key={item.id} className="break-words rounded-lg bg-slate-50 p-2">
            <p>{item.kind} · {item.partNumber}{item.warehouse && ` · ${item.warehouse}`} · {item.quantity} {item.measurementUnit}
              {item.stockAfter && ` · existencia ${item.stockAfter}`}</p>
            {!ot && item.unit && <p className="text-slate-700">{item.unit}</p>}
            {item.originalIssueId && <p>Salida original · {issueReference.get(item.originalIssueId) || item.originalIssueId}</p>}
            {item.kind === 'Salida' && <p>{item.returnable == null ? 'Saldo por conciliar' : `Saldo para devolución ${item.returnable}`}</p>}
            {['Salida', 'Devolución'].includes(item.kind) && <p>{item.valuation
              ? `Costo OT ${displayMoney(item.valuation.delta, item.valuation.currency)}`
              : 'Costo pendiente de conciliar'}</p>}
            <details className="text-xs text-slate-600">
              <summary className="min-h-11 cursor-pointer py-3 font-medium">Detalle del movimiento</summary>
              <p>{item.otFolio || item.ot || item.orderNumber || item.order}</p>
              <p>{item.reference} · {item.by} · {formatPanamaReceiptDate(item.at)}</p>
              {item.valuation?.reference && <p>Valuación · {item.valuation.reference}</p>}
            </details>
          </li>
        ))}
      </ul>}
    </section>
  );
}
