import { GoogleAuth } from 'google-auth-library';
import { createHermesSheets } from './hermes-google-sheets.js';

export const PANAMA_PROJECT = 'tmf-panama';
const management = new Set(['jefe_taller', 'coordinador', 'supervisor', 'gerencia']);
const sourceSpecs = [
  { key: 'fleet', env: 'HERMES_PANAMA_TMF_SHEET_ID', range: "'EQUIPOS'!A3:F", unit: 'Código',
    columns: { unit: 'Código', equipment: 'Equipo', model: 'Modelo', group: 'Clase contractual', active: 'Activo' } },
  { key: 'failures', env: 'HERMES_PANAMA_WORKSHOP_SHEET_ID', range: "'FALLAS TMF'!A4:K", unit: 'EQUIPO',
    columns: { id: 'CASO', unit: 'EQUIPO', description: 'FALLA REPORTADA', status: 'ESTADO', last: 'ÚLTIMO REPORTE', order: 'OT VINCULADA' } },
  { key: 'shifts', env: 'HERMES_PANAMA_TMF_SHEET_ID', range: "'REGISTRO'!A3:M", unit: 'Código', limit: 50,
    columns: { id: 'Clave', unit: 'Código', date: 'Fecha', shift: 'Turno', status: 'Estado', start: 'H. Inicial', end: 'H. Final' } },
  { key: 'orders', env: 'HERMES_PANAMA_WORKSHOP_SHEET_ID', range: "'OTS'!A4:V", unit: 'EQUIPO', managementOnly: true,
    columns: { id: 'Nº OT', unit: 'EQUIPO', description: 'FALLA / TRABAJO A REALIZAR', status: 'ESTADO', check: 'CONTROL INTEGRIDAD OT' } },
  { key: 'maintenance', env: 'HERMES_PANAMA_PM_SHEET_ID', range: "'PM FLOTA'!A7:N", unit: 'EQUIPO', managementOnly: true,
    columns: { unit: 'EQUIPO', status: '¿CÓMO ESTÁ?', next: 'PRÓXIMO PM', remaining: 'HORAS QUE LE QUEDAN', reading: 'LECTURA', plan: 'PLAN' } },
  { key: 'dozers', env: 'HERMES_PANAMA_DOZERS_SHEET_ID', range: "'RESUMEN JEFE'!A4:J", unit: 'EQUIPO', managementOnly: true,
    columns: { unit: 'EQUIPO', group: 'TIPO', critical: '🔴', upcoming: '🟠', noData: '⚪ sin dato' } },
  { key: 'excavators', env: 'HERMES_PANAMA_EXCAVATORS_SHEET_ID', range: "'RESUMEN JEFE'!A4:J", unit: 'EQUIPO', managementOnly: true,
    columns: { unit: 'EQUIPO', group: 'TIPO', critical: '🔴', upcoming: '🟠', noData: '⚪ sin dato' } },
  { key: 'purchases', env: 'HERMES_PANAMA_PURCHASES_SHEET_ID', range: "'Pa - Maquinaria'!A1:Z", unit: 'Equipo / Item', country: 'País', managementOnly: true,
    columns: { id: 'ID', unit: 'Equipo / Item', description: 'Descripción', amount: 'Monto', currency: 'Moneda', status: 'Estado operativo', order: 'OC', check: 'Control recepción' } },
  { key: 'costs', env: 'HERMES_PANAMA_COSTS_SHEET_ID', range: "'RESUMEN'!A10:L", unit: 'UNIDAD', managementOnly: true, managementRole: 'gerencia',
    columns: { unit: 'UNIDAD', hours: 'HORAS TMF', revenue: 'INGRESO USD', purchases: 'COMPRAS + REPARTO USD', cost: 'COSTO ANALÍTICO PARCIAL USD/h', margin: 'MARGEN ANALÍTICO PARCIAL USD/h' } },
];

const keyOf = value => String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toUpperCase();

let googleAuth;
const readers = new Map();
async function getRows(spec) {
  const id = process.env[spec.env]?.trim();
  if (!id || !/^[A-Za-z0-9_-]{20,}$/.test(id)) throw new Error('Panama source not configured');
  if (!googleAuth) {
    const credentials = JSON.parse(process.env.HERMES_PANAMA_GOOGLE_SERVICE_ACCOUNT_JSON || 'null');
    if (credentials?.type !== 'service_account') throw new Error('Panama credentials not configured');
    googleAuth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  }
  if (!readers.has(id)) readers.set(id, createHermesSheets({
    spreadsheetId: id,
    request: options => googleAuth.request({ ...options, timeout: 8000, retry: false }),
  }));
  return readers.get(id).readRange(spec.range, { valueRenderOption: 'FORMATTED_VALUE' });
}

const cachedRows = new Map();
function readSource(spec) {
  const previous = cachedRows.get(spec.key);
  if (previous && Date.now() < previous.expiresAt) return previous.promise;
  const entry = { expiresAt: Date.now() + 30000, promise: getRows(spec) };
  cachedRows.set(spec.key, entry);
  entry.promise.catch(() => { if (cachedRows.get(spec.key) === entry) cachedRows.delete(spec.key); });
  return entry.promise;
}

export async function readPanamaInventory() {
  const rows = visibleRecords(await readSource(sourceSpecs[0]), sourceSpecs[0], { allUnits: true });
  return [
    ['Inventario TMF Panamá'], ['Disponibilidad TMF Maestro'],
    ['#','COD1','Descripción','Marca','Modelo','Año','Serie','Ubicación','Estado','Lectura Hr/Km'],
    ...rows.map((row, index) => [String(index + 1), row.unit, row.group || row.equipment, '', row.model, '', '', 'TMF Minera Panamá', '', '']),
  ];
}

function visibleRecords(rows, spec, session) {
  const [header = [], ...data] = rows;
  const names = header.map(keyOf);
  const columns = Object.entries(spec.columns).map(([key, name]) => [key, names.indexOf(keyOf(name))]);
  if (columns.some(([, col]) => col < 0)) throw new Error('Unexpected Panama source columns');
  const unitIndex = names.indexOf(keyOf(spec.unit));
  const countryIndex = spec.country ? names.indexOf(keyOf(spec.country)) : -1;
  if (spec.country && countryIndex < 0) throw new Error('Missing country column');
  const allowed = new Set((session.assignedUnits ?? []).map(keyOf));
  const records = data
    .filter(row => {
      const unit = keyOf(row[unitIndex]);
      return (!spec.country || keyOf(row[countryIndex]) === 'PANAMA')
        && (session.previewDemo ? /^QA-[A-Z]{1,7}\d{1,7}$/ : /^[A-Z]{1,7}[- ]?\d{1,7}$/).test(unit)
        && (session.allUnits || allowed.has(unit));
    })
    .map(row => Object.fromEntries(columns.map(([key, col]) => [key, String(row[col] ?? '').trim()])))
    .filter(record => !Object.hasOwn(spec.columns, 'id') || record.id);
  return spec.limit ? records.slice(-spec.limit).reverse() : records;
}

export async function dispatchPanama({ path, method, session, read = readSource }) {
  if (session.project !== PANAMA_PROJECT) return { status: 403, body: { error: 'Consulta reservada a TMF Panamá.' } };
  if (path !== 'api/panama/summary') return { status: 404, body: { error: 'Ruta no disponible para Panamá.' } };
  if (method !== 'GET') return { status: 405, body: { error: 'Hermes Panamá está en modo consulta.' } };

  const visible = sourceSpecs.filter(spec => spec.managementRole ? session.role === spec.managementRole
    : !spec.managementOnly || management.has(session.role));
  const sections = await Promise.all(visible.map(async spec => {
    try {
      return [spec.key, visibleRecords(await read(spec), spec, session)];
    } catch {
      return [spec.key, null];
    }
  }));
  return { status: 200, body: { project: PANAMA_PROJECT, sections: Object.fromEntries(sections) } };
}
