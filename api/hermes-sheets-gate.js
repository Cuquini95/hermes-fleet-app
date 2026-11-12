import { createHash } from 'node:crypto';
import { requireSession } from './_lib/session-auth.js';
import { canonicalTab, createHermesSheets } from './_lib/hermes-google-sheets.js';
import { rejectIfRateLimited } from './_lib/rate-limit.js';
import meterHandler from './_lib/cmms-meter.js';

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
  ['Combustible', { roles: FIELD, unit: 3, actor: 4 }],
  ['04B Registro Horómetros', { roles: FIELD, unit: 2, actor: 4 }],
  ['Reporte_Fletes_Transporte', { roles: [...FIELD, 'coordinador'], unit: 2, actor: 3 }],
  ['13 Neumáticos', { roles: ADMIN, unit: 1 }],
  ['Proveedores', { roles: GERENCIA }],
  ['Activos', { roles: GERENCIA, unit: 0 }],
]);

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
const mechanics = (session, unit) => import('./_lib/hermes-identity.js').then(module => module.listWorkshopMechanics(session, unit));

async function visibleRows(sheets, tab, rule, session) {
  const rows = await sheets.read(tab, { cached: true });
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
  const row = values.slice();
  if (rule.actor !== undefined) row[rule.actor] = session.userName;
  const fingerprint = createHash('sha256').update(JSON.stringify([tab, row])).digest('hex');
  await sheets.commit({ key: `append:${session.userId}:${fingerprint}`, fingerprint, writes: [{ tab, append: [row] }], result: { success: true } });
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
  sheets = createHermesSheets(),
  sessionReader = requireSession,
  listMechanics = mechanics,
  dispatchWorkshop = workshop,
  dispatchPurchasing = purchasing,
  writeEnabled = process.env.VERCEL_ENV === 'production' && !['1', 'true'].includes(process.env.HERMES_READ_ONLY),
  pausedOperations = new Set((process.env.HERMES_PAUSED_OPERATIONS || '').split(',').map(knownPath).filter(Boolean)),
} = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const session = await sessionReader(req, res);
      if (!session) return;
      const path = knownPath(req.query?.path);
      if (!/^[a-zA-Z0-9_./-]+$/.test(path) || path.split('/').some(segment => segment === '.' || segment === '..')) return invalid(res, 400, 'Ruta inválida.');
      if (rejectIfRateLimited(req, res, { scope: 'hermes-gateway', limit: 120 }, session.userId)) return;

      if (path === 'health' && req.method === 'GET') {
        await sheets.read('01 Inventario', { cached: true });
        return res.status(200).json({ status: 'ok', writeEnabled });
      }
      if (path === 'api/sheets/read') return await sheetRead(req, res, sheets, session);
      if (req.method !== 'GET' && pausedOperations.has(path)) return invalid(res, 503, 'Operación en pausa. Usa el procedimiento vigente de tu área.');

      const route = PROXY.get(path) ?? (/^diagrams\/file\/[A-Za-z0-9_-]+\.pdf$/i.test(path) ? { method: 'GET', roles: WORKSHOP } : undefined);
      if (route) {
        if (req.method !== route.method) return invalid(res, 405, 'Método no permitido.');
        if (!route.roles.includes(session.role)) return invalid(res, 403, 'Integración no autorizada.');
        if (req.method === 'POST' && !writeEnabled) return invalid(res, 503, 'Integración externa deshabilitada en este entorno.');
        return await proxy(req, res, path, session);
      }

      if (req.method !== 'GET' && !writeEnabled) return invalid(res, 503, 'Este despliegue permite consulta.');
      if (path === 'api/sheets/append') return await sheetAppend(req, res, sheets, session);
      if (path.startsWith('api/sheets/')) return invalid(res, 403, 'Usa el flujo específico de Hermes para cambiar este registro.');
      if (path === 'api/cmms/meter') return await meterHandler(req, res);

      const dispatch = path.startsWith('api/workshop/') ? dispatchWorkshop : path.startsWith('api/purchasing/') ? dispatchPurchasing : null;
      if (!dispatch) return invalid(res, 404, 'Ruta no disponible.');
      const result = await dispatch({ path, method: req.method, body: req.body ?? {}, query: req.query ?? {}, session, sheets, listMechanics });
      return res.status(result.status).json(result.body);
    } catch (error) {
      const status = error?.status;
      if (Number.isInteger(status) && status >= 400 && status < 500 && !error.response) return invalid(res, status, error.message);
      return invalid(res, 503, 'No se pudo confirmar la operación. Consulta el registro antes de reintentar.');
    }
  };
}

export default createHermesGateway();
