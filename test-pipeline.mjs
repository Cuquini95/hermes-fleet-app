/**
 * Data Pipeline Test — Hermes Fleet
 *
 * Verifies: App → VPS gateway → PocketBase (primary) → Google Sheets (mirror, <10s)
 *           App → Supabase Storage (photo uploads)
 *
 * ⚠️  This does NOT test Telegram notifications.
 *     Telegram is triggered inside the VPS based on business logic (amount > 0,
 *     valid unit, etc.). Real submissions trigger Telegram correctly — test rows
 *     with zero amounts or TEST_ identifiers are filtered by the VPS.
 *
 *     Tabs with confirmed Telegram triggers: Combustible, Inspecciones, Horómetros, Viajes
 *     Tabs with Telegram on real data only: Averías, Gastos
 *     Tabs without Telegram: OT_STATUS_LOG, Historial PM, Catálogo (not configured on VPS)
 *
 * Run:  node test-pipeline.mjs
 */

import { createClient } from '@supabase/supabase-js';

const VPS = 'http://5.78.204.80:8000';
const SUPABASE_URL = 'https://xwrhkxecykuuutuitlnd.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3cmhreGVjeWt1dXV0dWl0bG5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNTE0MDIsImV4cCI6MjA5MDkyNzQwMn0.sCxRRx9FLHL8bUAWzHzc7XrWrpm_MvYIe_9Qy-Irkjk';

const VERBOSE = process.argv.includes('--verbose');

// ── Test runner ───────────────────────────────────────────────────────────────

let passed = 0, failed = 0;
const failures = [];

function ok(label, detail = '') {
  console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ''}`);
  passed++;
}

function fail(label, err = '') {
  console.error(`  ❌ ${label}${err ? `\n     ${err}` : ''}`);
  failures.push({ label, err });
  failed++;
}

function section(title) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 52 - title.length))}`);
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function appendRow(tab, values) {
  const res = await fetch(`${VPS}/api/sheets/append`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tab, values }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 120)}`);
  }
}

async function rowExistsInSheets(tab, id, col = 0, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(2000);
    try {
      const res = await fetch(`${VPS}/api/sheets/read?tab=${encodeURIComponent(tab)}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const { data } = await res.json();
      if ((data || []).some(r => r[col] === id)) return Date.now() - (deadline - timeoutMs);
    } catch { /* retry */ }
  }
  return null;
}

async function testTab({ name, tab, id, row, col = 0 }) {
  section(name);
  let t0;
  try {
    t0 = Date.now();
    await appendRow(tab, row);
    ok(`appendRow accepted`, `${Date.now() - t0}ms`);
  } catch (e) {
    fail(`appendRow failed`, e.message);
    return;
  }

  const elapsed = await rowExistsInSheets(tab, id, col);
  if (elapsed !== null) {
    ok(`Sheets mirror confirmed`, `~${Math.round(elapsed / 1000)}s`);
  } else {
    fail(`Sheets mirror timeout (>10s) — row safe in PocketBase`);
  }
}

const NOW = Date.now();
const d = () => new Date().toLocaleDateString('es-MX', { timeZone: 'America/Mazatlan' });
const t = () => new Date().toLocaleTimeString('es-MX', { timeZone: 'America/Mazatlan', hour12: false });

// ── 1. VPS reachability ───────────────────────────────────────────────────────

section('1. VPS Gateway');
try {
  const t0 = Date.now();
  const res = await fetch(`${VPS}/api/sheets/read?tab=${encodeURIComponent('02 Gastos')}`, { signal: AbortSignal.timeout(8000) });
  ok(`VPS reachable`, `${Date.now() - t0}ms, status ${res.status}`);
} catch (e) {
  fail('VPS unreachable', e.message);
  console.error('\n⛔ VPS is down — all pipeline tests will fail. Aborting.\n');
  process.exit(1);
}

// ── 2. Averías ────────────────────────────────────────────────────────────────

await testTab({
  name: '2. Averías (Falla reports)',
  tab: 'Averías',
  id: `TEST-AV-${NOW}`,
  row: [
    d(), t(),
    'TEST-UNIT',           // UNIDAD
    'Mecánica',            // TIPO
    'Pipeline test falla', // DESCRIPCIÓN
    'media',               // SEVERIDAD
    'AutoTest',            // TÉCNICO
    '<1 hora',             // TIEMPO PARO
    '',                    // COSTO ESTIMADO
    'Abierta',             // ESTADO
    '',                    // SOLUCIÓN
    'Test observaciones',  // OBSERVACIONES
    '',                    // PROVEEDOR
    `TEST-AV-${NOW}`,      // OT_ID ← used as unique key
    '',                    // FOTO_URL
  ],
  col: 13,  // OT_ID column
});

// ── 3. Gastos ─────────────────────────────────────────────────────────────────

await testTab({
  name: '3. Gastos',
  tab: '02 Gastos',
  id: `TEST-GST-${NOW}`,
  row: [
    `TEST-GST-${NOW}`,  // A: Gasto_ID
    d(), t(),
    'Otro',             // D: Tipo
    'TEST_PIPELINE',    // E: Proveedor
    '', '',             // F-G: RFC, Folio
    '0.00', '0.00', '0.00', // H-J: Subtotal, IVA, Total
    'FLOTA', '',        // K-L: Unidad, OT_ID
    'AutoTest',         // M: Solicitante
    'Efectivo',         // N: Metodo_Pago
    'Test item',        // O: Items
    '',                 // P: Imagen_URL
    'Aprobado',         // Q: Status
  ],
  col: 0,
});

// ── 4. Combustible / Diesel fillups ──────────────────────────────────────────

await testTab({
  name: '4. Combustible (Diesel fillups)',
  tab: 'Combustible',
  id: `TEST-DSEL-${NOW}`,
  row: [
    `TEST-DSEL-${NOW}`,  // unique ID col 0
    d(), t(),
    'TEST-UNIT',         // Unidad
    '100',               // Litros
    '25.00',             // Precio/L
    '2500.00',           // Total
    'AutoTest',          // Operador
    'Estación Test',     // Estación
    '',                  // OT_ID
    'Efectivo',          // Método
  ],
  col: 0,
});

// ── 5. Inspecciones (DVIR) ────────────────────────────────────────────────────

await testTab({
  name: '5. Inspecciones (DVIR)',
  tab: '14 Inspecciones',
  id: `TEST-INS-${NOW}`,
  row: [
    `TEST-INS-${NOW}`,   // ID
    d(), t(),
    'TEST-UNIT',         // Unidad
    'AutoTest',          // Operador
    'Salida',            // Tipo
    'OK',                // Estado general
    '',                  // Defectos
    'Test pipeline',     // Notas
  ],
  col: 0,
});

// ── 6. Horómetros (Hour meter readings) ──────────────────────────────────────

await testTab({
  name: '6. Horómetros (Hour meter readings)',
  tab: '04B Registro Horómetros',
  id: `TEST-HOR-${NOW}`,
  row: [
    d(),
    'TEST-UNIT',
    '5000',              // Lectura
    'AutoTest',          // Registrado por
    `TEST-HOR-${NOW}`,   // ID único
  ],
  col: 4,
});

// ── 7. OT Status Log ─────────────────────────────────────────────────────────

await testTab({
  name: '7. OT Status Log',
  tab: 'OT_STATUS_LOG',
  id: `TEST-OTL-${NOW}`,
  row: [
    `TEST-OTL-${NOW}`,   // Log ID
    `OT-TEST-${NOW}`,    // OT_ID
    d(), t(),
    'Abierta',           // Estado anterior
    'En Reparación',     // Estado nuevo
    'AutoTest',          // Cambiado por
    'Test pipeline',     // Notas
  ],
  col: 0,
});

// ── 8. Catálogo de Precios (Parts catalog) ────────────────────────────────────

await testTab({
  name: '8. Catálogo de Precios (Parts catalog)',
  tab: 'Catalogo_Precios',
  id: `TEST-PART-${NOW}`,
  row: [
    `TEST-PART-${NOW}`,  // Part number
    'Test Part Pipeline',// Description
    '100.00',            // Unit price
    'TEST_SUPPLIER',     // Proveedor
    d(),                 // Última actualización
  ],
  col: 0,
});

// ── 9. Historial PM (Parts price history / PM history) ───────────────────────

await testTab({
  name: '9. Historial PM',
  tab: '05 Historial PM',
  id: `TEST-PM-${NOW}`,
  row: [
    d(),
    'TEST-UNIT',
    'Aceite Motor',       // Tipo PM
    '5000',               // Horómetro
    'AutoTest',           // Técnico
    `TEST-PM-${NOW}`,     // ID
  ],
  col: 5,
});

// ── 10. Reporte Viajes (Trip reports) ─────────────────────────────────────────

await testTab({
  name: '10. Reporte Viajes (Trip reports)',
  tab: 'Reporte_Viajes_Peña',
  id: `TEST-VJ-${NOW}`,
  row: [
    `TEST-VJ-${NOW}`,    // ID
    d(), t(),
    'TEST-UNIT',          // Unidad
    'AutoTest',           // Operador
    'Origen Test',        // Origen
    'Destino Test',       // Destino
    '100',                // Km
    '',                   // Notas
  ],
  col: 0,
});

// ── 11. Supabase Storage ──────────────────────────────────────────────────────

section('11. Supabase Storage (photo uploads)');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Minimal 1×1 JPEG
const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8AKf/Z',
  'base64'
);

for (const bucket of ['falla-photos', 'receipts', 'gastos-photos']) {
  const fileName = `test-${NOW}-${bucket}.jpg`;
  try {
    const t0 = Date.now();
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, TINY_JPEG, { contentType: 'image/jpeg' });

    if (error) {
      fail(`${bucket} upload`, error.message);
    } else {
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
      ok(`${bucket} upload`, `${Date.now() - t0}ms → ${urlData.publicUrl.slice(0, 60)}…`);
      await supabase.storage.from(bucket).remove([fileName]);
    }
  } catch (e) {
    fail(`${bucket} upload threw`, e.message);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(55)}`);
console.log(`  ✅ Passed: ${passed}   ❌ Failed: ${failed}   Total: ${passed + failed}`);
if (failures.length) {
  console.log('\n  Failed tests:');
  failures.forEach(f => console.log(`    • ${f.label}${f.err ? ` — ${f.err}` : ''}`));
}
console.log(`${'═'.repeat(55)}\n`);

process.exit(failed > 0 ? 1 : 0);
