import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { uploadEvidence } from '../../lib/evidence-upload';
import { requestWorkshop } from '../../lib/workshop-api';
import { useAuthStore } from '../../stores/auth-store';

type HseStatus = 'sin_asignar' | 'asignada' | 'evidencia' | 'devuelta' | 'verificada';
type HseEvent = { action: string; actorId: string; by: string; at: string; note: string; evidence?: string[] };
type Finding = {
  folio: string; unit: string; inspectedAt: string; itemId: string; item: string; section: string;
  status: string; comment: string; dueDate: string; canOperate: boolean; severity: string;
  approvalState: string; inspectorId: string; photos: string[];
  corrective: { state: HseStatus; responsible: string; assignedBy: string; submittedBy: string;
    verifiedBy: string; at: string; note: string; evidence: string[]; history: HseEvent[] };
};
type ReadModel = { findings: Finding[]; more: boolean; source: string; dispatchClearance: false };
type Action = 'assign' | 'submit' | 'verify' | 'return';
type Attempt = { operationId: string; body: Record<string, unknown>; file?: File; uploaded?: string[] };

const control = 'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
const actionButton = 'min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold disabled:opacity-50';
const date = (raw: string) => Number.isFinite(Date.parse(raw))
  ? new Date(raw).toLocaleString('es-PA', { timeZone: 'America/Panama', dateStyle: 'short', timeStyle: 'short' }) : raw;

function CaseActions({ finding, onSaved }: { finding: Finding; onSaved: () => void }) {
  const actor = useAuthStore(state => state.userId);
  const [active, setActive] = useState<Action | ''>('');
  const [responsible, setResponsible] = useState(finding.corrective.responsible || '');
  const [dueDate, setDueDate] = useState(finding.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(finding.dueDate) ? finding.dueDate : '');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const attempt = useRef<Attempt | undefined>(undefined);
  const busy = useRef(false);
  const state = finding.corrective.state;

  const actions: Action[] = ['sin_asignar', 'asignada', 'devuelta'].includes(state)
    ? (state === 'sin_asignar' ? ['assign'] : ['assign', 'submit'])
    : state === 'evidencia' ? ['verify', 'return'] : [];

  function select(next: Action) {
    if (busy.current || attempt.current) return;
    setError('');
    setActive(previous => previous === next ? '' : next);
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || !active) return;
    const body = { unit: finding.unit, folio: finding.folio, itemId: finding.itemId,
      action: active, note: note.trim(), ...(active === 'assign' ? { responsible: responsible.trim(), dueDate } : {}) };
    if (active === 'submit' && !file) { setError('Adjunta la fotografía que respalda la corrección.'); return; }
    const saved = attempt.current ?? { operationId: crypto.randomUUID(), body, ...(active === 'submit' && file ? { file } : {}) };
    attempt.current = saved;
    busy.current = true;
    setSaving(true);
    setError('');
    try {
      if (saved.file && !saved.uploaded) {
        const url = await uploadEvidence(saved.file, {
          kind: 'hseaction', units: [finding.unit], operationId: saved.operationId,
          expectedUserId: actor, slot: 0,
        });
        saved.uploaded = [url];
      }
      if (useAuthStore.getState().userId !== actor) throw new Error('Cambió la sesión.');
      await requestWorkshop('hseaction', { ...saved.body, mutationId: saved.operationId,
        ...(saved.uploaded && { photos: saved.uploaded }) });
      attempt.current = undefined;
      setActive('');
      setNote('');
      setFile(undefined);
      onSaved();
    } catch (cause) {
      const errorMessage = cause instanceof Error ? cause.message : 'No se pudo confirmar la acción.';
      setError(errorMessage + ' Reintenta sin cambiar los datos para evitar duplicados.');
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      {actions.map(next => <button key={next} type="button" className={actionButton}
        disabled={saving || !!attempt.current && active !== next}
        aria-pressed={active === next} onClick={() => select(next)}>
        {next === 'assign' ? 'Asignar responsable' : next === 'submit' ? 'Registrar corrección y foto'
          : next === 'verify' ? 'Verificar cierre' : 'Devolver corrección'}
      </button>)}
    </div>
    {active && <form className="space-y-2 rounded-lg border border-slate-200 p-3" onSubmit={send}>
      {active === 'assign' && <>
        <label className="block text-sm font-medium">Responsable indicado
          <input className={control} required maxLength={120} value={responsible} disabled={saving || !!attempt.current}
            onChange={event => setResponsible(event.target.value)} />
        </label>
        <label className="block text-sm font-medium">Compromiso
          <input className={control} type="date" required value={dueDate} disabled={saving || !!attempt.current}
            onChange={event => setDueDate(event.target.value)} />
        </label>
        <p className="text-xs text-amber-800">El nombre indicado no certifica que exista una cuenta asignada.</p>
      </>}
      {active === 'submit' && <label className="block text-sm font-medium">Foto comprobatoria
        <input className={control} type="file" accept="image/png,image/jpeg,image/webp" required={!file} disabled={saving || !!attempt.current}
          onChange={event => setFile(event.target.files?.[0] ?? undefined)} />
      </label>}
      <label className="block text-sm font-medium">Observaciones {active === 'assign' ? '(opcional)' : ''}
        <textarea className={control} rows={2} required={active !== 'assign'} maxLength={1000}
          disabled={saving || !!attempt.current} value={note} onChange={event => setNote(event.target.value)} />
      </label>
      <button className={actionButton} disabled={saving} type="submit">{saving ? 'Confirmando…' : attempt.current ? 'Reintentar mismo movimiento' : 'Guardar con trazabilidad'}</button>
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    </form>}
  </div>;
}

export default function PanamaHseActions({ unit }: { unit?: string }) {
  const [records, setRecords] = useState<Finding[]>([]);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    const endpoint = unit ? `hsefindings?${new URLSearchParams({ unit })}` : 'hsefindings';
    void requestWorkshop<ReadModel>(endpoint).then(data => {
      if (!current) return;
      setRecords(data.findings);
      setMore(data.more);
    }).catch(cause => {
      if (!current) return;
      setError(cause instanceof Error ? cause.message : 'Hallazgos HSE no disponibles.');
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [revision, unit]);

  const pending = records.filter(finding => finding.corrective.state !== 'verificada');
  return <section aria-label="Acciones correctivas HSE" className="space-y-3 rounded-xl border border-border bg-white p-3 sm:p-4">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="text-base font-bold text-text">Hallazgos y acciones correctivas HSE</h2>
        <p className="text-xs text-slate-600">Fuente: Inspeccion_Hallazgos · {pending.length} por atender en la consulta</p>
      </div>
      <button type="button" className={actionButton} disabled={loading} onClick={() => setRevision(value => value + 1)}>Actualizar</button>
    </header>
    <p className="text-xs text-amber-800">Cerrar una acción no elimina la restricción HSE ni libera un equipo para despacho. La habilitación depende de una inspección vigente y de las demás comprobaciones.</p>
    {loading && <p role="status">Consultando hallazgos…</p>}
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    {!loading && !error && records.length === 0 && <p className="text-sm text-slate-600">Sin hallazgos HSE para esta consulta. No equivale a una habilitación vigente.</p>}
    {more && <p className="text-xs text-amber-800">Hay más de 200 hallazgos. Filtra por unidad para revisar el expediente completo.</p>}
    {!loading && !error && records.map(finding => {
      const state = finding.corrective.state;
      return <details key={finding.folio + ':' + finding.itemId} className="rounded-lg border border-slate-200 p-3">
        <summary className="cursor-pointer font-semibold text-sm">
          {finding.unit} · {finding.item} · {state === 'verificada' ? 'Verificada (sin liberación)' : state === 'evidencia' ? 'Evidencia por verificar' : state === 'sin_asignar' ? 'Sin responsable' : state === 'devuelta' ? 'Devuelta' : 'En seguimiento'}
        </summary>
        <div className="mt-3 space-y-2 text-sm">
          <p>Inspección <strong>{finding.folio}</strong> · {finding.section} · {finding.status} · gravedad {finding.severity}</p>
          <p>{finding.comment}</p>
          <p>Estado HSE de origen: {finding.approvalState} · {finding.canOperate ? 'Punto condicionado' : 'Punto restrictivo'}</p>
          <p>Compromiso: {finding.dueDate || 'Sin fecha verificada'} · Responsable: {finding.corrective.responsible || 'Sin asignar'}</p>
          {finding.corrective.verifiedBy && <p>Verificó: {finding.corrective.verifiedBy} · {date(finding.corrective.at)}</p>}
          {finding.photos.length > 0 && <div className="flex flex-wrap gap-2">{finding.photos.map(photo =>
            <a key={photo} href={photo} target="_blank" rel="noreferrer" className="text-blue-800 underline">Evidencia de inspección</a>)}</div>}
          {finding.corrective.evidence.length > 0 && <div className="flex flex-wrap gap-2">{finding.corrective.evidence.map(photo =>
            <a key={photo} href={photo} target="_blank" rel="noreferrer" className="text-blue-800 underline">Evidencia de corrección</a>)}</div>}
          <Link to={`/fleet?unit=${encodeURIComponent(finding.unit)}`} className="inline-flex min-h-11 items-center font-semibold text-blue-800 underline">Ver equipo y restricciones</Link>
          <CaseActions finding={finding} onSaved={() => setRevision(value => value + 1)} />
          {finding.corrective.history.length > 0 && <details>
            <summary className="cursor-pointer text-xs font-semibold">Historial de acciones ({finding.corrective.history.length})</summary>
            <ol className="mt-2 space-y-1 text-xs text-slate-700">{finding.corrective.history.map(event =>
              <li key={event.operationId}>{event.action} · {event.by} · {date(event.at)} · {event.note}</li>)}</ol>
          </details>}
        </div>
      </details>;
    })}
  </section>;
}
