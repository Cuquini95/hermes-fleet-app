/**
 * @fileoverview Monolithic by design (> 400 LOC).
 * Chat UI + streaming + tool-call rendering. Stateful message list + input + scroll behavior that do not split cleanly; helper hooks extracted where they made sense.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../stores/auth-store';
import { useEquipmentList } from '../../hooks/useEquipmentList';
import {
  diagnose,
  mechanicChat,
  photoDiagnose,
  manualLookup,
  searchParts,
  findDiagram,
  getFaultCodePages,
  type DiagnoseResult,
  type ManualLookupResult,
  type PartResult,
} from '../../lib/hermes-api';
import { fileToBase64 } from '../../lib/photo-upload';
import { tryUploadPhoto } from '../../lib/photo-upload-safe';
import { appendRow, SHEET_TABS } from '../../lib/sheets-api';
import { queueSubmission } from '../../lib/offline-queue';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useWorkOrderStore } from '../../stores/workorder-store';
import { buildDiagnosisIssueRow, buildDiagnosisWorkOrderRow, enforceMechanicDiagnosisGuards, normalizeDiagnosisResponse, type MechanicDiagnosisResult } from '../../lib/mechanic-diagnosis';
import { normalizeFaultCode, isFaultCodeLike as isStructuredFaultCodeLike } from '../../lib/fault-code-parser';
import { lookupFaultCode, buildFaultCodeSintoma } from '../../data/fault-codes';
import type { ChatActionId, ChatMessage } from '../../types/chat';
import type { WorkOrder } from '../../types/workorder';
import ChatBubble from './ChatBubble';
import TypingIndicator from './TypingIndicator';
import ChatInput from './ChatInput';

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatDiagnose(result: DiagnoseResult, equipo: string): string {
  const causas = result.causas_probables
    .map((c, i) => `${i + 1}. ${c}`)
    .join('\n');
  const checklist = result.checklist_diagnostico
    .map((c, i) => `${i + 1}. ${c}`)
    .join('\n');
  const seenOem = new Set<string>();
  const partes = result.partes_probables
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

  return `🔍 **Diagnóstico para ${equipo}**\n\n**Causas probables:**\n${causas}\n\n**Checklist:**\n${checklist}\n\n**Partes sugeridas:**\n${partes}\n\n**Prioridad:** ${result.prioridad}`;
}

function uniqueNonEmpty(items: string[]): string[] {
  const seen = new Set<string>();
  return items
    .map((item) => item.trim())
    .filter((item) => {
      if (!item || seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

function sentenceBullets(text: string, limit = 4): string[] {
  return uniqueNonEmpty(
    text
      .replace(/\n+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.replace(/\*\*/g, '').trim())
      .filter(Boolean),
  ).slice(0, limit);
}

function bulletList(items: string[], limit = 5): string {
  const cleaned = uniqueNonEmpty(items).slice(0, limit);
  if (cleaned.length === 0) return '• Sin dato confirmado.';
  return cleaned.map((item) => `• ${item}`).join('\n');
}

function formatMechanicDiagnosis(result: MechanicDiagnosisResult): string {
  const quickRead = sentenceBullets(result.spanish_answer, 4);
  const code = result.detected_code?.normalized_label;
  const stopLine = result.stop_machine_required
    ? 'Detener la unidad hasta validar la causa.'
    : 'Puede operar solo si no hay alarma activa y los indicadores están dentro de rango.';

  return [
    '**Lectura rápida**',
    bulletList([
      result.equipment_context ? `Equipo: ${result.equipment_context}` : '',
      result.probable_system ? `Sistema probable: ${result.probable_system}` : '',
      code ? `Código detectado: ${code}` : '',
      ...quickRead,
    ], 6),
    '',
    '**Riesgo operativo**',
    bulletList([
      `Nivel: ${result.safety_level}`,
      stopLine,
      `Confianza: ${result.confidence}%`,
    ], 3),
    '',
    '**Causas probables**',
    bulletList(result.likely_causes, 4),
    '',
    '**Revisar primero**',
    bulletList(result.first_checks, 5),
    '',
    '**Componentes a inspeccionar**',
    bulletList(result.recommended_parts_to_inspect, 4),
  ].join('\n');
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
  if (komatsuTM?.[1]) return komatsuTM[1].toUpperCase();

  // Komatsu monitor / RHC codes: DK51L5, DA1QKR, DB1QKR, AA10NX
  const komatsuMonitor = text.match(/\b(D[A-Z]\d{2}[A-Z0-9]{1,3}|[A-Z]{2}\d{2}[A-Z0-9]{1,3})\b/i);
  if (komatsuMonitor?.[1]) return komatsuMonitor[1].toUpperCase();

  const explicitFault = text.match(/\b(?:fallo|c[oó]digo|error|fault|cod)\s+([A-Z0-9-]{4,10})\b/i);
  if (explicitFault?.[1]) return explicitFault[1].toUpperCase();

  // All-letter controller codes: AETMKX, AEBRKX, AEBPKX (6 uppercase letters)
  const allLetter = text.match(/\b([A-Z]{6})\b/);
  if (allLetter?.[1]) return allLetter[1].toUpperCase();

  // Standard letter-prefix codes: E328, F001, P0420, U0001, B0001, C-123, A-456
  const standard = text.match(/\b([EFPUBCA][A-Z]?[-]?\d{3,5}[A-Z]?\d*)\b/i);
  if (standard?.[1]) return standard[1].toUpperCase();

  // Komatsu dash format: E-28, F-100
  const dashCode = text.match(/\b([EF]-\d{2,4})\b/i);
  if (dashCode?.[1]) return dashCode[1].toUpperCase();

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
  const content = `Hola ${userName}. Soy Hermes, tu asistente técnico.\n\nPuedo ayudarte con:\n• Diagnóstico de fallas — envía foto o describe el síntoma\n• Búsqueda de partes — número OEM o descripción\n• Procedimientos de reparación — manuales y torques\n• Códigos de falla — qué significan y qué revisar\n• **Diagramas** — escribe _diagrama [sistema]_ para ver el plano\n• **Manual de taller** — después de un código de falla escribe _ver manual_\n\n¿En qué te puedo ayudar?`;
  return {
    id: 'greeting',
    role: 'hermes',
    content,
    timestamp: new Date(),
  };
}

function diagnosisActions(): ChatActionId[] {
  return ['create_ot', 'unit_history', 'upload_photo', 'manual_search'];
}

function resolveUnitNumber(selectedUnit: string, equipmentContext: string): string {
  if (selectedUnit && selectedUnit !== 'General') return selectedUnit;
  const firstSegment = String(equipmentContext || '').split('/')[0]?.trim() ?? '';
  if (/^[A-Z]{1,4}[-]?\d{1,4}$/i.test(firstSegment)) return firstSegment.toUpperCase();
  return '';
}

function attachEvidencePhoto(
  diagnosis: MechanicDiagnosisResult,
  evidencePhotoUrl: string,
): MechanicDiagnosisResult {
  return enforceMechanicDiagnosisGuards(diagnosis, { evidencePhotoUrl });
}

function photoEvidenceStatus(evidencePhotoUrl: string): string {
  return evidencePhotoUrl
    ? '\n\nFoto: guardada como evidencia para la OT.'
    : '\n\nFoto: visible en este chat, pero no se pudo guardar como evidencia durable. Si vas a crear OT, vuelve a intentar con conexion antes de guardar.';
}

function formatUnitHistory(unit: string, workorders: WorkOrder[]): string {
  const matches = workorders
    .filter((wo) => wo.unidad.toLowerCase() === unit.toLowerCase())
    .slice(0, 5);
  if (matches.length === 0) {
    return `Historial de ${unit}\n\nNo encontre OTs recientes en el cache local. Si la unidad tiene historial en Sheets, intenta abrir Ordenes cuando tengas conexion.`;
  }
  const lines = matches.map((wo) => (
    `- ${wo.ot_id} | ${wo.fecha || 'sin fecha'} | ${wo.prioridad} | ${wo.estado}: ${wo.descripcion || wo.tipo_averia}`
  ));
  return `Historial reciente de ${unit}\n\n${lines.join('\n')}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function HermesChat() {
  const userName = useAuthStore((s) => s.userName);
  const assignedUnits = useAuthStore((s) => s.assignedUnits);
  const equipment = useEquipmentList();
  const isOnline = useOnlineStatus();
  const fetchedWorkOrders = useWorkOrderStore((s) => s.fetched);
  const fetchWorkOrders = useWorkOrderStore((s) => s.fetchWorkOrders);

  const defaultUnit: string =
    assignedUnits.length > 0 ? (assignedUnits[0] ?? 'General') : 'General';

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    buildGreeting(userName || 'Operador'),
  ]);
  const [selectedUnit, setSelectedUnit] = useState<string>(defaultUnit);
  const [isLoading, setIsLoading] = useState(false);
  const [openCameraRequest, setOpenCameraRequest] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track the last fault code context so "ver manual" can look up pages
  const lastFaultCodeRef = useRef<{ code: string; equipo: string } | null>(null);

  // Track the last parts search so bare "diagrama" can use context
  const lastPartsSearchRef = useRef<{ equipo: string; description: string; part_number: string } | null>(null);

  function scrollToBottom() {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const appendHermesMessage = useCallback((content: string) => {
    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      role: 'hermes',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, msg]);
  }, []);

  const handleChatAction = useCallback(async (action: ChatActionId, message: ChatMessage) => {
    const diagnosis = message.diagnosis;

    if (action === 'upload_photo') {
      setOpenCameraRequest(Date.now());
      return;
    }

    if (!diagnosis) {
      appendHermesMessage('Primero necesito un diagnostico estructurado para ejecutar esta accion.');
      return;
    }

    const unitNumber = resolveUnitNumber(selectedUnit, diagnosis.equipment_context);
    if (action === 'create_ot') {
      if (!unitNumber) {
        appendHermesMessage('Selecciona la unidad arriba antes de crear la OT. No voy a abrir una orden contra "General".');
        return;
      }
      const row = buildDiagnosisWorkOrderRow(diagnosis, {
        unitNumber,
        reportedBy: userName || 'Hermes Assistant',
      });
      const issueRow = buildDiagnosisIssueRow(diagnosis, {
        unitNumber,
        reportedBy: userName || 'Hermes Assistant',
        otId: row[1],
        date: row[2],
      });
      try {
        if (isOnline) {
          await Promise.all([
            appendRow(SHEET_TABS.ORDENES_TRABAJO, row),
            appendRow(SHEET_TABS.AVERIAS, issueRow),
          ]);
        } else {
          const timestamp = new Date().toISOString();
          await Promise.all([
            queueSubmission({
              type: 'falla',
              data: { tab: SHEET_TABS.ORDENES_TRABAJO, values: row },
              timestamp,
            }),
            queueSubmission({
              type: 'falla',
              data: { tab: SHEET_TABS.AVERIAS, values: issueRow },
              timestamp,
            }),
          ]);
        }
        useWorkOrderStore.setState({ fetched: false });
        appendHermesMessage(`${row[1]} creada para ${unitNumber} desde el diagnostico IA. Queda abierta para revision del taller.${diagnosis.evidence_photo_url ? ' La foto quedo enlazada como evidencia.' : ''}`);
      } catch {
        const timestamp = new Date().toISOString();
        await Promise.allSettled([
          queueSubmission({
            type: 'falla',
            data: { tab: SHEET_TABS.ORDENES_TRABAJO, values: row },
            timestamp,
          }),
          queueSubmission({
            type: 'falla',
            data: { tab: SHEET_TABS.AVERIAS, values: issueRow },
            timestamp,
          }),
        ]);
        appendHermesMessage(`${row[1]} quedo en cola local. Se sincronizara cuando vuelva la conexion.`);
      }
      return;
    }

    if (action === 'unit_history') {
      if (!unitNumber) {
        appendHermesMessage('Selecciona una unidad para consultar historial. Con "General" no puedo separar fallas reales de otras unidades.');
        return;
      }
      if (!fetchedWorkOrders) {
        await fetchWorkOrders();
      }
      const workorders = useWorkOrderStore.getState().workorders;
      appendHermesMessage(formatUnitHistory(unitNumber, workorders));
      return;
    }

    if (action === 'manual_search') {
      const code = diagnosis.detected_code?.normalized_label;
      if (!code) {
        appendHermesMessage('No detecte un codigo en este diagnostico. Escribe el sistema o codigo exacto para buscar manual.');
        return;
      }
      try {
        const pages = await getFaultCodePages(diagnosis.equipment_context, code);
        if (pages.found && pages.pdf && pages.page_start !== undefined && pages.page_end !== undefined) {
          appendHermesMessage(
            `Manual de Taller — Codigo ${code}\n` +
            `Paginas ${pages.page_start}-${pages.page_end}:\n\n` +
            `![Manual p.${pages.page_start}](/hermes-api/diagrams/workshop-page/${pages.pdf}/${pages.page_start})\n\n` +
            `![Manual p.${pages.page_end}](/hermes-api/diagrams/workshop-page/${pages.pdf}/${pages.page_end})`
          );
        } else {
          appendHermesMessage(`No tengo el manual confirmado para esta unidad.\n\n${pages.message ?? ''}`);
        }
      } catch {
        appendHermesMessage('No pude cargar el manual en este momento. Intenta de nuevo con conexion al servidor.');
      }
    }
  }, [appendHermesMessage, fetchedWorkOrders, fetchWorkOrders, isOnline, selectedUnit, userName]);

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
      let diagnosis: MechanicDiagnosisResult | undefined;
      let actions: ChatActionId[] | undefined;
      let evidencePhotoUrl = '';

      try {
        // Detect fault code early — before part number check (some codes look like part numbers)
        const normalizedCode = normalizeFaultCode(text);
        const faultCode = normalizedCode?.normalized_label || extractFaultCode(text);

        if (photo) {
          const [foto_base64, uploadedPhotoUrl] = await Promise.all([
            fileToBase64(photo),
            tryUploadPhoto(photo, 'falla-photos', `chat-${Date.now()}`),
          ]);
          evidencePhotoUrl = uploadedPhotoUrl;
          try {
            const result = await photoDiagnose({
              foto_base64,
              equipo: selectedUnit !== 'General' ? selectedUnit : undefined,
              contexto: text || undefined,
            });
            diagnosis = attachEvidencePhoto(result, evidencePhotoUrl);
            responseText = formatMechanicDiagnosis(diagnosis) + photoEvidenceStatus(evidencePhotoUrl);
            actions = diagnosisActions();
          } catch {
            responseText =
              'No pude analizar la imagen con el diagnóstico IA en este momento. No voy a inventar una falla. Intenta de nuevo o escribe el código/alarma visible del tablero.';
          }
          if (!diagnosis) {
            responseText += photoEvidenceStatus(evidencePhotoUrl);
          }
        } else if (faultCode || ((isFaultCodeQuery(text) || isStructuredFaultCodeLike(text)) && !isPartNumber(text))) {
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

          const unitLabel = selectedUnit !== 'General' ? selectedUnit : (detectedModel !== 'General' ? detectedModel : faultCode ?? 'General');
          const codeHeader = knownCode
            ? `🔴 **Código ${faultCode}** — ${knownCode.descripcion}\n📍 Sistema: ${knownCode.sistema}\n${knownCode.accion ? `⚠️ **${knownCode.accion}**\n` : ''}\n`
            : faultCode
            ? `🔴 **Código ${faultCode}** — consultando manual...\n\n`
            : '';

          try {
            const result = await diagnose({
              equipo: effectiveUnit,
              sintoma: sintomaForVPS,
              codigo_falla: faultCode ?? undefined,
            });
            responseText = codeHeader + formatDiagnose(result, unitLabel);
            diagnosis = normalizeDiagnosisResponse(result, {
              equipment: effectiveUnit,
              userInput: text,
              detectedCode: normalizedCode?.normalized_label ? normalizedCode : null,
            });
            actions = diagnosisActions();
            if (noContext) {
              responseText = `⚠️ _Selecciona tu equipo arriba para resultados más precisos con este código._\n\n` + responseText;
            }
            if (faultCode) {
              lastFaultCodeRef.current = { code: faultCode, equipo: effectiveUnit };
              responseText += `\n\n_💡 Escribe **ver manual** para abrir las páginas del manual de taller._`;
            }
          } catch {
            try {
              const result = await mechanicChat({
                equipo: effectiveUnit,
                user_input: text,
                detected_code: normalizedCode?.normalized_label ? normalizedCode : undefined,
                model_tier: 'reasoning',
              });
              diagnosis = enforceMechanicDiagnosisGuards(result);
              responseText = formatMechanicDiagnosis(diagnosis);
              actions = diagnosisActions();
              if (noContext) {
                responseText = `⚠️ _Selecciona tu equipo arriba para resultados más precisos con este código._\n\n` + responseText;
              }
              if (result.detected_code?.normalized_label) {
                lastFaultCodeRef.current = { code: result.detected_code.normalized_label, equipo: effectiveUnit };
              }
            } catch {
              responseText =
                'No pude completar el diagnóstico IA en este momento. No voy a inventar causas ni partes. Intenta de nuevo o agrega código de falla, unidad y síntoma.';
            }
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

          // Final fallback: use last parts search context (e.g. "7861-93-1812 diagrama" after "7861-93-1812 on HM400-3")
          if (equipUnit === 'General' && lastPartsSearchRef.current?.equipo) {
            equipUnit = lastPartsSearchRef.current.equipo;
          }

          try {
            const results = await searchParts(pn, equipUnit !== 'General' ? equipUnit : undefined);
            const first = results[0];
            if (first) {
              responseText = formatSearchParts(results, pn);
              // Store context so a follow-up "diagrama" knows what to look for
              const diagEquipForRef = equipUnit !== 'General' ? equipUnit
                : (first.compatible_units?.[0] ?? '');
              lastPartsSearchRef.current = {
                equipo: diagEquipForRef,
                description: first.description ?? pn,
                part_number: pn,
              };
              if (wantsDiagram) {
                let diagEquip = equipUnit;
                const firstCompatible = first.compatible_units?.[0];
                if (diagEquip === 'General' && firstCompatible) {
                  diagEquip = firstCompatible;
                }
                // Use description as search term (e.g. "Injector") — far more reliable
                // than the raw part number which may not exist in the local index files
                const diagSearchTerm = first.description ?? pn;
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

          // If user typed bare "diagrama" (no subject, General unit), fall back to last parts search context
          const ctx = lastPartsSearchRef.current;
          const resolvedEquip = (equipForDiagram !== 'General' ? equipForDiagram : null)
            ?? (subject === '' && ctx ? ctx.equipo : null)
            ?? equipForDiagram;
          const searchTerm = subject
            || (ctx ? ctx.description : '')
            || resolvedEquip;

          try {
            const diag = await findDiagram(resolvedEquip !== 'General' ? resolvedEquip : '', searchTerm);
            if (diag.found && diag.image_url && diag.page !== undefined) {
              const nextPage = diag.page + 1;
              responseText =
                `📐 **Diagrama — ${diag.section ?? searchTerm}**\n\n` +
                `![Diagrama](/hermes-api${diag.image_url})\n\n` +
                `📋 **Lista de partes**\n![Partes](/hermes-api/diagrams/page/${diag.pdf}/${nextPage})`;
            } else if (diag.found && diag.image_url) {
              responseText = `📐 **Diagrama**\n\n![Diagrama](/hermes-api${diag.image_url})`;
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
            const result = await mechanicChat({
              equipo: effectiveUnit,
              user_input: text,
              detected_code: normalizedCode?.normalized_label ? normalizedCode : undefined,
              model_tier: 'auto',
            });
            diagnosis = enforceMechanicDiagnosisGuards(result);
            responseText = formatMechanicDiagnosis(diagnosis);
            actions = diagnosisActions();
          } catch {
            try {
              const result = await diagnose({
                equipo: effectiveUnit,
                sintoma: text,
              });
              responseText = formatDiagnose(result, selectedUnit !== 'General' ? selectedUnit : effectiveUnit);
              diagnosis = normalizeDiagnosisResponse(result, {
                equipment: effectiveUnit,
                userInput: text,
                detectedCode: normalizedCode?.normalized_label ? normalizedCode : null,
              });
              actions = diagnosisActions();
            } catch {
              responseText =
                'No pude completar el diagnóstico IA en este momento. No voy a inventar causas ni partes. Intenta de nuevo o agrega código de falla, unidad y síntoma.';
            }
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
        diagnosis,
        actions,
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
          <ChatBubble key={m.id} message={m} onAction={handleChatAction} />
        ))}
        {isLoading && <TypingIndicator />}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={isLoading} openCameraRequest={openCameraRequest} />
    </div>
  );
}
