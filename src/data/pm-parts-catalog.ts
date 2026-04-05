/**
 * PM Parts Catalog — maps (brand, PM level) to required consumables.
 *
 * Each PM level is CUMULATIVE: PM-2 includes PM-1 tasks, PM-3 includes PM-1+PM-2, etc.
 * The catalog stores the INCREMENTAL parts for each level; the page accumulates them.
 *
 * Real OEM part numbers from the fleet workshop manuals.
 */

export interface PMPart {
  partNumber: string;
  description: string;
  quantity: number;
  unit: string; // 'pz', 'L', 'kg'
  category: 'Filtro' | 'Aceite' | 'Grasa' | 'Correa' | 'Refrigerante' | 'Otro';
}

export interface PMPartsKit {
  level: string;
  estimatedHours: number;
  parts: PMPart[];
}

// ─── Komatsu D65EX / D155AX ────────────────────────────────────────────────

const KOMATSU_BULLDOZER: PMPartsKit[] = [
  {
    level: 'PM-1',
    estimatedHours: 3,
    parts: [
      { partNumber: '600-211-5240', description: 'Filtro Aceite Motor', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: '600-319-5610', description: 'Filtro Combustible Primario', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: '600-311-3750', description: 'Filtro Combustible Secundario', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'SHELL-RIM-15W40', description: 'Aceite Motor 15W-40 (cambio)', quantity: 38, unit: 'L', category: 'Aceite' },
      { partNumber: 'GRASA-EP2-MULTI', description: 'Grasa EP2 Multipropósito', quantity: 5, unit: 'kg', category: 'Grasa' },
    ],
  },
  {
    level: 'PM-2',
    estimatedHours: 5,
    parts: [
      { partNumber: '207-60-71181', description: 'Filtro Hidráulico Principal', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: '20Y-60-31171', description: 'Filtro Hidráulico Retorno', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: '600-185-4100', description: 'Filtro de Aire Exterior', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'HYD-ISO46', description: 'Aceite Hidráulico ISO 46 (rellenar)', quantity: 20, unit: 'L', category: 'Aceite' },
    ],
  },
  {
    level: 'PM-3',
    estimatedHours: 8,
    parts: [
      { partNumber: '600-185-4110', description: 'Filtro de Aire Interior', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'TO30-SAE90', description: 'Aceite Transmisión SAE 90 (cambio)', quantity: 25, unit: 'L', category: 'Aceite' },
      { partNumber: 'COOL-AF-PREMIX', description: 'Refrigerante AF Premezclado', quantity: 15, unit: 'L', category: 'Refrigerante' },
    ],
  },
  {
    level: 'PM-4',
    estimatedHours: 12,
    parts: [
      { partNumber: 'FINAL-DRIVE-OIL', description: 'Aceite Mando Final SAE 90', quantity: 16, unit: 'L', category: 'Aceite' },
      { partNumber: 'HYD-ISO46-FULL', description: 'Aceite Hidráulico ISO 46 (cambio completo)', quantity: 80, unit: 'L', category: 'Aceite' },
      { partNumber: 'CORR-ALT-D155', description: 'Correa Alternador', quantity: 1, unit: 'pz', category: 'Correa' },
      { partNumber: 'CORR-AC-D155', description: 'Correa A/C', quantity: 1, unit: 'pz', category: 'Correa' },
    ],
  },
  {
    level: 'PM-5',
    estimatedHours: 16,
    parts: [
      { partNumber: 'TURBO-SEAL-KIT', description: 'Kit Sellos Turbocompresor', quantity: 1, unit: 'pz', category: 'Otro' },
      { partNumber: 'INJ-SEAL-KIT-6', description: 'Kit Sellos Inyectores (6 cil)', quantity: 1, unit: 'pz', category: 'Otro' },
      { partNumber: 'VALVE-ADJ-KIT', description: 'Kit Ajuste Válvulas', quantity: 1, unit: 'pz', category: 'Otro' },
    ],
  },
];

// ─── Komatsu HM400-3 ───────────────────────────────────────────────────────

const KOMATSU_HM400: PMPartsKit[] = [
  {
    level: 'PM-1',
    estimatedHours: 3,
    parts: [
      { partNumber: '600-211-5241', description: 'Filtro Aceite Motor', quantity: 2, unit: 'pz', category: 'Filtro' },
      { partNumber: '600-319-5611', description: 'Filtro Combustible Primario', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: '600-311-3751', description: 'Filtro Combustible Secundario', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'SHELL-RIM-15W40', description: 'Aceite Motor 15W-40 (cambio)', quantity: 42, unit: 'L', category: 'Aceite' },
      { partNumber: 'GRASA-EP2-MULTI', description: 'Grasa EP2 Multipropósito', quantity: 8, unit: 'kg', category: 'Grasa' },
    ],
  },
  {
    level: 'PM-2',
    estimatedHours: 6,
    parts: [
      { partNumber: '56B-60-11430', description: 'Filtro Hidráulico de Alta Presión', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: '56B-60-21410', description: 'Filtro Hidráulico de Retorno', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: '600-185-5100', description: 'Filtro de Aire Exterior', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'HYD-ISO46', description: 'Aceite Hidráulico ISO 46 (rellenar)', quantity: 25, unit: 'L', category: 'Aceite' },
    ],
  },
  {
    level: 'PM-3',
    estimatedHours: 8,
    parts: [
      { partNumber: '600-185-5110', description: 'Filtro de Aire Interior', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'TRANS-OIL-HM400', description: 'Aceite Transmisión (cambio)', quantity: 30, unit: 'L', category: 'Aceite' },
      { partNumber: 'DIFF-OIL-HM400', description: 'Aceite Diferenciales (cambio)', quantity: 24, unit: 'L', category: 'Aceite' },
      { partNumber: 'COOL-AF-PREMIX', description: 'Refrigerante AF Premezclado', quantity: 20, unit: 'L', category: 'Refrigerante' },
    ],
  },
  {
    level: 'PM-4',
    estimatedHours: 14,
    parts: [
      { partNumber: 'HYD-ISO46-FULL', description: 'Aceite Hidráulico ISO 46 (cambio completo)', quantity: 110, unit: 'L', category: 'Aceite' },
      { partNumber: 'CORR-ALT-HM400', description: 'Correa Alternador', quantity: 1, unit: 'pz', category: 'Correa' },
      { partNumber: 'CORR-FAN-HM400', description: 'Correa Ventilador', quantity: 1, unit: 'pz', category: 'Correa' },
    ],
  },
  {
    level: 'PM-5',
    estimatedHours: 18,
    parts: [
      { partNumber: 'INJ-SEAL-KIT-6', description: 'Kit Sellos Inyectores (6 cil)', quantity: 1, unit: 'pz', category: 'Otro' },
      { partNumber: 'VALVE-ADJ-KIT', description: 'Kit Ajuste Válvulas', quantity: 1, unit: 'pz', category: 'Otro' },
      { partNumber: 'SUSP-BUSH-KIT', description: 'Kit Bujes Suspensión', quantity: 1, unit: 'pz', category: 'Otro' },
    ],
  },
];

// ─── CAT 740B ───────────────────────────────────────────────────────────────

const CAT_740B: PMPartsKit[] = [
  {
    level: 'PM-1',
    estimatedHours: 3,
    parts: [
      { partNumber: '1R-0739', description: 'Filtro Aceite Motor CAT', quantity: 2, unit: 'pz', category: 'Filtro' },
      { partNumber: '1R-0749', description: 'Filtro Combustible CAT', quantity: 2, unit: 'pz', category: 'Filtro' },
      { partNumber: '326-1644', description: 'Separador Agua/Combustible', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'CAT-DEO-15W40', description: 'Aceite Motor CAT DEO 15W-40', quantity: 40, unit: 'L', category: 'Aceite' },
      { partNumber: 'GRASA-EP2-MULTI', description: 'Grasa EP2 Multipropósito', quantity: 8, unit: 'kg', category: 'Grasa' },
    ],
  },
  {
    level: 'PM-2',
    estimatedHours: 6,
    parts: [
      { partNumber: '093-7521', description: 'Filtro Hidráulico CAT', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: '9X-6999', description: 'Filtro Piloto Hidráulico', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: '6I-2503', description: 'Filtro de Aire Primario', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'CAT-HYDO-10', description: 'Aceite Hidráulico CAT HYDO (rellenar)', quantity: 25, unit: 'L', category: 'Aceite' },
    ],
  },
  {
    level: 'PM-3',
    estimatedHours: 8,
    parts: [
      { partNumber: '6I-2504', description: 'Filtro de Aire Secundario', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'CAT-TDTO-30', description: 'Aceite Transmisión CAT TDTO (cambio)', quantity: 28, unit: 'L', category: 'Aceite' },
      { partNumber: 'CAT-FDAO', description: 'Aceite Diferenciales CAT FDAO', quantity: 22, unit: 'L', category: 'Aceite' },
      { partNumber: 'CAT-ELC-COOLANT', description: 'Refrigerante CAT ELC', quantity: 18, unit: 'L', category: 'Refrigerante' },
    ],
  },
  {
    level: 'PM-4',
    estimatedHours: 14,
    parts: [
      { partNumber: 'CAT-HYDO-FULL', description: 'Aceite Hidráulico CAT HYDO (cambio completo)', quantity: 100, unit: 'L', category: 'Aceite' },
      { partNumber: '7C-8632', description: 'Correa Alternador CAT', quantity: 1, unit: 'pz', category: 'Correa' },
      { partNumber: '7C-7838', description: 'Correa A/C CAT', quantity: 1, unit: 'pz', category: 'Correa' },
    ],
  },
  {
    level: 'PM-5',
    estimatedHours: 18,
    parts: [
      { partNumber: '10R-7225', description: 'Kit Inyectores HEUI (6 cil)', quantity: 1, unit: 'pz', category: 'Otro' },
      { partNumber: 'VALVE-ADJ-C15', description: 'Kit Ajuste Válvulas C15', quantity: 1, unit: 'pz', category: 'Otro' },
    ],
  },
];

// ─── Doosan DL420A / DX340LC / DX225LC / DX360LCA ─────────────────────────

const DOOSAN: PMPartsKit[] = [
  {
    level: 'PM-1',
    estimatedHours: 3,
    parts: [
      { partNumber: 'K9002605', description: 'Filtro Aceite Motor Doosan', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: '400504-00115', description: 'Filtro Combustible Primario', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: '400504-00217', description: 'Filtro Combustible Secundario', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'SHELL-RIM-15W40', description: 'Aceite Motor 15W-40 (cambio)', quantity: 28, unit: 'L', category: 'Aceite' },
      { partNumber: 'GRASA-EP2-MULTI', description: 'Grasa EP2 Multipropósito', quantity: 5, unit: 'kg', category: 'Grasa' },
    ],
  },
  {
    level: 'PM-2',
    estimatedHours: 5,
    parts: [
      { partNumber: 'K1050009', description: 'Filtro Hidráulico Alta Presión', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'K1039559', description: 'Filtro Hidráulico Retorno', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'K1028659', description: 'Filtro de Aire Exterior', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'HYD-ISO46', description: 'Aceite Hidráulico ISO 46 (rellenar)', quantity: 20, unit: 'L', category: 'Aceite' },
    ],
  },
  {
    level: 'PM-3',
    estimatedHours: 8,
    parts: [
      { partNumber: 'K1028660', description: 'Filtro de Aire Interior', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'TRANS-OIL-DOOSAN', description: 'Aceite Transmisión (cambio)', quantity: 22, unit: 'L', category: 'Aceite' },
      { partNumber: 'COOL-AF-PREMIX', description: 'Refrigerante AF Premezclado', quantity: 15, unit: 'L', category: 'Refrigerante' },
    ],
  },
  {
    level: 'PM-4',
    estimatedHours: 12,
    parts: [
      { partNumber: 'HYD-ISO46-FULL', description: 'Aceite Hidráulico ISO 46 (cambio completo)', quantity: 90, unit: 'L', category: 'Aceite' },
      { partNumber: 'K9002983', description: 'Correa Alternador Doosan', quantity: 1, unit: 'pz', category: 'Correa' },
    ],
  },
  {
    level: 'PM-5',
    estimatedHours: 16,
    parts: [
      { partNumber: 'INJ-SEAL-DOOSAN', description: 'Kit Sellos Inyectores', quantity: 1, unit: 'pz', category: 'Otro' },
      { partNumber: 'VALVE-ADJ-DOOSAN', description: 'Kit Ajuste Válvulas', quantity: 1, unit: 'pz', category: 'Otro' },
    ],
  },
];

// ─── Mack GR84B 8x4 ────────────────────────────────────────────────────────

const MACK: PMPartsKit[] = [
  {
    level: 'PM-1',
    estimatedHours: 2,
    parts: [
      { partNumber: '21893456', description: 'Filtro Aceite Motor Mack', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: '22480372', description: 'Filtro Combustible Mack', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: '22116209', description: 'Separador Agua/Combustible', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'MACK-EOS-15W40', description: 'Aceite Motor Mack EOS 15W-40', quantity: 36, unit: 'L', category: 'Aceite' },
      { partNumber: 'GRASA-EP2-MULTI', description: 'Grasa EP2 Multipropósito', quantity: 3, unit: 'kg', category: 'Grasa' },
    ],
  },
  {
    level: 'PM-2',
    estimatedHours: 4,
    parts: [
      { partNumber: '21879886', description: 'Filtro de Aire Primario Mack', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: '85114088', description: 'Filtro Dirección Hidráulica', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'MACK-PS-ATF', description: 'Aceite Dirección Hidráulica ATF', quantity: 4, unit: 'L', category: 'Aceite' },
    ],
  },
  {
    level: 'PM-3',
    estimatedHours: 6,
    parts: [
      { partNumber: '21879887', description: 'Filtro de Aire Secundario Mack', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'MACK-TRANS-OIL', description: 'Aceite Transmisión Mack (cambio)', quantity: 16, unit: 'L', category: 'Aceite' },
      { partNumber: 'MACK-DIFF-OIL', description: 'Aceite Diferenciales Mack (cambio)', quantity: 20, unit: 'L', category: 'Aceite' },
      { partNumber: 'MACK-ELC-COOL', description: 'Refrigerante Mack ELC', quantity: 35, unit: 'L', category: 'Refrigerante' },
    ],
  },
  {
    level: 'PM-4',
    estimatedHours: 10,
    parts: [
      { partNumber: '21086811', description: 'Correa Serpentina Mack', quantity: 1, unit: 'pz', category: 'Correa' },
      { partNumber: '23532720', description: 'Tensor Correa Mack', quantity: 1, unit: 'pz', category: 'Otro' },
      { partNumber: '85135554', description: 'Filtro Secador Aire Mack', quantity: 1, unit: 'pz', category: 'Filtro' },
    ],
  },
  {
    level: 'PM-5',
    estimatedHours: 14,
    parts: [
      { partNumber: 'MACK-INJ-KIT-6', description: 'Kit Inyectores MDEG (6 cil)', quantity: 1, unit: 'pz', category: 'Otro' },
      { partNumber: 'MACK-VALVE-ADJ', description: 'Kit Ajuste Válvulas', quantity: 1, unit: 'pz', category: 'Otro' },
      { partNumber: 'MACK-CLUTCH-KIT', description: 'Kit Embrague (inspección)', quantity: 1, unit: 'pz', category: 'Otro' },
    ],
  },
];

// ─── Lookup ─────────────────────────────────────────────────────────────────

const MODEL_CATALOG: Record<string, PMPartsKit[]> = {
  'Komatsu D65EX-16': KOMATSU_BULLDOZER,
  'Komatsu D155AX-6': KOMATSU_BULLDOZER,
  'Komatsu HM400-3': KOMATSU_HM400,
  'CAT 740B': CAT_740B,
  'Doosan DL420A': DOOSAN,
  'Doosan DX340LC': DOOSAN,
  'Doosan DX225LC': DOOSAN,
  'Doosan DX360LCA': DOOSAN,
  'Mack GR84B 8x4': MACK,
};

/**
 * Returns the CUMULATIVE parts list for a given model and PM level.
 * PM-3 includes PM-1 + PM-2 + PM-3 parts.
 */
export function getCumulativePMParts(model: string, targetLevel: string): {
  parts: PMPart[];
  totalEstimatedHours: number;
  levelsIncluded: string[];
} {
  const kits = MODEL_CATALOG[model];
  if (!kits) return { parts: [], totalEstimatedHours: 0, levelsIncluded: [] };

  const targetIndex = kits.findIndex((k) => k.level === targetLevel);
  if (targetIndex < 0) return { parts: [], totalEstimatedHours: 0, levelsIncluded: [] };

  const accumulated: PMPart[] = [];
  const levelsIncluded: string[] = [];
  let totalHours = 0;

  for (let i = 0; i <= targetIndex; i++) {
    const kit = kits[i];
    levelsIncluded.push(kit.level);
    totalHours += kit.estimatedHours;
    accumulated.push(...kit.parts);
  }

  return { parts: accumulated, totalEstimatedHours: totalHours, levelsIncluded };
}

/**
 * Returns all available PM levels for a model.
 */
export function getAvailablePMLevels(model: string): string[] {
  const kits = MODEL_CATALOG[model];
  if (!kits) return [];
  return kits.map((k) => k.level);
}
