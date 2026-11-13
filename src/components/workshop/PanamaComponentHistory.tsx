import { useEffect, useState, type FormEvent } from 'react';
import { hermesApiUrl } from '../../lib/hermes-api-base';
import { useAuthStore } from '../../stores/auth-store';

interface ComponentRow {
  part: string;
  position: string;
  source: string;
  status: string;
  date?: string;
  meter?: string;
  reason?: string;
  target?: string;
  currentMeter?: string;
  remaining?: string;
  installedMeter?: string;
  elapsed?: string;
}
interface ComponentHistory {
  unit: string;
  changes: ComponentRow[];
  life: ComponentRow[];
  unavailable: string[];
  snapshots?: Record<string, string>;
}

function Records({ items, history }: { items: ComponentRow[]; history: boolean }) {
  if (items.length === 0) return <p className="text-sm text-slate-600">No se encontraron registros en las fuentes disponibles.</p>;
  return (
    <ul className="grid gap-2 md:grid-cols-2">
      {items.map((row, index) => (
        <li key={index} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
          <p className="font-semibold">{row.part} · {row.position || 'Posición sin dato'}</p>
          {history ? (
            <p>{row.date || 'Fecha sin dato'} · Lectura al cambio {row.meter || 'sin dato'} · {row.reason || 'Motivo sin dato'}</p>
          ) : (
            <>
              <p>Último cambio {row.installedMeter || 'sin dato'} · Lectura actual {row.currentMeter || 'sin dato'}</p>
              <p>Vida objetivo {row.target || 'sin dato'} · Restantes {row.remaining || 'sin dato'}</p>
            </>
          )}
          <p>Horas de uso {row.elapsed || 'sin dato'} · {row.status || 'Estado sin dato'}</p>
          <p className="mt-1 text-slate-600">{row.source}</p>
        </li>
      ))}
    </ul>
  );
}

export default function PanamaComponentHistory() {
  const [unit, setUnit] = useState('');
  const [request, setRequest] = useState<{ unit: string }>();
  const [record, setRecord] = useState<ComponentHistory>();
  const [error, setError] = useState('');
  const userId = useAuthStore(state => state.userId);
  useEffect(() => {
    if (!request || !userId) return;
    const controller = new AbortController();
    fetch(hermesApiUrl('/api/panama/componentes?' + new URLSearchParams({ unit: request.unit })), {
      signal: controller.signal, cache: 'no-store', credentials: 'same-origin',
    }).then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Consulta no disponible');
      if (!controller.signal.aborted) setRecord(data);
    }).catch((e: unknown) => {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Consulta no disponible');
    });
    return () => controller.abort();
  }, [request, userId]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRecord(undefined);
    setError('');
    setRequest({ unit: unit.trim().toUpperCase() });
  }

  const capture = Object.values(record?.snapshots ?? {}).sort()[0];

  return (
    <section className="my-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-semibold">Historial y vida de componentes</h2>
      <form className="flex flex-wrap items-end gap-2" onSubmit={submit}>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Código de equipo
          <input value={unit} onChange={event => setUnit(event.target.value)} required maxLength={24}
            className="min-h-12 rounded-lg border border-slate-300 px-3" placeholder="Ej. DZ203" />
        </label>
        <button type="submit" className="min-h-12 rounded-lg bg-blue-900 px-4 text-sm font-semibold text-white">
          Consultar componentes
        </button>
      </form>
      {request && !record && !error && <p role="status">Consultando componentes…</p>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {record && (
        <>
          <h3 className="font-semibold">{record.unit} · Cambios registrados</h3>
          {record.unavailable.length > 0 && <p role="status" className="text-amber-800">La consulta es parcial. Una o más fuentes de componentes no respondieron.</p>}
          {capture && (
            <p className="text-sm text-slate-600">
              Corte de componentes del {new Date(capture).toLocaleString('es-PA', { timeZone: 'America/Panama', dateStyle: 'short', timeStyle: 'short' })} · hora de Panamá
            </p>
          )}
          <Records items={record.changes} history />
          <h3 className="font-semibold">Vida según el maestro</h3>
          <Records items={record.life} history={false} />
        </>
      )}
      <p className="text-sm text-slate-600">Registra el reemplazo por pieza y posición en «ANOTAR CAMBIO» del maestro correspondiente.</p>
    </section>
  );
}
