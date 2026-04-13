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
} from '../../lib/hermes-api';
import { fileToBase64 } from '../../lib/photo-upload';
import { readRange, SHEET_TABS } from '../../lib/sheets-api';
import { lookupFaultCode, buildFaultCodeSintoma } from '../../data/fault-codes';
import { TRANSPORT_UNITS } from '../../data/transport-units';
import type { ChatMessage } from '../../types/chat';
import ChatBubble from './ChatBubble';
import TypingIndicator from './TypingIndicator';
import ChatInput from './ChatInput';

// ─── Mock fallbacks (used when VPS API is unreachable) ───────────────────────

const MOCK_DIAGNOSE: DiagnoseResult = {
  causas_probables: [
    'Sello de cilindro desgastado',
    'Manguera de presión dañada',
    'Conexión hidráulica floja',
  ],
  checklist_diagnostico: [
    'Verificar nivel de aceite hidráulico',
    'Inspeccionar vástago del cilindro',
    'Revisar mangueras por agrietamiento',
    'Verificar presión del sistema',
  ],
  partes_probables: [
    'Kit sello cilindro — P/N 707-99-47570',
    'Manguera presión — P/N 207-62-71451',
    'O-ring set — P/N 07000-15135',
  ],
  prioridad: 'ALTA',
};

const MOCK_PHOTO_ANALYSIS: PhotoAnalysisResult = {
  componente_probable: 'Cilindro hidráulico de pluma',
  tipo_de_dano: 'Fuga externa por sello desgastado',
  severidad: 'Alta — requiere atención en < 8 horas',
  recomendacion_inicial:
    'Detener operación. Verificar nivel de aceite hidráulico. No operar hasta reparación. Preparar kit de sellos y manguera de respaldo.',
};

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatDiagnose(result: DiagnoseResult, equipo: string): string {
  const causas = result.causas_probables
    .map((c, i) => `${i + 1}. ${c}`)
    .join('\n');
  const checklist = result.checklist_diagnostico
    .map((c, i) => `${i + 1}. ${c}`)
    .join('\n');
  const partes = result.partes_probables.map((p) => {
    if (typeof p === 'object' && p !== null) {
      const obj = p as Record<string, unknown>;
      const oem = obj.oem || obj.part_number || '';
      const desc = obj.descripcion || obj.description || '';
      const precio = obj.precio_estimado || '';
      return `• ${oem} — ${desc}${precio ? ` | ${precio}` : ''}`;
    }
    return `• ${p}`;
  }).join('\n');

  return `🔍 **Diagnóstico para ${equipo}**\n\n**Causas probables:**\n${causas}\n\n**Checklist:**\n${checklist}\n\n**Partes sugeridas:**\n${partes}\n\n**Prioridad:** ${result.prioridad}`;
}

function formatPhotoAnalysis(result: PhotoAnalysisResult): string {
  return `📷 **Análisis de imagen**\n\n**Componente:** ${result.componente_probable}\n**Tipo de daño:** ${result.tipo_de_dano}\n**Severidad:** ${result.severidad}\n\n**Recomendación:** ${result.recomendacion_inicial}`;
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
  return `📦 **Resultados para '${query}'**\n\n${lines}`;
}

function formatManualLookup(result: ManualLookupResult): string {
  const pasos = result.pasos_tecnicos.map((p, i) => `${i + 1}. ${p}`).join('\n');
  const herramientas = result.herramientas_requeridas.join(', ');
  const torque = result.torque_specs ? `\n\n**Torque:** ${result.torque_specs}` : '';
  return `📖 **Procedimiento**\n\n${result.extracto}\n\n**Pasos:**\n${pasos}\n\n**Herramientas:** ${herramientas}${torque}`;
}

// ─── Intent detection ────────────────────────────────────────────────────────

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
  // Komatsu HM400 transmission codes: 15K0MW, 25K0MW, 1AK0LW (digit + letter + digit + 2 letters)
  const komatsuTM = text.match(/\b(\d{1,2}[A-Z]\d[A-Z]{1,3})\b/i);
  if (komatsuTM) return komatsuTM[1].toUpperCase();

  // All-letter controller codes: AETMKX, AEBRKX, AEBPKX (6 uppercase letters)
  const allLetter = text.match(/\b([A-Z]{6})\b/);
  if (allLetter) return allLetter[1].toUpperCase();

  // Standard letter-prefix codes: E328, F001, P0420, U0001, B0001, C-123, A-456
  const standard = text.match(/\b([EFPUBCA][A-Z]?[-]?\d{3,5}[A-Z]?\d*)\b/i);
  if (standard) return standard[1].toUpperCase();

  // Komatsu dash format: E-28, F-100
  const dashCode = text.match(/\b([EF]-\d{2,4})\b/i);
  if (dashCode) return dashCode[1].toUpperCase();

  return null;
}

function isFaultCodeQuery(text: string): boolean {
  // Fault code detected OR user is explicitly asking about a code
  return extractFaultCode(text) !== null ||
    /\bcodigo\b|\bcódigo\b|\berror\b|\bfault\b|\balerta\b/i.test(text);
}


function extractPartNumber(text: string): string | null {
  // Extract the part number from mixed text like "223-1335 diagrama"
  const match = text.match(/([A-Z]?\d{2,}-\d{2,}[-\d]*|\d{7,}|[A-Z]\d{3,}-\d{3,}[\w]*|\d{2,}\.\d{4,}[-\w]*)/i);
  return match ? match[1] : null;
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

// ─── Trip / Flete report lookup ──────────────────────────────────────────────

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const;

const MONTH_MAP: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12,
};

const TRANSPORT_UNIT_SET = new Set(TRANSPORT_UNITS.map((u) => u.unit_id.toUpperCase()));

/**
 * Detect queries about trip/flete counts or totals for a transport unit.
 * Examples: "cuántos viajes lleva CV100 en abril", "reporte de fletes CV105 este mes",
 * "viajes CV103 marzo", "total de viajes CV100".
 */
function isTripReportQuery(text: string): boolean {
  const hasTripKeyword = /\bviaj(es?|ó|o)\b|\bflet(es?|e)\b|\btrips?\b/i.test(text);
  if (!hasTripKeyword) return false;
  const hasCountWord = /\bcu[aá]nt(os|as)\b|\breporte\b|\bresumen\b|\btotal\b|\blleva\b|\bllev[oó]\b|\bhiz[oó]\b|\brealiz[oó]\b|\bhech(o|os)\b|\bcuenta\b|\bregistrad[oa]s?\b/i.test(text);
  const hasUnitRef = /\bCV\s*\d{2,3}\b/i.test(text);
  return hasCountWord || hasUnitRef;
}

/** Extract a transport unit ID like "CV100" from free text, returns canonical form. */
function extractTransportUnit(text: string): string | null {
  const match = text.match(/\bCV\s*(\d{2,3})\b/i);
  if (!match) return null;
  const canonical = `CV${match[1]}`.toUpperCase();
  return TRANSPORT_UNIT_SET.has(canonical) ? canonical : canonical;
}

/**
 * Extract month/year from the text. Supports named months (abril, mayo…),
 * "este mes", "mes pasado". Defaults to the current month/year.
 */
function extractMonthYear(
  text: string,
  reference: Date = new Date(),
): { month: number; year: number; label: string } {
  const lower = text.toLowerCase();
  if (/\bmes\s+pasado\b/.test(lower)) {
    const d = new Date(reference);
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return { month: d.getMonth() + 1, year: d.getFullYear(), label: MONTH_NAMES[d.getMonth()] };
  }
  for (const [name, num] of Object.entries(MONTH_MAP)) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(lower)) {
      const yearMatch = lower.match(/\b(20\d{2})\b/);
      const year = yearMatch ? parseInt(yearMatch[1], 10) : reference.getFullYear();
      return { month: num, year, label: MONTH_NAMES[num - 1] };
    }
  }
  return {
    month: reference.getMonth() + 1,
    year: reference.getFullYear(),
    label: MONTH_NAMES[reference.getMonth()],
  };
}

/** Read the Fletes sheet and summarise trips for a unit in a given month. */
async function fetchTripReport(
  unit: string,
  month: number,
  year: number,
  monthLabel: string,
): Promise<string> {
  let rows: string[][];
  try {
    rows = await readRange(SHEET_TABS.FLETES);
  } catch {
    return `📊 No pude acceder al reporte de fletes. Verifica tu conexión al servidor e intenta de nuevo.`;
  }

  const dataRows = rows.slice(1); // skip header
  const matching = dataRows.filter((row) => {
    const u = (row[2] ?? '').trim().toUpperCase();
    if (u !== unit) return false;
    const fecha = (row[0] ?? '').trim();
    const m = fecha.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return false;
    return parseInt(m[2], 10) === month && parseInt(m[3], 10) === year;
  });

  const count = matching.length;
  const tonelaje = matching.reduce(
    (s, r) => s + (parseFloat((r[11] ?? '').replace(/,/g, '')) || 0),
    0,
  );
  const flete = matching.reduce(
    (s, r) => s + (parseFloat((r[12] ?? '').replace(/[$,\s]/g, '')) || 0),
    0,
  );

  if (count === 0) {
    return (
      `📊 **Reporte de viajes — ${unit}**\n` +
      `${monthLabel} ${year}\n\n` +
      `No hay viajes registrados para ${unit} en ${monthLabel.toLowerCase()} ${year}.`
    );
  }

  const fletePretty = flete.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const tonPretty = tonelaje.toLocaleString('es-MX', { maximumFractionDigits: 1 });

  return (
    `📊 **Reporte de viajes — ${unit}**\n` +
    `${monthLabel} ${year}\n\n` +
    `• **${count}** ${count === 1 ? 'viaje registrado' : 'viajes registrados'}\n` +
    `• Tonelaje total: **${tonPretty} ton**\n` +
    `• Flete total: **$${fletePretty} MXN**`
  );
}

// ─── Greeting ────────────────────────────────────────────────────────────────

function buildGreeting(userName: string): ChatMessage {
  const content = `Hola ${userName}. Soy Hermes, tu asistente técnico.\n\nPuedo ayudarte con:\n• Diagnóstico de fallas — envía foto o describe el síntoma\n• Búsqueda de partes — número OEM o descripción\n• Procedimientos de reparación — manuales y torques\n• Códigos de falla — qué significan y qué revisar\n• **Diagramas** — escribe _diagrama [sistema]_ para ver el plano\n• **Manual de taller** — después de un código de falla escribe _ver manual_\n• **Reporte de viajes** — ej: _cuántos viajes lleva CV100 en abril_\n\n¿En qué te puedo ayudar?`;
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

  const defaultUnit =
    assignedUnits.length > 0 ? assignedUnits[0] : 'General';

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    buildGreeting(userName || 'Operador'),
  ]);
  const [selectedUnit, setSelectedUnit] = useState<string>(defaultUnit);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track the last fault code context so "ver manual" can look up pages
  const lastFaultCodeRef = useRef<{ code: string; equipo: string } | null>(null);

  function scrollToBottom() {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = useCallback(
    async (text: string, photo?: File) => {
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
        // Detect fault code early — before part number check (some codes look like part numbers)
        const faultCode = extractFaultCode(text);

        if (photo) {
          const foto_base64 = await fileToBase64(photo);
          try {
            const result = await photoToFailure({
              foto_base64,
              equipo: selectedUnit !== 'General' ? selectedUnit : undefined,
            });
            responseText = formatPhotoAnalysis(result);
          } catch {
            responseText = formatPhotoAnalysis(MOCK_PHOTO_ANALYSIS);
          }
        } else if (isTripReportQuery(text)) {
          // ── Trip / Flete report for a transport unit (CV100-CV110) ─────────
          const unitFromText = extractTransportUnit(text);
          const unit = unitFromText
            ?? (selectedUnit && /^CV\d{2,3}$/i.test(selectedUnit) ? selectedUnit.toUpperCase() : null);
          if (!unit) {
            responseText =
              `📊 **Reporte de viajes**\n\n` +
              `Dime qué unidad quieres consultar — por ejemplo: _cuántos viajes lleva CV100 en abril_.`;
          } else {
            const { month, year, label } = extractMonthYear(text);
            responseText = await fetchTripReport(unit, month, year, label);
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

          try {
            const result = await diagnose({
              equipo: effectiveUnit,
              sintoma: sintomaForVPS,
              codigo_falla: faultCode ?? undefined,
            });
            const unitLabel = selectedUnit !== 'General' ? selectedUnit : (detectedModel !== 'General' ? detectedModel : faultCode ?? 'General');
            // Prepend known code summary so user sees the official description immediately
            const codeHeader = knownCode
              ? `🔴 **Código ${faultCode}** — ${knownCode.descripcion}\n📍 Sistema: ${knownCode.sistema}\n${knownCode.accion ? `⚠️ **${knownCode.accion}**\n` : ''}\n`
              : faultCode
              ? `🔴 **Código ${faultCode}** — consultando manual...\n\n`
              : '';
            responseText = codeHeader + formatDiagnose(result, unitLabel);
            if (noContext) {
              responseText = `⚠️ _Selecciona tu equipo arriba para resultados más precisos con este código._\n\n` + responseText;
            }
            // Remember this fault code so "ver manual" can look up the PDF pages
            if (faultCode) {
              lastFaultCodeRef.current = { code: faultCode, equipo: effectiveUnit };
              responseText += `\n\n_💡 Escribe **ver manual** para abrir las páginas del manual de taller._`;
            }
          } catch {
            responseText = formatDiagnose(MOCK_DIAGNOSE, selectedUnit);
          }
        } else if (isPartNumber(text) || extractPartNumber(text)) {
          // Part number detected — search catalog first
          const pn = extractPartNumber(text) ?? text.trim();
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

          try {
            const results = await searchParts(pn, equipUnit !== 'General' ? equipUnit : undefined);
            if (results.length > 0) {
              responseText = formatSearchParts(results, pn);
              if (wantsDiagram) {
                let diagEquip = equipUnit;
                if (diagEquip === 'General' && results[0].compatible_units?.length > 0) {
                  diagEquip = results[0].compatible_units[0];
                }
                // Use description as search term (e.g. "Injector") — far more reliable
                // than the raw part number which may not exist in the local index files
                const diagSearchTerm = results[0].description ?? pn;
                try {
                  const diag = await findDiagram(diagEquip, diagSearchTerm);
                  if (diag.found && diag.image_url && diag.page !== undefined) {
                    const nextPage = diag.page + 1;
                    responseText += `\n\n📐 **Diagrama — ${diag.section ?? ''}**\n![Diagrama](/hermes-api${diag.image_url})\n\n📋 **Lista de Partes**\n![Partes](/hermes-api/diagrams/page/${diag.pdf}/${nextPage})`;
                  } else if (diag.found && diag.image_url) {
                    responseText += `\n\n📐 **Diagrama**\n![Diagrama](/hermes-api${diag.image_url})`;
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
                  const diag = await findDiagram(equipUnit !== 'General' ? equipUnit : '', pn);
                  if (diag.found && diag.image_url && diag.page !== undefined) {
                    const nextPage = diag.page + 1;
                    responseText += `\n\n📐 **Diagrama — ${diag.section ?? ''}**\n![Diagrama](/hermes-api${diag.image_url})\n\n📋 **Lista de Partes**\n![Partes](/hermes-api/diagrams/page/${diag.pdf}/${nextPage})`;
                  } else {
                    responseText += `\n\n📐 Selecciona el equipo en el filtro de arriba e intenta de nuevo, o ve a **Más → Diagramas** para explorar los planos disponibles.`;
                  }
                } catch {
                  responseText += `\n\n📐 No pude cargar el diagrama. Ve a **Más → Diagramas** para explorar los planos disponibles.`;
                }
              } else {
                // Not a diagram request — ask AI for context
                const result = await diagnose({
                  equipo: equipUnit,
                  sintoma: `BÚSQUEDA DE PARTE: ${pn}. Identifica qué es esta pieza, en qué sistema va y alternativas compatibles.`,
                });
                responseText = formatDiagnose(result, equipUnit);
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
              if (pages.found && pages.pdf && pages.page_start !== undefined && pages.page_end !== undefined) {
                responseText =
                  `📖 **Manual de Taller — Código ${ctx.code}**\n` +
                  `Páginas ${pages.page_start}–${pages.page_end}:\n\n` +
                  `![Manual p.${pages.page_start}](/hermes-api/diagrams/workshop-page/${pages.pdf}/${pages.page_start})\n\n` +
                  `![Manual p.${pages.page_end}](/hermes-api/diagrams/workshop-page/${pages.pdf}/${pages.page_end})`;
              } else {
                responseText = `📖 No encontré las páginas del manual para **${ctx.code}**.\n\n${pages.message ?? ''}`;
              }
            } catch {
              responseText = `📖 No pude cargar el manual en este momento. Intenta de nuevo.`;
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
          const searchTerm = subject || equipForDiagram;

          try {
            const diag = await findDiagram(equipForDiagram !== 'General' ? equipForDiagram : '', searchTerm);
            if (diag.found && diag.image_url && diag.page !== undefined) {
              const nextPage = diag.page + 1;
              responseText =
                `📐 **Diagrama — ${diag.section ?? searchTerm}**\n\n` +
                `![Diagrama](/hermes-api${diag.image_url})\n\n` +
                `📋 **Lista de partes**\n![Partes](/hermes-api/diagrams/page/${diag.pdf}/${nextPage})`;
            } else if (diag.found && diag.image_url) {
              responseText = `📐 **Diagrama**\n\n![Diagrama](/hermes-api${diag.image_url})`;
            } else {
              const unitInfo = selectedUnit !== 'General' ? ` para ${selectedUnit}` : '';
              responseText =
                `📐 **Diagramas${unitInfo}**\n\nNo encontré un diagrama específico para _${subject || 'ese sistema'}_.\n\n` +
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
          try {
            const result = await manualLookup({
              equipo: manualEquipo,
              tema: text,
            });
            responseText = formatManualLookup(result);
          } catch {
            responseText = `📖 **Procedimiento**\n\nNo pude acceder al manual en este momento. Consulta el manual físico o intenta de nuevo con conexión al servidor.`;
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
            const result = await diagnose({
              equipo: effectiveUnit,
              sintoma: text,
            });
            responseText = formatDiagnose(result, selectedUnit !== 'General' ? selectedUnit : effectiveUnit);
          } catch {
            responseText = formatDiagnose(MOCK_DIAGNOSE, selectedUnit);
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
    [selectedUnit, equipment]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Unit selector */}
      <div className="px-4 py-2 flex items-center gap-2 border-b" style={{ borderColor: '#E5E7EB', backgroundColor: '#F1F5F9' }}>
        <span className="text-xs font-medium" style={{ color: '#6B7280' }}>
          Equipo:
        </span>
        <select
          value={selectedUnit}
          onChange={(e) => setSelectedUnit(e.target.value)}
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
      <ChatInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
