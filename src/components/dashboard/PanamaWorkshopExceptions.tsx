import { Link } from 'react-router-dom';
import type { WorkshopExceptionView } from '../../lib/panama-workshop-exceptions';

const labels = { critical: 'OT crítica', parts: 'Esperando repuesto', return: 'Retorno pendiente', assignment: 'OT sin asignar' };
const cutoff = new Intl.DateTimeFormat('es-PA', { timeZone: 'America/Panama', dateStyle: 'short', timeStyle: 'short' });
const hours = new Intl.NumberFormat('es-PA', { maximumFractionDigits: 3 });

export function PanamaWorkshopExceptions({ view, loading, unavailable, refresh }: {
  view?: WorkshopExceptionView;
  loading: boolean;
  unavailable: boolean;
  refresh: () => Promise<void>;
}) {
  return (
    <section aria-labelledby="panama-workshop-exceptions" className="min-w-0 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="panama-workshop-exceptions" className="text-sm font-semibold text-text">Excepciones de Taller</h3>
        <button type="button" onClick={refresh} disabled={loading}
          className="min-h-11 rounded-lg border border-border px-3 text-sm font-semibold text-text disabled:opacity-50">
          Actualizar excepciones
        </button>
      </div>
      <div className="my-1 text-sm" role="status">
        {loading && <p className="text-text-secondary">Buscando avisos…</p>}
        {unavailable && <p className="text-amber-900">{view ? 'Consulta sin confirmar. Se conservan los avisos previos.' : 'Excepciones sin verificar.'}</p>}
        {view?.unconfirmed && <p className="text-amber-900">Hay órdenes por confirmar.</p>}
        {view && !view.alerts.length && !view.unconfirmed && !loading && !unavailable &&
          <p className="text-text-secondary">Sin avisos de Taller.</p>}
      </div>
      {view && <details className="text-xs text-text-secondary">
        <summary className="cursor-pointer">Última consulta</summary>
        <p>Hermes · <time dateTime={view.observedAt}>{cutoff.format(new Date(view.observedAt))}</time> · Panamá</p>
      </details>}
      {view && view.alerts.length > 0 && (
        <ul aria-label="Avisos de Taller" className="mt-3 grid gap-3 xl:grid-cols-2">
          {view.alerts.map(alert => (
            <li key={JSON.stringify([alert.unit, alert.id])} className="min-w-0 break-words rounded-lg border border-border px-3 pb-2 text-sm">
              <Link to={`/workorders/${encodeURIComponent(alert.id)}`}
                className="flex min-h-11 items-center gap-2 font-semibold text-blue-800 underline underline-offset-2">
                {alert.folio} · {alert.unit}
              </Link>
              <p className="font-semibold text-text">{labels[alert.kind]} · {alert.status}</p>
              {alert.description && <p className="text-text-secondary">{alert.description}</p>}
              {alert.pendingConfirmation && <p className="text-amber-900">Estado sin confirmar en la última consulta.</p>}
              <dl className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                <div><dt className="inline font-semibold">Responsable</dt> <dd className="inline text-text-secondary">
                  {alert.owner ?? (alert.kind === 'return' ? 'Operaciones · persona sin confirmar' : 'Sin confirmar')}
                </dd></div>
                <div><dt className="inline font-semibold">Vencimiento</dt> <dd className="inline text-text-secondary">
                  {alert.dueHours === null ? 'Sin confirmar' : `${hours.format(alert.dueHours)} h de horómetro`}
                </dd></div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
