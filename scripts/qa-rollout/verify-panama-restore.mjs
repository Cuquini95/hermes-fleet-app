// Runs only against an in-memory Postgres engine, with disposable fixtures.
// Run with an installed PGlite 0.5.16: HERMES_PGLITE_ENTRY=/absolute/path/to/dist/index.js node scripts/qa-rollout/verify-panama-restore.mjs
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { dispatchWorkshop } from '../../api/_lib/hermes-workshop.js';
import { createPanamaOperationalStore } from '../../api/_lib/hermes-operational-store.js';

const entry = process.env.HERMES_PGLITE_ENTRY;
if (!entry || !isAbsolute(entry)) throw new Error('Indica la ruta absoluta de PGlite en HERMES_PGLITE_ENTRY.');
const { PGlite } = await import(pathToFileURL(entry).href);
const db = new PGlite();
let restored;
const migration = async file => db.exec(await readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8'));
const orders = 'ORDENES_TRABAJO';
const purchases = 'Órdenes de Compra';
const lines = 'OC_Lineas';
const operatorId = '00000000-0000-4000-8000-000000000001';
const evidenceId = '1'.repeat(64);
const attachment = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n2IAAAAASUVORK5CYII=', 'base64');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const ot = id => ['', id, '2026-11-14', 'QA-DZ203', '', '', '', '', '', 'Abierta', `/hermes-api/api/evidence?id=${evidenceId}`];
const oc = (id, state) => Object.assign(Array(14).fill(''), { 0: id, 1: '2026-11-14', 5: 'QA-DZ203', 11: state, 13: 'Gerencia QA' });

async function rows(connection, table) {
  return (await connection.query('select rows from public.hermes_panama_operational_tables where name=$1', [table])).rows[0].rows;
}
async function save(connection, key, changes, outcome) {
  const response = await connection.query(
    'select public.hermes_panama_commit($1,$2,$3,$4::jsonb,$5::jsonb) as saved',
    [key, `hash:${key}`, [`qa:${key}`], JSON.stringify(changes), JSON.stringify(outcome)],
  );
  return response.rows[0].saved;
}

async function verifyPmBatch(connection) {
  const units = ['QA-DZ203', 'QA-EX401'];
  const sheets = createPanamaOperationalStore({
    readInventory: async () => units.map((unit, index) => ['', unit, '', 'QA', String(index + 1)]),
    request: async (path, { query, body }) => {
      if (path.endsWith('/hermes_panama_operational_tables')) {
        const names = query.name.startsWith('eq.') ? [query.name.slice(3)] : JSON.parse(`[${query.name.slice(4, -1)}]`);
        return Response.json((await connection.query(
          'select name,rows from public.hermes_panama_operational_tables where name=any($1::text[])', [names],
        )).rows);
      }
      if (path.endsWith('/hermes_panama_commit_receipts')) {
        return Response.json((await connection.query(
          'select fingerprint,result from public.hermes_panama_commit_receipts where operation_key=$1', [query.operation_key.slice(3)],
        )).rows);
      }
      assert(path.endsWith('/rpc/hermes_panama_commit'));
      const { operation_key, operation_fingerprint, guards, changes, outcome } = body;
      const written = await connection.query('select public.hermes_panama_commit($1,$2,$3,$4::jsonb,$5::jsonb) as saved',
        [operation_key, operation_fingerprint, guards, JSON.stringify(changes), JSON.stringify(outcome)]);
      return Response.json(written.rows[0].saved);
    },
  });
  const request = (endpoint, body, method = 'POST', query) => dispatchWorkshop({
    path: 'api/workshop/' + endpoint, method, body, query, sheets,
    session: { userId: operatorId, userName: 'Coordinación QA', project: 'tmf-panama', role: 'coordinador', assignedUnits: units },
    readPmSources: async () => ({ snapshots: { maintenance: '2026-11-15T21:15:00Z' }, sections: {
      maintenance: units.map((unit, index) => ({ unit, next: index ? 'PM-500' : 'PM-250', hours: '4000', due: index ? '4125' : '3975', reading: 'Actualizada' })),
      maintenancePlan: units.map(unit => ({ unit, active: 'Sí', approved: 'Sí' })),
    } }),
    pmChecklists: units.map((unit, index) => ({ model: `QA ${index + 1}`, level: index ? 'PM-500' : 'PM-250',
      reference: `QA checklist ${unit}`, tasks: [{ id: 'check', label: 'Comprobar QA' }] })),
  });
  const batch = { scheduledDate: '2026-11-16', shift: 'Día', partsStatus: 'not_required',
    items: units.map(unit => ({ unit, hours: '2' })) };
  const review = await request('pmbatchcheck', batch);
  assert.equal(review.status, 200);
  const operation = { ...batch, confirmation: review.body.confirmation, mutationId: randomUUID() };
  const result = await request('pmbatch', operation);
  assert.equal(result.status, 201);
  assert.deepEqual(result.body.orders.map(order => [order.folio, order.dueAt]), [['OT-0104', 3975], ['OT-0105', 4125]]);
  const retry = await request('pmbatch', operation);
  assert.equal(retry.status, 200);
  assert.deepEqual(retry.body.orders, result.body.orders);
  for (const order of result.body.orders) {
    const detail = await request('pmchecklist', undefined, 'GET', { otId: order.otId });
    assert.equal(detail.body.checklist.reference, order.checklistReference);
    assert.equal(detail.body.dueAt, order.dueAt);
  }
  assert.equal((await rows(connection, 'WORKSHOP_SCHEDULE')).length, 3);
  return result.body.orders.map(order => order.folio);
}

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean,
      file_size_limit int, allowed_mime_types text[]);
    create table storage.objects (bucket_id text);
  `);
  await migration('20261113204500_hermes_panama_operational_store.sql');
  await migration('20261113203000_hermes_panama_private_evidence.sql');
  await migration('20261114174000_hermes_panama_purchase_signatures.sql');
  await save(db, 'legacy', [{ tab: orders, append: [ot('OT-HIST-QA')] },
    { tab: purchases, append: [oc('OC-HIST-QA', 'Aprobada')] }], { otId: 'OT-HIST-QA', folio: 'OC-HIST-QA' });
  await migration('20261114181455_hermes_panama_purchase_numbers.sql');
  await migration('20261114231214_hermes_panama_work_order_numbers.sql');
  assert.deepEqual((await rows(db, orders))[1].slice(0, 2), ['', 'OT-HIST-QA']);
  assert.equal((await rows(db, orders))[1][25], 'OT-0100');
  assert.equal((await rows(db, purchases))[1][27], '3001');

  const create = (connection, n) => save(connection, `create-${n}`, [
    { tab: orders, append: [ot(`OT-NEW-QA-${n}`)] },
    { tab: purchases, append: [oc(`OC-NEW-QA-${n}`, 'Aprobada')] },
    { tab: lines, append: [[`OC-NEW-QA-${n}`, '1', 'Filtro QA', '4', '', '', 'LINE-QA', '', '', 'SKU-QA', '2', '[{"quantity":2}]']] },
  ], { otId: `OT-NEW-QA-${n}`, folio: `OC-NEW-QA-${n}` });
  await Promise.all([create(db, 1), create(db, 2)]);
  const expected = Object.fromEntries(await Promise.all([orders, purchases, lines].map(async table => [table, await rows(db, table)])));
  assert.deepEqual(expected[orders].slice(1).map(row => row[25]), ['OT-0100', 'OT-0101', 'OT-0102']);
  assert.deepEqual(expected[purchases].slice(1).map(row => row[27]), ['3001', '3002', '3003']);
  await migration('20261114231214_hermes_panama_work_order_numbers.sql');
  assert.deepEqual(await rows(db, orders), expected[orders], 'A repeat cannot renumber an allocated folio');
  await db.query(`insert into public.hermes_panama_evidence
    (id,actor_id,kind,operation_id,slot,units,record_id,preview_demo,mime_type,byte_size,sha256,ready)
    values ($1,$2,'order',$2,0,array['QA-DZ203'],'OT-HIST-QA',false,'image/png',$3,$4,true)`,
  [evidenceId, operatorId, attachment.length, sha(attachment)]);

  const backup = await db.dumpDataDir('gzip');
  const attachmentArchive = JSON.stringify({ id: evidenceId, bytes: attachment.toString('base64') });
  const began = performance.now();
  restored = await PGlite.create({ loadDataDir: backup });
  for (const [table, contents] of Object.entries(expected)) assert.deepEqual(await rows(restored, table), contents);
  const record = (await restored.query('select id, record_id, sha256, ready from public.hermes_panama_evidence where id=$1', [evidenceId])).rows[0];
  const recoveredFile = JSON.parse(attachmentArchive);
  assert.equal(record.id, recoveredFile.id);
  assert.equal(record.record_id, 'OT-HIST-QA');
  assert.equal(record.sha256, sha(Buffer.from(recoveredFile.bytes, 'base64')));
  assert.equal(record.ready, true);
  assert.equal((await create(restored, 1)).replayed, true);
  assert.deepEqual(await rows(restored, orders), expected[orders]);
  await create(restored, 3);
  assert.equal((await rows(restored, orders)).at(-1)[25], 'OT-0103');
  assert.equal((await rows(restored, purchases)).at(-1)[27], '3004');
  const batchFolios = await verifyPmBatch(restored);
  console.log(JSON.stringify({ environment: 'Postgres aislado / adjunto archivado sintético',
    restoredInMs: Math.round(performance.now() - began), concurrentCreations: 2, folios: 'OT-0100..0103 / OC 3001..3004',
    batchFolios, retained: ['OT y evidencia', 'aprobación de OC', 'recepción y saldo', 'comprobante de reintento'] }));
} catch (error) {
  console.error(error.message, error.code ?? '');
  process.exitCode = 1;
} finally {
  await restored?.close();
  await db.close();
}
