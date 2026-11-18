import { useEffect, useState } from 'react';
import { PANAMA_PM_MASTER_URL } from '../../lib/panama-maintenance';
import { pmReviewCsv, type PmReview } from '../../lib/panama-pm-review';
import { downloadBlob } from '../../lib/download-blob';

const action = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-white px-3 text-sm font-semibold disabled:opacity-50';
const sourceNames: Record<string, string> = { fleet: 'Flota', maintenance: 'PM FLOTA', maintenancePlan: 'Planes PM', equipmentDetails: 'Maestro de Equipos' };
function cutDate(value: string | null) {
  return value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString('es-PA', { timeZone: 'America/Panama', dateStyle: 'short', timeStyle: 'short' })
    : 'Sin fecha de corte';
}

export default function PanamaPmReview({ reload }: { reload: number }) {
  const [request, setRequest] = useState(0);
  const [reply, setReply] = useState<{ key: string; data: PmReview | null; error: string } | null>(null);
  const [search, setSearch] = useState('');
  const [pendingOnly, setPendingOnly] = useState(true);
  const key = `${reload}/${request}`;
  // A new request hides the previous result immediately, before the effect runs.
  const data = reply?.key === key ? reply.data : null;
  const error = reply?.key === key ? reply.error : '';
  const loading = reply?.key !== key;

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/hermes-api/api/panama/pm-review', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result?.error || 'No se pudo consultar la revisión PM.');
        if (result?.project !== 'tmf-panama' || !Array.isArray(result.rows) || !result.sources || !result.catalog) {
          throw new Error('No se pudo verificar la respuesta PM.');
        }
        if (!controller.signal.aborted) setReply({ key, data: result as PmReview, error: '' });
      })
      .catch(cause => { if (!controller.signal.aborted) setReply({ key, data: null,
        error: cause instanceof Error ? cause.message : 'Revisión no disponible.' }); });
    return () => controller.abort();
  }, [key]);

  const pending = data?.rows.filter(row => row.issues.length).length ?? 0;
  const query = search.trim().toLocaleLowerCase('es-PA');
  const rows = data?.rows.filter(row => (!pendingOnly || row.issues.length > 0)
    && `${row.unit} ${row.model} ${row.serial ?? ''}`.toLocaleLowerCase('es-PA').includes(query));
  const missing = data && [...Object.entries(data.sources).filter(([, source]) => !source.available).map(([name]) => sourceNames[name] ?? name),
    ...(!data.catalog.available ? ['Catálogo de checklists'] : [])];

  return <section aria-label="Revisión de planes PM" className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-bold text-text">Revisión de planes PM</h2>
      <button type="button" className={action} disabled={loading} onClick={() => setRequest(value => value + 1)}>Actualizar revisión</button>
    </div>
    <p className="text-sm text-text-secondary">Revisa cada pendiente con Taller, corrige el maestro y actualiza esta lista.</p>
    {loading && <p role="status" className="text-sm">Consultando planes e identidad…</p>}
    {error && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm">{error}</p>}
    {data && <>
      {missing && missing.length > 0 && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm">Revisión parcial. No disponible: {missing.join(', ')}. La lista puede estar incompleta.</p>}
      <p role="status" className="text-sm font-semibold">{pending} {pending === 1 ? 'equipo por revisar' : 'equipos por revisar'} · {data.rows.length} {data.rows.length === 1 ? 'consultado' : 'consultados'}</p>
      <div className="flex flex-wrap gap-2">
        {PANAMA_PM_MASTER_URL && <a className={action} href={PANAMA_PM_MASTER_URL} target="_blank" rel="noreferrer">Abrir maestro PM</a>}
        <button type="button" className={action} disabled={!data.rows.length}
          onClick={() => downloadBlob(new Blob([pmReviewCsv(data)], { type: 'text/csv;charset=utf-8' }), 'Hermes-Panama-Revision-PM.csv')}>Descargar revisión completa</button>
      </div>
      <label className="block text-sm font-medium">Buscar equipo, modelo o serie
        <input className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-border bg-white px-3" value={search} onChange={event => setSearch(event.target.value)} type="search" />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={pendingOnly} onChange={event => setPendingOnly(event.target.checked)} />Solo pendientes</label>
      {!rows?.length && <p className="rounded-xl border border-border bg-white p-3 text-sm">{data.rows.length ? 'Sin equipos para este filtro.' : 'Sin equipos consultables. Verifica el alcance y las fuentes de tu cuenta.'}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {rows?.map(row => <article key={row.unit} className="min-w-0 rounded-xl border border-border bg-white p-4">
          <h3 className="break-words font-bold">{row.unit} · {row.model || 'Modelo por verificar'}</h3>
          <p className="mt-1 break-words text-sm">Serie · {row.serial ?? 'Por verificar'}</p>
          <p className="mt-1 text-sm">Aprobación en maestro · {row.approved ? 'Registrada' : 'Pendiente'}</p>
          {row.issues.length ? <ul className="mt-2 space-y-3 text-sm" aria-label={`Pendientes de ${row.unit}`}>
            {row.issues.map(issue => <li key={issue.code} className="break-words"><p className="font-semibold text-amber-900">{issue.label}</p><p className="mt-1 text-text-secondary">{issue.action}</p></li>)}
          </ul> : <p className="mt-2 text-sm">Sin pendientes detectados. Conservar la revisión técnica vigente.</p>}
          <details className="mt-2 break-words text-xs text-text-secondary">
            <summary className="min-h-11 cursor-pointer py-3 font-medium">Datos de la revisión</summary>
            <p>Modelo del equipo · {row.equipmentModel || 'Sin dato'}</p>
            <p>Intervalos · {row.intervals.length ? `${row.intervals.join(' / ')} h` : 'Por verificar'}</p>
            <p>Revisión del checklist · {row.revision ?? 'Sin dato'}</p>
            <p>Plan · {cutDate(data.sources.maintenancePlan?.capturedAt ?? null)} · Panamá</p>
            <p>Identidad · {cutDate(data.sources.equipmentDetails?.capturedAt ?? null)} · Panamá</p>
            <p>Catálogo · {cutDate(data.catalog.capturedAt)} · Panamá</p>
            {row.checklist && <a href={row.checklist} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center font-semibold underline">Abrir checklist del modelo</a>}
          </details>
        </article>)}
      </div>
    </>}
  </section>;
}
