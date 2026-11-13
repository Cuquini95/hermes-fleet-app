import { createHash } from 'node:crypto';
import { hasIdentityUnit, identityConfig, identityRequest, isIdentityUserId } from './hermes-identity.js';
import { isSameOriginAuthRequest } from './session-auth.js';

const PROJECT = 'tmf-panama';
const BUCKET = 'hermes-panama-evidence';
const METADATA = '/rest/v1/hermes_panama_evidence';
const LINK = '/hermes-api/api/evidence?id=';
const LIMIT = 3 * 1024 * 1024; // Fits the Vercel request limit after base64 encoding.
const MAX_PHOTOS = 40;
const ID = /^[a-f\d]{64}$/;
const UNIT = /^[A-Z0-9][A-Z0-9 ._/-]{0,39}$/;
const ORDER_ID = /^OT-[A-Z0-9][A-Z0-9_-]{0,86}$/i;
const MANAGEMENT = ['jefe_taller', 'coordinador', 'supervisor', 'gerencia'];
const WORKSHOP = ['mecanico', ...MANAGEMENT];
const ALL = ['operador', ...WORKSHOP];
const ACTIONS = new Map([
  ['report', { path: 'api/workshop/report', roles: ALL }],
  ['dvir', { path: 'api/workshop/dvir', roles: ['operador', 'supervisor', 'gerencia'] }],
  ['sticker', { path: 'api/workshop/sticker', roles: ALL }],
  ['order', { path: 'api/workshop/transition', roles: WORKSHOP }],
  ['receipt', { path: 'api/purchasing/expense-save', roles: ['jefe_taller', 'coordinador', 'gerencia'] }],
]);
const FORMATS = new Map([
  ['image/jpeg', { ext: 'jpg', matches: bytes => bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) && bytes.subarray(-2).equals(Buffer.from([0xff, 0xd9])) }],
  ['image/png', { ext: 'png', matches: bytes => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) && bytes.subarray(-8, -4).toString('ascii') === 'IEND' }],
  ['image/webp', { ext: 'webp', matches: bytes => bytes.length >= 20 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP' && bytes.readUInt32LE(4) + 8 === bytes.length }],
  ['application/pdf', { ext: 'pdf', matches: bytes => /^%PDF-\d\.\d/.test(bytes.subarray(0, 8).toString('ascii')) && /%%EOF\s*$/.test(bytes.subarray(-1024).toString('latin1')) }],
]);

class EvidenceError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function requireThat(condition, status, message) {
  if (!condition) throw new EvidenceError(status, message);
}

export const isEvidenceError = error => error instanceof EvidenceError;

const invalid = 'La evidencia no corresponde a esta operación.';
const notFound = 'Evidencia no disponible.';
const digest = value => createHash('sha256').update(value).digest('hex');
const unitCode = value => typeof value === 'string' ? value.trim().toUpperCase() : '';
const linked = (cell, url) => typeof cell === 'string' && cell.split(/,\s*/).includes(url);
const scopeUnits = units => [...new Set(units.map(unitCode))].sort();
const sameUnits = (a, b) => Array.isArray(a) && a.length === b.length && a.every((unit, index) => unit === b[index]);

function linkId(value) {
  if (typeof value !== 'string' || !value.startsWith(LINK)) return null;
  const id = value.slice(LINK.length);
  return ID.test(id) ? id : null;
}

function hashesMatch(bytes, row) {
  return Buffer.isBuffer(bytes) && bytes.length === row.byte_size && digest(bytes) === row.sha256;
}

function storageUrl(config, row, authenticated = false) {
  return `${config.url}/storage/v1/object/${authenticated ? 'authenticated/' : ''}${BUCKET}/${row.preview_demo ? 'demo' : 'live'}/${row.id}`;
}

function createEvidenceStorage(config = identityConfig()) {
  if (config.project !== PROJECT) throw new Error('Evidence storage requires the Panamá identity project');
  const select = 'id,actor_id,kind,operation_id,slot,units,record_id,preview_demo,mime_type,byte_size,sha256,ready';
  const headers = { apikey: config.serviceKey };
  if (config.serviceKey.split('.').length === 3) headers.Authorization = `Bearer ${config.serviceKey}`;
  const object = (row, authenticated, options) => fetch(storageUrl(config, row, authenticated), {
    ...options, headers: { ...headers, ...options?.headers }, signal: AbortSignal.timeout(10_000), redirect: 'error',
  });
  const find = async id => {
    const response = await identityRequest(config, METADATA, { query: { id: `eq.${id}`, select, limit: '1' } });
    if (!response.ok) throw new Error('Evidence metadata unavailable');
    const [row] = await response.json();
    return row;
  };
  const read = async row => {
    const response = await object(row, true);
    if (!response.ok) throw new Error('Evidence object unavailable');
    requireThat(Number(response.headers.get('content-length')) <= LIMIT, 503, 'Almacenamiento de evidencia no disponible.');
    return Buffer.from(await response.arrayBuffer());
  };
  return {
    find,
    read,
    async reserve(row) {
      const response = await identityRequest(config, METADATA, {
        method: 'POST', query: { on_conflict: 'id', select }, body: row, prefer: 'resolution=ignore-duplicates,return=representation',
      });
      if (!response.ok) throw new Error('Evidence reservation unavailable');
      const [created] = await response.json();
      return created ?? find(row.id);
    },
    async markReady(id) {
      const response = await identityRequest(config, METADATA, {
        method: 'PATCH', query: { id: `eq.${id}` }, body: { ready: true }, prefer: 'return=minimal',
      });
      if (!response.ok) throw new Error('Evidence confirmation unavailable');
    },
    async write(row, bytes) {
      const response = await object(row, false, {
        method: 'POST', body: bytes, headers: { 'Content-Type': row.mime_type, 'Cache-Control': 'max-age=0', 'x-upsert': 'false' },
      });
      if (response.ok) return;
      const issue = await response.json().catch(() => null);
      const duplicate = ['Duplicate', 'ResourceAlreadyExists', 'KeyAlreadyExists'].includes(issue?.code ?? issue?.error);
      if ((response.status === 409 || duplicate) && hashesMatch(await read(row), row)) return;
      throw new Error('Evidence write unavailable');
    },
  };
}

export async function verifyEvidence(input, { kind, units, operationId, recordId = '', session, storage }) {
  const links = input ?? [];
  requireThat(Array.isArray(links) && links.length <= MAX_PHOTOS, 400, invalid);
  if (!links.length) return [];
  const ids = links.map(linkId);
  requireThat(ids.every(Boolean) && new Set(ids).size === ids.length, 400, invalid);
  const source = storage ?? createEvidenceStorage();
  const expectedUnits = scopeUnits(units);
  const known = await Promise.all(ids.map(id => source.find(id)));
  requireThat(known.every(row => row?.ready === true && row.kind === kind && row.operation_id === operationId
    && row.actor_id === session.userId && row.record_id === recordId && row.preview_demo === (session.previewDemo === true)
    && sameUnits(row.units, expectedUnits)), 400, invalid);
  return links;
}

function parseBytes(body, kind) {
  const format = FORMATS.get(body.mimeType);
  requireThat(format && (body.mimeType !== 'application/pdf' || kind === 'receipt'), 415, 'Adjunta una imagen JPG, PNG o WebP. Los recibos también admiten PDF.');
  requireThat(typeof body.data === 'string' && body.data.length > 0, 400, 'El archivo está vacío o incompleto.');
  requireThat(body.data.length <= Math.ceil(LIMIT / 3) * 4, 413, 'El archivo supera 3 MB.');
  const bytes = Buffer.from(body.data, 'base64');
  requireThat(bytes.length <= LIMIT, 413, 'El archivo supera 3 MB.');
  requireThat(bytes.length && bytes.toString('base64') === body.data, 400, 'El archivo está vacío o incompleto.');
  requireThat(format.matches(bytes), 415, 'El contenido no coincide con el formato seleccionado.');
  return bytes;
}

async function findOrder(sheets, match) {
  const rows = await sheets.read('ORDENES_TRABAJO');
  const matches = rows.filter(row => ORDER_ID.test(row[1] || '') && match(row));
  return matches.length === 1 ? matches[0] : undefined;
}

function canReadOrder(session, row, { authorMayRead = false } = {}) {
  if (!row || !hasIdentityUnit(session, unitCode(row[3]))) return false;
  if (session.role === 'mecanico') return row[17] === session.userId;
  return MANAGEMENT.includes(session.role) || (authorMayRead && session.role === 'operador' && row[19] === session.userId);
}

async function upload(req, session, sheets, canUpload, storage) {
  const body = req.body;
  const kind = body?.kind;
  const action = ACTIONS.get(kind);
  requireThat(action, 400, 'Tipo de evidencia inválido.');
  requireThat(body.expectedUserId === session.userId && action.roles.includes(session.role), 403, 'Acción no autorizada para esta sesión.');
  requireThat(canUpload(action.path), 503, 'Los adjuntos de este flujo están en consulta.');
  requireThat(isIdentityUserId(body.operationId) && Number.isInteger(body.slot) && body.slot >= 0
    && body.slot < (kind === 'receipt' ? 1 : MAX_PHOTOS), 400, 'La referencia del adjunto es inválida.');
  const operationId = body.operationId.toLowerCase();
  const recordId = body.recordId ?? '';
  requireThat(kind === 'order' ? typeof recordId === 'string' && ORDER_ID.test(recordId) : recordId === '', 400, 'El folio del adjunto es inválido.');
  requireThat(Array.isArray(body.units) && body.units.length >= 1 && body.units.length <= (kind === 'receipt' ? 100 : 1), 400, 'Indica la unidad correspondiente.');
  const units = scopeUnits(body.units);
  requireThat(units.length === body.units.length && units.every(unit => UNIT.test(unit)), 400, 'Unidad inválida.');
  requireThat(units.every(unit => hasIdentityUnit(session, unit) && (unit !== 'FLOTA' || (kind === 'receipt' && session.allUnits === true))), 403, 'Unidad fuera de tu alcance.');
  const bytes = parseBytes(body, kind);
  if (kind === 'order') {
    const row = await findOrder(sheets, order => order[1] === recordId);
    requireThat(row && unitCode(row[3]) === units[0] && canReadOrder(session, row), 404, 'OT no disponible.');
    requireThat(row[9] !== 'Completado', 409, 'La orden está cerrada.');
  } else if (units.some(unit => unit !== 'FLOTA')) {
    const inventory = await sheets.read('01 Inventario');
    const knownUnits = new Set(inventory.slice(3).map(row => unitCode(row[1])));
    requireThat(units.every(unit => unit === 'FLOTA' || knownUnits.has(unit)), 404, 'Unidad no encontrada en el inventario.');
  }
  const previewDemo = session.previewDemo === true;
  const id = digest(JSON.stringify([session.userId, previewDemo, kind, operationId, body.slot]));
  const row = { id, actor_id: session.userId, kind, operation_id: operationId, slot: body.slot, units, record_id: recordId,
    preview_demo: previewDemo, mime_type: body.mimeType, byte_size: bytes.length, sha256: digest(bytes) };
  const source = storage ?? createEvidenceStorage();
  const reserved = await source.reserve(row);
  requireThat(reserved && sameUnits(reserved.units, units)
    && Object.entries(row).every(([field, value]) => field === 'units' || reserved[field] === value), 409, 'Esta operación ya tiene un archivo diferente en esa posición.');
  if (!reserved.ready) {
    await source.write(row, bytes);
    await source.markReady(id);
  }
  return { url: LINK + id };
}

async function canReadLinked(sheets, session, row, url) {
  const [unit] = row.units;
  switch (row.kind) {
    case 'order':
    case 'report': {
      const report = row.kind === 'report';
      const order = await findOrder(sheets, order => report
        ? order[0] === row.operation_id && order[19] === row.actor_id
        : order[1] === row.record_id);
      return order && unitCode(order[3]) === unit && linked(order[10], url) && canReadOrder(session, order, { authorMayRead: report });
    }
    case 'dvir': {
      const inspections = await sheets.read('14 Inspecciones');
      const matches = inspections.filter(item => item[0] === row.operation_id && item[28] === row.actor_id && /^INS-/.test(item[1] || ''));
      if (matches.length !== 1 || unitCode(matches[0][4]) !== unit || !linked(matches[0][24], url)) return false;
      if (session.role === 'mecanico') {
        const order = await findOrder(sheets, order => order[1] === matches[0][25]);
        return order && unitCode(order[3]) === unit && linked(order[10], url) && canReadOrder(session, order);
      }
      return MANAGEMENT.includes(session.role) || (session.role === 'operador' && session.userId === row.actor_id);
    }
    case 'sticker': {
      const mayReview = ['supervisor', 'gerencia'].includes(session.role) && session.canReviewPanamaHse === true;
      if (session.userId !== row.actor_id && !mayReview) return false;
      const stickers = await sheets.read('Inspeccion_Stickers');
      const matches = stickers.filter(item => item[0] === row.operation_id && item[18] === row.actor_id && item[1]);
      return matches.length === 1 && unitCode(matches[0][5]) === unit && linked(matches[0][16], url);
    }
    case 'receipt': {
      const rows = await sheets.read('02 Gastos');
      const matches = rows.filter(item => item[20] === row.operation_id && item[18] === row.actor_id && /^GST-/.test(item[0] || ''));
      return matches.length === row.units.length && matches[0]?.[17] && sameUnits(scopeUnits(matches.map(item => item[10])), row.units)
        && matches.every(item => item[16] !== 'Eliminado' && item[17] === matches[0][17] && item[15] === url);
    }
    default:
      return false;
  }
}

async function download(req, res, session, sheets, storage) {
  const id = req.query?.id;
  requireThat(typeof id === 'string' && ID.test(id), 404, notFound);
  const source = storage ?? createEvidenceStorage();
  const row = await source.find(id);
  const roles = row?.kind === 'dvir' ? ALL : ACTIONS.get(row?.kind)?.roles;
  requireThat(row?.ready === true && row.preview_demo === (session.previewDemo === true) && roles?.includes(session.role)
    && row.units.length > 0 && row.units.every(unit => hasIdentityUnit(session, unit) && (unit !== 'FLOTA' || session.allUnits === true)), 404, notFound);
  requireThat(await canReadLinked(sheets, session, row, LINK + id), 404, notFound);
  const format = FORMATS.get(row.mime_type);
  requireThat(format && row.byte_size > 0 && row.byte_size <= LIMIT, 503, 'Almacenamiento de evidencia no disponible.');
  const bytes = await source.read(row);
  requireThat(hashesMatch(bytes, row), 503, 'Almacenamiento de evidencia no disponible.');
  res.setHeader('Content-Type', row.mime_type);
  res.setHeader('Content-Disposition', `${row.mime_type === 'application/pdf' ? 'attachment' : 'inline'}; filename="evidencia.${format.ext}"`);
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  return res.status(200).send(bytes);
}

export async function dispatchEvidence({ req, res, session, sheets, canUpload, storage }) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  try {
    requireThat(isIdentityUserId(session?.userId), 401, 'Sesión inválida.');
    requireThat(session.project === PROJECT && ALL.includes(session.role) && isSameOriginAuthRequest(req)
      && req.headers?.['sec-fetch-site'] !== 'same-site', 403, 'Acción no autorizada para esta sesión.');
    if (req.method === 'POST') {
      return res.status(200).json(await upload(req, session, sheets, canUpload, storage));
    }
    if (req.method === 'GET') return await download(req, res, session, sheets, storage);
    return res.status(405).json({ error: 'Método no permitido.' });
  } catch (error) {
    if (error instanceof EvidenceError) return res.status(error.status).json({ error: error.message });
    return res.status(503).json({ error: 'No se pudo confirmar la evidencia. Intenta de nuevo.' });
  }
}
