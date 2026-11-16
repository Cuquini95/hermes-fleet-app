import { useEffect, useRef, useState, type FormEvent } from 'react';
import { uploadEvidence } from '../../lib/evidence-upload';
import { displayMoney } from '../../lib/purchasing-api';
import { requestWorkshop, WorkshopApiError, workshopActorId } from '../../lib/workshop-api';

const coverageLabels = {
  'within-period': 'Dentro de vigencia',
  'outside-period': 'Fuera de vigencia',
  'unknown-date': 'Fecha de referencia sin confirmar',
};
const dateSources = { stop: 'Fecha de parada', report: 'Fecha del reporte', order: 'Fecha de la OT' };
const outcomes = { approved: 'Aprobado', partial: 'Aprobado parcialmente', rejected: 'Rechazado' };
const actions = { coverage: 'Agregar cobertura', claim: 'Registrar reclamo', decision: 'Registrar dictamen', recovery: 'Registrar recuperación' };
const referenceLabels = { claim: 'Folio del reclamo', decision: 'Referencia del dictamen', recovery: 'Comprobante de recuperación' };
const field = 'min-h-11 w-full min-w-0 rounded-lg border border-border bg-white px-2 text-sm text-text';
const button = 'inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm font-semibold';

type Action = keyof typeof actions;
type Editor = { action: Action; caseId?: string; exceptionRequired?: boolean };
type Attempt = Record<string, unknown> & { mutationId: string };
type Currency = 'USD' | 'PAB';
interface Entry {
  recordedAt: string;
  recordedBy: string;
  notes: string;
  attachments: string[];
}
type Recovery = Entry & { reference: string; cents: number; currency: Currency };
interface WarrantyCase {
  id: string;
  applicability: keyof typeof coverageLabels;
  coverage: Entry & { supplier: string; subject: string; warrantyRef: string; starts: string; ends: string };
  claim?: Entry & { reference: string; exception?: string };
  decision?: Entry & { reference: string; outcome: keyof typeof outcomes };
  recoveries?: Recovery[];
  totals?: { currency: Currency; cents: number }[];
  recoveryCount?: number;
}
interface WarrantyResponse {
  date: string | null;
  source: keyof typeof dateSources | null;
  version: string;
  cases: WarrantyCase[];
  confirmedRequests: string[];
}

function DateLabel({ date }: { date: string }) {
  const [year, month, day] = date.split('-');
  return <time dateTime={date}>{day}/{month}/{year}</time>;
}

function EntryEvidence({ entry }: { entry: Entry }) {
  return <>
    {entry.notes && <p className="whitespace-pre-wrap">{entry.notes}</p>}
    <p className="text-xs text-text-secondary">{entry.recordedBy} · {new Date(entry.recordedAt).toLocaleString('es-PA', {
      timeZone: 'America/Panama', dateStyle: 'short', timeStyle: 'short',
    })}</p>
    {entry.attachments.length > 0 && <div className="flex flex-wrap gap-x-3">
      {entry.attachments.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer"
        className="inline-flex min-h-11 items-center font-medium text-blue-800 underline">Ver evidencia {index + 1}</a>)}
    </div>}
  </>;
}

function WarrantyCard({ record, onEdit, mayWrite, mayRecover }: {
  record: WarrantyCase; onEdit: (editor: Editor) => void; mayWrite: boolean; mayRecover: boolean;
}) {
  const { coverage, claim, decision, recoveries, totals, recoveryCount } = record;
  const exceptionRequired = record.applicability !== 'within-period';
  const next = !claim ? 'claim'
    : claim && !decision ? 'decision' : decision && decision.outcome !== 'rejected' && mayRecover ? 'recovery' : undefined;
  return <li className="min-w-0 space-y-3 break-words rounded-lg border border-border p-3 text-sm">
    <div>
      <p className="font-semibold">{coverage.subject} · {coverage.supplier}</p>
      <p>{coverageLabels[record.applicability]} · <DateLabel date={coverage.starts} /> al <DateLabel date={coverage.ends} /></p>
      <p>Documento {coverage.warrantyRef}</p>
      <EntryEvidence entry={coverage} />
    </div>
    {claim && <div className="border-t border-border pt-2">
      <p className="font-semibold">Reclamo {claim.reference}</p>
      {claim.exception && <p>Excepción respaldada por el proveedor: {claim.exception}</p>}
      <EntryEvidence entry={claim} />
    </div>}
    {decision && <div className="border-t border-border pt-2">
      <p className="font-semibold">{outcomes[decision.outcome]} · Dictamen {decision.reference}</p>
      <EntryEvidence entry={decision} />
    </div>}
    {totals && totals.length > 0 && <div className="border-t border-border pt-2">
      <p className="font-semibold">Monto recuperado</p>
      <ul>{totals.map(({ currency, cents }) => <li key={currency}>{displayMoney(cents / 100, currency)}</li>)}</ul>
      <ul className="mt-2 space-y-2">{recoveries?.map(recovery => <li key={recovery.reference}>
        <p>{recovery.reference} · {displayMoney(recovery.cents / 100, recovery.currency)}</p>
        <EntryEvidence entry={recovery} />
      </li>)}</ul>
    </div>}
    {Boolean(recoveryCount) && <p className="font-medium">Recuperación registrada por Gerencia</p>}
    {mayWrite && next && <button type="button" className={button} onClick={() => onEdit({ action: next, caseId: record.id, exceptionRequired: next === 'claim' && exceptionRequired })}>
      {next === 'claim' && exceptionRequired ? 'Registrar reclamo con excepción' : actions[next]}
    </button>}
  </li>;
}

function WarrantyForm({ editor, onSave, onCancel, saving }: {
  editor: Editor; onSave: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void; saving: boolean;
}) {
  const { action } = editor;
  return <form aria-label={actions[action]} className="space-y-3 border-t border-border pt-3" onSubmit={onSave}>
    <fieldset disabled={saving} className="grid min-w-0 grid-cols-1 gap-3 text-sm sm:grid-cols-2">
      {action === 'coverage' ? <>
        <label>Proveedor<input name="supplier" className={field} required maxLength={140} /></label>
        <label>Componente o equipo<input name="subject" className={field} required maxLength={140} /></label>
        <label>Documento de garantía<input name="warrantyRef" className={field} required maxLength={180} /></label>
        <label>Inicio de vigencia<input name="starts" type="date" className={field} required /></label>
        <label>Fin de vigencia<input name="ends" type="date" className={field} required /></label>
      </> : <label>{referenceLabels[action]}<input name="reference" className={field} required maxLength={180} /></label>}
      {editor.exceptionRequired && <label>Respaldo de la excepción del proveedor
        <input name="exception" className={field} required maxLength={300} />
      </label>}
      {action === 'decision' && <label>Resultado del dictamen<select name="outcome" className={field} required defaultValue="">
        <option value="">Seleccionar</option>
        {Object.entries(outcomes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>}
      {action === 'recovery' && <>
        <label>Monto recuperado<input name="amount" className={field} type="number" inputMode="decimal" min="0.01" max="999999999.99" step="0.01" required /></label>
        <label>Moneda<select name="currency" className={field} required defaultValue="">
          <option value="">Seleccionar</option><option>USD</option><option>PAB</option>
        </select></label>
      </>}
      <label>Observaciones<textarea name="notes" className={field} maxLength={1000} /></label>
      <label>Evidencia (foto o PDF)<input name="files" type="file" className={field} accept="image/jpeg,image/png,image/webp,application/pdf"
        required={action === 'claim'} multiple /></label>
    </fieldset>
    <div className="flex flex-wrap gap-2">
      <button type="submit" className={`${button} bg-[#162252] text-white`} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
      <button type="button" className={button} disabled={saving} onClick={onCancel}>Cancelar</button>
    </div>
  </form>;
}

export default function OrderWarranties({ otId, unit, actorId, mayWrite, mayRecover, onSaved }: {
  otId: string; unit: string; actorId: string; mayWrite: boolean; mayRecover: boolean; onSaved: () => Promise<unknown>;
}) {
  const key = `hermes:warranty:${JSON.stringify([actorId, otId])}`;
  const [attempt, setAttempt] = useState<Attempt | null>(() => {
    try { return JSON.parse(sessionStorage.getItem(key) ?? 'null'); } catch { return null; }
  });
  const [open, setOpen] = useState(Boolean(attempt));
  const [revision, setRevision] = useState(0);
  const [record, setRecord] = useState<WarrantyResponse>();
  const [editor, setEditor] = useState<Editor>();
  const [readError, setReadError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const sending = useRef(false);
  const pending = useRef(attempt);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void requestWorkshop<WarrantyResponse>(`warranties?${new URLSearchParams({ otId })}`).then(data => {
      if (!active) return;
      setRecord(data);
      setReadError('');
      if (!sending.current && pending.current && data.confirmedRequests.includes(pending.current.mutationId)) {
        try { sessionStorage.removeItem(key); } catch { /* The in-memory state still clears. */ }
        pending.current = null;
        setAttempt(null);
        setMessage('Registro guardado.');
      }
    }).catch((error: unknown) => {
      if (!active) return;
      setRecord(undefined);
      setReadError(error instanceof Error ? error.message : 'Consulta de garantías no disponible.');
    });
    return () => { active = false; };
  }, [key, open, otId, revision]);

  function saveAttempt(value: Attempt | null) {
    pending.current = value;
    setAttempt(value);
    try {
      if (value) sessionStorage.setItem(key, JSON.stringify(value));
      else sessionStorage.removeItem(key);
    } catch { /* The open form can retry in memory. */ }
  }

  async function save(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!mayWrite || sending.current || (!attempt && (!event || !editor || !record))) return;
    sending.current = true;
    setSaving(true);
    setMessage('');
    let operation = attempt;
    try {
      if (!operation && event && editor && record) {
        const data = new FormData(event.currentTarget);
        const files = data.getAll('files').filter((value): value is File => value instanceof File && value.size > 0);
        if (files.length > 4) throw new WorkshopApiError('Adjunta hasta cuatro archivos por registro.', 400);
        data.delete('files');
        const mutationId = crypto.randomUUID();
        const attachments: string[] = [];
        for (const [slot, file] of files.entries()) {
          if (workshopActorId() !== actorId) throw new WorkshopApiError('Cambió la sesión.', 403);
          attachments.push(await uploadEvidence(file, { kind: 'warranty', units: [unit], recordId: otId,
            expectedUserId: actorId, operationId: mutationId, slot }));
        }
        operation = { ...Object.fromEntries(data), action: editor.action, caseId: editor.caseId,
          otId, mutationId, expectedVersion: record.version, attachments };
        saveAttempt(operation);
      }
      if (workshopActorId() !== actorId) throw new WorkshopApiError('Cambió la sesión.', 403);
      await requestWorkshop('warranties', operation ?? undefined);
      saveAttempt(null);
      setEditor(undefined);
      setMessage('Registro guardado.');
      setRevision(value => value + 1);
      void onSaved();
    } catch (reason) {
      const uncertain = operation && (!(reason instanceof WorkshopApiError) || reason.status >= 500);
      if (!uncertain) {
        saveAttempt(null);
        if (reason instanceof WorkshopApiError && reason.status === 409) setRevision(value => value + 1);
      }
      setMessage(uncertain ? 'Confirmación pendiente. Reintenta el mismo registro.'
        : reason instanceof Error ? reason.message : 'No se pudo guardar el registro.');
      if (uncertain) setEditor(undefined);
    } finally {
      sending.current = false;
      setSaving(false);
    }
  }

  return <details open={open} className="min-w-0 rounded-xl border border-border bg-white p-4"
    onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer py-1 text-sm font-semibold text-text">Garantías y reclamos</summary>
    {open && <div className="mt-3 space-y-3">
      {readError && <p role="alert" className="text-sm text-amber-900">{readError}</p>}
      {!readError && !record && <p role="status" className="text-sm">Consultando garantías…</p>}
      {record && <>
        <p className="text-sm text-text-secondary">{record.date && record.source ? <>{dateSources[record.source]} · <DateLabel date={record.date} />. Revisa las condiciones del documento.</>
          : 'Falta una fecha verificable para comprobar vigencia.'}</p>
        {!record.cases.length && <p className="text-sm">Sin coberturas registradas.</p>}
        <ul aria-label="Coberturas de esta OT" className="space-y-2">
          {record.cases.map(warranty => <WarrantyCard key={warranty.id} record={warranty}
            mayWrite={mayWrite && !attempt && !editor} mayRecover={mayRecover} onEdit={setEditor} />)}
        </ul>
        {mayWrite && !attempt && !editor && <button type="button" className={button} onClick={() => setEditor({ action: 'coverage' })}>{actions.coverage}</button>}
      </>}
      {mayWrite && attempt && !saving && <button type="button" className={button} disabled={saving} onClick={() => void save()}>Reintentar guardado</button>}
      {mayWrite && editor && (!attempt || saving) && record && <WarrantyForm key={JSON.stringify(editor)} editor={editor}
        onSave={event => void save(event)} onCancel={() => setEditor(undefined)} saving={saving} />}
      {message && <p role="status" className="text-sm text-text">{message}</p>}
    </div>}
  </details>;
}
