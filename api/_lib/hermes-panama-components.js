export const COMPONENT_INTERVENTION = 'intervencion_componente';
export const componentActions = new Set(['new', 'partial', 'rebuild']);
const whole = { positions: ['Todo'], numbered: false };
const sided = { positions: ['Todo', 'Izquierda', 'Derecha'], numbered: false };
const rollers = { ...sided, numbered: true };
export const componentCatalog = {
  Adaptadores: whole, 'Bogie pins': sided, 'Bujes y pasadores': { positions: ['Todo', 'Brazo', 'Cucharón', 'Pluma'], numbered: false },
  Cadena: sided, Cantoneras: whole, Catalina: sided, 'Cilindro tensor': sided, Cucharón: whole, Cuchillas: whole,
  Dientes: whole, Platos: sided, 'Rolos inferiores': rollers, 'Rolos superiores': rollers, 'Rueda guía': sided, Trunions: sided,
};

const label = value => String(value ?? '').trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').toUpperCase();
export const componentPositionKey = (part, position) => JSON.stringify([label(part), label(position)]);

export function canonicalComponent(part, position) {
  const key = label(part).replace(/^SPROCKET$/, 'CATALINA').replace(/^CUCHARON \(RECONSTRUCCION\)$/, 'CUCHARON')
    .replace(/^RODILLOS (INFERIORES|SUPERIORES)$/, 'ROLOS $1');
  const component = Object.keys(componentCatalog).find(item => label(item) === key);
  const place = label(position).replace(/^(IZQ\.?|IZQUIERDO)(?= |$)/, 'IZQUIERDA').replace(/^(DER\.?|DERECHO)(?= |$)/, 'DERECHA');
  const indexed = /^(IZQUIERDA|DERECHA) ([1-9]\d?)$/.exec(place);
  const spec = componentCatalog[component];
  const base = (!indexed || spec?.numbered) && spec?.positions.find(item => label(item) === (indexed?.[1] ?? place));
  return component && base ? { part: component, position: indexed ? `${base} ${indexed[2]}` : base } : null;
}

export function overlappingPositions(a, b) {
  return a !== b && (a === 'Todo' || b === 'Todo' || a.startsWith(b + ' ') || b.startsWith(a + ' '));
}

export function componentHourTicks(value) {
  const raw = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (!/^\d{1,7}(?:\.\d{1,3})?$/.test(raw)) return null;
  return Math.round(Number(raw) * 1000);
}

export function componentInterventionHistory(logs, orders, unit) {
  const byOrder = new Map(orders.filter(row => row[3]?.trim().toUpperCase() === unit && /^OT-[A-Z0-9-]+$/.test(row[1] ?? ''))
    .map(row => [row[1], /^OT-\d{4,15}$/.test(row[25] ?? '') ? row[25] : row[1]]));
  const entries = [];
  const heads = new Map();
  let incomplete = false;
  for (const row of logs) {
    if (row[2] !== COMPONENT_INTERVENTION) continue;
    let entry;
    try { entry = JSON.parse(row[4]); } catch { /* Report a damaged event below. */ }
    const folio = byOrder.get(row[1]);
    if (!folio && entry?.unit !== unit) continue;
    const name = canonicalComponent(entry?.part, entry?.position);
    const meter = componentHourTicks(entry?.meter), carry = componentHourTicks(entry?.carriedHours);
    const prior = componentHourTicks(entry?.priorHours);
    const slot = name && componentPositionKey(name.part, name.position);
    const head = heads.get(slot);
    const accepted = Date.parse(entry?.acceptedAt), recorded = Date.parse(row[0]);
    const previousAgrees = head ? entry?.previous?.id === head.id && entry.previous.orderId === head.orderId
      && meter >= head.meter && prior === head.carry + meter - head.meter : !entry?.previous;
    const lifeAgrees = entry?.action === 'new' ? carry === 0 : prior !== null && carry <= prior
      && (entry?.action === 'rebuild' || carry === prior);
    if (!folio || entry?.unit !== unit || entry.id !== row[3] || !/^[a-f0-9]{64}$/.test(entry.id)
        || !/^[a-f0-9-]{36}$/.test(entry.requestId) || !componentActions.has(entry.action) || !name
        || meter === null || carry === null || (entry.priorHours !== null && prior === null) || prior > meter
        || !previousAgrees || !lifeAgrees || !(accepted <= recorded)
        || typeof entry.reference !== 'string' || !entry.reference.trim() || typeof entry.details !== 'string' || !entry.details.trim()
        || !row[7] || !['jefe_taller', 'supervisor', 'gerencia'].includes(row[6])) {
      incomplete = true;
      continue;
    }
    heads.set(slot, { id: entry.id, orderId: row[1], meter, carry });
    entries.push({ id: entry.id, unit, orderId: row[1], folio, action: entry.action, ...name, acceptedAt: entry.acceptedAt,
      meter: entry.meter, priorHours: entry.priorHours, carriedHours: entry.carriedHours, details: entry.details,
      reference: entry.reference, recordedAt: row[0], reviewedBy: row[5], actorId: row[7], requestId: entry.requestId,
      ...(entry.previous && { previous: { id: entry.previous.id, folio: byOrder.get(entry.previous.orderId) ?? entry.previous.orderId } }),
    });
  }
  return { entries, incomplete };
}
