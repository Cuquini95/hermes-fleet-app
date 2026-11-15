import { useEffect, useRef, useState, type FormEvent } from 'react';
import { purchaseRead, purchaseWrite, type WarehouseStock } from '../../lib/purchasing-api';
import { useAuthStore } from '../../stores/auth-store';
import PanamaPartsMovements from './PanamaPartsMovements';

type Selection = { key: string; kind: 'Reserva' | 'Liberación' | 'Salida'; reservation?: WarehouseStock['reservations'][number] };
const cardKey = ({ warehouse, partNumber }: WarehouseStock) => JSON.stringify([warehouse, partNumber]);
const field = 'mt-1 w-full rounded-lg border border-slate-400 bg-white p-2 text-base';
const button = 'min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold';
const primary = 'min-h-11 rounded-lg bg-[#162252] px-4 text-sm font-semibold text-white disabled:opacity-50';
const stockStates = ['Crítico', 'Bajo', 'Al día', 'Por verificar'];

function stockState(item: WarehouseStock) {
  const value = item.warehouse ? item.available : item.physical;
  if (value === null || item.minimum === null) return 'Por verificar';
  const balance = Number(value);
  const minimum = Number(item.minimum);
  if (balance === 0 || balance < minimum) return 'Crítico';
  return balance < minimum * 1.5 ? 'Bajo' : 'Al día';
}

export default function PanamaWarehouseStock() {
  const canReceive = useAuthStore(state => state.canReceivePurchases && !state.canApprovePurchases);
  const [items, setItems] = useState<WarehouseStock[]>([]);
  const [unmatched, setUnmatched] = useState(0);
  const [transitScoped, setTransitScoped] = useState(false);
  const [query, setQuery] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [reload, setReload] = useState(0);
  const [movementRevision, setMovementRevision] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [active, setActive] = useState<Selection>();
  const [ot, setOt] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const lock = useRef(false);

  useEffect(() => {
    const ctrl = new AbortController();
    void purchaseRead<{ items: WarehouseStock[]; unmatchedDispatches: number; transitScoped: boolean }>('inventory-stock', undefined, ctrl.signal)
      .then(data => {
        if (ctrl.signal.aborted) return;
        setItems(data.items);
        setUnmatched(data.unmatchedDispatches);
        setTransitScoped(data.transitScoped);
        setLoadError('');
      })
      .catch(cause => {
        if (ctrl.signal.aborted) return;
        setItems([]);
        setLoadError(cause instanceof Error ? cause.message : 'No se pudo verificar el inventario.');
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoaded(true); });
    return () => ctrl.abort();
  }, [reload]);

  function refresh() {
    setLoaded(false);
    setReload(value => value + 1);
  }

  function start(item: WarehouseStock, kind: Selection['kind'], reservation?: Selection['reservation']) {
    setActive({ key: cardKey(item), kind, reservation });
    setOt(reservation?.folio ?? reservation?.ot ?? '');
    setAmount('');
    setReference('');
    setError('');
    setMessage('');
  }

  async function save(event: FormEvent, item: WarehouseStock) {
    event.preventDefault();
    if (!active || lock.current) return;
    lock.current = true;
    setSaving(true);
    setError('');
    try {
      await purchaseWrite(active.kind === 'Salida' ? 'inventory-move' : 'inventory-reservation', {
        kind: active.kind, ot: ot.trim(), partNumber: item.partNumber, warehouse: item.warehouse,
        quantity: amount.trim().replace(',', '.').replace(/^0+(?=\d)/, ''), reference: reference.trim(),
        ...(active.reservation && { reservationId: active.reservation.id }),
      });
      setMessage(active.kind === 'Reserva' ? 'Reserva registrada.' : active.kind === 'Liberación' ? 'Reserva liberada.' : 'Salida registrada.');
      setActive(undefined);
      setMovementRevision(value => value + 1);
      refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo confirmar el movimiento.');
    } finally {
      setSaving(false);
      lock.current = false;
    }
  }

  const warehouses = [...new Set(items.map(item => item.warehouse).filter(Boolean))];
  const term = query.trim().toLocaleLowerCase('es-PA');
  const visible = items.filter(item => (!warehouse || item.warehouse === warehouse)
    && (!stateFilter || stockState(item) === stateFilter)
    && [item.partNumber, item.description, item.oem].some(value => value.toLocaleLowerCase('es-PA').includes(term)));

  return <>
    <section aria-label="Stock por almacén" className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-40 flex-1 text-sm">Buscar SKU, OEM o repuesto
          <input type="search" className={field} value={query} onChange={event => setQuery(event.target.value)} />
        </label>
        <label className="min-w-32 flex-1 text-sm">Almacén
          <select value={warehouse} className={field} onChange={event => setWarehouse(event.target.value)}>
            <option value="">Todos</option>
            {warehouses.map(value => <option key={value}>{value}</option>)}
          </select>
        </label>
        <button type="button" className={button} onClick={refresh} disabled={!loaded || saving}>Actualizar</button>
      </div>
      <label className="block text-sm">Estado de stock
        <select className={field} value={stateFilter} onChange={event => setStateFilter(event.target.value)}>
          <option value="">Todos</option>
          {stockStates.map(state => <option key={state}>{state}</option>)}
        </select>
      </label>
      {message && <p role="status" className="text-sm text-success">{message}</p>}
      {!loaded && <p role="status" className="text-sm text-text-secondary">Consultando stock…</p>}
      {loadError && <p role="alert" className="text-sm text-critical">{loadError}</p>}
      {unmatched > 0 && <p role="alert" className="text-sm text-critical">Hay despachos con almacén o SKU por conciliar.</p>}
      {loaded && !loadError && !visible.length && <p className="text-sm text-text-secondary">
        {items.length ? 'Sin coincidencias.' : 'Sin SKU cargados en el catálogo operativo.'}
      </p>}
      {loaded && visible.map(item => {
        const selection = active?.key === cardKey(item) ? active : undefined;
        const facts = [['Existencia', item.physical], ['Reservado', item.reserved], ['Disponible', item.available],
          [transitScoped ? 'En tránsito asignado' : 'En tránsito', item.inTransit]];
        return <article key={cardKey(item)} aria-label={`${item.partNumber} · ${item.warehouse || 'Almacén por confirmar'}`}
          className="space-y-3 rounded-xl border border-border bg-white p-4">
          <h2 className="break-words font-semibold">{item.partNumber} · {item.warehouse || 'Almacén por confirmar'}</h2>
          <p className="text-sm text-text-secondary">{item.description}{item.measure && ` · ${item.measure}`}</p>
          <p className="text-sm text-text-secondary">{stockState(item)}{item.minimum !== null && ` · Mínimo ${item.minimum}`}{item.oem && ` · OEM ${item.oem}`}</p>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            {facts.map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-2">
              <dt className="text-text-secondary">{label}</dt><dd className="font-semibold">{value ?? 'Por verificar'}</dd>
            </div>)}
          </dl>
          {item.review && <p className="text-sm text-critical">{item.review}</p>}
          {canReceive && !selection && item.warehouse && item.available !== null && Number(item.available) > 0
            && <div className="flex flex-wrap gap-2">
              <button type="button" className={button} onClick={() => start(item, 'Reserva')}>Reservar</button>
              <button type="button" className={button} onClick={() => start(item, 'Salida')}>Registrar salida</button>
            </div>}
          {item.reservations.length > 0 && <ul className="divide-y divide-border text-sm">
            {item.reservations.map(reservation => <li key={reservation.id} className="space-y-1 py-2">
              <p className="break-words">{reservation.folio ?? reservation.ot} · {reservation.reference} · Saldo {reservation.remaining}</p>
              {canReceive && !selection && <div className="flex flex-wrap gap-2">
                <button type="button" className={button} onClick={() => start(item, 'Salida', reservation)}>Usar reserva</button>
                <button type="button" className={button} onClick={() => start(item, 'Liberación', reservation)}>Liberar</button>
              </div>}
            </li>)}
          </ul>}
          {selection && <form className="rounded-lg bg-slate-50 p-3" onSubmit={event => void save(event, item)}>
            <fieldset disabled={saving} className="space-y-2">
              <legend className="font-semibold">{selection.kind}</legend>
              <label className="block text-sm">Orden de trabajo
                <input className={field} required maxLength={90} value={ot} readOnly={!!selection.reservation} onChange={event => setOt(event.target.value)} />
              </label>
              <label className="block text-sm">{selection.kind === 'Reserva' ? 'Cantidad de reserva' : 'Cantidad'}
                <input className={field} required inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} />
              </label>
              <label className="block text-sm">Referencia
                <input className={field} required maxLength={160} value={reference} onChange={event => setReference(event.target.value)} />
              </label>
              {error && <p role="alert" className="text-sm text-critical">{error}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="submit" className={primary}>{selection.kind === 'Reserva' ? 'Confirmar reserva' : selection.kind === 'Salida' ? 'Confirmar salida' : 'Confirmar liberación'}</button>
                <button type="button" className={button} onClick={() => setActive(undefined)}>Cancelar</button>
              </div>
            </fieldset>
          </form>}
        </article>;
      })}
    </section>
    <div className="mt-4">
      <PanamaPartsMovements key={movementRevision} onMoved={refresh} />
    </div>
  </>;
}
