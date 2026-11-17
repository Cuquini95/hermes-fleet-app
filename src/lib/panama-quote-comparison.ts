import type { PurchaseIssuer, PurchaseRequestLine, PurchaseVendor } from './purchasing-api';

export type QuoteCurrency = 'USD' | 'PAB';
export type Compatibility = 'pending' | 'confirmed' | 'incompatible';

export interface ComparedOfferInput {
  id: string;
  vendor: string;
  reference: string;
  currency: QuoteCurrency;
  quantity: string;
  unitPrice: string;
  freight: string;
  other: string;
  promisedDate: string;
  compatibility: Compatibility;
  compatibilityEvidence: string;
  warranty: string;
}

export interface QuoteComparisonInput {
  quantity: string;
  currency: QuoteCurrency;
  comparisonDate: string;
  neededDate: string;
  downtime: { hoursPerDay: string; hourlyCost: string; source: string; basis: 'estimate' | 'documented' };
  offers: ComparedOfferInput[];
}

export interface QuoteOrderPrefill {
  requestLineId: string;
  requestVersion: string;
  quantity: string;
  entityId: string;
  currency: QuoteCurrency;
  vendor: { name: string; rfc: string };
  unitPrice: string;
  shipping: string;
  other: string;
  deliveryDate: string;
  quoteReference: string;
  rationale: string;
}

interface ComparedOffer {
  id: string;
  landedCents: bigint | null;
  leadDays: number | null;
  delayDays: number | null;
  downtimeCents: bigint | null;
  totalWithDowntimeCents: bigint | null;
  eligible: boolean;
  issues: string[];
}

function scaled(value: string, digits: number): bigint | null {
  const pattern = digits === 2 ? /^\d{1,10}(?:\.\d{1,2})?$/ : /^\d{1,10}(?:\.\d{1,3})?$/;
  if (!pattern.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole + fraction.padEnd(digits, '0'));
}

function calendarDay(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const value = Date.parse(date + 'T00:00:00Z');
  return Number.isFinite(value) && new Date(value).toISOString().slice(0, 10) === date ? value / 86_400_000 : null;
}

function lowest(offers: ComparedOffer[], metric: 'landedCents' | 'totalWithDowntimeCents') {
  const comparable = offers.filter(offer => offer.eligible && offer[metric] !== null);
  if (comparable.length < 2) return [];
  return comparable
    .filter(offer => comparable.every(other => offer[metric]! <= other[metric]!))
    .map(offer => offer.id);
}

export function compareQuotes(input: QuoteComparisonInput) {
  const qty = scaled(input.quantity, 3);
  const today = calendarDay(input.comparisonDate);
  const due = calendarDay(input.neededDate);
  const assumedHours = scaled(input.downtime.hoursPerDay, 2);
  const costPerHour = scaled(input.downtime.hourlyCost, 2);
  const includesDowntime = due !== null && assumedHours !== null && assumedHours > 0n
    && assumedHours <= 2400n && costPerHour !== null && costPerHour > 0n && input.downtime.source.trim() !== '';

  const offers = input.offers.map<ComparedOffer>((offer) => {
    const issues: string[] = [];
    const quotedQuantity = scaled(offer.quantity, 3);
    const cost = scaled(offer.unitPrice, 2);
    const freight = scaled(offer.freight, 2);
    const other = scaled(offer.other || '0', 2);
    const delivery = calendarDay(offer.promisedDate);
    const total = qty !== null && qty > 0n && quotedQuantity === qty && cost !== null && cost > 0n && freight !== null && other !== null
      ? (qty * cost + 500n) / 1000n + freight + other : null;
    const leadDays = delivery === null || today === null ? null : delivery - today;
    const delayDays = delivery === null || due === null ? null : Math.max(0, delivery - due);
    const sameCurrency = offer.currency === input.currency;
    const downtime = sameCurrency && includesDowntime && delayDays !== null
      ? (BigInt(delayDays) * assumedHours * costPerHour + 50n) / 100n : null;
    if (!offer.vendor || !offer.reference.trim()) issues.push('Indica proveedor y referencia.');
    if (!sameCurrency) issues.push('La moneda de la oferta difiere de la moneda de comparación.');
    if (qty === null || qty <= 0n || quotedQuantity !== qty) issues.push('La oferta debe cubrir la misma cantidad.');
    if (cost === null || cost <= 0n || freight === null || other === null) issues.push('Completa el precio y el flete. Registra 0 si el flete está incluido.');
    if (leadDays === null) issues.push('Indica una fecha de entrega válida.');
    if (leadDays !== null && leadDays < 0) issues.push('La fecha prometida ya pasó. Confirma otra fecha con el proveedor.');
    if (offer.compatibility !== 'confirmed') issues.push(offer.compatibility === 'incompatible' ? 'Repuesto incompatible.' : 'Compatibilidad por confirmar.');
    if (offer.compatibility === 'confirmed' && !offer.compatibilityEvidence.trim()) issues.push('Falta el respaldo de compatibilidad.');
    return {
      id: offer.id, landedCents: total, leadDays, delayDays, downtimeCents: downtime,
      totalWithDowntimeCents: total !== null && downtime !== null ? total + downtime : null,
      eligible: issues.length === 0, issues,
    };
  });

  return { offers, includesDowntime, cheapestLanded: lowest(offers, 'landedCents'), cheapestWithDowntime: lowest(offers, 'totalWithDowntimeCents') };
}

export function comparisonQuantity(request: PurchaseRequestLine) {
  return request.unallocatedQuantity ?? request.cantidad;
}

export function quoteVendorKey(vendor: Pick<PurchaseVendor, 'name' | 'rfc'>) {
  return JSON.stringify([vendor.name, vendor.rfc]);
}

export function quoteVendorLabel(
  vendor: Pick<PurchaseVendor, 'name' | 'rfc'>,
  vendors: readonly Pick<PurchaseVendor, 'name' | 'rfc'>[],
) {
  const canonical = (name: string) => name.trim().toLocaleLowerCase('es-PA');
  const sameName = vendors.some(other => canonical(other.name) === canonical(vendor.name) && other.rfc !== vendor.rfc);
  return sameName ? `${vendor.name} · ${vendor.rfc || 'Sin identificación'}` : vendor.name;
}

export function validateQuoteOrderPrefill(value: unknown, request: PurchaseRequestLine, issuers: PurchaseIssuer[], vendors: PurchaseVendor[]) {
  if (!value || typeof value !== 'object') return undefined;
  const quote = value as Partial<QuoteOrderPrefill>;
  if (quote.requestLineId !== request.id || quote.requestVersion !== request.version || quote.quantity !== comparisonQuantity(request)) return undefined;
  const issuer = issuers.find(candidate => candidate.id === quote.entityId && candidate.currency === quote.currency);
  if (!issuer || !quote.vendor) return undefined;
  const vendor = vendors.find(candidate => candidate.name === quote.vendor?.name && candidate.rfc === quote.vendor?.rfc);
  if (!vendor || typeof quote.unitPrice !== 'string' || typeof quote.shipping !== 'string' || typeof quote.other !== 'string'
    || typeof quote.deliveryDate !== 'string' || typeof quote.rationale !== 'string' || typeof quote.quoteReference !== 'string') return undefined;
  const unitPrice = scaled(quote.unitPrice, 2);
  if (!unitPrice || scaled(quote.shipping, 2) === null || scaled(quote.other, 2) === null || calendarDay(quote.deliveryDate) === null
    || !quote.rationale.trim() || quote.rationale.length > 400 || !quote.quoteReference.trim() || quote.quoteReference.length > 100) return undefined;
  return {
    issuer, vendor, unitPrice: quote.unitPrice, shipping: quote.shipping, other: quote.other,
    deliveryDate: quote.deliveryDate, reference: quote.quoteReference, rationale: quote.rationale,
  };
}
