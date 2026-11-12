// Run `node scripts/qa-rollout/run.mjs` after installing the repository dependencies.
// HERMES_QA_REPO may point to a different local checkout and HERMES_QA_EVIDENCE to a writable output directory.
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { checkAuth, checkLoad, checkPurchasing, checkWorkshop } from './api-cases.mjs';
import { checkBrowser } from './browser-cases.mjs';
import { startFixture } from './fixture.mjs';

const exec = promisify(execFile);
const harnessDirectory = fileURLToPath(new URL('../../', import.meta.url));
const repoDirectory = resolve(process.env.HERMES_QA_REPO ?? harnessDirectory);
const out = resolve(process.env.HERMES_QA_EVIDENCE ?? join(tmpdir(), `hermes-rollout-${Date.now()}`));
const distDirectory = await mkdtemp(join(tmpdir(), 'hermes-rollout-build-'));
const flags = new Set(process.argv.slice(2));
const withGateway = !flags.has('--identity-only');
const withBrowser = !flags.has('--api-only');
const withPurchasing = withGateway && !flags.has('--workshop-only');
const results = [];
const revision = async (cwd) => {
  const [git, status] = await Promise.all([
    exec('git', ['rev-parse', 'HEAD'], { cwd }),
    exec('git', ['status', '--short', '--untracked-files=normal'], { cwd }),
  ]);
  return { source: git.stdout.trim(), dirtyTree: Boolean(status.stdout.trim()) };
};
const [initial, harness] = await Promise.all([revision(repoDirectory), revision(harnessDirectory)]);
const report = { ...initial, harness, startedAt: new Date().toISOString(), withGateway, withBrowser, withPurchasing, results };
await mkdir(out, { recursive: true });

async function record(id, check) {
  try {
    const observed = await check();
    const result = { id, status: 'pasa', ...observed };
    results.push(result);
    console.log(JSON.stringify(result));
    return true;
  } catch (error) {
    const result = { id, status: 'falla', message: String(error?.message ?? error).replace(/\u001b\[\d+m/g, '').slice(0, 1250) };
    results.push(result);
    console.log(JSON.stringify(result));
    return false;
  }
}

let fixture;
try {
  const started = await record('FIXTURE-LOOPBACK', async () => {
    fixture = await startFixture({ repoDirectory, distDirectory, withGateway });
    return { host: '127.0.0.1', identityProvider: 'sintético', sheets: 'sintético' };
  });
  if (started) {
    await checkAuth(fixture, record, { withGateway, withPurchasing });
    await checkLoad(fixture, record, withGateway);
    if (withGateway) await checkWorkshop(fixture, record);
    if (withPurchasing) await checkPurchasing(fixture, record);
    if (withBrowser) {
      const built = await record('BUILD-APP', async () => {
        const output = await exec(process.execPath, [join(repoDirectory, 'node_modules/vite/bin/vite.js'), 'build', '--mode', 'rollout-qa', '--outDir', distDirectory], {
          cwd: repoDirectory, env: { PATH: process.env.PATH, HOME: process.env.HOME, ...fixture.buildEnv }, timeout: 90000,
        });
        return { line: output.stdout.split('\n').filter(Boolean).at(-1) };
      });
      if (built) await record('NAVEGADOR-ARRANQUE', async () => ({ browserEgressBlocked: await checkBrowser(fixture, record, out, { withGateway, withPurchasing }) }));
    }
    report.serverEgressBlocked = [...new Set(fixture.outboundBlocked)];
    report.fixtureErrors = fixture.errors;
    await record('REVISIÓN-ESTABLE', async () => {
      const final = await revision(repoDirectory);
      if (final.source !== initial.source || final.dirtyTree !== initial.dirtyTree) throw new Error('El checkout cambió durante la verificación. Repite en una copia estable.');
      return final;
    });
  }
} finally {
  await fixture?.stop();
  await rm(distDirectory, { recursive: true, force: true });
  const filename = join(out, 'verificacion.json');
  report.finishedAt = new Date().toISOString();
  await writeFile(filename, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Evidencia en ${filename}`);
  if (results.some(result => result.status === 'falla')) process.exitCode = 1;
}
