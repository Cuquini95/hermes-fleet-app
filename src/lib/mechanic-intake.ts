export const GUIDED_INTAKE_OPTIONS = [
  'Motor',
  'Tablero / luz',
  'Fuga',
  'Ruido',
  'No camina',
  'Frenos',
  'Hidraulico',
] as const;

export type GuidedIntakeOption = (typeof GUIDED_INTAKE_OPTIONS)[number];

export type MechanicIntakeDecision = {
  shouldAsk: boolean;
  reason: string;
  normalizedMessage: string;
  expandedMessage: string;
  options: GuidedIntakeOption[];
  responseText: string;
};

type SlangEntry = {
  terms: string[];
  expansion: string;
  systems: GuidedIntakeOption[];
};

export const MECHANIC_SLANG_DICTIONARY: SlangEntry[] = [
  {
    terms: ['bulla', 'bullon', 'suena feo', 'suena raro', 'truena', 'golpea'],
    expansion: 'ruido mecanico revisar origen del ruido',
    systems: ['Ruido'],
  },
  {
    terms: ['pesado', 'ta pesado', 'esta pesado'],
    expansion: 'baja potencia posible transmision freno pegado o motor cargado',
    systems: ['Motor', 'No camina', 'Frenos'],
  },
  {
    terms: ['no camina', 'no camina nada', 'no se mueve', 'no avanza', 'no jala'],
    expansion: 'no avanza revisar transmision freno pegado mando final',
    systems: ['No camina', 'Frenos'],
  },
  {
    terms: ['se muere', 'se apaga', 'se para', 'se para solo', 'se apago', 'se paro'],
    expansion: 'motor se apaga bajo carga revisar combustible aire y codigo activo',
    systems: ['Motor'],
  },
  {
    terms: ['jala poco', 'no tiene fuerza', 'sin fuerza', 'no tiene potencia', 'flojo'],
    expansion: 'baja potencia revisar filtro de aire combustible turbo freno pegado',
    systems: ['Motor', 'Frenos'],
  },
  {
    terms: ['huele quemado', 'olor a quemado', 'apestando quemado'],
    expansion: 'olor a quemado revisar freno clutch transmision electrico',
    systems: ['Frenos', 'No camina', 'Tablero / luz'],
  },
  {
    terms: ['bota aceite', 'botando aceite', 'tira aceite', 'fuga aceite', 'gotea aceite'],
    expansion: 'fuga de aceite revisar nivel ubicacion y presion',
    systems: ['Fuga'],
  },
  {
    terms: ['bota agua', 'botando agua', 'tira agua', 'fuga agua', 'agua verde'],
    expansion: 'fuga de refrigerante revisar temperatura radiador mangueras y deposito',
    systems: ['Fuga', 'Motor'],
  },
  {
    terms: ['luz prendida', 'luz tablero', 'sale codigo', 'tiro codigo', 'alarma'],
    expansion: 'alerta en tablero pedir codigo letra e icono visible',
    systems: ['Tablero / luz'],
  },
];

const VAGUE_MECHANIC_PATTERNS = [
  'no sirve',
  'esta malo',
  'ta malo',
  'anda mal',
  'anda raro',
  'esta raro',
  'fallando',
  'revisar equipo',
  'revisar maquina',
  'ocupa mecanico',
  'chequear',
  'checar',
  'problema',
  'no se',
  'se puso feo',
  'no quedo bien',
  'maquina mala',
  'equipo malo',
  'quedo raro',
  'necesita revision',
  'no trabaja bien',
  'no responde bien',
  'esta fallon',
  'fallo otra vez',
  'viene mal',
  'esta jodiendo',
  'no quiere',
  'no hace nada',
  'se siente raro',
  'esta flojo',
  'ta raro',
  'tirada',
  'tirado',
  'pendiente revision',
];

const CLEAR_DIAGNOSTIC_SIGNALS = [
  'aceite',
  'agua',
  'refrigerante',
  'diesel',
  'hidraul',
  'temperatura',
  'calienta',
  'freno',
  'frena',
  'transmision',
  'caja',
  'mando',
  'motor',
  'arranca',
  'prende',
  'codigo',
  'sensor',
  'bateria',
  'alternador',
  'filtro',
  'manguera',
  'inyector',
  'bomba',
  'turbo',
  'direccion',
  'rolo',
  'rodillo',
  'llanta',
  'humo',
  'click',
  'fuga',
  'bota',
  'tira',
  'gotea',
];

const ADMIN_INTENT_SIGNALS = [
  'registrar',
  'guardar',
  'reporte',
  'flete',
  'viaje',
  'gasto',
  'costo',
  'factura',
  'booking',
  'contenedor',
  'combustible litros',
  'horometro',
  'operador',
  'ubicacion',
];

export function normalizeMechanicText(value = ''): string {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(normalizeMechanicText(term)));
}

function uniqueOptions(options: GuidedIntakeOption[]): GuidedIntakeOption[] {
  const seen = new Set<GuidedIntakeOption>();
  return options.filter((option) => {
    if (seen.has(option)) return false;
    seen.add(option);
    return true;
  });
}

export function expandMechanicSlang(message: string): string {
  const normalized = normalizeMechanicText(message);
  const expansions = MECHANIC_SLANG_DICTIONARY
    .filter((entry) => hasAny(normalized, entry.terms))
    .map((entry) => entry.expansion);

  if (!expansions.length) return message;
  return `${message}\n\nLenguaje taller detectado: ${Array.from(new Set(expansions)).join('; ')}`;
}

export function isMechanicDiagnosticMessage(message: string): boolean {
  const normalized = normalizeMechanicText(message);
  if (!normalized) return false;
  if (hasAny(normalized, ADMIN_INTENT_SIGNALS)) return false;
  return hasAny(normalized, CLEAR_DIAGNOSTIC_SIGNALS)
    || MECHANIC_SLANG_DICTIONARY.some((entry) => hasAny(normalized, entry.terms))
    || hasAny(normalized, VAGUE_MECHANIC_PATTERNS);
}

export function isGuidedIntakeSelection(message: string): boolean {
  const normalized = normalizeMechanicText(message);
  return GUIDED_INTAKE_OPTIONS.some((option) => {
    const optionText = normalizeMechanicText(option);
    return normalized === optionText || normalized.startsWith(`${optionText} `) || normalized.startsWith(`${optionText} -`);
  });
}

export function buildGuidedIntakeMessage(options: GuidedIntakeOption[] = GUIDED_INTAKE_OPTIONS as unknown as GuidedIntakeOption[]): string {
  const optionText = options.map((option) => `- ${option}`).join('\n');
  return [
    'Necesito ubicar la falla primero.',
    '',
    'Elige una:',
    optionText,
    '',
    'Despues te digo: mover o no mover, que revisar primero, y que foto/codigo necesito.',
  ].join('\n');
}

export function analyzeMechanicIntake(
  message: string,
  options: { hasActiveCase?: boolean; hasPhoto?: boolean } = {},
): MechanicIntakeDecision {
  const normalized = normalizeMechanicText(message);
  const matchedSlang = MECHANIC_SLANG_DICTIONARY.filter((entry) => hasAny(normalized, entry.terms));
  const slangOptions = uniqueOptions(matchedSlang.flatMap((entry) => entry.systems));
  const wordCount = normalized ? normalized.split(/\s+/).length : 0;
  const hasClearSignal = hasAny(normalized, CLEAR_DIAGNOSTIC_SIGNALS);
  const hasVaguePattern = hasAny(normalized, VAGUE_MECHANIC_PATTERNS);
  const isVeryShort = wordCount > 0 && wordCount <= 3;
  const isOnlySlang = matchedSlang.length > 0 && !hasClearSignal && wordCount <= 4;
  const ambiguousSlang = matchedSlang.some((entry) => entry.systems.length > 1);
  const shouldAsk = !options.hasPhoto
    && !options.hasActiveCase
    && !isGuidedIntakeSelection(message)
    && isMechanicDiagnosticMessage(message)
    && (hasVaguePattern || isOnlySlang || (isVeryShort && !hasClearSignal) || ambiguousSlang);
  const optionsToShow = slangOptions.length ? slangOptions : [...GUIDED_INTAKE_OPTIONS];

  return {
    shouldAsk,
    reason: shouldAsk ? 'vague_or_ambiguous_mechanic_message' : 'diagnose_directly',
    normalizedMessage: normalized,
    expandedMessage: expandMechanicSlang(message),
    options: optionsToShow,
    responseText: buildGuidedIntakeMessage(optionsToShow),
  };
}
