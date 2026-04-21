/**
 * Swarm test — 10 concurrent entries × 9 tabs = 90 total writes
 * All tabs run in parallel. Sheets polling is parallel too.
 * Verifies: PocketBase (VPS 200), Sheets (gviz), no duplicates.
 */

const VPS  = 'http://5.78.204.80:8000';
const SSID = '14rWfjrJbXTZG_Mth1Gzk3RzVYd5mohbJR3BsXEItFgU';
const TS   = Date.now();
const BASE = `SW${TS}`;
const N    = 10;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const d = () => '11/04/2026';
const t = () => '20:00:00';

// ── Row builders ──────────────────────────────────────────────────────────────
function mkRow(tab, i) {
  const mk = `${BASE}_${String(i).padStart(2,'0')}`;
  switch (tab) {
    case 'Combustible':
      return [d(), t(), 'EPAK-09', mk, 'Diesel', '80', '26.50', '15420', '0', '0', 'Est. Peña Col.'];
    case '14 Inspecciones':
      return ['', d(), t(), 'EPAK-09', 'Kenworth T680', mk, 'Salida', '15420',
              '10','10','10','10','10','10','10','10','10','10','10','10','Aprobado','100'];
    case '04B Registro Horómetros':
      return [d(), t(), 'EPAK-09', 'Kenworth T680', mk, 'Matutino', '15420', '15500', '80'];
    case 'Reporte_Viajes_Peña':
      return [d(), t(), 'EPAK-09', mk, 'Peña Colorada', 'Manzanillo', '850', ''];
    case 'Averías':
      return [d(), t(), 'EPAK-09', 'Mecánica', 'Fuga de aceite', 'alta', mk,
              '', '', '', '', '', '', '', '', 'Abierta'];
    case '02 Gastos':
      return [`GST-${mk}`, d(), t(), 'Refaccion', 'Proveedores GTP', '', 'F-001',
              '100.00', '16.00', '116.00', 'EPAK-09', '', 'Coordinador', 'Efectivo', 'Swarm test', '', 'Aprobado'];
    case 'OT_STATUS_LOG':
      return [new Date().toISOString(), `OT-${mk}`, 'Abierta→En Reparación',
              'Abierta', 'En Reparación', 'Coordinador', 'coordinador'];
    case '05 Historial PM': {
      const parts = ['Aceite Motor 15W40','Filtro Aceite','Filtro Combustible','Filtro Aire','Grasas'];
      return [d(), 'EPAK-09', parts[i % parts.length], '15420', mk, '15500', '80', 'Preventivo', 'OK'];
    }
    case 'Reporte_Fletes_Transporte':
      return [d(), t(), 'EPAK-09', mk, '', '', 'Cerro Grande', 'Planta Peña', '14',
              'GTP', 'Tierra', '20', '0'];
    default: return [];
  }
}

// ── Search col per tab (0-based) ──────────────────────────────────────────────
const SEARCH_COL = {
  'Combustible':               3,
  '14 Inspecciones':           5,
  '04B Registro Horómetros':   4,
  'Reporte_Viajes_Peña':       3,
  'Averías':                   6,
  '02 Gastos':                 0,
  'OT_STATUS_LOG':             1,
  '05 Historial PM':           4,
  'Reporte_Fletes_Transporte': 3,
};

const TABS = Object.keys(SEARCH_COL);

// ── Sheets counter via gviz ───────────────────────────────────────────────────
async function countInSheets(tab, marker) {
  const url = `https://docs.google.com/spreadsheets/d/${SSID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tab)}&range=A1:T1000`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    const text = await res.text();
    const json = JSON.parse(text.replace(/^[^(]+\(/, '').replace(/\);\s*$/, ''));
    const rows = (json?.table?.rows || []).map(r => r.c?.map(c => String(c?.v ?? c?.f ?? '')));
    return rows.filter(r => r?.some(cell => cell.includes(marker))).length;
  } catch { return -1; }
}

// ── Send one row ──────────────────────────────────────────────────────────────
async function sendOne(tab, i) {
  const start = Date.now();
  try {
    const r = await fetch(`${VPS}/api/sheets/append`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tab, values: mkRow(tab, i) }),
      signal: AbortSignal.timeout(90000),
    });
    return { ok: r.status === 200, status: r.status, ms: Date.now() - start };
  } catch (e) {
    return { ok: false, ms: Date.now() - start, err: e.message };
  }
}

// ── Test one tab (writes + poll) ──────────────────────────────────────────────
async function testTab(tab) {
  // Fire all N writes concurrently
  const sends = await Promise.all(
    Array.from({ length: N }, (_, i) => sendOne(tab, i + 1))
  );
  const pbOk  = sends.filter(s => s.ok).length;

  // Poll Sheets up to 3 min
  const deadline = Date.now() + 180_000;
  let sheetsCount = 0;
  let elapsed = 0;
  while (Date.now() < deadline) {
    await sleep(5000);
    sheetsCount = await countInSheets(tab, BASE);
    elapsed = Math.round((Date.now() - (deadline - 180_000)) / 1000);
    if (sheetsCount >= N) break;
  }

  const sheetsOk  = sheetsCount >= N ? `✅ ${sheetsCount}/${N} (~${elapsed}s)` :
                    sheetsCount  > 0 ? `⚠️  ${sheetsCount}/${N} after ${elapsed}s` :
                                       `❌  0/${N} after ${elapsed}s`;
  const dupStatus = sheetsCount > N  ? `⚠️  DUPLICATES (${sheetsCount})` :
                    sheetsCount === N ? '✅ no dups' : '—';

  const label = tab.padEnd(30);
  const pbStr = pbOk === N ? `✅ ${pbOk}/${N}` : `❌ ${pbOk}/${N}`;
  console.log(`  ${label}  PB: ${pbStr}  Sheets: ${sheetsOk}  ${dupStatus}`);

  return { tab, pbOk, sheetsCount };
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(75)}`);
console.log(`  SWARM TEST — ${N} entries × ${TABS.length} tabs = ${N * TABS.length} total (all parallel)`);
console.log(`  Marker: ${BASE}`);
console.log(`${'═'.repeat(75)}`);

// VPS health
const hStart = Date.now();
const hOk = await fetch(`${VPS}/`, { signal: AbortSignal.timeout(5000) }).then(() => true).catch(() => false);
console.log(`\n  VPS: ${hOk ? '✅' : '❌'} — ${Date.now()-hStart}ms\n`);
console.log(`  ${'Tab'.padEnd(30)}  PocketBase       Sheets                  Dup`);
console.log(`  ${'─'.repeat(72)}`);

// Run ALL tabs concurrently
const results = await Promise.all(TABS.map(testTab));

// Summary
const totalPb     = results.reduce((a, r) => a + r.pbOk, 0);
const totalSheets = results.reduce((a, r) => a + Math.min(r.sheetsCount, N), 0);
const total       = N * TABS.length;
const failed      = results.filter(r => r.pbOk < N || r.sheetsCount < N);

console.log(`\n${'═'.repeat(75)}`);
console.log(`  PocketBase: ${totalPb}/${total}   Sheets: ${totalSheets}/${total}`);
if (failed.length) {
  console.log(`\n  Issues:`);
  failed.forEach(r => console.log(`    • ${r.tab}: PB ${r.pbOk}/${N}  Sheets ${r.sheetsCount}/${N}`));
}
console.log(`\n  📱 Telegram: check for ${TABS.length} × ${N} bursts — Marker: ${BASE}`);
console.log(`${'═'.repeat(75)}\n`);
