// Load only the isolated HTTPS fixture and a disposable Postgres engine.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { checkLoad } from './api-cases.mjs';
import { startFixture } from './fixture.mjs';

const run = promisify(execFile);
const repoDirectory = fileURLToPath(new URL('../../', import.meta.url));
const entry = process.env.HERMES_PGLITE_ENTRY;
if (!entry || !isAbsolute(entry)) throw new Error('Indica la ruta absoluta de PGlite en HERMES_PGLITE_ENTRY.');
const { PGlite } = await import(pathToFileURL(entry).href);
const { createPanamaOperationalStore } = await import('../../api/_lib/hermes-operational-store.js');
const db = new PGlite();
const work = await mkdtemp(join(tmpdir(), 'hermes-concurrencia-'));
const out = resolve(process.env.HERMES_QA_EVIDENCE || work);
const results = [];
const revision = async () => {
  const [commit, status] = await Promise.all([
    run('git', ['rev-parse', 'HEAD'], { cwd: repoDirectory }), run('git', ['status', '--porcelain'], { cwd: repoDirectory }),
  ]);
  return { commit: commit.stdout.trim(), dirtyTree: Boolean(status.stdout.trim()) };
};
const source = await revision();
const report = { source, timeZone: 'America/Panama', startedAt: new Date().toISOString(), results };
let fixture;

async function requestStore(path, { query, body }) {
  if (path.endsWith('/hermes_panama_operational_tables')) {
    const expression = query.name;
    const names = expression.startsWith('eq.') ? [expression.slice(3)] : JSON.parse('[' + expression.slice(4, -1) + ']');
    const { rows } = await db.query(
      'select name,rows from public.hermes_panama_operational_tables where name=any($1::text[])', [names],
    );
    return Response.json(rows);
  }
  if (path.endsWith('/hermes_panama_commit_receipts')) {
    const { rows } = await db.query(
      'select fingerprint,result from public.hermes_panama_commit_receipts where operation_key=$1', [query.operation_key.slice(3)],
    );
    return Response.json(rows);
  }
  assert.equal(path, '/rest/v1/rpc/hermes_panama_commit', 'Ruta fuera del registro operativo aislado');
  const { operation_key, operation_fingerprint, guards, changes, outcome } = body;
  try {
    const { rows: [row] } = await db.query('select public.hermes_panama_commit($1,$2,$3,$4::jsonb,$5::jsonb) as saved',
      [operation_key, operation_fingerprint, guards, JSON.stringify(changes), JSON.stringify(outcome)]);
    return Response.json(row.saved);
  } catch (error) {
    if (!['PT400', 'PT409'].includes(error.code)) throw error;
    return Response.json({ code: error.code, message: error.message }, { status: Number(error.code.slice(2)) });
  }
}

try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  for (const migration of ['20261113204500_hermes_panama_operational_store.sql', '20261114181455_hermes_panama_purchase_numbers.sql',
    '20261114231214_hermes_panama_work_order_numbers.sql']) {
    await db.exec(await readFile(new URL('../../supabase/migrations/' + migration, import.meta.url), 'utf8'));
  }
  report.postgres = (await db.query('show server_version')).rows[0].server_version;
  fixture = await startFixture({ repoDirectory, distDirectory: work, createOperationalSheets: seed => ({
    ...createPanamaOperationalStore({ request: requestStore, readInventory: async () => seed.read('01 Inventario') }),
    seed: async (table, rows) => {
      assert(rows.length > 0, 'La tabla aislada debe conservar su encabezado');
      const updated = await db.query('update public.hermes_panama_operational_tables set rows=$2::jsonb where name=$1',
        [table, JSON.stringify(rows)]);
      assert.equal(updated.affectedRows, 1, 'La semilla debe afectar una sola tabla aislada');
    },
  }) });
  await checkLoad(fixture, async (id, measure) => {
    try {
      results.push({ id, status: 'pasa', ...await measure() });
    } catch (error) {
      results.push({ id, status: 'falla', message: error.message });
    }
  }, true);
  report.fixtureErrors = fixture.errors;
  report.serverEgressBlocked = [...new Set(fixture.outboundBlocked)];
  assert.deepEqual(await revision(), source, 'El checkout cambió durante la medición');
  assert(results.length === 2 && results.every(result => result.status === 'pasa') && !report.fixtureErrors.length
    && !report.serverEgressBlocked.length, 'La carga aislada registró errores; consulta la evidencia');
} catch (error) {
  report.failure = error.message;
  process.exitCode = 1;
} finally {
  await fixture?.stop();
  await db.close();
  await mkdir(out, { recursive: true });
  const filename = join(out, 'concurrencia-postgres.json');
  await writeFile(filename, JSON.stringify({ ...report, finishedAt: new Date().toISOString() }, null, 2) + '\n');
  for (const result of results) console.log(JSON.stringify(result));
  console.log('Evidencia en ' + filename);
  if (out !== work) await rm(work, { recursive: true, force: true });
}
