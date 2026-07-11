import { afterEach, describe, expect, it } from 'vitest';
import { buildDiagnoseResponse, buildManualLookupResponse, buildPhotoAnalysisResponse } from '../_lib/hermes-ai.js';

afterEach(() => {
  delete process.env.HERMES_PHOTO_ANALYSIS_PROVIDER;
});

describe('local Hermes AI diagnose', () => {
  it('returns a structured diagnose response for vague workshop Spanish', () => {
    const result = buildDiagnoseResponse({
      equipo: 'Komatsu D65EX-16',
      sintoma: 'truena feo abajo',
    });

    expect(result.prioridad).toBe('ALTA');
    expect(result.causas_probables.length).toBeGreaterThan(0);
    expect(result.checklist_diagnostico.length).toBeGreaterThan(0);
    expect(result.partes_probables.length).toBeGreaterThan(0);
  });

  it('returns a structured diagnose response for low power and smoke symptoms', () => {
    const result = buildDiagnoseResponse({
      equipo: 'Komatsu HM400-3',
      sintoma: 'jala poco y echa humo',
    });

    expect(result.causas_probables.join(' ')).toMatch(/filtro|inyector|turbo/i);
    expect(result.prioridad).toBe('ALTA');
  });

  it('does not suggest rol superior for HM400-3', () => {
    const result = buildDiagnoseResponse({
      equipo: 'Komatsu HM400-3MO',
      sintoma: 'truena feo abajo',
    });

    const text = [
      ...result.causas_probables,
      ...result.checklist_diagnostico,
      ...result.partes_probables.map(String),
    ].join(' ').toLowerCase();

    expect(text).not.toMatch(/carrier roller|rol superior|rolo superior|rodillo superior|inferior o superior/);
  });
});

describe('local Hermes AI manual lookup', () => {
  it('returns structured steps for oil filter change topics', () => {
    const result = buildManualLookupResponse({
      equipo: 'CAT 740B',
      tema: 'cambio filtro aceite',
    });

    expect(result.extracto).toMatch(/filtro/i);
    expect(result.pasos_tecnicos.length).toBeGreaterThanOrEqual(4);
    expect(result.herramientas_requeridas.length).toBeGreaterThan(0);
  });

  it('fails closed on unknown topics with a generic but valid procedure', () => {
    const result = buildManualLookupResponse({
      equipo: 'Doosan DX340LC',
      tema: 'revision rara de taller',
    });

    expect(result.extracto).toMatch(/Doosan DX340LC/);
    expect(result.pasos_tecnicos.length).toBeGreaterThanOrEqual(4);
    expect(result.torque_specs).toMatch(/no usar un valor universal/i);
  });
});

describe('local Hermes AI photo analysis', () => {
  it('returns a structured visual response for HM400 dashboard photos through the test vision provider', async () => {
    process.env.HERMES_PHOTO_ANALYSIS_PROVIDER = 'mock';
    const result = await buildPhotoAnalysisResponse({
      equipo: 'Komatsu HM400-3MO',
      contexto: 'foto del tablero luz aceite',
      foto_base64: 'abc123',
    });

    expect(result.componente_probable).toMatch(/tablero|monitor|lubricacion/i);
    expect(result.tipo_de_dano.length).toBeGreaterThan(0);
    expect(result.severidad).toBe('ALTA');
    expect(result.tipo_de_dano).toMatch(/aceite|presion/i);
    expect(result.recomendacion_inicial).toMatch(/NO OPERAR|manometro/i);

    const text = Object.values(result).join(' ').toLowerCase();
    expect(text).not.toMatch(/componente visible|imagen recibida|segunda foto|no pude analizar/);
  });

  it('hardens HM400 dashboard brake alerts without dropping model context', async () => {
    process.env.HERMES_PHOTO_ANALYSIS_PROVIDER = 'mock';
    const result = await buildPhotoAnalysisResponse({
      equipo: 'Komatsu HM400-3MO',
      contexto: 'foto tablero alerta freno parqueo activa',
      foto_base64: 'abc123',
    });

    expect(result.severidad).toMatch(/ALTA|MEDIA/);
    expect(result.recomendacion_inicial).toMatch(/freno|parqueo|mover/i);
    expect(result.tipo_de_dano).toMatch(/freno|parqueo/i);
  });

  it('hardens dashboard coolant/temperature alerts', async () => {
    process.env.HERMES_PHOTO_ANALYSIS_PROVIDER = 'mock';
    const result = await buildPhotoAnalysisResponse({
      equipo: 'Komatsu HM400-3MO',
      contexto: 'tablero temperatura alta activa',
      foto_base64: 'abc123',
    });

    expect(result.severidad).toBe('ALTA');
    expect(result.recomendacion_inicial).toMatch(/temperatura|ventilador|operacion/i);
  });

  it('fails closed instead of inventing photo diagnosis when real vision is not configured', async () => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENAI_API_KEY;

    await expect(buildPhotoAnalysisResponse({
      equipo: 'Komatsu HM400-3MO',
      contexto: 'foto del tablero',
      foto_base64: 'abc123',
    })).rejects.toThrow(/OPENROUTER_API_KEY/);
  });
});
