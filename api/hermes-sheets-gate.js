import { createHash } from 'node:crypto';
import { isSameOriginAuthRequest, requireSession } from './_lib/session-auth.js';
import { canonicalTab, createHermesSheets } from './_lib/hermes-google-sheets.js';
import { dispatchEvidence } from './_lib/hermes-evidence.js';
import { panamaOperationalStore } from './_lib/hermes-operational-store.js';
import { rejectIfRateLimited } from './_lib/rate-limit.js';
import meterHandler from './_lib/cmms-meter.js';
import { dispatchPanama, PANAMA_PROJECT, readOfficialPanamaShifts } from './_lib/hermes-panama.js';
import { createPanamaDemoSheets } from './_lib/hermes-panama-demo.js';
import { technicalDocuments } from './_lib/hermes-technical-library.js';
import { validatePanamaMeterAppend } from './_lib/hermes-shifts.js';
import { readPersonalHistory } from './_lib/hermes-profile.js';
import { visiblePanamaParts } from './_lib/hermes-part-prices.js';

const ADMIN = ['jefe_taller', 'coordinador', 'supervisor', 'gerencia'];
const WORKSHOP = ['mecanico', ...ADMIN];
const ALL = ['operador', ...WORKSHOP];
const FIELD = ['operador', 'supervisor', 'gerencia'];
const MANAGEMENT = ['jefe_taller', 'coordinador', 'gerencia'];
const GERENCIA = ['gerencia'];

const READ = new Map([
  ['01 Inventario', { roles: ALL, unit: 1 }],
  ['Averías', { roles: ALL, unit: 2 }],
  ['ORDENES_TRABAJO', { roles: ADMIN, unit: 3 }],
  ['OT_STATUS_LOG', { roles: ADMIN, linked: ['ORDENES_TRABAJO', 1, 1, 3] }],
  ['14 Inspecciones', { roles: ALL, unit: 4 }],
  ['Inspeccion_Stickers', { roles: ALL, unit: 5 }],
  ['Inspeccion_Hallazgos', { roles: ADMIN, unit: 3 }],
  ['Combustible', { roles: ALL, unit: 3 }],
  ['04B Registro Horómetros', { roles: ALL, unit: 2 }],
  ['05 Historial PM', { roles: ADMIN, unit: 2 }],
  ['Ordenes Mantenimiento', { roles: ADMIN, unit: 2 }],
  ['WORKSHOP_SCHEDULE', { roles: ADMIN, unit: 3 }],
  ['Reporte_Fletes_Transporte', { roles: ALL, unit: 2 }],
  ['Reporte_Viajes_Peña', { roles: ADMIN, unit: 3 }],
  ['Incidentes', { roles: ADMIN, unit: 3 }],
  ['Turnos', { roles: ADMIN, unit: 3 }],
  ['13 Neumáticos', { roles: ADMIN, unit: 1 }],
  ['12 Inventario Rep.', { roles: WORKSHOP }],
  ['Cotizaciones_Pendientes', { roles: ADMIN, unit: 3 }],
  ['02 Gastos', { roles: MANAGEMENT, unit: 10 }],
  ['Proveedores', { roles: MANAGEMENT }],
  ['Activos', { roles: GERENCIA, unit: 0 }],
  ['Órdenes de Compra', { roles: GERENCIA, unit: 5 }],
  ['OC_Lineas', { roles: GERENCIA, linked: ['Órdenes de Compra', 0, 0, 5] }],
]);

// These original intake forms append individual records. Multi-record actions,
// statuses and procurement mutations are accepted only by their domain handler.
const APPEND = new Map([
  ['Combustible', { roles: FIELD, unit: 3, actor: 4, actorId: 13 }],
  ['04B Registro Horómetros', { roles: FIELD, unit: 2, actor: 4, actorId: 9 }],
  ['Reporte_Fletes_Transporte', { roles: [...FIELD, 'coordinador'], unit: 2, actor: 3, actorId: 15 }],
  ['13 Neumáticos', { roles: ADMIN, unit: 1 }],
  ['Proveedores', { roles: GERENCIA }],
  ['Activos', { roles: GERENCIA, unit: 0 }],
]);

const PANAMA_OPERATION_GROUPS = new Map([
  ['taller', ['api/workshop/report', 'api/workshop/transition', 'api/workshop/returns']],
  ['inspecciones', ['api/workshop/dvir', 'api/workshop/sticker', 'api/workshop/stickerreview']],
  ['pm', ['api/workshop/pm', 'api/workshop/schedule']],
  ['turnos', ['api/panama/turnos/entregar', 'api/panama/turnos/revisar']],
  ['despacho', ['api/panama/turnos/despacho']],
  ['compras', ['api/purchasing/request-submit', 'api/purchasing/request-status', 'api/purchasing/order-save',
    'api/purchasing/order-status', 'api/purchasing/order-delete']],
  ['recepcion', ['api/purchasing/order-receive', 'api/purchasing/inventory-move']],
  ['finanzas', ['api/purchasing/order-invoice', 'api/purchasing/order-payment']],
  ['gastos', ['api/purchasing/expense-save', 'api/purchasing/expense-delete', 'api/purchasing/expense-review']],
  ['horometro', ['api/sheets/append:04B Registro Horómetros']],
  ['combustible', ['api/sheets/append:Combustible']],
  ['fletes', ['api/sheets/append:Reporte_Fletes_Transporte']],
  ['llantas', ['api/sheets/append:13 Neumáticos']],
  ['proveedores', ['api/sheets/append:Proveedores']],
  ['activos', ['api/sheets/append:Activos']],
]);
const operationGroup = new Map([...PANAMA_OPERATION_GROUPS].flatMap(([group, routes]) => routes.map(route => [route, group])));
const liveGroups = 'taller,inspecciones,pm,turnos,compras,recepcion,finanzas,gastos,horometro,combustible,fletes,llantas,proveedores,activos';

function enabledPanamaGroups(value) {
  return new Set(String(value ?? '').split(',').map(group => group.trim()).filter(group => PANAMA_OPERATION_GROUPS.has(group)));
}

const PROXY = new Map([
  ['parts', { method: 'GET', roles: WORKSHOP }],
  ['diagrams/list', { method: 'GET', roles: WORKSHOP }],
  ['diagrams/find', { method: 'GET', roles: WORKSHOP }],
  ['ai/fault_code_pages', { method: 'GET', roles: WORKSHOP }],
  ['api/ocr/boleta', { method: 'POST', roles: [...FIELD, 'coordinador'] }],
  ['api/ocr/fuel-dispatch', { method: 'POST', roles: FIELD }],
]);

const UNIT_HEADER = /^(?:ID|UNIDAD|C[ÓO]DIGO(?: UNIDAD)?|ID[_ ]UNIDAD|UNIDAD[_ ]ID|CAMI[ÓO]N|EQUIPO|OT_ID|OC_ID)$/i;
const unitCode = value => String(value ?? '').trim().toUpperCase();
const supportsUnit = (session, unit) => session.allUnits === true || (Boolean(unitCode(unit)) && session.assignedUnits?.some(value => unitCode(value) === unitCode(unit)) === true);
const invalid = (res, status, error) => res.status(status).json({ error });
const knownPath = value => (Array.isArray(value) ? value.join('/') : String(value ?? '')).replace(/^\/+|\/+$/g, '');

const workshop = context => import('./_lib/hermes-workshop.js').then(module => module.dispatchWorkshop(context));
const purchasing = context => import('./_lib/hermes-purchasing.js').then(module => module.dispatchPurchasing(context));
const shifts = context => import('./_lib/hermes-shifts.js').then(module => module.dispatchShifts(context));
const mechanics = (session, unit) => import('./_lib/hermes-identity.js').then(module => module.listWorkshopMechanics(session, unit));
const operators = (session, unit) => import('./_lib/hermes-identity.js').then(module => module.listShiftOperators(session, unit));

async function visibleRows(sheets, tab, rule, session) {
  const rows = await sheets.read(tab, { cached: true });
  if (tab === '12 Inventario Rep.' && session.project === PANAMA_PROJECT && !session.allUnits) {
    const fleet = await sheets.read('01 Inventario', { cached: true });
    const visible = new Set(visiblePanamaParts(rows.slice(5), fleet, session));
    return rows.map((row, index) => index < 5 || visible.has(row) ? row : []);
  }
  if (session.allUnits || (rule.unit === undefined && !rule.linked)) return rows;
  if (rule.linked) {
    const [parentTab, key, parentKey, parentUnit] = rule.linked;
    const parents = await sheets.read(parentTab, { cached: true });
    const allowed = new Set(parents.filter(row => supportsUnit(session, row[parentUnit])).map(row => String(row[parentKey] ?? '')));
    return rows.map((row, index) => allowed.has(String(row[key] ?? '')) || (index < 3 && UNIT_HEADER.test(String(row[key] ?? ''))) ? row : []);
  }
  return rows.map((row, index) => supportsUnit(session, row[rule.unit]) || (index < 3 && UNIT_HEADER.test(String(row[rule.unit] ?? ''))) ? row : []);
}

async function sheetRead(req, res, sheets, session) {
  if (req.method !== 'GET') return invalid(res, 405, 'Método no permitido.');
  const query = req.query ?? {};
  const tab = canonicalTab(query.tab);
  const rule = READ.get(tab);
  if (!rule?.roles.includes(session.role)) return invalid(res, 403, 'Consulta no autorizada.');
  const offset = Number(query.offset ?? 0);
  const limit = Number(query.limit ?? 100_000);
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 0 || limit > 100_000) {
    return invalid(res, 400, 'Paginación inválida.');
  }
  const rows = await visibleRows(sheets, tab, rule, session);
  return res.status(200).json({ data: rows.slice(offset, offset + limit) });
}

async function sheetAppend(req, res, sheets, session) {
  if (req.method !== 'POST') return invalid(res, 405, 'Método no permitido.');
  const { tab: requestedTab, values, expectedUserId } = req.body ?? {};
  const tab = canonicalTab(requestedTab);
  const rule = APPEND.get(tab);
  if (!rule?.roles.includes(session.role)) return invalid(res, 403, 'Esta operación requiere el flujo específico de Hermes.');
  if (expectedUserId && expectedUserId !== session.userId) return invalid(res, 403, 'El registro pertenece a otra sesión.');
  if (!Array.isArray(values) || !values.length || values.length > 75 || values.some(value => !['string', 'number', 'boolean'].includes(typeof value))) {
    return invalid(res, 400, 'Datos de captura inválidos.');
  }
  if (rule.unit !== undefined && (!unitCode(values[rule.unit]) || !supportsUnit(session, values[rule.unit]))) return invalid(res, 403, 'Unidad fuera de tu alcance.');
  if (sheets.nativeOperations && rule.unit !== undefined && tab !== 'Activos') {
    const fleet = await sheets.read('01 Inventario');
    if (!fleet.slice(3).some(asset => unitCode(asset[1]) === unitCode(values[rule.unit]))) {
      return invalid(res, 400, 'La unidad no figura en el inventario TMF.');
    }
  }
  const row = values.slice();
  if (rule.actor !== undefined) row[rule.actor] = session.userName;
  if (session.project === PANAMA_PROJECT && rule.actorId !== undefined) {
    while (row.length < rule.actorId) row.push('');
    row[rule.actorId] = session.userId;
  }
  const fingerprint = createHash('sha256').update(JSON.stringify([tab, row])).digest('hex');
  const key = `append:${session.userId}:${fingerprint}`;
  let guard;
  if (session.project === PANAMA_PROJECT && tab === '04B Registro Horómetros') {
    const previous = await sheets.replay({ key, fingerprint });
    if (previous) return res.status(200).json(previous);
    const version = await validatePanamaMeterAppend(sheets, tab, row);
    guard = `panama:meter:${String(row[2]).trim().toUpperCase()}:${version}`;
  }
  await sheets.commit({ key, fingerprint, guard, writes: [{ tab, append: [row] }], result: { success: true } });
  return res.status(200).json({ success: true });
}

async function proxy(req, res, path, session) {
  const target = process.env.HERMES_UPSTREAM_URL;
  const token = process.env.HERMES_UPSTREAM_TOKEN;
  if (!target || !token) return invalid(res, 503, 'Integración Hermes no configurada.');
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query ?? {})) {
    if (key !== 'path') for (const item of Array.isArray(value) ? value : [value]) params.append(key, String(item));
  }
  const response = await fetch(`${target.replace(/\/$/, '')}/${path}${params.size ? `?${params}` : ''}`, {
    method: req.method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Hermes-Gateway-Token': token,
      'X-Hermes-Role': session.role,
    },
    body: req.method === 'GET' ? undefined : JSON.stringify(req.body ?? {}),
    signal: AbortSignal.timeout(15_000),
  });
  if (response.headers.get('content-type')) res.setHeader('Content-Type', response.headers.get('content-type'));
  return res.status(response.status).send(Buffer.from(await response.arrayBuffer()));
}

export function createHermesGateway({
  sheets: operationalSheets = createHermesSheets(),
  demoSheets,
  sessionReader = requireSession,
  listMechanics = mechanics,
  listShiftOperators = operators,
  dispatchWorkshop = workshop,
  dispatchPurchasing = purchasing,
  readPanama,
  readOfficialShifts,
  panamaTechnicalCatalog = () => process.env.HERMES_PANAMA_TECHNICAL_CATALOG_JSON,
  panamaOnly = false,
  enablePanamaOperations = false,
  enablePanamaFuelCapture = false,
  panamaWriteGroups,
  writeEnabled: operationalWrites = process.env.VERCEL_ENV === 'production' && !['1', 'true'].includes(process.env.HERMES_READ_ONLY),
  pausedOperations = new Set((process.env.HERMES_PAUSED_OPERATIONS || '').split(',').map(knownPath).filter(Boolean)),
} = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const session = await sessionReader(req, res, undefined, { allowPanama: true });
      if (!session) return;
      const path = knownPath(req.query?.path);
      if (!/^[a-zA-Z0-9_./-]+$/.test(path) || path.split('/').some(segment => segment === '.' || segment === '..')) return invalid(res, 400, 'Ruta inválida.');
      if (rejectIfRateLimited(req, res, { scope: 'hermes-gateway', limit: 120 }, session.userId)) return;

      if (panamaOnly && session.project !== PANAMA_PROJECT) return invalid(res, 403, 'Proyecto no habilitado en Hermes Panamá.');
      const demo = session.project === PANAMA_PROJECT && session.previewDemo === true;
      if (demo && !demoSheets) return invalid(res, 503, 'La fuente de prueba no está disponible.');
      const sheets = demo ? demoSheets : operationalSheets;
      const permittedGroups = session.project === PANAMA_PROJECT && !demo ? panamaWriteGroups : undefined;
      const writeEnabled = demo || (operationalWrites && (!permittedGroups || permittedGroups.size > 0));
      const dispatchCapture = writeEnabled && !pausedOperations.has('api/panama/turnos/despacho')
        && (!permittedGroups || permittedGroups.has('despacho'));
      if (path === 'api/evidence') {
        return await dispatchEvidence({ req, res, session, sheets,
          canUpload: domainPath => enablePanamaOperations && writeEnabled && !pausedOperations.has(domainPath)
            && (!permittedGroups || permittedGroups.has(operationGroup.get(domainPath))) });
      }
      if (path === 'api/panama/capacidades') {
        if (session.project !== PANAMA_PROJECT) return invalid(res, 403, 'Consulta reservada a TMF Panamá.');
        if (req.method !== 'GET') return invalid(res, 405, 'Método no permitido.');
        return res.status(200).json({
          fuelCapture: enablePanamaOperations && writeEnabled && (demo || (enablePanamaFuelCapture && (!permittedGroups || permittedGroups.has('combustible')))),
        });
      }
      if (path === 'api/panama/documentos-tecnicos') {
        if (session.project !== PANAMA_PROJECT || !WORKSHOP.includes(session.role)) return invalid(res, 403, 'Consulta no autorizada.');
        if (req.method !== 'GET') return invalid(res, 405, 'Método no permitido.');
        const result = technicalDocuments(panamaTechnicalCatalog(), req.query);
        return res.status(result.status).json(result.body);
      }
      const shiftRoute = path === 'api/panama/turnos' || path.startsWith('api/panama/turnos/');
      if ((path.startsWith('api/panama/') && !shiftRoute) || (session.project === PANAMA_PROJECT && !enablePanamaOperations)) {
        const result = await dispatchPanama({ path, method: req.method, query: req.query, session, read: demo ? demoSheets.readSummary : readPanama });
        return res.status(result.status).json(result.body);
      }

      if (path === 'health' && req.method === 'GET') {
        if (session.project !== PANAMA_PROJECT) {
          await sheets.read('01 Inventario', { cached: true });
          return res.status(200).json({ status: 'ok', writeEnabled });
        }
        const [fleet, operations] = await Promise.allSettled([
          sheets.read('01 Inventario', { cached: true }),
          sheets.read('ORDENES_TRABAJO', { cached: true, requireExisting: true }),
        ]);
        const checks = {
          identity: 'up',
          fleet: fleet.status === 'fulfilled' ? 'up' : 'down',
          operations: operations.status === 'fulfilled' ? 'up' : 'down',
        };
        return res.status(200).json({
          status: checks.fleet === 'up' && checks.operations === 'up' ? 'ok' : 'degraded',
          checks,
          writeEnabled: writeEnabled && checks.operations === 'up',
          dataMode: demo ? 'demo' : 'operational',
          ...(permittedGroups && { operationGroups: writeEnabled && checks.operations === 'up' ? [...permittedGroups] : [] }),
          deployment: {
            project: 'hermes-panama',
            environment: process.env.VERCEL_ENV ?? 'local',
            host: process.env.VERCEL_URL ?? null,
            id: process.env.VERCEL_DEPLOYMENT_ID ?? null,
            commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
          },
        });
      }
      if (path === 'api/profile/history') {
        if (req.method !== 'GET') return invalid(res, 405, 'Método no permitido.');
        const history = await readPersonalHistory(sheets, session, {
          mayRead: tab => READ.get(tab)?.roles.includes(session.role),
          supportsUnit: unit => supportsUnit(session, unit),
        });
        return res.status(200).json(history);
      }
      if (path === 'api/sheets/read') return await sheetRead(req, res, sheets, session);
      if (req.method !== 'GET' && pausedOperations.has(path)) return invalid(res, 503, 'Operación en pausa. Usa el procedimiento vigente de tu área.');

      const route = PROXY.get(path) ?? (/^diagrams\/file\/[A-Za-z0-9_-]+\.pdf$/i.test(path) ? { method: 'GET', roles: WORKSHOP } : undefined);
      if (route) {
        if (session.project === PANAMA_PROJECT) return invalid(res, 503, 'Integración no configurada para Panamá.');
        if (req.method !== route.method) return invalid(res, 405, 'Método no permitido.');
        if (!route.roles.includes(session.role)) return invalid(res, 403, 'Integración no autorizada.');
        if (req.method === 'POST' && !writeEnabled) return invalid(res, 503, 'Integración externa deshabilitada en este entorno.');
        return await proxy(req, res, path, session);
      }

      if (req.method !== 'GET') {
        if (!isSameOriginAuthRequest(req)) return invalid(res, 403, 'Solicitud no autorizada.');
        if (req.body?.expectedUserId && req.body.expectedUserId !== session.userId) {
          return invalid(res, 403, 'El registro pertenece a otra sesión.');
        }
        if (!writeEnabled) return invalid(res, 503, 'Este despliegue permite consulta. Usa el procedimiento vigente de tu área.');
        const routeKey = path === 'api/sheets/append' ? `${path}:${canonicalTab(req.body?.tab)}` : path;
        if (pausedOperations.has(routeKey)) return invalid(res, 503, 'Operación en pausa.');
        const group = operationGroup.get(routeKey);
        if (permittedGroups && (!group || !permittedGroups.has(group))) {
          return invalid(res, 503, 'Este flujo está en consulta. Usa el procedimiento vigente de tu área.');
        }
      }
      if (shiftRoute) {
        const result = await shifts({ path, method: req.method, body: req.body ?? {}, session, sheets,
          listShiftOperators: dispatchCapture ? listShiftOperators : undefined,
          readOfficialShifts: demo ? undefined : readOfficialShifts });
        if (path === 'api/panama/turnos/despacho' && req.method === 'GET') {
          return res.status(result.status).json({ ...result.body, captureAvailable: dispatchCapture });
        }
        return res.status(result.status).json(result.body);
      }
      if (path === 'api/sheets/append') {
        if (session.project === PANAMA_PROJECT && canonicalTab(req.body?.tab) === 'Combustible' && !demo && !enablePanamaFuelCapture) {
          return invalid(res, 403, 'La captura de combustible TMF está pendiente de habilitación por Operaciones.');
        }
        return await sheetAppend(req, res, sheets, session);
      }
      if (path.startsWith('api/sheets/')) return invalid(res, 403, 'Usa el flujo específico de Hermes para cambiar este registro.');
      if (path === 'api/cmms/meter') {
        if (session.project === PANAMA_PROJECT) return invalid(res, 503, 'Enlace CMMS de Panamá pendiente.');
        return await meterHandler(req, res);
      }

      const dispatch = path.startsWith('api/workshop/') ? dispatchWorkshop : path.startsWith('api/purchasing/') ? dispatchPurchasing : null;
      if (!dispatch) return invalid(res, 404, 'Ruta no disponible.');
      const result = await dispatch({ path, method: req.method, body: req.body ?? {}, query: req.query ?? {}, session, sheets, listMechanics });
      return res.status(result.status).json(result.body);
    } catch (error) {
      const status = error?.status;
      if (Number.isInteger(status) && status >= 400 && status < 500 && !error.response) return invalid(res, status, error.message);
      if (req.method === 'GET') return invalid(res, 503, 'La fuente de datos no está disponible. Reintenta la consulta.');
      return invalid(res, 503, 'No se pudo confirmar la operación. Consulta el registro antes de reintentar.');
    }
  };
}

const live = process.env.VERCEL_ENV === 'production';
const readOnly = ['1', 'true'].includes(process.env.HERMES_READ_ONLY);
const productionGroups = enabledPanamaGroups(process.env.HERMES_PANAMA_WRITE_GROUPS ?? liveGroups);
if (process.env.HERMES_PANAMA_DISPATCH_VERIFIED !== 'true') productionGroups.delete('despacho');
export default createHermesGateway({
  demoSheets: process.env.VERCEL_ENV === 'preview' ? createPanamaDemoSheets() : undefined,
  sheets: panamaOperationalStore,
  panamaOnly: true,
  enablePanamaOperations: true,
  readOfficialShifts: readOfficialPanamaShifts,
  panamaWriteGroups: productionGroups,
  enablePanamaFuelCapture: process.env.HERMES_PANAMA_FUEL_CAPTURE !== 'false',
  writeEnabled: live && !readOnly,
});
