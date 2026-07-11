export interface AveriaEntry {
  fecha: string;
  hora: string;
  unidad: string;
  tipo: string;
  descripcion: string;
  severidad: string;
  tecnico: string;
  tiempo_paro: string;
  costo: string;
  estado: string;
  solucion: string;
  observaciones: string;
  ot_id: string;
  foto_url: string;
}

const URL_RE = /^https?:\/\//i;
const OT_RE = /\bOT-\d{8}-\d{4}-[a-z0-9]{4}\b/i;

function isUrl(value: string): boolean {
  return URL_RE.test(value.trim());
}

function extractOtId(value: string): string {
  return value.match(OT_RE)?.[0] ?? '';
}

function stripOtFromObservaciones(value: string): string {
  return value.replace(/\s*\|\s*OT:\s*OT-\d{8}-\d{4}-[a-z0-9]{4}\b/i, '').trim();
}

export function parseAveriaRow(row: string[]): AveriaEntry | null {
  const fecha = (row[0] ?? '').trim();
  const unidad = (row[2] ?? '').trim();
  if (!fecha.includes('/') || !unidad) return null;

  const observacionesRaw = (row[11] ?? '').trim();
  const otCell = (row[13] ?? '').trim();
  const fotoCell = (row[14] ?? '').trim();
  const otCellIsPhoto = isUrl(otCell);

  return {
    fecha,
    hora: (row[1] ?? '').trim(),
    unidad,
    tipo: (row[3] ?? '').trim(),
    descripcion: (row[4] ?? '').trim(),
    severidad: (row[5] ?? '').trim().toUpperCase(),
    tecnico: (row[6] ?? '').trim(),
    tiempo_paro: (row[7] ?? '').trim(),
    costo: (row[8] ?? '').trim(),
    estado: (row[9] ?? '').trim(),
    solucion: (row[10] ?? '').trim(),
    observaciones: otCellIsPhoto ? stripOtFromObservaciones(observacionesRaw) : observacionesRaw,
    ot_id: otCellIsPhoto ? extractOtId(observacionesRaw) : otCell,
    foto_url: fotoCell || (otCellIsPhoto ? otCell : ''),
  };
}

export function isOpenAveria(averia: AveriaEntry): boolean {
  return averia.estado.trim().toLowerCase() === 'abierta';
}

export function openAveriaUnitSet(rows: string[][]): Set<string> {
  const units = new Set<string>();
  for (const row of rows) {
    const averia = parseAveriaRow(row);
    if (averia && isOpenAveria(averia)) {
      units.add(averia.unidad.toUpperCase());
    }
  }
  return units;
}

const PHOTO_URL_RE = /https?:\/\/[^\s,|"'<>]+/gi;

function normalizePhotoUrl(value: string): string {
  return value.trim().replace(/[)\].,;]+$/g, '');
}

function isHttpPhotoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function photoUrls(value: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const match of value.matchAll(PHOTO_URL_RE)) {
    const rawUrl = match[0] ?? '';
    const matchIndex = match.index ?? 0;
    const prefix = value.slice(Math.max(0, matchIndex - 5), matchIndex).toLowerCase();
    if (prefix.endsWith('blob:')) continue;

    const url = normalizePhotoUrl(rawUrl);
    if (!url || seen.has(url) || !isHttpPhotoUrl(url)) continue;
    seen.add(url);
    urls.push(url);
  }

  return urls;
}

export function firstPhotoUrl(value: string): string {
  return photoUrls(value)[0] ?? '';
}
