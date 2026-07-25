/**
 * Fleet Data API
 *
 * All write functions call the VPS gateway (/hermes-api) which routes:
 *   PRIMARY_DB=pocketbase → PocketBase first, then mirrors to Google Sheets
 *   PRIMARY_DB=sheets     → Google Sheets directly (rollback mode)
 *
 * The frontend never talks to PocketBase directly — auth and routing
 * are handled by the gateway. No changes are needed here when switching
 * between backends; the VPS env var controls it transparently.
 */
import { HERMES_API_BASE } from './hermes-api-base';
import { useAuthStore } from '../stores/auth-store';

const HERMES_API = HERMES_API_BASE;

// ── Retry + timeout helper ────────────────────────────────────────────────────

const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];
const REQUEST_TIMEOUT_MS = 15_000;

/** Attach Hermes HMAC session so Vercel sheets gate + VPS accept the request. */
function withAuthHeaders(headers?: HeadersInit): HeadersInit {
  const merged = new Headers(headers ?? undefined);
  const { authMode, sessionToken: token } = useAuthStore.getState();
  if (authMode === 'server' && token && !merged.has('Authorization')) {
    merged.set('Authorization', `Bearer ${token}`);
  }
  return merged;
}

/**
 * Any 401 from the gateway invalidates the local session, whatever mode it
 * claims. A 401 is only observable while online, and an offline-mode or legacy
 * (pre-authMode) session holds no credential the gateway will ever accept — so
 * leaving it authenticated strands the user on a dashboard that retries
 * forever with no route back to the login screen.
 */
function clearRejectedServerSession(response: Response): void {
  if (response.status !== 401) return;
  const auth = useAuthStore.getState();
  if (auth.isAuthenticated) auth.logout();
}

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  signal?: AbortSignal,
): Promise<Response> {
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const timeoutCtrl = new AbortController();
    const timeoutId = setTimeout(() => timeoutCtrl.abort(), REQUEST_TIMEOUT_MS);

    // Combine caller abort signal with our timeout signal
    const combinedSignal = signal
      ? createCombinedSignal(signal, timeoutCtrl.signal)
      : timeoutCtrl.signal;

    try {
      const res = await fetch(url, {
        ...options,
        headers: withAuthHeaders(options.headers),
        signal: combinedSignal,
      });
      clearTimeout(timeoutId);
      clearRejectedServerSession(res);
      return res;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < RETRY_DELAYS_MS.length) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
      }
    }
  }

  throw lastError;
}

function createCombinedSignal(...signals: AbortSignal[]): AbortSignal {
  const ctrl = new AbortController();
  for (const sig of signals) {
    if (sig.aborted) { ctrl.abort(); break; }
    sig.addEventListener('abort', () => ctrl.abort(), { once: true });
  }
  return ctrl.signal;
}

// ── Read-side localStorage cache (30s TTL) ────────────────────────────────────

const CACHE_TTL_MS = 30_000;

interface CacheEntry {
  data: string[][];
  expiresAt: number;
}

function getCachedTab(tab: string): string[][] | null {
  try {
    const raw = localStorage.getItem(`hermes_tab_${tab}`);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(`hermes_tab_${tab}`);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function setCachedTab(tab: string, data: string[][]): void {
  try {
    const entry: CacheEntry = { data, expiresAt: Date.now() + CACHE_TTL_MS };
    localStorage.setItem(`hermes_tab_${tab}`, JSON.stringify(entry));
  } catch {
    // localStorage full — not critical
  }
}

function invalidateCachedTab(tab: string): void {
  try {
    localStorage.removeItem(`hermes_tab_${tab}`);
  } catch {
    // not critical
  }
}

// ── API functions ─────────────────────────────────────────────────────────────

/** Append a new row to the given sheet tab. Invalidates the local cache for that tab on success. */
export async function appendRow(tab: string, values: string[]): Promise<void> {
  invalidateCachedTab(tab);
  const response = await fetchWithRetry(`${HERMES_API}/api/sheets/append`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tab, values }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sheets API error ${response.status}: ${text}`);
  }
  const json = await response.json();
  if (!json.success) {
    throw new Error(json.error ?? 'appendRow failed — row not written');
  }
}

/**
 * Read all rows from a sheet tab.
 * - Served from localStorage cache if data is <30s old.
 * - Supports optional limit/offset for server-side pagination (VPS >= 2.0).
 * - Pass signal to cancel in-flight request when component unmounts.
 */
export async function readRange(
  tab: string,
  signal?: AbortSignal,
  limit?: number,
  offset?: number,
): Promise<string[][]> {
  // Return cached data when no pagination is requested
  if (limit === undefined && offset === undefined) {
    const cached = getCachedTab(tab);
    if (cached) return cached;
  }

  const params = new URLSearchParams({ tab });
  if (limit !== undefined) params.set('limit', String(limit));
  if (offset !== undefined) params.set('offset', String(offset));

  const response = await fetchWithRetry(
    `${HERMES_API}/api/sheets/read?${params}`,
    {},
    signal,
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sheets API error ${response.status}: ${text}`);
  }
  const data = await response.json();
  const rows: string[][] = data.data || [];

  // Cache only full fetches (no pagination)
  if (limit === undefined && offset === undefined) {
    setCachedTab(tab, rows);
  }

  return rows;
}

/**
 * Update a single cell by row lookup: find the row where column searchColumn == searchValue,
 * then write updateValue into updateColumn. Throws if no matching row is found.
 */
export async function updateCell(
  tab: string,
  searchColumn: number,
  searchValue: string,
  updateColumn: number,
  updateValue: string
): Promise<void> {
  invalidateCachedTab(tab);
  const response = await fetchWithRetry(`${HERMES_API}/api/sheets/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tab,
      search_column: searchColumn,
      search_value: searchValue,
      update_column: updateColumn,
      update_value: updateValue,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sheets update error ${response.status}: ${text}`);
  }
  const json = await response.json();
  if (!json.success) {
    throw new Error(json.error ?? 'updateCell failed — row not found');
  }
}

/**
 * Insert or update a row keyed by the first column value. Returns 'updated' if an existing row
 * matched the key, or 'inserted' if a new row was appended.
 */
export async function upsertRow(
  tab: string,
  key: string,
  values: string[]
): Promise<'updated' | 'inserted'> {
  invalidateCachedTab(tab);
  const response = await fetchWithRetry(`${HERMES_API}/api/sheets/upsert-row`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tab, key, values }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sheets upsert error ${response.status}: ${text}`);
  }
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error ?? 'upsertRow failed — row not written');
  }
  return data.action;
}

// ── OCR ──────────────────────────────────────────────────────────────────────

export interface OcrLineItem {
  part_number: string;
  description: string;
  qty: number;
  unit_price: number;
  subtotal: number;
}

export interface OcrReceiptResult {
  proveedor: string;
  rfc_proveedor: string;
  folio_factura: string;
  fecha: string;
  subtotal: number;
  iva: number;
  total: number;
  /** Refaccion | Combustible | Servicio | Otro */
  tipo: string;
  line_items: OcrLineItem[];
}

/**
 * Compress an image file for OCR upload.
 * - Printed documents (invoices, receipts, cotizaciones): up to 2400 px wide at 0.90 quality
 *   so small text stays legible for Gemini Vision.
 * - Photos (boletas, breakdowns): up to 1600 px wide at 0.85 quality — good balance.
 * Both paths keep output well under 1.5 MB.
 */
async function compressToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Detect if this is a scanned/photographed document vs a camera photo.
        // Documents tend to be portrait with high aspect ratio; photos are wider.
        const isDocument = img.height > img.width * 1.2;
        const maxW  = isDocument ? 2400 : 1600;
        const quality = isDocument ? 0.90 : 0.85;

        const scale = img.width > maxW ? maxW / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas unavailable')); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const payload = dataUrl.split(',')[1]; // strip "data:image/jpeg;base64,"
        if (payload === undefined) { reject(new Error('Invalid data URL')); return; }
        resolve(payload);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Boleta (trip ticket) OCR ──────────────────────────────────────────────────

export interface OcrBoletaResult {
  folio: string;
  fecha: string;          // YYYY-MM-DD
  hora: string;           // HH:MM (24h)
  fletero: string;
  placas: string;
  capacidad_m3: number;
  material: string;
  banco_carga: string;    // origin
  banco_descarga: string; // destination
  distancia_km: number;
  obra: string;
}

/**
 * Send a boleta (trip ticket) image to the VPS OCR endpoint.
 *
 * Handles two boleta formats automatically:
 *   • PLACOSA SA DE CV  — extracts FOLIO N°XXXXX (large red number at bottom)
 *   • OCH Mining/ENTOC  — extracts REMISIÓN N°XXXX, PESO NETO÷1000 for tons,
 *                          "CV"+CAMIÓN No. for truck, CHOFER for driver
 *
 * VPS exposes: POST /api/ocr/boleta  { image_base64: string }
 * (The enhanced /ai/ocr/boleta endpoint goes live after next VPS deploy.)
 */
export async function ocrBoleta(file: File): Promise<OcrBoletaResult> {
  const image_base64 = await compressToBase64(file);
  const response = await fetchWithRetry(`${HERMES_API}/api/ocr/boleta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_base64 }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OCR boleta error ${response.status}: ${text}`);
  }
  return response.json() as Promise<OcrBoletaResult>;
}

/**
 * Read any file as a raw base64 string (no canvas resizing).
 * Used for PDFs which cannot be drawn on a Canvas.
 */
async function fileToBase64Raw(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const payload = dataUrl.split(',')[1]; // strip "data:application/pdf;base64,"
      if (payload === undefined) { reject(new Error('Invalid data URL')); return; }
      resolve(payload);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Send a receipt image **or PDF** to the VPS OCR endpoint.
 * VPS exposes: POST /api/ocr/receipt  { image_base64, media_type }
 * Returns structured receipt data.
 */
export async function ocrReceipt(file: File): Promise<OcrReceiptResult> {
  const isPdf = file.type === 'application/pdf';
  const image_base64 = isPdf ? await fileToBase64Raw(file) : await compressToBase64(file);
  const media_type   = isPdf ? 'application/pdf' : 'image/jpeg';

  const response = await fetchWithRetry(`${HERMES_API}/api/ocr/receipt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_base64, media_type }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OCR error ${response.status}: ${text}`);
  }
  return response.json() as Promise<OcrReceiptResult>;
}

// ── Fuel dispatch OCR ─────────────────────────────────────────────────────────

export interface OcrFuelRow {
  equipo: string;
  no_economico: string;
  modelo: string;
  horometro: number | null;
  litros: number | null;
  hora: string | null;
  confidence: number;
}

export interface OcrFuelResult {
  fecha_hoja: string;
  rows: OcrFuelRow[];
}

/**
 * Send a handwritten fuel dispatch sheet image to the VPS OCR endpoint.
 * VPS exposes: POST /api/ocr/fuel-dispatch  { image_base64, media_type }
 * Returns structured dispatch data with one row per vehicle.
 */
export async function ocrFuelDispatch(file: File): Promise<OcrFuelResult> {
  const image_base64 = await compressToBase64(file);
  const response = await fetchWithRetry(`${HERMES_API}/api/ocr/fuel-dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_base64, media_type: 'image/jpeg' }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OCR fuel dispatch error ${response.status}: ${text}`);
  }
  return response.json() as Promise<OcrFuelResult>;
}

// ── Parts catalog import ──────────────────────────────────────────────────────

export interface PartImportEntry {
  part_number: string;
  description: string;
  unit_price: number;
}

export interface PriceChange {
  part_number: string;
  description: string;
  old_price: number;
  new_price: number;
  pct_change: number;
  supplier: string;
}

export interface PriceImportResult {
  price_changes: PriceChange[];
  telegram_sent: boolean;
  telegram_reason?: string;
}

/**
 * Upsert parts from a supplier quote into the server-side supplier_catalog.json.
 * Returns any price changes detected (existing part with different price).
 * Returns empty array on failure — non-blocking, does not throw on failure.
 */
export async function importPartsFromQuote(
  supplier: string,
  parts: PartImportEntry[]
): Promise<PriceImportResult> {
  const partsWithNumbers = parts.filter((p) => p.part_number.trim() !== '');
  if (partsWithNumbers.length === 0) return { price_changes: [], telegram_sent: false };
  try {
    const res = await fetchWithRetry('/api/parts/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplier, parts: partsWithNumbers }),
    });
    if (!res.ok) return { price_changes: [], telegram_sent: false, telegram_reason: `http_${res.status}` };
    const data = await res.json();
    return {
      price_changes: (data.price_changes as PriceChange[]) ?? [],
      telegram_sent: data.telegram_sent === true,
      telegram_reason: typeof data.telegram_reason === 'string' ? data.telegram_reason : undefined,
    };
  } catch {
    // Non-critical — parts import failure should never block gasto save
    return { price_changes: [], telegram_sent: false, telegram_reason: 'request_failed' };
  }
}

/**
 * Delete a row matching all key-value criteria (column-index → expected value). Returns true
 * if a row was deleted. Throws when the backend reports the row was not found.
 */
export async function deleteRow(
  tab: string,
  match: Record<string, string>  // { "0": "11/04/2026", "1": "14:00", "2": "CV103" }
): Promise<boolean> {
  invalidateCachedTab(tab);
  const response = await fetchWithRetry(`${HERMES_API}/api/sheets/delete-row`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tab, match }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Delete error ${response.status}: ${text}`);
  }
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error ?? 'deleteRow failed — row not found');
  }
  return data.deleted === true;
}

// ── Sheet tab names ───────────────────────────────────────────────────────────

/** Canonical tab names in the fleet Google Sheet. Use these constants instead of hardcoded strings. */
export const SHEET_TABS = {
  FLOTA: '01 Inventario',
  INSPECCIONES: '14 Inspecciones',
  INSPECCION_STICKERS: 'Inspeccion_Stickers',
  INSPECCION_HALLAZGOS: 'Inspeccion_Hallazgos',
  AVERIAS: 'Averias',
  ORDENES_TRABAJO: 'ORDENES_TRABAJO',
  OT_STATUS_LOG: 'OT_STATUS_LOG',
  COMBUSTIBLE: 'Combustible',
  VIAJES: 'Reporte_Viajes_Peña',
  HOROMETROS: '04B Registro Horómetros',
  HISTORIAL_PM: '05 Historial PM',
  ORDENES_MANTENIMIENTO: 'Ordenes Mantenimiento',
  INVENTARIO: '12 Inventario Rep.',
  FLETES: 'Reporte_Fletes_Transporte',
  INCIDENTES: 'Incidentes',
  TURNOS: 'Turnos',
  COTIZACIONES: 'Cotizaciones_Pendientes',
  NEUMATICOS: '13 Neumáticos',
  GASTOS: '02 Gastos',
  WORKSHOP_SCHEDULE: 'WORKSHOP_SCHEDULE',
  PROVEEDORES: 'Proveedores',
  ORDENES_COMPRA: 'Órdenes de Compra',
  OC_LINEAS: 'OC_Lineas',
} as const;
