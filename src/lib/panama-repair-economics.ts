export const interventionKinds = ['repair', 'rebuild', 'replace'] as const;
export type InterventionKind = (typeof interventionKinds)[number];
export const interventionLabels = { repair: 'Reparar', rebuild: 'Reconstruir', replace: 'Reemplazar' };
export const interventionCurrencies = ['USD', 'PAB'] as const;
type Currency = (typeof interventionCurrencies)[number];

export interface InterventionDraft {
  currency: string;
  cash: string;
  cashSource: string;
  life: string;
  lifeSource: string;
  downtime: string;
  downtimeSource: string;
  productiveHoursLost: string;
}

export interface DowntimeImpactDraft {
  rate: string;
  currency: string;
  source: string;
}

export interface InterventionResult {
  kind: InterventionKind;
  cashCents: number;
  costPerHourCents: number;
  life: number;
  downtime: number;
  impactCents: number | null;
  productiveHoursLost: number | null;
  cashSource: string;
  lifeSource: string;
  downtimeSource: string;
}

export interface InterventionComparison {
  currency: Currency;
  rows: InterventionResult[];
  lowest: InterventionKind[];
  impact: { rateCents: number; source: string } | null;
}

function isCurrency(currency: string): currency is Currency {
  return interventionCurrencies.some(value => value === currency);
}

function scaled(text: string, maxDigits: number, signed = false): bigint | null {
  const match = /^(-?)(\d+)(?:[.,](\d{1,2}))?$/.exec(text.trim());
  const [, sign, whole = '', fraction = ''] = match ?? [];
  if (!match || whole.length > maxDigits || (!signed && sign === '-')) return null;
  const cents = BigInt(whole + fraction.padEnd(2, '0'));
  return sign === '-' ? -cents : cents;
}

function rounded(numerator: bigint, denominator: bigint): number {
  return Number((numerator + denominator / 2n) / denominator);
}

export function compareInterventions(drafts: Record<InterventionKind, InterventionDraft>, impact?: DowntimeImpactDraft):
  InterventionComparison | { error: string } {
  const currency = drafts.repair.currency;
  if (!isCurrency(currency) || interventionKinds.some(kind => drafts[kind].currency !== currency)) {
    return { error: 'Usa una sola moneda para las tres alternativas.' };
  }

  const impactRate = impact ? scaled(impact.rate, 6) : null;
  if (impact && (impact.currency !== currency || impactRate === null || !impact.source.trim())) {
    return { error: 'Indica la contribución por hora con su respaldo y en la moneda de la comparación.' };
  }

  const rows: InterventionResult[] = [];
  const lowest: InterventionKind[] = [];
  let least: { cash: bigint; life: bigint } | undefined;
  for (const kind of interventionKinds) {
    const value = drafts[kind];
    const cash = scaled(value.cash, 9);
    const life = scaled(value.life, 6);
    const downtime = scaled(value.downtime, 6);
    const lost = impact ? scaled(value.productiveHoursLost, 6) : null;
    const [cashSource, lifeSource, downtimeSource] = [value.cashSource.trim(), value.lifeSource.trim(), value.downtimeSource.trim()];
    const label = interventionLabels[kind].toLowerCase();
    if (cash === null || life === null || life === 0n || downtime === null) {
      return { error: `Para ${label}, revisa el desembolso, la vida útil mayor a cero y la parada estimada. Usa hasta dos decimales.` };
    }
    if (!cashSource || !lifeSource || !downtimeSource) {
      return { error: `Para ${label}, indica la fuente del desembolso, la vida útil y la parada.` };
    }
    if (impact && (lost === null || lost > downtime)) {
      return { error: `Para ${label}, indica las horas productivas que se perderían. Deben estar entre cero y las horas de parada.` };
    }

    const comparison = least ? cash * least.life - least.cash * life : -1n;
    if (comparison < 0n) {
      least = { cash, life };
      lowest.splice(0, lowest.length, kind);
    } else if (comparison === 0n) {
      lowest.push(kind);
    }
    rows.push({
      kind, cashCents: Number(cash), life: Number(life) / 100, downtime: Number(downtime) / 100,
      costPerHourCents: rounded(cash * 100n, life),
      productiveHoursLost: lost === null ? null : Number(lost) / 100,
      impactCents: lost === null || impactRate === null ? null : rounded(lost * impactRate, 100n),
      cashSource, lifeSource, downtimeSource,
    });
  }
  return { currency, rows, lowest, impact: impact && impactRate !== null ? { rateCents: Number(impactRate), source: impact.source.trim() } : null };
}

interface OrderIdentity { ot: string; folio: string; unit: string }
interface DocumentedCosts extends OrderIdentity {
  project: string;
  totals: { currency: string; amount: string }[];
  lines: { currency: string; amount: string; reference: string; valuationReference?: string }[];
  pending: unknown[];
}

export function documentedRepairCost(order: OrderIdentity, data?: DocumentedCosts) {
  if (data?.project !== 'tmf-panama' || data.ot !== order.ot || data.folio !== order.folio || data.unit !== order.unit
    || data.pending.length || data.totals.length !== 1 || !data.lines.length) return null;
  const total = data.totals[0];
  if (!total || !isCurrency(total.currency)) return null;
  const cash = scaled(total.amount, 9);
  if (cash === null) return null;

  const references = new Set<string>();
  let sum = 0n;
  for (const line of data.lines) {
    const amount = scaled(line.amount, 9, true);
    if (line.currency !== total.currency || amount === null || !line.reference.trim()) return null;
    sum += amount;
    references.add(line.valuationReference ? `${line.reference} (${line.valuationReference})` : line.reference);
  }
  if (sum !== cash) return null;

  const inline = [...references].join(' · ');
  const cashSource = inline.length > 420
    ? `${order.folio} · ${data.lines.length} partidas conciliadas en Ver soportes`
    : `${order.folio} · ${inline}`;
  return { cash: total.amount, currency: total.currency, cashSource };
}
