import { GoogleAuth } from 'google-auth-library';
import { createHermesSheets } from './hermes-google-sheets.js';
import { identityConfig, identityRequest } from './hermes-identity.js';
import { resolveShiftBilling } from './hermes-panama-shift-billing.js';
import { PM_CHECKLIST_SOURCE, pmModelCode, resolvePanamaPmChecklist } from './hermes-panama-pm-checklist.js';
import { buildPanamaPmReview } from './hermes-panama-pm-review.js';

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
    columns: { id: 'Nº OT', unit: 'EQUIPO', description: 'FALLA / TRABAJO A REALIZAR', status: 'ESTADO', check: 'CONTROL INTEGRIDAD OT' },
    optionalColumns: { priority: 'PRIORIDAD' } },
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
const shiftReadTimes = new WeakMap();
function readSource(spec) {
  const previous = cachedRows.get(spec.key);
  if (previous && Date.now() < previous.expiresAt) return previous.promise;
  const promise = getRows(spec);
  const entry = { expiresAt: Date.now() + 30000, promise: spec.key === 'shifts' ? promise.then(rows => {
    shiftReadTimes.set(rows, new Date().toISOString());
    return rows;
  }) : promise };
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
    readAt: shiftReadTimes.get(source),
  };
}

const valuationSpec = { key: 'shiftValuation', env: 'HERMES_PANAMA_TMF_SHEET_ID', range: "'VALORIZACION'!A3:O" };
const invoiceSpec = { key: 'shiftInvoice', env: 'HERMES_PANAMA_FINANCE_SHEET_ID', range: "'DOCUMENTOS COBRO'!A7:P" };

export function readOfficialPanamaShiftBilling(part) {
  const bridges = JSON.parse(process.env.HERMES_PANAMA_SHIFT_BILLING_LINKS_JSON || '[]');
  const readWorkbook = async spec => ({ rows: await readSource(spec), workbookId: process.env[spec.env]?.trim() });
  return resolveShiftBilling(part, {
    bridges, readValuation: () => readWorkbook(valuationSpec), readInvoices: () => readWorkbook(invoiceSpec),
  });
}

// Snapshots are read through the server identity and use the same scope
// projection as the source sheets. Operational reconciliation still requires Sheets.
const snapshots = new Map();

function readSnapshot(spec, { fresh = false } = {}) {
  const previous = snapshots.get(spec.key);
  if (!fresh && previous && Date.now() < previous.expiresAt) return previous.promise;
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

export async function readPanamaForPmScheduling(spec) {
  try { return await getRows(spec); }
  catch (error) {
    if (process.env.VERCEL_ENV !== 'production') throw error;
    return readSnapshot(spec, { fresh: true });
  }
}

const rowsOf = source => Array.isArray(source) ? source : source.rows;

const publishedMastersAvailable = () => ['production', 'preview'].includes(process.env.VERCEL_ENV);

async function readMaster(spec, project, {
  readLive = readSource,
  readCut = readSnapshot,
  allowSnapshot = publishedMastersAvailable(),
  preferPublished = true,
} = {}) {
  const live = async () => project(await readLive(spec));
  if (!allowSnapshot) return live();
  const published = async () => {
    const source = await readCut(spec);
    const capturedAt = Date.parse(source?.captured_at);
    if (!Array.isArray(source?.rows) || !Number.isFinite(capturedAt) || capturedAt > Date.now() + 300_000) {
      throw new Error('Invalid Panama master capture');
    }
    return project(source);
  };
  const [primary, fallback] = preferPublished ? [published, live] : [live, published];
  try { return await primary(); }
  catch { return fallback(); }
}

export async function readPanamaWorkshopMasters({
  preferPublished = false,
  readLive = readSource,
  readCut = readSnapshot,
  allowSnapshot = preferPublished ? publishedMastersAvailable() : process.env.VERCEL_ENV === 'production',
} = {}) {
  const specs = sourceSpecs.filter(spec => spec.key === 'failures' || spec.key === 'orders');
  const sections = await Promise.all(specs.map(async spec => {
    const project = source => ({
      records: visibleRecords(rowsOf(source), spec, { allUnits: true }),
      capturedAt: source.captured_at ?? null,
    });
    try {
      return [spec.key, await readMaster(spec, project, { readLive, readCut, allowSnapshot, preferPublished })];
    } catch {
      return [spec.key, null];
    }
  }));
  return Object.fromEntries(sections);
}

const equipmentDetails = {
  key: 'equipmentDetails', env: 'HERMES_PANAMA_EQUIPMENT_SHEET_ID', range: "'EQUIPOS'!A3:M",
  unit: 'CÓDIGO', country: 'PAÍS',
  columns: { unit: 'CÓDIGO', project: 'PROYECTO', kind: 'TIPO', brand: 'MARCA', model: 'MODELO', serial: 'SERIE' },
};

function readFleetMaster(project, readers) {
  const fleet = sourceSpecs[0];
  return readMaster(fleet, source => {
    const records = visibleRecords(rowsOf(source), fleet, { allUnits: true });
    if (!records.length || new Set(records.map(row => keyOf(row.unit))).size !== records.length) {
      throw new Error('Invalid Panama fleet roster');
    }
    return project(records, source.captured_at ?? null);
  }, readers);
}

export async function readPanamaInventory(read = readSource, {
  readCut = readSnapshot, allowSnapshot = false,
} = {}) {
  const readers = { readLive: read, readCut, allowSnapshot };
  const [rows, details] = await Promise.all([
    readFleetMaster(records => records, readers),
    readMaster(equipmentDetails, source => visibleRecords(rowsOf(source), equipmentDetails, { allUnits: true }), readers)
      .catch(() => []),
  ]);
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

export const readPanamaConsultationInventory = () => readPanamaInventory(readSource, {
  allowSnapshot: publishedMastersAvailable(),
});

export async function readPanamaReportFleet({
  readLive = readSource,
  readCut = readSnapshot,
  allowSnapshot = publishedMastersAvailable(),
} = {}) {
  return readFleetMaster((rows, capturedAt) => ({
    units: rows.map(({ unit, model }) => ({ code: keyOf(unit), model })),
    capturedAt,
  }), { readLive, readCut, allowSnapshot });
}

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

function componentHourTicks(value) {
  const clean = String(value ?? '').trim();
  if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,3})?$/.test(clean)) return null;
  const ticks = Math.round(Number(clean.replaceAll(',', '')) * 1000);
  return Number.isSafeInteger(ticks) ? ticks : null;
}

function componentLifeCalculation(record) {
  const installed = componentHourTicks(record.installedMeter);
  const reading = componentHourTicks(record.currentMeter);
  const target = componentHourTicks(record.target);
  if (installed === null || reading === null || target === null || installed < 0 || reading < 0 || target <= 0) {
    return { status: 'incomplete' };
  }
  if (reading < installed) return { status: 'regressed' };
  const elapsed = reading - installed;
  const remaining = target - elapsed;
  const recordedElapsed = componentHourTicks(record.elapsed);
  const recordedRemaining = componentHourTicks(record.remaining);
  const differs = (recordedElapsed !== null && recordedElapsed !== elapsed)
    || (recordedRemaining !== null && recordedRemaining !== remaining);
  const status = differs ? 'mismatch' : recordedElapsed === null || recordedRemaining === null ? 'reproduced' : 'verified';
  return { status, elapsed: elapsed / 1000, remaining: remaining / 1000 };
}

async function componentDetails({ method, query, session, readSection }) {
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
    const { records, capturedAt } = await readSection(spec, { ...session, allUnits: false, assignedUnits: [unit] });
    const validRecords = records
      .filter(row => row.part && (!row.date || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(row.date)));
    return { records: validRecords, capturedAt };
  }));
  const changes = [], life = [], unavailable = [], snapshots = {};
  results.forEach((result, index) => {
    const spec = componentSources[index];
    if (result.status === 'rejected') unavailable.push(spec.key);
    else {
      if (result.value.capturedAt) snapshots[spec.key] = result.value.capturedAt;
      const changeSource = spec.key.endsWith('Changes');
      const rows = result.value.records.map(record => ({ ...record, source: spec.range,
        ...(changeSource ? {} : { calculation: componentLifeCalculation(record) }),
      }));
      (changeSource ? changes : life).push(...rows);
    }
  });
  return { status: 200, body: { unit, changes, life, unavailable, snapshots, checkedAt: new Date().toISOString() } };
}

const publishedCutLabels = {
  fleet: 'Flota TMF', equipmentDetails: 'Maestro de equipos', failures: 'Fallas TMF',
  orders: 'Órdenes de Taller', shifts: 'Registro de turnos', maintenance: 'PM de flota',
  maintenancePlan: 'Plan de PM', maintenanceAnchor: 'Anclas de PM', costs: 'Costos por máquina',
  purchases: 'Compras de Panamá', dozers: 'Resumen de dozers', dozerLife: 'Vida de componentes de dozers',
  dozerChanges: 'Cambios de componentes de dozers', excavators: 'Resumen de excavadoras',
  excavatorLife: 'Vida de componentes de excavadoras', excavatorChanges: 'Cambios de componentes de excavadoras',
};

async function readPublishedCuts() {
  const config = identityConfig();
  if (config.project !== PANAMA_PROJECT) throw new Error('Panama snapshot project mismatch');
  const response = await identityRequest(config, '/rest/v1/hermes_panama_source_snapshots', {
    query: { select: 'source,captured_at', source: `in.(${Object.keys(publishedCutLabels).join(',')})` },
  });
  if (!response.ok) throw new Error('Panama cuts unavailable');
  return response.json();
}

async function publishedCuts({ method, session, readCuts }) {
  if (method !== 'GET') return { status: 405, body: { error: 'Consulta de cortes de solo lectura.' } };
  if (session.role !== 'gerencia' || session.previewDemo) {
    return { status: 403, body: { error: 'Consulta reservada a Gerencia Panamá.' } };
  }
  try {
    const rows = await readCuts();
    if (!Array.isArray(rows)) throw new Error('Invalid cuts response');
    const cuts = new Map();
    for (const row of rows) {
      if (!Object.hasOwn(publishedCutLabels, row?.source) || !Number.isFinite(Date.parse(row?.captured_at))) continue;
      const stamp = Date.parse(row.captured_at);
      if (!cuts.has(row.source) || stamp > cuts.get(row.source)) cuts.set(row.source, stamp);
    }
    const latest = cuts.size ? Math.max(...cuts.values()) : null;
    const sources = Object.entries(publishedCutLabels).map(([key, label]) => {
      const stamp = cuts.get(key);
      return { key, label, capturedAt: stamp === undefined ? null : new Date(stamp).toISOString(),
        status: stamp === undefined ? 'missing' : stamp === latest ? 'latest' : 'previous' };
    });
    return { status: 200, body: { project: PANAMA_PROJECT,
      latestCapturedAt: latest === null ? null : new Date(latest).toISOString(), sources } };
  } catch {
    return { status: 503, body: { error: 'No se pudieron verificar los cortes de los maestros.' } };
  }
}

const readPmChecklistCut = () => readSnapshot({ key: PM_CHECKLIST_SOURCE });

export async function readPrintablePanamaPm(query, session, {
  expectedModel, expectedSerial, folio, readPmChecklists = readPmChecklistCut,
  readEquipment = () => readMaster(equipmentDetails, source => visibleRecords(rowsOf(source), equipmentDetails, session)),
  readPlan = () => readMaster(maintenancePlan, source => visibleRecords(rowsOf(source), maintenancePlan, session)),
} = {}) {
  const unit = typeof query?.unit === 'string' ? query.unit.trim().toUpperCase() : '';
  const match = typeof query?.level === 'string' ? /^PM[- ]?(\d{1,5}|\d{1,2},\d{3})$/i.exec(query.level.trim()) : null;
  const hours = Number(match?.[1]?.replace(',', ''));
  if (!/^[A-Z][A-Z0-9_-]{0,24}$/.test(unit) || !Number.isFinite(hours) || hours < 1) {
    return { status: 400, body: { error: 'Selecciona un equipo y un intervalo PM.' } };
  }
  if (session.project !== PANAMA_PROJECT || (!session.allUnits && !session.assignedUnits?.includes(unit))) {
    return { status: 403, body: { error: 'Equipo fuera de tu alcance.' } };
  }
  const matches = (await readPlan()).filter(plan => plan.unit === unit);
  const plan = matches.length === 1 ? matches[0] : null;
  if (!plan?.checklist) return { status: 404, body: { error: `Falta vincular el checklist de ${unit} en el maestro PM.` } };
  if (expectedModel && pmModelCode(expectedModel) !== pmModelCode(plan.model)) {
    return { status: 409, body: { error: 'El modelo de esta orden difiere del maestro PM.' } };
  }
  const document = resolvePanamaPmChecklist(plan, hours, await readPmChecklists());
  if (!document) return { status: 404, body: { error: `El maestro no tiene un checklist para ${unit} a ${hours.toLocaleString('en-US')} h.` } };
  let equipment = [];
  try { equipment = (await readEquipment()).filter(row => keyOf(row.unit) === unit
    && ['TMF', 'TMF MINERA PANAMA'].includes(keyOf(row.project))); } catch { /* A review PDF must state the missing master. */ }
  if (equipment.length > 1) return { status: 409, body: { error: 'El equipo está duplicado en el maestro. Taller debe verificar su identidad.' } };
  const detail = equipment[0];
  if (detail?.model && pmModelCode(detail.model) !== pmModelCode(plan.model)) {
    return { status: 409, body: { error: 'El modelo del equipo difiere del plan PM. Taller debe revisar el checklist.' } };
  }
  const serial = String(detail?.serial ?? '').trim();
  if (expectedSerial && serial && keyOf(serial) !== keyOf(expectedSerial)) {
    return { status: 409, body: { error: 'La serie del equipo difiere de la registrada en la OT.' } };
  }
  const verifiedSerial = serial && !/^(?:N\/A|SIN (?:DATO|SERIE)|POR (?:VERIFICAR|CONFIRMAR)|[-—])$/i.test(serial) ? serial : undefined;
  return { status: 200, body: { ...document, ...(folio && { folio }), ...(verifiedSerial && { serial: verifiedSerial }),
    identityVerified: Boolean(verifiedSerial && detail?.model),
  } };
}

export async function dispatchPanama({
  path, method, query, session, read, readCuts = readPublishedCuts, sourceReaders, preferPublished = true,
  readPmChecklists,
}) {
  if (session.project !== PANAMA_PROJECT) return { status: 403, body: { error: 'Consulta reservada a TMF Panamá.' } };
  if (path === 'api/panama/cortes') return publishedCuts({ method, session, readCuts });
  const readSection = async (spec, scope = session) => {
    const project = source => ({ records: visibleRecords(rowsOf(source), spec, scope), capturedAt: source.captured_at });
    if (read || !preferPublished) return project(await (read ?? readSourceForConsultation)(spec));
    return readMaster(spec, project, sourceReaders);
  };
  if (path === 'api/panama/pm-review') {
    if (method !== 'GET') return { status: 405, body: { error: 'Método no permitido.' } };
    if (!management.has(session.role)) return { status: 403, body: { error: 'Consulta reservada a Taller y Operaciones.' } };
    const specs = [sourceSpecs[0], sourceSpecs.find(spec => spec.key === 'maintenance'), maintenancePlan, equipmentDetails];
    const results = await Promise.all(specs.map(async spec => {
      try { return [spec.key, await readSection(spec)]; } catch { return [spec.key, null]; }
    }));
    let catalog = null;
    try {
      const cut = await (readPmChecklists ?? readPmChecklistCut)();
      if (Array.isArray(cut?.rows) && Number.isFinite(Date.parse(cut.captured_at))
        && Date.parse(cut.captured_at) <= Date.now() + 300_000) catalog = cut;
    } catch { /* Missing coverage remains an explicit review issue. */ }
    const sources = Object.fromEntries(results);
    if (!results.some(([, value]) => value !== null)) return { status: 503, body: { error: 'No se pudieron consultar los maestros PM.' } };
    return { status: 200, body: { project: PANAMA_PROJECT,
      sources: Object.fromEntries(results.map(([name, value]) => [name, { available: value !== null, capturedAt: value?.capturedAt ?? null }])),
      catalog: { available: catalog !== null, capturedAt: catalog?.captured_at ?? null },
      rows: buildPanamaPmReview(sources, catalog),
    } };
  }
  if (path === 'api/panama/pm-checklist') {
    if (method !== 'GET') return { status: 405, body: { error: 'Método no permitido.' } };
    if (!management.has(session.role)) return { status: 403, body: { error: 'Consulta reservada a Taller y Operaciones.' } };
    return readPrintablePanamaPm(query, session, {
      readPlan: async () => (await readSection(maintenancePlan)).records,
      readEquipment: async () => (await readSection(equipmentDetails)).records,
      readPmChecklists,
    });
  }
  if (path === 'api/panama/componentes') return componentDetails({ method, query, session, readSection });
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
      const { records, capturedAt } = await readSection(spec);
      if (capturedAt) snapshots[spec.key] = capturedAt;
      return [spec.key, records];
    } catch {
      return [spec.key, null];
    }
  }));
  return { status: 200, body: { project: PANAMA_PROJECT, sections: Object.fromEntries(sections), snapshots } };
}
