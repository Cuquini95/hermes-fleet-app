// Runs only against an in-memory Postgres engine, with disposable fixtures.
// Run with an installed PGlite 0.5.16: HERMES_PGLITE_ENTRY=/absolute/path/to/dist/index.js node scripts/qa-rollout/verify-panama-restore.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

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
  console.log(JSON.stringify({ environment: 'Postgres aislado / adjunto archivado sintético',
    restoredInMs: Math.round(performance.now() - began), concurrentCreations: 2, folios: 'OT-0100..0103 / OC 3001..3004',
    retained: ['OT y evidencia', 'aprobación de OC', 'recepción y saldo', 'comprobante de reintento'] }));
} catch (error) {
  console.error(error.message, error.code ?? '');
  process.exitCode = 1;
} finally {
  await restored?.close();
  await db.close();
}
