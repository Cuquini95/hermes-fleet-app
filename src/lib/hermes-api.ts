// Always proxy through /hermes-api — Vite dev server and Vercel both rewrite to VPS
const HERMES_BASE = '/hermes-api';

/** Backoff delays: 1s, 2s, 4s, 8s */
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];
const REQUEST_TIMEOUT_MS = 15_000;

async function hermesPost<T>(
  endpoint: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const timeoutCtrl = new AbortController();
    const timeoutId = setTimeout(() => timeoutCtrl.abort(), REQUEST_TIMEOUT_MS);
    const combined = signal ? combineSignals(signal, timeoutCtrl.signal) : timeoutCtrl.signal;

    try {
      const res = await fetch(`${HERMES_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: combined,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Hermes API error ${res.status}: ${text}`);
      }
      return res.json();
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

async function hermesGet<T>(
  endpoint: string,
  params?: Record<string, string>,
  signal?: AbortSignal,
): Promise<T> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const timeoutCtrl = new AbortController();
    const timeoutId = setTimeout(() => timeoutCtrl.abort(), REQUEST_TIMEOUT_MS);
    const combined = signal ? combineSignals(signal, timeoutCtrl.signal) : timeoutCtrl.signal;

    try {
      const res = await fetch(`${HERMES_BASE}${endpoint}${qs}`, { signal: combined });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Hermes API error ${res.status}: ${text}`);
      }
      return res.json();
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

function combineSignals(...signals: AbortSignal[]): AbortSignal {
  const ctrl = new AbortController();
  for (const sig of signals) {
    if (sig.aborted) { ctrl.abort(); break; }
    sig.addEventListener('abort', () => ctrl.abort(), { once: true });
  }
  return ctrl.signal;
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

/** Run AI diagnosis on a failure description and return probable causes, checklist, and parts. */
export async function diagnose(params: DiagnoseParams, signal?: AbortSignal): Promise<DiagnoseResult> {
  return hermesPost('/ai/diagnose', params as unknown as Record<string, unknown>, signal);
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

/** Analyze a photo (base64 JPEG/PNG) and return probable component, damage type, and initial recommendation. */
export async function photoToFailure(params: PhotoAnalysisParams, signal?: AbortSignal): Promise<PhotoAnalysisResult> {
  return hermesPost('/ai/photo_to_failure', params as unknown as Record<string, unknown>, signal);
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

/** Retrieve a relevant manual excerpt plus technical steps and torque specs for a given equipment/topic. */
export async function manualLookup(params: ManualLookupParams, signal?: AbortSignal): Promise<ManualLookupResult> {
  return hermesPost('/ai/manual_lookup', params as unknown as Record<string, unknown>, signal);
}

export interface PartResult {
  part_number: string;
  description: string;
  supplier?: string;
  last_updated?: string;
  oem_ref: string;
  compatible_units: string[];
  stock_quantity: number;
  stock_minimum: number;
  location: string;
  unit_price: number;
  alternatives: string[];
}

type RawPartResult = Partial<PartResult> & {
  supplier?: string;
  last_updated?: string;
};

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

export function normalizePartResult(raw: RawPartResult): PartResult {
  const supplier = String(raw.supplier ?? '').trim();
  const location = String(raw.location ?? '').trim();

  return {
    part_number: String(raw.part_number ?? '').trim(),
    description: String(raw.description ?? '').trim(),
    supplier: supplier || undefined,
    last_updated: raw.last_updated,
    oem_ref: String(raw.oem_ref ?? supplier ?? '').trim(),
    compatible_units: toArray(raw.compatible_units),
    stock_quantity: Number.isFinite(Number(raw.stock_quantity)) ? Number(raw.stock_quantity) : 0,
    stock_minimum: Number.isFinite(Number(raw.stock_minimum)) ? Number(raw.stock_minimum) : 1,
    location: location || (supplier ? `Proveedor: ${supplier}` : 'Catalogo'),
    unit_price: Number.isFinite(Number(raw.unit_price)) ? Number(raw.unit_price) : 0,
    alternatives: toArray(raw.alternatives),
  };
}

/** Search the parts catalog by free-text query, optionally filtered by equipment model. */
export async function searchParts(query: string, equipo?: string, signal?: AbortSignal): Promise<PartResult[]> {
  const params: Record<string, string> = { q: query };
  if (equipo) params.equipo = equipo;
  const raw = await hermesGet<RawPartResult[]>('/parts', params, signal);
  return raw.map(normalizePartResult).filter((part) => part.part_number);
}

export interface DiagramResult {
  found: boolean;
  pdf?: string;
  page?: number;
  section?: string;
  image_url?: string;
  message?: string;
}

/** Locate a diagram (PDF page or extracted image) matching the given equipment and search term. */
export async function findDiagram(equipo: string, search: string, signal?: AbortSignal): Promise<DiagramResult> {
  return hermesGet('/diagrams/find', { equipo, search }, signal);
}

export interface FaultCodePagesResult {
  found: boolean;
  pdf?: string;
  page_start?: number;
  page_end?: number;
  codigo?: string;
  message?: string;
}

/** Return the PDF page range in the equipment manual where the given fault code is documented. */
export async function getFaultCodePages(equipo: string, codigo_falla: string, signal?: AbortSignal): Promise<FaultCodePagesResult> {
  return hermesGet('/ai/fault_code_pages', { equipo, codigo_falla }, signal);
}
