import { useEffect, useState, type FormEvent } from 'react';
import { ExternalLink } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { hermesApiUrl } from '../../lib/hermes-api-base';
import { useAuthStore } from '../../stores/auth-store';

interface TechnicalDocument {
  kind: 'manual' | 'diagram';
  title: string;
  model: string;
  source: string;
  revision?: string;
  url: string;
}

export default function PanamaTechnicalLibrary({ kind }: { kind: TechnicalDocument['kind'] }) {
  const [params] = useSearchParams();
  const unit = params.get('unit');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState({ query: '', revision: 0 });
  const userId = useAuthStore(auth => auth.userId);
  const scope = JSON.stringify([kind, unit, userId, search]);
  const [result, setResult] = useState<{ scope: string; state: 'ready' | 'unavailable'; records: TechnicalDocument[] }>();
  const state = result?.scope === scope ? result.state : 'loading';
  const records = result?.scope === scope ? result.records : [];

  useEffect(() => {
    const controller = new AbortController();
    const queryParams = new URLSearchParams({ kind, q: search.query });
    if (unit) queryParams.set('unit', unit);
    fetch(hermesApiUrl('/api/panama/documentos-tecnicos?' + queryParams), {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    }).then(async res => {
      if (!res.ok) throw new Error('Biblioteca no disponible');
      const { documents } = await res.json();
      if (!Array.isArray(documents)) throw new Error('Respuesta no válida');
      if (!controller.signal.aborted) {
        setResult({ scope, state: 'ready', records: documents });
      }
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ scope, state: 'unavailable', records: [] });
    });
    return () => controller.abort();
  }, [kind, search, unit, scope]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(previous => ({ query: query.trim(), revision: previous.revision + 1 }));
  }

  const title = kind === 'manual' ? 'Manuales técnicos' : 'Diagramas técnicos';
  return (
    <section className="space-y-4 py-4">
      <h1 className="text-lg font-semibold text-navy">{title}</h1>
      {unit && <p className="text-sm text-slate-600">Unidad: {unit}</p>}
      <form onSubmit={submit} className="space-y-2">
        <label className="block text-sm font-medium">
          Modelo o documento
          <input type="search" value={query} maxLength={120} onChange={event => setQuery(event.target.value)}
            className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3" placeholder="Ej. D155AX-6" />
        </label>
        <button type="submit" className="min-h-12 rounded-xl bg-blue-900 px-4 text-sm font-semibold text-white">
          Buscar
        </button>
      </form>
      {state === 'loading' && <p role="status">Consultando biblioteca…</p>}
      {state === 'unavailable' && <p role="alert">Biblioteca no disponible. Solicita el documento vigente a Taller.</p>}
      {state === 'ready' && records.length === 0 && <p role="status">Sin documentos para esta búsqueda.</p>}
      {state === 'ready' && records.length > 0 && (
        <ul className="space-y-2">
          {records.map(record => (
            <li key={record.url} className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="font-semibold text-navy">{record.title}</p>
              <p className="text-sm text-slate-600">{record.model} · {record.source}</p>
              <p className="text-sm text-slate-600">{record.revision ? `Revisión ${record.revision}` : 'Revisión no registrada'}</p>
              <a href={record.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center gap-2 text-sm font-semibold text-blue-800 underline">
                <ExternalLink size={16} aria-hidden="true" /> Abrir documento de {record.model}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
