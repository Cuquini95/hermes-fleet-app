import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPanamaMaintenance, type MaintenanceEntry } from '../../lib/panama-maintenance';
import { fetchPanamaComponents, type ComponentHistory } from '../../lib/panama-components';
import { displayMoney, purchaseRead, visibleWorkOrderFolio, type PurchaseRequestLine, type WorkOrderPartContext } from '../../lib/purchasing-api';
import { orderHistoryTime, useWorkOrderStore } from '../../stores/workorder-store';
import type { OrderCosts } from '../workshop/PanamaWorkOrderCost';
import { nextWorkOrderAction, unitClosedWorkOrders } from '../../lib/panama-case-status';

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

  const closures = unitClosedWorkOrders(orders, unit);
  const last = closures.lastDated;
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
      : !last ? <p>{loading || !fetched ? 'Consultando…' : closures.missingClosingDate.length ? 'Último cierre por conciliar: existen OT cerradas sin fecha.' : 'Sin OT cerradas registradas en Hermes.'}</p>
        : <>
          {last.folio && <p className="font-semibold">{last.folio}</p>}
          {!results ? <p>Consultando costo…</p>
            : !results.data?.totals.length ? <p>Costo por conciliar.</p>
              : results.data.totals.map(total => <p key={total.currency} className="break-words">
                {results.data?.pending.length ? 'Subtotal conciliado' : 'Total documentado'} · {displayMoney(total.amount, total.currency)}
              </p>)}
          <Link to={`/workorders/${encodeURIComponent(last.ot_id)}`} className={linkClass}>Ver OT y soportes</Link>
          {last.tipo_averia !== 'PM' && <p className={last.operations?.decision === 'accepted' ? 'text-emerald-800' : 'text-amber-800'}>
            {last.operations?.decision === 'accepted' ? 'Retorno recibido por Operaciones; aún requiere verificar restricciones de despacho.'
              : 'Cierre documental distinto de retorno operativo: pendiente de confirmación de Operaciones.'}
          </p>}
        </>}
    {closures.missingClosingDate.length > 0 && <div className="mt-2 space-y-1 border-t border-slate-200 pt-2">
      <p className="font-semibold text-amber-800">Cierres sin fecha: {closures.missingClosingDate.length} · Conciliación pendiente</p>
      {closures.missingClosingDate.slice(0, 4).map(row => <div key={row.ot_id}>
        <Link to={`/workorders/${encodeURIComponent(row.ot_id)}`} className={linkClass}>
          {visibleWorkOrderFolio(row.folio ?? '') ?? row.ot_id} · Documento cerrado, fecha desconocida
        </Link>
        {row.tipo_averia !== 'PM' && <p className="text-xs text-slate-700">{nextWorkOrderAction(row).action}</p>}
      </div>)}
    </div>}
  </section>;
}

function PendingOrderActions({ unit }: { unit: string }) {
  const orders = useWorkOrderStore(state => state.workorders);
  const error = useWorkOrderStore(state => state.error);
  const fetched = useWorkOrderStore(state => state.fetched);
  const loading = useWorkOrderStore(state => state.loading);
  const fetchOrders = useWorkOrderStore(state => state.fetchWorkOrders);

  useEffect(() => {
    if (!useWorkOrderStore.getState().fetched && !useWorkOrderStore.getState().loading) void fetchOrders();
  }, [fetchOrders]);

  const pending = orders.filter(order => order.unidad.trim().toUpperCase() === unit
    && (order.estado !== 'Completado' || (order.tipo_averia !== 'PM' && order.operations?.decision !== 'accepted')));
  return <section className={sectionClass} aria-label="Próximas acciones de órdenes">
    <h3 className="font-semibold">OT y próxima acción</h3>
    {error ? <p>Órdenes nativas no disponibles; revisar Maestro de Taller.</p>
      : !fetched || loading ? <p>Consultando órdenes…</p>
        : !pending.length ? <p>Sin OT nativas pendientes en esta consulta. Verificar también el Maestro de Taller.</p> : <>
          <p className="text-xs text-slate-600">{pending.length} OT nativa(s) por atender o con retorno sin verificar.</p>
          {pending.slice(0, 5).map(order => {
            const next = nextWorkOrderAction(order);
            return <div key={order.ot_id} className="space-y-1 border-t border-slate-100 pt-2">
              <Link to={`/workorders/${encodeURIComponent(order.ot_id)}`} className={linkClass}>
                {visibleWorkOrderFolio(order.folio ?? '') ?? order.ot_id} · {order.estado}
              </Link>
              <p><strong>Siguiente:</strong> {next.action}</p>
              <p className="text-xs text-slate-600">Responsable del paso: {next.responsible}</p>
            </div>;
          })}
        </>}
    <Link to="/workorders" className={linkClass}>Consultar todas las OT y Maestro de Taller</Link>
  </section>;
}

export default function PanamaUnitOperations({ unit, showFinancials }: { unit: string; showFinancials: boolean }) {
  const [pm, setPm] = useState<MaintenanceEntry | null>();
  const [pmSourceDate, setPmSourceDate] = useState<string>();
  const [components, setComponents] = useState<ComponentHistory | null>();
  const [part, setPart] = useState<Awaited<ReturnType<typeof relevantPart>>>();
  const [partUnavailable, setPartUnavailable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void fetchPanamaMaintenance(signal).then(data => {
      if (!signal.aborted) {
        setPm(data.entries?.find(entry => entry.unit === unit) ?? null);
        setPmSourceDate(data.sourceDate);
      }
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
        {pm && <div className="space-y-1 text-xs text-slate-700">
          <p>Horómetro del maestro: {pm.currentHours === null ? 'por verificar' : `${number.format(pm.currentHours)} h`}</p>
          <p>Próximo vencimiento: {pm.dueAt === null ? 'por verificar' : `${number.format(pm.dueAt)} h`}</p>
          <p>Último PM registrado: {pm.lastOfficial || 'sin respaldo visible'}</p>
          <p>Validación de lectura: {pm.reading || 'sin estado de lectura'}</p>
          {pmSourceDate && Number.isFinite(Date.parse(pmSourceDate)) && <p>Corte de consulta del maestro: {panamaCut.format(new Date(pmSourceDate))}</p>}
          {pm.batchBlock && <p className="text-amber-800">{pm.batchBlock}</p>}
        </div>}
        <Link to="/pm" className={linkClass}>Ver plan y órdenes PM</Link>
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
    <PendingOrderActions unit={unit} />
    {showFinancials && <>
      <LastRepairCost unit={unit} />
      <Link to={`/panama/turnos?${new URLSearchParams({ unit, estado: 'aceptados' })}`} className={linkClass}>
        Partes aceptados, valorización y factura
      </Link>
    </>}
  </section>;
}
