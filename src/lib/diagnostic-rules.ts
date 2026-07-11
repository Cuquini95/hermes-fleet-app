export type DiagnosticRuleInput = {
  equipo: string;
  message: string;
  previousContext?: string;
  alreadyChecked?: string[];
};

export type DiagnosticRuleResult = {
  matched: boolean;
  system: string;
  severity: 'BAJA' | 'MEDIA' | 'ALTA';
  operationalDecision: string;
  likelyCauses: string[];
  nextTests: string[];
  question: string;
  warnings: string[];
  source: string;
  safetyLock?: {
    locked: boolean;
    reason: string;
    unlockCondition: string;
  };
};

type RulePack = {
  id: string;
  system: string;
  source: string;
  triggers: string[];
  match: (combined: string, input: DiagnosticRuleInput) => boolean;
  evaluate: (combined: string, input: DiagnosticRuleInput) => DiagnosticRuleResult;
};

function normalizeText(value = ''): string {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(normalizeText(term)));
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function isHm400Equipment(equipo = ''): boolean {
  return normalizeText(equipo).includes('hm400');
}

function combinedInput(input: DiagnosticRuleInput): string {
  return normalizeText([
    input.message,
    input.previousContext || '',
    ...(input.alreadyChecked || []),
  ].join(' '));
}

function mentionsAlreadyChecked(combined: string, terms: string[]): boolean {
  const checkedSignals = [
    'ya revise',
    'ya revisamos',
    'ya checaron',
    'ya cambie',
    'cambie',
    'esta bien',
    'esta ok',
    'esta correcto',
    'nuevo',
    'nuevos',
  ];
  return hasAny(combined, checkedSignals) && hasAny(combined, terms);
}

function noManometer(combined: string): boolean {
  return hasAny(combined, ['no tengo manometro', 'sin manometro', 'no hay manometro']);
}

function asksCanMove(combined: string): boolean {
  return hasAny(combined, ['puedo mover', 'puede mover', 'moverlo', 'mover al taller', 'puedo operar', 'puede operar', 'es seguro mover']);
}

function engineSoundsNormal(combined: string): boolean {
  return hasAny(combined, ['motor suena normal', 'suena normal', 'motor normal', 'no suena raro', 'no oigo ruido']);
}

function levelOkClaim(combined: string): boolean {
  return hasAny(combined, ['nivel esta bien', 'nivel ok', 'nivel correcto', 'ya revise nivel', 'nivel bien', 'no veo fuga']);
}

function makeResult(params: Omit<DiagnosticRuleResult, 'matched'>): DiagnosticRuleResult {
  return {
    matched: true,
    ...params,
    likelyCauses: uniqueStrings(params.likelyCauses).slice(0, 4),
    nextTests: uniqueStrings(params.nextTests).slice(0, 6),
    warnings: uniqueStrings(params.warnings).slice(0, 4),
  };
}

const OIL_TRIGGERS = [
  'aceite',
  'presion de aceite',
  'presion aceite',
  'luz aceite',
  'lampara aceite',
  'oil pressure',
  'oil lamp',
  'nivel de aceite',
  'lubricacion',
];

function oilContextActive(combined: string): boolean {
  const dashboardOil = hasAny(combined, ['tablero', 'panel', 'monitor', 'foto']) && hasAny(combined, OIL_TRIGGERS);
  return hasAny(combined, OIL_TRIGGERS) || dashboardOil;
}

const oilRulePack: RulePack = {
  id: 'oil_pressure',
  system: 'Motor - lubricacion / presion de aceite',
  source: 'Regla critica de presion de aceite',
  triggers: OIL_TRIGGERS,
  match: (combined) => oilContextActive(combined),
  evaluate: (combined, input) => {
    const safetyLock = {
      locked: true,
      reason: 'Alerta o sospecha de presion de aceite sin confirmar con manometro.',
      unlockCondition: 'Medir presion real con manometro en ralenti y a 1500 RPM.',
    };
    const baseDecision = 'NO OPERAR. No mover hasta medir presion real de aceite con manometro.';
    const likelyCauses = [
      'Sensor de presion de aceite o cableado',
      'Presion real baja por bomba, filtro restringido o valvula de alivio',
      'Desgaste interno si presion baja con nivel correcto',
    ];
    const nextTests = [
      'Medir presion real con manometro en puerto del motor',
      'Comparar lectura contra escaner',
      'Si presion normal: revisar sensor y cableado hacia ECM',
      'Si presion baja: no mover; revisar bomba, filtro y lubricacion interna',
    ];
    const warnings = [
      'Motor sonando normal no confirma lubricacion',
      'Nivel correcto no confirma presion',
    ];

    let question = 'Cuanto marco el manometro en ralenti y a 1500 RPM?';
    let operationalDecision = baseDecision;
    if (noManometer(combined)) {
      operationalDecision = 'NO OPERAR. Sin manometro no se confirma presion. Mantener parado y conseguir manometro antes de mover.';
      question = 'Puedes conseguir manometro hoy o el operador debe dejarlo parado?';
      warnings.push('Sin manometro no autorices movimiento del equipo.');
    } else if (asksCanMove(combined) || engineSoundsNormal(combined)) {
      question = 'Cuanto marco el manometro en ralenti? Sin esa lectura no se autoriza movimiento.';
      warnings.push('Sonido normal del motor no reemplaza la medicion de presion.');
    } else if (levelOkClaim(combined)) {
      question = 'Cuanto marco el manometro en ralenti y a 1500 RPM?';
      warnings.push('Nivel OK no libera la alerta; falta confirmar presion real.');
    }

    return makeResult({
      system: isHm400Equipment(input.equipo) && hasAny(combined, ['tablero', 'foto', 'luz', 'lampara'])
        ? 'Tablero / lubricacion del motor'
        : 'Motor - lubricacion / presion de aceite',
      severity: 'ALTA',
      operationalDecision,
      likelyCauses,
      nextTests,
      question,
      warnings,
      source: isHm400Equipment(input.equipo) ? 'Regla critica de presion de aceite HM400' : 'Regla critica de presion de aceite',
      safetyLock,
    });
  },
};

const coolantLeakRulePack: RulePack = {
  id: 'coolant_leak',
  system: 'Motor - coolant / fuga de refrigerante',
  source: 'Regla de fuga de coolant',
  triggers: ['bota agua', 'bota coolant', 'fuga coolant', 'fuga refrigerante', 'pierde agua', 'agua verde'],
  match: (combined) => hasAny(combined, ['bota agua', 'bota coolant', 'fuga coolant', 'fuga refrigerante', 'pierde agua', 'agua verde']),
  evaluate: () => makeResult({
    system: 'Motor - coolant / fuga de refrigerante',
    severity: 'ALTA',
    operationalDecision: 'NO CARGAR. Solo prueba corta si el nivel esta correcto y temperatura normal.',
    likelyCauses: ['Manguera, abrazadera o radiador con fuga', 'Tapa de radiador no sostiene presion', 'Bomba de agua o sello con fuga'],
    nextTests: ['Revisar nivel en frio', 'Presurizar sistema con bomba de prueba', 'Inspeccionar mangueras, tapa, bomba y radiador', 'Confirmar temperatura real antes de mover'],
    question: 'Donde se ve la fuga: radiador, manguera, bomba de agua o abajo del motor?',
    warnings: ['No abrir tapa caliente.', 'Sin coolant suficiente se dana el motor rapido.'],
    source: 'Regla de fuga de coolant',
  }),
};

const overheatRulePack: RulePack = {
  id: 'overheat',
  system: 'Motor - enfriamiento',
  source: 'Regla de sobrecalentamiento',
  triggers: ['calienta', 'temperatura', 'caliente', 'coolant', 'radiador', 'hierve', 'sobrecalent'],
  match: (combined) => hasAny(combined, ['calienta', 'temperatura', 'caliente', 'coolant', 'radiador', 'hierve', 'sobrecalent']),
  evaluate: (combined) => {
    const radiatorChecked = mentionsAlreadyChecked(combined, ['radiador']);
    return makeResult({
      system: 'Motor - enfriamiento',
      severity: 'ALTA',
      operationalDecision: 'Limitar operacion. No cargar pesado hasta confirmar temperatura real y ventilador.',
      likelyCauses: ['Termostato, bomba de agua o ventilador fuera de rango', 'Nivel bajo de coolant o fuga', 'Restriccion de flujo si radiador ya se reviso visualmente'],
      nextTests: radiatorChecked
        ? ['Medir temperatura real con pistola o escaner', 'Confirmar si el ventilador entra al subir temperatura', 'Revisar tapa de radiador, termostato y bomba de agua', 'Buscar restriccion interna o aire en el sistema']
        : ['Medir temperatura real con pistola o escaner', 'Revisar nivel de coolant con motor frio', 'Confirmar si ventilador entra y si hay fuga visible', 'Revisar termostato, bomba de agua y restriccion de flujo'],
      question: radiatorChecked ? 'Que temperatura real marca y el ventilador entra cuando sube?' : 'La temperatura sube cargado, en ralenti o en ambos?',
      warnings: ['No destapar sistema caliente con presion.', radiatorChecked ? 'Radiador revisado no descarta termostato ni bomba.' : ''],
      source: 'Regla de sobrecalentamiento',
    });
  },
};

const airFilterRulePack: RulePack = {
  id: 'air_filter_restriction',
  system: 'Motor - admision / filtro de aire',
  source: 'Regla de restriccion de aire',
  triggers: ['filtro de aire', 'restriccion de aire', 'air filter', 'limpiador de aire', 'luz filtro'],
  match: (combined) => hasAny(combined, ['filtro de aire', 'restriccion de aire', 'air filter', 'limpiador de aire', 'luz filtro']),
  evaluate: (combined) => {
    const filtersChanged = mentionsAlreadyChecked(combined, ['filtro', 'filtros']);
    return makeResult({
      system: 'Motor - admision / filtro de aire',
      severity: filtersChanged ? 'MEDIA' : 'ALTA',
      operationalDecision: filtersChanged ? 'Prueba corta permitida; revisar restriccion real y ductos.' : 'No cargar fuerte hasta revisar restriccion de admision.',
      likelyCauses: ['Filtro de aire tapado', 'Ducto de admision colapsado o suelto', 'Sensor/indicador de restriccion defectuoso'],
      nextTests: filtersChanged
        ? ['Revisar indicador de restriccion en vivo', 'Inspeccionar ductos entre filtro, turbo y multiple', 'Confirmar que el filtro correcto quedo bien asentado']
        : ['Revisar filtro primario y secundario', 'Inspeccionar ductos y abrazaderas', 'Ver lectura de restriccion si el equipo la reporta'],
      question: filtersChanged ? 'La luz de restriccion sigue encendida despues del filtro nuevo?' : 'El filtro esta tapado o la luz aparecio cargando?',
      warnings: ['Restriccion de aire puede causar humo negro y baja potencia.'],
      source: 'Regla de restriccion de aire',
    });
  },
};

const lowPowerRulePack: RulePack = {
  id: 'low_power_smoke',
  system: 'Motor - potencia / combustible / aire',
  source: 'Regla de baja potencia y humo',
  triggers: ['no jala', 'no sube', 'sin fuerza', 'humo negro', 'burro', 'lento', 'pierde fuerza', 'jala poco', 'pierde potencia'],
  match: (combined) => hasAny(combined, ['no jala', 'no sube', 'sin fuerza', 'humo negro', 'burro', 'lento', 'pierde fuerza', 'jala poco', 'pierde potencia', 'echa humo']),
  evaluate: (combined) => {
    const filtersChanged = mentionsAlreadyChecked(combined, ['filtro', 'filtros']);
    return makeResult({
      system: 'Motor - potencia / combustible / aire',
      severity: 'ALTA',
      operationalDecision: 'Puede seguir solo para prueba corta y segura; no cargar fuerte hasta separar aire, combustible o turbo.',
      likelyCauses: ['Restriccion de aire o turbo con fuga', 'Combustible o inyectores con alimentacion deficiente', 'Restriccion de escape si humo negro persiste'],
      nextTests: filtersChanged
        ? ['Medir presion de turbo/carga bajo carga', 'Revisar presion de combustible y retorno', 'Leer codigos activos y restriccion de aire en tablero', 'Comparar humo y potencia cargado vs vacio']
        : ['Revisar indicador de restriccion de aire', 'Confirmar filtros de aire y combustible', 'Medir presion de turbo/carga', 'Leer codigos activos'],
      question: 'Pasa cargado, vacio o en subida?',
      warnings: filtersChanged ? ['Filtros nuevos no descartan turbo, combustible ni inyectores.'] : [],
      source: 'Regla de baja potencia y humo',
    });
  },
};

const fuelContaminationRulePack: RulePack = {
  id: 'fuel_contamination',
  system: 'Combustible - agua o contaminacion',
  source: 'Regla de combustible contaminado',
  triggers: ['agua en diesel', 'agua en combustible', 'diesel sucio', 'combustible sucio', 'falla despues de cargar diesel'],
  match: (combined) => hasAny(combined, ['agua en diesel', 'agua en combustible', 'diesel sucio', 'combustible sucio', 'falla despues de cargar diesel', 'se apaga despues de cargar']),
  evaluate: () => makeResult({
    system: 'Combustible - agua o contaminacion',
    severity: 'ALTA',
    operationalDecision: 'No seguir operando hasta drenar y confirmar combustible limpio.',
    likelyCauses: ['Agua en separador o tanque', 'Filtro saturado por contaminacion', 'Baja presion de alimentacion por restriccion'],
    nextTests: ['Drenar separador de agua', 'Tomar muestra de tanque en recipiente transparente', 'Cambiar filtros si hay agua/sedimento', 'Medir presion de alimentacion'],
    question: 'La muestra de diesel sale limpia o con agua/sedimento abajo?',
    warnings: ['Agua en diesel puede danar inyectores y bomba.'],
    source: 'Regla de combustible contaminado',
  }),
};

const noStartRulePack: RulePack = {
  id: 'no_start',
  system: 'Arranque / motor no prende',
  source: 'Regla de no arranque',
  triggers: ['no prende', 'no arranca', 'no enciende', 'no da marcha', 'no quiere prender'],
  match: (combined) => hasAny(combined, ['no prende', 'no arranca', 'no enciende', 'no da marcha', 'no quiere prender']),
  evaluate: (combined) => {
    const noCrank = hasAny(combined, ['no da marcha', 'no gira', 'no mueve motor']);
    return makeResult({
      system: noCrank ? 'Arranque electrico' : 'Arranque / combustible / ECM',
      severity: 'ALTA',
      operationalDecision: 'Equipo fuera de servicio hasta separar si no gira o gira y no prende.',
      likelyCauses: noCrank
        ? ['Bateria baja o terminal floja', 'Motor de arranque/rele', 'Interlock de neutral, freno o seguridad']
        : ['Falta de combustible o baja presion', 'Sensor/ECM sin senal de arranque', 'Filtro o aire en lineas'],
      nextTests: noCrank
        ? ['Medir voltaje de bateria en reposo y al dar arranque', 'Revisar terminales, tierra y rele de arranque', 'Confirmar neutral/interlock']
        : ['Confirmar si gira normal', 'Leer codigos activos', 'Medir presion de combustible', 'Purgar aire si se cambiaron filtros'],
      question: noCrank ? 'Cuando das llave, el motor gira o solo hace click?' : 'El motor gira normal pero no prende, o no gira nada?',
      warnings: ['No insistir mucho tiempo con arranque; puede danar motor de arranque o descargar baterias.'],
      source: 'Regla de no arranque',
    });
  },
};

const batteryChargingRulePack: RulePack = {
  id: 'battery_charging',
  system: 'Sistema electrico - carga / bateria',
  source: 'Regla de bateria y alternador',
  triggers: ['bateria', 'alternador', 'no carga', 'luz bateria', 'se descarga', 'voltaje bajo'],
  match: (combined) => hasAny(combined, ['bateria', 'alternador', 'no carga', 'luz bateria', 'se descarga', 'voltaje bajo']),
  evaluate: () => makeResult({
    system: 'Sistema electrico - carga / bateria',
    severity: 'MEDIA',
    operationalDecision: 'Puede mover solo si voltaje se mantiene y no hay otros avisos criticos; confirmar carga primero.',
    likelyCauses: ['Alternador no cargando', 'Bateria debil o celda mala', 'Terminal/tierra floja o sulfatada'],
    nextTests: ['Medir voltaje apagado', 'Medir voltaje con motor encendido', 'Revisar banda, terminales y tierra', 'Hacer prueba de carga de bateria'],
    question: 'Cuanto voltaje marca apagado y con motor encendido?',
    warnings: ['Voltaje bajo puede apagar ECM o dejar equipo parado en ruta.'],
    source: 'Regla de bateria y alternador',
  }),
};

const engineStallRulePack: RulePack = {
  id: 'engine_stall',
  system: 'Motor - se apaga / falla intermitente',
  source: 'Regla de motor que se apaga',
  triggers: ['se apaga', 'se paro', 'se para', 'se muere', 'se apaga solo'],
  match: (combined) => hasAny(combined, ['se apaga', 'se paro', 'se para', 'se muere', 'se apaga solo']),
  evaluate: () => makeResult({
    system: 'Motor - se apaga / falla intermitente',
    severity: 'ALTA',
    operationalDecision: 'No cargar hasta saber si es combustible, electrico o proteccion por temperatura/aceite.',
    likelyCauses: ['Baja presion de combustible o filtro restringido', 'Falla electrica/intermitente en alimentacion ECM', 'Proteccion por temperatura, aceite o codigo activo'],
    nextTests: ['Leer codigos activos e historicos', 'Revisar si se apaga cargado, caliente o al ralenti', 'Medir presion de combustible cuando falla', 'Revisar voltaje ECM y tierras'],
    question: 'Se apaga cargado, caliente, al ralenti o al pasar por bache?',
    warnings: ['Si se apaga por aceite o temperatura, no volver a operar hasta confirmar causa.'],
    source: 'Regla de motor que se apaga',
  }),
};

const transmissionRulePack: RulePack = {
  id: 'transmission',
  system: 'Transmision',
  source: 'Regla de transmision',
  triggers: ['no cambia', 'patina', 'golpea cambio', 'transmision', 'caja', 'se queda en cambio', 'no entra velocidad'],
  match: (combined) => hasAny(combined, ['no cambia', 'patina', 'golpea cambio', 'transmision', 'caja', 'se queda en cambio', 'no entra velocidad']),
  evaluate: () => makeResult({
    system: 'Transmision',
    severity: 'ALTA',
    operationalDecision: 'No cargar hasta revisar nivel, temperatura y codigos de transmision.',
    likelyCauses: ['Nivel/temperatura de aceite de transmision fuera de rango', 'Solenoide o sensor de velocidad', 'Desgaste interno si patina bajo carga'],
    nextTests: ['Revisar nivel de aceite segun procedimiento', 'Leer codigos de transmision', 'Ver temperatura y presion si aplica', 'Probar cambios sin carga en area segura'],
    question: 'Falla en todos los cambios o solo en uno especifico?',
    warnings: ['Seguir operando si patina puede quemar la transmision.'],
    source: 'Regla de transmision',
  }),
};

const steeringRulePack: RulePack = {
  id: 'steering',
  system: 'Direccion',
  source: 'Regla de direccion',
  triggers: ['direccion dura', 'no gira', 'gira lento', 'volante duro', 'direccion', 'articulacion dura'],
  match: (combined) => hasAny(combined, ['direccion dura', 'no gira', 'gira lento', 'volante duro', 'direccion', 'articulacion dura']),
  evaluate: () => makeResult({
    system: 'Direccion',
    severity: 'ALTA',
    operationalDecision: 'NO OPERAR si direccion no responde normal.',
    likelyCauses: ['Nivel hidraulico bajo o bomba con baja presion', 'Valvula de direccion/orbitrol', 'Cilindro o articulacion con traba'],
    nextTests: ['Revisar nivel hidraulico', 'Buscar fugas en cilindros y mangueras de direccion', 'Medir presion de direccion', 'Verificar articulacion y pasadores'],
    question: 'La direccion esta dura para ambos lados o solo para un lado?',
    warnings: ['Falla de direccion es riesgo directo de seguridad.'],
    source: 'Regla de direccion',
  }),
};

const suspensionRulePack: RulePack = {
  id: 'suspension',
  system: 'Suspension / articulacion',
  source: 'Regla de suspension y articulacion',
  triggers: ['se ladea', 'caido de un lado', 'suspension', 'amortiguador', 'bolsa', 'articulacion floja'],
  match: (combined) => hasAny(combined, ['se ladea', 'caido de un lado', 'suspension', 'amortiguador', 'bolsa', 'articulacion floja']),
  evaluate: () => makeResult({
    system: 'Suspension / articulacion',
    severity: 'MEDIA',
    operationalDecision: 'Limitar velocidad y carga hasta inspeccion visual.',
    likelyCauses: ['Amortiguador/suspension con fuga o desgaste', 'Buje o pasador de articulacion con juego', 'Presion/altura desigual segun sistema'],
    nextTests: ['Comparar altura lado a lado en piso plano', 'Inspeccionar fugas y bujes', 'Buscar juego con equipo asegurado', 'Revisar llantas y presion si aplica'],
    question: 'Esta caido de un lado parado o solo cuando va cargado?',
    warnings: ['No revisar debajo sin bloqueo mecanico seguro.'],
    source: 'Regla de suspension y articulacion',
  }),
};

const vibrationRulePack: RulePack = {
  id: 'vibration',
  system: 'Vibracion / tren motriz',
  source: 'Regla de vibracion',
  triggers: ['vibra', 'tiembla', 'brinca', 'golpetea', 'vibracion'],
  match: (combined) => hasAny(combined, ['vibra', 'tiembla', 'brinca', 'golpetea', 'vibracion']),
  evaluate: () => makeResult({
    system: 'Vibracion / tren motriz',
    severity: 'MEDIA',
    operationalDecision: 'Operar solo para prueba corta; parar si vibracion aumenta o hay ruido metalico.',
    likelyCauses: ['Llanta/rueda o componente suelto', 'Cardan/cruceta o soporte de motor', 'Mando final o rodamiento si vibra con velocidad'],
    nextTests: ['Definir si vibra parado, rodando o cargado', 'Revisar ruedas/tuercas y soportes', 'Inspeccionar cardan/crucetas si aplica', 'Buscar temperatura o juego en rodamientos'],
    question: 'Vibra parado acelerando, o solo cuando va caminando?',
    warnings: ['Vibracion con ruido metalico requiere parar.'],
    source: 'Regla de vibracion',
  }),
};

const exhaustSmokeRulePack: RulePack = {
  id: 'smoke_color',
  system: 'Motor - humo por color',
  source: 'Regla de humo por color',
  triggers: ['humo blanco', 'humo azul', 'humo gris'],
  match: (combined) => hasAny(combined, ['humo blanco', 'humo azul', 'humo gris']),
  evaluate: (combined) => {
    const white = combined.includes('humo blanco');
    const blue = combined.includes('humo azul');
    return makeResult({
      system: 'Motor - humo por color',
      severity: 'ALTA',
      operationalDecision: 'No cargar hasta identificar si es combustible, coolant o aceite quemado.',
      likelyCauses: white
        ? ['Combustible sin quemar/inyeccion', 'Coolant entrando a combustion si baja nivel', 'Motor frio o falla de calentamiento']
        : blue
          ? ['Aceite quemado por turbo, guias o anillos', 'Nivel de aceite alto', 'Respiradero obstruido']
          : ['Combustion incompleta o mezcla irregular'],
      nextTests: ['Confirmar color del humo en frio y caliente', 'Revisar niveles de aceite y coolant', 'Leer codigos activos', 'Revisar turbo/inyeccion segun color'],
      question: 'El humo sale blanco, azul o negro, y aparece en frio o cargado?',
      warnings: ['Si baja coolant o aceite, detener y no cargar.'],
      source: 'Regla de humo por color',
    });
  },
};

const faultCodeRulePack: RulePack = {
  id: 'fault_code_generic',
  system: 'Codigo de falla / electronico',
  source: 'Regla de codigo de falla',
  triggers: ['codigo', 'code', 'falla activa', 'check engine', 'luz motor'],
  match: (combined) => hasAny(combined, ['codigo', 'code', 'falla activa', 'check engine', 'luz motor']) && !oilContextActive(combined),
  evaluate: () => makeResult({
    system: 'Codigo de falla / electronico',
    severity: 'MEDIA',
    operationalDecision: 'No cambiar partes hasta confirmar codigo activo, sistema y prueba electrica.',
    likelyCauses: ['Sensor o cableado del sistema reportado', 'Conector flojo o sulfatado', 'Falla intermitente historica si el codigo no esta activo'],
    nextTests: ['Anotar codigo exacto y si esta activo o historico', 'Leer datos en vivo del sensor relacionado', 'Revisar conector/cableado antes de cambiar pieza'],
    question: 'Cual es el codigo exacto y aparece activo o historico?',
    warnings: ['No comprar sensor solo por codigo; primero confirmar cableado y lectura.'],
    source: 'Regla de codigo de falla',
  }),
};

const brakeRulePack: RulePack = {
  id: 'brake',
  system: 'Frenos / freno de parqueo',
  source: 'Regla de frenos',
  triggers: ['freno', 'brake', 'parqueo', 'parking', 'no frena'],
  match: (combined) => hasAny(combined, ['freno', 'brake', 'parqueo', 'parking', 'no frena']) && !hasAny(combined, ['freno de motor', 'jake']),
  evaluate: (combined) => makeResult({
    system: 'Frenos / freno de parqueo',
    severity: hasAny(combined, ['no frena', 'falla', 'no suelta']) ? 'ALTA' : 'MEDIA',
    operationalDecision: hasAny(combined, ['no frena', 'falla'])
      ? 'NO OPERAR hasta confirmar freno de servicio y parqueo.'
      : 'No mover hasta verificar liberacion de parqueo y presion de freno.',
    likelyCauses: ['Freno de parqueo trabado o sensor de parqueo', 'Presion baja de aire o fluido de freno', 'Pastillas, zapatas o manguera con fuga'],
    nextTests: ['Confirmar si freno de parqueo libera completamente', 'Revisar presion de freno de servicio', 'Inspeccionar fugas en mangueras y cilindros'],
    question: 'El freno de parqueo libera y el pedal de servicio se siente firme?',
    warnings: ['No mover el equipo si no frena seguro.'],
    source: 'Regla de frenos',
  }),
};

const hydraulicRulePack: RulePack = {
  id: 'hydraulic',
  system: 'Hidraulico',
  source: 'Regla de fuga o baja fuerza hidraulica',
  triggers: ['fuga hidraulica', 'bota aceite', 'cilindro', 'manguera', 'lento hidraulico', 'no levanta', 'hidraulico'],
  match: (combined) => {
    const hydraulic = hasAny(combined, ['hidraulico', 'cilindro', 'manguera', 'no levanta', 'lento hidraulico']);
    const leak = hasAny(combined, ['fuga hidraulica', 'bota aceite']);
    return hydraulic || (leak && !oilContextActive(combined));
  },
  evaluate: (combined) => makeResult({
    system: 'Hidraulico',
    severity: 'ALTA',
    operationalDecision: hasAny(combined, ['fuga', 'bota'])
      ? 'NO OPERAR bajo carga hasta ubicar fuga y confirmar nivel.'
      : 'Limitar carga hasta medir presion y nivel hidraulico.',
    likelyCauses: ['Manguera, fitting o sello de cilindro con fuga', 'Nivel bajo o aire en el sistema', 'Bomba o valvula con baja entrega'],
    nextTests: ['Ubicar punto exacto de fuga o circuito lento', 'Limpiar zona y hacer prueba corta observando goteo', 'Revisar nivel y filtros hidraulicos', 'Medir presion principal si sigue debil'],
    question: 'Donde gotea o que funcion quedo lenta: brazo, dump o direccion?',
    warnings: ['Fuga activa bajo presion puede causar incendio o dano a bomba.'],
    source: 'Regla de fuga o baja fuerza hidraulica',
  }),
};

const UPPER_ROLLER_TERMS = ['rolo superior', 'rol superior', 'rodillo superior', 'carrier roller', 'rolo sup'];

const undercarriageRulePack: RulePack = {
  id: 'undercarriage',
  system: 'Tren de rodaje / mando final',
  source: 'Regla de ruido abajo / tren',
  triggers: ['truena abajo', 'ruido abajo', 'mando final', 'rolo inferior', 'rodillo inferior', 'tren de rodaje', 'truena feo'],
  match: (combined) => hasAny(combined, ['truena abajo', 'ruido abajo', 'mando final', 'rolo inferior', 'rodillo inferior', 'tren de rodaje', 'truena feo', 'rolo superior', 'rol superior']),
  evaluate: (combined, input) => {
    const hm400 = isHm400Equipment(input.equipo);
    const mentionsUpper = hasAny(combined, UPPER_ROLLER_TERMS);
    if (hm400 && mentionsUpper) {
      return makeResult({
        system: 'Tren de rodaje HM400-3',
        severity: 'ALTA',
        operationalDecision: 'NO OPERAR bajo carga hasta ubicar el ruido en componente correcto.',
        likelyCauses: ['Rolo inferior, guia, sprocket o mando final - HM400-3 no tiene rolo superior', 'Cadena, buje o pin con desgaste', 'Sello o rodamiento de mando final'],
        nextTests: ['Revisar rolo inferior, guia, sprocket y mando final segun zona del ruido', 'Buscar juego lateral y fuga en mandos finales', 'Mover pocos metros en area segura para ubicar el lado'],
        question: 'El ruido viene del lado derecho, izquierdo o de un mando final?',
        warnings: ['En HM400-3 no aplica rolo superior. Revisemos rolo inferior, guia, sprocket, mando final o suspension segun zona del ruido.'],
        source: 'Regla HM400-3 tren de rodaje',
      });
    }

    return makeResult({
      system: 'Tren de rodaje / mando final',
      severity: 'ALTA',
      operationalDecision: 'NO OPERAR bajo carga si hay ruido metalico fuerte.',
      likelyCauses: hm400
        ? ['Rolo inferior, guia, sprocket o mando final', 'Cadena o buje con desgaste', 'Rodamiento de mando final']
        : ['Rodillo inferior o superior con rodamiento danado', 'Cadena, buje o sprocket', 'Mando final con juego o fuga'],
      nextTests: hm400
        ? ['Revisar rolo inferior, guia, sprocket y mandos finales', 'Buscar juego y fuga de aceite', 'Ubicar lado del ruido con movimiento corto']
        : ['Revisar rodillos, cadena y mandos finales', 'Buscar juego lateral y temperatura', 'Ubicar lado del ruido'],
      question: 'El ruido es constante o solo al girar/mover carga?',
      warnings: hasAny(combined, ['truena', 'metalico']) ? ['Ruido metalico fuerte puede danar mando final o cadena.'] : [],
      source: 'Regla de ruido abajo / tren',
    });
  },
};

const RULE_PACKS: RulePack[] = [
  oilRulePack,
  coolantLeakRulePack,
  overheatRulePack,
  fuelContaminationRulePack,
  noStartRulePack,
  batteryChargingRulePack,
  engineStallRulePack,
  airFilterRulePack,
  lowPowerRulePack,
  transmissionRulePack,
  steeringRulePack,
  brakeRulePack,
  hydraulicRulePack,
  suspensionRulePack,
  vibrationRulePack,
  exhaustSmokeRulePack,
  undercarriageRulePack,
  faultCodeRulePack,
];

export function applyDiagnosticRules(input: DiagnosticRuleInput): DiagnosticRuleResult | null {
  const combined = combinedInput(input);
  for (const pack of RULE_PACKS) {
    if (!pack.match(combined, input)) continue;
    const result = pack.evaluate(combined, input);
    if (result.matched) return result;
  }
  return null;
}

export function ruleResultToContextBlock(rule: DiagnosticRuleResult): string {
  return [
    'REGLA DETERMINISTICA ACTIVA (no contradecir):',
    `Sistema: ${rule.system}.`,
    `Severidad: ${rule.severity}.`,
    `Decision operativa obligatoria: ${rule.operationalDecision}.`,
    rule.safetyLock?.locked ? `BLOQUEO DE SEGURIDAD: ${rule.safetyLock.reason} Desbloqueo: ${rule.safetyLock.unlockCondition}.` : '',
    `Causas probables: ${rule.likelyCauses.join(' | ')}.`,
    `Siguientes pruebas: ${rule.nextTests.join(' | ')}.`,
    `Pregunta obligatoria: ${rule.question}.`,
    rule.warnings.length ? `Advertencias: ${rule.warnings.join(' | ')}.` : '',
    `Fuente regla: ${rule.source}.`,
  ].filter(Boolean).join('\n');
}
