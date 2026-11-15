import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { purchaseRead, displayMoney } from '../../lib/purchasing-api';

const labels = { labor: 'Mano de obra', parts: 'Repuestos', returns: 'Devoluciones', services: 'Servicios externos' };
type CostKind = keyof typeof labels;
interface OrderCosts {
  totals: (Record<CostKind, string> & { currency: string; amount: string })[];
  lines: { kind: CostKind; currency: string; amount: string; reference: string; sourceId: string; valuationReference?: string }[];
  pending: { kind: CostKind; reason: string }[];
}

export default function PanamaWorkOrderCost({ ot, folio, unit, revision }: { ot: string; folio: string; unit: string; revision: number }) {
  const [attempt, setAttempt] = useState(0);
  const requestKey = JSON.stringify([ot, revision, attempt]);
  const [result, setResult] = useState<{ key: string; data?: OrderCosts; error?: string }>();
  const current = result?.key === requestKey ? result : undefined;
  const hasPending = Boolean(current?.data?.pending.length);

  useEffect(() => {
    const abort = new AbortController();
    purchaseRead<OrderCosts>('workorder-cost', { ot }, abort.signal)
      .then(data => { if (!abort.signal.aborted) setResult({ key: requestKey, data }); })
      .catch(() => { if (!abort.signal.aborted) setResult({ key: requestKey, error: 'No se pudieron consultar los costos de esta OT.' }); });
    return () => abort.abort();
  }, [ot, requestKey]);

  return <section aria-label="Costo real de OT" className="space-y-3 rounded-xl border border-border bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold">Costo real de OT</h2>
      <button type="button" className="min-h-11 text-sm underline" onClick={() => setAttempt(n => n + 1)}>Actualizar costos</button>
    </div>
    {!current && <p role="status" className="text-sm text-text-secondary">Consultando costos…</p>}
    {current?.error && <p role="alert" className="text-sm text-red-700">{current.error}</p>}
    {current?.data && <>
      {current.data.totals.length === 0 && <p className="text-sm text-text-secondary">Sin importes conciliados.</p>}
      {current.data.totals.map(total => <div className="rounded-lg bg-slate-50 p-3" key={total.currency}>
        <p className="break-words font-semibold">{hasPending ? 'Subtotal conciliado' : 'Total documentado'} {displayMoney(total.amount, total.currency)}</p>
        <dl className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-sm">
          {(Object.keys(labels) as CostKind[]).map(kind => <div className="contents" key={kind}>
            <dt>{labels[kind]}</dt><dd className="text-right tabular-nums">{displayMoney(total[kind], total.currency)}</dd>
          </div>)}
        </dl>
      </div>)}
      {current.data.pending.length > 0 && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
        <h3 className="font-semibold">Pendiente de conciliar</h3>
        <ul className="mt-1 space-y-1">{current.data.pending.map(({ kind, reason }) => <li key={kind + reason}>{labels[kind]} · {reason}</li>)}</ul>
      </div>}
      {current.data.lines.length > 0 && <details>
        <summary className="min-h-11 cursor-pointer text-sm font-semibold leading-[2.75rem]">Ver soportes</summary>
        <ul className="space-y-2 text-sm">{current.data.lines.map((line) => <li key={`${line.kind}:${line.sourceId}`} className="break-words">
          {labels[line.kind]} · {line.reference} · {displayMoney(line.amount, line.currency)}
          {line.valuationReference && <span className="block text-xs text-text-secondary">Valuación {line.valuationReference}</span>}
        </li>)}</ul>
      </details>}
    </>}
    <Link className="inline-flex min-h-11 items-center text-sm font-semibold underline" to={`/gastos/nuevo?${new URLSearchParams({ ot: folio, unit })}`}>
      Registrar factura de servicio
    </Link>
  </section>;
}
