import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../stores/auth-store';
import { EQUIPMENT_CATALOG } from '../../data/equipment-catalog';
import {
  diagnose,
  photoToFailure,
  manualLookup,
  searchParts,
  type DiagnoseResult,
  type PhotoAnalysisResult,
  type ManualLookupResult,
  type PartResult,
} from '../../lib/hermes-api';
import { fileToBase64 } from '../../lib/photo-upload';
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

function formatSearchParts(results: PartResult[], query: string): string {
  if (results.length === 0) {
    return `📦 **Resultados para '${query}'**\n\nNo se encontraron partes con ese criterio.`;
  }
  const lines = results
    .map(
      (p) =>
        `• ${p.part_number} — ${p.description} | Stock: ${p.stock_quantity} | $${p.unit_price}`
    )
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
  return /[A-Z0-9]{3,}-?[0-9]{2,}/.test(text.toUpperCase()) && /\d/.test(text);
}

function isManualQuery(text: string): boolean {
  return /manual|procedimiento|cómo|como|pasos/i.test(text);
}

function isDiagramQuery(text: string): boolean {
  return /diagrama|diagram|esquema|plano|dibujo/i.test(text);
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
  const content = `Hola ${userName}. Soy Hermes, tu asistente técnico.\n\nPuedo ayudarte con:\n• Diagnóstico de fallas — envía foto o describe el síntoma\n• Búsqueda de partes — número OEM o descripción\n• Procedimientos de reparación — manuales y torques\n• Códigos de falla — qué significan y qué revisar\n\n¿En qué te puedo ayudar?`;
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

  const defaultUnit =
    assignedUnits.length > 0 ? assignedUnits[0] : 'General';

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    buildGreeting(userName || 'Operador'),
  ]);
  const [selectedUnit, setSelectedUnit] = useState<string>(defaultUnit);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
        } else if (isPartNumber(text)) {
          // Fast JSON catalog search first, then AI for deeper analysis
          try {
            const results = await searchParts(
              text,
              selectedUnit !== 'General' ? selectedUnit : undefined
            );
            if (results.length > 0) {
              responseText = formatSearchParts(results, text);
            } else {
              // No catalog match — ask AI for help
              const result = await diagnose({
                equipo: selectedUnit !== 'General' ? selectedUnit : 'todos',
                sintoma: `BÚSQUEDA DE PARTE: ${text}. No se encontró en el catálogo JSON. Busca en tu conocimiento de manuales técnicos. Devuelve: número de parte, descripción, equipo compatible, y alternativas.`,
              });
              responseText = formatDiagnose(result, selectedUnit);
            }
          } catch {
            responseText = `📦 **Búsqueda: '${text}'**\n\nNo pude conectar con el servidor. Verifica tu conexión e intenta de nuevo.`;
          }
        } else if (isDiagramQuery(text)) {
          // Direct user to the diagram viewer
          const unitInfo = selectedUnit !== 'General' ? ` para ${selectedUnit}` : '';
          responseText = `📐 **Diagramas${unitInfo}**\n\nLos diagramas técnicos están disponibles en la sección de **Diagramas** del menú.\n\n👉 Ve a **Más → Diagramas** o usa la pestaña Diagramas en el Workbench del Mecánico.\n\nDisponibles:\n• D155AX-6 (Komatsu)\n• HM400-3 (Komatsu)\n• DX340LC (Doosan)\n• DX225LCA (Doosan)\n• DL420A (Doosan)\n• MACK GR84B`;
        } else if (isManualQuery(text)) {
          try {
            const result = await manualLookup({
              equipo: selectedUnit,
              tema: text,
            });
            responseText = formatManualLookup(result);
          } catch {
            responseText = `📖 **Procedimiento**\n\nNo pude acceder al manual en este momento. Consulta el manual físico o intenta de nuevo con conexión al servidor.`;
          }
        } else {
          // Auto-detect equipment from message if selector is "General"
          const effectiveUnit = selectedUnit !== 'General'
            ? selectedUnit
            : detectEquipmentFromText(text);
          try {
            const result = await diagnose({
              equipo: effectiveUnit,
              sintoma: text,
            });
            responseText = formatDiagnose(result, selectedUnit);
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
    [selectedUnit]
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
          {EQUIPMENT_CATALOG.map((eq) => (
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
