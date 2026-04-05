const HERMES_API = import.meta.env.DEV
  ? 'http://5.78.204.80:8000'
  : '/hermes-api';

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
