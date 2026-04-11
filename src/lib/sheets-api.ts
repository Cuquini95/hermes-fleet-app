const HERMES_API = '/hermes-api';

export async function appendRow(tab: string, values: string[]): Promise<void> {
  const response = await fetch(`${HERMES_API}/api/sheets/append`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tab, values }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sheets API error ${response.status}: ${text}`);
  }
}

export async function readRange(tab: string): Promise<string[][]> {
  const params = new URLSearchParams({ tab });
  const response = await fetch(`${HERMES_API}/api/sheets/read?${params}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sheets API error ${response.status}: ${text}`);
  }
  const data = await response.json();
  return data.data || [];
}

export async function updateCell(
  tab: string,
  searchColumn: number,
  searchValue: string,
  updateColumn: number,
  updateValue: string
): Promise<void> {
  const response = await fetch(`${HERMES_API}/api/sheets/update`, {
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
}

export async function upsertRow(
  tab: string,
  key: string,
  values: string[]
): Promise<'updated' | 'inserted'> {
  const response = await fetch(`${HERMES_API}/api/sheets/upsert-row`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tab, key, values }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sheets upsert error ${response.status}: ${text}`);
  }
  const data = await response.json();
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
        resolve(dataUrl.split(',')[1]); // strip "data:image/jpeg;base64,"
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
 * VPS exposes: POST /api/ocr/boleta  { image_base64: string }
 * Returns structured boleta data.
 */
export async function ocrBoleta(file: File): Promise<OcrBoletaResult> {
  const image_base64 = await compressToBase64(file);
  const response = await fetch(`${HERMES_API}/api/ocr/boleta`, {
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
 * Send a receipt image to the VPS OCR endpoint.
 * VPS must expose: POST /api/ocr/receipt  { image_base64: string }
 * Returns structured receipt data.
 */
export async function ocrReceipt(file: File): Promise<OcrReceiptResult> {
  const image_base64 = await compressToBase64(file);
  const response = await fetch(`${HERMES_API}/api/ocr/receipt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_base64 }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OCR error ${response.status}: ${text}`);
  }
  return response.json() as Promise<OcrReceiptResult>;
}

// ── Sheet tab names ───────────────────────────────────────────────────────────

export const SHEET_TABS = {
  FLOTA: '01 Inventario',
  INSPECCIONES: '14 Inspecciones',
  AVERIAS: 'Averías',
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
  GASTOS: 'Gastos',
  GASTOS_PRESUPUESTO: 'Gastos_Presupuesto',
  CATALOGO_PRECIOS: 'Catalogo_Precios',
} as const;
