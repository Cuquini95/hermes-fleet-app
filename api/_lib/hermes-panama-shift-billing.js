const valuationColumns = {
  unit: 'Código', from: 'Fecha inicial', to: 'Fecha final', reported: 'Horas reportadas', adjustment: 'Ajuste',
  valued: 'Horas a valorizar', rate: 'Tarifa US$/h', total: 'Valor US$', status: 'Estado',
};
const invoiceColumns = {
  id: 'ID línea', type: 'Tipo', date: 'Fecha documento', unit: 'Equipo', from: 'Inicio período', to: 'Fin período',
  reference: 'Documento / factura referencia', amount: 'Importe base USD', verification: 'Verificación',
};
const monthCodes = ['jan ene', 'feb', 'mar', 'apr abr', 'may', 'jun', 'jul', 'aug ago', 'sep set', 'oct', 'nov', 'dec dic'];
const clean = value => typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
const normal = value => clean(value).normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();

function exactDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const parsed = new Date(value + 'T00:00:00Z');
  return Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === value ? value : '';
}

function sheetDate(value) {
  const text = clean(value);
  const named = /^(\d{1,2})-([a-z]{3})-(\d{2}|\d{4})$/i.exec(text);
  if (named) {
    const month = monthCodes.findIndex(codes => codes.split(' ').includes(named[2].toLowerCase())) + 1;
    const year = named[3].length === 2 ? '20' + named[3] : named[3];
    if (month) return exactDate(year + '-' + String(month).padStart(2, '0') + '-' + named[1].padStart(2, '0'));
  }
  const numeric = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  return numeric ? exactDate(numeric[3] + '-' + numeric[1].padStart(2, '0') + '-' + numeric[2].padStart(2, '0')) : exactDate(text);
}

function numberCell(value, scale, { signed = false, money = false } = {}) {
  const string = clean(value).replace(money ? /^\$/ : /^$/, '');
  const match = /^(-?)(\d{1,12}|\d{1,3}(?:,\d{3}){1,3})(?:\.(\d{1,6}))?$/.exec(string);
  if (!match || (match[1] && !signed) || (match[3]?.length ?? 0) > scale) return null;
  const whole = BigInt(match[2].replaceAll(',', ''));
  const fraction = (match[3] ?? '').padEnd(scale, '0');
  const ticks = (whole * (10n ** BigInt(scale)) + BigInt(fraction)) * (match[1] ? -1n : 1n);
  const digits = money ? fraction : fraction.replace(/0+$/, '');
  return { ticks, shown: (ticks < 0n ? '-' : '') + whole + (digits ? '.' + digits : '') };
}

function rowsByHeader(source, schema, firstDataRow) {
  const { rows } = source ?? {};
  if (!Array.isArray(rows) || !Array.isArray(rows[0])) throw new Error('Formato de fuente TMF no disponible');
  const header = rows[0].map(normal);
  const columns = Object.entries(schema).map(([key, title]) => {
    const target = normal(title);
    const index = header.indexOf(target);
    if (index < 0 || index !== header.lastIndexOf(target)) throw new Error('Cabecera de fuente TMF ambigua o incompleta');
    return [key, index];
  });
  return rows.slice(1).map((row, index) => ({
    ...Object.fromEntries(columns.map(([key, column]) => [key, clean(row?.[column])])),
    rowNumber: firstDataRow + index,
  }));
}

function workbookLink(workbookId, gid, from, to) {
  if (!/^[A-Za-z0-9_-]{20,}$/.test(workbookId ?? '')) return undefined;
  return `https://docs.google.com/spreadsheets/d/${workbookId}/edit#gid=${gid}&range=${from}:${to}`;
}

function matchesPeriod(row, unit, from, to) {
  return normal(row.unit) === unit && sheetDate(row.from) === from && sheetDate(row.to) === to;
}

function issue(status, message, reference) {
  return { status, message, reference, valuation: null, invoice: null };
}

function valuationDetail(row, periodStart, periodEnd, workbookId) {
  const reported = numberCell(row.reported, 3);
  const adjustment = numberCell(row.adjustment, 3, { signed: true });
  const valued = numberCell(row.valued, 3);
  const rate = numberCell(row.rate, 2, { money: true });
  const total = numberCell(row.total, 2, { money: true });
  if (!reported || !adjustment || !valued || !rate || !total
    || reported.ticks + adjustment.ticks !== valued.ticks
    || (valued.ticks * rate.ticks + 500n) / 1000n !== total.ticks) return null;
  const link = workbookLink(workbookId, 1700000002, 'A' + row.rowNumber, 'O' + row.rowNumber);
  return {
    periodStart, periodEnd, reportedHours: reported.shown, adjustmentHours: adjustment.shown,
    valuedHours: valued.shown, rate: rate.shown, total: total.shown, currency: 'USD',
    status: row.status || 'Estado pendiente', reference: 'VALORIZACION · fila ' + row.rowNumber, ...(link && { link }),
  };
}

async function invoiceDetail(id, unit, from, to, readInvoices) {
  if (!id) return { invoice: null, invoiceStatus: 'unlinked' };
  let document;
  try {
    const source = await readInvoices();
    const matches = rowsByHeader(source, invoiceColumns, 8).filter(row => row.id === id);
    if (!matches.length) return { invoice: null, invoiceStatus: 'missing' };
    if (matches.length !== 1) return { invoice: null, invoiceStatus: 'review' };
    const [row] = matches;
    const base = numberCell(row.amount, 2, { money: true });
    const date = sheetDate(row.date);
    const verification = normal(row.verification);
    if (!matchesPeriod(row, unit, from, to) || normal(row.type) !== 'FACTURA'
      || !row.reference || !date || !base || base.ticks === 0n
      || (verification && !['PENDIENTE', 'VERIFICADO'].includes(verification))) {
      return { invoice: null, invoiceStatus: 'review' };
    }
    const link = workbookLink(source.workbookId, 1810040107, 'A' + row.rowNumber, 'P' + row.rowNumber);
    document = { id, reference: row.reference, date, baseAmount: base.shown, currency: 'USD',
      verification: verification === 'VERIFICADO' ? 'Verificado' : 'Pendiente', ...(link && { link }) };
  } catch {
    return { invoice: null, invoiceStatus: 'unavailable' };
  }
  return { invoice: document, invoiceStatus: 'linked' };
}

export async function resolveShiftBilling(part, { bridges, readValuation, readInvoices }) {
  if (!Array.isArray(bridges)) return issue('unavailable', 'El cruce autorizado de valorización no está disponible.');
  const bindings = bridges.filter(entry => entry?.partId === part.id && entry.version === part.version && entry.reviewedAt === part.reviewedAt);
  if (!bindings.length) return issue('unlinked', 'Sin cruce autorizado de valorización para este parte.');
  if (bindings.length !== 1) return issue('review', 'Hay más de un cruce para la misma versión del parte.');
  const [{ unit, periodStart, periodEnd, reference, documentLineId }] = bindings;
  const support = clean(reference);
  if (unit !== part.unit || !exactDate(periodStart) || !exactDate(periodEnd)
    || periodStart > part.date || part.date > periodEnd || !support || support.length > 180
    || (documentLineId != null && (typeof documentLineId !== 'string' || documentLineId.trim().length > 160))) {
    return issue('review', 'Revisa el respaldo, la unidad y el período del cruce autorizado.');
  }

  let valuation;
  try {
    const source = await readValuation();
    const matches = rowsByHeader(source, valuationColumns, 4).filter(row => matchesPeriod(row, unit, periodStart, periodEnd));
    if (!matches.length) return issue('review', 'El período asociado no figura en VALORIZACION.', support);
    if (matches.length !== 1) return issue('review', 'El período asociado aparece más de una vez en VALORIZACION.', support);
    valuation = valuationDetail(matches[0], periodStart, periodEnd, source.workbookId);
  } catch {
    return issue('unavailable', 'El maestro de valorización no está disponible.', support);
  }
  if (!valuation) return issue('review', 'Las horas, ajustes o importes del período requieren conciliación.', support);
  return { status: 'linked', reference: support, valuation, ...await invoiceDetail(clean(documentLineId), unit, periodStart, periodEnd, readInvoices) };
}
