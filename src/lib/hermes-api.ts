// Always proxy through /hermes-api — Vite dev server and Vercel both rewrite to VPS
const HERMES_BASE = '/hermes-api';

async function hermesPost<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${HERMES_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Hermes API error ${response.status}: ${text}`);
  }
  return response.json();
}

async function hermesGet<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  const response = await fetch(`${HERMES_BASE}${endpoint}${qs}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Hermes API error ${response.status}: ${text}`);
  }
  return response.json();
}

export interface DiagnoseParams {
  equipo: string;
  sintoma: string;
  foto_base64?: string;
  codigo_falla?: string;
  horometro?: number;
}

export interface DiagnoseResult {
  causas_probables: string[];
  checklist_diagnostico: string[];
  partes_probables: string[];
  prioridad: string;
}

export async function diagnose(params: DiagnoseParams): Promise<DiagnoseResult> {
  return hermesPost('/ai/diagnose', params as unknown as Record<string, unknown>);
}

export interface PhotoAnalysisParams {
  foto_base64: string;
  equipo?: string;
  contexto?: string;
}

export interface PhotoAnalysisResult {
  componente_probable: string;
  tipo_de_dano: string;
  severidad: string;
  recomendacion_inicial: string;
}

export async function photoToFailure(params: PhotoAnalysisParams): Promise<PhotoAnalysisResult> {
  return hermesPost('/ai/photo_to_failure', params as unknown as Record<string, unknown>);
}

export interface ManualLookupParams {
  equipo: string;
  tema: string;
  seccion?: string;
}

export interface ManualLookupResult {
  extracto: string;
  pasos_tecnicos: string[];
  herramientas_requeridas: string[];
  torque_specs?: string;
}

export async function manualLookup(params: ManualLookupParams): Promise<ManualLookupResult> {
  return hermesPost('/ai/manual_lookup', params as unknown as Record<string, unknown>);
}

export interface PartResult {
  part_number: string;
  description: string;
  oem_ref: string;
  compatible_units: string[];
  stock_quantity: number;
  stock_minimum: number;
  location: string;
  unit_price: number;
  alternatives: string[];
}

export async function searchParts(query: string, equipo?: string): Promise<PartResult[]> {
  const params: Record<string, string> = { q: query };
  if (equipo) params.equipo = equipo;
  return hermesGet('/parts', params);
}

export interface DiagramResult {
  found: boolean;
  pdf?: string;
  page?: number;
  section?: string;
  image_url?: string;
  message?: string;
}

export async function findDiagram(equipo: string, search: string): Promise<DiagramResult> {
  return hermesGet('/diagrams/find', { equipo, search });
}

export interface FaultCodePagesResult {
  found: boolean;
  pdf?: string;
  page_start?: number;
  page_end?: number;
  codigo?: string;
  message?: string;
}

export async function getFaultCodePages(equipo: string, codigo_falla: string): Promise<FaultCodePagesResult> {
  return hermesGet('/ai/fault_code_pages', { equipo, codigo_falla });
}
