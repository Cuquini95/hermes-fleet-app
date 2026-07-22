/**
 * @fileoverview Monolithic by design (> 400 LOC).
 * Chat UI + streaming + tool-call rendering. Stateful message list + input + scroll behavior that do not split cleanly; helper hooks extracted where they made sense.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../stores/auth-store';
import { useEquipmentList } from '../../hooks/useEquipmentList';
import {
  diagnose,
  photoToFailure,
  manualLookup,
  searchParts,
  findDiagram,
  getFaultCodePages,
  type DiagnoseResult,
  type PhotoAnalysisResult,
  type ManualLookupResult,
  type PartResult,
  type DiagramResult,
} from '../../lib/hermes-api';
import { hermesApiUrl } from '../../lib/hermes-api-base';
import { fileToBase64 } from '../../lib/photo-upload';
import { buildHermesWhatsAppResponse, isWhatsAppContactQuery } from '../../lib/hermes-contact';
import { sendIntakeChatMessage, shouldUseBusinessIntake } from '../../lib/intake-chat';
import {
  buildPartsSearchTerms,
  dedupePartResults,
  extractFaultCode as extractFaultCodeFromMessage,
  extractPartsSearchTerm,
  isPartsLookupQuery,
  withChatTimeout,
} from '../../lib/chat-intelligence';
import {
  caseFromPhoto,
  executeDiagnosisFlow,
  formatFromDiagnoseResult,
  isUnrelatedTopic,
  type DiagnosticCaseState,
  unitDisplayLabel,
} from '../../lib/diagnostic-case';
import {
  analyzeMechanicIntake,
  expandMechanicSlang,
  GUIDED_INTAKE_OPTIONS,
  isGuidedIntakeSelection,
  isMechanicDiagnosticMessage,
  type GuidedIntakeOption,
} from '../../lib/mechanic-intake';
import {
  formatFaultCodeManualPages,
  formatFaultCodeManualPagesUnavailable,
} from '../../lib/manual-pages';
import { lookupFaultCode, buildFaultCodeSintoma } from '../../data/fault-codes';
import type { ChatMessage } from '../../types/chat';
import ChatBubble from './ChatBubble';
import TypingIndicator from './TypingIndicator';
import ChatInput from './ChatInput';

// ─── Mock fallbacks (used when VPS API is unreachable) ───────────────────────

const HERMES_WHATSAPP_NUMBER =
  import.meta.env.VITE_HERMES_WHATSAPP_NUMBER || '+50765976682';

type PartsSearchContext = {
  equipo: string;
  description: string;
  part_number: string;
};

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatInitialDiagnoseWithParts(result: DiagnoseResult, unitLabel: string, sources: string[]): string {
  const body = formatFromDiagnoseResult(result, unitLabel, sources, false);
  const seenOem = new Set<string>();
  const partes = (result.partes_probables ?? [])
    .filter((p) => {
      const obj = (typeof p === 'object' && p !== null) ? p as Record<string, unknown> : null;
      const oem = String(obj?.oem || obj?.part_number || p || '');
      if (!oem || seenOem.has(oem)) return false;
      seenOem.add(oem);
      return true;
    })
    .map((p) => {
      if (typeof p === 'object' && p !== null) {
        const obj = p as Record<string, unknown>;
        const oem = obj.oem || obj.part_number || '';
        const desc = obj.descripcion || obj.description || '';
        const precio = obj.precio_estimado || '';
        return `• ${oem} — ${desc}${precio ? ` | ${precio}` : ''}`;
      }
      return `• ${p}`;
    }).join('\n');

  const partesSection = partes
    ? `\n\n**Partes sugeridas:**\n${partes}`
    : '\n\n**Partes sugeridas:**\nNo reemplazar partes todavía. Primero confirma arnés, conectores y valores de prueba.';

  return `${body}${partesSection}`;
}

function splitTopLevelList(value: string): string[] {
  const items: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of value) {
    if (char === '(') depth += 1;
    if (char === ')' && depth > 0) depth -= 1;

    if ((char === ',' || char === ';') && depth === 0) {
      if (current.trim()) items.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) items.push(current.trim());
  return items.filter((item) => item.length > 0);
}

function splitSentences(value: string): string[] {
  return value
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ0-9])/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function bulletLines(items: string[]): string {
  return items.map((item) => `- ${item.replace(/[.。]+$/, '')}`).join('\n');
}

function formatDamageSummary(value: string): string {
  const trimmed = value.trim();
  const alertMatch = trimmed.match(/^(Alertas?\s+activas?:)\s*(.+)$/i);

  if (alertMatch?.[1] && alertMatch[2]) {
    return `**Tipo de daño:** ${alertMatch[1]}\n${bulletLines(splitTopLevelList(alertMatch[2]))}`;
  }

  const sentences = splitSentences(trimmed);
  if (sentences.length > 1) {
    return `**Tipo de daño:**\n${bulletLines(sentences)}`;
  }

  return `**Tipo de daño:** ${trimmed}`;
}

function formatRecommendation(value: string): string {
  const items = splitSentences(value.trim());
  if (items.length > 1) {
    return `**Recomendación:**\n${bulletLines(items)}`;
  }
  return `**Recomendación:** ${value.trim()}`;
}

function formatPhotoAnalysis(result: PhotoAnalysisResult): string {
  return [
    '📷 **Análisis de imagen**',
    `**Componente:** ${result.componente_probable}`,
    formatDamageSummary(result.tipo_de_dano),
    `**Severidad:** ${result.severidad}`,
    formatRecommendation(result.recomendacion_inicial),
  ].join('\n\n');
}

function hadActiveCase(caseState: DiagnosticCaseState | null): boolean {
  return Boolean(caseState?.findings.length || caseState?.summary || caseState?.safetyLock?.locked);
}

function formatSourceFooter(lines: Array<string | null | undefined>): string {
  const normalized = lines
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line));

  if (normalized.length === 0) return '';
  return `\n\n**Fuente:**\n${normalized.map((line) => `- ${line}`).join('\n')}`;
}

function clearCaseIfUnrelated(text: string, caseRef: { current: DiagnosticCaseState | null }) {
  if (isUnrelatedTopic(text, caseRef.current)) {
    caseRef.current = null;
  }
}

function formatAiUnavailable(equipo: string, query: string): string {
  return `No pude conectar con el diagnostico IA para **${equipo || 'este equipo'}**.\n\nConsulta enviada: ${query}\n\nNo voy a inventar una respuesta generica. Reintenta con conexion al servidor o valida el codigo en el manual antes de cambiar partes.`;
}

function formatPhotoAiUnavailable(): string {
  return 'No hay diagnostico visual real disponible en este momento. No voy a inventar una lectura de la foto; revisa el equipo manualmente o activa el servicio de vision antes de usar imagenes para diagnostico.';
}

function formatPrecioMXN(price: number): string {
  if (!price || price === 0) return 'Sin precio';
  return `$${price.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;
}

function formatSearchParts(results: PartResult[], query: string): string {
  if (results.length === 0) {
    return `📦 **Resultados para '${query}'**\n\nNo se encontraron partes con ese criterio.`;
  }
  const lines = results
    .map((p) => {
      const stock = p.stock_quantity > 0 ? `Stock: ${p.stock_quantity}` : 'Sin stock';
      const precio = formatPrecioMXN(p.unit_price);
      const ubicacion = p.location ? ` | 📍 ${p.location}` : '';
      const alts = p.alternatives?.length > 0 ? `\n  ↳ _Alternativas: ${p.alternatives.slice(0,3).join(', ')}_` : '';
      return `• **${p.part_number}** — ${p.description} | ${stock} | ${precio}${ubicacion}${alts}`;
    })
    .join('\n');
  return `📦 **Resultados para '${query}'**\n\n${lines}\n\nPuedes escribir **diagrama** para buscar el plano asociado.`;
}

async function searchPartsAcrossTerms(
  terms: string[],
  equipo?: string,
  signal?: AbortSignal,
): Promise<PartResult[]> {
  if (terms.length === 0) return [];

  const settled = await Promise.allSettled(
    terms.map((term) => searchParts(term, equipo, signal))
  );
  const successful = settled
    .filter((result): result is PromiseFulfilledResult<PartResult[]> => result.status === 'fulfilled')
    .map((result) => result.value);

  if (successful.length === 0) {
    const failed = settled.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    throw failed?.reason ?? new Error('Parts catalog unavailable');
  }

  return rankPartResults(dedupePartResults(successful.flat()), terms).slice(0, 8);
}

function normalizePartText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function scorePartResult(part: PartResult, terms: string[]): number {
  const haystack = normalizePartText([
    part.part_number,
    part.description,
    part.location,
    ...(part.alternatives ?? []),
  ].filter(Boolean).join(' '));

  let score = 0;
  for (const rawTerm of terms) {
    const term = normalizePartText(rawTerm).trim();
    if (!term) continue;

    if (haystack.includes(term)) {
      score += 20 + Math.min(term.length, 12);
    }

    for (const token of term.split(/[^a-z0-9]+/g).filter((value) => value.length >= 3)) {
      if (haystack.includes(token)) {
        score += 4 + Math.min(token.length, 6);
      }
    }
  }

  return score;
}

function rankPartResults(parts: PartResult[], terms: string[]): PartResult[] {
  return [...parts].sort((left, right) => {
    const diff = scorePartResult(right, terms) - scorePartResult(left, terms);
    if (diff !== 0) return diff;
    return left.part_number.localeCompare(right.part_number);
  });
}

function formatPartsNotFound(query: string, terms: string[], equipo: string): string {
  const unitInfo = equipo !== 'General' ? ` para ${(equipo.split('/')[0] ?? equipo).trim()}` : '';
  const tried = terms.length > 1 ? `\n\nBusque tambien: ${terms.slice(1, 5).join(', ')}.` : '';

  return `📦 **Busqueda de parte${unitInfo}: '${query}'**\n\nNo encontre un numero de parte en el catalogo con ese criterio.${tried}\n\nPrueba con otro nombre del componente, el sistema, o escribe **diagrama ${query}** para buscar el plano.`;
}

function formatManualLookup(result: ManualLookupResult, equipo: string, tema: string): string {
  const pasos = result.pasos_tecnicos.map((p, i) => `${i + 1}. ${p}`).join('\n');
  const herramientas = result.herramientas_requeridas.join(', ');
  const torque = result.torque_specs ? `\n\n**Torque:** ${result.torque_specs}` : '';
  const sourceFooter = formatSourceFooter([
    `Manual tecnico (${equipo || 'equipo no especificado'})`,
    `Tema consultado: ${tema}`,
  ]);
  void sourceFooter;
  return `📖 **Procedimiento**\n\n${result.extracto}\n\n**Pasos:**\n${pasos}\n\n**Herramientas:** ${herramientas}${torque}`;
}

const DIAGRAM_GENERIC_TERMS = new Set([
  'assembly',
  'assy',
  'related',
  'parts',
  'part',
  'catalog',
  'catalogo',
]);

function normalizeDiagramToken(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function diagramMatchesSearchTerm(diag: DiagramResult, searchTerm: string): boolean {
  const section = normalizeDiagramToken(diag.section ?? '');
  if (!section) return false;

  const tokens = normalizeDiagramToken(searchTerm)
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 4 && !DIAGRAM_GENERIC_TERMS.has(token) && !/^\d+$/.test(token));

  return tokens.some((token) => section.includes(token));
}

function formatDiagramLookup(
  diag: DiagramResult,
  searchTerm: string,
  options: { allowApproximate?: boolean; requireSectionMatch?: boolean } = {},
): string {
  const matchesSearch = diagramMatchesSearchTerm(diag, searchTerm);
  if (options.requireSectionMatch && !matchesSearch && !options.allowApproximate) {
    return '';
  }

  if (diag.found && diag.image_url && diag.page !== undefined) {
    const nextPage = diag.page + 1;
    const title = matchesSearch
      ? `Manual / diagrama - ${diag.section ?? searchTerm}`
      : `Diagrama aproximado - ${diag.section ?? searchTerm}`;
    const note = matchesSearch
      ? ''
      : `\n\nCoincidencia aproximada para **${searchTerm}**. Valida el P/N en la lista antes de pedir o cambiar piezas.`;
    return (
      `📐 **${title}**${note}\n\n` +
      `![Diagrama](${hermesApiUrl(diag.image_url)})\n\n` +
      `📋 **Lista de partes**\n![Partes](${hermesApiUrl(`/diagrams/page/${diag.pdf}/${nextPage}`)})`
    );
  }

  if (diag.found && diag.image_url) {
    const title = matchesSearch
      ? `Manual / diagrama - ${diag.section ?? searchTerm}`
      : `Diagrama aproximado - ${diag.section ?? searchTerm}`;
    const note = matchesSearch
      ? ''
      : `\n\nCoincidencia aproximada para **${searchTerm}**. Valida el P/N antes de pedir o cambiar piezas.`;
    return `📐 **${title}**${note}\n\n![Diagrama](${hermesApiUrl(diag.image_url)})`;
  }

  return '';
}

function formatContextualManualNotFound(ctx: PartsSearchContext): string {
  const unitInfo = ctx.equipo ? ` para ${(ctx.equipo.split('/')[0] ?? ctx.equipo).trim()}` : '';
  const label = ctx.description || ctx.part_number;

  return (
    `📖 **Manual${unitInfo} - ${label}**\n\n` +
    `No encontre una pagina o diagrama indexado del manual para **${label}**.\n\n` +
    `Si encontre esta referencia de catalogo: **${ctx.part_number}** - ${ctx.description}.\n\n` +
    `Antes de comprar o cambiar piezas, confirma aplicacion con el S/N del motor/equipo o busca el P/N exacto en el manual fisico/proveedor.`
  );
}

// ─── Intent detection ────────────────────────────────────────────────────────

function buildDiagramSearchTerms(primary: string, context?: PartsSearchContext): string[] {
  const terms = new Set<string>();

  const add = (value?: string) => {
    const term = value?.trim();
    if (!term) return;
    terms.add(term);
    for (const expanded of buildPartsSearchTerms(term)) {
      const cleaned = expanded.trim();
      if (cleaned) terms.add(cleaned);
    }
  };

  add(primary);
  add(context?.description);
  add(context?.part_number);

  return Array.from(terms).slice(0, 12);
}

async function findDiagramAcrossTerms(
  equipo: string,
  terms: string[],
): Promise<{ diagram: DiagramResult | null; searchTerm: string; exactMatch: boolean }> {
  let fallback: { diagram: DiagramResult; searchTerm: string; exactMatch: boolean } | null = null;

  for (const term of terms) {
    try {
      const diagram = await findDiagram(equipo, term);
      if (!diagram.found) continue;

      const exactMatch = diagramMatchesSearchTerm(diagram, term);
      if (exactMatch) {
        return { diagram, searchTerm: term, exactMatch: true };
      }

      if (!fallback) {
        fallback = { diagram, searchTerm: term, exactMatch: false };
      }
    } catch {
      // Keep trying alternate deterministic terms before giving up.
    }
  }

  if (fallback) return fallback;
  return { diagram: null, searchTerm: terms[0] ?? '', exactMatch: false };
}

function isPartNumber(text: string): boolean {
  // Match common OEM formats:
  // Komatsu: 600-XXX-XXXX, 6261-11-3200, 01010-81020
  // CAT: 223-1335, 1R-0749, 253-0616
  // Doosan: K9003166, 65.26201-7076B, 300516-00020
  // Mack: 22398223, 21870635
  const t = text.toUpperCase().trim();
  return /\d{2,}-\d{2,}/.test(t) || /^[A-Z]?\d{7,}$/.test(t) || /^\d{2,}\.\d{4,}/.test(t) || /^[A-Z]\d{3,}-\d{3,}/.test(t);
}

function isManualQuery(text: string): boolean {
  return /manual|procedimiento|cómo|como|pasos/i.test(text);
}

function isDiagramQuery(text: string): boolean {
  return /diagrama|diagram|esquema|plano|dibujo/i.test(text);
}

function isManualPagesQuery(text: string): boolean {
  return /ver\s+manual|p[aá]ginas?\s+manual|abrir\s+manual|manual\s+p[aá]gina|ver\s+p[aá]gina|workshop\s+manual|ver\s+en\s+manual/i.test(text);
}

/** Extract search subject from a diagram request: "diagrama sistema hidráulico" → "sistema hidráulico" */
function extractDiagramSubject(text: string): string {
  return text
    .replace(/diagrama|diagram|esquema|plano|dibujo/gi, '')
    .replace(/\b(de|del|el|la|los|las)\b/gi, '')
    .trim();
}

/**
 * Detect fault/error codes across all fleet machine formats:
 * Komatsu TM (HM400): 15K0MW, 25K0MW, 1AK0LW, AETMKX, AEBRKX
 * Komatsu Engine:     E002, E028, E190, E-28
 * CAT:                E0750, CA-001
 * Doosan:             C-123, A-456, C-10, C-100
 * OBD-II:             P0420, U0001
 */
function extractFaultCode(text: string): string | null {
  return extractFaultCodeFromMessage(text);
}

function isFaultCodeQuery(text: string): boolean {
  // Fault code detected OR user is explicitly asking about a code
  return extractFaultCode(text) !== null ||
    /\bcodigo\b|\bcódigo\b|\berror\b|\bfault\b|\balerta\b/i.test(text);
}


function extractPartNumber(text: string): string | null {
  // Extract the part number from mixed text like "223-1335 diagrama"
  const match = text.match(/([A-Z]?\d{2,}-\d{2,}[-\d]*|\d{7,}|[A-Z]\d{3,}-\d{3,}[\w]*|\d{2,}\.\d{4,}[-\w]*)/i);
  return match?.[1] ?? null;
}

/** Detect equipment model from user message text when selector is "General" */
function detectEquipmentFromText(text: string): string {
  const models: [RegExp, string][] = [
    [/D155/i, 'Komatsu D155AX-6'],
    [/D65/i, 'Komatsu D65EX-16'],
    [/HM400/i, 'Komatsu HM400-3'],
    [/HM\s?400/i, 'Komatsu HM400-3'],
    [/CAT\s?740|740B/i, 'CAT 740B'],
    [/DX\s?360/i, 'Doosan DX360LCA'],
    [/DX\s?340/i, 'Doosan DX340LC'],
    [/DX\s?225/i, 'Doosan DX225LC'],
    [/DL\s?420/i, 'Doosan DL420A'],
    [/Mack|GR84|GR64/i, 'Mack GR84B 8x4'],
    [/EPAK/i, 'CAT 740B'],
    [/EPTK/i, 'Komatsu D155AX-6'],
    [/EPCF/i, 'Doosan DL420A'],
    [/EPEX/i, 'Doosan DX340LC'],
    [/ULTRATK/i, 'Mack GR84B 8x4'],
  ];
  for (const [pattern, model] of models) {
    if (pattern.test(text)) return model;
  }
  return 'General';
}

// ─── Greeting ────────────────────────────────────────────────────────────────

function buildGreeting(userName: string): ChatMessage {
  const content = `Hola ${userName}. Soy Hermes, tu asistente de flota.\n\nPuedo ayudarte con:\n• Diagnostico de fallas — envia foto o describe el sintoma\n• Partes inteligentes — escribe _part number accumulator_ o _numero de parte del acumulador_\n• Diagramas — escribe _diagrama [sistema]_ para ver el plano\n• Manuales y torques — procedimientos de reparacion\n• Codigos de falla — significado, causa y revision\n• Registro operativo — fallas, evidencia, fletes y notas para OpsOS\n• WhatsApp — escribe _whatsapp_ para obtener el numero Hermes\n\n¿En qué te puedo ayudar?`;
  return {
    id: 'greeting',
    role: 'hermes',
    content,
    timestamp: new Date(),
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function HermesChat() {
  const userName = useAuthStore((s) => s.userName);
  const assignedUnits = useAuthStore((s) => s.assignedUnits);
  const equipment = useEquipmentList();

  const defaultUnit: string =
    assignedUnits.length > 0 ? (assignedUnits[0] ?? 'General') : 'General';

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    buildGreeting(userName || 'Operador'),
  ]);
  const [selectedUnit, setSelectedUnit] = useState<string>(defaultUnit);
  const [isLoading, setIsLoading] = useState(false);
  const [guidedOptions, setGuidedOptions] = useState<GuidedIntakeOption[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track the last fault code context so "ver manual" can look up pages
  const lastFaultCodeRef = useRef<{ code: string; equipo: string } | null>(null);

  // Track the last parts search so bare "diagrama" can use context
  const lastPartsSearchRef = useRef<PartsSearchContext | null>(null);

  // Track the active diagnostic case so mechanic follow-ups keep context.
  const lastDiagnosisContextRef = useRef<DiagnosticCaseState | null>(null);
  const pendingMechanicIntakeRef = useRef<{ originalText: string } | null>(null);

  const handleUnitChange = useCallback((unit: string) => {
    setSelectedUnit(unit);
    lastDiagnosisContextRef.current = null;
    pendingMechanicIntakeRef.current = null;
    setGuidedOptions([]);
  }, []);

  function scrollToBottom() {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = useCallback(
    async (text: string, photo?: File) => {
      const pendingMechanicIntake = pendingMechanicIntakeRef.current;
      if (!photo && pendingMechanicIntake && isGuidedIntakeSelection(text)) {
        text = `${text} - ${pendingMechanicIntake.originalText}`;
      }
      pendingMechanicIntakeRef.current = null;
      setGuidedOptions([]);

      const photoUrl = photo ? URL.createObjectURL(photo) : undefined;

      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: text,
        photo_url: photoUrl,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      let responseText: string;

      try {
        clearCaseIfUnrelated(text, lastDiagnosisContextRef);

        // Detect fault code early — before part number check (some codes look like part numbers)
        const faultCode = extractFaultCode(text);
        const mechanicIntake = analyzeMechanicIntake(text, {
          hasActiveCase: hadActiveCase(lastDiagnosisContextRef.current),
          hasPhoto: Boolean(photo),
        });
        const mechanicDiagnosticText = expandMechanicSlang(text);
        const textIsMechanicDiagnostic = isMechanicDiagnosticMessage(text);

        if (
          !photo
          && !faultCode
          && !isPartNumber(text)
          && !isPartsLookupQuery(text)
          && !isManualPagesQuery(text)
          && !isManualQuery(text)
          && !isDiagramQuery(text)
          && mechanicIntake.shouldAsk
        ) {
          pendingMechanicIntakeRef.current = { originalText: text };
          setGuidedOptions(mechanicIntake.options);
          responseText = mechanicIntake.responseText;
        } else if (photo) {
          const foto_base64 = await fileToBase64(photo);
          const selectedEquipment = equipment.find((e) => e.unit_id === selectedUnit);
          const photoEquipo = selectedUnit !== 'General'
            ? selectedEquipment
              ? `${selectedUnit} / ${selectedEquipment.model}`
              : selectedUnit
            : 'General';
          if (shouldUseBusinessIntake(text, true)) {
            try {
              const result = await sendIntakeChatMessage({
                text,
                selectedUnit,
                userName,
                photoBase64: foto_base64,
                photoMimeType: photo.type || 'image/jpeg',
                photoName: photo.name,
              });
              responseText = result.reply_text || 'Registro operativo recibido en OpsOS.';
            } catch {
              try {
                const result = await withChatTimeout((signal) => photoToFailure({
                  foto_base64,
                  equipo: photoEquipo !== 'General' ? photoEquipo : undefined,
                  contexto: text || 'foto enviada al chat',
                  media_type: photo.type || 'image/jpeg',
                }, signal), 25_000);
                responseText = formatPhotoAnalysis(result);
                lastDiagnosisContextRef.current = caseFromPhoto(photoEquipo, result, text || 'foto enviada al chat');
              } catch {
                responseText = formatPhotoAiUnavailable();
              }
            }
          } else {
            try {
              const result = await withChatTimeout((signal) => photoToFailure({
                foto_base64,
                equipo: photoEquipo !== 'General' ? photoEquipo : undefined,
                contexto: text || 'foto enviada al chat',
                media_type: photo.type || 'image/jpeg',
              }, signal), 25_000);
              responseText = formatPhotoAnalysis(result);
              lastDiagnosisContextRef.current = caseFromPhoto(photoEquipo, result, text || 'foto enviada al chat');
            } catch {
              responseText = formatPhotoAiUnavailable();
            }
          }
        } else if (isWhatsAppContactQuery(text)) {
          responseText = buildHermesWhatsAppResponse(HERMES_WHATSAPP_NUMBER);
        } else if (!faultCode && !isPartNumber(text) && !isPartsLookupQuery(text) && !textIsMechanicDiagnostic && shouldUseBusinessIntake(text, false)) {
          try {
            const result = await sendIntakeChatMessage({
              text,
              selectedUnit,
              userName,
            });
            responseText = result.reply_text || 'Registro operativo recibido en OpsOS.';
          } catch {
            const selectedEquipment = equipment.find((e) => e.unit_id === selectedUnit);
            const effectiveUnit = selectedUnit !== 'General'
              ? selectedEquipment
                ? `${selectedUnit} / ${selectedEquipment.model}`
                : selectedUnit
              : detectEquipmentFromText(text);

            try {
              const unitLabel = unitDisplayLabel(selectedUnit, effectiveUnit);
              const isFollowUp = hadActiveCase(lastDiagnosisContextRef.current);
              const flow = await withChatTimeout((signal) => executeDiagnosisFlow({
                equipo: effectiveUnit,
                message: mechanicDiagnosticText,
                caseState: lastDiagnosisContextRef.current,
                source: 'text',
                diagnose: (params) => diagnose(params, signal),
              }), 25_000);
              lastDiagnosisContextRef.current = flow.caseState;
              responseText = isFollowUp
                ? formatFromDiagnoseResult(flow.merged, unitLabel, flow.sources, true)
                : formatInitialDiagnoseWithParts(flow.merged, unitLabel, flow.sources);
            } catch {
              responseText = formatAiUnavailable(selectedUnit !== 'General' ? selectedUnit : effectiveUnit, text);
            }
          }
        } else if (faultCode || (isFaultCodeQuery(text) && !isPartNumber(text))) {
          // ── Fault code path ─────────────────────────────────────────────────
          const selectedEquipment = equipment.find((e) => e.unit_id === selectedUnit);
          const detectedModel = detectEquipmentFromText(text);
          const effectiveUnit = selectedUnit !== 'General'
            ? `${selectedUnit} / ${selectedEquipment?.model ?? selectedUnit}`
            : detectedModel;

          // If no unit selected and model can't be detected from text, still try but warn
          const noContext = effectiveUnit === 'General';

          const userContext = faultCode
            ? text.replace(new RegExp(faultCode.replace('-', '\\-'), 'gi'), '').trim()
            : text;

          // Look up the fault code in our local database first
          const knownCode = faultCode ? lookupFaultCode(faultCode) : null;

          const sintomaForVPS = faultCode && knownCode
            // Known code: give AI the official description + system context
            ? buildFaultCodeSintoma(faultCode, knownCode, userContext || undefined)
            : faultCode
            // Unknown code: instruct AI to search the fault code table in the manual
            ? `[FAULT CODE LOOKUP] Código de falla: ${faultCode}.\n` +
              `Busca este código en la sección "Troubleshooting by failure code" del manual de servicio del equipo.\n` +
              `Indica: (1) qué sistema o componente identifica este código, ` +
              `(2) causas probables, (3) procedimiento de diagnóstico.\n` +
              (userContext ? `Contexto adicional: ${userContext}` : '')
            : text;

          const manualPagesPromise = faultCode
            ? withChatTimeout(
              (signal) => getFaultCodePages(effectiveUnit, faultCode, signal),
              12_000,
            ).catch(() => null)
            : Promise.resolve(null);

          try {
            const unitLabel = unitDisplayLabel(selectedUnit, effectiveUnit !== 'General' ? effectiveUnit : (detectedModel !== 'General' ? detectedModel : faultCode ?? 'General'));
            const isFollowUp = hadActiveCase(lastDiagnosisContextRef.current);
            const [flow, manualPages] = await Promise.all([
              withChatTimeout((signal) => executeDiagnosisFlow({
                equipo: effectiveUnit,
                message: expandMechanicSlang(sintomaForVPS),
                caseState: lastDiagnosisContextRef.current,
                source: 'fault_code',
                codigo_falla: faultCode ?? undefined,
                extraSources: faultCode ? [`Código consultado: ${faultCode}`] : [],
                diagnose: (params) => diagnose(params, signal),
              }), 25_000),
              manualPagesPromise,
            ]);
            lastDiagnosisContextRef.current = flow.caseState;
            const codeHeader = knownCode
              ? `🔴 **Código ${faultCode}** — ${knownCode.descripcion}\n📍 Sistema: ${knownCode.sistema}\n${knownCode.accion ? `⚠️ **${knownCode.accion}**\n` : ''}\n`
              : faultCode
              ? `🔴 **Código ${faultCode}** — consultando manual...\n\n`
              : '';
            responseText = codeHeader + (isFollowUp
              ? formatFromDiagnoseResult(flow.merged, unitLabel, flow.sources, true)
              : formatInitialDiagnoseWithParts(flow.merged, unitLabel, flow.sources));
            if (noContext) {
              responseText = `⚠️ _Selecciona tu equipo arriba para resultados más precisos con este código._\n\n` + responseText;
            }
            if (faultCode) {
              lastFaultCodeRef.current = { code: faultCode, equipo: effectiveUnit };
              responseText += manualPages
                ? formatFaultCodeManualPages(manualPages, faultCode)
                : formatFaultCodeManualPagesUnavailable(faultCode);
            }
          } catch {
            responseText = formatAiUnavailable(selectedUnit !== 'General' ? selectedUnit : effectiveUnit, text);
            if (faultCode) {
              lastFaultCodeRef.current = { code: faultCode, equipo: effectiveUnit };
              const manualPages = await manualPagesPromise;
              responseText += manualPages
                ? formatFaultCodeManualPages(manualPages, faultCode)
                : formatFaultCodeManualPagesUnavailable(faultCode);
            }
          }
        } else if (isPartNumber(text) || extractPartNumber(text) || isPartsLookupQuery(text)) {
          // Part number detected — search catalog first
          const directPartNumber = extractPartNumber(text);
          const pn = directPartNumber ?? extractPartsSearchTerm(text);
          const searchTerms = directPartNumber ? [directPartNumber] : buildPartsSearchTerms(text);
          const wantsDiagram = isDiagramQuery(text);

          // Detect equipment: selected unit > text detection > part number format
          const selectedEquip = equipment.find((e) => e.unit_id === selectedUnit);
          let equipUnit = selectedUnit !== 'General'
            ? `${selectedUnit} / ${selectedEquip?.model ?? selectedUnit}`
            : detectEquipmentFromText(text);

          // Last resort: detect brand from part number format
          if (equipUnit === 'General') {
            if (/^6\d{3}-/.test(pn) || /^0\d{4}-/.test(pn)) equipUnit = 'Komatsu HM400-3';
            else if (/^7\d{2}-\d{2}-/.test(pn)) equipUnit = 'Komatsu D155AX-6'; // 707-xx-xxxxx seal kits
            else if (/^\d{3}-\d{4}/.test(pn)) equipUnit = 'CAT 740B';
            else if (/^[A-Z]\d{6,}/.test(pn)) equipUnit = 'Doosan DX360LCA';
            else if (/^\d{8}$/.test(pn)) equipUnit = 'Mack GR84B 8x4';
          }

          // Final fallback: use last parts search context (e.g. "7861-93-1812 diagrama" after "7861-93-1812 on HM400-3")
          if (equipUnit === 'General' && lastPartsSearchRef.current?.equipo) {
            equipUnit = lastPartsSearchRef.current.equipo;
          }

          try {
            const results = await searchPartsAcrossTerms(searchTerms, equipUnit !== 'General' ? equipUnit : undefined);
            const first = results[0];
            if (first) {
              responseText = formatSearchParts(results, pn) + formatSourceFooter([
                equipUnit !== 'General' ? `Catalogo de partes (${equipUnit})` : 'Catalogo de partes Hermes',
                ...results.slice(0, 3).map((part) => `P/N ${part.part_number} - ${part.description}`),
              ]);
              // Store context so a follow-up "diagrama" knows what to look for
              const diagEquipForRef = equipUnit !== 'General' ? equipUnit
                : (first.compatible_units?.[0] ?? '');
              lastPartsSearchRef.current = {
                equipo: diagEquipForRef,
                description: first.description ?? pn,
                part_number: first.part_number ?? pn,
              };
              if (wantsDiagram) {
                let diagEquip = equipUnit;
                const firstCompatible = first.compatible_units?.[0];
                if (diagEquip === 'General' && firstCompatible) {
                  diagEquip = firstCompatible;
                }
                // Use description as search term (e.g. "Injector") — far more reliable
                // than the raw part number which may not exist in the local index files
                const diagTerms = buildDiagramSearchTerms(first.description ?? pn, {
                  equipo: diagEquip,
                  description: first.description ?? pn,
                  part_number: first.part_number ?? pn,
                });
                try {
                  const { diagram, searchTerm } = await findDiagramAcrossTerms(diagEquip, diagTerms);
                  const diag = diagram ?? ({ found: false } as DiagramResult);
                  const diagSearchTerm = searchTerm;
                  if (diagram?.found && diagram.image_url && diagram.page !== undefined) {
                    const nextPage = diagram.page + 1;
                    responseText += `\n\n📐 **Diagrama — ${diag.section ?? ''}**\n![Diagrama](${hermesApiUrl(diag.image_url)})\n\n📋 **Lista de Partes**\n![Partes](${hermesApiUrl(`/diagrams/page/${diag.pdf}/${nextPage}`)})`;
                  } else if (diag.found && diag.image_url) {
                    responseText += `\n\n📐 **Diagrama**\n![Diagrama](${hermesApiUrl(diag.image_url)})`;
                  } else {
                    responseText += `\n\n📐 **Diagrama**\nNo encontré un diagrama para _${diagSearchTerm}_. Ve a **Más → Diagramas** para explorar los planos disponibles.`;
                  }
                } catch {
                  responseText += `\n\n📐 **Diagrama**\nNo pude cargar el diagrama. Ve a **Más → Diagramas** para explorar los planos disponibles.`;
                }
              }
            } else {
              // Not in PocketBase catalog
              if (wantsDiagram) {
                // User wants a diagram — try to find one directly, don't fall into AI diagnose
                responseText = `📦 **Búsqueda: '${pn}'**\n\nNo encontré esta parte en el catálogo.`;
                try {
                  const diagramTerms = buildDiagramSearchTerms(pn, lastPartsSearchRef.current ?? undefined);
                  const { diagram } = await findDiagramAcrossTerms(equipUnit !== 'General' ? equipUnit : '', diagramTerms);
                  const diag = diagram ?? ({ found: false } as DiagramResult);
                  if (diag.found && diag.image_url && diag.page !== undefined) {
                    const nextPage = diag.page + 1;
                    responseText += `\n\n📐 **Diagrama — ${diag.section ?? ''}**\n![Diagrama](${hermesApiUrl(diag.image_url)})\n\n📋 **Lista de Partes**\n![Partes](${hermesApiUrl(`/diagrams/page/${diag.pdf}/${nextPage}`)})`;
                  } else {
                    responseText += `\n\n📐 Selecciona el equipo en el filtro de arriba e intenta de nuevo, o ve a **Más → Diagramas** para explorar los planos disponibles.`;
                  }
                } catch {
                  responseText += `\n\n📐 No pude cargar el diagrama. Ve a **Más → Diagramas** para explorar los planos disponibles.`;
                }
              } else {
                responseText = formatPartsNotFound(pn, searchTerms, equipUnit);
              }
            }
          } catch {
            responseText = `📦 **Búsqueda: '${pn}'**\n\nNo pude conectar con el servidor. Verifica tu conexión e intenta de nuevo.`;
          }
        } else if (isManualPagesQuery(text)) {
          // ── Workshop manual pages for last fault code ───────────────────────
          const ctx = lastFaultCodeRef.current;
          if (ctx) {
            try {
              const pages = await getFaultCodePages(ctx.equipo, ctx.code);
              responseText = formatFaultCodeManualPages(pages, ctx.code).trimStart();
            } catch {
              responseText = formatFaultCodeManualPagesUnavailable(ctx.code).trimStart();
            }
          } else {
            responseText = `📖 Primero consulta un código de falla y luego escribe _ver manual_ para abrir las páginas del manual de taller.`;
          }
        } else if (isDiagramQuery(text)) {
          // ── Standalone diagram request ──────────────────────────────────────
          const selectedEquip = equipment.find((e) => e.unit_id === selectedUnit);
          const equipForDiagram = selectedUnit !== 'General'
            ? `${selectedUnit} / ${selectedEquip?.model ?? selectedUnit}`
            : detectEquipmentFromText(text);
          const subject = extractDiagramSubject(text);

          // If user typed bare "diagrama" (no subject, General unit), fall back to last parts search context
          const ctx = lastPartsSearchRef.current;
          const resolvedEquip = (equipForDiagram !== 'General' ? equipForDiagram : null)
            ?? (subject === '' && ctx ? ctx.equipo : null)
            ?? equipForDiagram;
          const searchTerm = subject
            || (ctx ? ctx.description : '')
            || resolvedEquip;

          try {
            const diagramTerms = buildDiagramSearchTerms(searchTerm, ctx ?? undefined);
            const { diagram, searchTerm: resolvedSearchTerm } = await findDiagramAcrossTerms(
              resolvedEquip !== 'General' ? resolvedEquip : '',
              diagramTerms,
            );
            const diag = diagram ?? ({ found: false } as DiagramResult);
            const diagramResponse = formatDiagramLookup(diag, resolvedSearchTerm, {
              allowApproximate: subject === '' && Boolean(ctx),
              requireSectionMatch: subject === '' && Boolean(ctx),
            });
            if (diagramResponse) {
              responseText = diagramResponse;
            } else {
              const unitInfo = resolvedEquip !== 'General' ? ` para ${(resolvedEquip.split('/')[0] ?? resolvedEquip).trim()}` : '';
              responseText =
                `📐 **Diagramas${unitInfo}**\n\nNo encontré un diagrama específico para _${searchTerm || 'ese sistema'}_.\n\n` +
                `Prueba con términos como: _hidráulico_, _motor_, _transmisión_, _tren de rodaje_.\n\n` +
                `O ve a **Más → Diagramas** para ver todos los planos disponibles.`;
            }
          } catch {
            responseText = `📐 No pude cargar el diagrama. Ve a **Más → Diagramas** para explorar los planos disponibles.`;
          }
        } else if (isManualQuery(text)) {
          const selectedEquipment = equipment.find((e) => e.unit_id === selectedUnit);
          const manualEquipo = selectedUnit !== 'General' && selectedEquipment
            ? `${selectedUnit} / ${selectedEquipment.model}`
            : selectedUnit;
          const ctx = lastPartsSearchRef.current;
          if (ctx) {
            const searchTerms = buildDiagramSearchTerms(ctx.description, ctx);
            let diagramResponse = '';

            try {
              const { diagram, searchTerm } = await findDiagramAcrossTerms(ctx.equipo, searchTerms);
              const diag = diagram ?? ({ found: false } as DiagramResult);
              diagramResponse = formatDiagramLookup(diag, searchTerm, { requireSectionMatch: true });
            } catch {
              // Fall back to the catalog-grounded answer below.
            }

            responseText = diagramResponse || formatContextualManualNotFound(ctx);
          } else {
            try {
              const result = await withChatTimeout((signal) => manualLookup({
                equipo: manualEquipo,
                tema: text,
              }, signal));
              responseText = formatManualLookup(result, manualEquipo, text);
            } catch {
              responseText = `📖 **Procedimiento**\n\nNo pude acceder al manual en este momento. Consulta el manual físico o intenta de nuevo con conexión al servidor.`;
            }
          }
        } else {
          // ── General diagnose path ────────────────────────────────────────────
          const selectedEquipment = equipment.find((e) => e.unit_id === selectedUnit);
          const effectiveUnit = selectedUnit !== 'General'
            ? selectedEquipment
              ? `${selectedUnit} / ${selectedEquipment.model}`
              : selectedUnit
            : detectEquipmentFromText(text);

          try {
            const unitLabel = unitDisplayLabel(selectedUnit, effectiveUnit);
            const isFollowUp = hadActiveCase(lastDiagnosisContextRef.current);
            const flow = await withChatTimeout((signal) => executeDiagnosisFlow({
              equipo: effectiveUnit,
              message: mechanicDiagnosticText,
              caseState: lastDiagnosisContextRef.current,
              source: 'text',
              diagnose: (params) => diagnose(params, signal),
            }), 25_000);
            lastDiagnosisContextRef.current = flow.caseState;
            responseText = isFollowUp
              ? formatFromDiagnoseResult(flow.merged, unitLabel, flow.sources, true)
              : formatInitialDiagnoseWithParts(flow.merged, unitLabel, flow.sources);
          } catch {
            responseText = formatAiUnavailable(selectedUnit !== 'General' ? selectedUnit : effectiveUnit, text);
          }
        }
      } catch {
        responseText =
          'Lo siento, no pude procesar tu consulta. Verifica tu conexión o intenta de nuevo.';
      }

      const hermesMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'hermes',
        content: responseText,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, hermesMsg]);
      setIsLoading(false);
    },
    [selectedUnit, equipment, userName]
  );

  const handleGuidedOption = useCallback((option: GuidedIntakeOption) => {
    const originalText = pendingMechanicIntakeRef.current?.originalText || '';
    const followUpText = originalText ? `${option} - ${originalText}` : option;
    pendingMechanicIntakeRef.current = null;
    setGuidedOptions([]);
    void handleSend(followUpText);
  }, [handleSend]);

  return (
    <div className="flex flex-col h-full">
      {/* Unit selector */}
      <div className="px-4 py-2 flex items-center gap-2 border-b" style={{ borderColor: '#E5E7EB', backgroundColor: '#F1F5F9' }}>
        <span className="text-xs font-medium" style={{ color: '#6B7280' }}>
          Equipo:
        </span>
        <select
          value={selectedUnit}
          onChange={(e) => handleUnitChange(e.target.value)}
          className="text-sm font-medium rounded-full px-4 py-1 outline-none appearance-none cursor-pointer"
          style={{
            backgroundColor: '#1E3A8A',
            color: 'white',
          }}
        >
          <option value="General">General</option>
          {equipment.map((eq) => (
            <option key={eq.unit_id} value={eq.unit_id}>
              {eq.unit_id} — {eq.model}
            </option>
          ))}
        </select>
      </div>

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
        style={{ backgroundColor: '#F1F5F9' }}
      >
        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} />
        ))}
        {isLoading && <TypingIndicator />}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      {guidedOptions.length > 0 && (
        <div className="px-4 py-2 border-t bg-white" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(guidedOptions.length ? guidedOptions : [...GUIDED_INTAKE_OPTIONS]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleGuidedOption(option)}
                disabled={isLoading}
                className="shrink-0 rounded-full px-3 py-2 text-sm font-semibold"
                style={{
                  backgroundColor: '#1E3A8A',
                  color: 'white',
                  opacity: isLoading ? 0.65 : 1,
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}
      <ChatInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
