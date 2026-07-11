export interface IntakeChatParams {
  text: string;
  selectedUnit?: string;
  userName?: string;
  photoBase64?: string;
  photoMimeType?: string;
  photoName?: string;
}

export interface IntakeChatResult {
  ok: boolean;
  status: 'registered' | 'needs_review' | 'guidance' | string;
  reply_text?: string;
  record?: {
    id: string;
    process_type: string;
    validation_status: string;
    sync_status: string;
  } | null;
  validation?: {
    ok: boolean;
    missingFields?: string[];
    errors?: string[];
  };
}

const BUSINESS_KEYWORDS = [
  'registrar',
  'registro',
  'guardar',
  'reportar',
  'reporte',
  'evidencia',
  'falla',
  'averia',
  'mantenimiento',
  'combustible',
  'diesel',
  'litros',
  'flete',
  'viaje',
  'checklist',
  'pretrip',
  'gasto',
  'costo',
  'aduana',
  'booking',
  'contenedor',
  'urgencia',
  'proyecto',
  'ubicacion',
  'horometro',
  'operador',
  'unidad',
];

export function shouldUseBusinessIntake(text: string, hasPhoto = false): boolean {
  const normalized = normalizeText(text);
  if (!normalized && !hasPhoto) return false;
  if (/^(hi|hola|hello|buenas|ayuda|help|menu)\b/.test(normalized)) return true;
  if (/\b(unit|unidad|equipo|operator|operador|project|proyecto)\s*[=:]/.test(normalized)) return true;
  if (/\b(liters|litros|cost|costo|falla|averia|flete|diesel)\s*[=:]/.test(normalized)) return true;
  if (hasPhoto && /\b(registrar|guardar|reportar|evidencia|checklist|falla|averia|flete|combustible)\b/.test(normalized)) {
    return true;
  }
  return BUSINESS_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export async function sendIntakeChatMessage(params: IntakeChatParams): Promise<IntakeChatResult> {
  const response = await fetch('/api/intake/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: params.text,
      selectedUnit: params.selectedUnit,
      userName: params.userName,
      userRef: params.userName || 'hermes-chat',
      photoBase64: params.photoBase64,
      photoMimeType: params.photoMimeType,
      photoName: params.photoName,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Intake failed with ${response.status}`);
  }
  return body;
}

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
