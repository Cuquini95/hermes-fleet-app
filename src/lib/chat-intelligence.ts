import { expandQuery } from './parts-dictionary';

const PART_LOOKUP_RE =
  /\b(part|parts|part number|parts number|pn|p n|p\/n|oem|pieza|piezas|parte|partes|repuesto|repuestos|refaccion|refacciones|catalogo|catalog)\b/i;

const NUMBER_REQUEST_RE =
  /\b(number|numero|codigo|code|pn|p n|p\/n|oem)\b/i;

const COMPONENT_HINTS = [
  'accumulator',
  'acumulador',
  'hydraulic accumulator',
  'acumulador hidraulico',
  'filter',
  'filtro',
  'pump',
  'bomba',
  'seal',
  'sello',
  'hose',
  'manguera',
  'valve',
  'valvula',
  'sensor',
  'cylinder',
  'cilindro',
  'hydraulic',
  'hidraulico',
  'brake',
  'freno',
  'transmission',
  'transmision',
  'injector',
  'injectors',
  'inyector',
  'inyectores',
  'bearing',
  'rodamiento',
  'cojinete',
  'balero',
  'baleros',
  'balinera',
  'balineras',
  'roller',
  'track roller',
  'track rollers',
  'lower roller',
  'carrier roller',
  'carrier rollers',
  'upper roller',
  'rolo',
  'rolos',
  'rolo inferior',
  'rolo superior',
  'rol inferior',
  'rol superior',
  'rodillo',
  'rodillos',
  'rodillo inferior',
  'rodillo superior',
  'rueda guia',
  'rueda tensora',
  'rueda motriz',
  'catalina',
  'pinon',
  'piñon',
  'piñón',
  'idler',
  'sprocket',
  'final drive',
  'mando final',
  'turbo',
  'alternator',
  'alternador',
  'starter',
  'arranque',
  'radiator',
  'radiador',
  'belt',
  'banda',
  'correa',
] as const;

const FILLER_RE =
  /\b(can you tell me|could you tell me|can you|could you|please|por favor|tell me|give me|find|look up|search|buscar|busca|dime|dame|cual es|what is|whats|which is|do you have|the|a|an|me|to|for|of|on|in|de|del|la|el|los|las|para|por|number|numero|codigo|code|part number|parts number|part numbers|part|parts|pieza|piezas|parte|partes|repuesto|repuestos|refaccion|refacciones|catalogo|catalog|oem|pn|p n|p\/n)\b/gi;

function normalizeForIntent(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[¿?¡!.,;:_*()[\]{}"'`~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findComponentHints(text: string): string[] {
  const normalized = normalizeForIntent(text);
  const hints = new Set<string>();
  for (const hint of COMPONENT_HINTS) {
    if (normalized.includes(hint)) hints.add(hint);
  }
  return Array.from(hints);
}

export function isPartsLookupQuery(text: string): boolean {
  const normalized = normalizeForIntent(text);
  const hasCatalogIntent = PART_LOOKUP_RE.test(normalized);
  const asksForNumber = NUMBER_REQUEST_RE.test(normalized);
  const hasComponent = findComponentHints(normalized).length > 0;
  const isBareComponent = hasComponent && normalized.split(' ').length <= 3;

  return hasCatalogIntent || (asksForNumber && hasComponent) || isBareComponent;
}

export function extractPartsSearchTerm(text: string): string {
  const normalized = normalizeForIntent(text);
  const cleaned = normalized
    .replace(FILLER_RE, ' ')
    .replace(/\bca\s*-?\s*\d{1,3}\b/g, ' ')
    .replace(/\bhm\s*-?\s*400(?:-?3(?:mo)?)?\b/g, ' ')
    .replace(/\b(?:komatsu|cat|caterpillar|doosan|mack)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned) return cleaned;

  const [firstHint] = findComponentHints(text);
  return firstHint ?? normalized;
}

export function buildPartsSearchTerms(text: string): string[] {
  const terms = new Set<string>();
  const addExpanded = (value: string) => {
    const term = value.trim();
    if (!term) return;
    for (const expanded of expandQuery(term)) {
      const cleaned = expanded.trim();
      if (cleaned) terms.add(cleaned);
    }
  };

  addExpanded(extractPartsSearchTerm(text));

  for (const hint of findComponentHints(text)) {
    addExpanded(hint);
  }

  return Array.from(terms).slice(0, 8);
}

export function dedupePartResults<T extends { part_number?: string }>(parts: T[]): T[] {
  const seen = new Set<string>();
  const results: T[] = [];

  for (const part of parts) {
    const key = part.part_number?.trim().toUpperCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    results.push(part);
  }

  return results;
}

const FAULT_CODE_PATTERNS = [
  // Komatsu HM400 retarder/body controller examples: DK51L5, AEBDKX, AEBRKX
  /\b([A-Z]{2}\d{2}[A-Z]\d)\b/i,
  /\b(AE[A-Z]{3,4})\b/i,
  // Komatsu transmission controller examples: 15K0MW, 1AK0LW
  /\b(\d{1,2}[A-Z]\d[A-Z]{1,3})\b/i,
  // Engine/controller examples: E002, E-28, CA271, P0420, U0001
  /\b([EFPUBCA][A-Z]?[-]?\d{3,5}[A-Z]?\d*)\b/i,
  /\b([EF]-\d{2,4})\b/i,
  // Doosan examples: C-10, A-456
  /\b([AC]-\d{2,4})\b/i,
];

const GENERIC_FAULT_TOKEN_RE =
  /\b(?=[A-Z0-9-]{5,12}\b)(?=.*[A-Z])(?=.*\d)[A-Z][A-Z0-9-]*\d[A-Z0-9-]*\b/i;

function normalizeFaultCode(value: string): string {
  return value.toUpperCase().replace(/\s+/g, '');
}

function isLikelyModelOrUnitToken(value: string): boolean {
  const token = normalizeFaultCode(value).replace(/-/g, '');
  return (
    /^HM\d/.test(token) ||
    /^D\d{2,}/.test(token) ||
    /^DX\d/.test(token) ||
    /^DL\d/.test(token) ||
    /^CAT\d/.test(token) ||
    /^CA\d{1,3}$/.test(token) ||
    /^EPAK\d*$/.test(token) ||
    /^EPTK\d*$/.test(token) ||
    /^EPCF\d*$/.test(token) ||
    /^EPEX\d*$/.test(token)
  );
}

export function extractFaultCode(text: string): string | null {
  for (const pattern of FAULT_CODE_PATTERNS) {
    const match = text.match(pattern);
    const value = match?.[1];
    if (value && !isLikelyModelOrUnitToken(value)) return normalizeFaultCode(value);
  }

  const generic = text.match(GENERIC_FAULT_TOKEN_RE)?.[0];
  if (generic && !isLikelyModelOrUnitToken(generic)) return normalizeFaultCode(generic);

  return null;
}

export function isFaultCodeQuery(text: string): boolean {
  return extractFaultCode(text) !== null ||
    /\bcodigo\b|\bcódigo\b|\berror\b|\bfault\b|\balerta\b/i.test(text);
}

export async function withChatTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs = 35_000,
): Promise<T> {
  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    return await run(ctrl.signal);
  } finally {
    clearTimeout(timeoutId);
  }
}
