import type { Equipment } from '../types/equipment';

export type DispatchReadinessLevel = 'ok' | 'restricted' | 'blocked';
export type DispatchReadinessSource = 'sticker' | 'dvir' | 'none';

export interface UnitDispatchReadiness {
  unitId: string;
  level: DispatchReadinessLevel;
  source: DispatchReadinessSource;
  label: string;
  reason: string;
  effectiveStatus?: Equipment['status'];
  folio?: string;
  expiresOn?: string;
}

const OK_READINESS: UnitDispatchReadiness = {
  unitId: '',
  level: 'ok',
  source: 'none',
  label: 'Libre',
  reason: 'Sin bloqueo operativo registrado',
};

interface StickerRecord {
  unitId: string;
  folio: string;
  finalColor: string;
  canDispatch: string;
  approvalState: string;
  expiresOn: string;
  timestamp: number;
}

interface DvirRecord {
  unitId: string;
  result: string;
  actionState: string;
  defects: string;
  timestamp: number;
}

export function normalizeUnitId(value: string): string {
  return value.trim().toUpperCase();
}

function parseSheetDate(value: string): Date | null {
  const trimmed = value.trim();
  let match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    return validDate(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  }

  match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    return validDate(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  return null;
}

function validDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function parseSheetDateTime(dateValue: string, timeValue: string): number {
  const date = parseSheetDate(dateValue);
  if (!date) return 0;

  const timeMatch = timeValue.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeMatch) {
    date.setHours(Number(timeMatch[1]), Number(timeMatch[2]), Number(timeMatch[3] ?? 0), 0);
  }
  return date.getTime();
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isBeforeToday(dateValue: string, today: Date): boolean {
  const date = parseSheetDate(dateValue);
  if (!date) return false;
  return startOfDay(date).getTime() < startOfDay(today).getTime();
}

function latestByUnit<T extends { unitId: string; timestamp: number }>(records: T[]): Map<string, T> {
  const latest = new Map<string, T>();
  for (const record of records) {
    const current = latest.get(record.unitId);
    if (!current || record.timestamp >= current.timestamp) {
      latest.set(record.unitId, record);
    }
  }
  return latest;
}

function parseStickerRows(rows: string[][]): Map<string, StickerRecord> {
  const records: StickerRecord[] = [];
  for (const row of rows) {
    const unitId = normalizeUnitId(row[5] ?? '');
    if (!unitId || unitId === 'UNIDAD') continue;

    records.push({
      unitId,
      folio: (row[1] ?? '').trim(),
      finalColor: (row[12] ?? '').trim().toLowerCase(),
      canDispatch: (row[13] ?? '').trim().toLowerCase(),
      expiresOn: (row[14] ?? '').trim(),
      approvalState: (row[10] ?? '').trim().toLowerCase(),
      timestamp: parseSheetDateTime(row[3] ?? '', row[4] ?? ''),
    });
  }
  return latestByUnit(records);
}

function parseDvirRows(rows: string[][]): Map<string, DvirRecord> {
  const records: DvirRecord[] = [];
  for (const row of rows) {
    const unitId = normalizeUnitId(row[4] ?? '');
    if (!unitId || unitId === 'UNIDAD') continue;

    records.push({
      unitId,
      result: (row[22] ?? '').trim().toLowerCase(),
      actionState: (row[26] ?? '').trim().toLowerCase(),
      defects: (row[23] ?? '').trim(),
      timestamp: parseSheetDateTime(row[2] ?? '', row[3] ?? ''),
    });
  }
  return latestByUnit(records);
}

function readinessFromSticker(record: StickerRecord, today: Date): UnitDispatchReadiness {
  const color = record.finalColor;
  const canDispatch = record.canDispatch;

  if (isBeforeToday(record.expiresOn, today)) {
    return {
      unitId: record.unitId,
      level: 'blocked',
      source: 'sticker',
      label: 'Sticker vencido',
      reason: `Sticker ${record.folio || 'sin folio'} vencio el ${record.expiresOn}`,
      effectiveStatus: 'taller',
      folio: record.folio,
      expiresOn: record.expiresOn,
    };
  }

  if (color === 'red' || color === 'rojo' || canDispatch === 'no') {
    return {
      unitId: record.unitId,
      level: 'blocked',
      source: 'sticker',
      label: 'No despachar',
      reason: `Sticker ${record.folio || 'sin folio'} rechazado`,
      effectiveStatus: 'taller',
      folio: record.folio,
      expiresOn: record.expiresOn,
    };
  }

  if (color === 'yellow' || color === 'amarillo' || record.approvalState === 'pendiente') {
    return {
      unitId: record.unitId,
      level: 'restricted',
      source: 'sticker',
      label: 'Despacho restringido',
      reason: record.approvalState === 'pendiente'
        ? `Sticker ${record.folio || 'sin folio'} pendiente de aprobacion`
        : `Sticker ${record.folio || 'sin folio'} condicionado`,
      effectiveStatus: 'alerta',
      folio: record.folio,
      expiresOn: record.expiresOn,
    };
  }

  return {
    unitId: record.unitId,
    level: 'ok',
    source: 'sticker',
    label: 'Sticker vigente',
    reason: record.expiresOn
      ? `Sticker ${record.folio || 'sin folio'} vigente hasta ${record.expiresOn}`
      : `Sticker ${record.folio || 'sin folio'} vigente`,
    folio: record.folio,
    expiresOn: record.expiresOn,
  };
}

function readinessFromDvir(record: DvirRecord): UnitDispatchReadiness {
  if (record.result === 'reprobado') {
    return {
      unitId: record.unitId,
      level: 'blocked',
      source: 'dvir',
      label: 'Sticker suspendido',
      reason: record.defects
        ? `DVIR reprobado: ${record.defects}`
        : 'DVIR diario reprobado',
      effectiveStatus: 'taller',
    };
  }

  if (record.result === 'condicional') {
    return {
      unitId: record.unitId,
      level: 'restricted',
      source: 'dvir',
      label: 'Revisar antes de operar',
      reason: record.defects
        ? `DVIR condicional: ${record.defects}`
        : 'DVIR diario condicional',
      effectiveStatus: 'alerta',
    };
  }

  return {
    unitId: record.unitId,
    level: 'ok',
    source: 'dvir',
    label: 'DVIR aprobado',
    reason: 'Ultimo DVIR aprobado',
  };
}

function pickMostRestrictive(
  unitId: string,
  sticker: UnitDispatchReadiness | undefined,
  dvir: UnitDispatchReadiness | undefined,
): UnitDispatchReadiness {
  if (dvir?.level === 'blocked') return dvir;
  if (sticker?.level === 'blocked') return sticker;
  if (dvir?.level === 'restricted') return dvir;
  if (sticker?.level === 'restricted') return sticker;
  if (sticker) return sticker;
  if (dvir) return dvir;
  return { ...OK_READINESS, unitId };
}

export function buildDispatchReadinessMap(
  stickerRows: string[][],
  dvirRows: string[][],
  today = new Date(),
): Map<string, UnitDispatchReadiness> {
  const stickers = parseStickerRows(stickerRows);
  const dvirs = parseDvirRows(dvirRows);
  const unitIds = new Set([...stickers.keys(), ...dvirs.keys()]);
  const map = new Map<string, UnitDispatchReadiness>();

  for (const unitId of unitIds) {
    const sticker = stickers.get(unitId);
    const dvir = dvirs.get(unitId);
    map.set(unitId, pickMostRestrictive(
      unitId,
      sticker ? readinessFromSticker(sticker, today) : undefined,
      dvir ? readinessFromDvir(dvir) : undefined,
    ));
  }

  return map;
}

export function applyDispatchReadiness(
  unit: Equipment,
  readiness: UnitDispatchReadiness | undefined,
): Equipment {
  if (!readiness?.effectiveStatus) return unit;
  return {
    ...unit,
    status: readiness.effectiveStatus,
  };
}
