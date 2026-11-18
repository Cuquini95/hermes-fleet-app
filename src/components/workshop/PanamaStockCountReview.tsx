import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { purchaseRead, type WarehouseStock } from '../../lib/purchasing-api';
import { isCountStock, reviewStockCount, stockCountReport, stockCountTemplate } from '../../lib/panama-stock-count';
import { downloadBlob } from '../../lib/download-blob';

const button = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-white px-3 text-sm font-semibold disabled:opacity-50';
function todayPanama() {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'America/Panama', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-');
}

export default function PanamaStockCountReview({ fullScope }: { fullScope: boolean }) {
  const [request, setRequest] = useState(0);
  const [reply, setReply] = useState<{ request: number; stock: WarehouseStock[] | null; at: string | null; error: string; fullScope: boolean } | null>(null);
  const [file, setFile] = useState<{ name: string; text: string; sha256: string } | null>(null);
  const [reading, setReading] = useState(false);
  const [fileError, setFileError] = useState('');
  const [query, setQuery] = useState('');
  const [errorsOnly, setErrorsOnly] = useState(false);
  const sequence = useRef(0);
  const baseline = reply?.request === request ? reply : null;
  const loading = baseline === null;
  useEffect(() => {
    const controller = new AbortController();
    void purchaseRead<{ items: WarehouseStock[]; transitScoped?: boolean }>('inventory-stock', undefined, controller.signal)
      .then(data => {
        if (!Array.isArray(data.items) || !data.items.every(isCountStock)) throw new Error('No se pudo verificar el catálogo.');
        if (!controller.signal.aborted) setReply({ request, stock: data.items, at: new Date().toISOString(), error: '', fullScope: data.transitScoped === false });
      }).catch(cause => {
        if (!controller.signal.aborted) setReply({ request, stock: null, at: null,
          error: cause instanceof Error ? cause.message : 'Catálogo no disponible.', fullScope: false });
      });
    return () => controller.abort();
  }, [request]);
  useEffect(() => () => { sequence.current++; }, []);

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget; const selected = input.files?.[0]; input.value = '';
    const current = ++sequence.current;
    setFile(null); setFileError(''); setReading(false);
    if (!selected) return;
    if (selected.size > 1_000_000 || !/\.csv$/i.test(selected.name)) { setFileError('Selecciona un CSV UTF-8 de hasta 1 MB.'); return; }
    setReading(true);
    try {
      const bytes = await selected.arrayBuffer();
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      const hash = await crypto.subtle.digest('SHA-256', bytes);
      if (current === sequence.current) setFile({ name: selected.name, text,
        sha256: [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, '0')).join('') });
    } catch { if (current === sequence.current) setFileError('No se pudo leer el archivo. Guarda una copia CSV UTF-8 y vuelve a seleccionarla.'); }
    finally { if (current === sequence.current) setReading(false); }
  }

  const today = todayPanama();
  const report = useMemo(() => file ? reviewStockCount(file.text, baseline?.stock ?? null, { today, fullScope: fullScope && baseline?.fullScope === true }) : null,
    [file, baseline, today, fullScope]);
  const term = query.trim().toUpperCase();
  const rows = report?.rows.filter(row => (!errorsOnly || row.errors.length > 0)
    && `${row.values.SKU_interno} ${row.values.Descripcion} ${row.values.Almacen}`.toUpperCase().includes(term));
  const badRows = report?.rows.filter(row => row.errors.length > 0).length ?? 0;

  return <section aria-label="Revisión del conteo" className="min-w-0 space-y-3">
    <h2 className="font-bold">Revisar conteo de Almacén</h2>
    <p className="text-sm text-text-secondary">Selecciona el conteo para revisar sus datos y diferencias. El informe no cambia existencias ni acredita una aprobación.</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" className={button} onClick={() => downloadBlob(new Blob([stockCountTemplate()], { type: 'text/csv;charset=utf-8' }), 'Hermes-Panama-Plantilla-Conteo.csv')}>Descargar plantilla</button>
      <button type="button" className={button} disabled={loading} onClick={() => setRequest(value => value + 1)}>Actualizar comparación</button>
    </div>
    <label className={`${button} cursor-pointer focus-within:ring-2 focus-within:ring-blue-600`}>Seleccionar archivo CSV
      <input type="file" aria-label="Archivo de conteo CSV" accept=".csv,text/csv" className="sr-only" onChange={event => void chooseFile(event)} />
    </label>
    <p className="text-xs text-text-secondary">CSV UTF-8 · hasta 500 filas. Fecha AAAA-MM-DD; cantidades con punto y sin separador de miles. No se guarda en Hermes.</p>
    {reading && <p role="status" className="text-sm">Leyendo archivo…</p>}
    {fileError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{fileError}</p>}
    {loading && <p role="status" className="text-sm">Consultando existencias…</p>}
    {baseline?.error && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm">{baseline.error} El conteo se conserva para revisar; las existencias quedan sin comparar.</p>}
    {file && report && <>
      <p className="break-words text-sm font-semibold">{file.name}</p>
      {report.errors.map(message => <p role="alert" key={message} className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{message}</p>)}
      {report.warnings.map(message => <p role="status" key={message} className="rounded-xl bg-amber-50 p-3 text-sm">{message}</p>)}
      {report.rows.length > 0 && <>
        <p role="status" className="text-sm font-semibold">{report.rows.length} filas revisadas · {badRows} con errores de datos</p>
        <button type="button" className={button} disabled={reading || loading} onClick={() => downloadBlob(
          new Blob([stockCountReport(report, { file: file.name, sha256: file.sha256, comparedAt: baseline?.at ?? null })], { type: 'text/csv;charset=utf-8' }),
          'Hermes-Panama-Revision-Conteo.csv')}>Descargar observaciones</button>
        <label className="block text-sm">Buscar SKU, descripción o almacén
          <input type="search" className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-border bg-white px-3" value={query} onChange={event => setQuery(event.target.value)} />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={errorsOnly} onChange={event => setErrorsOnly(event.target.checked)} />Solo errores de datos</label>
        {!rows?.length && <p className="text-sm">Sin filas para este filtro.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {rows?.map(row => <article key={row.line} className="min-w-0 space-y-2 rounded-xl border border-border bg-white p-4">
            <h3 className="break-words font-bold">{row.values.SKU_interno || 'SKU pendiente'} · {row.values.Almacen || 'Almacén pendiente'}</h3>
            <p className="break-words text-sm text-text-secondary">{row.values.Descripcion}</p>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div><dt>Contado</dt><dd>{row.counted ?? 'Por corregir'} {row.values.Unidad}</dd></div>
              <div><dt>Existencia consultada</dt><dd>{row.physical ?? 'Sin base'}</dd></div>
              <div><dt>Diferencia observada</dt><dd>{row.difference ?? 'Sin comparar'}</dd></div>
              <div><dt>Fila de origen</dt><dd>{row.line}</dd></div>
            </dl>
            {row.errors.map(message => <p key={message} className="break-words text-sm font-semibold text-red-800">{message}</p>)}
            <details className="break-words text-xs text-text-secondary">
              <summary className="min-h-11 cursor-pointer py-3 font-medium">Pendientes y respaldo</summary>
              {row.warnings.map(message => <p key={message} className="my-1">{message}</p>)}
              <p>Ubicación · {row.values.Ubicacion || 'Sin dato'}</p><p>Fuente · {row.values.Fuente_soporte || 'Sin dato'}</p>
              <p>Revisión documental y autorización por verificar antes de cualquier carga.</p>
            </details>
          </article>)}
        </div>
      </>}
      <details className="break-words text-xs text-text-secondary">
        <summary className="min-h-11 cursor-pointer py-3 font-medium">Origen de la revisión</summary>
        <p>Archivo · {file.name}</p><p>SHA-256 · {file.sha256}</p>
        <p>Consulta · {baseline?.at ? new Date(baseline.at).toLocaleString('es-PA', { timeZone: 'America/Panama' }) + ' · Panamá' : 'Sin consulta vigente'}</p>
        <p>Las diferencias comparan contra la consulta actual. Conciliar movimientos desde la fecha del conteo.</p>
        <button type="button" className={button} onClick={() => { sequence.current++; setFile(null); setFileError(''); setReading(false); }}>Retirar archivo de esta revisión</button>
      </details>
    </>}
  </section>;
}
