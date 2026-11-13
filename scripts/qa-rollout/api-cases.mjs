import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { firstAccount, fixturePassword, loadAccounts, nonApprovingManager, photoPng, tabs } from './fixture.mjs';

export function requester(origin) {
  return async (path, { body, cookie } = {}) => {
    assert(path.startsWith('/') && !path.startsWith('//'), 'La ruta de prueba debe ser local');
    const headers = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (cookie) headers.cookie = cookie;
    const response = await fetch(origin + path, {
      method: body === undefined ? 'GET' : 'POST', headers,
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(12000),
    });
    const payload = await response.text();
    let data;
    try { data = JSON.parse(payload); } catch { data = null; }
    return { status: response.status, data, cookie: response.headers.get('set-cookie') };
  };
}

function good(result, label) {
  assert(result.status >= 200 && result.status < 300, `${label} devolvió ${result.status}${result.data?.error ? ` · ${result.data.error}` : ''}`);
  return result.data;
}

async function loginAs(request, account) {
  const result = await request('/api/auth/login', { body: { email: account.user.email, password: fixturePassword } });
  const profile = good(result, 'Inicio de sesión');
  assert.equal(profile.role, account.membership.role);
  assert.equal(profile.userId, account.user.id);
  assert.match(result.cookie ?? '', /HttpOnly/i);
  assert.match(result.cookie, /Secure/i);
  return result.cookie.split(';', 1)[0];
}

function workshop(request, cookie) {
  return (operation, body) => request(`/hermes-api/api/workshop/${operation}`, { cookie, body });
}

function purchasing(request, cookie) {
  return (operation, body) => request(`/hermes-api/api/purchasing/${operation}`, { cookie, body });
}

export async function checkLoad(fixture, record, withGateway) {
  const request = requester(fixture.origin);
  await record('HTTP-100', async () => {
    const durations = [];
    const actors = await Promise.all(loadAccounts.map(async account => {
      const start = performance.now();
      const cookie = await loginAs(request, account);
      const session = good(await request('/api/auth/session', { cookie }), 'Restaurar sesión');
      assert.equal(session.userId, account.user.id);
      assert.equal(session.role, account.membership.role);
      if (withGateway) {
        const fleet = good(await request('/hermes-api/api/sheets/read?tab=01%20Inventario', { cookie }), 'Primera consulta de inventario');
        assert(Array.isArray(fleet.data) && fleet.data.some(row => row.includes('DZ203')), 'El inventario de prueba no llegó a la sesión');
        if (!session.allUnits) assert(!fleet.data.some(row => row.includes('EX410')), 'Se mostró una unidad de prueba fuera del alcance');
      }
      durations.push(performance.now() - start);
      return session.userId;
    }));
    assert.equal(new Set(actors).size, 100);
    const sorted = durations.toSorted((a, b) => a - b);
    return { sessions: actors.length, peakProviderLogins: fixture.peakLogins(), firstInventory: withGateway, p95Ms: Math.round(sorted[94]), maxMs: Math.round(sorted[99]) };
  });
}

export async function checkAuth(fixture, record, { withGateway, withPurchasing }) {
  const request = requester(fixture.origin);
  await record('API-ACCESO-IDENTIDAD', async () => {
    const anon = await request('/api/auth/session');
    assert.equal(anon.status, 401);
    const foreign = await request('/api/auth/login', { body: { email: 'hermes-101@example.invalid', password: fixturePassword } });
    assert([401, 403].includes(foreign.status), `La cuenta ficticia de otro proyecto recibió ${foreign.status}`);
    const account = firstAccount('operador');
    const cookie = await loginAs(request, account);
    const session = good(await request('/api/auth/session', { cookie }), 'Sesión del Operador');
    assert.equal(session.role, 'operador');
    let workshopCheck;
    let purchaseCheck;
    if (withGateway) {
      workshopCheck = (await workshop(request, cookie)('orders')).status;
      assert.equal(workshopCheck, 403, 'Operador puede consultar la bandeja general de Taller');
    }
    if (withPurchasing) {
      purchaseCheck = (await purchasing(request, cookie)('orders')).status;
      assert.equal(purchaseCheck, 403, 'Operador puede consultar órdenes de compra');
    }
    good(await request('/api/auth/logout', { cookie, body: {} }), 'Cerrar sesión');
    const ended = await request('/api/auth/session', { cookie });
    assert.equal(ended.status, 401, 'La sesión cerrada sigue activa');
    return { projectCheck: foreign.status, workshopCheck, purchaseCheck, revoked: ended.status };
  });
}

export async function checkWorkshop(fixture, record) {
  const request = requester(fixture.origin);
  const { sheet } = fixture;
  let folio;
  await record('API-PERMISOS-OT-SIN-ASIGNAR', async () => {
    const cookie = await loginAs(request, firstAccount('mecanico'));
    const list = good(await workshop(request, cookie)('orders'), 'Bandeja del Mecánico');
    assert.equal(list.orders.some(row => row[1] === 'OT-0004'), false);
    const legacy = await request('/hermes-api/api/sheets/read?tab=ORDENES_TRABAJO', { cookie });
    assert(legacy.status === 403 || (legacy.status === 200 && !legacy.data?.data?.some(row => row[1] === 'OT-0004')),
      'Una lectura directa de Sheets muestra la OT sin asignar que la bandeja del Mecánico restringe');
    return { role: 'mecanico', syntheticFolio: 'OT-0004', domainVisible: false, legacyStatus: legacy.status };
  });
  await record('API-TALLER-AVISO-Y-REINTENTO', async () => {
    const op = workshop(request, await loginAs(request, firstAccount('operador')));
    const data = {
      mutationId: randomUUID(), unit: 'DZ203', type: 'Mecánica', description: 'QA reintento de avería y orden',
      canMove: false, customer: 'Frente QA', location: 'Patio QA', downtime: 'Indeterminado', photos: [],
    };
    const target = writes => writes.some(write => write.tab === tabs.orders);
    const startingOrders = sheet.read(tabs.orders);
    const startingFailures = sheet.read(tabs.failure);
    sheet.failNext({ matches: target, when: 'before' });
    const first = await op('report', data);
    assert(first.status >= 500, `El fallo simulado respondió ${first.status}`);
    assert.deepEqual(sheet.read(tabs.failure), startingFailures, 'La avería se guardó parcialmente');
    assert.deepEqual(sheet.read(tabs.orders), startingOrders, 'La OT se guardó parcialmente');
    sheet.failNext({ matches: target, when: 'after' });
    const lost = await op('report', data);
    assert(lost.status >= 500, `La respuesta perdida devolvió ${lost.status}`);
    const created = good(await op('report', data), 'Reintento del reporte');
    folio = created.otId;
    assert(folio);
    assert.equal(created.replayed, true);
    assert.equal(sheet.read(tabs.failure).filter(row => row[13] === folio).length, 1);
    assert.equal(sheet.read(tabs.orders).filter(row => row[1] === folio && row[11] === folio).length, 1);
    for (const role of ['coordinador', 'jefe_taller']) {
      const api = workshop(request, await loginAs(request, firstAccount(role)));
      const inbox = good(await api('orders'), `Bandeja de ${role}`);
      assert(inbox.orders.some(row => row[1] === folio), `No se encontró la OT en ${role}`);
    }
    return { folio, initialStatus: first.status, responseLostStatus: lost.status, linkedRows: 2 };
  });

  await record('API-TALLER-ASIGNACIÓN-AVANCE-CIERRE', async () => {
    assert(folio, 'El caso de alta requiere una OT de prueba persistida');
    const leader = workshop(request, await loginAs(request, firstAccount('jefe_taller')));
    const techAccount = firstAccount('mecanico');
    const anotherTech = loadAccounts.find(item => item.membership.role === 'mecanico' && item.user.id !== techAccount.user.id);
    const tech = workshop(request, await loginAs(request, techAccount));
    const otherTech = workshop(request, await loginAs(request, anotherTech));
    const coordinator = workshop(request, await loginAs(request, firstAccount('coordinador')));
    const supervisor = workshop(request, await loginAs(request, firstAccount('supervisor')));
    const transition = (api, field, value, execution) => api('transition', { mutationId: randomUUID(), otId: folio, field, value, execution });
    const canSee = async api => good(await api('orders'), 'Consultar órdenes').orders.some(row => row[1] === folio);
    assert.equal(await canSee(tech), false);
    assert.equal((await transition(supervisor, 'mecanico_asignado', anotherTech.user.id)).status, 403);
    good(await transition(coordinator, 'mecanico_asignado', anotherTech.user.id), 'Primera asignación por Coordinación');
    assert.equal(await canSee(otherTech), true);
    good(await transition(leader, 'mecanico_asignado', techAccount.user.id), 'Reasignación');
    assert.equal(await canSee(otherTech), false);
    assert.equal(await canSee(tech), true);
    good(await transition(leader, 'estado', 'En Reparación'), 'Inicio de reparación');
    good(await transition(tech, 'progreso', '50'), 'Registrar avance');
    good(await transition(tech, 'observaciones', 'Revisión sintética de avance'), 'Registrar nota');
    assert.equal((await transition(tech, 'costo_estimado', '85.25')).status, 403);
    good(await transition(leader, 'costo_estimado', '85.25'), 'Registrar costo autorizado');
    assert.equal((await transition(tech, 'estado', 'Resuelta')).status, 400);
    good(await transition(tech, 'estado', 'Resuelta', { functionalTest: 'Prueba funcional QA de respuesta' }), 'Entregar prueba funcional');
    assert.equal((await transition(tech, 'estado', 'Completado')).status, 403);
    good(await transition(leader, 'estado', 'Completado'), 'Cerrar OT');
    const view = good(await supervisor('orders'), 'Consulta de cierre del Supervisor');
    const row = sheet.read(tabs.orders).find(recordRow => recordRow[1] === folio);
    assert.equal(row[9], 'Completado');
    assert(row[14], 'La fecha de cierre no se guardó');
    assert(view.orders.some(entry => entry[1] === folio && entry[9] === 'Completado' && entry[14] === row[14] && entry[16] === '50'));
    assert(view.history.some(entry => entry[1] === folio && entry[7] === techAccount.user.id));
    assert.equal(sheet.read(tabs.failure).find(recordRow => recordRow[13] === folio)?.[9], 'Completado');
    assert(good(await supervisor('readiness'), 'Pendiente tras cierre técnico').returns.some(entry => entry.otId === folio));
    const returned = await supervisor('returns', { mutationId: randomUUID(), otId: folio, decision: 'accepted', notes: 'Recepción sintética de Operaciones' });
    assert.equal(returned.status, 409, 'La avería independiente OT-0004 de esta unidad sigue abierta');
    assert.match(returned.data.error, /Retorno bloqueado/);
    assert(good(await supervisor('readiness'), 'Retorno pendiente').returns.some(entry => entry.otId === folio));
    return { folio, state: row[9], closeDate: row[14], independentReturnBlocked: returned.status, history: view.history.filter(entry => entry[1] === folio).length };
  });

  await record('API-TALLER-REPLICA-OT-0004', async () => {
    const lead = workshop(request, await loginAs(request, firstAccount('jefe_taller')));
    const sup = workshop(request, await loginAs(request, firstAccount('supervisor')));
    const mechanic = firstAccount('mecanico');
    const tech = workshop(request, await loginAs(request, mechanic));
    const otId = 'OT-0004';
    const update = (api, field, value, execution) => api('transition', { mutationId: randomUUID(), otId, field, value, execution });
    good(await update(lead, 'mecanico_asignado', mechanic.user.id), 'Asignar réplica');
    good(await update(tech, 'estado', 'En Reparación'), 'Iniciar reparación de réplica');
    good(await update(tech, 'estado', 'Resuelta', { functionalTest: 'Prueba de la réplica QA' }), 'Entregar réplica');
    good(await update(sup, 'estado', 'Completado'), 'Cerrar réplica como Supervisor');
    const order = sheet.read(tabs.orders).filter(row => row[1] === otId);
    const failure = sheet.read(tabs.failure).filter(row => row[13] === otId);
    assert.equal(order.length, 1);
    assert.equal(failure.length, 1);
    assert.deepEqual([order[0][3], order[0][9], failure[0][9]], ['DZ203', 'Completado', 'Completado']);
    assert.equal((await sup('returns', { mutationId: randomUUID(), otId, decision: 'accepted', notes: 'Debe ser independiente' })).status, 403);
    return { folio: otId, unit: 'DZ203', state: 'Completado', synthetic: true };
  });

  await record('API-TALLER-DVIR-PM', async () => {
    const op = workshop(request, await loginAs(request, firstAccount('operador')));
    const lead = workshop(request, await loginAs(request, firstAccount('jefe_taller')));
    const sup = workshop(request, await loginAs(request, firstAccount('supervisor')));
    const date = '2026-11-12';
    const check = Array.from({ length: 12 }, (_, index) => ({ status: index === 2 ? 'falla' : 'ok', notes: index === 2 ? 'Hallazgo ficticio' : '' }));
    const inspection = good(await op('dvir', { mutationId: randomUUID(), unit: 'DZ205', date, time: '07:20', type: 'pre-operacion', meter: 391, checks: check, observations: '', photos: [] }), 'Guardar DVIR reprobado');
    assert.equal(inspection.result, 'reprobado');
    const dvir = sheet.read(tabs.dvir).find(row => row[1] === inspection.inspectionId);
    assert.equal(dvir?.[25], inspection.otId);
    assert(good(await sup('orders'), 'Consultar OT de inspección').orders.some(row => row[1] === inspection.otId && row[4] === 'DVIR'));
    const pm = good(await lead('pm', { mutationId: randomUUID(), unit: 'EX401', level: 'PM-250', includedLevels: 'PM-250', hours: 2.5, mechanicId: firstAccount('mecanico').user.id, scheduledDate: date, parts: 'Filtro QA', notes: 'Mantenimiento QA' }), 'Crear orden PM');
    assert(pm.otId);
    assert(sheet.read(tabs.pm).some(row => row[0] === pm.otId));
    assert(sheet.read(tabs.pmHistory).some(row => row[1] === pm.otId));
    const calendar = good(await sup('schedule'), 'Consultar calendario de Taller');
    assert(calendar.schedule.some(row => row[1] === date && row[2] === pm.otId && row[3] === 'EX401'));
    const tech = workshop(request, await loginAs(request, firstAccount('mecanico')));
    const execution = { functionalTest: 'Prueba funcional sintética PM', performedOn: date, meter: '1963', completedItems: ['review-qa'] };
    const status = (api, value, submitted) => api('transition', { mutationId: randomUUID(), otId: pm.otId, field: 'estado', value, execution: submitted });
    const checklist = good(await tech(`pmchecklist?otId=${pm.otId}`), 'Consultar checklist por modelo');
    assert.equal(checklist.model, 'Komatsu D65EX-16');
    assert.deepEqual(checklist.checklist.tasks.map(task => task.id), ['review-qa']);
    good(await status(tech, 'En Reparación'), 'Iniciar PM');
    assert.equal((await status(tech, 'Resuelta', { ...execution, completedItems: [] })).status, 400);
    good(await status(tech, 'Resuelta', execution), 'Entregar PM');
    assert.equal(sheet.read(tabs.pm).find(row => row[0] === pm.otId)[11], 'Programada');
    good(await status(sup, 'Completado'), 'Aceptar PM');
    const synchronized = [sheet.read(tabs.pm).find(row => row[0] === pm.otId)[11], sheet.read(tabs.pmHistory).find(row => row[1] === pm.otId)[10], sheet.read(tabs.schedule).find(row => row[2] === pm.otId)[7]];
    assert.deepEqual(synchronized, ['Completada', 'Completada', 'Completado']);
    return { inspection: inspection.inspectionId, inspectionOrder: inspection.otId, pmOrder: pm.otId, scheduleDate: date, synchronized };
  });

  await record('API-TALLER-STICKER-REVISIÓN-BLOQUEO', async () => {
    const operator = firstAccount('operador');
    const operatorCookie = await loginAs(request, operator);
    const op = workshop(request, operatorCookie);
    const coordinator = workshop(request, await loginAs(request, firstAccount('coordinador')));
    const supervisor = firstAccount('supervisor');
    const sup = workshop(request, await loginAs(request, supervisor));
    const { getStickerTemplate } = await import(pathToFileURL(resolve(fixture.repoDirectory, 'src/data/sticker-inspection-templates.js')).href);
    const template = getStickerTemplate('camion_articulado');
    const checks = template.items.map(item => ({ itemId: item.id, status: 'cumple', canOperate: true }));
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama' }).format(new Date());
    const body = { mutationId: randomUUID(), unit: 'DZ203', templateId: template.id, company: 'Hermes QA', date,
      time: '08:00', checks, finalColor: 'green', approve: false, photos: [] };
    assert.equal((await op('sticker', { ...body, approve: true })).status, 403);
    const submitted = good(await op('sticker', body), 'Guardar inspección para revisión');
    assert.equal(submitted.approvalState, 'pendiente_supervisor');
    assert.equal(submitted.canDispatch, false);
    const review = { mutationId: randomUUID(), folio: submitted.folio };
    assert.equal((await coordinator('stickerreview', review)).status, 403);
    assert(good(await sup('stickers'), 'Consultar bandeja de inspecciones').stickers.some(row => row.folio === submitted.folio));
    const reviewed = good(await sup('stickerreview', review), 'Aprobar inspección');
    assert.equal(reviewed.canDispatch, true);
    const sticker = sheet.read(tabs.sticker).find(row => row[1] === submitted.folio);
    assert.equal(sticker[18], firstAccount('operador').user.id);
    assert.equal(sticker[19], supervisor.user.id);
    assert(sticker[20]);
    const hardStop = template.items.find(item => item.hardStop);
    const mutationId = randomUUID();
    const upload = { kind: 'sticker', operationId: mutationId, units: ['DZ203'], expectedUserId: operator.user.id,
      slot: 0, mimeType: 'image/png', data: photoPng.toString('base64') };
    const photo = good(await request('/hermes-api/api/evidence', { cookie: operatorCookie, body: upload }), 'Adjuntar foto al sticker').url;
    assert.match(photo, /^\/hermes-api\/api\/evidence\?id=[a-f0-9]{64}$/);
    assert.equal((await request(photo, { cookie: operatorCookie })).status, 404);
    assert.equal(good(await request('/hermes-api/api/evidence', { cookie: operatorCookie, body: upload }), 'Reintentar foto').url, photo);
    const failedChecks = checks.map(item => item.itemId === hardStop.id ? { ...item, status: 'no_cumple', canOperate: false, comment: 'Hallazgo crítico ficticio', photos: [photo] } : item);
    const failing = { ...body, mutationId, time: '09:00', checks: failedChecks, photos: [photo] };
    assert.equal((await op('sticker', failing)).status, 400);
    const blocked = good(await op('sticker', { ...failing, finalColor: 'red' }), 'Guardar inspección roja');
    assert.equal(blocked.canDispatch, false);
    assert.equal((await request(photo)).status, 401);
    assert.equal((await request(photo, { cookie: operatorCookie })).status, 200);
    const coordinatorCookie = await loginAs(request, firstAccount('coordinador'));
    assert.equal((await request(photo, { cookie: coordinatorCookie })).status, 404);
    const hseCookie = await loginAs(request, supervisor);
    const downloaded = await fetch(fixture.origin + photo, { headers: { cookie: hseCookie } });
    assert.equal(downloaded.headers.get('Cache-Control'), 'private, no-store');
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), photoPng);
    const red = good(await sup('stickerreview', { mutationId: randomUUID(), folio: blocked.folio }), 'Revisar sin liberar unidad con sticker rojo');
    assert.equal(red.canDispatch, false);
    const readiness = good(await sup('readiness'), 'Consultar restricciones de flota');
    assert(readiness.stickers.some(row => row[1] === blocked.folio && row[5] === 'DZ203' && row[12] === 'red' && row[13] === 'no'));
    return { reviewed: submitted.folio, blocked: blocked.folio, reviewerId: supervisor.user.id, unit: 'DZ203', redCanDispatch: false };
  });
}

function orderPayload(description = 'Filtro sintético') {
  return {
    operationId: randomUUID(), date: '2026-11-12', deliveryDate: '2026-11-14',
    vendorName: 'Proveedor QA', vendorRfc: 'QAT000000000', unit: 'DZ203', entity: 'TP_PA_QA',
    lines: [
      { description, quantity: 2, unitPrice: 123.45 },
      { description: 'Sello sintético', quantity: 3, unitPrice: 45.67 },
      { description: 'Tornillería sintética', quantity: 5, unitPrice: 9.89 },
    ],
    tax: '30.34', shipping: 25.50, other: 8.75, comments: 'Orden aislada de prueba',
  };
}

function onlyFolio(rows, folio) {
  return rows.filter(row => row[0] === folio);
}

export async function checkPurchasing(fixture, record) {
  const request = requester(fixture.origin);
  const { sheet } = fixture;
  await record('API-COMPRAS-CATÁLOGO-PRECIOS', async () => {
    const mechanic = await loginAs(request, firstAccount('mecanico'));
    const buyer = await loginAs(request, firstAccount('jefe_taller'));
    const find = (query, unit) => request(`/api/parts/import?q=${encodeURIComponent(query)}${unit ? `&equipo=${unit}` : ''}`, { cookie: mechanic });
    for (const term of ['QA-001', 'OEM-QA-001', 'Filtro hidráulico de prueba']) {
      const [item] = good(await find(term, 'DZ203'), 'Buscar por SKU, OEM o descripción');
      assert.equal(item.part_number, 'QA-001');
      assert.equal(item.oem_ref, 'OEM-QA-001');
      assert.equal(item.stock_quantity, 8);
      assert.equal(item.stock_minimum, 3);
      assert.deepEqual(item.compatible_units, ['DZ203']);
      assert.equal(item.supplier, 'Proveedor QA');
    }
    assert.deepEqual(good(await find('QA-001', 'EX401'), 'Descartar incompatibilidad'), []);
    assert.deepEqual(good(await find('QA-NO-EXISTE'), 'Consultar repuesto inexistente'), []);
    const compare = supplier => request('/api/parts/import', { cookie: buyer, body: {
      supplier, parts: [{ part_number: 'QA-001', unit_price: 123.45 }, { part_number: 'QA-002', unit_price: 21.50 }],
    } });
    const same = good(await compare('Proveedor QA'), 'Comparar con el mismo proveedor');
    assert.equal(same.compared, 1);
    assert.deepEqual(same.unmatched, ['QA-002']);
    assert.deepEqual([same.price_changes[0].old_price, same.price_changes[0].pct_change, same.price_changes[0].source_date], [100, 23.45, '04/10/2026']);
    const other = good(await compare('Otro proveedor QA'), 'Comparar con otro proveedor');
    assert.equal(other.compared, 0);
    assert.deepEqual(other.unmatched, ['QA-001', 'QA-002']);
    return { sku: 'QA-001', stock: 8, minimum: 3, supplier: 'Proveedor QA', olderPrice: 100, deltaPct: 23.45, noHistory: other.unmatched.length };
  });

  await record('API-COMPRAS-PEDIDO-OC', async () => {
    const lead = purchasing(request, await loginAs(request, firstAccount('jefe_taller')));
    const manager = purchasing(request, await loginAs(request, firstAccount('gerencia')));
    const items = [
      { part_number: 'QA-001', description: 'Filtro hidráulico de prueba', quantity: 2, unit_price: 123.45, equipment: 'DZ203', urgencia: 'Urgente', notes: 'Nota QA de catálogo', source: 'Catálogo' },
      { part_number: 'MANUAL-QA', description: 'Empaque manual QA', quantity: 3, unit_price: 45.67, equipment: 'DZ203', urgencia: 'Normal', notes: 'Nota QA manual', isManual: true },
    ];
    const orderRequest = good(await lead('request-submit', { operationId: randomUUID(), items }), 'Enviar pedido de dos partidas');
    const getItems = async api => good(await api('requests'), 'Recargar partidas del pedido').items.filter(item => item.pedidoId === orderRequest.folio);
    const source = await getItems(manager);
    assert.equal(source.length, 2);
    const catalog = source.find(item => item.partNum === 'QA-001');
    const manual = source.find(item => item.partNum === 'MANUAL-QA');
    assert.deepEqual([catalog.cantidad, catalog.equipo, manual.cantidad, manual.fuente], ['2', 'DZ203', '3', 'Manual']);
    const statusChange = { operationId: randomUUID(), id: catalog.id, version: catalog.version, status: 'Pedido' };
    assert.equal((await lead('request-status', statusChange)).status, 403);
    good(await manager('request-status', statusChange), 'Cambiar la partida de catálogo');
    const changed = await getItems(lead);
    assert.deepEqual([changed.find(item => item.id === catalog.id).estado, changed.find(item => item.id === manual.id).estado], ['Pedido', 'Pendiente']);
    const payload = orderPayload();
    payload.tax = '26.88';
    payload.lines = source.map(item => ({ requestLineId: item.id, description: item.descripcion, quantity: item.cantidad, unitPrice: item.unitPrice }));
    const oc = good(await manager('order-save', payload), 'Convertir pedido a OC');
    const { order } = good(await manager(`order?folio=${encodeURIComponent(oc.folio)}`), 'Recargar OC vinculada');
    assert.equal(order.lines.length, 2);
    for (const part of source) {
      const linked = order.lines.find(line => line.requestLineId === part.id);
      assert.deepEqual([linked.requestId, linked.partNumber, linked.description, linked.quantity, linked.unitPrice], [orderRequest.folio, part.partNum, part.descripcion, part.cantidad, part.unitPrice]);
    }
    const linked = await getItems(manager);
    assert(linked.every(item => item.ocFolio === oc.folio && item.estado === 'Pedido'));
    return { request: orderRequest.folio, folio: oc.folio, linkedLines: 2, changedLine: catalog.id, fieldsRetained: ['folio del pedido', 'ID de partida', 'SKU', 'descripción', 'cantidad', 'precio unitario', 'unidad'] };
  });

  await record('API-COMPRAS-ATÓMICA', async () => {
    const api = purchasing(request, await loginAs(request, firstAccount('gerencia')));
    const payload = orderPayload();
    const previousHeaders = sheet.read(tabs.purchases);
    const previousLines = sheet.read(tabs.lines);
    const originalOrphan = onlyFolio(previousLines, 'OC-001');
    sheet.failNext({ matches: writes => writes.some(write => write.tab === tabs.lines), when: 'before' });
    const failed = await api('order-save', payload);
    assert(failed.status >= 500, `El fallo simulado devolvió ${failed.status}`);
    assert.deepEqual(sheet.read(tabs.purchases), previousHeaders, 'Se guardó una cabecera sin partidas');
    assert.deepEqual(sheet.read(tabs.lines), previousLines, 'El fallo dejó partidas aisladas');
    const repeated = await Promise.all([api('order-save', payload), api('order-save', payload)]);
    const [first, second] = repeated.map(result => good(result, 'Guardar OC y reintentar'));
    assert(first.folio);
    assert.equal(first.folio, second.folio);
    assert.notEqual(first.folio, 'OC-001');
    assert.equal(onlyFolio(sheet.read(tabs.purchases), first.folio).length, 1);
    assert.equal(onlyFolio(sheet.read(tabs.lines), first.folio).length, 3);
    assert.equal(first.total, '497.95');
    assert.deepEqual(onlyFolio(sheet.read(tabs.lines), 'OC-001'), originalOrphan);
    const simultaneous = await Promise.all([api('order-save', orderPayload('Alta sintética A')), api('order-save', orderPayload('Alta sintética B'))]);
    const simultaneousFolios = simultaneous.map(result => good(result, 'Alta simultánea').folio);
    assert.equal(new Set([first.folio, ...simultaneousFolios]).size, 3);
    const getOrder = async () => good(await api(`order?folio=${encodeURIComponent(first.folio)}`), 'Recargar OC').order;
    const draft = await getOrder();
    assert.deepEqual([draft.subtotal, draft.tax, draft.shipping, draft.other, draft.total], ['433.36', '30.34', '25.50', '8.75', '497.95']);
    assert(draft.vendorAddress.includes('Calle de prueba 10'));
    const [firstLine, deletedLine, thirdLine] = draft.lines;
    good(await api('order-save', { ...payload, operationId: randomUUID(), folio: first.folio, version: draft.version, tax: '38.95', lines: [
      { id: firstLine.id, description: 'Filtro editado QA', quantity: 4, unitPrice: 123.45 },
      { id: thirdLine.id, description: thirdLine.description, quantity: thirdLine.quantity, unitPrice: thirdLine.unitPrice },
      { description: 'Partida nueva QA', quantity: 1, unitPrice: 13.25 },
    ] }), 'Editar, quitar y agregar partida');
    const afterEdit = await getOrder();
    assert.equal(afterEdit.folio, first.folio);
    assert.equal(afterEdit.lines.length, 3);
    assert.equal(afterEdit.lines[0].id, firstLine.id);
    assert.deepEqual([afterEdit.lines[0].description, afterEdit.lines[0].quantity], ['Filtro editado QA', '4']);
    assert.equal(afterEdit.lines.some(item => item.id === deletedLine.id), false);
    assert.equal(onlyFolio(sheet.read(tabs.lines), first.folio).length, 3);
    const rejected = good(await api(`order?folio=${encodeURIComponent(simultaneousFolios[0])}`), 'Cargar otra OC de prueba').order;
    good(await api('order-status', { operationId: randomUUID(), folio: rejected.folio, version: rejected.version, status: 'Rechazada', reason: 'Motivo documentado en QA' }), 'Rechazar un borrador');
    const reloadedRejected = good(await api(`order?folio=${encodeURIComponent(rejected.folio)}`), 'Recargar OC rechazada').order;
    assert.equal(reloadedRejected.status, 'Rechazada');
    return { folio: first.folio, originalTotal: '497.95', rows: 4, simultaneousFolios, orphanPreserved: true, editPersisted: true, rejected: rejected.folio };
  });

  await record('API-COMPRAS-RECIBIR-PARCIAL', async () => {
    const manager = firstAccount('gerencia');
    const receiver = loadAccounts.find(account => account.membership.can_receive_purchases === true);
    const warehouse = purchasing(request, await loginAs(request, receiver));
    const accounting = purchasing(request, await loginAs(request, loadAccounts[11]));
    const treasury = purchasing(request, await loginAs(request, loadAccounts[17]));
    const api = purchasing(request, await loginAs(request, manager));
    const created = good(await api('order-save', orderPayload('Recepción de prueba')), 'Alta para recepción');
    const getOrder = async () => {
      const response = good(await api(`order?folio=${encodeURIComponent(created.folio)}`), 'Detalle de OC');
      return response.order ?? response;
    };
    const draft = await getOrder();
    const base = { folio: created.folio };
    const approve = { ...base, operationId: randomUUID(), version: draft.version, status: 'Aprobada', reason: 'Requisición revisada en QA' };
    const reviewer = purchasing(request, await loginAs(request, nonApprovingManager));
    assert.equal((await reviewer('order-status', approve)).status, 403);
    const approved = good(await api('order-status', approve), 'Aprobar OC');
    assert(approved);
    const order = await getOrder();
    assert.equal(order.status, 'Aprobada');
    assert.equal(order.approvedById, manager.user.id);
    assert(order.approvedAt);
    const line = order.lines[0];
    const lineId = line.id ?? line.lineId;
    assert(lineId, 'La partida no tiene identificador para recepción');
    const firstReceipt = { ...base, operationId: randomUUID(), version: order.version, lineId, quantity: 1, reference: 'Entrega sintética 1' };
    assert.equal((await api('order-receive', firstReceipt)).status, 403);
    good(await warehouse('order-receive', firstReceipt), 'Primera recepción parcial');
    const midway = await getOrder();
    assert.equal(midway.status, 'Recibida parcial');
    assert.equal(Number(midway.lines[0].received), 1);
    const second = { ...base, operationId: randomUUID(), version: midway.version, lineId, quantity: 1, reference: 'Entrega sintética 2' };
    good(await warehouse('order-receive', second), 'Segunda recepción parcial');
    good(await warehouse('order-receive', second), 'Reintentar segunda recepción');
    const final = await getOrder();
    const balance = final.lines.find(value => (value.id ?? value.lineId) === lineId);
    assert.equal(Number(balance.receivedQuantity ?? balance.received ?? balance.quantityReceived), 2);
    assert.equal(Number(balance.quantity) - Number(balance.receivedQuantity ?? balance.received ?? balance.quantityReceived), 0);
    assert.equal(balance.receipts.length, 2);
    assert(balance.receipts.every(receipt => receipt.actorId === receiver.user.id));
    assert.equal(final.status, 'Recibida parcial', 'Quedan otras dos partidas por recibir');
    assert.equal((await warehouse('order-receive', { ...base, operationId: randomUUID(), version: final.version, lineId, quantity: 1, reference: 'Exceso QA' })).status, 409);
    assert.equal((await accounting('order-invoice', { ...base, operationId: randomUUID(), version: final.version, reference: 'FAC-QA-OC', amount: final.total })).status, 409);
    for (const pending of final.lines.slice(1)) {
      const fresh = await getOrder();
      good(await warehouse('order-receive', { ...base, operationId: randomUUID(), version: fresh.version, lineId: pending.id, quantity: pending.quantity, reference: 'Entrega sintética partida ' + pending.number }), 'Recibir el resto de una partida');
    }
    const received = await getOrder();
    assert.equal(received.status, 'Recibida');
    assert.equal((await api('order-status', { ...base, operationId: randomUUID(), version: received.version, status: 'Pagada' })).status, 403);
    assert.equal((await treasury('order-payment', { ...base, operationId: randomUUID(), version: received.version, reference: 'BANCO-QA-OC', amount: received.total })).status, 409);
    good(await accounting('order-invoice', { ...base, operationId: randomUUID(), version: received.version, reference: 'FAC-QA-OC', amount: received.total }), 'Conciliar factura');
    const invoiced = await getOrder();
    good(await treasury('order-payment', { ...base, operationId: randomUUID(), version: invoiced.version, reference: 'BANCO-QA-OC', amount: invoiced.total }), 'Registrar pago externo conciliado');
    const paid = await getOrder();
    assert.equal(paid.status, 'Pagada');
    assert.equal(paid.payment.invoiceReference, paid.invoice.reference);
    assert.equal(new Set([paid.approvedById, receiver.user.id, paid.invoice.actorId, paid.payment.actorId]).size, 4);
    return { folio: created.folio, approvedById: manager.user.id, received: 2, remaining: 0, receipts: 2, partialStatus: final.status, finalStatus: paid.status, invoice: paid.invoice.reference, payment: paid.payment.reference };
  });

  await record('API-GASTOS-REPARTO-RECIBO', async () => {
    const actor = firstAccount('jefe_taller');
    const cookie = await loginAs(request, actor);
    const api = purchasing(request, cookie);
    const operationId = randomUUID();
    const upload = { kind: 'receipt', operationId, units: ['DZ203', 'EX401'], expectedUserId: actor.user.id, slot: 0,
      mimeType: 'image/png', data: photoPng.toString('base64') };
    const { url: receipt } = good(await request('/hermes-api/api/evidence', { cookie, body: upload }), 'Adjuntar comprobante del gasto');
    const expense = {
      tipo: 'Refaccion', proveedor: 'Proveedor QA', rfc_proveedor: 'QAT000000000', folio_factura: 'FAC-QA-REPARTO',
      entity: 'TP_PA_QA', currency: 'USD',
      document_date: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama' }).format(new Date()),
      subtotal: 100, iva: 7, total: 107, ot_id: 'OT-0004', metodo_pago: 'Transferencia', imagen_url: receipt,
      line_items: [{ part_number: 'QA-002', description: 'Sello de prueba', qty: 1, unit_price: 100 }],
    };
    const payload = { operationId, expense, allocations: [{ unit: 'DZ203', amount: 64.20 }, { unit: 'EX401', amount: 42.80 }] };
    assert.equal((await api('expense-save', { ...payload, operationId: randomUUID() })).status, 400);
    const saved = good(await api('expense-save', payload), 'Guardar gasto repartido');
    assert.equal((await request(receipt, { cookie })).status, 200);
    good(await api('expense-save', payload), 'Reintentar el mismo gasto');
    const rows = sheet.read(tabs.expenses).filter(row => row[17] === saved.folio);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map(row => [row[10], row[7], row[8], row[9], row[15]]), [
      ['DZ203', '60.00', '4.20', '64.20', receipt], ['EX401', '40.00', '2.80', '42.80', receipt],
    ]);
    return { folio: saved.folio, units: ['DZ203', 'EX401'], subtotal: 100, tax: 7, total: 107, receiptLinked: true, pendingReview: rows.every(row => row[16] === 'Pendiente') };
  });
}
