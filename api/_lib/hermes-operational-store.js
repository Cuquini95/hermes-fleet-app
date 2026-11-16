import { identityConfig, identityRequest } from './hermes-identity.js';
import { canonicalTab, HermesSheetError } from './hermes-google-sheets.js';
import { PANAMA_PROJECT, readPanamaConsultationInventory, readPanamaWorkshopMasters } from './hermes-panama.js';

const tables = '/rest/v1/hermes_panama_operational_tables';
const receipts = '/rest/v1/hermes_panama_commit_receipts';
const transaction = '/rest/v1/rpc/hermes_panama_commit';
const signedPurchaseTransaction = '/rest/v1/rpc/hermes_panama_commit_signed_purchase';
const unavailable = () => new HermesSheetError(503, 'El registro operativo de Panamá no está disponible.');

function database(path, options) {
  const config = identityConfig();
  if (config.project !== PANAMA_PROJECT) throw unavailable();
  return identityRequest(config, path, options);
}

export function readPurchaseNumber(row) {
  const number = String(row?.[27] ?? '');
  return /^[1-9][0-9]{3,14}$/.test(number) ? number : undefined;
}

export function isPurchaseSignature(png) {
  if (typeof png !== 'string' || png.length < 44 || png.length > 44_000) return false;
  const bytes = Buffer.from(png, 'base64');
  return bytes.toString('base64') === png && bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a'
    && bytes.subarray(-8, -4).toString('ascii') === 'IEND';
}

export function createPanamaOperationalStore({ request = database, readInventory = readPanamaConsultationInventory } = {}) {
  async function read(tab) {
    const name = canonicalTab(tab);
    if (name === '01 Inventario') return readInventory();
    const response = await request(tables, { query: { name: 'eq.' + name, select: 'rows', limit: '1' } });
    if (!response.ok) throw unavailable();
    const [table] = await response.json();
    if (!Array.isArray(table?.rows)) throw unavailable();
    return table.rows;
  }

  async function readMany(tabs) {
    const names = tabs.map(canonicalTab);
    const response = await request(tables, {
      query: { name: 'in.(' + names.map(name => JSON.stringify(name)).join(',') + ')', select: 'name,rows' },
    });
    if (!response.ok) throw unavailable();
    const byName = new Map((await response.json()).map(table => [table.name, table.rows]));
    const result = names.map(name => byName.get(name));
    if (result.some(rows => !Array.isArray(rows))) throw unavailable();
    return result;
  }

  async function readPurchaseSignature({ folio, approvedById, approvedAt }) {
    try {
      const response = await request('/rest/v1/hermes_panama_purchase_signatures', {
        query: { folio: 'eq.' + folio, approved_by_id: 'eq.' + approvedById, approved_at: 'eq.' + approvedAt,
          select: 'png_base64', limit: '1' },
      });
      if (!response.ok) return undefined;
      const [attachment] = await response.json();
      const png = attachment?.png_base64;
      if (isPurchaseSignature(png)) return png;
    } catch { /* The recorded approval can still be printed. */ }
    return undefined;
  }

  async function registeredPurchaseSignatureSource(approvedById) {
    const response = await request('/rest/v1/hermes_panama_purchase_signature_profiles', {
      query: { approver_id: 'eq.' + approvedById, select: 'source_folio,source_approved_at', limit: '1' },
    });
    if (!response.ok) throw unavailable();
    const [profile] = await response.json();
    if (!profile) return undefined;
    return { folio: profile.source_folio, approvedById, approvedAt: profile.source_approved_at };
  }

  async function withPurchaseNumber(result, includePurchaseNumber) {
    if (!includePurchaseNumber || !result?.folio) return result;
    const orders = await read('Órdenes de Compra').catch(() => []);
    const number = readPurchaseNumber(orders.find(row => row[0] === result.folio));
    return number ? { ...result, number } : result;
  }

  async function replay({ key, fingerprint, includePurchaseNumber }) {
    const response = await request(receipts, {
      query: { operation_key: 'eq.' + key, select: 'fingerprint,result', limit: '1' },
    });
    if (!response.ok) throw unavailable();
    const [receipt] = await response.json();
    if (!receipt) return null;
    if (receipt.fingerprint !== fingerprint) throw new HermesSheetError(409, 'La operación ya existe con otros datos.');
    return withPurchaseNumber(receipt.result, includePurchaseNumber);
  }

  async function commit({ key, fingerprint, guard, guards = [], writes, result, includePurchaseNumber, purchaseSignature }) {
    try {
      const response = await request(purchaseSignature ? signedPurchaseTransaction : transaction, {
        method: 'POST',
        body: {
          operation_key: key, operation_fingerprint: fingerprint,
          guards: [...new Set([guard, ...guards].filter(Boolean))],
          changes: writes.map(change => ({ ...change, tab: canonicalTab(change.tab) })), outcome: result,
          ...(purchaseSignature && { purchase_signature: purchaseSignature }),
        },
      });
      if (response.ok) {
        const saved = await response.json();
        if (typeof saved?.replayed === 'boolean' && saved.result != null) {
          return { ...saved, result: await withPurchaseNumber(saved.result, includePurchaseNumber) };
        }
        throw unavailable();
      }
      if (response.status === 400 || response.status === 409) {
        const problem = await response.json().catch(() => null);
        if (problem?.code === 'PT400' || problem?.code === 'PT409') {
          throw new HermesSheetError(response.status, problem.message);
        }
      }
      throw unavailable();
    } catch (error) {
      if (error instanceof HermesSheetError && error.status < 500) throw error;
      const prior = await replay({ key, fingerprint, includePurchaseNumber });
      if (prior !== null) return { result: prior, replayed: true };
      throw unavailable();
    }
  }

  return { read, readMany, replay, commit, readPurchaseSignature, registeredPurchaseSignatureSource, readWorkshopMasters: readPanamaWorkshopMasters, nativeOperations: true };
}

export const panamaOperationalStore = createPanamaOperationalStore();
