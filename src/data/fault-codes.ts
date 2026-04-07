/**
 * Fault code lookup database for GTP fleet machines.
 * Sourced from Komatsu HM400-3, D155AX-6, and Doosan service manuals.
 * Used to enrich VPS AI requests with official code descriptions.
 */

export interface FaultCodeInfo {
  codigo: string;
  descripcion: string;
  sistema: string;
  severidad: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  modelos: string[];    // machine model keys that use this code
  accion?: string;      // immediate action if critical
}

// ─── Komatsu HM400-3 Transmission Controller Codes ──────────────────────────
// Format: [clutch/gear][K][severity][fail type]
// Source: HM400-3 Shop Manual — Troubleshooting by failure code

const HM400_TRANSMISSION: FaultCodeInfo[] = [
  { codigo: '15K0MW', descripcion: 'Falla de embrague 1ra velocidad — deslizamiento detectado al comando de 1ra', sistema: 'Transmisión — Controlador TM', severidad: 'ALTA', modelos: ['HM400'], accion: 'Verificar presión embrague 1ra. Revisar ECMV solenoid CN1.PS (CN12). Medir resistencia: 5-15 Ω.' },
  { codigo: '25K0MW', descripcion: 'Falla de embrague 2da velocidad — deslizamiento detectado al comando de 2da', sistema: 'Transmisión — Controlador TM', severidad: 'ALTA', modelos: ['HM400'] },
  { codigo: '35K0MW', descripcion: 'Falla de embrague 3ra velocidad — deslizamiento detectado al comando de 3ra', sistema: 'Transmisión — Controlador TM', severidad: 'ALTA', modelos: ['HM400'] },
  { codigo: '45K0MW', descripcion: 'Falla de embrague 4ta velocidad — deslizamiento detectado al comando de 4ta', sistema: 'Transmisión — Controlador TM', severidad: 'ALTA', modelos: ['HM400'] },
  { codigo: '55K0MW', descripcion: 'Falla de embrague 5ta velocidad — deslizamiento detectado al comando de 5ta', sistema: 'Transmisión — Controlador TM', severidad: 'ALTA', modelos: ['HM400'] },
  { codigo: '65K0MW', descripcion: 'Falla de embrague 6ta velocidad — deslizamiento detectado al comando de 6ta', sistema: 'Transmisión — Controlador TM', severidad: 'ALTA', modelos: ['HM400'] },
  { codigo: '75K0MR', descripcion: 'Falla de embrague reversa — deslizamiento detectado al comando de reversa', sistema: 'Transmisión — Controlador TM', severidad: 'ALTA', modelos: ['HM400'] },
  { codigo: '15K0LW', descripcion: 'Deslizamiento embrague 1ra — presión baja detectada en 1ra velocidad', sistema: 'Transmisión — Presión hidráulica TM', severidad: 'ALTA', modelos: ['HM400'] },
  { codigo: '25K0LW', descripcion: 'Deslizamiento embrague 2da — presión baja en 2da velocidad', sistema: 'Transmisión — Presión hidráulica TM', severidad: 'ALTA', modelos: ['HM400'] },
  { codigo: '1MK0MW', descripcion: 'Falla sensor velocidad entrada transmisión (input shaft speed sensor)', sistema: 'Transmisión — Sensores de velocidad', severidad: 'MEDIA', modelos: ['HM400'] },
  { codigo: '1NK0MW', descripcion: 'Falla sensor velocidad intermedio transmisión', sistema: 'Transmisión — Sensores de velocidad', severidad: 'MEDIA', modelos: ['HM400'] },
  { codigo: '1PK0MW', descripcion: 'Falla sensor velocidad salida transmisión (output shaft speed sensor)', sistema: 'Transmisión — Sensores de velocidad', severidad: 'MEDIA', modelos: ['HM400'] },
  { codigo: 'AETMKX', descripcion: 'Error comunicación CAN bus — controlador transmisión sin señal', sistema: 'Comunicación CAN — Controlador TM', severidad: 'CRITICA', modelos: ['HM400'] },
];

// ─── Komatsu HM400-3 Engine / ECM Codes ─────────────────────────────────────
// Source: HM400-3 Shop Manual — Engine Electronic Control System

const HM400_ENGINE: FaultCodeInfo[] = [
  { codigo: 'E002', descripcion: 'Sensor presión de sobrealimentación (boost pressure) — señal fuera de rango', sistema: 'Motor — Sistema de admisión', severidad: 'MEDIA', modelos: ['HM400', 'D155'] },
  { codigo: 'E003', descripcion: 'Sensor temperatura de admisión (boost temperature) — señal fuera de rango', sistema: 'Motor — Sistema de admisión', severidad: 'BAJA', modelos: ['HM400', 'D155'] },
  { codigo: 'E010', descripcion: 'Sensor presión aceite motor — señal fuera de rango o cortocircuito', sistema: 'Motor — Sistema de lubricación', severidad: 'ALTA', modelos: ['HM400', 'D155'] },
  { codigo: 'E012', descripcion: 'Presión de aceite del motor baja — presión por debajo del límite mínimo', sistema: 'Motor — Sistema de lubricación', severidad: 'CRITICA', modelos: ['HM400', 'D155'], accion: 'PARAR MOTOR. Verificar nivel y presión aceite inmediatamente.' },
  { codigo: 'E015', descripcion: 'Temperatura refrigerante motor alta — sobrecalentamiento detectado', sistema: 'Motor — Sistema de enfriamiento', severidad: 'CRITICA', modelos: ['HM400', 'D155'], accion: 'PARAR MOTOR. Verificar nivel refrigerante y funcionamiento del ventilador.' },
  { codigo: 'E016', descripcion: 'Sensor temperatura refrigerante — señal fuera de rango', sistema: 'Motor — Sistema de enfriamiento', severidad: 'MEDIA', modelos: ['HM400', 'D155'] },
  { codigo: 'E021', descripcion: 'Sensor posición del acelerador (throttle) — cortocircuito o circuito abierto', sistema: 'Motor — Control electrónico ECM', severidad: 'ALTA', modelos: ['HM400'] },
  { codigo: 'E028', descripcion: 'Nivel bajo de aceite motor detectado por sensor de nivel', sistema: 'Motor — Sistema de lubricación', severidad: 'ALTA', modelos: ['HM400', 'D155'] },
  { codigo: 'E190', descripcion: 'Sobrevelocidad del motor (engine overspeed) detectada', sistema: 'Motor — Control de velocidad ECM', severidad: 'ALTA', modelos: ['HM400', 'D155'] },
  { codigo: 'E360', descripcion: 'Error comunicación entre ECM motor y módulo de control', sistema: 'Motor — Comunicación CAN', severidad: 'ALTA', modelos: ['HM400'] },
];

// ─── Komatsu HM400-3 Body / Brake / Suspension ──────────────────────────────

const HM400_BODY: FaultCodeInfo[] = [
  { codigo: 'AEBRKX', descripcion: 'Falla sistema de frenos — presión freno de servicio baja', sistema: 'Sistema de frenos', severidad: 'CRITICA', modelos: ['HM400'], accion: 'PARAR EQUIPO. No operar hasta inspección del sistema de frenos.' },
  { codigo: 'AEBPKX', descripcion: 'Presión acumulador frenos baja (brake accumulator pressure low)', sistema: 'Sistema de frenos — Acumulador', severidad: 'CRITICA', modelos: ['HM400'] },
  { codigo: 'AESTBK', descripcion: 'Falla freno de estacionamiento — señal de sensor incorrecta', sistema: 'Freno de estacionamiento', severidad: 'ALTA', modelos: ['HM400'] },
  { codigo: 'AEARKX', descripcion: 'Presión aire / sistema neumático baja', sistema: 'Sistema neumático', severidad: 'ALTA', modelos: ['HM400'] },
  { codigo: 'AEBDKX', descripcion: 'Temperatura aceite transmisión / convertidor de par alta', sistema: 'Transmisión — Enfriamiento', severidad: 'ALTA', modelos: ['HM400'] },
  { codigo: 'AESPKX', descripcion: 'Sensor posición palanca de cambios — señal fuera de rango', sistema: 'Transmisión — Palanca selectora', severidad: 'MEDIA', modelos: ['HM400'] },
];

// ─── Komatsu D155AX-6 Bulldozer Codes ───────────────────────────────────────
// Source: D155AX-6 Shop Manual — Failure code list

const D155_CODES: FaultCodeInfo[] = [
  { codigo: 'E003', descripcion: 'Sensor temperatura aceite hidráulico — señal anormal', sistema: 'Hidráulico — Temperatura', severidad: 'MEDIA', modelos: ['D155'] },
  { codigo: 'E013', descripcion: 'Presión hidráulica alivio — presión por encima del límite', sistema: 'Hidráulico — Válvula de alivio', severidad: 'ALTA', modelos: ['D155'] },
  { codigo: 'E033', descripcion: 'Error sensor ángulo hoja (blade angle sensor)', sistema: 'Control hidráulico — Hoja dozer', severidad: 'MEDIA', modelos: ['D155'] },
  { codigo: 'E101', descripcion: 'Error comunicación VHMS (Vehicle Health Monitoring System)', sistema: 'VHMS — Monitoreo de salud del vehículo', severidad: 'BAJA', modelos: ['D155'] },
  { codigo: 'E215', descripcion: 'Sensor velocidad del motor final drive — señal fuera de rango', sistema: 'Transmisión — Mandos finales', severidad: 'ALTA', modelos: ['D155'] },
  { codigo: 'CA111', descripcion: 'Sensor velocidad RPM motor (CID 111) — señal perdida o fuera de rango', sistema: 'Motor — Sensor RPM', severidad: 'ALTA', modelos: ['D155'] },
  { codigo: 'CA187', descripcion: 'Sensor temperatura aceite de la transmisión — voltaje bajo (CID 187)', sistema: 'Transmisión — Temperatura', severidad: 'MEDIA', modelos: ['D155'] },
  { codigo: 'CA271', descripcion: 'Inyector cilindro 1 — falla de activación (CID 271)', sistema: 'Motor — Sistema de inyección', severidad: 'ALTA', modelos: ['D155'] },
];

// ─── Doosan DX/DL Excavator & Loader Codes ──────────────────────────────────
// Source: Doosan DX340LC, DX360LCA, DX225LC, DL420A service manuals

const DOOSAN_CODES: FaultCodeInfo[] = [
  { codigo: 'C-10', descripcion: 'Presión aceite motor baja — sensor detecta presión bajo límite', sistema: 'Motor — Lubricación', severidad: 'CRITICA', modelos: ['DX360', 'DX340', 'DX225', 'DL420'], accion: 'PARAR MOTOR.' },
  { codigo: 'C-11', descripcion: 'Temperatura refrigerante motor alta — sobrecalentamiento', sistema: 'Motor — Enfriamiento', severidad: 'CRITICA', modelos: ['DX360', 'DX340', 'DX225', 'DL420'] },
  { codigo: 'C-12', descripcion: 'Filtro de aire obstruido — sensor de restricción activado', sistema: 'Motor — Sistema de admisión', severidad: 'MEDIA', modelos: ['DX360', 'DX340', 'DX225', 'DL420'] },
  { codigo: 'C-13', descripcion: 'Temperatura aceite hidráulico alta — por encima del límite máximo', sistema: 'Hidráulico — Temperatura', severidad: 'ALTA', modelos: ['DX360', 'DX340', 'DX225', 'DL420'] },
  { codigo: 'C-14', descripcion: 'Temperatura aceite swing/rotación alta', sistema: 'Hidráulico — Sistema de giro', severidad: 'ALTA', modelos: ['DX360', 'DX340'] },
  { codigo: 'C-15', descripcion: 'Nivel combustible bajo — reserva activada', sistema: 'Combustible', severidad: 'MEDIA', modelos: ['DX360', 'DX340', 'DX225', 'DL420'] },
  { codigo: 'C-20', descripcion: 'Error sensor presión piloto — señal fuera de rango', sistema: 'Hidráulico — Sistema piloto', severidad: 'MEDIA', modelos: ['DX360', 'DX340'] },
  { codigo: 'C-21', descripcion: 'Error válvula solenoide control — cortocircuito o circuito abierto', sistema: 'Hidráulico — Electroválvulas', severidad: 'ALTA', modelos: ['DX360', 'DX340', 'DX225'] },
  { codigo: 'C-31', descripcion: 'Error sensor posición boom — señal fuera de rango (si aplica EPOS)', sistema: 'Hidráulico — Control de pluma', severidad: 'BAJA', modelos: ['DX360', 'DX340'] },
  { codigo: 'C-100', descripcion: 'Error comunicación entre ECU motor y ECU de máquina (CAN)', sistema: 'CAN Bus — Comunicación ECU', severidad: 'ALTA', modelos: ['DX360', 'DX340', 'DX225', 'DL420'] },
  { codigo: 'A-10', descripcion: 'Advertencia presión aceite motor baja — nivel de alerta previo', sistema: 'Motor — Lubricación', severidad: 'MEDIA', modelos: ['DX360', 'DX340', 'DX225', 'DL420'] },
  { codigo: 'A-11', descripcion: 'Advertencia temperatura refrigerante — zona de precaución', sistema: 'Motor — Enfriamiento', severidad: 'MEDIA', modelos: ['DX360', 'DX340', 'DX225', 'DL420'] },
];

// ─── Consolidated lookup map ─────────────────────────────────────────────────

const ALL_CODES: FaultCodeInfo[] = [
  ...HM400_TRANSMISSION,
  ...HM400_ENGINE,
  ...HM400_BODY,
  ...D155_CODES,
  ...DOOSAN_CODES,
];

const FAULT_CODE_MAP = new Map<string, FaultCodeInfo>(
  ALL_CODES.map((fc) => [fc.codigo.toUpperCase(), fc])
);

/**
 * Look up a fault code in the database.
 * Returns null if not found (unknown code — send to VPS for AI lookup).
 */
export function lookupFaultCode(code: string): FaultCodeInfo | null {
  return FAULT_CODE_MAP.get(code.toUpperCase()) ?? null;
}

/**
 * Build an enriched sintoma string for the VPS when we have a known fault code.
 * This gives the AI the system context it needs to give a targeted response.
 */
export function buildFaultCodeSintoma(
  code: string,
  info: FaultCodeInfo,
  userContext?: string
): string {
  const parts = [
    `CÓDIGO DE FALLA: ${code}`,
    `DESCRIPCIÓN OFICIAL: ${info.descripcion}`,
    `SISTEMA AFECTADO: ${info.sistema}`,
    `SEVERIDAD: ${info.severidad}`,
  ];
  if (info.accion) {
    parts.push(`ACCIÓN INMEDIATA: ${info.accion}`);
  }
  parts.push(
    `INSTRUCCIÓN: Proporciona diagnóstico detallado para este código en este sistema específico. ` +
    `Incluye causas probables, componentes a verificar, valores de prueba esperados y partes que pueden requerir reemplazo.`
  );
  if (userContext) {
    parts.push(`Contexto adicional del operador: ${userContext}`);
  }
  return parts.join('\n');
}
