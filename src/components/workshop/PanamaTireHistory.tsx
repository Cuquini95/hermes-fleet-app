import { useState, type FormEvent } from 'react';
import { readRange, SHEET_TABS } from '../../lib/sheets-api';
import { tireHistory } from '../../lib/panama-tires';

export default function PanamaTireHistory() {
  const [serial, setSerial] = useState('');
  const [rows, setRows] = useState<ReturnType<typeof tireHistory>>();
  const [state, setState] = useState<'idle' | 'loading' | 'unavailable' | 'ready'>('idle');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRows(undefined);
    setState('loading');
    try {
      setRows(tireHistory(await readRange(SHEET_TABS.NEUMATICOS), serial));
      setState('ready');
    } catch {
      setState('unavailable');
    }
  }
  return (
    <section className="my-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="font-semibold text-navy">Historial por serie o número de fuego</h2>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 text-sm">
          Serie o número de fuego
          <input value={serial} maxLength={80} required onChange={event => setSerial(event.target.value)}
            className="mt-1 block min-h-12 w-full rounded-lg border border-slate-300 px-3" />
        </label>
        <button type="submit" disabled={state === 'loading'} className="min-h-12 rounded-lg bg-blue-900 px-4 text-sm font-semibold text-white">
          Consultar historial
        </button>
      </form>
      {state === 'loading' && <p role="status">Consultando…</p>}
      {state === 'unavailable' && <p role="alert" className="text-red-700">Fuente de neumáticos no disponible.</p>}
      {rows?.length === 0 && <p role="status" className="text-sm">No hay registros visibles con esa serie.</p>}
      {rows && rows.length > 0 && (
        <ol className="space-y-2">
          {rows.map((row,index) => (
            <li key={index} className="rounded-lg bg-slate-50 p-2 text-sm">
              <p className="font-semibold">{row.date || 'Fecha sin dato'} · {row.unit} · {row.position}</p>
              <p>Presión {row.pressure || 'sin dato'} PSI · Profundidad {row.depth || 'sin dato'} mm</p>
              <p>Horómetro {row.meter || 'sin dato'} · {row.status || 'Estado sin dato'}</p>
              {row.note && <p>{row.note}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
