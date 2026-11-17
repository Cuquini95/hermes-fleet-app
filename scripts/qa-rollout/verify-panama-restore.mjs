// Runs only against an in-memory Postgres engine, with disposable fixtures.
// Run with an installed PGlite 0.5.16: HERMES_PGLITE_ENTRY=/absolute/path/to/dist/index.js node scripts/qa-rollout/verify-panama-restore.mjs
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { jsPDF } from 'jspdf';
import { dispatchWorkshop } from '../../api/_lib/hermes-workshop.js';
import { dispatchEvidence } from '../../api/_lib/hermes-evidence.js';
import { createPanamaOperationalStore } from '../../api/_lib/hermes-operational-store.js';
import { dispatchPurchasing, PURCHASE_TABS } from '../../api/_lib/hermes-purchasing.js';
import * as alertDelivery from '../../api/_lib/hermes-panama-alert-delivery.js';
import { exerciseAlertDelivery } from './alert-delivery-case.mjs';

const entry = process.env.HERMES_PGLITE_ENTRY;
if (!entry || !isAbsolute(entry)) throw new Error('Indica la ruta absoluta de PGlite en HERMES_PGLITE_ENTRY.');
const { PGlite } = await import(pathToFileURL(entry).href);
const previousRepo = process.env.HERMES_QA_PREVIOUS_REPO;
if (previousRepo && !isAbsolute(previousRepo)) throw new Error('Indica la ruta absoluta del checkout anterior.');
const repo = fileURLToPath(new URL('../../', import.meta.url));
const gitHead = cwd => execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
const db = new PGlite();
let restored;
const migration = async file => db.exec(await readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8'));
const orders = 'ORDENES_TRABAJO';
const purchases = 'Órdenes de Compra';
const lines = 'OC_Lineas';
const warrantyTab = 'HERMES_PA_GARANTIAS';
const odometerTab = 'HERMES_PA_ODOMETRO';
const operatorId = '00000000-0000-4000-8000-000000000001';
const qaExpenseEnv = { HERMES_PANAMA_EXPENSE_CLOSED_THROUGH: '2026-10', HERMES_PANAMA_EXPENSE_REVIEWER_IDS: operatorId };
const savedEnv = Object.fromEntries(Object.keys(qaExpenseEnv).map(key => [key, process.env[key]]));
const evidenceId = '1'.repeat(64);
const warrantyEvidenceId = '2'.repeat(64);
const attachment = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n2IAAAAASUVORK5CYII=', 'base64');
const warrantyPdf = new jsPDF();
warrantyPdf.text('Garantía de prueba · OT-0100', 20, 20);
const warrantyAttachment = Buffer.from(warrantyPdf.output('arraybuffer'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const evidenceLink = id => `/hermes-api/api/evidence?id=${id}`;
const ot = (id, evidence = '') => ['', id, '2026-11-14', 'QA-DZ203', '', '', '', '', '', 'Abierta', evidence];
const oc = (id, state) => Object.assign(Array(19).fill(''), { 0: id, 1: '2026-11-14', 5: 'QA-DZ203', 11: state,
  13: 'Gerencia QA', 17: operatorId, 18: '2026-11-14T16:00:00Z' });

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

function storeOnMemoryDatabase(connection, units, createStore = createPanamaOperationalStore) {
  return createStore({
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

async function candidateAddedMigrations() {
  if (!previousRepo) return [];
  const old = new Set(await readdir(resolve(previousRepo, 'supabase/migrations')));
  const now = await readdir(resolve(repo, 'supabase/migrations'));
  const added = now.filter(name => /^\d{14}_.+\.sql$/.test(name) && !old.has(name)).sort();
  const existingFixtureJournals = [
    '20261116030000_hermes_panama_expense_adjustments.sql',
    '20261116031000_hermes_panama_alert_delivery.sql',
  ];
  for (const name of existingFixtureJournals.filter(name => old.has(name))) await migration(name);
  for (const name of added) await migration(name);
  return added;
}

async function verifyEvidenceArchive(connection, archive) {
  const { rows: metadata } = await connection.query(
    'select id, byte_size, sha256 from public.hermes_panama_evidence where ready order by id',
  );
  const recovered = new Map(Object.entries(archive).map(([id, data]) => [id, Buffer.from(data, 'base64')]));
  for (const row of metadata) {
    const bytes = recovered.get(row.id);
    assert.ok(bytes, `Falta el adjunto ${row.id}`);
    assert.equal(bytes.length, row.byte_size, `Tamaño incorrecto del adjunto ${row.id}`);
    assert.equal(sha(bytes), row.sha256, `SHA-256 incorrecto del adjunto ${row.id}`);
  }
  assert.equal(recovered.size, metadata.length, 'Hay archivos archivados sin registro restaurado');
  return recovered;
}

async function checkPrivateAttachment(download, connection, sheets, session, files, id) {
  const res = {
    headers: new Map(),
    setHeader(key, value) { this.headers.set(key, value); },
    status(code) { this.code = code; return this; },
    send(bytes) { this.bytes = bytes; return this; },
    json(payload) { this.payload = payload; return this; },
  };
  await download({
    req: { method: 'GET', query: { id }, headers: { 'sec-fetch-site': 'same-origin' } },
    res, session, sheets,
    storage: {
      async find(id) {
        const { rows: stored } = await connection.query('select * from public.hermes_panama_evidence where id=$1', [id]);
        return stored[0];
      },
      async read(row) {
        const file = files.get(row.id);
        if (!file) throw new Error('Adjunto archivado no disponible');
        return file;
      },
    },
  });
  return res;
}

async function verifyRestoredDownloads(download, connection, sheets, files) {
  const cases = [
    { id: evidenceId, mimeType: 'image/png', bytes: attachment },
    { id: warrantyEvidenceId, mimeType: 'application/pdf', bytes: warrantyAttachment },
  ];
  const sessions = [
    { role: 'coordinador', userId: '00000000-0000-4000-8000-000000000002' },
    { role: 'jefe_taller', userId: '00000000-0000-4000-8000-000000000003' },
  ];
  const access = { project: 'tmf-panama', assignedUnits: ['QA-DZ203'] };
  for (const session of sessions) {
    for (const { id, mimeType, bytes } of cases) {
      const result = await checkPrivateAttachment(download, connection, sheets, { ...access, ...session }, files, id);
      assert.equal(result.code, 200, `${session.role} · ${mimeType}: ${JSON.stringify(result.payload)}`);
      assert.equal(result.headers.get('Content-Type'), mimeType);
      assert.deepEqual(result.bytes, bytes);
    }
  }
  return { roles: sessions.map(session => session.role), mediaTypes: cases.map(item => item.mimeType), downloads: sessions.length * cases.length };
}

async function seedClosedAdjustment(connection) {
  const id = 'GST-REVERSION-QA';
  const unit = 'QA-DZ203';
  const author = { userId: '00000000-0000-4000-8000-000000000002', userName: 'Captura QA', project: 'tmf-panama',
    role: 'coordinador', assignedUnits: [unit] };
  const reviewer = { ...author, userId: operatorId, userName: 'Contabilidad QA', role: 'gerencia' };
  const original = Object.assign(Array(29).fill(''), { 0: id, 1: '15/10/2026', 3: 'Combustible', 4: 'Proveedor QA',
    7: '100.00', 8: '7.00', 9: '107.00', 10: unit, 16: 'Aprobado', 17: 'GST-REVERSION-QA',
    18: author.userId, 19: '107.00', 21: 'TP_PA', 22: 'USD', 24: '15/10/2026' });
  await save(connection, 'expense-restore-qa', [{ tab: PURCHASE_TABS.expenses, append: [original] }], { id });
  const sheets = storeOnMemoryDatabase(connection, [unit]);
  const call = (action, session, body) => dispatchPurchasing({ path: 'api/purchasing/expense-' + action,
    method: body ? 'POST' : 'GET', query: { id }, body, session, sheets });
  const viewed = await call('adjustments', author);
  assert.equal(viewed.status, 200);
  const proposal = await call('adjustment-propose', author, { id, amount: '97.00', reason: 'Ajuste de prueba del período cerrado',
    operationId: randomUUID(), version: viewed.body.version });
  assert.equal(proposal.status, 200, JSON.stringify(proposal.body));
  const pending = await call('adjustments', reviewer);
  const approved = await call('adjustment-review', reviewer, { id, operationId: randomUUID(), version: pending.body.version,
    adjustmentId: proposal.body.adjustmentId, status: 'Aprobado' });
  assert.equal(approved.status, 200, JSON.stringify(approved.body));
  return { id, author, reviewer, original };
}

async function verifyRollback(connection, files, added, adjustment) {
  if (!previousRepo) return null;
  const previous = gitHead(previousRepo);
  const candidate = gitHead(repo);
  assert.notEqual(previous, candidate, 'El checkout anterior debe ser distinto de la candidata.');
  for (const dir of [previousRepo, repo]) {
    const changed = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: dir, encoding: 'utf8' });
    assert.equal(changed.trim(), '', 'Usa los dos checkouts sin cambios pendientes para acreditar la reversión.');
  }
  const before = (await connection.query('select name, rows from public.hermes_panama_operational_tables order by name')).rows;
  const loadPrevious = file => import(pathToFileURL(resolve(previousRepo, 'api/_lib', file)).href);
  const started = performance.now();
  const [{ dispatchWorkshop: oldWorkshop }, { dispatchPurchasing: oldPurchasing }, { dispatchEvidence: oldEvidence },
    { createPanamaOperationalStore: oldStore }] = await Promise.all([
    loadPrevious('hermes-workshop.js'), loadPrevious('hermes-purchasing.js'), loadPrevious('hermes-evidence.js'),
    loadPrevious('hermes-operational-store.js'),
  ]);
  const unit = 'QA-DZ203';
  const session = { userId: operatorId, userName: 'Gerencia QA', project: 'tmf-panama', role: 'gerencia', allUnits: true };
  const oldSheets = storeOnMemoryDatabase(connection, [unit], oldStore);
  const oldOrder = await oldWorkshop({ path: 'api/workshop/orders', method: 'GET', sheets: oldSheets, session });
  assert.equal(oldOrder.status, 200);
  assert(oldOrder.body.orders.some(row => row[1] === 'OT-HIST-QA' && row[25] === 'OT-0100' && row[10] === evidenceLink(evidenceId)));
  const purchase = await oldPurchasing({ path: 'api/purchasing/order', method: 'GET', query: { folio: '3002' }, sheets: oldSheets, session });
  assert.equal(purchase.status, 200, JSON.stringify(purchase.body));
  assert.deepEqual([purchase.body.order.status, purchase.body.order.approvedById, purchase.body.order.receiptStatus,
    purchase.body.order.lines[0].received, purchase.body.order.lines[0].receipts[0].reference],
  ['Recibida parcial', operatorId, 'Recibida parcial', '2', 'Guía restaurada QA']);
  const stock = await oldPurchasing({ path: 'api/purchasing/inventory-stock', method: 'GET', sheets: oldSheets, session });
  assert.equal(stock.status, 200);
  assert(stock.body.items.some(item => item.partNumber === 'RESERVA-QA' && item.available === '1' && item.reserved === '3'));
  const evidence = await verifyRestoredDownloads(oldEvidence, connection, oldSheets, files);
  const forbiddenEdit = await oldPurchasing({ path: 'api/purchasing/expense-delete', method: 'POST',
    body: { id: adjustment.id, operationId: randomUUID() }, sheets: oldSheets, session: adjustment.author });
  assert.equal(forbiddenEdit.status, 409);
  assert.match(forbiddenEdit.body.error, /período/);
  assert.deepEqual((await rows(connection, PURCHASE_TABS.expenses)).find(row => row[0] === adjustment.id), adjustment.original);
  const readyInMs = Math.round(performance.now() - started);

  const body = { mutationId: randomUUID(), unit, type: 'Hidráulica', description: 'Avería QA durante la reversión',
    canMove: true, stopped: false };
  const report = (dispatch, sheets) => dispatch({ path: 'api/workshop/report', method: 'POST', body, sheets, session });
  const written = await report(oldWorkshop, oldSheets);
  assert.equal(written.status, 201, JSON.stringify(written.body));
  const reapplied = storeOnMemoryDatabase(connection, [unit]);
  const retry = await report(dispatchWorkshop, reapplied);
  assert.equal(retry.status, 200, JSON.stringify(retry.body));
  assert.equal(retry.body.otId, written.body.otId);
  const matching = (await rows(connection, orders)).filter(row => row[1] === written.body.otId);
  assert.equal(matching.length, 1);
  assert.match(matching[0][25], /^OT-\d+$/);
  const unchanged = ['HERMES_PA_GARANTIAS', 'HERMES_PA_ODOMETRO', 'HERMES_PA_AJUSTES_GASTOS', 'HERMES_PA_ENTREGA_ALERTAS'];
  for (const stored of before.filter(row => unchanged.includes(row.name))) {
    assert.deepEqual(await rows(connection, stored.name), stored.rows);
  }
  await verifyRestoredDownloads(dispatchEvidence, connection, reapplied, files);
  const adjusted = await dispatchPurchasing({ path: 'api/purchasing/expense-adjustments', method: 'GET', sheets: reapplied,
    session: adjustment.reviewer, query: { id: adjustment.id } });
  assert.equal(adjusted.status, 200);
  assert.deepEqual([adjusted.body.originalAmount, adjusted.body.effectiveAmount], ['107.00', '97.00']);
  return {
    olderCodeRanOnRestoredSchema: true, previous, candidate, readyInMs, appliedMigrations: added, evidence,
    compatible: ['Consulta de OT', 'Aprobación y recepción de OC', 'Saldo reservado y disponible', 'Descarga privada con integridad',
      'Alta de avería con folio', 'Reintento del alta al volver a la candidata', 'Protección del gasto del período cerrado'],
    retainedNewJournals: Object.fromEntries(before.filter(row => unchanged.includes(row.name)).map(row => [row.name, row.rows.length - 1])),
    recoveryAfterReapply: 'El ajuste aprobado vuelve a estar disponible en la candidata',
  };
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
  await save(db, 'legacy', [{ tab: orders, append: [ot('OT-HIST-QA', evidenceLink(evidenceId))] },
    { tab: purchases, append: [oc('OC-HIST-QA', 'Aprobada')] }], { otId: 'OT-HIST-QA', folio: 'OC-HIST-QA' });
  await migration('20261114181455_hermes_panama_purchase_numbers.sql');
  await migration('20261114231214_hermes_panama_work_order_numbers.sql');
  assert.deepEqual((await rows(db, orders))[1].slice(0, 2), ['', 'OT-HIST-QA']);
  assert.equal((await rows(db, orders))[1][25], 'OT-0100');
  assert.equal((await rows(db, purchases))[1][27], '3001');

  const create = (connection, n) => save(connection, `create-${n}`, [
    { tab: orders, append: [ot(`OT-NEW-QA-${n}`)] },
    { tab: purchases, append: [oc(`OC-NEW-QA-${n}`, 'Recibida parcial')] },
    { tab: lines, append: [[`OC-NEW-QA-${n}`, '1', 'Filtro QA', '4', '', '', 'LINE-QA', '', '', 'SKU-QA', '2',
      JSON.stringify([{ id: `RECEPCIÓN-QA-${n}`, quantity: '2', reference: 'Guía restaurada QA',
        actorId: operatorId, by: 'Almacén QA', at: '2026-11-14T17:00:00Z' }])]] },
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
  const addWarrantyEvidence = (recordId, slot) => db.query(`insert into public.hermes_panama_evidence
    (id,actor_id,kind,operation_id,slot,units,record_id,preview_demo,mime_type,byte_size,sha256,ready)
    values ($1,$2,'warranty',$2,$3,array['QA-DZ203'],$4,false,'application/pdf',$5,$6,true)`,
    [warrantyEvidenceId, operatorId, slot, recordId, warrantyAttachment.length, sha(warrantyAttachment)]);
  await assert.rejects(() => addWarrantyEvidence('', 0), { code: '23514' });
  await assert.rejects(() => addWarrantyEvidence('OT-HIST-QA', 4), { code: '23514' });
  await addWarrantyEvidence('OT-HIST-QA', 0);
  await save(db, 'warranty-qa', [{ tab: warrantyTab, append: [['2026-11-15T08:00:00.000Z', 'OT-HIST-QA',
    'garantia_ot', 'GAR-QA', JSON.stringify({ caseId: 'GAR-QA', action: 'coverage', requestId: operatorId, attachments: [evidenceLink(warrantyEvidenceId)] }),
    'Gerencia QA', 'gerencia', operatorId]] }], { caseId: 'GAR-QA' });
  const warrantyRows = await rows(db, warrantyTab);
  assert.equal(warrantyRows.length, 2);
  assert.equal((await rows(db, 'OT_STATUS_LOG')).length, 1);

  await migration('20261116015100_hermes_panama_manual_odometer.sql');
  const odometer = ['QA-DZ203', '2026-11-14T13:00:00Z', '170', 'Parte QA odómetro', '2026-11-14T14:00:00Z', operatorId];
  await save(db, 'odometer-qa', [{ tab: odometerTab, append: [odometer] }], { value: '170', measure: 'km' });
  assert.equal((await rows(db, '04B Registro Horómetros')).length, 1);

  const added = await candidateAddedMigrations();
  let adjustment;
  let alertProof;
  if (previousRepo) {
    Object.assign(process.env, qaExpenseEnv);
    adjustment = await seedClosedAdjustment(db);
    alertProof = await exerciseAlertDelivery(alertDelivery, { sheets: storeOnMemoryDatabase(db, []) });
  }
  const warehouseReserve = await verifyWarehouseReserve(db);
  // Reserving stock legitimately advances the linked OT version before the backup.
  expected[orders] = await rows(db, orders);
  const protectedTables = [PURCHASE_TABS.catalog, PURCHASE_TABS.inventoryMovements,
    ...(previousRepo ? ['HERMES_PA_AJUSTES_GASTOS', 'HERMES_PA_ENTREGA_ALERTAS'] : [])];
  const durableSnapshots = await Promise.all(protectedTables.map(async tab => [tab, await rows(db, tab)]));
  const backup = await db.dumpDataDir('gzip');
  const attachmentArchive = JSON.stringify({
    [evidenceId]: attachment.toString('base64'),
    [warrantyEvidenceId]: warrantyAttachment.toString('base64'),
  });
  const began = performance.now();
  restored = await PGlite.create({ loadDataDir: backup });
  for (const [table, contents] of [...Object.entries(expected), ...durableSnapshots]) {
    assert.deepEqual(await rows(restored, table), contents, 'Restauración de ' + table);
  }
  const recoveredArchive = JSON.parse(attachmentArchive);
  const recoveredFiles = await verifyEvidenceArchive(restored, recoveredArchive);
  const restoreReadyInMs = Math.round(performance.now() - began);
  const evidence = await verifyRestoredDownloads(dispatchEvidence, restored, storeOnMemoryDatabase(restored, ['QA-DZ203']), recoveredFiles);
  evidence.allDownloadsInMs = Math.round(performance.now() - began);
  await assert.rejects(verifyEvidenceArchive(restored, { [evidenceId]: recoveredArchive[evidenceId] }), /Falta el adjunto/);
  const corruptedPdf = Buffer.from(warrantyAttachment);
  corruptedPdf[12] ^= 1;
  await assert.rejects(verifyEvidenceArchive(restored, {
    ...recoveredArchive, [warrantyEvidenceId]: corruptedPdf.toString('base64'),
  }), /SHA-256 incorrecto/);
  evidence.missingArchiveEntryDetected = true;
  evidence.corruptedArchiveEntryDetected = true;
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
  const rollback = await verifyRollback(restored, recoveredFiles, added, adjustment);
  console.log(JSON.stringify({ environment: 'Postgres aislado / adjunto archivado sintético',
    restoreReadyInMs, verificationInMs: Math.round(performance.now() - began), evidence, rollback, ...(alertProof && { alertProof }),
    concurrentCreations: 2, folios: 'OT-0100..0103 / OC 3001..3004',
    batchFolios, warehouseReserve, retained: ['OT y evidencia', 'aprobación de OC', 'recepción y saldo', 'comprobante de reintento', 'garantía y evidencia privada', 'odómetro separado de horas', 'stock y reservas',
      ...(previousRepo ? ['ajustes autorizados', 'acuses y reintentos de alertas'] : [])] }));
} catch (error) {
  console.error(error.message, error.code ?? '');
  process.exitCode = 1;
} finally {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await restored?.close();
  await db.close();
}
