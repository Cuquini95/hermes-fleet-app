import { describe, expect, it } from 'vitest';
import {
  analyzeMechanicIntake,
  buildGuidedIntakeMessage,
  expandMechanicSlang,
  isMechanicDiagnosticMessage,
} from './mechanic-intake';

const vagueWorkshopInputs = [
  'ta malo',
  'esta malo',
  'anda raro',
  'no sirve',
  'fallando',
  'revisar maquina',
  'ocupa mecanico',
  'chequear',
  'tirada',
  'tirado',
  'pendiente revision',
  'no se loco',
  'se puso feo',
  'no quedo bien',
  'esta raro eso',
  'maquina mala',
  'equipo malo',
  'quedo raro',
  'hay problema',
  'necesita revision',
  'no trabaja bien',
  'no responde bien',
  'esta fallon',
  'fallo otra vez',
  'viene mal',
  'esta jodiendo',
  'no quiere',
  'no hace nada',
  'se siente raro',
  'esta flojo',
  'no sirve bien',
  'ta raro',
  'anda fallando',
  'se paro',
  'se para',
  'se apaga',
  'se muere',
  'bulla',
  'bullon',
  'suena feo',
  'suena raro',
  'truena',
  'golpea',
  'pesado',
  'ta pesado',
  'esta pesado',
  'huele quemado',
  'olor a quemado',
  'no camina',
  'no avanza',
  'no se mueve',
  'no jala',
  'jala poco',
  'sin fuerza',
  'no tiene fuerza',
  'no tiene potencia',
  'luz prendida',
  'luz tablero',
  'sale codigo',
  'tiro codigo',
  'alarma',
  'le sale una luz',
  'me tira una luz',
  'no frena',
  'freno pegado',
  'frena raro',
  'bota algo',
  'esta botando',
  'tira algo',
  'tiene fuga',
  'gotea',
  'se calienta',
  'calienta mucho',
  'temperatura alta',
  'no arranca',
  'no prende',
  'solo hace click',
  'bateria muerta',
  'manguera rota',
  'manguera reventada',
  'filtro sucio',
  'inyector danado',
  'bomba se calienta',
  'botando aceite',
  'bota aceite',
  'tira aceite',
  'fuga aceite',
  'botando agua',
  'bota agua',
  'tira agua',
  'agua verde',
  'fuga hidraulica',
  'direccion dura',
  'caja golpea',
  'transmision no cambia',
  'mando final',
  'rolo malo',
  'rodillo malo',
  'llanta flat',
  'humo azul',
];

describe('mechanic intake', () => {
  it('asks for a guided system on vague mechanic language', () => {
    const result = analyzeMechanicIntake('ta malo');

    expect(result.shouldAsk).toBe(true);
    expect(result.responseText).toContain('Elige una');
    expect(result.options).toContain('Motor');
  });

  it('maps workshop slang before diagnosis', () => {
    expect(expandMechanicSlang('bulla')).toContain('ruido mecanico');
    expect(expandMechanicSlang('pesado')).toContain('baja potencia');
    expect(expandMechanicSlang('no camina')).toContain('mando final');
    expect(expandMechanicSlang('se muere')).toContain('motor se apaga');
    expect(expandMechanicSlang('jala poco')).toContain('baja potencia');
    expect(expandMechanicSlang('huele quemado')).toContain('freno clutch transmision electrico');
  });

  it('keeps the intake answer short and field-oriented', () => {
    const response = buildGuidedIntakeMessage();

    expect(response).toContain('mover o no mover');
    expect(response).toContain('foto/codigo');
    expect(response.split('\n').length).toBeLessThanOrEqual(13);
  });

  it('recognizes 100 bad workshop-style messages as mechanic diagnostic language', () => {
    expect(vagueWorkshopInputs).toHaveLength(100);

    const recognized = vagueWorkshopInputs.filter(isMechanicDiagnosticMessage);
    expect(recognized.length).toBeGreaterThanOrEqual(95);
  });

  it('asks intake for ambiguous short slang but not for a clear failure sentence', () => {
    expect(analyzeMechanicIntake('pesado').shouldAsk).toBe(true);
    expect(analyzeMechanicIntake('bota aceite por la manguera del motor').shouldAsk).toBe(false);
  });

  it('does not interrupt an active diagnostic case', () => {
    expect(analyzeMechanicIntake('ta malo', { hasActiveCase: true }).shouldAsk).toBe(false);
  });
});
