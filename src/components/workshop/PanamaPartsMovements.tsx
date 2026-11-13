import { useEffect, useState, type FormEvent } from 'react';
import { formatPanamaReceiptDate, purchaseRead, purchaseWrite, type InventoryMovement } from '../../lib/purchasing-api';
import { useAuthStore } from '../../stores/auth-store';

export default function PanamaPartsMovements({ ot = '', onMoved }: { ot?: string; onMoved?: () => void }) {
  const userId = useAuthStore((state) => state.userId);
  const project = useAuthStore((state) => state.project);
  const role = useAuthStore((state) => state.role);
  const canReceive = useAuthStore((state) => state.canReceivePurchases);
  if (project !== 'tmf-panama' || (!canReceive && !['jefe_taller','coordinador','supervisor','gerencia'].includes(role ?? ''))) return null;
  return <Movements key={userId + ':' + ot} ot={ot} canReceive={canReceive} onMoved={onMoved} />;
}

function Movements({ ot, canReceive, onMoved }: { ot: string; canReceive: boolean; onMoved?: () => void }) {
  const [items, setItems] = useState<InventoryMovement[]>([]);
  const [kind, setKind] = useState<'Salida' | 'Devolución'>('Salida');
  const [workOrder, setWorkOrder] = useState(ot);
  const [partNumber, setPartNumber] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reference, setReference] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    purchaseRead<{ items: InventoryMovement[] }>('inventory-movements', ot ? { ot } : undefined, abort.signal)
      .then(({ items: rows }) => { if (!abort.signal.aborted) setItems(rows); })
      .catch((cause: unknown) => {
        if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : 'No se pudo consultar el historial.');
      });
    return () => abort.abort();
  }, [ot, reload]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setStatus('');
    setError('');
    try {
      await purchaseWrite('inventory-move', {
        ot: workOrder.trim(), kind, partNumber: partNumber.trim(), quantity: quantity.trim().replace(',', '.'), reference: reference.trim(),
      });
      setStatus('Movimiento registrado.');
      setReference('');
      setQuantity('');
      setReload((count) => count + 1);
      onMoved?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo registrar el movimiento.');
    } finally {
      setSaving(false);
    }
  }

  const input = 'w-full min-h-11 rounded-lg border border-slate-400 p-2 text-base';
  return (
    <section className="mb-4 space-y-3 rounded-xl border border-slate-200 bg-white p-3">
      <h2 className="font-semibold">Movimientos de repuestos</h2>
      {canReceive && <form onSubmit={submit}>
        <fieldset disabled={saving} className="grid gap-2 sm:grid-cols-2">
          <label className="text-sm">Movimiento<select className={input} value={kind} onChange={(event) => setKind(event.target.value === 'Devolución' ? 'Devolución' : 'Salida')}>
            <option>Salida</option><option>Devolución</option>
          </select></label>
          <label className="text-sm">Orden de trabajo<input required readOnly={Boolean(ot)} maxLength={90} className={input} value={workOrder} onChange={(event) => setWorkOrder(event.target.value)} /></label>
          <label className="text-sm">SKU del catálogo<input required maxLength={120} className={input} value={partNumber} onChange={(event) => setPartNumber(event.target.value)} /></label>
          <label className="text-sm">Cantidad<input required className={input} inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
          <label className="text-sm">Referencia del movimiento<input required maxLength={160} className={input} value={reference} onChange={(event) => setReference(event.target.value)} /></label>
          <button type="submit" className="self-end min-h-11 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Registrar movimiento</button>
        </fieldset>
      </form>}
      {status && <p role="status" className="text-sm text-emerald-800">{status}</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {items.length === 0 && !error && <p className="text-sm text-slate-700">Sin movimientos registrados.</p>}
      {items.length > 0 && <ul className="space-y-2 text-sm">
        {items.slice(0, 30).map((item) => (
          <li key={item.id} className="break-words rounded-lg bg-slate-50 p-2">
            <p>{item.kind} · {item.partNumber} · {item.quantity} {item.measurementUnit} · existencia {item.stockAfter}</p>
            <p className="text-slate-700">{item.ot || item.order} · {item.unit} · {item.reference} · {item.by} · {formatPanamaReceiptDate(item.at)}</p>
          </li>
        ))}
      </ul>}
    </section>
  );
}
