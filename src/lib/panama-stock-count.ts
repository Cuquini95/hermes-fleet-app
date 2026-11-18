export const STOCK_COUNT_HEADERS = ['SKU_interno', 'Descripcion', 'OEM_conocido', 'Unidad', 'Almacen', 'Ubicacion',
  'Cantidad_contada', 'Fecha_conteo', 'Fuente_soporte', 'Contado_por', 'Revisado_por', 'Aprobado_por',
  'Costo_unitario_aprobado', 'Moneda', 'Referencia_valuacion', 'Excepcion', 'Pais', 'Proyecto'] as const;
type CountField = typeof STOCK_COUNT_HEADERS[number];
export interface CountStock { partNumber: string; warehouse: string; measure: string; oem: string; physical: string | null; reserved: string | null; review?: string }
export function isCountStock(value: unknown): value is CountStock {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<CountStock>;
  return [item.partNumber, item.warehouse, item.measure, item.oem].every(field => typeof field === 'string')
    && (item.physical === null || typeof item.physical === 'string') && (item.reserved === null || typeof item.reserved === 'string')
    && (item.review === undefined || typeof item.review === 'string');
}
export interface CountLine {
  line: number; values: Record<CountField, string>; counted: string | null; physical: string | null; difference: string | null;
  errors: string[]; warnings: string[];
}
export interface CountReview { rows: CountLine[]; errors: string[]; warnings: string[] }
const key = (v: string) => v.trim().toUpperCase();
const headerKey = (v: string) => v.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[\s_]+/g, '').toUpperCase();
const csvCell = (value: unknown) => {
  let text = String(value ?? ''); let first = text.trimStart();
  while (first && first.charCodeAt(0) < 32) first = first.slice(1).trimStart();
  if (/^[=+@-]/.test(first)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
};

function number(value: string, precision = 3): bigint | null {
  if (!new RegExp(`^\\d{1,12}(?:\\.\\d{1,${precision}})?$`).test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole!) * (10n ** BigInt(precision)) + BigInt(fraction.padEnd(precision, '0'));
}
const quantity = (n: bigint) => `${n < 0n ? '-' : ''}${(n < 0n ? -n : n) / 1000n}`
  + ((n < 0n ? -n : n) % 1000n ? '.' + String((n < 0n ? -n : n) % 1000n).padStart(3, '0').replace(/0+$/, '') : '');

function parseCsv(input: string): { cells: string[]; line: number }[] {
  if (input.length > 1_000_000) throw new Error('El archivo supera el tamaño permitido.');
  const text = input.replace(/^\ufeff/, '');
  const separators = new Map([[',', 0], [';', 0], ['\t', 0]]); let quotedHeader = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === '"') { if (quotedHeader && text[i + 1] === '"') i++; else quotedHeader = !quotedHeader; }
    else if (!quotedHeader && /[\r\n]/.test(c)) break;
    else if (!quotedHeader && separators.has(c)) separators.set(c, separators.get(c)! + 1);
  }
  const delimiter = [...separators].sort((a, b) => b[1] - a[1])[0]![0];
  const result: { cells: string[]; line: number }[] = []; let cells: string[] = []; let field = '';
  let quoted = false; let closed = false; let line = 1; let start = 1;
  const cell = () => { cells.push(field); field = ''; closed = false; };
  const row = () => {
    cell(); if (cells.some(v => v.trim())) result.push({ cells, line: start }); cells = [];
    if (result.length > 501) throw new Error('Revisa hasta 500 filas por archivo.');
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; } }
      else { field += c; if (c === '\n') line++; }
    } else if (c === delimiter) cell();
    else if (c === '\n' || c === '\r') { row(); if (c === '\r' && text[i + 1] === '\n') i++; line++; start = line; }
    else if (closed) { if (!/\s/.test(c)) throw new Error(`Comillas o columnas inválidas en la fila ${line}.`); }
    else if (c === '"') { if (field) throw new Error(`Comillas inválidas en la fila ${line}.`); quoted = true; }
    else field += c;
    if (field.length > 1000 || cells.length > 40) throw new Error(`La fila ${start} contiene un campo o demasiadas columnas.`);
  }
  if (quoted) throw new Error(`Falta cerrar comillas desde la fila ${start}.`);
  if (field || cells.length || closed) row();
  return result;
}

export function reviewStockCount(text: string, stock: CountStock[] | null, options: { today: string; fullScope: boolean }): CountReview {
  const result: CountReview = { rows: [], errors: [], warnings: [] };
  let parsed: ReturnType<typeof parseCsv>;
  try { parsed = parseCsv(text); } catch (error) { return { ...result, errors: [(error as Error).message] }; }
  const header = parsed.shift()?.cells.map(headerKey) ?? [];
  if (new Set(header).size !== header.length) return { ...result, errors: ['Hay columnas duplicadas en el encabezado.'] };
  const required: CountField[] = ['SKU_interno', 'Descripcion', 'Unidad', 'Almacen', 'Ubicacion', 'Cantidad_contada', 'Fecha_conteo', 'Fuente_soporte', 'Contado_por'];
  const missing = required.filter(name => !header.includes(headerKey(name)));
  if (missing.length) return { ...result, errors: ['Faltan columnas: ' + missing.join(', ')] };
  if (!parsed.length) return { ...result, errors: ['El archivo no contiene filas de conteo.'] };
  if (stock === null) result.warnings.push('Catálogo no disponible: no se comparan existencias.');
  if (!options.fullScope) result.warnings.push('La consulta no acredita la unicidad del SKU en todo el catálogo; se usan solo los registros visibles para esta cuenta.');
  if (header.some(name => !STOCK_COUNT_HEADERS.some(known => headerKey(known) === name))) result.warnings.push('Hay columnas adicionales; no se usan para validar cantidades o autorizaciones.');
  result.rows = parsed.map(({ cells, line }) => {
    const values = Object.fromEntries(STOCK_COUNT_HEADERS.map(name => [name, (cells[header.indexOf(headerKey(name))] ?? '').trim()])) as Record<CountField, string>;
    const row: CountLine = { line, values, counted: null, physical: null, difference: null, errors: [], warnings: [] };
    if (cells.length > header.length) row.errors.push('Hay más celdas que columnas; revisa el separador y las comillas.');
    for (const name of required) if (!values[name]) row.errors.push('Falta ' + name + '.');
    if (values.SKU_interno && !/^[A-Z0-9][A-Z0-9._/-]{0,79}$/i.test(values.SKU_interno)) row.errors.push('SKU inválido: usa letras, números, punto, guion o barra, sin espacios.');
    for (const name of STOCK_COUNT_HEADERS) if (values[name].length > 500 || values[name].includes('\0')) row.errors.push('Revisa el tamaño o contenido de ' + name + '.');
    const count = number(values.Cantidad_contada);
    if (count === null) row.errors.push('Cantidad inválida: usa un valor no negativo, punto decimal y hasta 3 decimales, sin separador de miles.');
    else row.counted = quantity(count);
    const date = values.Fecha_conteo;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) row.errors.push('Fecha de conteo inválida: usa AAAA-MM-DD.');
    else if (date > options.today) row.errors.push('La fecha del conteo no puede ser futura.');
    else if (date < options.today) row.warnings.push('Conciliar los movimientos posteriores a la fecha del conteo.');
    if (!values.Pais || !values.Proyecto) row.warnings.push('País o proyecto sin confirmar en el archivo.');
    if (values.Pais && headerKey(values.Pais) !== 'PANAMA') row.errors.push('El conteo corresponde a otro país.');
    if (values.Proyecto && values.Proyecto !== 'tmf-panama') row.errors.push('Proyecto distinto de tmf-panama.');
    if (!values.OEM_conocido) row.warnings.push('OEM por confirmar; no inventar una referencia.');
    if (!values.Revisado_por || !values.Aprobado_por) row.warnings.push('Revisión independiente o autorización pendientes de respaldo.');
    if ((values.Revisado_por && key(values.Revisado_por) === key(values.Contado_por))
      || (values.Aprobado_por && key(values.Aprobado_por) === key(values.Contado_por))) row.errors.push('El conteo requiere revisión independiente de quien lo realizó.');
    if (values.Costo_unitario_aprobado && (number(values.Costo_unitario_aprobado, 2) ?? 0n) <= 0n) row.errors.push('Costo inválido: usa un valor positivo con hasta 2 decimales o deja vacío si se desconoce.');
    if (values.Moneda && key(values.Moneda) !== 'USD') row.errors.push('Moneda distinta de USD; Finanzas debe validar la valuación, sin conversión automática.');
    if (!values.Costo_unitario_aprobado || key(values.Moneda) !== 'USD' || !values.Referencia_valuacion) row.warnings.push('Valuación por revisar en Finanzas.');
    if (stock !== null) {
      const matches = stock.filter(item => key(item.partNumber) === key(values.SKU_interno) && key(item.warehouse) === key(values.Almacen));
      const known = matches.length === 1 ? matches[0] : undefined;
      if (!matches.length) row.warnings.push('Sin base registrada para este SKU y almacén en la consulta; confirmar alta o ubicación.');
      else if (!known || known.physical === null) row.warnings.push('Existencia del catálogo por conciliar.');
      if (known) {
        if (key(known.measure) !== key(values.Unidad)) row.errors.push('La unidad de medida difiere del catálogo; no se convierte automáticamente.');
        if (known.oem && values.OEM_conocido && key(known.oem) !== key(values.OEM_conocido)) row.errors.push('El OEM difiere del catálogo; confirma el SKU.');
        if (known.review) row.warnings.push(known.review);
        const physical = known.physical === null ? null : number(known.physical);
        if (physical !== null) { row.physical = quantity(physical); if (count !== null) row.difference = quantity(count - physical); }
        const reserved = known.reserved === null ? null : number(known.reserved);
        if (count !== null && reserved !== null && count < reserved) row.errors.push('La cantidad contada es menor que la reservada; concilia las reservas.');
      }
    }
    return row;
  });
  const counts = new Map<string, number>();
  for (const row of result.rows) { const id = JSON.stringify([key(row.values.SKU_interno), key(row.values.Almacen)]); counts.set(id, (counts.get(id) ?? 0) + 1); }
  for (const row of result.rows) {
    if (counts.get(JSON.stringify([key(row.values.SKU_interno), key(row.values.Almacen)]))! > 1) row.errors.push('SKU repetido en el mismo almacén; concilia las filas antes de cargar.');
    const related = result.rows.filter(other => key(other.values.SKU_interno) === key(row.values.SKU_interno));
    if (related.some(other => key(other.values.Unidad) !== key(row.values.Unidad)
      || (other.values.OEM_conocido && row.values.OEM_conocido && key(other.values.OEM_conocido) !== key(row.values.OEM_conocido)))) row.errors.push('El mismo SKU aparece con unidad u OEM diferentes en el archivo.');
  }
  return result;
}

export function stockCountTemplate(): string { return '\ufeff' + STOCK_COUNT_HEADERS.map(csvCell).join(',') + '\r\n'; }
export function stockCountReport(review: CountReview, source: { file: string; sha256: string; comparedAt: string | null }): string {
  const headings = [...STOCK_COUNT_HEADERS, 'Fila_origen', 'Existencia_consultada', 'Diferencia_observada', 'Errores', 'Pendientes', 'Archivo', 'SHA256', 'Consultado_en', 'Estado'];
  const rows = review.rows.map(row => [...STOCK_COUNT_HEADERS.map(name => row.values[name]), row.line, row.physical ?? 'Sin base',
    row.difference ?? 'Sin comparar', row.errors.join(' | '), [...review.warnings, ...row.warnings].join(' | '), source.file, source.sha256,
    source.comparedAt ?? 'Sin consulta vigente', 'SOLO REVISION; NO APLICA SALDOS']);
  return '\ufeff' + [headings, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
}
