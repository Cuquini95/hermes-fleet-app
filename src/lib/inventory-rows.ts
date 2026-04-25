export interface InventoryItem {
  partNumber: string;
  description: string;
  oemRef: string;
  stock: number;
  minimum: number;
  unit: string;
  category: string;
}

const NON_DATA_MARKERS = [
  'grupo trans plus',
  'inventario de repuestos',
  'control de bodega',
  'stock minimo',
  'stock mínimo',
  'generar oc inmediata',
  'conectado a hermes agent',
  'total articulos',
  'total artículos',
  'bajo stock minimo',
  'bajo stock mínimo',
  'countif',
  'reordenar',
];

function parseNumberCell(value: string | undefined): number | null {
  const text = (value ?? '').trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  return Number(text);
}

export function isInventoryDataRow(row: string[] | undefined): row is string[] {
  if (!row || row.length < 5) return false;

  const partNumber = (row[0] ?? '').trim();
  const description = (row[1] ?? '').trim();
  const joined = row.join(' ').toLowerCase();

  if (!partNumber || partNumber.startsWith('#')) return false;
  if (!description) return false;
  if (row.some((cell) => (cell ?? '').trim().startsWith('='))) return false;
  if (NON_DATA_MARKERS.some((marker) => joined.includes(marker))) return false;
  if (!/^[A-Z0-9][A-Z0-9._/-]{1,}$/i.test(partNumber)) return false;

  return parseNumberCell(row[3]) !== null && parseNumberCell(row[4]) !== null;
}

export function parseInventoryRows(rows: string[][]): InventoryItem[] {
  return rows.reduce<InventoryItem[]>((items, row) => {
    if (!isInventoryDataRow(row)) return items;

    const stock = parseNumberCell(row[3]) ?? 0;
    const minimum = parseNumberCell(row[4]) ?? 0;

    items.push({
      partNumber: row[0]!.trim(),
      description: row[1]?.trim() ?? '',
      oemRef: row[2]?.trim() ?? '',
      stock,
      minimum,
      unit: row[5]?.trim() ?? '',
      category: row[6]?.trim() ?? '',
    });

    return items;
  }, []);
}

export function countCriticalInventory(rows: string[][]): number {
  return parseInventoryRows(rows).filter((item) => item.stock <= item.minimum).length;
}
