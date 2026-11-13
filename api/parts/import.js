import { requireSession } from '../_lib/session-auth.js';
import { readHermesRows } from '../_lib/hermes-google-sheets.js';
import { panamaOperationalStore } from '../_lib/hermes-operational-store.js';
import { createPanamaDemoSheets } from '../_lib/hermes-panama-demo.js';
import { PARTS_RANGE, EXPENSES_RANGE, searchInventory, recoverExpensePrices, compareQuote, visiblePanamaParts } from '../_lib/hermes-part-prices.js';

function formatMoney(value) {
  return `$${Number(value).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function buildTelegramMessage(changes) {
  const decreases = changes.filter((change) => change.new_price < change.old_price);
  const increases = changes.filter((change) => change.new_price > change.old_price);
  const headline = `⚠️ Cambio de precios detectado`;

  const lines = changes.slice(0, 12).map((change) => {
    const icon = change.new_price < change.old_price ? '📉' : '📈';
    const signedPct = `${change.pct_change > 0 ? '+' : ''}${change.pct_change.toFixed(1)}%`;
    return [
      `${icon} ${change.part_number} — ${change.description || 'Sin descripcion'}`,
      `Anterior: ${formatMoney(change.old_price)} → Nuevo: ${formatMoney(change.new_price)}`,
      `(${signedPct})`,
      change.supplier ? `Proveedor: ${change.supplier}` : null,
    ].filter(Boolean).join('\n');
  });

  const footerParts = [];
  if (increases.length > 0) footerParts.push(`${increases.length} subieron`);
  if (decreases.length > 0) footerParts.push(`${decreases.length} bajaron`);
  const footer = footerParts.length > 1 ? `\n\nResumen: ${footerParts.join(' · ')}` : '';

  return `${headline}\n\n${lines.join('\n\n')}${footer}`;
}

async function sendTelegramPriceAlert(changes) {
  if (process.env.HERMES_TELEGRAM_PRICE_ALERTS_ENABLED !== 'true') {
    return { sent: false, reason: 'telegram_disabled' };
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_PRICE_ALERT_CHAT_ID;

  if (!token || !chatId || changes.length === 0) {
    return { sent: false, reason: !token || !chatId ? 'telegram_env_missing' : 'no_changes' };
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    signal: AbortSignal.timeout(6000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: buildTelegramMessage(changes),
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) {
    return { sent: false, reason: `telegram_${res.status}` };
  }

  return { sent: true };
}

const WORKSHOP = ['mecanico', 'jefe_taller', 'coordinador', 'supervisor', 'gerencia'];

export function createPartsHandler({
  readRows = readHermesRows, readFleet, demoSheets, operationalSheets, sessionReader = requireSession,
  sendAlert = sendTelegramPriceAlert, panama = false,
} = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') {
      res.setHeader('Allow', 'GET, POST, OPTIONS');
      return res.status(204).end();
    }
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST, OPTIONS');
      return res.status(405).json({ error: 'Método no permitido' });
    }
    const session = await sessionReader(req, res, req.method === 'GET' ? WORKSHOP : WORKSHOP.slice(1), { allowPanama: panama });
    if (!session) return;
    if (panama && session.project !== 'tmf-panama') return res.status(403).json({ error: 'Proyecto no habilitado para Panamá.' });

    try {
      const demo = panama && session.previewDemo === true;
      if (demo && !demoSheets) return res.status(503).json({ error: 'El catálogo de prueba no está disponible.' });
      const source = demo ? demoSheets : operationalSheets;
      if (req.method === 'GET') {
        const query = String(req.query?.q ?? '').trim().slice(0, 120);
        if (!query) return res.status(200).json([]);
        let rows = source ? (await source.read('12 Inventario Rep.')).slice(5) : await readRows(PARTS_RANGE);
        if (panama && !session.allUnits) {
          const fleet = await (demo ? demoSheets.read('01 Inventario') : readFleet());
          rows = visiblePanamaParts(rows, fleet, session);
        }
        return res.status(200).json(searchInventory(rows, query, req.query?.equipo));
      }

      const supplier = String(req.body?.supplier ?? '').trim();
      const parts = req.body?.parts;
      const excludedIds = Array.isArray(req.body?.expense_ids) ? req.body.expense_ids.slice(0, 100) : [];
      if (!supplier || !Array.isArray(parts) || parts.length === 0 || parts.length > 100) {
        return res.status(400).json({ error: 'Indica el proveedor y entre 1 y 100 líneas.' });
      }
      if (!demo && !operationalSheets && process.env.HERMES_EXPENSE_PRICE_CURRENCY !== (panama ? 'USD' : 'MXN')) {
        return res.status(503).json({ error: 'La moneda del historial está pendiente de confirmar.' });
      }
      const assigned = new Set((session.assignedUnits || []).map((unit) => String(unit).trim().toUpperCase()));
      const expenseRows = source ? (await source.read('02 Gastos')).slice(1) : await readRows(EXPENSES_RANGE);
      const rows = expenseRows.filter((row) =>
        (!operationalSheets || demo || row[22] === 'USD') &&
        (session.allUnits === true || assigned.has(String(row[10] ?? '').trim().toUpperCase())));
      const prices = recoverExpensePrices(rows, supplier, excludedIds);
      const { compared, unmatched, comparisons, changes } = compareQuote(parts, supplier, prices);
      const telegram = !demo && changes.length && req.body?.notify === true
        ? await sendAlert(changes).catch(() => ({ sent: false, reason: 'telegram_unavailable' }))
        : { sent: false, reason: 'not_requested' };
      return res.status(200).json({
        success: true,
        compared,
        unmatched,
        price_comparisons: comparisons,
        price_changes: changes,
        telegram_sent: telegram.sent,
        telegram_reason: telegram.reason,
      });
    } catch {
      return res.status(503).json({ error: req.method === 'GET' ? 'No se pudo consultar el catálogo de repuestos.' : 'No se pudo consultar el historial de precios.' });
    }
  };
}

export default process.env.VERCEL === '1'
  ? createPartsHandler({
      panama: true, operationalSheets: panamaOperationalStore, readFleet: () => panamaOperationalStore.read('01 Inventario'),
      demoSheets: process.env.VERCEL_ENV === 'preview' ? createPanamaDemoSheets() : undefined,
      sendAlert: async () => ({ sent: false, reason: 'panama_notifications_unconfigured' }) })
  : createPartsHandler();
