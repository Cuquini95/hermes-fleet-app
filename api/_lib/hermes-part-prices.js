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
  if (!term) return [];
  const results = rows.flatMap((row) => {
    const [number, description, oem, cross, , stock, minimum, price, , , machines, , , supplier] = row;
    if (!text(number) || !text(description)) return [];
    const searchable = [number, description, oem, cross, machines, supplier].map(searchKey);
    if (!searchable.some((value) => value.includes(term))) return [];
    if (equipmentTerm && !searchable.some((value) => value.includes(equipmentTerm))) return [];
    return [{
      part_number: text(number),
      description: text(description),
      oem_ref: text(oem),
      stock_quantity: positive(stock),
      stock_minimum: positive(minimum),
      unit_price: positive(price),
      supplier: text(supplier),
      compatible_units: text(machines) ? [text(machines)] : [],
      location: 'Inventario de repuestos',
    }];
  });
  return results.slice(0, 30);
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
  const changes = [];
  let compared = 0;
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
    compared++;
    if (historical.unitPrice === price) continue;
    changes.push({
      part_number: partNumber,
      description: text(part.description) || historical.description,
      old_price: historical.unitPrice,
      new_price: price,
      pct_change: round((price / historical.unitPrice - 1) * 100),
      supplier: text(supplier),
      source_date: historical.date,
    });
  }
  return { compared, unmatched, changes };
}
