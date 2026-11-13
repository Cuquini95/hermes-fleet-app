const sourceSpecs = {
  fleet: ['tmf', 'EQUIPOS', 'A3:F', 'Código', ['Código', 'Equipo', 'Modelo', 'Clase contractual', 'Activo']],
  shifts: ['tmf', 'REGISTRO', 'A3:L', 'Código', ['Clave', 'Código', 'Fecha', 'Turno', 'Estado', 'H. Inicial', 'H. Final'], { id: 'Clave' }],
  failures: ['workshop', 'FALLAS TMF', 'A4:K', 'EQUIPO', ['CASO', 'EQUIPO', 'FALLA REPORTADA', 'ESTADO', 'ÚLTIMO REPORTE', 'OT VINCULADA'], { id: 'CASO', empty: true }],
  orders: ['workshop', 'OTS', 'A4:V', 'EQUIPO', ['Nº OT', 'EQUIPO', 'FALLA / TRABAJO A REALIZAR', 'ESTADO', 'CONTROL INTEGRIDAD OT'], { id: 'Nº OT', project: true, empty: true }],
  maintenance: ['pm', 'PM FLOTA', 'A7:N', 'EQUIPO', ['EQUIPO', '¿CÓMO ESTÁ?', 'PRÓXIMO PM', 'HORAS QUE LE QUEDAN', 'LECTURA', 'PLAN'],
    { optional: ['MODELO', 'TOCA A LAS (h)', 'HORÓMETRO HOY', 'ÚLTIMO PM ANOTADO'], alias: ['¿CÓMO ESTÁ?', 'Estado'] }],
  maintenancePlan: ['pm', 'AJUSTES', 'A4:M', 'EQUIPO', ['EQUIPO', 'MODELO', '¿ACTIVO?', 'PM CADA (h)', 'NIVEL 2 (h)', 'NIVEL 3 (h)', 'NIVEL 4 (h)', 'NIVEL 5 (h)', 'NIVEL 6 (h)', '¿PLAN APROBADO?', 'PAQUETE / CHECKLIST (link)']],
  maintenanceAnchor: ['pm', 'CALC', 'A1:AH', 'Equipo', ['Equipo', 'Ancla ciclo (h)']],
  purchases: ['purchases', 'Pa - Maquinaria', 'A1:Z', 'Equipo / Item', ['ID', 'País', 'Equipo / Item', 'Descripción', 'Monto', 'Moneda', 'Estado operativo', 'OC', 'Control recepción'], { country: true, id: 'ID', empty: true }],
  costs: ['costs', 'RESUMEN', 'A10:L', 'UNIDAD', ['UNIDAD', 'HORAS TMF', 'INGRESO USD', 'COMPRAS + REPARTO USD', 'COSTO ANALÍTICO PARCIAL USD/h', 'MARGEN ANALÍTICO PARCIAL USD/h']],
  equipmentDetails: ['equipment', 'EQUIPOS', 'A3:M', 'CÓDIGO', ['CÓDIGO', 'PAÍS', 'PROYECTO', 'TIPO', 'MARCA', 'MODELO', 'SERIE'], { country: true, project: true }],
};
for (const [book, prefix] of [['dozers', 'dozer'], ['excavators', 'excavator']]) {
  sourceSpecs[book] = [book, 'RESUMEN JEFE', 'A4:J', 'EQUIPO', ['EQUIPO', 'TIPO', '🔴', '🟠', '⚪ sin dato']];
  sourceSpecs[prefix + 'Changes'] = [book, 'ANOTAR CAMBIO', 'A5:Q', 'EQUIPO',
    ['EQUIPO', 'FECHA', 'PIEZA', 'LADO / POSICIÓN', 'HORÓMETRO AL CAMBIO (h)', '¿POR QUÉ SE CAMBIÓ?', '¿BIEN ANOTADO?', 'HORAS QUE DURÓ LA PIEZA'], { empty: true }];
  sourceSpecs[prefix + 'Life'] = [book, 'CALC', 'A1:Q', 'Equipo', ['Equipo', 'Pieza', 'Lado', 'Vida', 'UltHor', 'HorAct', 'Usadas', 'Restantes', 'Estado']];
}

const bookKeys = [...new Set(Object.values(sourceSpecs).map(([book]) => book))];
const unitPattern = /^[A-Z]{1,7}[- ]?\d{1,7}$/;
const norm = value => String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toUpperCase();
const cell = value => String(value ?? '').replaceAll('\u0000', '').trim();

function projectMasterRows(source, raw, fleetUnits) {
  if (!Object.hasOwn(sourceSpecs, source)) throw new Error('fuente desconocida');
  const [, , , unitName, required, options = {}] = sourceSpecs[source];
  if (!Array.isArray(raw) || !Array.isArray(raw[0]) || raw.some(row => !Array.isArray(row))) throw new Error('lectura sin cabeceras');
  const header = raw[0].map(norm);
  const locate = name => {
    const candidates = [norm(name)];
    if (options.alias?.[0] === name) candidates.push(norm(options.alias[1]));
    const indexes = header.flatMap((item, index) => candidates.includes(item) ? [index] : []);
    if (indexes.length > 1) throw new Error('cabeceras duplicadas');
    return indexes[0] ?? -1;
  };
  const fields = required.concat((options.optional ?? []).filter(name => locate(name) >= 0));
  const indexes = fields.map(locate);
  const unit = locate(unitName);
  const id = options.id ? locate(options.id) : null;
  const country = options.country ? locate('PAÍS') : null;
  const projectColumn = options.project ? locate('PROYECTO') : null;
  if ([...indexes, unit, id, country, projectColumn].includes(-1)) throw new Error('cabeceras incompletas');
  const appliesFleet = source !== 'fleet' && source !== 'purchases';
  if (appliesFleet && !(fleetUnits instanceof Set) && ['shifts', 'orders', 'costs', 'equipmentDetails'].includes(source)) {
    throw new Error('falta validar la flota TMF');
  }
  const chosen = raw.slice(1).filter(row => {
    const code = norm(row[unit]);
    return unitPattern.test(code) && (id === null || cell(row[id]))
      && (country === null || norm(row[country]) === 'PANAMA')
      && (projectColumn === null || ['TMF', 'TMF MINERA PANAMA'].includes(norm(row[projectColumn])))
      && (!appliesFleet || !fleetUnits || fleetUnits.has(code));
  });
  if (chosen.length === 0 && !options.empty) throw new Error('fuente sin filas TMF');
  if (source === 'fleet' && new Set(chosen.map(row => norm(row[unit]))).size !== chosen.length) throw new Error('códigos repetidos en EQUIPOS');
  if (chosen.length >= 1600) throw new Error('fuente excede el tamaño validado');
  return [fields, ...chosen.map(row => indexes.map(index => cell(row[index])))];
}

async function readShiftTail(read, rowLimit, { keyPage = 3500, historyRows = 1100 } = {}) {
  const header = await read('A3:L3');
  for (let end = rowLimit; end > 3; end -= keyPage) {
    const start = Math.max(4, end - keyPage + 1);
    const keys = await read(`A${start}:A${end}`);
    const last = keys.findLastIndex(row => /^\d{8}\|[^|]+\|[A-Z]{1,7}[- ]?\d{1,7}$/.test(cell(row[0])));
    if (last < 0) continue;
    const finalRow = start + last;
    const firstRow = Math.max(4, finalRow - historyRows + 1);
    return [...header, ...await read(`A${firstRow}:L${finalRow}`)];
  }
  throw new Error('REGISTRO sin folios de turno');
}

function masterPublicationQuery(source, stamp, rows) {
  if (!Object.hasOwn(sourceSpecs, source)) throw new Error('fuente desconocida');
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(stamp)) throw new Error('fecha de corte inválida');
  const payload = JSON.stringify(rows);
  let tag = 'hermes_master';
  while (payload.includes('$' + tag + '$')) tag += '_';
  const quote = '$' + tag + '$';
  return `select public.hermes_panama_publish_master('${source}', '${stamp}'::timestamptz, ${quote}${payload}${quote}::jsonb) as applied;`;
}

function toolValue(result) {
  if (result?.isError) return null;
  let value = result?.structuredContent;
  if (!value) {
    try { value = JSON.parse(result?.content?.[0]?.text ?? 'null'); } catch { return null; }
  }
  return value?.result ?? value;
}

function sqlRecords(result) {
  const output = toolValue(result);
  if (Array.isArray(output)) return output;
  if (typeof output !== 'string') return null;
  const rows = output.split('\n').find(line => line.startsWith('['));
  try { return JSON.parse(rows); } catch { return null; }
}

async function refreshMasters(tools, books, { write = false, postgresProject, stamp = new Date().toISOString() } = {}) {
  if (write && !/^[a-z]{20}$/.test(postgresProject ?? '')) throw new Error('proyecto de Supabase sin verificar');
  for (const key of bookKeys) {
    if (!/^[\w-]{20,100}$/.test(books[key] ?? '')) throw new Error('falta una fuente autorizada');
  }
  if (new Set(bookKeys.map(key => books[key])).size !== bookKeys.length) throw new Error('los maestros definidos deben ser distintos');

  const metadata = Object.fromEntries(await Promise.all(bookKeys.map(async key => {
    const response = await tools.mcp__codex_apps__google_drive_get_spreadsheet_metadata({ spreadsheet_id: books[key] });
    const book = toolValue(response);
    return [key, book?.sheets?.map(sheet => sheet.properties) ?? []];
  })));
  async function readRows(source) {
    const [book, tab, area] = sourceSpecs[source];
    const sheet = metadata[book].find(properties => properties.title === tab);
    const rowLimit = sheet?.gridProperties?.rowCount;
    if (!Number.isSafeInteger(rowLimit) || rowLimit < 4) throw new Error('pestaña o tamaño no verificado');
    async function read(range) {
      const result = await tools.mcp__codex_apps__google_drive_get_spreadsheet_range({
        spreadsheet_id: books[book], sheet_name: "'" + tab + "'", range, value_render_option: 'FORMATTED_VALUE',
      });
      const value = toolValue(result);
      if (value?.values === null && typeof value.range === 'string') return [];
      if (!Array.isArray(value?.values)) throw new Error('lectura de Sheets falló');
      return value.values;
    }
    if (source === 'shifts') return readShiftTail(read, rowLimit);
    const [, from, to] = /^A(\d+):([A-Z]+)$/.exec(area);
    const ranges = [];
    for (let start = Number(from); start <= rowLimit; start += 500) {
      ranges.push(`A${start}:${to}${Math.min(rowLimit, start + 499)}`);
    }
    return (await Promise.all(ranges.map(read))).flat();
  }

  const fleet = projectMasterRows('fleet', await readRows('fleet'));
  const units = new Set(fleet.slice(1).map(row => norm(row[0])));
  const details = {};
  async function publish(source, rows) {
    if (write) {
      const result = await tools.mcp__codex_apps__supabase_execute_sql({ project_id: postgresProject, query: masterPublicationQuery(source, stamp, rows) });
      if (typeof sqlRecords(result)?.[0]?.applied !== 'boolean') throw new Error('publicación de Supabase falló');
    }
    details[source] = { rows: rows.length - 1, published: write };
  }
  await publish('fleet', fleet);
  const remaining = Object.keys(sourceSpecs).filter(key => key !== 'fleet');
  async function refresh(source) {
    try {
      await publish(source, projectMasterRows(source, await readRows(source), units));
    } catch (error) {
      const knownErrors = ['pestaña o tamaño no verificado', 'lectura de Sheets falló', 'lectura sin cabeceras',
        'cabeceras duplicadas', 'cabeceras incompletas', 'fuente sin filas TMF', 'fuente excede el tamaño validado',
        'REGISTRO sin folios de turno', 'publicación de Supabase falló'];
      details[source] = { published: false, error: knownErrors.includes(error?.message) ? error.message : 'la fuente no se pudo actualizar' };
    }
  }
  for (let i = 0; i < remaining.length; i += 3) await Promise.all(remaining.slice(i, i + 3).map(refresh));
  if (write) {
    const result = await tools.mcp__codex_apps__supabase_execute_sql({ project_id: postgresProject, query:
      `select source, jsonb_array_length(rows)-1 as row_count from public.hermes_panama_source_snapshots where captured_at = '${stamp}'::timestamptz;` });
    const confirmed = new Map((sqlRecords(result) ?? []).map(row => [row.source, row.row_count]));
    for (const [source, summary] of Object.entries(details)) {
      if (summary.published && confirmed.get(source) !== summary.rows) {
        details[source] = { ...summary, published: false, error: 'el corte no se confirmó al releer' };
      }
    }
  }
  return { stamp, expected: Object.keys(sourceSpecs).length, completed: Object.values(details).filter(x => !x.error).length, details };
}

export { projectMasterRows, masterPublicationQuery, readShiftTail, refreshMasters };
