const ROLES = new Set(['operador', 'mecanico', 'jefe_taller', 'coordinador', 'supervisor', 'gerencia']);
const PROJECT = /^[a-z0-9][a-z0-9_-]{0,79}$/;
const UUID = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const UNIT = /^[a-z\d][a-z\d ._/-]{0,39}$/i;
const PREVIEW_EMAIL = /^hermes-pa-demo-(?:p(?:0[1-9]|1\d|2[0-8])|verify-[a-f0-9]{12})@example\.com$/;
const PROFILE_FIELDS = 'user_id,email,user_name,role,projects,assigned_units,unit_scope,active,can_approve_purchases';
const PANAMA_PROFILE_FIELDS = PROFILE_FIELDS + ',can_receive_purchases,can_review_panama_hse';
const FINANCE_FIELDS = ',can_record_purchase_invoices,can_record_purchase_payments';

function envValue(env, ...names) {
  return names.map((name) => String(env[name] || '').trim()).find(Boolean) || '';
}

export function identityConfig(env = process.env) {
  const source = envValue(env, 'HERMES_AUTH_SUPABASE_URL');
  const publishableKey = envValue(env, 'HERMES_AUTH_SUPABASE_PUBLISHABLE_KEY');
  const serviceKey = envValue(env, 'HERMES_AUTH_SUPABASE_SERVICE_ROLE_KEY');
  const project = envValue(env, 'HERMES_AUTH_PROJECT');
  let url;
  try { url = new URL(source); } catch { throw new Error('Identity provider is not configured'); }
  const localFixture = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && env.VERCEL_ENV !== 'production';
  if ((env.VERCEL === '1' && project !== 'tmf-panama')
    || (url.protocol !== 'https:' && !localFixture) || url.username || url.password || url.search || url.hash
    || !publishableKey || !serviceKey || !PROJECT.test(project)) {
    throw new Error('Identity provider is not configured');
  }
  return { url: url.origin, project, publishableKey, serviceKey };
}

export function normalizedEmail(value) {
  if (typeof value !== 'string') return '';
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

export function isIdentityUserId(value) {
  return typeof value === 'string' && UUID.test(value);
}

export function isRole(role) {
  return ROLES.has(role);
}

export function normalizeRosterProfile(row, project) {
  if (!row || row.active !== true || !isIdentityUserId(row.user_id) || !ROLES.has(row.role)
    || !['all', 'assigned'].includes(row.unit_scope) || !normalizedEmail(row.email)
    || typeof row.user_name !== 'string' || !row.user_name.trim() || row.user_name.length > 120
    || !Array.isArray(row.projects) || row.projects.some((item) => typeof item !== 'string' || !PROJECT.test(item))
    || !row.projects.includes(project) || !Array.isArray(row.assigned_units)
    || row.assigned_units.some((unit) => typeof unit !== 'string' || !UNIT.test(unit))) return null;

  const panamaOnly = project === 'tmf-panama' && row.projects.every((item) => item === project);
  const demo = PREVIEW_EMAIL.test(row.email);
  if (demo && (process.env.VERCEL_ENV !== 'preview' || !panamaOnly || row.unit_scope !== 'assigned'
    || row.assigned_units.length === 0 || row.assigned_units.some(unit => !unit.startsWith('QA-')))) return null;
  return {
    userId: row.user_id.toLowerCase(),
    userName: row.user_name.trim(),
    role: row.role,
    project,
    projects: [...new Set(row.projects)],
    assignedUnits: [...new Set(row.assigned_units.map((unit) => unit.toUpperCase()))],
    unitScope: row.unit_scope,
    allUnits: row.unit_scope === 'all',
    canApprovePurchases: row.role === 'gerencia' && row.can_approve_purchases === true,
    canReceivePurchases: panamaOnly && row.can_receive_purchases === true && row.can_approve_purchases !== true,
    canRecordPurchaseInvoices: panamaOnly && row.role === 'gerencia' && row.can_record_purchase_invoices === true
      && !row.can_approve_purchases && !row.can_receive_purchases && !row.can_record_purchase_payments,
    canRecordPurchasePayments: panamaOnly && row.role === 'gerencia' && row.can_record_purchase_payments === true
      && !row.can_approve_purchases && !row.can_receive_purchases && !row.can_record_purchase_invoices,
    canReviewPanamaHse: panamaOnly && ['supervisor', 'gerencia'].includes(row.role)
      && row.can_review_panama_hse === true,
    ...(demo ? { previewDemo: true } : {}),
  };
}

export function hasIdentityUnit(session, value) {
  if (!session || typeof value !== 'string' || !UNIT.test(value)) return false;
  return session.allUnits === true || (session.assignedUnits || []).includes(value.toUpperCase());
}

export async function identityRequest(config, path, { method = 'GET', query, body, prefer, auth = 'service', accessToken } = {}) {
  const url = new URL(path, config.url);
  if (query) url.search = new URLSearchParams(query).toString();
  const key = auth === 'public' ? config.publishableKey : config.serviceKey;
  const headers = { apikey: key, Accept: 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  else if (auth === 'service' && key.split('.').length === 3) headers.Authorization = `Bearer ${key}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  return fetch(url.toString(), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(7000),
    redirect: 'error',
  });
}

async function requestRoster(config, path, query, select = fields => fields) {
  const fields = config.project === 'tmf-panama' ? PANAMA_PROFILE_FIELDS : PROFILE_FIELDS;
  const request = (profileFields) => identityRequest(config, path, { query: { ...query, select: select(profileFields) } });
  if (config.project !== 'tmf-panama') return request(fields);
  const response = await request(fields + FINANCE_FIELDS);
  if (response.status !== 400) return response;
  const problem = await response.clone().json().catch(() => null);
  if (problem?.code === '42703' && /\bcan_record_purchase_(invoices|payments)\b/.test(problem.message ?? '')) {
    return request(fields);
  }
  return response;
}

export async function authenticateHermesEmployee(email, password, config = identityConfig()) {
  const response = await identityRequest(config, '/auth/v1/token', {
    method: 'POST', query: { grant_type: 'password' }, body: { email, password }, auth: 'public',
  });
  if ([400, 401, 403].includes(response.status)) return null;
  if (!response.ok) throw new Error('Identity provider unavailable');

  const { user } = await response.json();
  if (!isIdentityUserId(user?.id) || normalizedEmail(user.email) !== email
    || !Number.isFinite(Date.parse(user.email_confirmed_at))) return null;

  const roster = await requestRoster(config, '/rest/v1/hermes_memberships', {
    user_id: `eq.${user.id}`, active: 'eq.true', limit: '1',
  });
  if (!roster.ok) throw new Error('Hermes roster unavailable');
  const [member] = await roster.json();
  if (normalizedEmail(member?.email) !== email || member?.user_id?.toLowerCase() !== user.id.toLowerCase()) return null;
  return normalizeRosterProfile(member, config.project);
}

export async function insertIdentitySession(config, sessionHash, userId, expiresAt) {
  const response = await identityRequest(config, '/rest/v1/hermes_sessions', {
    method: 'POST',
    body: { session_hash: sessionHash, user_id: userId, expires_at: new Date(expiresAt * 1000).toISOString() },
    prefer: 'return=minimal',
  });
  if (!response.ok) throw new Error('Hermes session could not be stored');
}

export async function resolveIdentitySession(config, sessionHash, userId) {
  const response = await requestRoster(config, '/rest/v1/hermes_sessions', {
    session_hash: `eq.${sessionHash}`,
    user_id: `eq.${userId}`,
    expires_at: `gt.${new Date().toISOString()}`,
    limit: '1',
  }, (fields) => `user_id,expires_at,hermes_memberships!inner(${fields})`);
  if (!response.ok) throw new Error('Hermes session store unavailable');
  const [session] = await response.json();
  if (session?.user_id !== userId || !(Date.parse(session.expires_at) > Date.now())) return null;
  const profile = normalizeRosterProfile(session.hermes_memberships, config.project);
  return profile?.userId === userId ? profile : null;
}

export async function revokeIdentitySession(config, sessionHash, userId) {
  const response = await identityRequest(config, '/rest/v1/hermes_sessions', {
    method: 'DELETE',
    query: { session_hash: `eq.${sessionHash}`, user_id: `eq.${userId}` },
    prefer: 'return=minimal',
  });
  if (!response.ok) throw new Error('Hermes session could not be revoked');
}

async function listProjectPeople(session, unitId, role) {
  const config = identityConfig();
  if (!session?.projects?.includes(config.project) || (unitId !== undefined && !hasIdentityUnit(session, unitId))) return [];
  const response = await requestRoster(config, '/rest/v1/hermes_memberships', {
    active: 'eq.true', role: `eq.${role}`, projects: `cs.{${config.project}}`,
    order: 'user_name.asc', limit: '1000',
  });
  if (!response.ok) throw new Error('Hermes roster unavailable');
  return (await response.json())
    .map((row) => normalizeRosterProfile(row, config.project))
    .filter((profile) => profile?.role === role && (unitId === undefined || hasIdentityUnit(profile, unitId)))
    .filter(profile => Boolean(profile.previewDemo) === Boolean(session.previewDemo))
    .filter((profile) => session.allUnits || profile.allUnits || session.assignedUnits.some((unit) => hasIdentityUnit(profile, unit)))
    .map(({ userId, userName, role, allUnits, assignedUnits }) => ({
      userId, userName, role, allUnits,
      assignedUnits: session.allUnits ? assignedUnits : assignedUnits.filter((unit) => hasIdentityUnit(session, unit)),
    }));
}

export const listWorkshopMechanics = (session, unitId) => listProjectPeople(session, unitId, 'mecanico');
export const listShiftOperators = (session, unitId) => listProjectPeople(session, unitId, 'operador');
