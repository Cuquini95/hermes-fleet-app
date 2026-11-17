import { useEffect, useRef, useState, type FormEvent } from 'react';
import { calculateReplenishment, type ReplenishmentInput, type ReplenishmentSource } from '../../lib/panama-replenishment';
import { formatPanamaReceiptDate, purchaseRead, type WarehouseStock } from '../../lib/purchasing-api';

const field = 'mt-1 min-w-0 w-full rounded-lg border border-slate-400 bg-white p-2 text-base';
const label = 'block min-w-0 text-sm';
const primary = 'min-h-11 rounded-lg bg-[#162252] px-4 text-sm font-semibold text-white disabled:opacity-50';
const dateLabel = (date: string) => date.split('-').reverse().join('/');

function sourceOrderName(item: { number?: string; folio?: string }) {
  return item.number ? 'OC ' + item.number : item.folio || 'OC';
}

export default function PanamaReplenishment({ partNumber, warehouse, measure }: Pick<WarehouseStock, 'partNumber' | 'warehouse' | 'measure'>) {
  const [snapshot, setSnapshot] = useState<{ input: ReplenishmentInput; source: ReplenishmentSource }>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const current = useRef<AbortController | null>(null);
  useEffect(() => () => current.current?.abort(), []);

  function invalidate() {
    current.current?.abort();
    current.current = null;
    setLoading(false);
    setSnapshot(undefined);
    setError('');
  }

  async function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (current.current) return;
    const values = new FormData(event.currentTarget);
    const value = (key: string) => String(values.get(key) ?? '').trim();
    const input: ReplenishmentInput = {
      unit: value('unit').toUpperCase(), life: value('life'), lifeMeasure: value('lifeMeasure'), dailyUse: value('dailyUse'),
      readingDate: value('readingDate'), lifeReference: value('lifeReference'), quantity: value('quantity'),
      leadDays: value('leadDays'), leadReference: value('leadReference'),
    };
    const abort = new AbortController();
    current.current = abort;
    setLoading(true);
    setError('');
    setSnapshot(undefined);
    try {
      const source = await purchaseRead<ReplenishmentSource>('inventory-replenishment', { partNumber, warehouse, unit: input.unit }, abort.signal);
      if (!abort.signal.aborted) setSnapshot({ source, input });
    } catch (cause) {
      if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : 'No se pudo verificar el saldo.');
    } finally {
      if (current.current === abort) {
        current.current = null;
        setLoading(false);
      }
    }
  }

  const result = snapshot ? calculateReplenishment(snapshot.source, snapshot.input) : undefined;
  return <details className="rounded-lg border border-border bg-slate-50 p-3">
    <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Calcular reposición</summary>
    <form onChange={invalidate} onSubmit={event => void calculate(event)} aria-label="Reposición crítica" className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className={label}>Unidad
          <input className={field} name="unit" required maxLength={48} autoCapitalize="characters" />
        </label>
        <label className={label}>Fecha de lectura
          <input className={field} type="date" name="readingDate" required />
        </label>
        <label className={label}>Vida restante
          <input className={field} name="life" inputMode="decimal" maxLength={16} required />
        </label>
        <label className={label}>Medida de vida
          <select className={field} name="lifeMeasure" required defaultValue="">
            <option value="">Selecciona</option><option value="h">Horas</option><option value="km">Kilómetros</option>
          </select>
        </label>
        <label className={label}>Uso diario
          <input className={field} name="dailyUse" inputMode="decimal" maxLength={16} required />
          <span className="text-xs text-text-secondary">Promedio por día calendario en la misma medida.</span>
        </label>
        <label className={label}>Cantidad para el cambio
          <input className={field} name="quantity" inputMode="decimal" maxLength={16} required />
          {measure && <span className="text-xs text-text-secondary">Medida del catálogo · {measure}</span>}
        </label>
        <label className={label + ' sm:col-span-2'}>Respaldo de vida y uso
          <input className={field} name="lifeReference" placeholder="Inspección y plan de uso" maxLength={180} required />
        </label>
        <label className={label}>Plazo de proveedor (días)
          <input className={field} name="leadDays" inputMode="numeric" maxLength={4} required />
        </label>
        <label className={label}>Respaldo del plazo
          <input className={field} name="leadReference" placeholder="Cotización o confirmación vigente" maxLength={180} required />
        </label>
      </div>
      <button type="submit" className={primary} disabled={loading}>{loading ? 'Verificando fuentes…' : 'Calcular'}</button>
    </form>
    {error && <p role="alert" className="mt-3 text-sm text-critical">{error}</p>}
    {snapshot && <section aria-label="Resultado de reposición" className="mt-3 space-y-2 border-t border-border pt-3 text-sm" aria-live="polite">
      <p className="text-text-secondary">Catálogo y movimientos del almacén · consulta {formatPanamaReceiptDate(snapshot.source.readAt)}</p>
      {snapshot.source.issues.map((issue, i) => <p key={i} className="break-words text-critical">{sourceOrderName(issue)} · {issue.reason}</p>)}
      {snapshot.source.openOrders.length > 0 && <ul aria-label="Órdenes abiertas del SKU" className="divide-y divide-border">
        {snapshot.source.openOrders.map(order => <li key={order.folio + order.lineId} className="break-words py-1">
          {sourceOrderName(order)} · Saldo {order.remaining}, en tránsito {order.inTransit}
          {order.due ? ' · Entrega registrada ' + dateLabel(order.due) : ' · Entrega por confirmar'}
          {order.due && order.due < snapshot.source.today && ' · Fecha vencida'}
        </li>)}
      </ul>}
      {result && 'error' in result && <p role="alert" className="font-medium text-critical">{result.error}</p>}
      {result && !('error' in result) && <>
        <dl aria-label="Cálculo de reposición" className="grid grid-cols-2 gap-2">
          {([['Disponible neto', snapshot.source.stock.available], ['Cambio y mínimo', result.needed],
            ['OC a tiempo', result.timely], ['Saldo de OC posterior', result.late], ['Faltante a la fecha', result.gap],
            ['Adelantar de OC abiertas', result.expedite], ['Reposición adicional', result.additional]] as const).map(([name, amount]) => (
            <div key={name} className="min-w-0 rounded-lg bg-white p-2"><dt className="text-text-secondary">{name}</dt>
              <dd className="break-words font-semibold">{amount} {snapshot.source.stock.measure}</dd></div>
          ))}
        </dl>
        <p>Consumo de vida estimado · {dateLabel(result.needDate)}{result.needDate !== result.coverageDate && ' (vencido)'}</p>
        {result.additional !== '0' && <p>Fecha límite según el plazo · {dateLabel(result.orderBy)}
          {result.leadRisk && ' · El plazo normal ya no alcanza'}</p>}
        <p className="break-words text-text-secondary">{snapshot.input.unit} · Lectura {dateLabel(snapshot.input.readingDate)}
          {' · '}{snapshot.input.life} {snapshot.input.lifeMeasure} restantes ÷ {snapshot.input.dailyUse} {snapshot.input.lifeMeasure}/día
          {' · '}{snapshot.input.lifeReference}</p>
        <p className="break-words text-text-secondary">Plazo · {snapshot.input.leadDays} días calendario · {snapshot.input.leadReference}</p>
        <p className="text-text-secondary">Cambio {snapshot.input.quantity} + mínimo {snapshot.source.stock.minimum} − disponible {snapshot.source.stock.available}
          {' − OC a tiempo '}{result.timely}. Del faltante, {result.expedite} se cubren si se adelantan las OC pendientes.</p>
      </>}
    </section>}
  </details>;
}
