export const DEFAULT_HERMES_WHATSAPP_NUMBER = '+50765976682';

export interface HermesWhatsAppContact {
  rawNumber: string;
  displayNumber: string;
  waMeUrl: string;
}

export function normalizeWhatsAppNumber(value = DEFAULT_HERMES_WHATSAPP_NUMBER): string {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return DEFAULT_HERMES_WHATSAPP_NUMBER;
  if (digits.length === 8) return `+507${digits}`;
  return `+${digits}`;
}

export function formatWhatsAppNumber(value = DEFAULT_HERMES_WHATSAPP_NUMBER): string {
  const normalized = normalizeWhatsAppNumber(value);
  const digits = normalized.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('507')) {
    return `+507 ${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  return normalized;
}

export function buildHermesWhatsAppContact(value = DEFAULT_HERMES_WHATSAPP_NUMBER): HermesWhatsAppContact {
  const rawNumber = normalizeWhatsAppNumber(value);
  const digits = rawNumber.replace(/\D/g, '');
  return {
    rawNumber,
    displayNumber: formatWhatsAppNumber(rawNumber),
    waMeUrl: `https://wa.me/${digits}`,
  };
}

export function isWhatsAppContactQuery(text: string): boolean {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (/\b(whatsapp|wsp|wa\.me)\b/.test(normalized)) return true;
  if (/\b(escalar|emergencia|supervisor)\b/.test(normalized)) return true;

  return /\b(telefono|numero|contacto|contactar|llamar)\b/.test(normalized)
    && /\b(hermes|operativo|soporte|supervisor|whatsapp)\b/.test(normalized);
}

export function buildHermesWhatsAppResponse(value = DEFAULT_HERMES_WHATSAPP_NUMBER): string {
  const contact = buildHermesWhatsAppContact(value);
  return `**WhatsApp operativo Hermes**\n\nNumero: ${contact.displayNumber}\nEnlace: ${contact.waMeUrl}\n\nUsalo para escalar fallas criticas, fotos de evidencia y seguimiento de taller.\n\nHermes Chat no envia mensajes automaticos; solo te da el canal correcto.`;
}
