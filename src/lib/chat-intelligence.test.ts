import { describe, expect, it, vi } from 'vitest';
import {
  buildPartsSearchTerms,
  dedupePartResults,
  extractFaultCode,
  extractPartsSearchTerm,
  isFaultCodeQuery,
  isPartsLookupQuery,
  withChatTimeout,
} from './chat-intelligence';

describe('Hermes chat parts intent', () => {
  it('detects natural English part-number questions', () => {
    expect(isPartsLookupQuery('Can you tell me the accumulator parts number')).toBe(true);
    expect(extractPartsSearchTerm('Can you tell me the accumulator parts number')).toBe('accumulator');
  });

  it('detects Spanish part-number questions and expands to English', () => {
    const terms = buildPartsSearchTerms('numero de parte del acumulador');

    expect(isPartsLookupQuery('numero de parte del acumulador')).toBe(true);
    expect(terms).toContain('acumulador');
    expect(terms).toContain('accumulator');
  });

  it('keeps non-parts symptoms out of catalog lookup', () => {
    expect(isPartsLookupQuery('hydraulic oil leaking from the cylinder')).toBe(false);
  });

  it('routes bare component names to catalog lookup', () => {
    const terms = buildPartsSearchTerms('Inyectores');

    expect(isPartsLookupQuery('Inyectores')).toBe(true);
    expect(extractPartsSearchTerm('Inyectores')).toBe('inyectores');
    expect(terms).toContain('injector');
  });

  it('routes workshop undercarriage slang to catalog lookup', () => {
    const terms = buildPartsSearchTerms('rolo inferior');

    expect(isPartsLookupQuery('rolo inferior')).toBe(true);
    expect(extractPartsSearchTerm('rolo inferior')).toBe('rolo inferior');
    expect(terms).toContain('track roller');
  });

  it('routes vague idler slang to catalog lookup', () => {
    const terms = buildPartsSearchTerms('rueda guia');

    expect(isPartsLookupQuery('rueda guia')).toBe(true);
    expect(extractPartsSearchTerm('rueda guia')).toBe('rueda guia');
    expect(terms).toContain('idler');
  });

  it('routes pinon to sprocket without contaminating the query with generic pins', () => {
    const terms = buildPartsSearchTerms('piñon');

    expect(isPartsLookupQuery('piñon')).toBe(true);
    expect(extractPartsSearchTerm('piñon')).toBe('pinon');
    expect(terms).toContain('sprocket');
    expect(terms).not.toContain('pin');
    expect(terms).not.toContain('pasador');
  });

  it('expands low-literacy filter wording to the specific catalog term', () => {
    const terms = buildPartsSearchTerms('filtro aire');

    expect(isPartsLookupQuery('filtro aire')).toBe(true);
    expect(terms).toContain('air filter');
  });

  it('does not mutilate catalina when stripping CAT brand names', () => {
    const terms = buildPartsSearchTerms('catalina');

    expect(extractPartsSearchTerm('catalina')).toBe('catalina');
    expect(isPartsLookupQuery('catalina')).toBe(true);
    expect(terms).toContain('sprocket');
    expect(terms).not.toContain('alina');
  });

  it('deduplicates catalog hits by part number', () => {
    const results = dedupePartResults([
      { part_number: '721-32-10313', description: 'Accumulator Assembly' },
      { part_number: '721-32-10313', description: 'Duplicate' },
      { part_number: '721-89-10054', description: 'Plate' },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0]?.description).toBe('Accumulator Assembly');
  });
});

describe('Hermes chat timeout guard', () => {
  it('aborts slow calls instead of leaving the chat pending', async () => {
    vi.useFakeTimers();
    const promise = withChatTimeout(
      (signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
      100,
    );

    const assertion = expect(promise).rejects.toThrow('Aborted');
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    vi.useRealTimers();
  });
});

describe('Hermes chat fault-code intent', () => {
  it('recognizes HM400 retarder/body controller codes that do not start with a number', () => {
    expect(extractFaultCode('DK51L5')).toBe('DK51L5');
    expect(isFaultCodeQuery('DK51L5')).toBe(true);
  });

  it('keeps known machine-code formats working', () => {
    expect(extractFaultCode('15K0MW')).toBe('15K0MW');
    expect(extractFaultCode('E028')).toBe('E028');
    expect(extractFaultCode('AEBRKX')).toBe('AEBRKX');
  });

  it('does not mistake selected equipment context for a fault code', () => {
    expect(extractFaultCode('CA21')).toBeNull();
    expect(extractFaultCode('HM400-3MO')).toBeNull();
  });
});
