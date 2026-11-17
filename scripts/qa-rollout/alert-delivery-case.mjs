import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { makeSheetsFixture } from './fixture.mjs';

function testReceiver() {
  let fault;
  let lookupUnavailable = false;
  let falsifyReceipt = false;
  let attempts = 0;
  const received = new Map();
  const destination = 'bandeja-pm-qa';
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    function json(value) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(value));
    }
    if (req.method === 'GET') {
      if (lookupUnavailable) return json({ status: 'unknown' });
      const receipt = received.get(url.searchParams.get('batchId'));
      return json(receipt
        ? { status: 'found', receipt: falsifyReceipt ? { ...receipt, destination: 'otra-bandeja-qa' } : receipt }
        : { status: 'absent' });
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const { batchId, fingerprint, digest, destination: target } = JSON.parse(Buffer.concat(chunks).toString());
    assert.equal(target, destination);
    attempts++;
    const failure = fault;
    fault = undefined;
    if (failure === 'before') return json({ status: 'rejected' });
    const receipt = { id: `QA-${received.size + 1}`, batchId, fingerprint, destination };
    if (!received.has(batchId)) received.set(batchId, { ...receipt, digest });
    if (failure === 'after') return req.socket.destroy();
    return json({ status: 'accepted' });
  });
  return {
    destination,
    received,
    attempts: () => attempts,
    fail: value => { fault = value; },
    failLookup: value => { lookupUnavailable = value; },
    invalidateReceipt: value => { falsifyReceipt = value; },
    async start() {
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const url = `http://127.0.0.1:${server.address().port}`;
      return {
        idempotent: true,
        lookup: async ({ batchId }) => (await fetch(`${url}/?batchId=${encodeURIComponent(batchId)}`)).json(),
        deliver: async record => (await fetch(url, { method: 'POST', body: JSON.stringify(record) })).json(),
      };
    },
    async stop() {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    },
  };
}

export async function exerciseAlertDelivery(module, { sheets = makeSheetsFixture() } = {}) {
  const { createPanamaPmAlertDelivery, PANAMA_ALERT_DELIVERIES } = module;
  const sink = testReceiver();
  const receiver = await sink.start();
  try {
    const date1 = '2026-11-15';
    const date2 = '2026-11-16';
    let now = Date.parse('2026-11-15T10:59:59Z');
    const clock = () => now;
    const service = (destination = sink.destination) => createPanamaPmAlertDelivery({ sheets, receiver, destination, clock });
    assert.throws(() => createPanamaPmAlertDelivery({ sheets, receiver: { ...receiver, idempotent: false },
      destination: sink.destination, clock }), /idempotencia/);
    const alerts = [
      { id: 'pm-tarde', unit: 'DZ203', status: 'Vencido', detectedAt: '2026-11-14T11:00:00Z' },
      { id: 'pm-programado', unit: 'EX401', status: 'Programar', detectedAt: '2026-11-13T11:00:01Z' },
      { id: 'pm-pronto', unit: 'DZ205', status: 'Pronto', detectedAt: '2026-11-08T10:59:00Z' },
    ];
    const snapshot = { alerts, closures: 0 };

    assert.equal((await service().run({ date: date1, snapshot })).status, 'before_window');
    assert.equal(sink.attempts(), 0);
    now += 1000;
    assert.equal((await service().run({ date: date1, snapshot: { alerts: [], closures: 0 } })).status, 'empty');

    sink.fail('before');
    assert.equal((await service().run({ date: date1, snapshot })).status, 'retryable');
    assert.equal(sink.received.size, 0);
    const retried = await Promise.all([
      service().run({ date: date1 }),
      service().run({ date: date1 }),
      service().run({ date: date1, snapshot: { alerts: [], closures: 1 } }),
    ]);
    assert(retried.some(result => result.status === 'confirmed'));
    assert.equal(sink.received.size, 1);
    assert.equal(sink.attempts(), 2);
    assert.equal((await service().run({ date: date1 })).status, 'confirmed');
    await assert.rejects(() => service('otro-destino-qa').run({ date: date1 }), /destino.*cambió/);
    const delivered1 = [...sink.received.values()][0];
    assert.equal(delivered1.digest.alerts.length, 3);
    assert.deepEqual(delivered1.digest.escalated.map(row => row.id), ['pm-tarde', 'pm-pronto']);
    assert.equal(delivered1.digest.escalated[0].dueAt, '2026-11-15T11:00:00.000Z');

    now = Date.parse('2026-11-16T11:00:00Z');
    sink.fail('after');
    assert.equal((await service().run({ date: date2, snapshot })).status, 'review');
    assert.equal(sink.received.size, 2);
    assert.equal(sink.attempts(), 3);
    now += 14 * 60_000;
    assert.equal((await service().run({ date: date2 })).status, 'waiting');
    assert.equal(sink.attempts(), 3);

    now += 60_000;
    sink.failLookup(true);
    assert.equal((await service().run({ date: date2 })).status, 'review');
    sink.failLookup(false);
    sink.invalidateReceipt(true);
    now += 15 * 60_000;
    assert.equal((await service().run({ date: date2 })).status, 'review');
    assert.equal(sink.attempts(), 3);
    sink.invalidateReceipt(false);
    now += 15 * 60_000;
    assert.equal((await service().run({ date: date2 })).status, 'confirmed');
    assert.equal(sink.attempts(), 3);
    assert.equal(sink.received.size, 2);
    const delivered2 = [...sink.received.values()][1];
    assert.deepEqual(delivered2.digest.escalated.map(row => row.id), ['pm-programado']);
    assert.equal(delivered2.digest.escalated[0].dueAt, '2026-11-15T11:00:01.000Z');

    const journal = (await sheets.read(PANAMA_ALERT_DELIVERIES)).filter(row => row[0]?.startsWith('PM-FLOTA-'));
    assert(journal.some(row => row[1] === 'retryable'));
    assert(journal.some(row => row[1] === 'review'));
    const confirmed = journal.filter(row => row[1] === 'confirmed');
    assert.equal(confirmed.length, 2);
    assert.equal(new Set(confirmed.map(row => row[4])).size, 2);
    assert(journal.every(row => Number.isFinite(Date.parse(row[2]))));
    return {
      destination: 'receptor sintético en 127.0.0.1',
      batches: confirmed.map(row => row[0]),
      deliveries: sink.received.size,
      sendCalls: sink.attempts(),
      confirmations: confirmed.length,
      duplicateDeliveries: 0,
      faults: ['antes de entregar', 'después de entregar antes del acuse', 'consulta incompleta', 'acuse de otro destino'],
      durableJournalRows: journal.length,
      confirmationDelayMinutes: 15,
      escalations: delivered1.digest.escalated.map(row => ({ id: row.id, dueAt: row.dueAt })),
    };
  } finally {
    await sink.stop();
  }
}

export async function checkAlertDelivery(record, repoDirectory) {
  return record('API-ALERTAS-PM-CONFIRMACION', async () => {
    const path = pathToFileURL(resolve(repoDirectory, 'api/_lib/hermes-panama-alert-delivery.js'));
    return exerciseAlertDelivery(await import(path.href));
  });
}
