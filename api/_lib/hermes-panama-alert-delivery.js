import { createHash, randomUUID } from 'node:crypto';

export const PANAMA_ALERT_DELIVERIES = 'HERMES_PA_ENTREGA_ALERTAS';

const recheckMs = 15 * 60_000;
const escalationHours = { Vencido: 24, Programar: 48, Pronto: 168 };
const panamaClock = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Panama', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
});
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const identifier = value => typeof value === 'string' && /^[\w.-]{1,128}$/.test(value);
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const iso = millis => new Date(millis).toISOString();
const marker = ({ id, status }) => id + ':' + status;

function localDay(now) {
  const parts = Object.fromEntries(panamaClock.formatToParts(now).map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

function calendarDate(date) {
  return typeof date === 'string' && datePattern.test(date) && Number.isFinite(Date.parse(date)) && iso(Date.parse(date)).slice(0, 10) === date;
}

function digestFrom(snapshot, date, now, acknowledged) {
  const { alerts, closures = 0 } = snapshot ?? {};
  if (!Array.isArray(alerts) || !Number.isSafeInteger(closures) || closures < 0) {
    throw new Error('Se requiere un corte de PM validado');
  }
  const ids = new Set();
  const open = alerts.map(({ id, unit, status, detectedAt }) => {
    const millis = Date.parse(detectedAt);
    if (!identifier(id) || !identifier(unit) || ids.has(id) || !Object.hasOwn(escalationHours, status)
      || !timestampPattern.test(detectedAt ?? '') || !calendarDate(detectedAt.slice(0, 10)) || !Number.isFinite(millis) || millis > now) {
      throw new Error('El corte contiene un aviso PM inválido o duplicado');
    }
    ids.add(id);
    return { id, unit, status, detectedAt: iso(millis), dueAt: iso(millis + escalationHours[status] * 3_600_000) };
  });
  return {
    date, family: 'FLOTA', alerts: open, closures,
    escalated: open.filter(alert => Date.parse(alert.dueAt) <= now && !acknowledged.has(marker(alert))),
  };
}

function readJournal(rows) {
  return rows.filter(row => row[0]?.startsWith('PM-FLOTA-')).map(([batchId, stage, at, attempt, receiptId, text]) => {
    const detail = JSON.parse(text);
    if (!detail.version || !Number.isFinite(Date.parse(at))) throw new Error('El historial de entrega PM requiere revisión');
    return { batchId, stage, at, attempt: Number(attempt), receiptId, ...detail };
  });
}

function receiptMatches(response, envelope) {
  const receipt = response?.receipt;
  return response?.status === 'found' && identifier(receipt?.id)
    && receipt.batchId === envelope.batchId && receipt.fingerprint === envelope.fingerprint
    && receipt.destination === envelope.destination;
}

/**
 * Server-side PM runner. Bind only to an authorized destination whose adapter supports an
 * idempotency key and authoritative receipt lookup. This module schedules or sends nothing by itself.
 */
export function createPanamaPmAlertDelivery({ sheets, receiver, destination, clock = Date.now }) {
  if (!sheets || receiver?.idempotent !== true || typeof receiver.lookup !== 'function'
    || typeof receiver.deliver !== 'function' || !identifier(destination)) {
    throw new Error('Se requiere un destino PM autorizado con acuses e idempotencia');
  }

  async function persist(batchId, stage, previous, attempt, fields = {}, receiptId = '') {
    const at = iso(clock());
    const detail = { version: randomUUID(), ...fields };
    const row = [batchId, stage, at, String(attempt), receiptId, JSON.stringify(detail)];
    if (row[5].length > 50_000) throw new Error('El corte de PM excede la capacidad de la bitácora');
    const key = `alert-pm:${batchId}:${detail.version}`;
    const fingerprint = hash(row);
    const guard = `alert-pm:${batchId}:after:${previous?.version ?? 'initial'}`;
    try {
      await sheets.commit({
        key, fingerprint, guard, writes: [{ tab: PANAMA_ALERT_DELIVERIES, append: [row] }], result: { version: detail.version },
      });
    } catch (error) {
      if ((error?.status ?? error?.statusCode) === 409) return null;
      if (!(await sheets.replay({ key, fingerprint }))) throw error;
    }
    return { batchId, stage, at, attempt, receiptId, ...detail };
  }

  async function receiveStatus(envelope) {
    try { return await receiver.lookup(envelope); }
    catch { return { status: 'unknown' }; }
  }

  async function run({ date, snapshot } = {}) {
    const now = clock();
    const today = localDay(now);
    if (!calendarDate(date) || date > today.date) {
      throw new Error('Fecha de lote PM inválida');
    }
    const batchId = `PM-FLOTA-${date}`;
    const result = (status, extra = {}) => ({ batchId, status, ...extra });
    const journal = readJournal(await sheets.read(PANAMA_ALERT_DELIVERIES));
    const history = journal.filter(entry => entry.batchId === batchId);
    let last = history.at(-1);
    let prepared = history.find(entry => entry.stage === 'prepared');
    if (!prepared) {
      if (history.length) throw new Error('El lote PM requiere revisar su historial de preparación');
      if (date !== today.date || today.hour < 6) return result('before_window');
      const completed = new Set(journal.filter(entry => entry.stage === 'confirmed').map(entry => entry.batchId));
      const pending = journal.find(entry => entry.stage === 'prepared' && entry.batchId !== batchId && !completed.has(entry.batchId));
      if (pending) return result('pending_previous', { pendingBatchId: pending.batchId });
      const acknowledged = new Set(journal.filter(entry => entry.stage === 'confirmed').flatMap(entry => entry.acknowledged));
      const digest = digestFrom(snapshot, date, now, acknowledged);
      if (digest.alerts.length === 0 && digest.closures === 0) return result('empty');
      const envelope = { batchId, destination, digest, fingerprint: hash([batchId, destination, digest]) };
      prepared = await persist(batchId, 'prepared', undefined, 0, { envelope });
      if (!prepared) return result('busy');
      last = prepared;
    }

    const envelope = prepared.envelope;
    if (envelope.destination !== destination || envelope.batchId !== batchId
      || envelope.fingerprint !== hash([batchId, destination, envelope.digest])) {
      throw new Error('El destino o el corte congelado del lote PM cambió');
    }
    if (last.stage === 'confirmed') return result('confirmed', { receiptId: last.receiptId });
    if (last.retryAt && now < Date.parse(last.retryAt)) return result('waiting', { retryAt: last.retryAt });
    const attempt = last.attempt + 1;
    const hold = reason => ({ reason, retryAt: iso(clock() + recheckMs) });
    const checking = await persist(batchId, 'checking', last, attempt, hold('verificar_acuse'));
    if (!checking) return result('busy');

    async function finish(previous, stage, detail, receiptId) {
      const saved = await persist(batchId, stage, previous, attempt, detail, receiptId);
      return saved ? result(stage, receiptId ? { receiptId } : {}) : result('busy');
    }

    const confirm = (previous, receipt) => finish(previous, 'confirmed', {
      acknowledged: envelope.digest.escalated.map(marker),
    }, receipt.id);
    const receipt = await receiveStatus(envelope);
    if (receiptMatches(receipt, envelope)) return confirm(checking, receipt.receipt);
    if (receipt?.status !== 'absent') return finish(checking, 'review', hold('consulta_incompleta_o_acuse_invalido'));

    const sending = await persist(batchId, 'sending', checking, attempt, hold('entrega_sin_acuse'));
    if (!sending) return result('busy');
    let delivery;
    try { delivery = await receiver.deliver(envelope); }
    catch { return finish(sending, 'review', hold('respuesta_de_entrega_perdida')); }
    if (delivery?.status === 'rejected') return finish(sending, 'retryable', { reason: 'rechazo_antes_de_entrega' });
    const verified = await receiveStatus(envelope);
    return receiptMatches(verified, envelope) ? confirm(sending, verified.receipt)
      : finish(sending, 'review', hold('entrega_no_confirmada'));
  }

  return { run };
}
