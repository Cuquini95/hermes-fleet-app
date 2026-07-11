import type { DiagnoseResult, PhotoAnalysisResult } from './hermes-api';
import {
  applyDiagnosticRules,
  ruleResultToContextBlock,
  type DiagnosticRuleInput,
  type DiagnosticRuleResult,
} from './diagnostic-rules';

export type DiagnosticFinding = {
  system: string;
  evidence: string[];
  severity: 'BAJA' | 'MEDIA' | 'ALTA';
  status: 'suspected' | 'confirmed' | 'ruled_out';
};

export type DiagnosticCaseState = {
  equipo: string;
  model?: string;
  source: 'photo' | 'text' | 'fault_code' | 'manual' | 'parts';
  activeSystems: string[];
  findings: DiagnosticFinding[];
  alreadyChecked: string[];
  ruledOut: string[];
  requiredNextTest?: string;
  operationalDecision?: string;
  lastQuestion?: string;
  lastAnswer?: string;
  safetyLock?: {
    locked: boolean;
    reason: string;
    unlockCondition: string;
  };
  /** Legacy summary for prompt continuity */
  summary?: string;
  ruleSource?: string;
};

const PARTS_INTENT_RE = /\b(part|parts|pieza|repuesto|catalogo|diagrama|manual|pn|p\/n|oem)\b/i;
const UNRELATED_TOPIC_RE = /\b(whatsapp|orden de compra|horometro|flete|registro operativo|inventario)\b/i;

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

function extractUnitLabel(equipo: string): string {
  const slash = equipo.split('/')[0]?.trim();
  return slash || equipo;
}

function extractCheckedItems(message: string): string[] {
  const normalized = message.toLowerCase();
  const found: string[] = [];
  if (/ya revise (el )?radiador|radiador (esta|está) bien/.test(normalized)) found.push('radiador revisado');
  if (/ya cambie filtros|filtros nuevos|cambie filtros/.test(normalized)) found.push('filtros cambiados');
  if (/nivel (esta|está) bien|ya revise nivel/.test(normalized)) found.push('nivel de aceite revisado');
  if (/no veo fuga/.test(normalized)) found.push('sin fuga visible');
  if (/motor suena normal|suena normal/.test(normalized)) found.push('motor suena normal');
  return found;
}

export function isUnrelatedTopic(message: string, caseState: DiagnosticCaseState | null): boolean {
  if (!caseState) return false;
  if (UNRELATED_TOPIC_RE.test(message)) return true;
  if (PARTS_INTENT_RE.test(message) && !message.match(/fuga|falla|ruido|calienta|aceite|freno/i)) return true;
  return false;
}

export function createEmptyCase(equipo: string): DiagnosticCaseState {
  return {
    equipo,
    source: 'text',
    activeSystems: [],
    findings: [],
    alreadyChecked: [],
    ruledOut: [],
  };
}

function upsertFinding(
  state: DiagnosticCaseState,
  finding: DiagnosticFinding,
): DiagnosticCaseState {
  const existing = state.findings.findIndex((f) => f.system === finding.system);
  const findings = existing >= 0
    ? state.findings.map((f, i) => (i === existing ? { ...finding, evidence: uniqueStrings([...f.evidence, ...finding.evidence]) } : f))
    : [...state.findings, finding];

  return {
    ...state,
    findings,
    activeSystems: uniqueStrings([...state.activeSystems, finding.system]),
  };
}

export function applyRuleToCase(
  state: DiagnosticCaseState | null,
  rule: DiagnosticRuleResult,
  userMessage: string,
): DiagnosticCaseState {
  const base = state ?? createEmptyCase('');
  return {
    ...base,
    activeSystems: uniqueStrings([...base.activeSystems, rule.system]),
    findings: upsertFinding(base, {
      system: rule.system,
      evidence: [userMessage, ...rule.likelyCauses.slice(0, 1)],
      severity: rule.severity,
      status: 'suspected',
    }).findings,
    alreadyChecked: uniqueStrings([...base.alreadyChecked, ...extractCheckedItems(userMessage)]),
    requiredNextTest: rule.nextTests[0],
    operationalDecision: rule.operationalDecision,
    lastQuestion: rule.question,
    lastAnswer: userMessage,
    safetyLock: rule.safetyLock ?? base.safetyLock,
    ruleSource: rule.source,
    summary: rule.likelyCauses.slice(0, 2).join('; '),
  };
}

export function caseFromPhoto(
  equipo: string,
  result: PhotoAnalysisResult,
  userMessage: string,
): DiagnosticCaseState {
  const severity = (result.severidad === 'ALTA' ? 'ALTA' : result.severidad === 'BAJA' ? 'BAJA' : 'MEDIA') as DiagnosticFinding['severity'];
  return {
    equipo,
    source: 'photo',
    activeSystems: [result.componente_probable],
    findings: [{
      system: result.componente_probable,
      evidence: [result.tipo_de_dano, userMessage].filter(Boolean),
      severity,
      status: 'suspected',
    }],
    alreadyChecked: [],
    ruledOut: [],
    operationalDecision: result.recomendacion_inicial,
    requiredNextTest: result.recomendacion_inicial.split('.')[0],
    lastAnswer: userMessage,
    summary: `${result.componente_probable}: ${result.tipo_de_dano}`,
    safetyLock: severity === 'ALTA' && /no operar|manometro|manómetro/i.test(result.recomendacion_inicial)
      ? {
          locked: true,
          reason: result.tipo_de_dano,
          unlockCondition: 'Medir presión real con manómetro antes de mover.',
        }
      : undefined,
  };
}

export function caseFromDiagnose(
  equipo: string,
  result: DiagnoseResult,
  userMessage: string,
  source: DiagnosticCaseState['source'] = 'text',
  prior: DiagnosticCaseState | null = null,
): DiagnosticCaseState {
  const severity = (result.prioridad === 'ALTA' ? 'ALTA' : result.prioridad === 'BAJA' ? 'BAJA' : 'MEDIA') as DiagnosticFinding['severity'];
  const system = prior?.activeSystems[0] || 'Diagnóstico general';

  return {
    equipo,
    model: prior?.model,
    source,
    activeSystems: prior?.activeSystems.length ? prior.activeSystems : [system],
    findings: prior?.findings.length
      ? prior.findings
      : [{
          system,
          evidence: result.causas_probables.slice(0, 2),
          severity,
          status: 'suspected' as const,
        }],
    alreadyChecked: uniqueStrings([...(prior?.alreadyChecked ?? []), ...extractCheckedItems(userMessage)]),
    ruledOut: prior?.ruledOut ?? [],
    requiredNextTest: result.checklist_diagnostico[0] || prior?.requiredNextTest,
    operationalDecision: result.decision_operativa || prior?.operationalDecision,
    lastQuestion: result.pregunta_clave || prior?.lastQuestion,
    lastAnswer: userMessage,
    safetyLock: prior?.safetyLock,
    ruleSource: prior?.ruleSource,
    summary: result.causas_probables.slice(0, 3).join('; ') || prior?.summary,
  };
}

export function buildCaseContextPrompt(
  state: DiagnosticCaseState | null,
  currentMessage: string,
  ruleBlock?: string,
): string | undefined {
  if (!state && !ruleBlock) return undefined;

  const lines = [
    ruleBlock || '',
    state ? `Caso activo del mismo equipo (${state.equipo}).` : '',
    state ? `Origen: ${state.source}.` : '',
    state?.activeSystems.length ? `Sistemas activos: ${state.activeSystems.join(' | ')}.` : '',
    state?.findings.length
      ? `Hallazgos: ${state.findings.map((f) => `${f.system} [${f.severity}/${f.status}]: ${f.evidence.join(', ')}`).join(' | ')}.`
      : '',
    state?.summary ? `Resumen: ${state.summary}.` : '',
    state?.alreadyChecked.length ? `Ya revisado por el mecánico: ${state.alreadyChecked.join(' | ')}.` : '',
    state?.ruledOut.length ? `Descartado: ${state.ruledOut.join(' | ')}.` : '',
    state?.requiredNextTest ? `Prueba requerida pendiente: ${state.requiredNextTest}.` : '',
    state?.operationalDecision ? `Decisión operativa vigente: ${state.operationalDecision}.` : '',
    state?.safetyLock?.locked
      ? `BLOQUEO SEGURIDAD: ${state.safetyLock.reason} Desbloqueo: ${state.safetyLock.unlockCondition}.`
      : '',
    state?.lastQuestion ? `Última pregunta hecha: ${state.lastQuestion}.` : '',
    state?.lastAnswer ? `Última respuesta del mecánico: ${state.lastAnswer}.` : '',
    `Mensaje nuevo: ${currentMessage}`,
    'Continúa este mismo caso. No reinicies el diagnóstico.',
    'No contradigas reglas determinísticas ni bloqueos de seguridad.',
  ];

  const text = lines.filter(Boolean).join('\n');
  return text.trim() || undefined;
}

export function mergeDiagnoseWithRule(
  ai: DiagnoseResult,
  rule: DiagnosticRuleResult | null,
): DiagnoseResult {
  if (!rule) return ai;

  const filterContradictions = (items: string[]) => items.filter((item) => {
    const lower = item.toLowerCase();
    if (rule.safetyLock?.locked && /puede mover|seguro mover|continuar operando|operar normal/i.test(lower)) {
      return false;
    }
    if (rule.operationalDecision.startsWith('NO OPERAR') && /mover al taller|puede operar/i.test(lower)) {
      return false;
    }
    return true;
  });

  return {
    ...ai,
    prioridad: rule.severity,
    causas_probables: uniqueStrings([...rule.likelyCauses, ...filterContradictions(ai.causas_probables)]).slice(0, 4),
    checklist_diagnostico: uniqueStrings([...rule.nextTests, ...filterContradictions(ai.checklist_diagnostico)]).slice(0, 6),
    advertencias: uniqueStrings([...rule.warnings, ...(ai.advertencias ?? [])]).slice(0, 4),
    decision_operativa: rule.operationalDecision,
    pregunta_clave: rule.question,
    nota_tecnica: ai.nota_tecnica,
  };
}

export type MechanicFormatInput = {
  unitLabel: string;
  decision: string;
  likelyCauses: string[];
  nextTests: string[];
  warnings: string[];
  question: string;
  sources: string[];
  isFollowUp?: boolean;
};

export function formatMechanicDiagnosis(input: MechanicFormatInput): string {
  const header = input.isFollowUp
    ? `**Seguimiento para ${input.unitLabel}**`
    : `Diagnóstico para ${input.unitLabel}`;

  const likely = input.likelyCauses.slice(0, 3).map((c) => `- ${c}`).join('\n') || '- Aún falta confirmar con prueba.';
  const tests = input.nextTests.slice(0, 5).map((t) => `- ${t}`).join('\n') || '- Confirma lectura o síntoma exacto.';
  const warn = input.warnings.length
    ? `\n\n**Cuidado:**\n${input.warnings.slice(0, 3).map((w) => `- ${w}`).join('\n')}`
    : '';
  const question = input.question
    ? `\n\n**Respóndeme esto:**\n${input.question}`
    : '';
  const source = input.sources.length
    ? `\n\n**Fuente:**\n${input.sources.map((s) => `- ${s}`).join('\n')}`
    : '';

  return [
    header,
    `**Decisión:**\n${input.decision}`,
    `**Lo más probable:**\n${likely}`,
    `**Siguiente prueba:**\n${tests}`,
    warn,
    question,
    source,
  ].filter(Boolean).join('\n\n');
}

export function formatFieldMechanicDiagnosis(input: MechanicFormatInput): string {
  const header = input.isFollowUp
    ? `**Seguimiento para ${input.unitLabel}**`
    : `**Diagnostico para ${input.unitLabel}**`;
  const likely = input.likelyCauses.slice(0, 3).map((cause) => `- ${cause}`).join('\n')
    || '- Falta confirmar con prueba.';
  const firstTest = input.nextTests[0] || 'Confirma sintoma exacto, codigo o foto cercana.';
  const needs = [
    input.question || '',
    ...input.nextTests.slice(1, 3),
  ].filter(Boolean).map((item) => `- ${item}`).join('\n')
    || '- Foto clara, codigo del tablero o lectura.';
  const warningBlock = input.warnings.length
    ? `\n\n**Cuidado:**\n${input.warnings.slice(0, 2).map((warning) => `- ${warning}`).join('\n')}`
    : '';
  const sourceBlock = input.sources.length
    ? `\n\n**Fuente:**\n${input.sources.map((source) => `- ${source}`).join('\n')}`
    : '';

  return [
    header,
    `**Que hago ahorita:**\n${firstTest}`,
    `**Puedo moverlo o no:**\n${input.decision}`,
    `**Que reviso primero:**\n${likely}`,
    `**Que foto/codigo/letra necesito:**\n${needs}`,
    warningBlock,
    sourceBlock,
  ].filter(Boolean).join('\n\n');
}

export function formatFromDiagnoseResult(
  result: DiagnoseResult,
  unitLabel: string,
  sources: string[],
  isFollowUp = false,
): string {
  return formatFieldMechanicDiagnosis({
    unitLabel,
    decision: result.decision_operativa || (result.prioridad === 'ALTA'
      ? 'NO OPERAR hasta completar la prueba crítica.'
      : 'Continuar solo si niveles, temperatura y frenos están normales.'),
    likelyCauses: result.causas_probables,
    nextTests: result.checklist_diagnostico,
    warnings: result.advertencias ?? [],
    question: result.pregunta_clave || '¿Qué lectura o prueba puedes confirmar ahora?',
    sources,
    isFollowUp,
  });
}

export function formatFromRuleResult(
  rule: DiagnosticRuleResult,
  unitLabel: string,
  extraSources: string[] = [],
  isFollowUp = true,
): string {
  return formatFieldMechanicDiagnosis({
    unitLabel,
    decision: rule.operationalDecision,
    likelyCauses: rule.likelyCauses,
    nextTests: rule.nextTests,
    warnings: rule.warnings,
    question: rule.question,
    sources: uniqueStrings([rule.source, ...extraSources]),
    isFollowUp,
  });
}

export function resolveDiagnosticRule(input: DiagnosticRuleInput) {
  return applyDiagnosticRules(input);
}

export function unitDisplayLabel(selectedUnit: string, effectiveEquipo: string): string {
  return selectedUnit !== 'General' ? extractUnitLabel(selectedUnit) : extractUnitLabel(effectiveEquipo);
}

export async function executeDiagnosisFlow(options: {
  equipo: string;
  message: string;
  caseState: DiagnosticCaseState | null;
  source: DiagnosticCaseState['source'];
  codigo_falla?: string;
  extraSources?: string[];
  diagnose: (params: {
    equipo: string;
    sintoma: string;
    contexto?: string;
    codigo_falla?: string;
  }) => Promise<DiagnoseResult>;
}): Promise<{
  merged: DiagnoseResult;
  caseState: DiagnosticCaseState;
  rule: DiagnosticRuleResult | null;
  sources: string[];
}> {
  const { equipo, message, caseState, source, codigo_falla, extraSources = [], diagnose } = options;

  const ruleInput: DiagnosticRuleInput = {
    equipo,
    message,
    previousContext: caseState
      ? buildCaseContextPrompt(caseState, message)
      : undefined,
    alreadyChecked: caseState?.alreadyChecked,
  };
  const rule = applyDiagnosticRules(ruleInput);
  const ruleBlock = rule ? ruleResultToContextBlock(rule) : undefined;
  const contexto = buildCaseContextPrompt(caseState, message, ruleBlock);

  const aiResult = await diagnose({
    equipo,
    sintoma: message,
    contexto,
    codigo_falla,
  });

  const merged = mergeDiagnoseWithRule(aiResult, rule);
  let nextCase = caseFromDiagnose(equipo, merged, message, source, caseState);
  if (rule) {
    nextCase = applyRuleToCase(nextCase, rule, message);
  }

  const sources = uniqueStrings([
    ...(rule ? [rule.source] : []),
    ...extraSources,
    `Diagnóstico IA (${equipo})`,
  ]);

  return { merged, caseState: nextCase, rule, sources };
}
