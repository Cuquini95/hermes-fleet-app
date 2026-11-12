import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';

const definitions = [
  { key: 'fleet', title: 'Flota', fields: [['equipment', 'Equipo'], ['model', 'Modelo'], ['group', 'Clase'], ['active', 'Activo en el maestro']] },
  { key: 'failures', title: 'Fallas TMF', fields: [['description', 'Falla'], ['status', 'Estado'], ['last', 'Último reporte'], ['order', 'OT vinculada']] },
  { key: 'shifts', title: 'Últimos turnos registrados', fields: [['date', 'Fecha'], ['shift', 'Turno'], ['status', 'Estado'], ['start', 'Horómetro inicial'], ['end', 'Horómetro final']] },
  { key: 'orders', title: 'Órdenes de trabajo', fields: [['description', 'Trabajo'], ['status', 'Estado'], ['check', 'Control de integridad']] },
  { key: 'maintenance', title: 'Mantenimiento preventivo', fields: [['status', 'Estado de PM'], ['next', 'Próximo PM'], ['remaining', 'Horas restantes'], ['reading', 'Lectura'], ['plan', 'Plan']] },
  { key: 'dozers', title: 'Componentes · Dozers', fields: [['group', 'Clase'], ['critical', 'Críticos'], ['upcoming', 'Próximos'], ['noData', 'Sin dato']] },
  { key: 'excavators', title: 'Componentes · Excavadoras', fields: [['group', 'Clase'], ['critical', 'Críticos'], ['upcoming', 'Próximos'], ['noData', 'Sin dato']] },
  { key: 'purchases', title: 'Compras · Panamá', fields: [['description', 'Compra'], ['amount', 'Monto'], ['currency', 'Moneda'], ['status', 'Estado'], ['order', 'OC'], ['check', 'Recepción']] },
  { key: 'costs', title: 'Costos por máquina · Según el maestro', fields: [['hours', 'Horas TMF'], ['revenue', 'Ingreso USD'], ['purchases', 'Compras y reparto USD'], ['cost', 'Costo analítico parcial USD/h'], ['margin', 'Margen analítico parcial USD/h']] },
] as const;

type SourceRow = Record<string, string | undefined> & { unit: string };
type Sections = Record<string, SourceRow[] | null>;

export default function PanamaPage() {
  const name = useAuthStore(state => state.userName);
  const userId = useAuthStore(state => state.userId);
  const canSeeShifts = useAuthStore(state => state.project === 'tmf-panama' && ['operador', 'supervisor', 'coordinador', 'gerencia'].includes(state.role ?? ''));
  const canReceive = useAuthStore(state => state.project === 'tmf-panama' && state.canReceivePurchases);
  const logout = useAuthStore(state => state.logout);
  const [sections, setSections] = useState<Sections>();
  const [filter, setFilter] = useState('');
  const [reload, setReload] = useState(0);
  const [failed, setFailed] = useState(false);
  const [logoutFailed, setLogoutFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setSections(undefined);
    setFailed(false);
    fetch('/hermes-api/api/panama/summary', { cache: 'no-store', credentials: 'same-origin', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Consulta no disponible');
        const data = await response.json();
        if (data.project !== 'tmf-panama' || !data.sections) throw new Error('Respuesta fuera del proyecto');
        if (!controller.signal.aborted) setSections(data.sections);
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [reload, userId]);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#162252] p-4 text-white">
          <img src="/logo-transplus.svg" alt="Trans Plus" className="h-10 w-10 rounded bg-white p-1" />
          <div className="mr-auto">
            <h1 className="text-xl font-bold">Hermes Panamá</h1>
            <p className="text-sm text-slate-200">TMF Minera Panamá · {name}</p>
          </div>
          <button className="rounded-lg border border-slate-400 px-3 py-2 text-sm" type="button" onClick={async () => setLogoutFailed(!(await logout()))}>Cerrar sesión</button>
        </header>
        {logoutFailed && <p className="my-2 text-red-700" role="alert">No se pudo cerrar la sesión. Intenta de nuevo.</p>}
        {canSeeShifts && <Link to="/panama/turnos" className="mr-3 mt-4 inline-flex min-h-11 items-center rounded-lg border border-slate-400 bg-white px-4 text-sm font-semibold text-[#162252]">Relevo de turno</Link>}
        {canReceive && <Link to="/panama/recepciones" className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-slate-400 bg-white px-4 text-sm font-semibold text-[#162252]">Recepciones de compras</Link>}
        <div className="my-5 flex flex-wrap items-end gap-3">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-semibold">
            Filtrar por unidad
            <input className="w-full rounded-lg border border-slate-400 bg-white px-3 py-2 font-normal" placeholder="Ej. DZ203" value={filter} onChange={e => setFilter(e.target.value)} />
          </label>
          <button type="button" onClick={() => setReload(value => value + 1)} className="rounded-lg bg-[#162252] px-4 py-2 font-semibold text-white">Actualizar</button>
        </div>
        {failed ? <p role="alert">La consulta está temporalmente fuera de servicio.</p> : !sections && <p role="status">Consultando los maestros de Panamá…</p>}
        {sections && definitions.filter(({ key }) => Object.hasOwn(sections, key)).map(({ key, title, fields }) => {
          const rows = sections[key]?.filter(row => row.unit.toUpperCase().includes(filter.trim().toUpperCase()));
          return (
            <section key={key} className="my-4 rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-lg font-bold">{title}{rows && <span className="ml-2 text-sm text-slate-600">{rows.length}</span>}</h2>
              {!rows ? <p className="text-amber-800">Fuente no disponible.</p> : rows.length === 0 ? <p className="text-slate-600">Sin registros para esta consulta.</p> : (
                <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {rows.map((row, i) => (
                    <li key={row.id || (row.unit + '-' + i)} className="min-w-0 rounded-xl border border-slate-200 p-3">
                      <p className="font-semibold text-[#162252]">{row.unit}{row.id && <span className="ml-2 text-xs text-slate-600">{row.id}</span>}</p>
                      <dl className="mt-1 space-y-1 text-sm">
                        {fields.map(([field, label]) => row[field] && <div key={field}><dt className="inline font-medium">{label} </dt><dd className="inline break-words text-slate-700">{row[field]}</dd></div>)}
                      </dl>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
