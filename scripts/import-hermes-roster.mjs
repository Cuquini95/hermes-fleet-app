import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  identityConfig, identityRequest, isIdentityUserId, isRole, normalizeRosterProfile, normalizedEmail,
} from '../api/_lib/hermes-identity.js';

export function planRosterImport(entries, users, existing, project, now = Date.now()) {
  if (!Array.isArray(entries)) throw new Error('El padrón debe ser un arreglo JSON de asignaciones aprobadas.');
  const emailCounts = new Map();
  for (const item of entries) {
    const email = normalizedEmail(item?.email);
    if (email) emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
  }
  const identities = new Map();
  for (const user of users) {
    const email = normalizedEmail(user.email);
    if (!email || !isIdentityUserId(user.id) || !Number.isFinite(Date.parse(user.email_confirmed_at))
      || Date.parse(user.banned_until) > now) continue;
    identities.set(email, identities.has(email) ? null : user.id.toLowerCase());
  }
  const owners = new Map(existing.map((row) => [normalizedEmail(row.email), row.user_id]));
  const members = [];
  const pending = [];

  for (const [index, item] of entries.entries()) {
    const email = normalizedEmail(item?.email);
    const userId = identities.get(email);
    const panamaOnly = project === 'tmf-panama' && Array.isArray(item?.projects)
      && item.projects.length === 1 && item.projects[0] === project;
    let reason;
    if (!email) reason = 'correo_inválido';
    else if (emailCounts.get(email) > 1) reason = 'correo_duplicado';
    else if (!isRole(item.role)) reason = 'rol_pendiente';
    else if (!userId) reason = 'identidad_sin_confirmar';
    else if (owners.has(email) && owners.get(email) !== userId) reason = 'identidad_distinta_a_la_vinculada';
    else if (item.canApprovePurchases === true && item.role !== 'gerencia') reason = 'permiso_de_compra_incompatible';
    else if (item.canReceivePurchases !== undefined && typeof item.canReceivePurchases !== 'boolean') reason = 'permiso_de_recepción_inválido';
    else if (item.canReceivePurchases === true && !panamaOnly) reason = 'permiso_de_recepción_fuera_de_panamá';
    else if (item.canReviewPanamaHse !== undefined && typeof item.canReviewPanamaHse !== 'boolean') reason = 'permiso_hse_inválido';
    else if (item.canReviewPanamaHse === true && (!panamaOnly
      || !['supervisor', 'gerencia'].includes(item.role))) reason = 'permiso_hse_incompatible';
    else if (item.active !== undefined && typeof item.active !== 'boolean') reason = 'estado_inválido';
    if (reason) { pending.push({ fila: index + 1, motivo: reason }); continue; }

    const row = {
      user_id: userId, email, user_name: item.userName, role: item.role, projects: item.projects,
      assigned_units: item.assignedUnits ?? [], unit_scope: item.unitScope, active: item.active !== false,
      can_approve_purchases: item.canApprovePurchases === true,
      ...(project === 'tmf-panama' ? {
        can_receive_purchases: item.canReceivePurchases === true,
        can_review_panama_hse: item.canReviewPanamaHse === true,
      } : {}),
    };
    const normalized = normalizeRosterProfile({ ...row, active: true }, project);
    if (!normalized) { pending.push({ fila: index + 1, motivo: 'nombre_o_alcance_pendiente' }); continue; }
    members.push({ ...row, user_name: normalized.userName, assigned_units: normalized.assignedUnits, projects: normalized.projects });
  }
  return { members, pending };
}

async function listProviderUsers(config) {
  const users = [];
  const pageSize = 200;
  for (let page = 1; ; page += 1) {
    const response = await identityRequest(config, '/auth/v1/admin/users', { query: { page, per_page: pageSize } });
    if (!response.ok) throw new Error('El proveedor no permite consultar las cuentas existentes.');
    const result = await response.json();
    if (!Array.isArray(result.users)) throw new Error('No se recibió el directorio del proveedor.');
    users.push(...result.users);
    if (result.users.length < pageSize) return users;
  }
}

async function listMembers(config) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const response = await identityRequest(config, '/rest/v1/hermes_memberships', {
      query: { select: 'user_id,email', order: 'user_id.asc', limit: 500, offset },
    });
    if (!response.ok) throw new Error('La migración del padrón Hermes no está disponible en el entorno.');
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error('El padrón Hermes no devolvió un registro válido.');
    rows.push(...page);
    if (page.length < 500) return rows;
  }
}

async function run() {
  const [file, ...flags] = process.argv.slice(2);
  if (!file || flags.some((flag) => flag !== '--apply')) {
    throw new Error('Uso: node scripts/import-hermes-roster.mjs <padrón.json> [--apply]');
  }
  const config = identityConfig();
  const entries = JSON.parse(await readFile(file, 'utf8'));
  const [users, existing] = await Promise.all([listProviderUsers(config), listMembers(config)]);
  const { members, pending } = planRosterImport(entries, users, existing, config.project);
  const apply = flags.includes('--apply');
  if (apply && members.length) {
    const response = await identityRequest(config, '/rest/v1/hermes_memberships', {
      method: 'POST', query: { on_conflict: 'user_id' }, body: members, prefer: 'resolution=merge-duplicates,return=representation',
    });
    if (!response.ok) throw new Error('El proveedor rechazó la carga de membresías. Revisa el padrón y vuelve a validar.');
    const written = await response.json();
    if (!Array.isArray(written) || written.length !== members.length) throw new Error('El número de membresías persistidas no coincide con la carga.');
  }
  console.log(JSON.stringify({
    proyecto: config.project, modo: apply ? 'aplicado' : 'validación', filas: entries.length,
    elegiblesActivas: members.filter((member) => member.active).length,
    habilitadas: apply ? members.filter((member) => member.active).length : 0,
    deshabilitadas: apply ? members.filter((member) => !member.active).length : 0,
    pendientes: pending,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => { console.error(error instanceof SyntaxError ? 'El padrón JSON no es válido.' : error.message); process.exitCode = 1; });
}
