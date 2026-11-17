import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPanamaMaintenance, type MaintenanceEntry } from '../../lib/panama-maintenance';
import { fetchPanamaComponents, type ComponentHistory } from '../../lib/panama-components';
import { displayMoney, purchaseRead, visibleWorkOrderFolio, type PurchaseRequestLine, type WorkOrderPartContext } from '../../lib/purchasing-api';
import { orderHistoryTime, useWorkOrderStore } from '../../stores/workorder-store';
import type { OrderCosts } from '../workshop/PanamaWorkOrderCost';

const number = new Intl.NumberFormat('es-PA', { maximumFractionDigits: 3 });
const sectionClass = 'min-w-0 space-y-1 rounded-lg border border-slate-200 p-3 text-sm';
const linkClass = 'inline-flex min-h-11 items-center text-sm font-semibold text-primary underline';

function componentDue(data: ComponentHistory) {
  return data.life.flatMap(row => {
    const current = row.calculation;
    return current && (current.status === 'verified' || current.status === 'reproduced') && Number.isFinite(current.remaining)
      ? [{ part: row.part, position: row.position, remaining: current.remaining }]
      : [];
  }).sort((a, b) => a.remaining - b.remaining)[0];
}

function hoursRemaining(hours: number) {
  return hours < 0 ? `Vencido · ${number.format(-hours)} h` : `${number.format(hours)} h restantes`;
}

async function relevantPart(unit: string, signal: AbortSignal) {
  const { items } = await purchaseRead<{ items: PurchaseRequestLine[] }>('requests', undefined, signal);
  const request = items.find(item => item.equipo.trim().toUpperCase() === unit && item.ot && item.partNum
    && !/cancelad|rechazad|completad|recibid[ao] total/i.test(item.estado)
    && !(item.receivedQuantity && Number(item.receivedQuantity) >= Number(item.cantidad)));
  if (!request?.ot) return null;
  const stock = await purchaseRead<WorkOrderPartContext>('ot-part', { ot: request.ot, partNumber: request.partNum }, signal);
  return stock.unit.toUpperCase() === unit ? { request, stock } : null;
}

function LastRepairCost({ unit }: { unit: string }) {
  const orders = useWorkOrderStore(state => state.workorders);
  const fetched = useWorkOrderStore(state => state.fetched);
  const loading = useWorkOrderStore(state => state.loading);
  const error = useWorkOrderStore(state => state.error);
  const fetchOrders = useWorkOrderStore(state => state.fetchWorkOrders);
  const [cost, setCost] = useState<{ ot: string; data?: OrderCosts }>();

  useEffect(() => {
    if (!useWorkOrderStore.getState().fetched && !useWorkOrderStore.getState().loading) void fetchOrders();
  }, [fetchOrders]);

  const last = orders.filter(order => order.unidad.toUpperCase() === unit && order.estado === 'Completado'
    && orderHistoryTime(order.fecha_cierre) > 0)
    .sort((a, b) => orderHistoryTime(b.fecha_cierre) - orderHistoryTime(a.fecha_cierre))[0];
  const ot = last?.ot_id;
  const results = cost?.ot === ot ? cost : undefined;

  useEffect(() => {
    if (!ot) return;
    const controller = new AbortController();
    void purchaseRead<OrderCosts>('workorder-cost', { ot }, controller.signal).then(data => {
      if (!controller.signal.aborted) setCost({ ot, data: data.ot === ot && data.unit.toUpperCase() === unit ? data : undefined });
    }).catch(() => { if (!controller.signal.aborted) setCost({ ot }); });
    return () => controller.abort();
  }, [ot, unit]);

  return <section className={sectionClass} aria-label="Última OT cerrada">
    <h3 className="font-semibold">Última OT cerrada</h3>
    {error ? <p>Historial por consultar.</p>
      : !last ? <p>{loading || !fetched ? 'Consultando…' : 'Sin cierre fechado para este equipo.'}</p>
        : <>
          {last.folio && <p className="font-semibold">{last.folio}</p>}
          {!results ? <p>Consultando costo…</p>
            : !results.data?.totals.length ? <p>Costo por conciliar.</p>
              : results.data.totals.map(total => <p key={total.currency} className="break-words">
                {results.data?.pending.length ? 'Subtotal conciliado' : 'Total documentado'} · {displayMoney(total.amount, total.currency)}
              </p>)}
          <Link to={`/workorders/${encodeURIComponent(last.ot_id)}`} className={linkClass}>Ver OT y soportes</Link>
        </>}
  </section>;
}

export default function PanamaUnitOperations({ unit, showFinancials }: { unit: string; showFinancials: boolean }) {
  const [pm, setPm] = useState<MaintenanceEntry | null>();
  const [components, setComponents] = useState<ComponentHistory | null>();
  const [part, setPart] = useState<Awaited<ReturnType<typeof relevantPart>>>();
  const [partUnavailable, setPartUnavailable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void fetchPanamaMaintenance(signal).then(data => {
      if (!signal.aborted) setPm(data.entries?.find(entry => entry.unit === unit) ?? null);
    }).catch(() => { if (!signal.aborted) setPm(null); });
    void fetchPanamaComponents(unit, signal).then(data => {
      if (!signal.aborted) setComponents(data);
    }).catch(() => { if (!signal.aborted) setComponents(null); });
    void relevantPart(unit, signal).then(data => {
      if (!signal.aborted) setPart(data);
    }).catch(() => { if (!signal.aborted) { setPart(null); setPartUnavailable(true); } });
    return () => controller.abort();
  }, [unit]);

  const nextComponent = components && componentDue(components);

  return <section aria-label={`Ficha operativa de ${unit}`} className="mb-4 space-y-2">
    <div className="grid grid-cols-2 gap-2">
      <section className={sectionClass} aria-label="Próximo PM">
        <h3 className="font-semibold">Próximo PM</h3>
        {pm?.level && <p>{pm.level}</p>}
        <p className={pm?.state === 'overdue' ? 'font-semibold text-red-800' : 'text-slate-700'}>
          {pm === undefined ? 'Consultando…' : pm?.reconciliationPending ? 'Cierre por conciliar'
            : pm && pm.state !== 'unknown' && pm.remaining !== null ? hoursRemaining(pm.remaining) : 'Por verificar'}
        </p>
      </section>
      <section className={sectionClass} aria-label="Vida de componentes">
        <h3 className="font-semibold">Vida de componentes</h3>
        {nextComponent ? <>
          <p className="break-words">{nextComponent.part}{nextComponent.position && ` · ${nextComponent.position}`}</p>
          <p className={nextComponent.remaining < 0 ? 'font-semibold text-red-800' : 'text-slate-700'}>{hoursRemaining(nextComponent.remaining)}</p>
          {!!components.unavailable.length && <p className="text-xs text-slate-600">Consulta parcial</p>}
        </> : <p>{components === undefined ? 'Consultando…' : 'Saldo por verificar'}</p>}
      </section>
    </div>
    <section className={sectionClass} aria-label="Repuesto solicitado">
      <h3 className="font-semibold">Repuesto solicitado</h3>
      {part ? <>
        <p className="break-words">{part.stock.partNumber ?? part.request.partNum} · {part.request.descripcion} · {part.request.cantidad}</p>
        {part.stock.match === 'verified' && part.stock.items?.length ? part.stock.items.map(item =>
          <p key={`${item.partNumber}:${item.warehouse}`} className="break-words">
            {item.warehouse || 'Almacén por confirmar'} · {item.available === null ? 'Existencia por conciliar'
              : `${item.available} disponibles · ${item.reservedForOt ?? '—'} reservados para esta OT`}
          </p>) : <p>Compatibilidad o existencia por confirmar.</p>}
        <Link to={`/workorders/${encodeURIComponent(part.stock.ot)}`} className={linkClass}>
          {visibleWorkOrderFolio(part.stock.folio) ?? 'Ver OT'} y pedido
        </Link>
      </> : <p>{part === undefined ? 'Consultando…' : partUnavailable ? 'Repuestos por consultar.' : 'Sin pedido abierto vinculado a una OT.'}</p>}
    </section>
    {showFinancials && <>
      <LastRepairCost unit={unit} />
      <Link to={`/panama/turnos?${new URLSearchParams({ unit, estado: 'aceptados' })}`} className={linkClass}>
        Partes aceptados, valorización y factura
      </Link>
    </>}
  </section>;
}
