import { describe, expect, it } from 'vitest';
import { applyDiagnosticRules } from './diagnostic-rules';

const HM400 = 'Komatsu HM400-3MO / CA22';

describe('diagnostic rules — oil pressure', () => {
  it('HM400 oil dashboard: ALTA, NO OPERAR, manómetro', () => {
    const result = applyDiagnosticRules({
      equipo: HM400,
      message: 'foto tablero luz aceite',
      previousContext: 'foto tablero luz aceite',
    });

    expect(result).not.toBeNull();
    expect(result?.severity).toBe('ALTA');
    expect(result?.operationalDecision).toMatch(/NO OPERAR/i);
    expect(result?.operationalDecision + result?.nextTests.join(' ') + result?.question).toMatch(/man[oó]metro/i);
    expect(result?.safetyLock?.locked).toBe(true);
  });

  it('follow-up after oil light with level OK: still NO OPERAR, asks manometer', () => {
    const result = applyDiagnosticRules({
      equipo: HM400,
      message: 'ya revise nivel y esta bien',
      previousContext: 'Alerta luz aceite tablero HM400',
      alreadyChecked: [],
    });

    expect(result?.operationalDecision).toMatch(/NO OPERAR/i);
    expect(result?.question).toMatch(/man[oó]metro/i);
    expect(result?.operationalDecision).not.toMatch(/seguro mover|puede mover/i);
  });

  it('follow-up engine sounds normal: NO OPERAR, sound does not confirm pressure', () => {
    const result = applyDiagnosticRules({
      equipo: HM400,
      message: 'motor suena normal puedo moverlo?',
      previousContext: 'luz aceite presion aceite',
    });

    expect(result?.operationalDecision).toMatch(/NO OPERAR/i);
    expect(result?.warnings.join(' ')).toMatch(/sonando normal|sonido normal|no confirma/i);
  });

  it('no manometer: keep stopped', () => {
    const result = applyDiagnosticRules({
      equipo: HM400,
      message: 'no tengo manometro',
      previousContext: 'luz aceite tablero',
    });

    expect(result?.operationalDecision).toMatch(/NO OPERAR/i);
    expect(result?.operationalDecision + result?.warnings.join(' ')).toMatch(/man[oó]metro|parado|sin man[oó]metro/i);
    expect(result?.operationalDecision).not.toMatch(/puede mover|seguro/i);
  });
});

describe('diagnostic rules — HM400 undercarriage', () => {
  it('rolo superior on HM400-3: corrects and suggests valid alternatives', () => {
    const result = applyDiagnosticRules({
      equipo: HM400,
      message: 'rolo superior malo',
    });

    expect(result?.warnings.join(' ')).toMatch(/no aplica rolo superior/i);
    expect(result?.likelyCauses.join(' ') + result?.nextTests.join(' ')).toMatch(/rolo inferior|gu[ií]a|sprocket|mando final/i);
    expect(result?.likelyCauses.join(' ') + result?.nextTests.join(' ')).not.toMatch(/carrier roller/i);
  });
});

describe('diagnostic rules — overheating', () => {
  it('radiator already checked: does not lead with radiator', () => {
    const result = applyDiagnosticRules({
      equipo: 'Komatsu D65EX-16',
      message: 'se calienta, ya revise radiador y esta bien',
      alreadyChecked: ['radiador revisado'],
    });

    expect(result?.nextTests[0]).not.toMatch(/^Revisar radiador/i);
    expect(result?.question).toMatch(/temperatura|ventilador/i);
    expect(result?.nextTests.join(' ')).toMatch(/termostato|ventilador|bomba|temperatura/i);
  });
});

describe('diagnostic rules — low power', () => {
  it('filters already changed: does not suggest filters first', () => {
    const result = applyDiagnosticRules({
      equipo: HM400,
      message: 'no jala y ya cambie filtros',
      alreadyChecked: ['filtros cambiados'],
    });

    expect(result?.nextTests[0]).not.toMatch(/filtro de aire|filtros de aire/i);
    expect(result?.question).toMatch(/cargado|vac[ií]o|subida/i);
    expect(result?.nextTests.join(' ')).toMatch(/turbo|combustible|presi[oó]n|carga/i);
  });
});

describe('diagnostic rules — added workshop slang coverage', () => {
  it('no arranca separates crank vs no-crank', () => {
    const result = applyDiagnosticRules({
      equipo: HM400,
      message: 'no da marcha solo hace click',
    });

    expect(result?.system).toMatch(/Arranque electrico/i);
    expect(result?.nextTests.join(' ')).toMatch(/voltaje|bateria|rele/i);
    expect(result?.question).toMatch(/gira|click/i);
  });

  it('engine stalls asks when it shuts off', () => {
    const result = applyDiagnosticRules({
      equipo: HM400,
      message: 'se apaga solo cuando va cargado',
    });

    expect(result?.system).toMatch(/se apaga/i);
    expect(result?.question).toMatch(/cargado|caliente|ralenti|bache/i);
    expect(result?.nextTests.join(' ')).toMatch(/codigos|combustible|voltaje/i);
  });

  it('battery or alternator asks for voltage readings', () => {
    const result = applyDiagnosticRules({
      equipo: 'Mack 8x4',
      message: 'luz bateria y no carga',
    });

    expect(result?.system).toMatch(/electrico|bateria/i);
    expect(result?.question).toMatch(/voltaje/i);
    expect(result?.nextTests.join(' ')).toMatch(/apagado|encendido|alternador|bateria/i);
  });

  it('transmission complaint does not stay generic', () => {
    const result = applyDiagnosticRules({
      equipo: HM400,
      message: 'la caja no cambia y golpea el cambio',
    });

    expect(result?.system).toMatch(/Transmision/i);
    expect(result?.operationalDecision).toMatch(/No cargar/i);
    expect(result?.question).toMatch(/todos los cambios|uno especifico/i);
  });

  it('steering fault blocks operation', () => {
    const result = applyDiagnosticRules({
      equipo: HM400,
      message: 'direccion dura no gira bien',
    });

    expect(result?.operationalDecision).toMatch(/NO OPERAR/i);
    expect(result?.nextTests.join(' ')).toMatch(/nivel|fugas|presion/i);
  });

  it('fuel contamination asks for visible sample', () => {
    const result = applyDiagnosticRules({
      equipo: HM400,
      message: 'falla despues de cargar diesel creo que tiene agua',
    });

    expect(result?.system).toMatch(/Combustible/i);
    expect(result?.nextTests.join(' ')).toMatch(/Drenar|muestra|filtros/i);
    expect(result?.question).toMatch(/agua|sedimento/i);
  });

  it('vibration asks if stopped or moving', () => {
    const result = applyDiagnosticRules({
      equipo: HM400,
      message: 'vibra feo cuando va caminando',
    });

    expect(result?.system).toMatch(/Vibracion/i);
    expect(result?.question).toMatch(/parado|caminando/i);
  });

  it('coolant leak is handled before generic overheat', () => {
    const result = applyDiagnosticRules({
      equipo: HM400,
      message: 'bota agua verde por abajo',
    });

    expect(result?.system).toMatch(/coolant|refrigerante/i);
    expect(result?.question).toMatch(/radiador|manguera|bomba/i);
    expect(result?.warnings.join(' ')).toMatch(/caliente|coolant/i);
  });
});
