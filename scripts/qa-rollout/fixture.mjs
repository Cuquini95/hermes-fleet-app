import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:https';
import { tmpdir } from 'node:os';
import { extname, join, relative, resolve } from 'node:path';
import { getCACertificates, setDefaultCACertificates } from 'node:tls';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

export const roles = {
  operador: '/operator',
  mecanico: '/mechanic',
  jefe_taller: '/workshop',
  coordinador: '/coordinator',
  supervisor: '/supervisor',
  gerencia: '/dashboard',
};

const qaProject = 'tmf-panama';
const qaPublicKey = 'fixture-only-public-key';
const qaServiceKey = 'fixture-only-service-key';
const units = ['DZ203', 'EX401', 'DZ205'];
export const fixturePassword = 'HermesSyntheticTestOnly!2026';
export const photoPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==', 'base64');

export const tabs = {
  fleet: '01 Inventario', failure: 'Averías', orders: 'ORDENES_TRABAJO', history: 'OT_STATUS_LOG',
  dvir: '14 Inspecciones', sticker: 'Inspeccion_Stickers', findings: 'Inspeccion_Hallazgos',
  pm: 'Ordenes Mantenimiento', pmHistory: '05 Historial PM', schedule: 'WORKSHOP_SCHEDULE',
  requests: 'Cotizaciones_Pendientes', purchases: 'Órdenes de Compra', lines: 'OC_Lineas',
  providers: 'Proveedores', parts: '12 Inventario Rep.', expenses: '02 Gastos', changes: '10 Control Cambios',
};

function priorMonthDate() {
  const [year, month] = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'America/Panama' }).format(new Date()).split('-');
  const monthStart = new Date(Date.UTC(Number(year), Number(month) - 2, 6));
  return monthStart.toISOString().slice(0, 10).split('-').reverse().join('/');
}

function fixtureRows() {
  return new Map([
    [tabs.fleet, [
      ['Inventario de prueba'], ['Operación QA'], ['#','COD1','Descripción','Marca','Modelo','Año','Serie','Ubicación','Estado','Lectura Hr/Km'],
      ['1','DZ203','Articulado QA','Caterpillar','745','2018','QA-DZ203','Frente QA','Operativo','1475'],
      ['2','EX401','Tractor QA','Komatsu','D65EX-16','2018','QA-EX401','Frente QA','Operativo','1960'],
      ['3','DZ205','Volteo QA','Mack','Granite','2022','QA-DZ205','Frente QA','Operativo','390'],
      ['4','EX410','Volteo QA sin asignar','Mack','Granite','2022','QA-EX410','Frente QA','Operativo','420'],
    ]],
    [tabs.orders, [
      ['ROW_ID','OT_ID','FECHA','UNIDAD','TIPO_AVERIA','DESCRIPCION','SEVERIDAD','PRIORIDAD','MECANICO','ESTADO','FOTO_URL','AVERIA_REF','PARTES','COSTO_ESTIMADO','FECHA_CIERRE','OBSERVACIONES','PROGRESO'],
      ['replica-qa','OT-0004','11/11/2026','DZ203','Llanta','Réplica sintética de incidente de llanta','ALTA','ALTA','','Abierta','','OT-0004','','','','','0'],
    ]],
    [tabs.failure, [
      ['FECHA','HORA','UNIDAD','TIPO_AVERIA','DESCRIPCION','SEVERIDAD','TECNICO','TIEMPO_PARO','COSTO_ESTIMADO','ESTADO','SOLUCION','OBSERVACIONES','PROVEEDOR_PIEZA','OT_ID','FOTO_URL'],
      ['11/11/2026','14:15:00','DZ203','Llanta','Réplica sintética de incidente de llanta','ALTA','QA operador','','','Abierta','','','','OT-0004',''],
    ]],
    [tabs.history, [['TIMESTAMP','OT_ID','FIELD','OLD_VALUE','NEW_VALUE','CHANGED_BY','ROLE']]],
    [tabs.schedule, [['ID','FECHA','OT_ID','UNIDAD','MECANICO','HORAS','NOTAS']]],
    [tabs.dvir, [['Fecha','Hora','Unidad','Tipo','Horometro','Operador','Resultado']]],
    [tabs.sticker, [['Fecha','Unidad','Tipo','Estado']]],
    [tabs.findings, [['ID','Unidad','Hallazgo','Estado']]],
    [tabs.pm, [['OT_ID','FECHA','UNIDAD','NIVEL','ESTADO']]],
    [tabs.pmHistory, [['OT_ID','FECHA','UNIDAD','NIVEL','ESTADO']]],
    [tabs.requests, [['FECHA','PART_NUMBER','DESCRIPCION','CANTIDAD','PRECIO','EQUIPO','URGENCIA','NOTAS','ESTADO','FOLIO']]],
    [tabs.providers, [['Nombre','RFC','Dirección','Ciudad','Estado','CP','Teléfono','Email','Contacto'], ['Proveedor QA','QAT000000000','Calle de prueba 10','Ciudad QA','Jalisco','00000','0000000000','proveedor@example.invalid','Contacto QA']]],
    [tabs.purchases, [['OC_ID','FECHA','PROVEEDOR','RFC','DIRECCION','UNIDAD','SUBTOTAL','IVA','ENVIO','OTROS','TOTAL','ESTADO','COMENTARIOS','APROBADA_POR','FECHA_ENTREGA']]],
    [tabs.lines, [['OC_ID','ITEM','DESCRIPCION','CANTIDAD','PRECIO_UNITARIO','TOTAL'], ['OC-001','1','Partida histórica ficticia sin cabecera','1','12','12']]],
    ['Movimientos Repuestos PA', [['ID']]],
    [tabs.parts, [[], [], [], [], ['SKU','Descripción','OEM','Serie','Unidad','Stock','Mínimo','Precio','Ubicación','','Equipo','','','Proveedor'], ['QA-001','Filtro hidráulico de prueba','OEM-QA-001','','pza','8','3','123.45','Almacén QA','','DZ203','','','Proveedor QA'], ['QA-002','Sello de prueba','OEM-QA-002','','pza','1','2','21.50','Almacén QA','','EX401','','','Proveedor QA']]],
    [tabs.expenses, [
      ['ID','FECHA','HORA','TIPO','PROVEEDOR','RFC','FOLIO_FACTURA','SUBTOTAL','IVA','TOTAL','UNIDAD','OT','RESPONSABLE','METODO_PAGO','LINE_ITEMS','IMAGEN_URL','ESTADO'],
      ['GST-HIST-SIM','04/10/2026','09:00:00','Refaccion','Proveedor QA','QAT000000000','FAC-HIST-SIM','200.00','32.00','232.00','DZ203','','QA Gerencia','Transferencia','[QA-001] Filtro hidráulico de prueba x2 $200.00','','Aprobado','','','232.00','','TP_PA_QA','USD','ITBMS','04/10/2026'],
      ['GST-MES-ANTERIOR-SIM',priorMonthDate(),'11:00:00','Servicio','Proveedor QA mes anterior','QAT000000001','FAC-ANTERIOR-SIM','100.25','16.04','116.29','EX401','','QA Gerencia','Transferencia','','','Aprobado','','','116.29','','TP_PA_QA','USD','ITBMS',priorMonthDate()],
    ]],
    [tabs.changes, [['TIMESTAMP','ACTOR','ROL','ACCION','FOLIO','DETALLE']]],
    ['Combustible', [['Registro QA'], ['ID','FECHA','HORA','UNIDAD','OPERADOR','TIPO','LITROS'],
      ['FUEL-QA-1','11/11/2026','07:00','DZ203','QA operador','Diésel','100'],
      ['FUEL-QA-2','11/11/2026','08:00','EX401','QA operador','Diésel','150']]],
    ['04B Registro Horómetros', [['FECHA','HORA','UNIDAD','MODELO','OPERADOR','TURNO','HOROMETRO']]],
    ['Personal_TCM', [['Nombre','Teléfono','Rol','Notas']]],
  ]);
}

function stateError(status, message) {
  return Object.assign(new Error(message), { status, statusCode: status });
}

const nameOf = name => ({ Averias: tabs.failure, Gastos: tabs.expenses })[name] ?? name;
const clone = value => structuredClone(value);
const wait = ms => new Promise(resolveDelay => setTimeout(resolveDelay, ms));

function columnNumber(letters) {
  return [...letters].reduce((n, letter) => n * 26 + letter.charCodeAt(0) - 64, 0);
}

export function makeSheetsFixture() {
  const tables = fixtureRows();
  const mutations = new Map();
  const versions = new Set();
  const unavailable = new Set();
  const faults = [];
  const commits = [];

  function read(tab) {
    if (unavailable.has(nameOf(tab))) throw stateError(503, 'Lectura de prueba no disponible');
    return clone(tables.get(nameOf(tab)) ?? []);
  }

  function replay({ key, fingerprint }) {
    const prior = mutations.get(key);
    if (!prior) return null;
    if (prior.fingerprint !== fingerprint) throw stateError(409, 'La operación de prueba ya tiene otros datos');
    return clone(prior.result);
  }

  async function commit({ key, fingerprint, guard, guards, writes, result }) {
    if (mutations.has(key)) {
      const previous = replay({ key, fingerprint });
      commits.push({ key, replayed: true, rows: 0 });
      return { replayed: true, result: previous };
    }
    const faultIndex = faults.findIndex(fault => fault.matches(writes));
    const fault = faultIndex >= 0 ? faults.splice(faultIndex, 1)[0] : null;
    if (fault?.delay) await wait(fault.delay);
    if (fault?.when === 'before') throw stateError(503, 'Persistencia de prueba no disponible');
    if (mutations.has(key)) return commit({ key, fingerprint, guard, guards, writes, result });
    const keys = [guard, ...(guards ?? [])].filter(Boolean);
    if (keys.some(value => versions.has(value))) throw stateError(409, 'El registro de prueba fue actualizado');
    const draft = new Map();
    let count = 0;
    for (const write of writes) {
      const tab = nameOf(write.tab);
      const target = draft.get(tab) ?? read(tab);
      if (write.append) {
        target.push(...clone(write.append));
        count += write.append.length;
      } else if (Number.isInteger(write.row) && write.row >= 0 && Array.isArray(write.values)) {
        const row = [...(target[write.row] ?? [])];
        const start = write.col ?? 0;
        for (let i = 0; i < write.values.length; i++) row[start + i] = write.values[i];
        target[write.row] = row;
        count++;
      } else {
        throw stateError(400, 'Escritura de fixture no válida');
      }
      draft.set(tab, target);
    }
    for (const [tab, rows] of draft) tables.set(tab, rows);
    mutations.set(key, { fingerprint, result: clone(result) });
    for (const value of keys) versions.add(value);
    commits.push({ key, replayed: false, rows: count });
    if (fault?.when === 'after') throw stateError(503, 'Respuesta de prueba perdida después del guardado');
    return { replayed: false, result: clone(result) };
  }

  return {
    read, commit, replay, commits,
    readRange(range) {
      const [tab, ...rest] = range.split('!');
      const source = read(tab.replace(/^'|'$/g, '').replace(/''/g, "'"));
      const bounds = rest.join('!').match(/^([A-Z]+)(\d+):([A-Z]+)(\d*)$/);
      if (!bounds) return source;
      return source.slice(Number(bounds[2]) - 1, bounds[4] ? Number(bounds[4]) : source.length)
        .map(row => row.slice(columnNumber(bounds[1]) - 1, columnNumber(bounds[3])));
    },
    async ensureTab(tab, headers) {
      if (!tables.has(nameOf(tab))) tables.set(nameOf(tab), [clone(headers)]);
    },
    seed(tab, rows) { tables.set(nameOf(tab), clone(rows)); },
    failNext(fault) { faults.push(fault); },
    setUnavailable(tabs, blocked) {
      for (const tab of tabs) {
        if (blocked) unavailable.add(nameOf(tab));
        else unavailable.delete(nameOf(tab));
      }
    },
  };
}

const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.pdf': 'application/pdf',
};

function account(number, role, project = qaProject) {
  const id = `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
  const email = `hermes-${number}@example.invalid`;
  const restricted = role === 'operador' || role === 'mecanico';
  return {
    user: { id, email, email_confirmed_at: '2026-11-11T12:00:00.000Z' },
    membership: {
      user_id: id, email, user_name: `QA ${role} ${number}`, role, projects: [project],
      assigned_units: restricted ? units : [], unit_scope: restricted ? 'assigned' : 'all',
      active: true, can_approve_purchases: role === 'gerencia' && ![12, 18].includes(number),
      can_receive_purchases: project === qaProject && number === 99 && role === 'jefe_taller',
      can_record_purchase_invoices: project === qaProject && number === 12 && role === 'gerencia',
      can_record_purchase_payments: project === qaProject && number === 18 && role === 'gerencia',
      can_review_panama_hse: project === qaProject && number === 5 && role === 'supervisor',
    },
  };
}

const accounts = Array.from({ length: 100 }, (_, index) => account(index + 1, Object.keys(roles)[index % 6]));
export const firstAccount = role => accounts.find(item => item.membership.role === role);
export const loadAccounts = accounts;
export const nonApprovingManager = account(102, 'gerencia');
nonApprovingManager.membership.can_approve_purchases = false;

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

async function requestBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8 * 1024 * 1024) throw stateError(413, 'Cuerpo de prueba demasiado grande');
    chunks.push(chunk);
  }
  if (!size) return undefined;
  const bytes = Buffer.concat(chunks);
  if (!String(req.headers['content-type']).includes('application/json')) return bytes;
  return JSON.parse(bytes.toString('utf8'));
}

function adaptResponse(res) {
  res.status = status => { res.statusCode = status; return res; };
  res.json = data => json(res, res.statusCode, data);
  res.send = data => res.end(Buffer.isBuffer(data) || typeof data === 'string' ? data : JSON.stringify(data));
  return res;
}

function scopedEnv(entries) {
  const previous = Object.fromEntries(Object.keys(entries).map(key => [key, process.env[key]]));
  for (const [key, value] of Object.entries(entries)) process.env[key] = value;
  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

function firstEq(query, key) {
  return (query.get(key) ?? '').replace(/^eq\./, '');
}

async function loopbackCertificate() {
  const directory = await mkdtemp(join(tmpdir(), 'hermes-rollout-tls-'));
  const keyFile = join(directory, 'loopback-key.pem');
  const certFile = join(directory, 'loopback-cert.pem');
  try {
    await promisify(execFile)('openssl', ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256',
      '-days', '1', '-nodes', '-subj', '/CN=localhost', '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost',
      '-keyout', keyFile, '-out', certFile]);
    const [key, cert] = await Promise.all([readFile(keyFile), readFile(certFile)]);
    return { key, cert };
  } finally { await rm(directory, { recursive: true, force: true }); }
}

export async function startFixture({ repoDirectory, distDirectory, listenPort = 0, withGateway = true }) {
  const sheet = makeSheetsFixture();
  const directory = [...accounts, account(101, 'operador', 'otro-proyecto-qa'), nonApprovingManager];
  const identities = new Map(directory.map(item => [item.user.email, item]));
  const memberships = new Map(directory.map(item => [item.user.id, item.membership]));
  const sessions = new Map();
  const photos = new Map();
  const alerts = [];
  const errors = [];
  const outboundBlocked = [];
  let activeLogins = 0;
  let peakLogins = 0;
  let origin;
  let gateway;
  let auth;

  async function serveAsset(url, res) {
    let filename = resolve(distDirectory, `.${decodeURIComponent(url.pathname)}`);
    const path = relative(distDirectory, filename);
    if (path.startsWith('..')) return json(res, 404, { error: 'Archivo fuera de fixture' });
    if (!(await stat(filename).catch(() => null))?.isFile()) {
      if (extname(filename) && url.pathname !== '/') return json(res, 404, { error: 'Asset no encontrado' });
      filename = resolve(distDirectory, 'index.html');
    }
    res.writeHead(200, { 'Content-Type': types[extname(filename)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(filename));
  }

  const certificate = await loopbackCertificate();
  const server = createServer(certificate, async (req, res) => {
    const url = new URL(req.url, origin);
    const path = url.pathname;
    try {
      const body = await requestBody(req);
      if (path === '/auth/v1/token' && req.method === 'POST') {
        activeLogins++;
        peakLogins = Math.max(peakLogins, activeLogins);
        try {
          await wait(75);
          const entry = identities.get(body?.email);
          if (!entry || body?.password !== fixturePassword) return json(res, 400, { error: 'Credenciales de prueba inválidas' });
          return json(res, 200, { user: entry.user, access_token: `fixture-${entry.user.id}` });
        } finally { activeLogins--; }
      }
      if (path.startsWith('/rest/v1/') && req.headers.apikey !== qaServiceKey) {
        return json(res, 401, { error: 'Proveedor de prueba requiere servicio autorizado' });
      }
      if (path === '/rest/v1/hermes_memberships' && req.method === 'GET') {
        const requested = firstEq(url.searchParams, 'user_id');
        const role = firstEq(url.searchParams, 'role');
        const project = (url.searchParams.get('projects') ?? '').match(/^cs\.\{([^}]+)\}$/)?.[1];
        const results = requested ? [memberships.get(requested)].filter(Boolean) : [...memberships.values()];
        return json(res, 200, results.filter(member => (!role || member.role === role) && (!project || member.projects.includes(project))));
      }
      if (path === '/rest/v1/hermes_sessions') {
        const hash = firstEq(url.searchParams, 'session_hash');
        if (req.method === 'POST') {
          if (!memberships.has(body?.user_id) || !body?.session_hash) return json(res, 400, { error: 'Sesión de prueba incompleta' });
          sessions.set(body.session_hash, body);
          return json(res, 201, []);
        }
        if (req.method === 'DELETE') {
          sessions.delete(hash);
          return res.writeHead(204).end();
        }
        if (req.method === 'GET') {
          const entry = sessions.get(hash);
          return json(res, 200, entry ? [{ ...entry, hermes_memberships: memberships.get(entry.user_id) }] : []);
        }
      }
      if (path.startsWith('/storage/v1/object/')) {
        const key = path.replace(/^\/storage\/v1\/object\/(public\/)?/, '');
        if (req.method === 'POST') {
          photos.set(key, Buffer.isBuffer(body) ? body : photoPng);
          return json(res, 200, { Key: key, Id: 'adjunto-sintético' });
        }
        if (req.method === 'GET' && photos.has(key)) {
          res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
          return res.end(photos.get(key));
        }
        return json(res, 404, { error: 'Foto de prueba no encontrada' });
      }
      if (path === '/api/qa/receipt-upload' && req.method === 'POST' && Buffer.isBuffer(body)) {
        const key = `receipt-photos/${randomUUID()}.jpg`;
        photos.set(key, body);
        return json(res, 200, { receiptUrl: `${origin}/storage/v1/object/public/${key}` });
      }
      if (path === '/hermes-api/api/ocr/receipt' && req.method === 'POST') {
        return json(res, 200, { proveedor: 'Proveedor QA', rfc_proveedor: 'QAT000000000', folio_factura: 'FAC-QA-MOVIL',
          tipo: 'Refaccion', subtotal: 120, iva: 19.20, total: 139.20, line_items: [{ part_number: 'QA-001', description: 'Filtro hidráulico de prueba', qty: 1, unit_price: 120, subtotal: 120 }] });
      }
      const route = path.startsWith('/hermes-api/') ? path.slice('/hermes-api/'.length) : null;
      req.body = body;
      req.query = Object.fromEntries(url.searchParams);
      if (auth?.[path]) return await auth[path](req, adaptResponse(res));
      if (route !== null) {
        if (!gateway) return json(res, 503, { error: 'Gateway de prueba aún no iniciado' });
        req.query.path = route;
        return await gateway(req, adaptResponse(res));
      }
      if (path.startsWith('/api/') || path.startsWith('/auth/') || path.startsWith('/rest/')) {
        return json(res, 404, { error: 'Servicio sin fixture' });
      }
      return await serveAsset(url, res);
    } catch (error) {
      errors.push({ path, message: error.message });
      if (!res.headersSent) return json(res, error.status ?? 500, { error: 'Error del servidor de prueba' });
      return res.end();
    }
  });

  await new Promise((ok, fail) => server.once('error', fail).listen(listenPort, '127.0.0.1', ok));
  origin = `https://127.0.0.1:${server.address().port}`;
  const originalCertificates = getCACertificates('default');
  setDefaultCACertificates([...originalCertificates, certificate.cert.toString('utf8')]);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, ...args) => {
    const target = new URL(input instanceof Request ? input.url : String(input));
    if (target.origin !== origin) {
      outboundBlocked.push(target.origin);
      return Promise.reject(new Error('La verificación sólo permite red loopback del fixture'));
    }
    return originalFetch(input, ...args);
  };
  const restoreEnv = scopedEnv({
    NODE_ENV: 'test', VERCEL_ENV: 'preview', HERMES_AUTH_SECRET: 'hermes-qa-fixture-signing-key-never-production',
    HERMES_AUTH_SUPABASE_URL: origin, HERMES_AUTH_SUPABASE_PUBLISHABLE_KEY: qaPublicKey,
    HERMES_AUTH_SUPABASE_SERVICE_ROLE_KEY: qaServiceKey, HERMES_AUTH_PROJECT: qaProject,
    HERMES_UPSTREAM_URL: '', HERMES_UPSTREAM_TOKEN: '', HERMES_GOOGLE_SERVICE_ACCOUNT_JSON: '',
    HERMES_GOOGLE_SHEET_ID: '', HERMES_GOOGLE_SHEETS_ID: '', TELEGRAM_BOT_TOKEN: '',
    HERMES_WORKSHOP_STORAGE_ORIGIN: origin, HERMES_EXPENSE_PRICE_CURRENCY: 'USD',
    HERMES_PANAMA_PM_CHECKLISTS_JSON: JSON.stringify(['PM-250', 'PM-1'].map(level => ({
      model: 'Komatsu D65EX-16', level, reference: 'Checklist sintético QA, revisión 1',
      tasks: [{ id: 'review-qa', label: 'Comprobación sintética de mantenimiento' }],
    }))),
    HERMES_PURCHASE_ISSUERS_JSON: JSON.stringify([{ id: 'TP_PA_QA', name: 'Trans Plus Panamá QA', currency: 'USD', taxLabel: 'ITBMS', taxBps: 700, template: 'transplus' }]), HERMES_EXPENSE_RECEIPT_URL_PREFIX: `${origin}/storage/v1/object/public/receipt-photos/`,
  });
  async function stop() {
    globalThis.fetch = originalFetch;
    setDefaultCACertificates(originalCertificates);
    restoreEnv();
    server.closeAllConnections();
    await new Promise(ok => server.close(ok));
  }
  try {
    const moduleAt = path => import(pathToFileURL(resolve(repoDirectory, path)).href);
    const [login, validate, logout, gate, parts] = await Promise.all([
      moduleAt('api/auth/login.js'), moduleAt('api/auth/session.js'), moduleAt('api/auth/logout.js'),
      withGateway ? moduleAt('api/hermes-sheets-gate.js') : null,
      withGateway ? moduleAt('api/parts/import.js') : null,
    ]);
    auth = { '/api/auth/login': login.default, '/api/auth/session': validate.default, '/api/auth/logout': logout.default };
    if (withGateway) {
      if (typeof gate.createHermesGateway !== 'function') throw new Error('La versión no exporta createHermesGateway');
      gateway = gate.createHermesGateway({ sheets: sheet, writeEnabled: true, panamaOnly: true, enablePanamaOperations: true, enablePanamaFuelCapture: true });
      if (typeof parts.createPartsHandler === 'function') auth['/api/parts/import'] = parts.createPartsHandler({
        readRows: sheet.readRange, readFleet: () => sheet.read(tabs.fleet), panama: true,
        sendAlert: async changes => { alerts.push(clone(changes)); return { sent: true }; },
      });
    }
    return {
      origin, repoDirectory, sheet, photos, alerts, errors, outboundBlocked, stop, peakLogins: () => peakLogins,
      buildEnv: { VITE_HERMES_API_URL: '/hermes-api', VITE_SUPABASE_URL: origin, VITE_SUPABASE_ANON_KEY: qaPublicKey,
        VITE_HERMES_EXPENSE_RECEIPT_UPLOAD_PATH: '/api/qa/receipt-upload', VITE_SENTRY_DSN: '' },
    };
  } catch (error) {
    await stop();
    throw error;
  }
}
