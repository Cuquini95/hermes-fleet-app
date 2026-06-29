export type FaultCodeType = 'J1939' | 'MID_PID_FMI' | 'CID_FMI' | 'OBD' | 'OEM' | 'UNKNOWN';

export type FaultCodeSeverityHint = 'low' | 'medium' | 'high' | 'critical';

export interface NormalizedFaultCode {
  raw_input: string;
  code_type: FaultCodeType;
  code?: string;
  spn?: string;
  fmi?: string;
  mid?: string;
  pid?: string;
  cid?: string;
  obd_code?: string;
  oem_code?: string;
  likely_system: string;
  severity_hint: FaultCodeSeverityHint;
  needs_manual_lookup: boolean;
  normalized_label: string;
}

const EXPLICIT_CODE_LANGUAGE =
  /\b(codigo|c[oó]digo|falla|fault|error|alerta|spn|fmi|mid|pid|cid|obd|check engine)\b/i;

const OEM_CODE_PATTERNS = [
  /\b(\d{1,2}[A-Z]\d[A-Z]{1,3})\b/i,
  // Komatsu monitor / RHC failure codes: DK51L5, DA1QKR, DB1QKR
  /\b(D[A-Z]\d{2}[A-Z0-9]{1,3})\b/i,
  // Komatsu air cleaner / monitor codes: AA10NX
  /\b([A-Z]{2}\d{2}[A-Z0-9]{1,3})\b/i,
  /\b([A-Z]{6})\b/,
  /\b([EF]-\d{2,4})\b/i,
  /\b([EF]\d{3,5}[A-Z]?\d*)\b/i,
  /\b(CA\d{3,5})\b/i,
  /\b([A-Z]-\d{2,4})\b/i,
];

const EXPLICIT_FAULT_CODE = /\b(?:fallo|c[oó]digo|error|fault|cod)\s+([A-Z0-9-]{4,10})\b/i;

const SPN_SYSTEMS: Record<string, string> = {
  '84': 'Velocidad del vehiculo',
  '91': 'Acelerador / posicion de pedal',
  '94': 'Combustible / presion de suministro',
  '100': 'Motor / presion de aceite',
  '102': 'Admision / presion de turbo',
  '110': 'Motor / temperatura de refrigerante',
  '157': 'Combustible / presion de riel',
  '168': 'Electrico / voltaje de bateria',
  '190': 'Motor / velocidad',
  '627': 'ECM / alimentacion electrica',
  '3216': 'Postratamiento / sensor NOx',
  '3226': 'Postratamiento / sensor NOx salida',
  '5246': 'Postratamiento / SCR inducement',
};

const PID_SYSTEMS: Record<string, string> = {
  '84': 'Velocidad del vehiculo',
  '91': 'Acelerador / posicion de pedal',
  '100': 'Motor / presion de aceite',
  '102': 'Admision / presion de turbo',
  '110': 'Motor / temperatura de refrigerante',
  '190': 'Motor / velocidad',
};

const OBD_SYSTEMS: Record<string, string> = {
  P0087: 'Combustible / presion de riel',
  P0101: 'Admision / flujo de aire',
  P0106: 'Admision / sensor MAP',
  P0201: 'Inyeccion / cilindro 1',
  P0299: 'Admision / baja presion de turbo',
  P0401: 'EGR / flujo insuficiente',
  P0420: 'Postratamiento / catalizador',
  U0001: 'Comunicacion CAN',
  U0100: 'Comunicacion ECM',
};

export function normalizeFaultCode(input: string): NormalizedFaultCode | null {
  const raw = String(input || '').trim();
  if (!raw) return null;

  const j1939 = raw.match(/\bSPN\s*[:#-]?\s*(\d{1,6})\s*(?:[,;/\s-]+)?FMI\s*[:#-]?\s*(\d{1,2})\b/i);
  if (j1939?.[1] && j1939[2]) {
    const spn = j1939[1];
    const fmi = j1939[2];
    const label = `SPN ${spn} FMI ${fmi}`;
    return {
      raw_input: raw,
      code_type: 'J1939',
      code: label,
      spn,
      fmi,
      likely_system: SPN_SYSTEMS[spn] ?? 'J1939 / sistema por confirmar',
      severity_hint: severityFromFmi(fmi),
      needs_manual_lookup: true,
      normalized_label: label,
    };
  }

  const midPid = raw.match(/\bMID\s*[:#-]?\s*(\d{1,4})\s*(?:[,;/\s-]+)?PID\s*[:#-]?\s*(\d{1,5})\s*(?:[,;/\s-]+)?FMI\s*[:#-]?\s*(\d{1,2})\b/i);
  if (midPid?.[1] && midPid[2] && midPid[3]) {
    const [, mid, pid, fmi] = midPid;
    const label = `MID ${mid} PID ${pid} FMI ${fmi}`;
    return {
      raw_input: raw,
      code_type: 'MID_PID_FMI',
      code: label,
      mid,
      pid,
      fmi,
      likely_system: PID_SYSTEMS[pid] ?? 'MID/PID / sistema por confirmar',
      severity_hint: severityFromFmi(fmi),
      needs_manual_lookup: true,
      normalized_label: label,
    };
  }

  const cid = raw.match(/\bCID\s*[:#-]?\s*(\d{1,5})\s*(?:[,;/\s-]+)?FMI\s*[:#-]?\s*(\d{1,2})\b/i);
  if (cid?.[1] && cid[2]) {
    const label = `CID ${cid[1]} FMI ${cid[2]}`;
    return {
      raw_input: raw,
      code_type: 'CID_FMI',
      code: label,
      cid: cid[1],
      fmi: cid[2],
      likely_system: 'CID/FMI / componente OEM por confirmar',
      severity_hint: severityFromFmi(cid[2]),
      needs_manual_lookup: true,
      normalized_label: label,
    };
  }

  const obd = raw.match(/\b([PCBU][0-9A-F]{4})\b/i);
  if (obd?.[1]) {
    const code = obd[1].toUpperCase();
    return {
      raw_input: raw,
      code_type: 'OBD',
      code,
      obd_code: code,
      likely_system: OBD_SYSTEMS[code] ?? 'OBD / sistema por confirmar',
      severity_hint: obdSeverity(code),
      needs_manual_lookup: true,
      normalized_label: code,
    };
  }

  for (const pattern of OEM_CODE_PATTERNS) {
    const match = raw.match(pattern);
    if (match?.[1]) {
      const code = match[1].toUpperCase();
      return {
        raw_input: raw,
        code_type: 'OEM',
        code,
        oem_code: code,
        likely_system: inferOemSystem(code),
        severity_hint: inferOemSeverity(code),
        needs_manual_lookup: true,
        normalized_label: code,
      };
    }
  }

  const explicit = raw.match(EXPLICIT_FAULT_CODE);
  if (explicit?.[1]) {
    const code = explicit[1].toUpperCase();
    return {
      raw_input: raw,
      code_type: 'OEM',
      code,
      oem_code: code,
      likely_system: inferOemSystem(code),
      severity_hint: inferOemSeverity(code),
      needs_manual_lookup: true,
      normalized_label: code,
    };
  }

  return {
    raw_input: raw,
    code_type: 'UNKNOWN',
    likely_system: 'Sistema por confirmar',
    severity_hint: 'medium',
    needs_manual_lookup: true,
    normalized_label: '',
  };
}

export function extractFaultCodeLabel(input: string): string | null {
  const code = normalizeFaultCode(input);
  return code?.normalized_label || null;
}

export function isFaultCodeLike(input: string): boolean {
  const normalized = normalizeFaultCode(input);
  if (normalized && normalized.code_type !== 'UNKNOWN') return true;
  return EXPLICIT_CODE_LANGUAGE.test(input);
}

function severityFromFmi(fmi: string): FaultCodeSeverityHint {
  if (['0', '1', '15', '16'].includes(fmi)) return 'high';
  if (['2', '3', '4', '5', '6', '7', '9', '11', '12', '13', '14'].includes(fmi)) return 'medium';
  return 'medium';
}

function obdSeverity(code: string): FaultCodeSeverityHint {
  if (code.startsWith('U')) return 'medium';
  if (code === 'P0087' || code === 'P0299') return 'high';
  return 'medium';
}

function inferOemSystem(code: string): string {
  if (/^DK/i.test(code)) return 'Retardador / controlador RHC (Komatsu HM400)';
  if (/^D[A-Z]/i.test(code)) return 'Monitor KOMTRAX / controlador de maquina (Komatsu)';
  if (/^AA/i.test(code)) return 'Filtro de aire / monitor (Komatsu)';
  if (/BRK|BP|FR/i.test(code)) return 'Frenos / sistema de seguridad';
  if (/K0M|K0L|TM/i.test(code)) return 'Transmision / controlador TM';
  if (/^E0?1[025]|^C-1[01]/i.test(code)) return 'Motor / seguridad operacional';
  if (/^CA/i.test(code)) return 'Motor / control electronico';
  return 'Codigo OEM / manual requerido';
}

function inferOemSeverity(code: string): FaultCodeSeverityHint {
  if (/BRK|BP|^E012|^E015|^C-10|^C-11/i.test(code)) return 'critical';
  if (/K0M|K0L|^E0|^CA/i.test(code)) return 'high';
  return 'medium';
}
