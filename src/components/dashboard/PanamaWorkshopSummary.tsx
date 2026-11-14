import type { WorkshopRecord, WorkshopSummary } from '../../hooks/useFleetDispatch';

const localCut = new Intl.DateTimeFormat('es-PA', {
  timeZone: 'America/Panama', day: 'numeric', month: 'short', year: 'numeric',
  hour: 'numeric', minute: '2-digit',
});

function WorkshopRows({ records }: { records: WorkshopRecord[] }) {
  return (
    <ul className="mt-1 space-y-2 text-sm">
      {records.map((record, index) => (
        <li key={`${record.source}-${record.id}-${record.unit}-${index}`} className="break-words">
          <p className="font-medium">{record.id ? `${record.id} · ` : ''}{record.unit}</p>
          <p className="flex flex-wrap gap-x-3 text-text-secondary">
            <span>{record.source === 'master' ? 'Maestro' : 'Hermes'}: {record.status || 'Sin verificar'}</span>
            {record.operationalStatus !== undefined && record.source === 'master' && (
              <span>Hermes: {record.operationalStatus || 'Sin verificar'}</span>
            )}
            {record.needsReview && <span className="font-semibold text-amber-800">Por conciliar</span>}
          </p>
        </li>
      ))}
    </ul>
  );
}

export default function PanamaWorkshopSummary({ data, loading, card = false }: {
  data?: WorkshopSummary;
  loading: boolean;
  card?: boolean;
}) {
  const sections = [
    { label: 'Averías', section: data?.failures },
    { label: 'Órdenes de trabajo', section: data?.orders },
  ];
  const failureCut = data?.failures.capturedAt;
  const sharedCut = failureCut && failureCut === data?.orders.capturedAt && Number.isFinite(Date.parse(failureCut))
    ? failureCut : undefined;
  const unverified = 'Sin verificar';

  return (
    <section aria-label="Maestro de Taller" className={card ? 'rounded-xl border border-border bg-card p-4' : ''}>
      <h3 className="font-semibold text-sm text-text">Maestro de Taller</h3>
      {!data ? (
        <p className="mt-1 text-sm text-text-secondary">{loading ? 'Consultando el Maestro de Taller…' : 'Maestro de Taller sin verificar.'}</p>
      ) : (
        <>
          <div className="mt-1 flex flex-wrap gap-x-4 text-sm text-text-secondary">
            <span>Averías hoy: {data.alertsToday ?? unverified}</span>
            <span>OTs abiertas: {data.openOrders ?? unverified}</span>
            <span>OTs críticas: {data.criticalOTs ?? unverified}</span>
          </div>
          {sharedCut && <p className="mt-1 text-xs text-text-secondary">
            Corte del Maestro de Taller: {localCut.format(new Date(sharedCut))} · Panamá
          </p>}
          {sections.map(({ label, section }) => {
            if (!section) return null;
            const conflicts = section.records.filter(row => row.needsReview);
            return (
              <div key={label} className="mt-2">
                {!sharedCut && section.capturedAt && Number.isFinite(Date.parse(section.capturedAt)) && (
                  <p className="text-xs text-text-secondary">{label} · corte {localCut.format(new Date(section.capturedAt))} · Panamá</p>
                )}
                {!section.masterAvailable && <p className="text-sm text-amber-800">{label}: Maestro sin verificar.</p>}
                {!section.operationalAvailable && <p className="text-sm text-amber-800">{label}: comparación con Hermes sin verificar.</p>}
                {conflicts.length > 0 && <WorkshopRows records={conflicts} />}
                {section.records.length > conflicts.length && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-text-secondary">Ver {label.toLowerCase()}</summary>
                    <WorkshopRows records={section.records.filter(row => !row.needsReview)} />
                  </details>
                )}
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}
