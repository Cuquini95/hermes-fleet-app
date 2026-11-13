import { GoogleAuth } from 'google-auth-library';
import { createHermesSheets } from './hermes-google-sheets.js';
import { identityConfig, identityRequest } from './hermes-identity.js';

export const PANAMA_PROJECT = 'tmf-panama';
const management = new Set(['jefe_taller', 'coordinador', 'supervisor', 'gerencia']);
const maintenanceColumns = { unit: 'EQUIPO', status: '¿CÓMO ESTÁ?', next: 'PRÓXIMO PM', remaining: 'HORAS QUE LE QUEDAN', reading: 'LECTURA', plan: 'PLAN' };
const maintenanceDetails = { model: 'MODELO', due: 'TOCA A LAS (h)', hours: 'HORÓMETRO HOY', last: 'ÚLTIMO PM ANOTADO' };
const maintenancePlan = { key: 'maintenancePlan', env: 'HERMES_PANAMA_PM_SHEET_ID', range: "'AJUSTES'!A4:M", unit: 'EQUIPO',
  columns: { unit: 'EQUIPO', model: 'MODELO', active: '¿ACTIVO?', cycle: 'PM CADA (h)', level2: 'NIVEL 2 (h)',
    level3: 'NIVEL 3 (h)', level4: 'NIVEL 4 (h)', level5: 'NIVEL 5 (h)', level6: 'NIVEL 6 (h)',
    approved: '¿PLAN APROBADO?', checklist: 'PAQUETE / CHECKLIST (link)' } };
const maintenanceAnchor = { key: 'maintenanceAnchor', env: 'HERMES_PANAMA_PM_SHEET_ID', range: "'CALC'!A1:AH", unit: 'Equipo',
  columns: { unit: 'Equipo', anchor: 'Ancla ciclo (h)' } };
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
    columns: maintenanceColumns, columnAliases: { status: 'Estado' }, optionalColumns: maintenanceDetails },
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

export async function readOfficialPanamaShifts() {
  const spec = sourceSpecs.find(source => source.key === 'shifts');
  const source = await readSourceForConsultation(spec);
  return {
    records: visibleRecords(rowsOf(source), { ...spec, limit: undefined }, { allUnits: true }),
    capturedAt: source.captured_at,
  };
}

// Snapshots are read through the server identity and use the same scope
// projection as the source sheets. Operational reconciliation still requires Sheets.
const snapshots = new Map();

function readSnapshot(spec) {
  const previous = snapshots.get(spec.key);
  if (previous && Date.now() < previous.expiresAt) return previous.promise;
  const promise = (async () => {
    const config = identityConfig();
    if (config.project !== PANAMA_PROJECT) throw new Error('Panama snapshot project mismatch');
    const response = await identityRequest(config, '/rest/v1/hermes_panama_source_snapshots', {
      query: { source: 'eq.' + spec.key, select: 'rows,captured_at', limit: 1 },
    });
    if (!response.ok) throw new Error('Panama snapshot unavailable');
    const [snapshot] = await response.json();
    if (!Array.isArray(snapshot?.rows) || !Number.isFinite(Date.parse(snapshot.captured_at))) {
      throw new Error('Panama snapshot unavailable');
    }
    return snapshot;
  })();
  const current = { promise, expiresAt: Date.now() + 30000 };
  snapshots.set(spec.key, current);
  promise.catch(() => { if (snapshots.get(spec.key) === current) snapshots.delete(spec.key); });
  return promise;
}

async function readSourceForConsultation(spec) {
  try { return await readSource(spec); }
  catch (error) {
    if (process.env.VERCEL_ENV !== 'production') throw error;
    return readSnapshot(spec);
  }
}

const rowsOf = source => Array.isArray(source) ? source : source.rows;

const equipmentDetails = {
  key: 'equipmentDetails', env: 'HERMES_PANAMA_EQUIPMENT_SHEET_ID', range: "'EQUIPOS'!A3:M",
  unit: 'CÓDIGO', country: 'PAÍS',
  columns: { unit: 'CÓDIGO', project: 'PROYECTO', kind: 'TIPO', brand: 'MARCA', model: 'MODELO', serial: 'SERIE' },
};

export async function readPanamaInventory(read = readSource) {
  const [fleet, details] = await Promise.all([
    read(sourceSpecs[0]),
    Promise.resolve().then(() => read(equipmentDetails)).then(rows => visibleRecords(rowsOf(rows), equipmentDetails, { allUnits: true })).catch(() => []),
  ]);
  const rows = visibleRecords(rowsOf(fleet), sourceSpecs[0], { allUnits: true });
  const byUnit = new Map();
  const ambiguous = new Set();
  for (const detail of details) {
    if (!['TMF', 'TMF MINERA PANAMA'].includes(keyOf(detail.project))) continue;
    const unit = keyOf(detail.unit);
    if (byUnit.has(unit)) ambiguous.add(unit);
    else byUnit.set(unit, detail);
  }
  for (const unit of ambiguous) byUnit.delete(unit);
  return [
    ['Inventario TMF Panamá'], ['Disponibilidad TMF Maestro / Maestro de Equipos'],
    ['#','COD1','Descripción','Marca','Modelo','Año','Serie','Ubicación','Estado','Lectura Hr/Km'],
    ...rows.map((row, index) => {
      const detail = byUnit.get(keyOf(row.unit));
      return [String(index + 1), row.unit, detail?.kind || row.group || row.equipment, detail?.brand || '',
        detail?.model || row.model, '', detail?.serial || '', 'TMF Minera Panamá', '', ''];
    }),
  ];
}

export const readPanamaConsultationInventory = () => readPanamaInventory(readSourceForConsultation);

function visibleRecords(rows, spec, session) {
  const [header = [], ...data] = rows;
  const names = header.map(keyOf);
  const columns = Object.entries(spec.columns).map(([key, name]) => {
    const index = names.indexOf(keyOf(name));
    const alias = spec.columnAliases?.[key];
    return [key, index < 0 && alias ? names.indexOf(keyOf(alias)) : index];
  });
  if (columns.some(([, col]) => col < 0)) throw new Error('Unexpected Panama source columns');
  for (const [key, name] of Object.entries(spec.optionalColumns ?? {})) {
    const index = names.indexOf(keyOf(name));
    if (index >= 0) columns.push([key, index]);
  }
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

const componentSources = [
  ...['dozer','excavator'].flatMap(family => {
    const env = family === 'dozer' ? 'HERMES_PANAMA_DOZERS_SHEET_ID' : 'HERMES_PANAMA_EXCAVATORS_SHEET_ID';
    return [{
      key: family + 'Changes', env, range: "'ANOTAR CAMBIO'!A5:Q", unit: 'EQUIPO',
      columns: { unit: 'EQUIPO', date: 'FECHA', part: 'PIEZA', position: 'LADO / POSICIÓN',
        meter: 'HORÓMETRO AL CAMBIO (h)', reason: '¿POR QUÉ SE CAMBIÓ?', status: '¿BIEN ANOTADO?',
        elapsed: 'HORAS QUE DURÓ LA PIEZA' },
    }, {
      key: family + 'Life', env, range: "'CALC'!A1:Q", unit: 'Equipo',
      columns: { unit: 'Equipo', part: 'Pieza', position: 'Lado', target: 'Vida', installedMeter: 'UltHor',
        currentMeter: 'HorAct', elapsed: 'Usadas', remaining: 'Restantes', status: 'Estado' },
    }];
  }),
];

async function componentDetails({ method, query, session, read }) {
  if (method !== 'GET') return { status: 405, body: { error: 'Consulta de componentes de solo lectura.' } };
  if (!management.has(session.role) && session.role !== 'mecanico') {
    return { status: 403, body: { error: 'Consulta reservada a Taller y Supervisión.' } };
  }
  const unit = keyOf(query?.unit);
  const pattern = session.previewDemo ? /^QA-[A-Z]{1,7}\d{1,7}$/ : /^[A-Z]{1,7}[- ]?\d{1,7}$/;
  if (!pattern.test(unit)) return { status: 400, body: { error: 'Selecciona una unidad válida.' } };
  if (!session.allUnits && !(session.assignedUnits ?? []).some(value => keyOf(value) === unit)) {
    return { status: 403, body: { error: 'Unidad fuera del alcance de la sesión.' } };
  }
  const results = await Promise.allSettled(componentSources.map(async spec => {
    const source = await read(spec);
    const records = visibleRecords(rowsOf(source), spec, { ...session, allUnits: false, assignedUnits: [unit] })
      .filter(row => row.part && (!row.date || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(row.date)));
    return { records, capturedAt: source.captured_at };
  }));
  const changes = [], life = [], unavailable = [], snapshots = {};
  results.forEach((result, index) => {
    const spec = componentSources[index];
    if (result.status === 'rejected') unavailable.push(spec.key);
    else {
      if (result.value.capturedAt) snapshots[spec.key] = result.value.capturedAt;
      (spec.key.endsWith('Changes') ? changes : life).push(...result.value.records.map(record => ({ ...record, source: spec.range })));
    }
  });
  return { status: 200, body: { unit, changes, life, unavailable, snapshots, checkedAt: new Date().toISOString() } };
}

export async function dispatchPanama({ path, method, query, session, read = readSourceForConsultation }) {
  if (session.project !== PANAMA_PROJECT) return { status: 403, body: { error: 'Consulta reservada a TMF Panamá.' } };
  if (path === 'api/panama/componentes') return componentDetails({ method, query, session, read });
  if (path !== 'api/panama/summary' && path !== 'api/panama/maintenance') return { status: 404, body: { error: 'Ruta no disponible para Panamá.' } };
  if (method !== 'GET') return { status: 405, body: { error: 'Hermes Panamá está en modo consulta.' } };
  if (path === 'api/panama/maintenance' && !management.has(session.role)) {
    return { status: 403, body: { error: 'Consulta reservada a Taller y Operaciones.' } };
  }

  const requested = path === 'api/panama/summary' && typeof query?.sections === 'string'
    ? new Set(query.sections.split(',')) : null;
  const visible = path === 'api/panama/maintenance'
    ? [...sourceSpecs.filter(spec => ['maintenance', 'dozers', 'excavators'].includes(spec.key)), maintenancePlan, maintenanceAnchor]
    : sourceSpecs.filter(spec => spec.managementRole ? session.role === spec.managementRole
    : !spec.managementOnly || management.has(session.role));
  const snapshots = {};
  const sections = await Promise.all(visible.filter(spec => !requested || requested.has(spec.key)).map(async spec => {
    try {
      const source = await read(spec);
      const records = visibleRecords(rowsOf(source), spec, session);
      if (source.captured_at) snapshots[spec.key] = source.captured_at;
      return [spec.key, records];
    } catch {
      return [spec.key, null];
    }
  }));
  return { status: 200, body: { project: PANAMA_PROJECT, sections: Object.fromEntries(sections), snapshots } };
}
