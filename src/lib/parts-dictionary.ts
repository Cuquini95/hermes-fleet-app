/**
 * Bilingual parts dictionary — Spanish ↔ English
 * Used to expand search queries so mechanics can type in either language.
 *
 * Key   = lowercase Spanish term (or phrase)
 * Value = English equivalent to also search for
 */
export const ES_TO_EN: Record<string, string> = {
  // Electrical
  alternador: 'alternator',
  'motor de arranque': 'starter motor',
  arranque: 'starter',
  bateria: 'battery',
  batería: 'battery',
  fusible: 'fuse',
  relay: 'relay',
  relé: 'relay',
  'bobina de encendido': 'ignition coil',
  bujia: 'spark plug',
  bujía: 'spark plug',
  'sensor de temperatura': 'temperature sensor',
  'sensor de presion': 'pressure sensor',
  'sensor de presión': 'pressure sensor',
  'sensor de velocidad': 'speed sensor',
  sensor: 'sensor',
  interruptor: 'switch',
  'interruptor de presion': 'pressure switch',
  'interruptor de presión': 'pressure switch',
  faros: 'headlights',
  faro: 'headlight',
  bocina: 'horn',
  cable: 'cable',
  arnés: 'harness',
  arnes: 'harness',

  // Engine
  motor: 'engine',
  pistón: 'piston',
  piston: 'piston',
  válvula: 'valve',
  valvula: 'valve',
  'válvula de escape': 'exhaust valve',
  'válvula de admision': 'intake valve',
  culata: 'cylinder head',
  'cabeza de motor': 'cylinder head',
  cilindro: 'cylinder',
  'bloque de motor': 'engine block',
  'cigüeñal': 'crankshaft',
  'ciguenal': 'crankshaft',
  árbol: 'shaft',
  arbol: 'shaft',
  'árbol de levas': 'camshaft',
  'biela': 'connecting rod',
  'anillo': 'ring',
  'anillo de piston': 'piston ring',
  turbo: 'turbocharger',
  turbocompresor: 'turbocharger',
  inyector: 'injector',
  'bomba de inyeccion': 'injection pump',
  carburador: 'carburetor',
  'colector de escape': 'exhaust manifold',
  'múltiple de escape': 'exhaust manifold',
  'colector de admision': 'intake manifold',
  termostato: 'thermostat',
  junta: 'gasket',
  empaque: 'gasket',
  'junta de culata': 'head gasket',
  sello: 'seal',
  retén: 'seal',
  reten: 'seal',
  'retén de aceite': 'oil seal',

  // Cooling
  radiador: 'radiator',
  'bomba de agua': 'water pump',
  ventilador: 'fan',
  'manguera de radiador': 'radiator hose',
  'tapa de radiador': 'radiator cap',
  enfriador: 'cooler',
  'enfriador de aceite': 'oil cooler',
  intercambiador: 'heat exchanger',

  // Fuel
  'filtro de combustible': 'fuel filter',
  'bomba de combustible': 'fuel pump',
  'tanque de combustible': 'fuel tank',
  'linea de combustible': 'fuel line',
  'manguera de combustible': 'fuel hose',

  // Lubrication
  'filtro de aceite': 'oil filter',
  'bomba de aceite': 'oil pump',
  'carter': 'oil pan',
  'tapón de carter': 'drain plug',
  'tapon de carter': 'drain plug',

  // Air
  'filtro de aire': 'air filter',
  compresor: 'compressor',
  'filtro de cabina': 'cabin filter',
  'filtro de ventilacion': 'breather filter',

  // Hydraulic
  'filtro hidraulico': 'hydraulic filter',
  'filtro hidráulico': 'hydraulic filter',
  'bomba hidraulica': 'hydraulic pump',
  'bomba hidráulica': 'hydraulic pump',
  'cilindro hidraulico': 'hydraulic cylinder',
  'cilindro hidráulico': 'hydraulic cylinder',
  acumulador: 'accumulator',
  actuador: 'actuator',
  'manguera hidraulica': 'hydraulic hose',
  'manguera hidráulica': 'hydraulic hose',
  'sello hidraulico': 'hydraulic seal',
  'control de valvula': 'valve control',
  'bloque de control': 'control block',
  'distribuidor hidraulico': 'hydraulic distributor',

  // Transmission & Drivetrain
  transmision: 'transmission',
  transmisión: 'transmission',
  embrague: 'clutch',
  diferencial: 'differential',
  'convertidor de torque': 'torque converter',
  'caja de cambios': 'gearbox',
  'caja de velocidades': 'gearbox',
  eje: 'axle',
  'eje trasero': 'rear axle',
  'eje delantero': 'front axle',
  'flecha cardan': 'drive shaft',
  cardán: 'cardan shaft',
  'junta universal': 'universal joint',
  'junta homocinética': 'cv joint',

  // Brakes
  freno: 'brake',
  'pastilla de freno': 'brake pad',
  'zapata de freno': 'brake shoe',
  'disco de freno': 'brake disc',
  'tambor de freno': 'brake drum',
  'cilindro de freno': 'brake cylinder',
  'bomba de freno': 'brake pump',
  'liquido de frenos': 'brake fluid',
  'manguera de freno': 'brake hose',

  // Suspension & Steering
  suspension: 'suspension',
  suspensión: 'suspension',
  amortiguador: 'shock absorber',
  'resorte de suspension': 'suspension spring',
  resorte: 'spring',
  direccion: 'steering',
  dirección: 'steering',
  'bomba de direccion': 'steering pump',
  'bomba de dirección': 'steering pump',
  'caja de direccion': 'steering box',
  'rotula': 'ball joint',
  'barra de direccion': 'tie rod',

  // Tires & Wheels
  llanta: 'tire',
  neumatico: 'tire',
  neumático: 'tire',
  rin: 'rim',
  rueda: 'wheel',
  rodamiento: 'bearing',
  cojinete: 'bearing',
  buje: 'hub',
  tuerca: 'nut',
  'tuerca de rueda': 'wheel nut',

  // Undercarriage (heavy equipment)
  oruga: 'track',
  cadena: 'chain',
  'zapata de oruga': 'track shoe',
  zapata: 'shoe',
  rodillo: 'roller',
  'rodillo superior': 'carrier roller',
  'rodillo inferior': 'track roller',
  'rueda guia': 'idler',
  'rueda tensora': 'idler',
  'rueda motriz': 'sprocket',
  piñon: 'sprocket',
  piñón: 'sprocket',

  // Attachments
  cucharón: 'bucket',
  cucharon: 'bucket',
  balde: 'bucket',
  brazo: 'arm',
  pluma: 'boom',
  uña: 'tooth',
  'diente de cucharon': 'bucket tooth',
  'adaptador de diente': 'tooth adapter',
  'cuchilla': 'blade',
  'filo': 'cutting edge',

  // General hardware
  perno: 'bolt',
  tornillo: 'screw',
  arandela: 'washer',
  pin: 'pin',
  pasador: 'pin',
  abrazadera: 'clamp',
  manguera: 'hose',
  conector: 'connector',
  'o-ring': 'o-ring',
  'kit de sellos': 'seal kit',
  'kit de reparacion': 'repair kit',

  // Body & Cab
  espejo: 'mirror',
  vidrio: 'glass',
  puerta: 'door',
  asiento: 'seat',
  'cinturon de seguridad': 'seat belt',
  palanca: 'lever',
  pedal: 'pedal',
};

/** Build reverse map: English → Spanish */
export const EN_TO_ES: Record<string, string> = Object.fromEntries(
  Object.entries(ES_TO_EN).map(([es, en]) => [en.toLowerCase(), es])
);

/**
 * Given a search query, return an array of terms to search for:
 * the original query + any translation found in the dictionary.
 * Deduplication is by part_number in the calling component.
 */
export function expandQuery(query: string): string[] {
  const lower = query.toLowerCase().trim();
  const terms = new Set<string>([query.trim()]);

  // Spanish → English
  if (ES_TO_EN[lower]) terms.add(ES_TO_EN[lower]);

  // English → Spanish
  if (EN_TO_ES[lower]) terms.add(EN_TO_ES[lower]);

  // Partial match: if query contains a known ES key
  for (const [es, en] of Object.entries(ES_TO_EN)) {
    if (lower.includes(es) && !terms.has(en)) terms.add(en);
    if (lower.includes(en) && !terms.has(es)) terms.add(es);
  }

  return Array.from(terms);
}
