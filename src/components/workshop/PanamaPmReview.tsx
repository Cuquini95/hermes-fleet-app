import { useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { PANAMA_PM_MASTER_URL } from '../../lib/panama-maintenance';
import { pmReviewCsv, type PmReview, type PmReviewRow } from '../../lib/panama-pm-review';
import { usePanamaPmReview } from '../../hooks/usePanamaPmReview';
import { downloadBlob } from '../../lib/download-blob';

const action = 'inline-flex min-h-11 items-center font-semibold text-blue-800 underline disabled:opacity-50';
const sourceNames: Record<string, string> = { fleet: 'Flota', maintenance: 'PM FLOTA', maintenancePlan: 'Planes PM', equipmentDetails: 'Maestro de Equipos' };
function cutDate(value: string | null) {
  return value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString('es-PA', { timeZone: 'America/Panama', dateStyle: 'short', timeStyle: 'short' })
    : 'Sin fecha';
}

function PlanRow({ row, data }: { row: PmReviewRow; data: PmReview }) {
  const [primaryIssue, ...otherIssues] = row.issues;
  const title = [`Revisión PM de ${row.unit}`, row.model, primaryIssue?.label ?? 'Sin pendientes',
    otherIssues.length ? `${otherIssues.length} más` : ''].filter(Boolean).join(' · ');
  return <details className="rescue-pm-row">
    <summary aria-label={title}>
      <span className="rescue-pm-row-title"><b>{row.unit}</b>{row.model && <span>{row.model}</span>}</span>
      <span className="rescue-pm-row-state">
        <span className={`rescue-order-badge ${primaryIssue ? 'media' : 'rescue-badge-ok'}`}>{primaryIssue?.label ?? 'Sin pendientes'}</span>
        {otherIssues.length > 0 && <span className="rescue-pm-more">+{otherIssues.length}</span>}
      </span>
      <ChevronRight className="rescue-pm-chevron" size={17} aria-hidden />
    </summary>
    <div className="space-y-3 border-t border-border px-3 py-3 text-sm">
      <dl className="grid grid-cols-2 gap-2 break-words text-xs">
        <div><dt className="text-text-secondary">Modelo</dt><dd>{row.equipmentModel || row.model || 'Sin dato'}</dd></div>
        <div><dt className="text-text-secondary">Serie</dt><dd>{row.serial ?? 'Sin dato'}</dd></div>
        <div><dt className="text-text-secondary">Aprobación</dt><dd>{row.approved ? 'Registrada' : 'Pendiente'}</dd></div>
        {row.intervals.length > 0 && <div><dt className="text-text-secondary">Intervalos</dt><dd>{row.intervals.join(' / ')} h</dd></div>}
        {row.revision && <div><dt className="text-text-secondary">Revisión del checklist</dt><dd>{row.revision}</dd></div>}
      </dl>
      {row.issues.length > 0 && <ul className="space-y-2 text-xs" aria-label={`Pendientes de ${row.unit}`}>
        {row.issues.map(issue => <li key={issue.code} className="break-words"><b className="text-amber-900">{issue.label}</b><p className="text-text-secondary">{issue.action}</p></li>)}
      </ul>}
      <details className="text-xs text-text-secondary">
        <summary className="min-h-11 cursor-pointer py-3 font-medium">Cortes</summary>
        <p>Plan · {cutDate(data.sources.maintenancePlan?.capturedAt ?? null)}</p>
        <p>Equipo · {cutDate(data.sources.equipmentDetails?.capturedAt ?? null)}</p>
        <p>Catálogo · {cutDate(data.catalog.capturedAt)}</p>
      </details>
      {row.checklist && <a href={row.checklist} target="_blank" rel="noreferrer" className={action}>Checklist</a>}
    </div>
  </details>;
}

export default function PanamaPmReview({ reload, unit }: { reload: number; unit?: string }) {
  const [search, setSearch] = useState(unit ?? '');
  const [pendingOnly, setPendingOnly] = useState(true);
  const { data, error, loading } = usePanamaPmReview(reload);

  const pending = data?.rows.filter(row => row.issues.length).length ?? 0;
  const query = search.trim().toLocaleLowerCase('es-PA');
  const rows = data?.rows.filter(row => (!pendingOnly || row.issues.length > 0)
    && (unit && search === unit ? row.unit.toUpperCase() === unit.toUpperCase()
      : `${row.unit} ${row.model} ${row.serial ?? ''}`.toLocaleLowerCase('es-PA').includes(query)));
  const missing = data && [...Object.entries(data.sources).filter(([, source]) => !source.available).map(([name]) => sourceNames[name] ?? name),
    ...(!data.catalog.available ? ['Catálogo de checklists'] : [])];

  return <section aria-label="Revisión de planes PM" className="min-w-0 space-y-2">
    {loading && <p role="status" className="text-sm">Consultando PM…</p>}
    {error && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm">{error}</p>}
    {data && <>
      {missing && missing.length > 0 && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Datos parciales · {missing.join(', ')}</p>}
      <div className="rescue-pm-tools">
        <label className="rescue-compact-search"><Search size={16} aria-hidden />
          <input aria-label="Buscar equipo, modelo o serie" placeholder="Buscar equipo" value={search} onChange={event => setSearch(event.target.value)} type="search" />
        </label>
        <details className="rescue-pm-menu">
          <summary className="rescue-secondary" aria-label="Fuentes y CSV">Fuentes</summary>
          <div>
            {PANAMA_PM_MASTER_URL && <a className={action} href={PANAMA_PM_MASTER_URL} target="_blank" rel="noreferrer">Maestro PM</a>}
            <button type="button" className={action} aria-label="Descargar revisión completa" disabled={!data.rows.length}
              onClick={() => downloadBlob(new Blob([pmReviewCsv(data)], { type: 'text/csv;charset=utf-8' }), 'Hermes-Panama-Revision-PM.csv')}>Descargar CSV</button>
          </div>
        </details>
      </div>
      <label className="rescue-pm-pending">
        <input aria-label="Solo pendientes" type="checkbox" checked={pendingOnly} onChange={event => setPendingOnly(event.target.checked)} />
        <span>{pending} {pending === 1 ? 'pendiente' : 'pendientes'}</span>
      </label>
      <p role="status" className="sr-only">{rows?.length ?? 0} de {data.rows.length} equipos</p>
      {rows?.length ? <div className="grid items-start gap-2 sm:grid-cols-2">
        {rows.map(row => <PlanRow key={row.unit} row={row} data={data} />)}
      </div> : <p className="rounded-xl border border-border bg-white p-3 text-sm">{query ? 'Sin coincidencias' : pendingOnly && data.rows.length ? 'Sin pendientes' : 'Sin equipos'}</p>}
    </>}
  </section>;
}
