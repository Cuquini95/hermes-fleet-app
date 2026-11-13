import { createHash } from 'node:crypto';
import { GoogleAuth } from 'google-auth-library';

const API_ROOT = 'https://sheets.googleapis.com/v4/spreadsheets';
const TRANSACTIONS = 'Hermes_Transacciones';
export const PANAMA_SHIFT_TAB = 'HERMES_PA_TURNOS';
export const PANAMA_DISPATCH_TAB = 'HERMES_PA_DESPACHO';
export const PANAMA_READINESS_TAB = 'HERMES_PA_ESTADO_UNIDAD';
const HEADERS = {
  [PANAMA_READINESS_TAB]: ['UNIDAD', 'REVISION', 'FECHA_UTC'],
  'Movimientos Repuestos PA': ['ID', 'FECHA_UTC', 'TIPO', 'SKU', 'CANTIDAD', 'UNIDAD', 'OC', 'PARTIDA', 'OT', 'REFERENCIA', 'ACTOR', 'ACTOR_ID', 'EXISTENCIA', 'MEDIDA'],
  [TRANSACTIONS]: ['CLAVE', 'HUELLA', 'GUARDAS', 'RESULTADO', 'FECHA_UTC'],
  Inspeccion_Stickers: ['#', 'FOLIO', 'TIMESTAMP', 'FECHA', 'HORA', 'UNIDAD', 'MODELO', 'TIPO_EQUIPO', 'INSPECTOR', 'SUPERVISOR', 'ESTADO_APROBACION', 'COLOR_RECOMENDADO', 'COLOR_FINAL', 'PUEDE_DESPACHAR', 'VENCE', 'HALLAZGOS', 'FOTOS', 'DETALLE_JSON', 'INSPECTOR_ID', 'SUPERVISOR_ID', 'FECHA_APROBACION'],
  Inspeccion_Hallazgos: ['#', 'FOLIO', 'TIMESTAMP', 'UNIDAD', 'MODELO', 'TIPO_EQUIPO', 'SECCION', 'ITEM_ID', 'ITEM', 'ESTADO', 'COMENTARIO', 'FECHA_COMPROMISO', 'PUEDE_OPERAR', 'SEVERIDAD', 'ESTADO_APROBACION', 'VENCE', 'ACTOR_ID'],
};
const ALIASES = new Map([['Gastos', '02 Gastos'], ['Averias', 'Averías']]);
const MAX_CELL_CHARACTERS = 50_000;
const MAX_COLUMNS = 18_278;
const METADATA_TTL_MS = 30_000;
const READ_TTL_MS = 4_000;
const NUMERIC_COLUMNS = new Map([
  ['Órdenes de Compra', new Set([6, 7, 8, 9, 10])],
  ['12 Inventario Rep.', new Set([5])],
  ['Movimientos Repuestos PA', new Set([4, 12])],
  ['OC_Lineas', new Set([1, 3, 4, 5])],
  ['02 Gastos', new Set([7, 8, 9])],
  ['ORDENES_TRABAJO', new Set([13, 16])],
]);

export class HermesSheetError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

let googleAuth;
let panamaGoogleAuth;
function configuredSpreadsheet() {
  const id = (process.env.HERMES_GOOGLE_SHEET_ID || process.env.HERMES_GOOGLE_SHEETS_ID || '').trim();
  if (!/^[A-Za-z0-9_-]{20,}$/.test(id)) throw new HermesSheetError(503, 'La fuente de Hermes no está configurada.');
  return id;
}

async function googleRequest(options) {
  if (!googleAuth) {
    let credentials;
    try {
      credentials = JSON.parse(process.env.HERMES_GOOGLE_SERVICE_ACCOUNT_JSON || 'null');
      if (credentials?.type !== 'service_account') throw new Error('Tipo de credencial inválido');
    } catch {
      throw new HermesSheetError(503, 'La cuenta de servicio de Hermes no está configurada.');
    }
    googleAuth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  }
  return googleAuth.request({ ...options, timeout: 10_000, retry: false });
}

export const canonicalTab = tab => ALIASES.get(tab) || tab;
const sheetRange = tab => `'${tab.replace(/'/g, "''")}'`;
const statusOf = error => error?.response?.status ?? error?.status;
const digestId = value => (createHash('sha256').update(value).digest().readUInt32BE(0) & 0x7fffffff) || 1;
const encodeValues = values => values.map(row => row.map(value => String(value ?? '')));

function metadataRequest(id, key) {
  return { createDeveloperMetadata: { developerMetadata: {
    metadataId: id, metadataKey: key, location: { spreadsheet: true }, visibility: 'DOCUMENT',
  } } };
}

function cell(value, numeric) {
  if (typeof value === 'boolean') return { userEnteredValue: { boolValue: value } };
  if (typeof value === 'number' && Number.isFinite(value)) return { userEnteredValue: { numberValue: value } };
  const text = String(value ?? '');
  if (text.length > MAX_CELL_CHARACTERS) throw new HermesSheetError(400, 'Hay una celda con más de 50.000 caracteres.');
  if (numeric && /^-?\d+(\.\d+)?$/.test(text) && Number.isFinite(Number(text))) {
    return { userEnteredValue: { numberValue: Number(text) } };
  }
  return { userEnteredValue: { stringValue: text } };
}

function rowData(tab, values, startColumn = 0) {
  if (!Array.isArray(values) || values.length > MAX_COLUMNS - startColumn) {
    throw new HermesSheetError(400, 'Datos de fila inválidos.');
  }
  const numeric = NUMERIC_COLUMNS.get(tab);
  return { values: values.map((value, index) => cell(value, numeric?.has(startColumn + index))) };
}

export function createHermesSheets({ spreadsheetId, request = googleRequest, schemas = {} } = {}) {
  const allowedHeaders = { ...HEADERS, ...schemas };
  let metadata;
  let metadataPromise;
  const readCache = new Map();

  const requestData = async (path, method = 'GET', data) => {
    const id = spreadsheetId || configuredSpreadsheet();
    const response = await request({ url: `${API_ROOT}/${encodeURIComponent(id)}${path}`, method, data });
    return response.data;
  };

  async function fetchMetadata(fresh = false) {
    if (!fresh && metadata && Date.now() < metadata.expiresAt) return metadata.sheets;
    if (metadataPromise) return metadataPromise;
    metadataPromise = requestData('?fields=sheets(properties(sheetId,title,gridProperties))').then(data => {
      const sheets = new Map((data.sheets ?? []).map(({ properties }) => [properties.title, properties]));
      metadata = { sheets, expiresAt: Date.now() + METADATA_TTL_MS };
      return sheets;
    }).finally(() => { metadataPromise = undefined; });
    return metadataPromise;
  }

  async function readRange(range, { valueRenderOption = 'UNFORMATTED_VALUE' } = {}) {
    const query = new URLSearchParams({ valueRenderOption, dateTimeRenderOption: 'FORMATTED_STRING' });
    const data = await requestData(`/values/${encodeURIComponent(range)}?${query}`);
    return Array.isArray(data.values) ? data.values : [];
  }

  async function read(tab, { cached = false, requireExisting = false, valueRenderOption = 'UNFORMATTED_VALUE' } = {}) {
    const name = canonicalTab(tab);
    const cacheKey = requireExisting ? `${name}:existing` : name;
    const useCache = cached && valueRenderOption === 'UNFORMATTED_VALUE';
    const cachedEntry = readCache.get(cacheKey);
    if (useCache && cachedEntry?.expiresAt > Date.now()) return cachedEntry.promise;
    const promise = readRange(sheetRange(name), { valueRenderOption }).then(encodeValues).catch(async error => {
      if (!requireExisting && allowedHeaders[name] && statusOf(error) === 400 && !(await fetchMetadata(true)).has(name)) {
        return [allowedHeaders[name].slice()];
      }
      throw error;
    });
    if (!useCache) return promise;
    readCache.set(cacheKey, { promise, expiresAt: Date.now() + READ_TTL_MS });
    try { return await promise; }
    catch (error) {
      if (readCache.get(cacheKey)?.promise === promise) readCache.delete(cacheKey);
      throw error;
    }
  }

  async function metadataAt(id) {
    try { return await requestData(`/developerMetadata/${id}`); }
    catch (error) {
      if (statusOf(error) === 404) return null;
      throw error;
    }
  }

  function identity(key, fingerprint) {
    if (typeof key !== 'string' || !key.trim() || key.length > 300 || typeof fingerprint !== 'string' || !fingerprint.trim() || fingerprint.length > 256) {
      throw new HermesSheetError(400, 'La clave de la operación es inválida.');
    }
    return digestId(`hermes:transaction:${key}`);
  }

  async function replay({ key, fingerprint }) {
    const id = identity(key, fingerprint);
    const existing = await metadataAt(id);
    if (!existing) return null;
    const ledger = await read(TRANSACTIONS);
    const record = ledger.slice(1).find(row => row[0] === key);
    if (!record || existing.metadataKey !== 'H') throw new HermesSheetError(409, 'La clave coincide con otra operación.');
    if (record[1] !== fingerprint) throw new HermesSheetError(409, 'La operación ya existe con otros datos.');
    try { return JSON.parse(record[3]); }
    catch { throw new HermesSheetError(503, 'El comprobante de la operación no se pudo leer.'); }
  }

  function findSheet(name, sheets, requests) {
    const existing = sheets.get(name);
    if (existing) return existing;
    const columns = allowedHeaders[name];
    if (!columns) throw new HermesSheetError(503, `La hoja ${name} no está disponible.`);
    const used = new Set([...sheets.values()].map(sheet => sheet.sheetId));
    let sheetId = digestId(`hermes:sheet:${name}`);
    while (used.has(sheetId)) sheetId = sheetId === 0x7fffffff ? 1 : sheetId + 1;
    const properties = { sheetId, title: name, gridProperties: { rowCount: 1000, columnCount: Math.max(26, columns.length) } };
    requests.push({ addSheet: { properties } }, { appendCells: { sheetId, rows: [rowData(name, columns)], fields: 'userEnteredValue' } });
    sheets.set(name, properties);
    return properties;
  }

  function addWrite(write, sheets, requests) {
    if (typeof write?.tab !== 'string' || !write.tab) throw new HermesSheetError(400, 'Falta la hoja de destino.');
    const name = canonicalTab(write.tab);
    const sheet = findSheet(name, sheets, requests);
    const sheetId = sheet.sheetId;
    const columns = sheet.gridProperties?.columnCount ?? 26;
    const position = write.col ?? 0;
    if (!Number.isInteger(position) || position < 0) throw new HermesSheetError(400, 'Posición de columna inválida.');
    const rows = write.append ?? [write.values];
    if (!Array.isArray(rows) || !rows.length || rows.some(row => !Array.isArray(row))) throw new HermesSheetError(400, 'Filas inválidas.');
    const requiredColumns = position + Math.max(...rows.map(values => values.length));
    if (requiredColumns > MAX_COLUMNS) throw new HermesSheetError(400, 'Demasiadas columnas en la escritura.');
    if (requiredColumns > columns) {
      requests.push({ appendDimension: { sheetId, dimension: 'COLUMNS', length: requiredColumns - columns } });
      sheets.set(name, { ...sheet, gridProperties: { ...sheet.gridProperties, columnCount: requiredColumns } });
    }
    const data = rows.map(values => rowData(name, values, position));
    if (write.append) {
      if (position) throw new HermesSheetError(400, 'Una fila nueva debe iniciar en la primera columna.');
      requests.push({ appendCells: { sheetId, rows: data, fields: 'userEnteredValue' } });
      return;
    }
    if (!Number.isInteger(write.row) || write.row < 0 || write.row >= (sheet.gridProperties?.rowCount ?? 1000)) {
      throw new HermesSheetError(409, 'La fila ya no está disponible. Actualiza antes de editar.');
    }
    requests.push({ updateCells: { start: { sheetId, rowIndex: write.row, columnIndex: position }, rows: data, fields: 'userEnteredValue' } });
  }

  async function commit({ key, fingerprint, guard, guards = [], writes, result }) {
    const id = identity(key, fingerprint);
    if (!Array.isArray(writes) || !writes.length || writes.length > 300 || result == null || !Array.isArray(guards)) {
      throw new HermesSheetError(400, 'La operación no contiene cambios válidos.');
    }
    const versions = [...new Set([guard, ...guards].filter(Boolean))];
    if (versions.length > 150 || versions.some(version => typeof version !== 'string' || version.length > 300)) {
      throw new HermesSheetError(400, 'Versión de la operación inválida.');
    }
    const prior = await replay({ key, fingerprint });
    if (prior !== null) return { replayed: true, result: prior };
    const guardIds = versions.map(version => digestId(`hermes:version:${version}`));
    if (new Set([id, ...guardIds]).size !== guardIds.length + 1) throw new HermesSheetError(409, 'Conflicto entre claves de la operación.');

    async function apply(fresh) {
      const sheets = new Map(await fetchMetadata(fresh));
      const requests = [metadataRequest(id, 'H'), ...guardIds.map(guardId => metadataRequest(guardId, 'V'))];
      for (const write of writes) addWrite(write, sheets, requests);
      addWrite({ tab: TRANSACTIONS, append: [[key, fingerprint, JSON.stringify(versions), JSON.stringify(result), new Date().toISOString()]] }, sheets, requests);
      await requestData(':batchUpdate', 'POST', { requests });
      for (const write of writes) {
        const name = canonicalTab(write.tab);
        readCache.delete(name);
        readCache.delete(`${name}:existing`);
      }
      if (requests.some(request => request.addSheet || request.appendDimension)) metadata = undefined;
      return { replayed: false, result };
    }

    try { return await apply(false); }
    catch (error) {
      // A lost response does not establish that the write failed. Consult the
      // durable receipt before reporting an error or attempting another batch.
      const completed = await replay({ key, fingerprint });
      if (completed !== null) return { replayed: true, result: completed };
      if ((await Promise.all(guardIds.map(metadataAt))).some(Boolean)) {
        throw new HermesSheetError(409, 'El registro cambió en otra sesión. Actualiza antes de continuar.');
      }
      // Sheet creation and column extension can race with another valid batch.
      if (statusOf(error) === 400 && !(error instanceof HermesSheetError)) {
        try { return await apply(true); }
        catch (retryError) {
          const recovered = await replay({ key, fingerprint });
          if (recovered !== null) return { replayed: true, result: recovered };
          if ((await Promise.all(guardIds.map(metadataAt))).some(Boolean)) {
            throw new HermesSheetError(409, 'El registro cambió en otra sesión. Actualiza antes de continuar.');
          }
          throw retryError;
        }
      }
      throw error;
    }
  }

  return { read, readRange, replay, commit };
}

const defaultSheets = createHermesSheets();

// Parts lookup consumes unformatted numeric values from known named ranges.
export const readHermesRows = (range, options) => defaultSheets.readRange(range, options);

export function createPanamaOperationsSheets() {
  const id = process.env.HERMES_PANAMA_OPERATIONS_SHEET_ID?.trim();
  let verified;
  return createHermesSheets({
    schemas: { [PANAMA_SHIFT_TAB]: ['FOLIO', 'UNIDAD', 'FECHA', 'TURNO', 'VERSION', 'ESTADO_PARTE', 'HOROMETRO_INICIAL',
      'HOROMETRO_FINAL', 'HORAS', 'ESTADO_EQUIPO', 'REFERENCIA_SOPORTE', 'VIAJES', 'TONELADAS', 'PARADAS', 'CLIENTE',
      'AUTOR_ID', 'AUTOR', 'ACTOR_ID', 'ACTOR', 'FECHA_UTC', 'ACCION', 'COMENTARIO'],
    [PANAMA_DISPATCH_TAB]: ['FOLIO', 'UNIDAD', 'FECHA', 'TURNO', 'SITIO', 'OPERADOR_ID', 'OPERADOR', 'ACTOR_ID', 'ACTOR', 'FECHA_UTC'] },
    request: async options => {
      const masters = ['TMF', 'EQUIPMENT', 'WORKSHOP', 'PM', 'DOZERS', 'EXCAVATORS', 'PURCHASES', 'COSTS']
        .map(key => process.env['HERMES_PANAMA_' + key + '_SHEET_ID']?.trim());
      if (!id || !/^[A-Za-z0-9_-]{20,}$/.test(id) || masters.includes(id)) {
        throw new HermesSheetError(503, 'Configura el archivo operativo independiente de Hermes Panamá.');
      }
      if (!panamaGoogleAuth) {
        try {
          const credentials = JSON.parse(process.env.HERMES_PANAMA_OPERATIONS_SERVICE_ACCOUNT_JSON || 'null');
          if (credentials?.type !== 'service_account') throw new Error('Invalid credentials');
          panamaGoogleAuth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
        } catch {
          throw new HermesSheetError(503, 'La cuenta de servicio operativa de Panamá no está configurada.');
        }
      }
      verified ??= panamaGoogleAuth.request({
        url: API_ROOT + '/' + id + '/values/' + encodeURIComponent("'HERMES_PA_CONFIG'!A1:B1"),
        timeout: 8000, retry: false,
      }).then(response => {
        const marker = response.data?.values?.[0];
        if (marker?.[0] !== 'HERMES_PANAMA' || marker?.[1] !== 'tmf-panama') throw new Error('Marcador de Panamá inválido');
      }).catch(() => {
        verified = undefined;
        throw new HermesSheetError(503, 'No se pudo verificar el archivo operativo de Panamá.');
      });
      await verified;
      return panamaGoogleAuth.request({ ...options, timeout: 10000, retry: false });
    },
    spreadsheetId: id || 'panama-operations-not-configured',
  });
}
