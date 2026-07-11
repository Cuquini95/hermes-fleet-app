import { describe, expect, it } from 'vitest';
import {
  formatFaultCodeManualPages,
  formatFaultCodeManualPagesUnavailable,
} from './manual-pages';

describe('fault-code manual page formatting', () => {
  it('renders the two troubleshooting pages returned by the manual lookup', () => {
    const text = formatFaultCodeManualPages({
      found: true,
      pdf: 'HM400-3_workshop.pdf',
      page_start: 1168,
      page_end: 1169,
      codigo: 'DK51L5',
    }, 'DK51L5');

    expect(text).toContain('Manual de Taller - Codigo DK51L5');
    expect(text).toContain('Paginas 1168-1169');
    expect(text).toContain('![Manual p.1168](/hermes-api/diagrams/workshop-page/HM400-3_workshop.pdf/1168)');
    expect(text).toContain('![Manual p.1169](/hermes-api/diagrams/workshop-page/HM400-3_workshop.pdf/1169)');
  });

  it('does not invent manual pages when the lookup misses', () => {
    const text = formatFaultCodeManualPages({
      found: false,
      message: 'codigo no encontrado',
    }, 'NOPE');

    expect(text).toContain('No encontre paginas del manual');
    expect(text).toContain('codigo no encontrado');
    expect(text).not.toContain('![Manual');
  });

  it('returns an honest unavailable message when the manual endpoint fails', () => {
    expect(formatFaultCodeManualPagesUnavailable('DK51L5'))
      .toContain('No pude cargar las paginas del troubleshooting');
  });
});
