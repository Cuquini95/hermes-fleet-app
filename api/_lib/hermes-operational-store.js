import { identityConfig, identityRequest } from './hermes-identity.js';
import { canonicalTab, HermesSheetError } from './hermes-google-sheets.js';
import { PANAMA_PROJECT, readPanamaConsultationInventory } from './hermes-panama.js';

const tables = '/rest/v1/hermes_panama_operational_tables';
const receipts = '/rest/v1/hermes_panama_commit_receipts';
const transaction = '/rest/v1/rpc/hermes_panama_commit';
const unavailable = () => new HermesSheetError(503, 'El registro operativo de Panamá no está disponible.');

function database(path, options) {
  const config = identityConfig();
  if (config.project !== PANAMA_PROJECT) throw unavailable();
  return identityRequest(config, path, options);
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

  async function replay({ key, fingerprint }) {
    const response = await request(receipts, {
      query: { operation_key: 'eq.' + key, select: 'fingerprint,result', limit: '1' },
    });
    if (!response.ok) throw unavailable();
    const [receipt] = await response.json();
    if (!receipt) return null;
    if (receipt.fingerprint !== fingerprint) throw new HermesSheetError(409, 'La operación ya existe con otros datos.');
    return receipt.result;
  }

  async function commit({ key, fingerprint, guard, guards = [], writes, result }) {
    try {
      const response = await request(transaction, {
        method: 'POST',
        body: {
          operation_key: key, operation_fingerprint: fingerprint,
          guards: [...new Set([guard, ...guards].filter(Boolean))],
          changes: writes.map(change => ({ ...change, tab: canonicalTab(change.tab) })), outcome: result,
        },
      });
      if (response.ok) {
        const saved = await response.json();
        if (typeof saved?.replayed === 'boolean' && saved.result != null) return saved;
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
      const prior = await replay({ key, fingerprint });
      if (prior !== null) return { result: prior, replayed: true };
      throw unavailable();
    }
  }

  return { read, readMany, replay, commit, nativeOperations: true };
}

export const panamaOperationalStore = createPanamaOperationalStore();
