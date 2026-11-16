// Runs only against an in-memory Postgres engine, with disposable fixtures.
// Run with an installed PGlite 0.5.16: HERMES_PGLITE_ENTRY=/absolute/path/to/dist/index.js node scripts/qa-rollout/verify-panama-restore.mjs
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { dispatchWorkshop } from '../../api/_lib/hermes-workshop.js';
import { createPanamaOperationalStore } from '../../api/_lib/hermes-operational-store.js';
import { dispatchPurchasing, PURCHASE_TABS } from '../../api/_lib/hermes-purchasing.js';

const entry = process.env.HERMES_PGLITE_ENTRY;
if (!entry || !isAbsolute(entry)) throw new Error('Indica la ruta absoluta de PGlite en HERMES_PGLITE_ENTRY.');
const { PGlite } = await import(pathToFileURL(entry).href);
const db = new PGlite();
let restored;
const migration = async file => db.exec(await readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8'));
const orders = 'ORDENES_TRABAJO';
const purchases = 'Órdenes de Compra';
const lines = 'OC_Lineas';
const warrantyTab = 'HERMES_PA_GARANTIAS';
const odometerTab = 'HERMES_PA_ODOMETRO';
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

function storeOnMemoryDatabase(connection, units) {
  return createPanamaOperationalStore({
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
      try {
        const written = await connection.query('select public.hermes_panama_commit($1,$2,$3,$4::jsonb,$5::jsonb) as saved',
          [operation_key, operation_fingerprint, guards, JSON.stringify(changes), JSON.stringify(outcome)]);
        return Response.json(written.rows[0].saved);
      } catch (error) {
        if (!['PT400','PT409'].includes(error.code)) throw error;
        return Response.json({ code: error.code, message: error.message }, { status: Number(error.code.slice(2)) });
      }
    },
  });
}

async function verifyPmBatch(connection) {
  const units = ['QA-DZ203', 'QA-EX401'];
  const sheets = storeOnMemoryDatabase(connection, units);
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

async function verifyWarehouseReserve(connection) {
  const unit = 'QA-DZ203';
  const sku = 'RESERVA-QA';
  const warehouse = 'Almacén de prueba';
  const [,,,, header] = await rows(connection, PURCHASE_TABS.catalog);
  await save(connection, 'init-warehouse-stock', [
    { tab: PURCHASE_TABS.catalog, row: 4, values: [...header, 'Almacén'] },
    { tab: PURCHASE_TABS.catalog, append: [[sku, 'Filtro QA', '', '', 'pza', '4', '1', '', '', '', unit, '', '', '', warehouse]] },
  ], { ready: true });
  const sheets = storeOnMemoryDatabase(connection, [unit]);
  const session = { userId: operatorId, userName: 'Almacén QA', role: 'jefe_taller', project: 'tmf-panama',
    canReceivePurchases: true, canApprovePurchases: false, assignedUnits: [unit] };
  const call = (action, body) => dispatchPurchasing({ path: 'api/purchasing/' + action, method: body ? 'POST' : 'GET', body, sheets, session });
  const attempts = ['RESERVA-QA-1', 'RESERVA-QA-2'].map(reference => ({ operationId: randomUUID(), kind: 'Reserva',
    warehouse, partNumber: sku, quantity: '3', ot: 'OT-0100', reference }));
  const results = await Promise.all(attempts.map(input => call('inventory-reservation', input)));
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
  const winner = results.findIndex(result => result.status === 200);
  const replay = await call('inventory-reservation', attempts[winner]);
  assert.deepEqual(replay.body, results[winner].body);
  const report = await call('inventory-stock');
  assert.equal(report.status, 200);
  assert.deepEqual(report.body.items.map(item => [item.physical, item.reserved, item.available, item.reservations[0]?.folio]),
    [['4', '3', '1', 'OT-0100']]);
  assert.equal((await rows(connection, PURCHASE_TABS.inventoryMovements)).length, 2);
  return { simultaneous: 2, reserved: '3', available: '1', replayed: true };
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

  await migration('20261116012000_hermes_panama_warranty_evidence.sql');
  const warrantyEvidenceId = '2'.repeat(64);
  const addWarrantyEvidence = (recordId, slot) => db.query(`insert into public.hermes_panama_evidence
    (id,actor_id,kind,operation_id,slot,units,record_id,preview_demo,mime_type,byte_size,sha256,ready)
    values ($1,$2,'warranty',$2,$3,array['QA-DZ203'],$4,false,'application/pdf',30,$5,true)`,
    [warrantyEvidenceId, operatorId, slot, recordId, sha(attachment)]);
  await assert.rejects(() => addWarrantyEvidence('', 0), { code: '23514' });
  await assert.rejects(() => addWarrantyEvidence('OT-HIST-QA', 4), { code: '23514' });
  await addWarrantyEvidence('OT-HIST-QA', 0);
  await save(db, 'warranty-qa', [{ tab: warrantyTab, append: [['2026-11-15T08:00:00.000Z', 'OT-HIST-QA',
    'garantia_ot', 'GAR-QA', JSON.stringify({ caseId: 'GAR-QA', action: 'coverage', attachments: ['/hermes-api/api/evidence?id=' + warrantyEvidenceId] }),
    'Gerencia QA', 'gerencia', operatorId]] }], { caseId: 'GAR-QA' });
  const warrantyRows = await rows(db, warrantyTab);
  assert.equal(warrantyRows.length, 2);
  assert.equal((await rows(db, 'OT_STATUS_LOG')).length, 1);

  await migration('20261116015100_hermes_panama_manual_odometer.sql');
  const odometer = ['QA-DZ203', '2026-11-14T13:00:00Z', '170', 'Parte QA odómetro', '2026-11-14T14:00:00Z', operatorId];
  await save(db, 'odometer-qa', [{ tab: odometerTab, append: [odometer] }], { value: '170', measure: 'km' });
  assert.equal((await rows(db, '04B Registro Horómetros')).length, 1);

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
  const [warranty] = (await restored.query('select kind, record_id, mime_type, ready from public.hermes_panama_evidence where id=$1', [warrantyEvidenceId])).rows;
  assert.deepEqual(warranty, { kind: 'warranty', record_id: 'OT-HIST-QA', mime_type: 'application/pdf', ready: true });
  assert.deepEqual(await rows(restored, warrantyTab), warrantyRows);
  assert.deepEqual((await rows(restored, odometerTab)).at(-1), odometer);
  const batchFolios = await verifyPmBatch(restored);
  const warehouseReserve = await verifyWarehouseReserve(restored);
  console.log(JSON.stringify({ environment: 'Postgres aislado / adjunto archivado sintético',
    restoredInMs: Math.round(performance.now() - began), concurrentCreations: 2, folios: 'OT-0100..0103 / OC 3001..3004',
    batchFolios, warehouseReserve, retained: ['OT y evidencia', 'aprobación de OC', 'recepción y saldo', 'comprobante de reintento', 'garantía y evidencia privada', 'odómetro separado de horas'] }));
} catch (error) {
  console.error(error.message, error.code ?? '');
  process.exitCode = 1;
} finally {
  await restored?.close();
  await db.close();
}
