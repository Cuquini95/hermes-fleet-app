import { requireSession } from '../require-session.js';

const DEFAULT_PARTS_SEARCH_URL = 'https://5-78-204-80.sslip.io/hermes-api/parts';
const CATALOG_ROLES = new Set(['jefe_taller', 'coordinador', 'supervisor', 'gerencia']);

function normalizePartNumber(value) {
  return String(value ?? '').trim().toUpperCase();
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

async function findCurrentPart(partNumber) {
  const baseUrl = process.env.HERMES_PARTS_SEARCH_URL || DEFAULT_PARTS_SEARCH_URL;
  const url = `${baseUrl}?q=${encodeURIComponent(partNumber)}`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const rows = await res.json();
  if (!Array.isArray(rows)) return null;

  const normalized = normalizePartNumber(partNumber);
  return rows.find((row) => normalizePartNumber(row.part_number) === normalized) ?? null;
}

function buildPriceChanges(supplier, parts, currentRows) {
  const changes = [];

  for (const part of parts) {
    const partNumber = normalizePartNumber(part.part_number);
    const newPrice = toNumber(part.unit_price);
    const current = currentRows.get(partNumber);
    const oldPrice = toNumber(current?.unit_price);

    if (!partNumber || newPrice <= 0 || oldPrice <= 0 || round2(newPrice) === round2(oldPrice)) {
      continue;
    }

    changes.push({
      part_number: partNumber,
      description: String(part.description || current?.description || '').trim(),
      old_price: round2(oldPrice),
      new_price: round2(newPrice),
      pct_change: oldPrice > 0 ? round2(((newPrice - oldPrice) / oldPrice) * 100) : 0,
      supplier: String(supplier || current?.supplier || '').trim(),
    });
  }

  return changes;
}

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
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_PRICE_ALERT_CHAT_ID
    || process.env.TELEGRAM_REPORT_CHAT_ID
    || process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId || changes.length === 0) {
    return { sent: false, reason: !token || !chatId ? 'telegram_env_missing' : 'no_changes' };
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
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

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!requireSession(req, res, { roles: CATALOG_ROLES, scope: 'parts-import', limit: 10 })) return;

  try {
    const supplier = String(req.body?.supplier ?? '').trim();
    const parts = Array.isArray(req.body?.parts) ? req.body.parts : [];
    const validParts = parts.filter((part) => normalizePartNumber(part?.part_number) && toNumber(part?.unit_price) > 0);

    const currentRows = new Map();
    await Promise.all(validParts.map(async (part) => {
      const partNumber = normalizePartNumber(part.part_number);
      const current = await findCurrentPart(partNumber);
      if (current) currentRows.set(partNumber, current);
    }));

    const priceChanges = buildPriceChanges(supplier, validParts, currentRows);
    const telegram = await sendTelegramPriceAlert(priceChanges);

    return res.status(200).json({
      success: true,
      imported: validParts.length,
      price_changes: priceChanges,
      telegram_sent: telegram.sent,
      telegram_reason: telegram.reason,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'parts_import_failed',
    });
  }
}
