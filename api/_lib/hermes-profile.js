const sources = [
  { tab: '14 Inspecciones', name: 'Inspecciones DVIR', actor: 28, unit: 4, date: 2, time: 3, folio: 1, detail: 22, evidence: 24 },
  { tab: 'Inspeccion_Stickers', name: 'Inspecciones Sticker', actor: 18, unit: 5, date: 3, time: 4, folio: 1, detail: 10, evidence: 16 },
  { tab: 'Averías', name: 'Fallas reportadas', actor: 15, unit: 2, date: 0, time: 1, folio: 13, detail: 4, evidence: 14 },
  { tab: 'Combustible', name: 'Diésel', actor: 13, unit: 3, date: 1, time: 2, folio: 0, detail: 6 },
  { tab: '04B Registro Horómetros', name: 'Horómetros', actor: 9, unit: 2, date: 0, time: 1, detail: 6 },
  { tab: 'Reporte_Fletes_Transporte', name: 'Viajes', actor: 15, unit: 2, date: 0, time: 1, folio: 14, detail: 8 },
  { tab: '02 Gastos', name: 'Gastos', actor: 18, unit: 10, date: 1, time: 2, folio: 0, detail: 4 },
];

const normalize = value => String(value ?? '').trim().toUpperCase();
const timestamp = ({ date, time }) => {
  const parts = date.match(/^(\d\d)\/(\d\d)\/(\d{4})$/);
  return (parts ? [parts[3], parts[2], parts[1]].join('-') : date) + 'T' + time;
};

export async function readPersonalHistory(sheets, session, { mayRead, supportsUnit }) {
  const allowed = sources.filter(source => mayRead(source.tab));
  const settled = await Promise.allSettled(allowed.map(source => sheets.read(source.tab)));
  const own = normalize(session.userId);
  let priorFaults = new Set();
  let legacyLinksUnavailable = false;
  // Older fault rows were attributed through their linked work order.
  if (settled.some((result, index) => {
    const source = allowed[index];
    return (source.tab === 'Averías' || source.tab === '14 Inspecciones') && result.status === 'fulfilled'
      && result.value.some(row => !row[source.actor] && row[source.tab === 'Averías' ? 13 : 25]);
  })) {
    try {
      priorFaults = new Set((await sheets.read('ORDENES_TRABAJO')).filter(row =>
        normalize(row[19]) === own && supportsUnit(row[3])).map(row => normalize(row[1]) + ':' + normalize(row[3])));
    } catch { legacyLinksUnavailable = true; }
  }
  const records = [];
  const unavailable = legacyLinksUnavailable ? ['Vínculos históricos de Taller'] : [];
  for (const [index, source] of allowed.entries()) {
    const result = settled[index];
    if (result.status === 'rejected') {
      unavailable.push(source.name);
      continue;
    }
    for (const row of result.value) {
      const actor = normalize(row[source.actor]);
      const link = source.tab === 'Averías' ? row[13] : source.tab === '14 Inspecciones' ? row[25] : '';
      const linked = !actor && link && priorFaults.has(normalize(link) + ':' + normalize(row[source.unit]));
      if ((!own || actor !== own) && !linked) continue;
      const unit = String(row[source.unit] ?? '').trim();
      if (!unit || !supportsUnit(unit)) continue;
      records.push({
        type: source.name, unit, date: String(row[source.date] ?? ''), time: String(row[source.time] ?? ''),
        folio: String(row[source.folio] ?? ''), detail: String(row[source.detail] ?? ''), row,
        ...(source.evidence !== undefined && { evidence: String(row[source.evidence] ?? '').split(/,\s*/).filter(Boolean) }),
      });
    }
  }
  records.sort((a, b) => timestamp(b).localeCompare(timestamp(a)));
  return { records, unavailable };
}
