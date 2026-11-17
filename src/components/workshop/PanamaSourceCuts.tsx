import { useEffect, useState } from 'react';

type Cut = { key: string; label: string; capturedAt: string | null; status: 'latest' | 'previous' | 'missing' };
const labels = { latest: 'Último corte publicado', previous: 'Corte anterior conservado', missing: 'Sin corte publicado' };
const formatCut = new Intl.DateTimeFormat('es-PA', { timeZone: 'America/Panama', dateStyle: 'medium', timeStyle: 'short' });

export default function PanamaSourceCuts({ reload }: { reload: number }) {
  const [open, setOpen] = useState(false);
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setStatus('loading');
    fetch('/hermes-api/api/panama/cortes', { signal: controller.signal, cache: 'no-store', credentials: 'same-origin' })
      .then(async response => {
        if ((response.status === 401 || response.status === 403) && !controller.signal.aborted) setCuts([]);
        if (!response.ok) throw new Error('Cortes no disponibles');
        const data = await response.json();
        if (data.project !== 'tmf-panama' || !Array.isArray(data.sources) || data.sources.length !== 16) throw new Error('Cortes no válidos');
        if (!controller.signal.aborted) {
          setCuts(data.sources);
          setStatus('ready');
        }
      })
      .catch(() => { if (!controller.signal.aborted) setStatus('unavailable'); });
    return () => controller.abort();
  }, [open, reload]);

  return (
    <details className="my-4 rounded-2xl border border-slate-200 bg-white p-4"
      onToggle={event => setOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer text-sm font-semibold text-slate-900">Cortes de los 16 maestros</summary>
      <div className="mt-3 text-sm">
        {status === 'loading' && <p role="status">Consultando fechas de corte…</p>}
        {status === 'unavailable' && <p role="status" className="text-amber-800">
          {cuts.length ? 'Consulta no disponible. Se muestran las fechas verificadas anteriormente.' : 'No se pudieron consultar las fechas de corte.'}
        </p>}
        {cuts.length > 0 && (
          <ul aria-label="Estado de cortes publicados" className="divide-y divide-slate-100">
            {cuts.map(cut => (
              <li key={cut.key} className="flex flex-wrap justify-between gap-x-3 py-2">
                <span className="font-medium">{cut.label}</span>
                <span className={cut.status === 'latest' ? 'text-slate-600' : 'text-amber-800'}>
                  {labels[cut.status]}{cut.capturedAt && Number.isFinite(Date.parse(cut.capturedAt))
                    ? ` · ${formatCut.format(new Date(cut.capturedAt))} · Panamá` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
