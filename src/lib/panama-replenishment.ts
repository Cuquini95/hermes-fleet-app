export interface ReplenishmentInput {
  unit: string;
  life: string;
  lifeMeasure: string;
  dailyUse: string;
  readingDate: string;
  lifeReference: string;
  quantity: string;
  leadDays: string;
  leadReference: string;
}

interface OrderSource {
  folio: string;
  number?: string;
  lineId: string;
  remaining: string;
  inTransit: string;
  due: string | null;
}

export interface ReplenishmentSource {
  today: string;
  readAt: string;
  stock: { physical: string | null; reserved: string | null; available: string | null; minimum: string | null; measure: string };
  openOrders: OrderSource[];
  issues: { reason: string; folio?: string; number?: string; lineId?: string }[];
}

const dayMs = 86_400_000;
const scale = 1000n;
const wholeMeasures = /^(?:pzas?|pz|pieza[s]?|und?s?|ud?s?|unidad(?:es)?|ea|caja[s]?|par(?:es)?|juego[s]?|kits?)$/i;
const nonnegative = (value: bigint) => value < 0n ? 0n : value;

function ticks(value: string | null) {
  const match = /^(\d{1,12})(?:[.,](\d{1,3}))?$/.exec(value?.trim() ?? '');
  if (!match?.[1]) return null;
  return BigInt(match[1]) * scale + BigInt((match[2] ?? '').padEnd(3, '0'));
}

function formatTicks(value: bigint) {
  const fraction = String(value % scale).padStart(3, '0').replace(/0+$/, '');
  return String(value / scale) + (fraction ? '.' + fraction : '');
}

function parseDay(input: string) {
  const ms = /^\d{4}-\d{2}-\d{2}$/.test(input) ? Date.parse(input) : NaN;
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === input ? ms : NaN;
}

function isoDay(value: number) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.getUTCFullYear() >= 1 && date.getUTCFullYear() <= 9999
    ? date.toISOString().slice(0, 10) : null;
}

export function calculateReplenishment(source: ReplenishmentSource, input: ReplenishmentInput) {
  const { stock } = source;
  const physical = ticks(stock.physical);
  const reserved = ticks(stock.reserved);
  const available = ticks(stock.available);
  const minimum = ticks(stock.minimum);
  if (!stock.measure.trim() || physical === null || reserved === null || available === null || minimum === null
    || physical - reserved !== available) return { error: 'Verifica la medida, el mínimo y el disponible del almacén.' } as const;
  if (source.issues.length) return { error: 'Concilia las partidas señaladas antes de calcular la reposición.' } as const;

  const life = ticks(input.life);
  const usage = ticks(input.dailyUse);
  const required = ticks(input.quantity);
  const lead = /^\d{1,4}$/.test(input.leadDays.trim()) ? Number(input.leadDays) : NaN;
  const today = parseDay(source.today);
  const reading = parseDay(input.readingDate);
  if (life === null || usage === null || usage === 0n || required === null || required === 0n || !Number.isFinite(lead)
    || !Number.isFinite(today) || !Number.isFinite(reading) || reading > today
    || !input.unit.trim() || !input.lifeReference.trim() || !input.leadReference.trim() || !['h', 'km'].includes(input.lifeMeasure)) {
    return { error: 'Indica la vida, el uso diario, una lectura válida, la cantidad y el plazo con sus respaldos.' } as const;
  }
  const whole = wholeMeasures.test(stock.measure.trim().replace(/\.$/, ''));
  if (whole && [physical, reserved, available, minimum, required].some(value => value % scale !== 0n)) {
    return { error: 'Esta medida requiere cantidades enteras. Revisa el catálogo y la cantidad del cambio.' } as const;
  }
  // Use the day life reaches zero, including when it falls within a partial day.
  const projected = reading + Number(life / usage) * dayMs;
  const neededBy = Math.max(today, projected);
  const needDate = isoDay(projected);
  const coverageDate = isoDay(neededBy);
  const latestOrder = neededBy - lead * dayMs;
  const orderBy = isoDay(latestOrder);
  if (!needDate || !coverageDate || !orderBy) return { error: 'El horizonte de vida o de entrega supera el calendario válido.' } as const;

  let timely = 0n;
  let late = 0n;
  for (const order of source.openOrders) {
    const remaining = ticks(order.remaining);
    const inTransit = ticks(order.inTransit);
    const due = parseDay(order.due ?? '');
    if (!Number.isFinite(due) || due < today || remaining === null || remaining <= 0n || inTransit === null
      || inTransit > remaining || (whole && (remaining % scale !== 0n || inTransit % scale !== 0n))) {
      return { error: 'Verifica fechas y cantidades de las OC abiertas antes de calcular.' } as const;
    }
    if (due <= neededBy) timely += remaining;
    else late += remaining;
  }
  const needed = required + minimum;
  const gap = nonnegative(needed - available - timely);
  const expedite = late < gap ? late : gap;
  const additional = gap - expedite;
  return { needDate, coverageDate, orderBy, needed: formatTicks(needed), timely: formatTicks(timely), late: formatTicks(late),
    gap: formatTicks(gap), expedite: formatTicks(expedite), additional: formatTicks(additional),
    leadRisk: additional > 0n && latestOrder < today };
}
