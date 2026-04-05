const SHEET_ID = '14rWfjrJbXTZG_Mth1Gzk3RzVYd5mohbJR3BsXEItFgU';

function getApiKey(): string {
  return import.meta.env.VITE_GOOGLE_SHEETS_API_KEY || '';
}

export async function appendRow(tab: string, values: string[]): Promise<void> {
  const apiKey = getApiKey();
  const range = encodeURIComponent(`${tab}!A:Z`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED&key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [values] }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sheets API error ${response.status}: ${text}`);
  }
}

export async function readRange(tab: string, range: string): Promise<string[][]> {
  const apiKey = getApiKey();
  const fullRange = encodeURIComponent(`${tab}!${range}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${fullRange}?key=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sheets API error ${response.status}: ${text}`);
  }
  const data = await response.json();
  return data.values || [];
}

export const SHEET_TABS = {
  INSPECCIONES: '14 Inspecciones',
  AVERIAS: 'Averias',
  ORDENES_TRABAJO: 'ORDENES_TRABAJO',
  COMBUSTIBLE: 'Combustible',
  VIAJES: 'Reporte_Viajes_Pena',
  HOROMETROS: '03 Horómetros',
  HISTORIAL_PM: '05 Historial PM',
  INVENTARIO: '12 Inventario Rep',
} as const;
