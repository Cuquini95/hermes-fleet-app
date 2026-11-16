import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { purchaseRead, purchaseWrite, type WorkOrderPartContext } from '../../lib/purchasing-api';
import { useAuthStore } from '../../stores/auth-store';

const field = 'mt-1 min-h-11 w-full min-w-0 rounded-lg border border-slate-400 bg-white p-2 text-base';
const button = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-400 bg-white px-3 py-2 text-sm font-semibold text-[#162252] disabled:opacity-50';
const primary = 'inline-flex min-h-11 items-center justify-center rounded-lg bg-[#162252] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50';
const describeError = (cause: unknown, fallback: string) => cause instanceof Error ? cause.message : fallback;

export default function PanamaWorkOrderPartRequest({ ot }: { ot: string }) {
  const canRequest = useAuthStore(state => state.role === 'jefe_taller');
  const canReserve = useAuthStore(state => state.canReceivePurchases && !state.canApprovePurchases);
  const [expanded, setExpanded] = useState(false);
  if (!canRequest && !canReserve) return null;
  return (
    <section className="min-w-0 space-y-3 rounded-xl border border-slate-200 p-3">
      <button type="button" className={button} aria-expanded={expanded} onClick={() => setExpanded(open => !open)}>
        {canRequest ? 'Pedir repuestos para esta OT' : 'Repuestos para esta OT'}
      </button>
      {expanded && <PartForm ot={ot} canRequest={canRequest} canReserve={canReserve} />}
    </section>
  );
}

function PartForm({ ot, canRequest, canReserve }: { ot: string; canRequest: boolean; canReserve: boolean }) {
  const [context, setContext] = useState<WorkOrderPartContext>();
  const [part, setPart] = useState('');
  const [checked, setChecked] = useState<{ key: string; result?: WorkOrderPartContext }>();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('1');
  const [requiredDate, setRequiredDate] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const running = useRef(false);
  const lookup = useRef<AbortController | null>(null);
  const partKey = part.trim().toUpperCase();
  const match = checked?.key === partKey ? checked : undefined;
  const result = match?.result;
  const candidateWarehouses = (result?.items ?? []).filter(item => item.warehouse && item.available !== null
    && Number(item.available) > 0 && Number(item.available) >= Number(amount));
  const selectedWarehouse = candidateWarehouses.find(item => item.warehouse === warehouse)
    ?? (candidateWarehouses.length === 1 ? candidateWarehouses[0] : undefined);

  useEffect(() => {
    const abort = new AbortController();
    void purchaseRead<WorkOrderPartContext>('ot-part', { ot }, abort.signal)
      .then(data => { if (!abort.signal.aborted) setContext(data); })
      .catch(cause => { if (!abort.signal.aborted) setError(describeError(cause, 'No se pudo verificar la OT.')); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => { abort.abort(); lookup.current?.abort(); };
  }, [ot, loadAttempt]);

  async function checkPart(key: string, fillDescription = false) {
    const abort = new AbortController();
    lookup.current?.abort();
    lookup.current = abort;
    setChecking(true);
    try {
      const response = await purchaseRead<WorkOrderPartContext>('ot-part', { ot, partNumber: key }, abort.signal);
      if (abort.signal.aborted) return;
      setChecked({ key, result: response });
      if (fillDescription) setDescription(previous => previous || response.items?.[0]?.description || '');
    } catch {
      if (!abort.signal.aborted) setChecked({ key });
    } finally {
      if (!abort.signal.aborted) setChecking(false);
    }
  }

  async function save(kind: 'purchase' | 'reservation') {
    if (running.current || !context || !match) return;
    if (kind === 'purchase' && (!canRequest || result?.match === 'ambiguous')) return;
    setStatus('');
    setError('');
    const quantity = amount.trim().replace(',', '.');
    if (!requiredDate || !/^(?:0|[1-9]\d{0,11})(?:\.\d{1,3})?$/.test(quantity) || Number(quantity) <= 0) {
      setError('Indica la cantidad y la fecha requerida.');
      return;
    }
    if (kind === 'reservation' && (!selectedWarehouse || !reference.trim() || !result?.partNumber)) {
      setError('Selecciona un almacén con saldo suficiente e indica la referencia de la reserva.');
      return;
    }
    running.current = true;
    setSaving(true);
    try {
      if (kind === 'reservation' && selectedWarehouse && result?.partNumber) {
        await purchaseWrite('inventory-reservation', {
          kind: 'Reserva', ot: context.ot, partNumber: result.partNumber, warehouse: selectedWarehouse.warehouse,
          quantity, reference: `${reference.trim()} · Requerido ${requiredDate}`,
        });
        setStatus(`${quantity} reservado para ${context.folio} en ${selectedWarehouse.warehouse}.`);
        setReference('');
        await checkPart(partKey);
      } else {
        const response = await purchaseWrite<{ folio: string }>('request-submit', {
          items: [{
            equipment: context.unit, ot: context.ot, part_number: result?.partNumber ?? partKey,
            description: description.trim(), quantity, requiredDate, isManual: result?.match !== 'verified',
          }],
        });
        setStatus(`Pedido ${response.folio} enviado a Compras.`);
        setPart('');
        setDescription('');
        setChecked(undefined);
        setWarehouse('');
        setReference('');
      }
    } catch (cause) {
      setError(describeError(cause, 'No se pudo confirmar la operación. Reintenta con los mismos datos.'));
    } finally {
      running.current = false;
      setSaving(false);
    }
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!partKey || saving) return;
    setWarehouse('');
    setStatus('');
    setError('');
    void checkPart(partKey, true);
  }

  if (loading) return <p role="status" className="text-sm">Verificando la OT…</p>;
  if (!context) return <div className="space-y-2">
    <p role="alert" className="text-sm text-red-800">{error}</p>
    <button className={button} type="button" onClick={() => { setLoading(true); setError(''); setLoadAttempt(value => value + 1); }}>
      Reintentar consulta
    </button>
  </div>;

  return (
    <div className="space-y-3">
      <p className="break-words text-sm font-semibold">OT {context.folio} · Equipo {context.unit} · Serie {context.serial || 'Por verificar'}</p>
      <form onSubmit={search} className="flex flex-wrap items-end gap-2">
        <label className="min-w-40 flex-1 text-sm">Número de parte o SKU
          <input className={field} required maxLength={120} value={part} disabled={saving} onChange={event => {
            lookup.current?.abort();
            setChecking(false);
            setPart(event.target.value);
            setDescription('');
            setStatus('');
            setError('');
          }} />
        </label>
        <button type="submit" className={button} disabled={checking || saving}>Consultar existencias</button>
      </form>
      {checking && <p role="status" className="text-sm">Consultando existencias…</p>}
      {match && !checking && <div className="space-y-3">
        {!result && <p className="text-sm text-amber-900">Existencias por verificar. La fuente no respondió.</p>}
        {result?.match !== 'verified' && result && <p className="text-sm text-amber-900">
          {result.match === 'ambiguous' ? 'Hay varios SKU compatibles. Consulta por SKU para confirmar existencias.' : 'No hay existencias compatibles verificadas para este número de parte.'}
        </p>}
        {result?.match === 'verified' && <ul className="space-y-2" aria-label="Existencias por almacén">
          {result.items?.map(item => <li key={item.warehouse} className="space-y-1 rounded-lg bg-slate-50 p-2 text-sm">
            <p className="break-words font-semibold">{item.warehouse || 'Almacén por confirmar'} · {item.partNumber}{item.measure && ` · ${item.measure}`}</p>
            <dl className="grid grid-cols-2 gap-2 min-[430px]:grid-cols-4">
              {[
                ['Libre', item.available], ['Reservado', item.reserved],
                ['Para esta OT', item.reservedForOt], [result.transitScoped ? 'En tránsito asignado' : 'En tránsito', item.inTransit],
              ].map(([label, value]) => <div key={label}><dt className="text-slate-600">{label}</dt><dd className="font-semibold">{value ?? 'Por verificar'}</dd></div>)}
            </dl>
            {item.review && <p className="text-amber-900">{item.review}</p>}
          </li>)}
        </ul>}
        <form onSubmit={event => { event.preventDefault(); void save('purchase'); }} className="space-y-3">
          <fieldset disabled={saving} className="grid min-w-0 gap-2 sm:grid-cols-2">
            <label className="text-sm">Cantidad requerida
              <input className={field} type="number" inputMode="decimal" required min="0.001" step="0.001" value={amount} onChange={event => setAmount(event.target.value)} />
            </label>
            <label className="text-sm">Fecha requerida
              <input className={field} type="date" required value={requiredDate} onChange={event => setRequiredDate(event.target.value)} />
            </label>
            {canRequest && <label className="text-sm sm:col-span-2">Descripción del repuesto
              <input className={field} required maxLength={500} value={description} onChange={event => setDescription(event.target.value)} />
            </label>}
          </fieldset>
          {candidateWarehouses.length > 0 && (canReserve
            ? <fieldset disabled={saving} className="min-w-0 space-y-2 rounded-lg border border-slate-200 p-2">
              <legend className="px-1 text-sm font-semibold">Cubrir con inventario</legend>
              {candidateWarehouses.length > 1 && <label className="block text-sm">Almacén de reserva
                <select className={field} value={warehouse} onChange={event => setWarehouse(event.target.value)}>
                  <option value="">Selecciona un almacén</option>
                  {candidateWarehouses.map(item => <option key={item.warehouse}>{item.warehouse}</option>)}
                </select>
              </label>}
              <label className="block text-sm">Referencia de reserva
                <input className={field} maxLength={125} value={reference} onChange={event => setReference(event.target.value)} />
              </label>
              <button className={button} type="button" onClick={() => void save('reservation')}>Reservar para la OT</button>
            </fieldset>
            : <p className="text-sm">Almacén puede reservar el repuesto para esta OT.</p>)}
          {canRequest && <button type="submit" className={primary} disabled={saving || result?.match === 'ambiguous'}>Enviar pedido a Compras</button>}
        </form>
      </div>}
      {status && <p role="status" className="break-words text-sm font-semibold text-emerald-800">{status}</p>}
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
      {canRequest && <Link className="inline-flex min-h-11 items-center text-sm font-semibold underline"
        to={`/pedidos?${new URLSearchParams({ ot: context.ot })}`}>Abrir carrito de pedidos</Link>}
    </div>
  );
}
