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

/** Compress an image file to ≤ 800 KB using canvas, then base64-encode it. */
async function compressToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxW = 1200;
        const scale = img.width > maxW ? maxW / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas unavailable')); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve(dataUrl.split(',')[1]); // strip "data:image/jpeg;base64,"
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
  GASTOS_COMPRAS: 'Gastos_Compras',
  GASTOS_LINEAS: 'Gastos_Lineas',
  GASTOS_PRESUPUESTO: 'Gastos_Presupuesto',
} as const;
