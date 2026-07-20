const DEFAULT_PRIORITY = 'MEDIA';
const PHOTO_ANALYSIS_SCHEMA_KEYS = [
  'componente_probable',
  'tipo_de_dano',
  'severidad',
  'recomendacion_inicial',
];
const DIAGNOSE_SCHEMA_KEYS = [
  'causas_probables',
  'checklist_diagnostico',
  'partes_probables',
  'prioridad',
];

function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function inferEquipmentLabel(equipo = '') {
  const raw = String(equipo || '').trim();
  return raw || 'equipo no especificado';
}

function uniqueStrings(values) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ),
  );
}

function stripJsonFence(value) {
  return String(value || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function parseJsonObject(raw) {
  const text = stripJsonFence(raw);
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  const candidate = start >= 0 && end > start ? text.slice(start, end + 1) : text;
  return JSON.parse(candidate);
}

function normalizeSeverity(value) {
  const text = normalizeText(value);
  if (text.includes('alta') || text.includes('high') || text.includes('crit')) return 'ALTA';
  if (text.includes('baja') || text.includes('low')) return 'BAJA';
  return 'MEDIA';
}

function validatePhotoAnalysisPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Vision provider returned an invalid payload');
  }

  const result = {
    componente_probable: String(payload.componente_probable || '').trim(),
    tipo_de_dano: String(payload.tipo_de_dano || '').trim(),
    severidad: normalizeSeverity(payload.severidad || ''),
    recomendacion_inicial: String(payload.recomendacion_inicial || '').trim(),
  };

  for (const key of PHOTO_ANALYSIS_SCHEMA_KEYS) {
    if (!result[key]) {
      throw new Error(`Vision provider omitted ${key}`);
    }
  }

  const combined = normalizeText(Object.values(result).join(' '));
  const genericSignals = [
    'componente visible',
    'imagen recibida para inspeccion visual',
    'requiere confirmar zona exacta',
    'enviar una segunda foto',
    'no pude analizar',
  ];
  if (genericSignals.some((signal) => combined.includes(signal))) {
    throw new Error('Vision provider returned a generic non-diagnostic answer');
  }

  return result;
}

function coerceStringArray(value) {
  if (Array.isArray(value)) {
    return uniqueStrings(value.map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') return Object.values(item).join(' ');
      return '';
    }));
  }
  if (typeof value === 'string') return uniqueStrings([value]);
  return [];
}

function validateDiagnosePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Diagnose provider returned an invalid payload');
  }

  const result = {
    causas_probables: coerceStringArray(payload.causas_probables).slice(0, 4),
    checklist_diagnostico: coerceStringArray(payload.checklist_diagnostico).slice(0, 6),
    partes_probables: coerceStringArray(payload.partes_probables).slice(0, 4),
    tiempo_estimado_hrs: Number(payload.tiempo_estimado_hrs) > 0 ? Number(payload.tiempo_estimado_hrs) : 1.5,
    prioridad: normalizeSeverity(payload.prioridad || DEFAULT_PRIORITY),
    advertencias: coerceStringArray(payload.advertencias).slice(0, 3),
    decision_operativa: String(payload.decision_operativa || '').trim(),
    pregunta_clave: String(payload.pregunta_clave || '').trim(),
    nota_tecnica: String(payload.nota_tecnica || '').trim(),
  };

  for (const key of DIAGNOSE_SCHEMA_KEYS) {
    if (Array.isArray(result[key]) && result[key].length === 0) {
      throw new Error(`Diagnose provider omitted ${key}`);
    }
    if (!Array.isArray(result[key]) && !result[key]) {
      throw new Error(`Diagnose provider omitted ${key}`);
    }
  }

  const combined = normalizeText([
    ...result.causas_probables,
    ...result.checklist_diagnostico,
    ...result.partes_probables,
    result.nota_tecnica,
  ].join(' '));
  const genericSignals = [
    'falla no aislada',
    'dato de sintoma insuficiente',
    'filtros de servicio',
    'sensores o conectores de la zona',
  ];
  if (genericSignals.some((signal) => combined.includes(signal))) {
    throw new Error('Diagnose provider returned a generic answer');
  }

  return result;
}

function inferOperationalDecision(input = {}, result = {}) {
  const combined = normalizeText([
    input.contexto || '',
    input.sintoma || '',
    ...(result.causas_probables || []),
    ...(result.checklist_diagnostico || []),
    ...(result.advertencias || []),
    result.nota_tecnica || '',
  ].join(' '));

  if (
    (combined.includes('luz') || combined.includes('alerta') || combined.includes('testigo'))
    && combined.includes('aceite')
  ) {
    return 'NO OPERAR. No mover hasta medir presion real de aceite con manometro.';
  }
  if (combined.includes('presion de aceite') && hasAny(combined, ['baja', 'encendida', 'activa'])) {
    return 'NO OPERAR. Confirmar presion real de aceite antes de mover.';
  }
  if (hasAny(combined, ['freno', 'brake']) && hasAny(combined, ['no frena', 'pedal se va', 'falla'])) {
    return 'NO OPERAR. Revisar frenos antes de mover.';
  }
  if (hasAny(combined, ['truena', 'ruido metalico', 'mando final'])) {
    return 'NO OPERAR bajo carga. Solo mover pocos metros si es indispensable y seguro.';
  }
  if (normalizeSeverity(result.prioridad) === 'ALTA') {
    return 'NO OPERAR hasta completar la prueba critica indicada.';
  }
  return result.decision_operativa || 'Puede continuar solo si niveles, temperatura y frenos estan normales.';
}

function inferKeyQuestion(input = {}, result = {}) {
  if (result.pregunta_clave) return result.pregunta_clave;
  const combined = normalizeText(`${input.contexto || ''} ${input.sintoma || ''}`);
  if (combined.includes('aceite')) return '¿Cuanto marco la presion real de aceite con manometro en ralenti?';
  if (combined.includes('calienta') || combined.includes('temperatura')) return '¿La temperatura real coincide con el tablero usando pistola o scanner?';
  if (combined.includes('humo negro') || combined.includes('burro')) return '¿Cuanta presion de turbo marca bajo carga?';
  return '¿Que lectura o prueba puedes confirmar ahora?';
}

function isHm400(equipo = '') {
  return normalizeText(equipo).includes('hm400');
}

function applyEquipmentRules(equipo, values) {
  if (!isHm400(equipo)) return values;
  return values.filter((value) => {
    const text = normalizeText(value);
    return !text.includes('carrier roller')
      && !text.includes('rol superior')
      && !text.includes('rolo superior')
      && !text.includes('rodillo superior')
      && !text.includes('rodillo inferior o superior');
  });
}

function removeAlreadyCheckedSuggestions(input, values) {
  const text = normalizeText(`${input.codigo_falla || ''} ${input.sintoma || ''}`);
  let cleaned = values;

  if (
    hasAny(text, ['ya cambie filtros', 'cambie filtros', 'filtro nuevo', 'filtros nuevos'])
    || (hasAny(text, ['ya revise', 'ya revisamos', 'ya checaron']) && text.includes('filtro'))
  ) {
    cleaned = cleaned.filter((value) => !normalizeText(value).includes('filtro'));
  }

  if (hasAny(text, ['radiador esta bien', 'radiador limpio', 'ya revise el radiador'])) {
    cleaned = cleaned.filter((value) => !normalizeText(value).includes('radiador'));
  }

  return cleaned;
}

function applyEquipmentRulesToPhotoResult(equipo, result) {
  const cleaned = { ...result };
  for (const key of PHOTO_ANALYSIS_SCHEMA_KEYS) {
    const filtered = applyEquipmentRules(equipo, [cleaned[key]]);
    if (filtered.length === 0) {
      throw new Error(`Vision result violates equipment rules for ${equipo}`);
    }
    cleaned[key] = filtered[0];
  }
  return cleaned;
}

function appendUniqueSentences(existing, additions) {
  const parts = String(existing || '')
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const seen = new Set(parts.map((item) => normalizeText(item)));
  for (const addition of additions) {
    const sentence = String(addition || '').trim();
    if (!sentence) continue;
    const key = normalizeText(sentence);
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(sentence);
  }
  return parts.join(' ');
}

function hardenDashboardPhotoResult(input = {}, result = {}) {
  const equipo = inferEquipmentLabel(input.equipo);
  const combined = normalizeText([
    input.contexto || '',
    input.texto || '',
    input.sintoma || '',
    result.componente_probable || '',
    result.tipo_de_dano || '',
    result.recomendacion_inicial || '',
  ].join(' '));

  const isDashboard = hasAny(combined, ['tablero', 'panel', 'monitor', 'instrumentos', 'dashboard']);
  if (!isDashboard) return result;

  const mentionsOil = hasAny(combined, ['aceite', 'oil', 'lubricacion', 'lubrication', 'presion de aceite', 'oil pressure', 'oil lamp']);
  const mentionsBrake = hasAny(combined, ['freno', 'brake', 'parqueo', 'parking']);
  const mentionsCoolant = hasAny(combined, ['coolant', 'temperatura', 'calienta', 'caliente', 'hierve', 'anticongelante', 'refrigerante']);
  const mentionsAirFilter = hasAny(combined, ['filtro de aire', 'air filter', 'restriccion de aire', 'air restriction']);

  let hardened = { ...result };
  let severidad = normalizeSeverity(result.severidad || 'MEDIA');
  const safetyLines = [];
  const damageLines = [];

  if (mentionsOil) {
    severidad = 'ALTA';
    damageLines.push('Alertas activas en tablero: posible alerta de presion/nivel de aceite de motor.');
    damageLines.push('Tratar como condicion critica hasta confirmar presion real.');
    safetyLines.push('NO OPERAR ni mover el equipo hasta medir presion real de aceite con manometro.');
    safetyLines.push('Verificar nivel de aceite con bayoneta.');
    safetyLines.push('Si el nivel esta correcto, leer codigos activos con escaner y revisar sensor/cableado de presion de aceite.');
    hardened.componente_probable = hardened.componente_probable || 'Tablero de instrumentos / sistema de lubricacion del motor';
  }

  if (mentionsBrake) {
    severidad = hasAny(combined, ['no frena', 'falla', 'activa', 'encendida']) ? 'ALTA' : 'MEDIA';
    damageLines.push('Alerta o indicador de freno/parqueo visible en tablero.');
    safetyLines.push('No mover hasta confirmar liberacion de freno de parqueo y presion de freno de servicio.');
    hardened.componente_probable = hardened.componente_probable || 'Tablero / sistema de frenos';
  }

  if (mentionsCoolant) {
    const overheatingActive = hasAny(combined, ['alta', 'activa', 'encendida', 'hierve', 'sobrecalent']);
    if (overheatingActive) severidad = 'ALTA';
    damageLines.push('Indicador de temperatura o coolant en tablero.');
    safetyLines.push('Limitar operacion hasta medir temperatura real y confirmar ventilador.');
    hardened.componente_probable = hardened.componente_probable || 'Tablero / sistema de enfriamiento';
  }

  if (mentionsAirFilter) {
    if (severidad === 'MEDIA' || severidad === 'BAJA') severidad = 'MEDIA';
    damageLines.push('Indicador de restriccion de aire o filtro en tablero.');
    safetyLines.push('Revisar filtro de aire, indicador de restriccion y trayecto de admision antes de cargar fuerte.');
    hardened.componente_probable = hardened.componente_probable || 'Tablero / admision de aire';
  }

  if (damageLines.length === 0 && safetyLines.length === 0) {
    return isHm400(equipo) && mentionsOil ? hardened : result;
  }

  hardened = {
    ...hardened,
    componente_probable: hardened.componente_probable || result.componente_probable,
    tipo_de_dano: appendUniqueSentences(result.tipo_de_dano, damageLines),
    severidad,
    recomendacion_inicial: appendUniqueSentences(result.recomendacion_inicial, safetyLines),
  };

  if (isHm400(equipo) && mentionsOil) {
    hardened.componente_probable = 'Tablero de instrumentos / sistema de lubricacion del motor';
    hardened.severidad = 'ALTA';
  }

  return hardened;
}

const DIAGNOSE_PROFILES = [
  {
    id: 'oil_leak',
    match: (text) => hasAny(text, ['bota aceite', 'fuga aceite', 'tirando aceite', 'pierde aceite', 'oil leak']),
    prioridad: 'ALTA',
    causas: [
      'Reten, empaque o sello con desgaste en la zona de fuga.',
      'Manguera o linea presurizada con grieta, abrazadera floja o union mal asentada.',
      'Sobrepresion interna por respiradero tapado o nivel excesivo del fluido.',
    ],
    checklist: [
      'Ubicar exactamente si la fuga viene de motor, transmision, hidraulico o mando final antes de desmontar.',
      'Limpiar la zona, arrancar unos minutos y confirmar el punto de salida del aceite.',
      'Revisar nivel del fluido afectado y no operar si el nivel ya quedo por debajo del minimo.',
      'Verificar mangueras, retenes, tapas, filtro y respiraderos antes de cambiar componentes mayores.',
    ],
    partes: ['Kit de sellos', 'Manguera o linea afectada', 'Abrazaderas y o-rings de la zona'],
    nota: 'No cambiar bomba o componente mayor hasta confirmar el punto exacto de fuga.',
  },
  {
    id: 'overheat',
    match: (text) => hasAny(text, ['sobrecalent', 'calienta', 'temperature high', 'e015']),
    prioridad: 'ALTA',
    causas: [
      'Radiador, enfriador o filtro de aire externo con obstruccion por polvo o lodo.',
      'Termostato pegado, bomba de agua con baja circulacion o banda floja.',
      'Ventilador, embrague de ventilador o sensor de temperatura trabajando fuera de rango.',
    ],
    checklist: [
      'Parar carga pesada y revisar nivel de coolant con la maquina fria.',
      'Soplar radiador, aftercooler y condensador del lado correcto de flujo.',
      'Revisar banda, fugas, termostato y temperatura real con herramienta de medicion.',
      'Confirmar que el ventilador entre cuando sube la temperatura y que no haya restriccion de aire.',
    ],
    partes: ['Termostato', 'Bomba de agua', 'Banda o tensor del ventilador'],
    nota: 'Si hierve o presuriza rapido, revisar empaque de culata antes de seguir operando.',
  },
  {
    id: 'low_power_smoke',
    match: (text) => hasAny(text, ['pierde potencia', 'jala poco', 'sin fuerza', 'echa humo', 'humo negro', 'consumo alto diesel']),
    prioridad: 'ALTA',
    causas: [
      'Filtro de aire o de combustible restringido, causando mezcla rica o alimentacion deficiente.',
      'Inyectores sucios o con goteo, o presencia de agua/aire en el sistema de combustible.',
      'Turbo, mangueras de admision o sensor de presion con fuga o lectura fuera de rango.',
    ],
    checklist: [
      'Revisar filtro de aire, prefiltro, indicadores de restriccion y limpiar la admision.',
      'Drenar separador de agua, revisar filtros de combustible y cebado del sistema.',
      'Inspeccionar turbo, mangueras de aire y humo de escape para definir si el problema es aire o combustible.',
      'Confirmar codigos activos y presion de carga antes de cambiar inyectores.',
    ],
    partes: ['Filtro de aire', 'Filtros de combustible', 'Juego de mangueras de admision'],
    nota: 'No condenar inyectores sin revisar primero aire, combustible y turbo.',
  },
  {
    id: 'undercarriage_noise',
    match: (text) => hasAny(text, ['truena feo abajo', 'ruido abajo', 'tren de rodaje', 'track roller', 'rolo', 'rol inferior', 'mandos finales', 'vibracion excesiva']),
    prioridad: 'ALTA',
    causas: [
      'Rodillo inferior o superior con rodamiento dañado o sin lubricacion.',
      'Buje, pin, cadena o sprocket con desgaste avanzado y contacto metal-metal.',
      'Mando final o rueda guia con juego excesivo, sello dañado o fijacion floja.',
    ],
    checklist: [
      'Parar la maquina y revisar visualmente rodillos, cadena, sprocket, rueda guia y mandos finales.',
      'Buscar juego lateral, fuga de aceite y temperatura anormal en rodillos o mandos finales.',
      'Revisar tension de cadena y desgaste disparejo en zapatas, bujes y dientes.',
      'Mover pocos metros en area segura para ubicar si el ruido viene de un lado especifico.',
    ],
    partes: ['Track roller o carrier roller', 'Sprocket o rueda guia', 'Sellos y aceite de mando final'],
    nota: 'Si hay ruido metalico fuerte, no seguir trabajando hasta ubicar el componente exacto.',
  },
  {
    id: 'starting',
    match: (text) => hasAny(text, ['no arranca', 'arranque dificil', 'en frio', 'no prende']),
    prioridad: 'MEDIA',
    causas: [
      'Bateria baja, cables flojos o caida de voltaje en arranque.',
      'Sistema de combustible descebado, filtro restringido o aire en la linea.',
      'Motor de arranque, relevador o switch de arranque con falla intermitente.',
    ],
    checklist: [
      'Medir voltaje de bateria en reposo y durante el arranque.',
      'Revisar terminales, tierras, fusibles y relevadores de arranque.',
      'Confirmar cebado y flujo de combustible antes de desmontar el motor de arranque.',
      'Escuchar si el motor gira lento, gira libre o no acciona para separar electrico vs combustible.',
    ],
    partes: ['Baterias o terminales', 'Filtro de combustible', 'Motor de arranque o relevador'],
    nota: 'En frio primero separar si falta corriente o si falta combustible.',
  },
  {
    id: 'brakes',
    match: (text) => hasAny(text, ['freno', 'brake']),
    prioridad: 'ALTA',
    causas: [
      'Aire en el circuito, fuga en manguera o cilindro, o nivel bajo del fluido.',
      'Pastillas, zapatas o discos con desgaste fuera de especificacion.',
      'Bomba, valvula o actuador de freno con carrera irregular o baja presion.',
    ],
    checklist: [
      'Revisar nivel, fugas externas y estado de lineas antes de purgar.',
      'Inspeccionar desgaste de elementos de friccion y temperatura de las ruedas.',
      'Purgar el circuito si se abrio una linea o el pedal se siente esponjoso.',
      'Confirmar presion y respuesta del actuador antes de cambiar la bomba.',
    ],
    partes: ['Kit de frenos', 'Manguera o cilindro de freno', 'Bomba o valvula de freno'],
    nota: 'Si el equipo no frena seguro, sacarlo de operacion hasta corregir.',
  },
  {
    id: 'hydraulic_pressure',
    match: (text) => hasAny(text, ['presion hidraulica', 'hidraulico', 'bomba hidraulica', 'no camina bien', 'levante lento']),
    prioridad: 'ALTA',
    causas: [
      'Filtro de retorno o succion restringido y nivel de aceite hidraulico fuera de rango.',
      'Bomba principal desgastada o con baja entrega por fuga interna.',
      'Valvula principal, alivio o actuador con fuga interna o spool pegado.',
    ],
    checklist: [
      'Confirmar nivel y estado del aceite hidraulico antes de medir presiones.',
      'Revisar filtros, coladores y presencia de aire o espuma en el tanque.',
      'Medir presion principal y pilotaje para separar bomba de valvulas/actuadores.',
      'Comparar velocidad del movimiento afectado contra los demas circuitos.',
    ],
    partes: ['Filtro hidraulico', 'Bomba principal', 'Kit de sellos o valvula de alivio'],
    nota: 'No condenar bomba sin medir presion y descartar restriccion de filtro.',
  },
];

const DEFAULT_DIAGNOSE_PROFILE = {
  prioridad: DEFAULT_PRIORITY,
  causas: [
    'Falla no aislada todavia; puede involucrar sistema de aire, combustible, lubricacion o electrico.',
    'Dato de sintoma insuficiente para condenar una pieza especifica sin inspeccion guiada.',
    'Posible problema intermitente de conexion, sensor o mantenimiento basico atrasado.',
  ],
  checklist: [
    'Confirmar equipo, sintoma exacto, cuando ocurre y si hay codigo activo.',
    'Revisar niveles, fugas visibles, filtros y conexiones basicas antes de desmontar.',
    'Separar si la falla es mecanica, hidraulica, electrica o de combustible con una prueba corta.',
    'Tomar foto, video o lectura adicional para cerrar el diagnostico con menos cambio innecesario de piezas.',
  ],
  partes: ['Filtros de servicio', 'Sensores o conectores de la zona', 'Kit de sellos o consumibles de inspeccion'],
  nota: 'Con sintoma muy abierto, primero confirma sistema afectado y codigo activo si existe.',
};

const MANUAL_PROFILES = [
  {
    id: 'oil_filter',
    match: (text) => hasAny(text, ['cambio filtro aceite', 'filtro de aceite', 'oil filter']),
    extracto: 'Procedimiento base de servicio para filtro de aceite: drenar con motor tibio, retirar filtro, lubricar sello nuevo y cebar si aplica antes de arrancar.',
    pasos: [
      'Apagar equipo, asegurar en plano y esperar a que baje la presion del sistema.',
      'Colocar bandeja de drenado, retirar filtro usado y revisar que el empaque viejo no quede pegado.',
      'Lubricar el sello del filtro nuevo con aceite limpio y enroscar hasta asiento; luego ajustar segun especificacion del fabricante.',
      'Rellenar aceite si se perdio nivel, arrancar, revisar fugas y confirmar nivel final.',
    ],
    herramientas: ['Llave para filtro', 'Recipiente de drenado', 'Aceite limpio', 'Trapos o absorbente'],
    torque: 'Ajuste del filtro: seguir el angulo de apriete del fabricante; no sobreapretar con herramienta.',
  },
  {
    id: 'head_torque',
    match: (text) => hasAny(text, ['torque culata', 'head torque', 'culata']),
    extracto: 'El apriete de culata debe hacerse con motor exacto y secuencia oficial; no es seguro usar un valor universal.',
    pasos: [
      'Confirmar serie exacta del motor antes de aplicar torque.',
      'Limpiar roscas, revisar longitud de tornillos y lubricacion especificada por el fabricante.',
      'Seguir la secuencia de apriete del centro hacia afuera por etapas.',
      'Si el procedimiento pide reapriete o angulo adicional, cumplirlo exactamente con torquimetro y goniómetro.',
    ],
    herramientas: ['Torquimetro calibrado', 'Goniómetro de apriete', 'Manual de secuencia', 'Juego de dados correcto'],
    torque: 'Usar la tabla oficial del motor por serie; no aplicar un torque generico de culata.',
  },
  {
    id: 'brake_bleed',
    match: (text) => hasAny(text, ['bleeding frenos', 'purga frenos', 'purgar frenos']),
    extracto: 'La purga de frenos debe seguir el orden del circuito y mantener el deposito lleno para evitar volver a meter aire.',
    pasos: [
      'Llenar deposito con fluido correcto y revisar que no haya fugas activas.',
      'Purgar en el orden recomendado por el fabricante, normalmente del punto mas lejano al mas cercano.',
      'Mantener el deposito por encima del minimo durante toda la purga.',
      'Verificar pedal firme y prueba estatica antes de mover el equipo.',
    ],
    herramientas: ['Llave de purga', 'Manguera transparente', 'Recipiente limpio', 'Fluido correcto'],
  },
  {
    id: 'valve_adjustment',
    match: (text) => hasAny(text, ['ajuste valvulas', 'valve adjustment', 'valvulas']),
    extracto: 'El ajuste de valvulas se realiza con motor frio o en la condicion indicada por manual, siguiendo orden de cilindros y luz especifica.',
    pasos: [
      'Confirmar si el ajuste se hace en frio o caliente para ese motor.',
      'Posicionar cada cilindro en el punto indicado del ciclo antes de medir la luz.',
      'Ajustar admision y escape con galga correcta y bloquear contratuerca sin mover el tornillo.',
      'Revisar nuevamente todas las luces despues del apriete final.',
    ],
    herramientas: ['Juego de galgas', 'Llaves fijas', 'Manual de secuencia', 'Marcador o registro de cilindros'],
  },
  {
    id: 'thermostat',
    match: (text) => hasAny(text, ['reemplazo termostato', 'cambio termostato', 'thermostat']),
    extracto: 'El termostato debe reemplazarse con motor frio, limpiando superficies y purgando el sistema de enfriamiento al final.',
    pasos: [
      'Drenar coolant hasta dejar libre la carcasa del termostato.',
      'Retirar carcasa, sacar termostato viejo y limpiar la superficie de empaque.',
      'Instalar termostato nuevo en la orientacion correcta con empaque o sellador aprobado.',
      'Rellenar coolant, purgar aire y verificar apertura con temperatura de trabajo.',
    ],
    herramientas: ['Juego de llaves', 'Recipiente para coolant', 'Rascador de empaques', 'Coolant correcto'],
  },
  {
    id: 'hydraulic_bleed',
    match: (text) => hasAny(text, ['purga sistema hidraulico', 'purgar hidraulico', 'hydraulic bleed']),
    extracto: 'La purga hidraulica debe hacerse con aceite correcto, nivel estable y movimientos lentos para expulsar aire sin cavitar la bomba.',
    pasos: [
      'Confirmar nivel de aceite hidraulico y estado del filtro antes de arrancar.',
      'Arrancar en baja, dejar estabilizar y mover el circuito afectado lentamente en todo su recorrido.',
      'Repetir ciclos cortos observando espuma, tirones o ruido de cavitacion.',
      'Parar, revisar nivel final y corregir fugas antes de volver a carga normal.',
    ],
    herramientas: ['Aceite hidraulico correcto', 'Juego de llaves', 'Recipiente y absorbente', 'Manometro si se medira presion'],
  },
];

function detectDiagnoseProfile(text) {
  return DIAGNOSE_PROFILES.find((profile) => profile.match(text)) ?? DEFAULT_DIAGNOSE_PROFILE;
}

function detectManualProfile(text) {
  return MANUAL_PROFILES.find((profile) => profile.match(text)) ?? null;
}

function inferWarnings(text) {
  const warnings = [];
  if (hasAny(text, ['freno', 'brake'])) warnings.push('No mover el equipo si la capacidad de frenado no es segura.');
  if (hasAny(text, ['calienta', 'sobrecalent', 'e015'])) warnings.push('No destapar el sistema caliente; esperar a que baje temperatura y presion.');
  if (hasAny(text, ['truena', 'ruido abajo', 'tren de rodaje', 'mando final'])) warnings.push('Parar operacion si hay ruido metalico fuerte para evitar daño mayor.');
  if (hasAny(text, ['bota aceite', 'fuga aceite'])) warnings.push('No seguir operando si el nivel del fluido ya esta por debajo del minimo.');
  return uniqueStrings(warnings);
}

export function buildDiagnoseResponse(input = {}) {
  const equipo = inferEquipmentLabel(input.equipo);
  const sintoma = normalizeText(`${input.codigo_falla || ''} ${input.sintoma || ''}`);
  const profile = detectDiagnoseProfile(sintoma);
  const warningList = inferWarnings(sintoma);

  return {
    equipo,
    causas_probables: applyEquipmentRules(equipo, uniqueStrings(profile.causas)).slice(0, 4),
    checklist_diagnostico: applyEquipmentRules(equipo, uniqueStrings(profile.checklist)).slice(0, 6),
    partes_probables: applyEquipmentRules(equipo, uniqueStrings(profile.partes)).slice(0, 4),
    tiempo_estimado_hrs: hasAny(sintoma, ['culata', 'mando final', 'bomba']) ? 3 : 1.5,
    prioridad: profile.prioridad || DEFAULT_PRIORITY,
    advertencias: warningList,
    nota_tecnica: `${profile.nota || DEFAULT_DIAGNOSE_PROFILE.nota} Equipo consultado: ${equipo}.`,
  };
}

function buildDiagnosePrompt(input = {}) {
  const equipo = inferEquipmentLabel(input.equipo);
  const sintoma = String(input.sintoma || input.codigo_falla || '').trim();
  const contexto = String(input.contexto || input.contexto_diagnostico || '').trim();
  const codigo = String(input.codigo_falla || '').trim();
  const horometro = input.horometro ? String(input.horometro).trim() : '';
  return [
    'Eres Hermes, diagnosticador de maquinaria pesada para taller minero/construccion.',
    'Responde en espanol simple para mecanicos con bajo nivel escolar, pero con criterio tecnico.',
    'No reinicies el diagnostico: si el mecanico dice que algo ya fue revisado, no lo pongas como paso principal.',
    'Da pruebas concretas antes de cambiar piezas. No des respuestas genericas.',
    'Regla de modelo: Komatsu HM400-3 no tiene rol superior/carrier roller. Nunca lo sugieras para HM400-3.',
    'No uses markdown. No expliques fuera del JSON. JSON compacto en una sola respuesta.',
    'Devuelve SOLO JSON valido con estas llaves:',
    'causas_probables: string[]',
    'checklist_diagnostico: string[]',
    'partes_probables: string[]',
    'tiempo_estimado_hrs: number',
    'prioridad: "ALTA"|"MEDIA"|"BAJA"',
    'advertencias: string[]',
    'decision_operativa: string (NO OPERAR, mover limitado, o continuar)',
    'pregunta_clave: string (una sola pregunta corta para el mecanico)',
    'nota_tecnica: string',
    'Maximo 3 causas, 5 pasos, 3 partes. Cada texto debe tener menos de 18 palabras.',
    `Equipo seleccionado: ${equipo}.`,
    codigo ? `Codigo de falla: ${codigo}.` : 'Codigo de falla: no indicado.',
    horometro ? `Horometro: ${horometro}.` : 'Horometro: no indicado.',
    contexto ? `Contexto previo del mismo caso:\n${contexto}` : 'Contexto previo del mismo caso: ninguno.',
    `Sintoma / mensaje del mecanico: ${sintoma || 'sin descripcion'}.`,
  ].join('\n');
}

async function callOpenRouterDiagnose(input = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const model = (process.env.HERMES_DIAGNOSE_MODEL || 'xiaomi/mimo-v2.5-pro').trim();
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': (process.env.HERMES_APP_URL || 'https://hermes-fleet-app.vercel.app').trim(),
      'X-Title': 'Hermes Fleet Text Diagnosis',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 900,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: buildDiagnosePrompt(input),
        },
      ],
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`OpenRouter diagnose failed: ${response.status} ${raw.slice(0, 200)}`);
  }

  const data = JSON.parse(raw);
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenRouter diagnose returned no content');
  }

  return parseJsonObject(content);
}

export async function buildSmartDiagnoseResponse(input = {}) {
  const equipo = inferEquipmentLabel(input.equipo);
  const provider = (process.env.HERMES_DIAGNOSE_PROVIDER || 'openrouter').trim();

  if (provider === 'local' || provider === 'mock') {
    return buildDiagnoseResponse(input);
  }

  try {
    const raw = await callOpenRouterDiagnose(input);
    const validated = validateDiagnosePayload(raw);
    const cleaned = {
      ...validated,
      causas_probables: removeAlreadyCheckedSuggestions(input, applyEquipmentRules(equipo, validated.causas_probables)),
      checklist_diagnostico: removeAlreadyCheckedSuggestions(input, applyEquipmentRules(equipo, validated.checklist_diagnostico)),
      partes_probables: removeAlreadyCheckedSuggestions(input, applyEquipmentRules(equipo, validated.partes_probables)),
      advertencias: applyEquipmentRules(equipo, validated.advertencias),
    };
    cleaned.decision_operativa = inferOperationalDecision(input, cleaned);
    cleaned.pregunta_clave = inferKeyQuestion(input, cleaned);

    return {
      ...cleaned,
      nota_tecnica: cleaned.nota_tecnica || `Diagnostico IA con ${process.env.HERMES_DIAGNOSE_MODEL || 'xiaomi/mimo-v2.5-pro'}. Equipo consultado: ${equipo}.`,
    };
  } catch (error) {
    const fallback = buildDiagnoseResponse(input);
    const cleanedFallback = {
      ...fallback,
      causas_probables: removeAlreadyCheckedSuggestions(input, fallback.causas_probables),
      checklist_diagnostico: removeAlreadyCheckedSuggestions(input, fallback.checklist_diagnostico),
      partes_probables: removeAlreadyCheckedSuggestions(input, fallback.partes_probables),
    };
    return {
      ...cleanedFallback,
      decision_operativa: inferOperationalDecision(input, cleanedFallback),
      pregunta_clave: inferKeyQuestion(input, cleanedFallback),
      advertencias: uniqueStrings([
        ...(fallback.advertencias || []),
        'Diagnostico IA no disponible o no valido; se uso respaldo local.',
      ]),
      nota_tecnica: `${fallback.nota_tecnica || ''} Respaldo local usado: ${error instanceof Error ? error.message : String(error)}`.trim(),
    };
  }
}

function buildPhotoPrompt(input = {}) {
  const equipo = inferEquipmentLabel(input.equipo);
  const contexto = String(input.contexto || input.texto || input.sintoma || '').trim();
  return [
    'Eres Hermes, diagnosticador visual de maquinaria pesada para taller minero/construccion.',
    'Analiza la foto real. No respondas con plantilla ni digas que hace falta otra foto salvo que la imagen sea ilegible.',
    'Responde en espanol simple para mecanicos de bajo nivel escolar, pero tecnicamente correcto.',
    'Si ves tablero, identifica iconos/luces/lecturas visibles y que sistema apuntan.',
    'Si ves fuga, desgaste, golpe, humo, manguera, tren inferior o motor, diagnostica el sistema mas probable.',
    'No condenes una pieza sin evidencia visual; da pruebas concretas para confirmar.',
    'Regla de modelo: Komatsu HM400-3 no tiene rol superior/carrier roller. Nunca lo sugieras para HM400-3.',
    'Devuelve SOLO JSON con estas llaves: componente_probable, tipo_de_dano, severidad, recomendacion_inicial.',
    `Equipo seleccionado: ${equipo}.`,
    contexto ? `Texto del mecanico: ${contexto}.` : 'Texto del mecanico: sin descripcion.',
  ].join('\n');
}

async function callOpenAiVision(input = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const fotoBase64 = String(input.foto_base64 || '').trim();
  if (!fotoBase64) {
    throw new Error('foto_base64 is required for visual diagnosis');
  }

  const mediaType = String(input.media_type || input.photoMimeType || 'image/jpeg').trim() || 'image/jpeg';
  const model = (process.env.HERMES_VISION_MODEL || 'gpt-4o-mini').trim();
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 450,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: buildPhotoPrompt(input) },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mediaType};base64,${fotoBase64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI vision failed: ${response.status} ${raw.slice(0, 200)}`);
  }

  const data = JSON.parse(raw);
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI vision returned no content');
  }

  return parseJsonObject(content);
}

async function callOpenRouterVision(input = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const fotoBase64 = String(input.foto_base64 || '').trim();
  if (!fotoBase64) {
    throw new Error('foto_base64 is required for visual diagnosis');
  }

  const mediaType = String(input.media_type || input.photoMimeType || 'image/jpeg').trim() || 'image/jpeg';
  const model = (process.env.HERMES_VISION_MODEL || 'qwen/qwen3.7-plus').trim();
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': (process.env.HERMES_APP_URL || 'https://hermes-fleet-app.vercel.app').trim(),
      'X-Title': 'Hermes Fleet Visual Diagnosis',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 450,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: buildPhotoPrompt(input) },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mediaType};base64,${fotoBase64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`OpenRouter vision failed: ${response.status} ${raw.slice(0, 200)}`);
  }

  const data = JSON.parse(raw);
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenRouter vision returned no content');
  }

  return parseJsonObject(content);
}

function buildMockVisionResponse(input = {}) {
  const text = normalizeText(`${input.contexto || ''} ${input.texto || ''} ${input.sintoma || ''}`);
  const equipo = inferEquipmentLabel(input.equipo);

  if (hasAny(text, ['tablero', 'panel', 'monitor', 'luz', 'testigo', 'alarma']) || isHm400(equipo)) {
    return {
      componente_probable: `Tablero/monitor y sistema de alerta de ${equipo}`,
      tipo_de_dano: 'Se observan indicadores activos en el panel; la condicion apunta a alerta de sistema, no a una pieza mecanica confirmada por foto.',
      severidad: 'MEDIA',
      recomendacion_inicial: 'Registrar horometro, anotar iconos o codigo visible, revisar niveles de aceite/coolant y consultar codigos activos antes de cargar el equipo.',
    };
  }

  return {
    componente_probable: `Zona visible de ${equipo}`,
    tipo_de_dano: 'La foto muestra una condicion visible que requiere confirmar el sistema exacto antes de cambiar partes.',
    severidad: 'MEDIA',
    recomendacion_inicial: 'Aislar el punto visible, limpiar la zona si hay fuga, registrar horometro y hacer prueba corta para confirmar origen.',
  };
}

export async function buildPhotoAnalysisResponse(input = {}) {
  const equipo = inferEquipmentLabel(input.equipo);
  const provider = (process.env.HERMES_PHOTO_ANALYSIS_PROVIDER || 'openrouter').trim();
  let raw;
  if (provider === 'mock') {
    raw = buildMockVisionResponse(input);
  } else if (provider === 'openai') {
    raw = await callOpenAiVision(input);
  } else {
    raw = await callOpenRouterVision(input);
  }

  return hardenDashboardPhotoResult(
    input,
    applyEquipmentRulesToPhotoResult(
      equipo,
      validatePhotoAnalysisPayload(raw),
    ),
  );
}

export function buildManualLookupResponse(input = {}) {
  const equipo = inferEquipmentLabel(input.equipo);
  const temaRaw = String(input.tema || '').trim();
  const tema = normalizeText(temaRaw);
  const profile = detectManualProfile(tema);

  if (profile) {
    return {
      extracto: `${profile.extracto} Equipo consultado: ${equipo}.`,
      pasos_tecnicos: uniqueStrings(profile.pasos),
      herramientas_requeridas: uniqueStrings(profile.herramientas),
      torque_specs: profile.torque,
    };
  }

  return {
    extracto: `Procedimiento general para ${temaRaw || 'la tarea solicitada'} en ${equipo}. Confirma serie, seguridad y manual especifico antes de aplicar torque o desmontaje mayor.`,
    pasos_tecnicos: [
      'Asegurar el equipo, confirmar sistema afectado y reunir herramienta basica antes de desmontar.',
      'Identificar el componente exacto por modelo y serie para no trabajar con procedimiento equivocado.',
      'Desarmar por etapas, marcando posicion de piezas, lineas y conectores antes de remover.',
      'Armar, revisar fugas/ajustes y hacer prueba funcional corta antes de regresar a operacion.',
    ],
    herramientas_requeridas: ['Juego de llaves y dados', 'Manual o diagrama de referencia', 'Material de limpieza', 'Equipo de seguridad personal'],
    torque_specs: 'Consultar torque especifico por modelo y serie; no usar un valor universal.',
  };
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  if (typeof req.body === 'string') {
    return JSON.parse(req.body || '{}');
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}
