import { describe, expect, it } from 'vitest';
import {
  buildHermesWhatsAppContact,
  buildHermesWhatsAppResponse,
  isWhatsAppContactQuery,
  normalizeWhatsAppNumber,
} from './hermes-contact';

describe('hermes WhatsApp contact helpers', () => {
  it('normalizes the Panama number used by Hermes Chat', () => {
    expect(normalizeWhatsAppNumber('65976682')).toBe('+50765976682');
    expect(buildHermesWhatsAppContact('+507 6597-6682')).toMatchObject({
      rawNumber: '+50765976682',
      displayNumber: '+507 6597-6682',
      waMeUrl: 'https://wa.me/50765976682',
    });
  });

  it('detects WhatsApp and escalation contact requests', () => {
    expect(isWhatsAppContactQuery('cual es el whatsapp de Hermes?')).toBe(true);
    expect(isWhatsAppContactQuery('necesito escalar esta falla')).toBe(true);
    expect(isWhatsAppContactQuery('numero de parte 223-1335')).toBe(false);
  });

  it('builds the chat response with the new number', () => {
    const response = buildHermesWhatsAppResponse();

    expect(response).toContain('+507 6597-6682');
    expect(response).toContain('https://wa.me/50765976682');
    expect(response).not.toContain(['6944', '0202'].join(''));
  });
});
