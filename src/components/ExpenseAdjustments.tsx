import { useEffect, useRef, useState } from 'react';
import { PurchaseApiError, purchaseRead, purchaseWrite } from '../lib/purchasing-api';

type Decision = 'Aprobado' | 'Rechazado';
type AdjustmentStatus = 'Pendiente' | Decision;

interface Adjustment {
  id: string;
  status: AdjustmentStatus;
  previousAmount: string;
  newAmount: string;
  reason: string;
  author: string;
  createdAt: string;
  reviewer?: string;
  reviewedAt?: string;
  reviewReason?: string;
}

interface History {
  period: string;
  currency: string;
  originalAmount: string;
  effectiveAmount: string;
  items: Adjustment[];
  version: string;
  canPropose: boolean;
  canReview: boolean;
}

type Operation = {
  action: 'expense-adjustment-propose' | 'expense-adjustment-review';
  body: { id: string; version: string; amount?: string; reason: string; adjustmentId?: string; status?: Decision };
};

const localDate = new Intl.DateTimeFormat('es-PA', { timeZone: 'America/Panama', dateStyle: 'short', timeStyle: 'short' });
const buttonStyle = 'min-h-11 rounded-lg border border-border px-3 text-sm font-semibold disabled:opacity-50';
const fieldStyle = 'block w-full min-w-0 rounded-lg border border-border px-2 py-2';

function AdjustmentRow({ entry, currency }: { entry: Adjustment; currency: string }) {
  return <li className="space-y-1 rounded-lg border border-border p-2">
    <p className="font-semibold">{entry.status} · {entry.previousAmount} → {entry.newAmount} {currency}</p>
    <p>{entry.reason}</p>
    <p className="text-xs text-text-secondary">{entry.id} · {entry.author} · {localDate.format(new Date(entry.createdAt))}</p>
    {entry.reviewedAt && <p className="text-xs text-text-secondary">Revisión por {entry.reviewer} · {localDate.format(new Date(entry.reviewedAt))}
      {entry.reviewReason && ' · ' + entry.reviewReason}</p>}
  </li>;
}

export default function ExpenseAdjustments({ expenseId }: { expenseId: string }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<History>();
  const [refresh, setRefresh] = useState(0);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [reviewReason, setReviewReason] = useState('');
  const [requestError, setRequestError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingOperation, setPendingOperation] = useState<Operation>();
  const inFlight = useRef(false);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void purchaseRead<History>('expense-adjustments', { id: expenseId }, controller.signal)
      .then(data => {
        if (controller.signal.aborted) return;
        setHistory(data);
        setRequestError('');
      })
      .catch(reason => {
        if (controller.signal.aborted) return;
        setHistory(undefined);
        setRequestError(reason instanceof Error ? reason.message : 'Error al consultar el ajuste.');
      });
    return () => controller.abort();
  }, [expenseId, open, refresh]);

  async function save(operation: Operation) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setSaveError('');
    try {
      await purchaseWrite<{ adjustmentId: string; status: AdjustmentStatus }>(
        operation.action, operation.body, undefined,
        value => !!value?.adjustmentId && value.status === (operation.body.status ?? 'Pendiente'),
      );
      setPendingOperation(undefined);
      setAmount('');
      setReason('');
      setReviewReason('');
      setHistory(undefined);
      setRefresh(value => value + 1);
    } catch (cause) {
      if (!(cause instanceof PurchaseApiError) || cause.confirmationPending) {
        setPendingOperation(operation);
        setSaveError('La operación está pendiente de confirmación.');
      } else {
        setPendingOperation(undefined);
        setSaveError(cause.message);
        if (cause.status === 409) setRefresh(value => value + 1);
      }
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  const pending = history?.items.find(entry => entry.status === 'Pendiente');
  const locked = saving || Boolean(pendingOperation);
  return <details className="min-w-0 rounded-xl border border-border bg-white px-3" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">Ajustes del período cerrado</summary>
    {open && <div className="space-y-3 break-words pb-3 text-sm">
      {!history && !requestError && <p role="status">Consultando ajuste…</p>}
      {requestError && <>
        <p role="alert" className="text-red-800">{requestError}</p>
        <button type="button" className={buttonStyle} onClick={() => setRefresh(value => value + 1)}>Volver a consultar</button>
      </>}
      {saveError && <p role="alert" className="text-red-800">{saveError}</p>}
      {pendingOperation && <button type="button" className={buttonStyle} disabled={saving} onClick={() => void save(pendingOperation)}>
        Reintentar la misma operación
      </button>}
      {history && <>
        <dl className="grid gap-2 sm:grid-cols-2">
          <div><dt className="font-semibold">Importe original del gasto</dt><dd>{history.originalAmount} {history.currency}</dd></div>
          <div><dt className="font-semibold">Importe para control interno</dt><dd>{history.effectiveAmount} {history.currency}</dd></div>
        </dl>
        <p className="text-xs text-text-secondary">Período {history.period}. La factura y el registro original se conservan. Los reportes oficiales mantienen el importe original.</p>
        {history.items.length > 0 && <ul aria-label="Historial de ajustes" className="space-y-2">
          {history.items.map(entry => <AdjustmentRow key={entry.id} entry={entry} currency={history.currency} />)}
        </ul>}
        {history.canPropose && <form className="space-y-2" onSubmit={event => {
          event.preventDefault();
          if (locked) return;
          void save({ action: 'expense-adjustment-propose', body: { id: expenseId, version: history.version, amount, reason } });
        }}>
          <label className="block">Importe ajustado ({history.currency})
            <input className={fieldStyle} value={amount} onChange={event => setAmount(event.target.value)} type="number" min="0" step="0.01" required disabled={locked} />
          </label>
          <label className="block">Motivo y referencia de soporte
            <textarea className={fieldStyle} value={reason} onChange={event => setReason(event.target.value)} maxLength={350} required disabled={locked} />
          </label>
          <button className={buttonStyle} type="submit" disabled={locked}>Proponer ajuste</button>
        </form>}
        {history.canReview && pending && <div className="space-y-2">
          <label className="block">Motivo de revisión
            <textarea className={fieldStyle} value={reviewReason} onChange={event => setReviewReason(event.target.value)} maxLength={350} disabled={locked} />
          </label>
          <div className="flex flex-wrap gap-2">
            {(['Aprobado', 'Rechazado'] as const).map(status => <button className={buttonStyle} type="button" key={status}
              disabled={locked || (status === 'Rechazado' && !reviewReason.trim())} onClick={() => void save({
                action: 'expense-adjustment-review', body: { id: expenseId, version: history.version,
                  adjustmentId: pending.id, status, reason: reviewReason },
              })}>{status === 'Aprobado' ? 'Aprobar ajuste' : 'Rechazar ajuste'}</button>)}
          </div>
        </div>}
      </>}
    </div>}
  </details>;
}
