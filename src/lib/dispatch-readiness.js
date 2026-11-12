const OK_READINESS = {
  unitId: '',
  level: 'ok',
  source: 'none',
  label: 'Libre',
  reason: 'Sin bloqueo operativo registrado',
};

export function normalizeUnitId(value) {
  return value.trim().toUpperCase();
}

function parseSheetDate(value) {
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

function validDate(year, month, day) {
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

function parseSheetDateTime(dateValue, timeValue) {
  const date = parseSheetDate(dateValue);
  if (!date) return 0;

  const timeMatch = timeValue.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeMatch) {
    date.setHours(Number(timeMatch[1]), Number(timeMatch[2]), Number(timeMatch[3] ?? 0), 0);
  }
  return date.getTime();
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isBeforeToday(dateValue, today) {
  const date = parseSheetDate(dateValue);
  if (!date) return false;
  return startOfDay(date).getTime() < startOfDay(today).getTime();
}

function latestByUnit(records) {
  const latest = new Map();
  for (const record of records) {
    const current = latest.get(record.unitId);
    if (!current || record.timestamp >= current.timestamp) {
      latest.set(record.unitId, record);
    }
  }
  return latest;
}

function parseStickerRows(rows) {
  const records = [];
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
      firstDue: (row[17] ?? '').trim(),
      timestamp: parseSheetDateTime(row[3] ?? '', row[4] ?? '') || Date.parse(row[2] ?? '') || 0,
    });
  }
  return latestByUnit(records);
}

function parseDvirRows(rows) {
  const records = [];
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
  const latest = latestByUnit(records);
  const unresolved = latestByUnit(records.filter((record) => record.result === 'reprobado'
    && ['pendiente', 'abierta', 'en reparación', 'en proceso'].includes(record.actionState)));
  for (const [unit, record] of unresolved) {
    if (latest.get(unit)?.result !== 'reprobado') latest.set(unit, record);
  }
  return latest;
}

function readinessFromSticker(record, today) {
  const color = record.finalColor;
  const canDispatch = record.canDispatch;
  const pending = record.approvalState === 'pendiente' || record.approvalState === 'pendiente_supervisor';

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

  if (color === 'red' || color === 'rojo' || canDispatch === 'no' || pending || isBeforeToday(record.firstDue, today)) {
    const reason = color === 'red' || color === 'rojo'
      ? 'rechazado'
      : pending ? 'pendiente de aprobación' : isBeforeToday(record.firstDue, today) ? 'con compromiso vencido' : 'sin autorización de despacho';
    return {
      unitId: record.unitId,
      level: 'blocked',
      source: 'sticker',
      label: 'No despachar',
      reason: `Sticker ${record.folio || 'sin folio'} ${reason}`,
      effectiveStatus: 'taller',
      folio: record.folio,
      expiresOn: record.expiresOn,
    };
  }

  if (color === 'yellow' || color === 'amarillo') {
    return {
      unitId: record.unitId,
      level: 'restricted',
      source: 'sticker',
      label: 'Despacho restringido',
      reason: `Sticker ${record.folio || 'sin folio'} condicionado`,
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

function readinessFromDvir(record) {
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
  unitId,
  sticker,
  dvir,
) {
  if (dvir?.level === 'blocked') return dvir;
  if (sticker?.level === 'blocked') return sticker;
  if (dvir?.level === 'restricted') return dvir;
  if (sticker?.level === 'restricted') return sticker;
  if (sticker) return sticker;
  if (dvir) return dvir;
  return { ...OK_READINESS, unitId };
}

export function buildDispatchReadinessMap(
  stickerRows,
  dvirRows,
  today = new Date(),
  pendingReturns = [],
) {
  const stickers = parseStickerRows(stickerRows);
  const dvirs = parseDvirRows(dvirRows);
  const unitIds = new Set([...stickers.keys(), ...dvirs.keys()]);
  const map = new Map();

  for (const unitId of unitIds) {
    const sticker = stickers.get(unitId);
    const dvir = dvirs.get(unitId);
    map.set(unitId, pickMostRestrictive(
      unitId,
      sticker ? readinessFromSticker(sticker, today) : undefined,
      dvir ? readinessFromDvir(dvir) : undefined,
    ));
  }

  for (const { unit, otId } of pendingReturns) {
    const unitId = normalizeUnitId(unit);
    if (map.get(unitId)?.level === 'blocked') continue;
    map.set(unitId, {
      unitId, source: 'retorno', level: 'blocked', label: 'Retorno pendiente',
      reason: `${otId} pendiente de recepción por Operaciones`, effectiveStatus: 'taller', folio: otId,
    });
  }
  return map;
}

export function applyDispatchReadiness(
  unit,
  readiness,
) {
  if (!readiness?.effectiveStatus || unit.status === 'inactivo') return unit;
  if (unit.status === 'taller' && readiness.effectiveStatus !== 'taller') return unit;
  return {
    ...unit,
    status: readiness.effectiveStatus,
  };
}
