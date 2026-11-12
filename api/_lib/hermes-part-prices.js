export const PARTS_RANGE = "'12 Inventario Rep.'!A6:N";
export const EXPENSES_RANGE = "'02 Gastos'!A2:Q";

const text = (value) => String(value ?? '').trim();
const key = (value) => text(value).toUpperCase();
const searchKey = (value) => key(value).normalize('NFD').replace(/\p{Diacritic}/gu, '');
const round = (value) => Math.round(value * 100) / 100;

function positive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function searchInventory(rows, query, equipment) {
  const term = searchKey(query);
  const equipmentTerm = searchKey(equipment);
  const compact = (value) => searchKey(value).replace(/[^A-Z0-9]/g, '');
  const partTerm = compact(query);
  if (!term) return [];
  const results = rows.flatMap((row) => {
    const [number, description, oem, cross, , stock, minimum, price, , , machines, updated, , supplier] = row;
    if (!text(number) || !text(description)) return [];
    const alternatives = text(cross).split(/[,;\n]+/).map(text).filter(Boolean);
    const compatible = text(machines).split(/[,;\n]+/).map(text).filter(Boolean);
    if (equipmentTerm && !compatible.some((model) => searchKey(model).includes(equipmentTerm))) return [];
    const [sku, oemCode, ...aliases] = [number, oem, ...alternatives].map(compact);
    const exact = partTerm && [sku, oemCode, ...aliases].includes(partTerm);
    const codes = partTerm && [sku, oemCode, ...aliases].some((code) => code.includes(partTerm));
    const nameMatches = searchKey(description).includes(term);
    const related = [machines, supplier].some((value) => searchKey(value).includes(term));
    if (!exact && !codes && !nameMatches && !related) return [];
    return [{
      rank: exact ? (sku === partTerm ? 0 : 1) : codes ? 2 : nameMatches ? 3 : 4,
      part: {
        part_number: text(number),
        description: text(description),
        oem_ref: text(oem),
        alternatives,
        stock_quantity: positive(stock),
        stock_minimum: positive(minimum),
        unit_price: positive(price),
        supplier: text(supplier),
        last_updated: text(updated),
        compatible_units: compatible,
        location: '12 Inventario Rep.',
      },
    }];
  });
  return results.sort((a, b) => a.rank - b.rank).slice(0, 30).map(({ part }) => part);
}

function dateKey(value) {
  const date = text(value);
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(date);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!dmy && !iso) return 0;
  const [year, month, day] = (iso ? iso.slice(1) : [dmy[3], dmy[2], dmy[1]]).map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return 0;
  return timestamp;
}

export function recoverExpensePrices(rows, supplier, excludedIds = []) {
  const excluded = new Set(excludedIds.map(key));
  const prices = new Map();
  const supplierKey = searchKey(supplier);
  if (!supplierKey) return prices;

  for (const row of rows) {
    const [id, date, , , rowSupplier] = row;
    const timestamp = dateKey(date);
    if (!timestamp || !text(id) || /^(TEST|QA|DEMO)([-_\s]|$)/i.test(text(id))) continue;
    if (excluded.has(key(id)) || key(row[16]) !== 'APROBADO' || searchKey(rowSupplier) !== supplierKey) continue;
    for (const line of text(row[14]).split(' | ')) {
      const match = /^\[([^\]]+)\]\s+(.+?)\s+x(\d+(?:\.\d+)?)\s+\$(\d+(?:\.\d+)?)$/.exec(line);
      if (!match) continue;
      const [, number, description, quantity, subtotal] = match;
      const partNumber = key(number);
      const unitPrice = round(positive(subtotal) / positive(quantity));
      if (!partNumber || !Number.isFinite(unitPrice) || unitPrice <= 0) continue;
      const previous = prices.get(partNumber);
      if (previous && previous.timestamp > timestamp) continue;
      prices.set(partNumber, { unitPrice, description, date: text(date), timestamp });
    }
  }
  return prices;
}

export function compareQuote(parts, supplier, prices) {
  const seen = new Set();
  const unmatched = [];
  const comparisons = [];
  for (const part of parts) {
    const partNumber = key(part?.part_number);
    const price = round(positive(part?.unit_price));
    if (!partNumber || !price || seen.has(partNumber)) continue;
    seen.add(partNumber);
    const historical = prices.get(partNumber);
    if (!historical) {
      unmatched.push(partNumber);
      continue;
    }
    comparisons.push({
      part_number: partNumber,
      description: text(part.description) || historical.description,
      old_price: historical.unitPrice,
      new_price: price,
      pct_change: round((price / historical.unitPrice - 1) * 100),
      supplier: text(supplier),
      source_date: historical.date,
    });
  }
  const changes = comparisons.filter((comparison) => comparison.old_price !== comparison.new_price);
  return { compared: comparisons.length, unmatched, comparisons, changes };
}
