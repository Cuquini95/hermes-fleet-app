import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';

const sources = {
  failures: { title: 'Fallas del maestro TMF', fields: [['description', 'Falla'], ['status', 'Estado'], ['last', 'Último reporte'], ['order', 'OT vinculada']] },
  orders: { title: 'Órdenes del maestro de Taller', fields: [['description', 'Trabajo'], ['status', 'Estado'], ['check', 'Control de integridad']] },
  purchases: { title: 'Compras del maestro de Panamá', fields: [['description', 'Compra'], ['status', 'Estado'], ['amount', 'Monto registrado'], ['order', 'OC'], ['check', 'Recepción']] },
} as const;

type Source = keyof typeof sources;
type RecordRow = Record<string, string | undefined> & { unit: string };
type Result = { rows: RecordRow[] | null; capturedAt?: string };

export default function PanamaSourceRecords({ source, search = '', limit }: { source: Source; search?: string; limit?: number }) {
  const project = useAuthStore(state => state.project);
  const userId = useAuthStore(state => state.userId);
  const [load, setLoad] = useState<{ userId: typeof userId; source: Source; result: Result }>();
  const result = load?.userId === userId && load?.source === source ? load.result : undefined;

  useEffect(() => {
    if (project !== 'tmf-panama') return;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]);
    fetch(`/hermes-api/api/panama/summary?sections=${source}`, { cache: 'no-store', credentials: 'same-origin', signal })
      .then(async response => {
        if (!response.ok) throw new Error('Maestro no disponible');
        const data = await response.json();
        if (data.project !== 'tmf-panama') throw new Error('Proyecto incorrecto');
        const rows = data.sections?.[source];
        if (!controller.signal.aborted) setLoad({ userId, source, result: { rows: Array.isArray(rows) ? rows : null, capturedAt: data.snapshots?.[source] } });
      })
      .catch(() => { if (!controller.signal.aborted) setLoad({ userId, source, result: { rows: null } }); });
    return () => controller.abort();
  }, [project, source, userId]);

  if (project !== 'tmf-panama') return null;
  const { title, fields } = sources[source];
  const searchTerm = search.trim().toLocaleLowerCase('es-PA');
  const rows = result?.rows?.filter(row => Object.values(row).some(value => value?.toLocaleLowerCase('es-PA').includes(searchTerm)));
  return (
    <section className="min-w-0 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-text">{title}</h2>
        <Link to="/panama" className="text-sm font-medium text-blue-800 underline">Maestros TMF</Link>
      </div>
      {result?.capturedAt && (
        <p className="mt-1 text-xs text-text-secondary">Corte del {new Date(result.capturedAt).toLocaleString('es-PA', { timeZone: 'America/Panama', dateStyle: 'short', timeStyle: 'short' })} · hora de Panamá</p>
      )}
      {!result && <p className="mt-2 text-sm text-text-secondary" role="status">Consultando el maestro…</p>}
      {result?.rows === null && <p className="mt-2 text-sm text-amber-900">Maestro no disponible.</p>}
      {rows?.length === 0 && <p className="mt-2 text-sm text-text-secondary">{searchTerm ? 'Sin resultados para tu búsqueda.' : 'Sin registros en el maestro consultado.'}</p>}
      {rows && rows.length > 0 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {rows.slice(0, limit ?? rows.length).map((row, index) => (
            <li key={`${row.id ?? row.unit}-${index}`} className="min-w-0 rounded-lg border border-border p-3 text-sm">
              <p className="font-semibold text-text">{row.unit}{row.id && <span className="ml-2 break-words text-text-secondary">{row.id}</span>}</p>
              <dl className="mt-1 space-y-1 text-text-secondary">
                {fields.map(([field, label]) => row[field] && (
                  <div key={field} className="break-words">
                    <dt className="inline font-semibold">{label} </dt>
                    <dd className="inline">{row[field]}{field === 'amount' && row.currency ? ` ${row.currency}` : ''}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
