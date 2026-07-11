import { z } from 'zod';
import { hermesApiUrl } from './hermes-api-base';

/** Backoff delays: 1s, 2s, 4s, 8s */
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];
const REQUEST_TIMEOUT_MS = 15_000;
const AI_REQUEST_TIMEOUT_MS = 30_000;
const FAST_FAIL_RETRY_DELAYS_MS = [1000];

function requestTimeoutFor(endpoint: string): number {
  if (endpoint === '/ai/diagnose' || endpoint === '/ai/photo_to_failure') {
    return AI_REQUEST_TIMEOUT_MS;
  }
  return REQUEST_TIMEOUT_MS;
}

function retryDelaysFor(endpoint: string): number[] {
  if (endpoint === '/ai/diagnose' || endpoint === '/ai/manual_lookup') {
    return FAST_FAIL_RETRY_DELAYS_MS;
  }
  return RETRY_DELAYS_MS;
}

function trimMarkdownFences(value: string): string {
  return value
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function uniqueCandidates(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const candidate = value.trim();
    if (!candidate || seen.has(candidate)) return false;
    seen.add(candidate);
    return true;
  });
}

export function parseJsonish(raw: string): unknown {
  const trimmed = raw.trim();
  const unfenced = trimMarkdownFences(trimmed);
  const firstObject = unfenced.indexOf('{');
  const lastObject = unfenced.lastIndexOf('}');
  const firstArray = unfenced.indexOf('[');
  const lastArray = unfenced.lastIndexOf(']');

  const candidates = uniqueCandidates([
    trimmed,
    unfenced,
    firstObject >= 0 && lastObject > firstObject ? unfenced.slice(firstObject, lastObject + 1) : '',
    firstArray >= 0 && lastArray > firstArray ? unfenced.slice(firstArray, lastArray + 1) : '',
  ]);

  let lastError: Error | null = null;
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error('Invalid JSON payload');
}

async function parseHermesResponse<T>(
  res: Response,
  schema: z.ZodType<T>,
  endpoint: string,
): Promise<T> {
  const rawText = await res.text();
  let parsedJson: unknown;

  try {
    parsedJson = parseJsonish(rawText);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Hermes API invalid JSON on ${endpoint}: ${reason}`);
  }

  const parsed = schema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error(`Hermes API schema mismatch on ${endpoint}: ${parsed.error.issues[0]?.message ?? 'unknown schema error'}`);
  }

  return parsed.data;
}

async function hermesPost<T>(
  endpoint: string,
  body: Record<string, unknown>,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
): Promise<T> {
  let lastError: Error = new Error('Unknown error');
  const retryDelays = retryDelaysFor(endpoint);

  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const timeoutCtrl = new AbortController();
    const timeoutId = setTimeout(() => timeoutCtrl.abort(), requestTimeoutFor(endpoint));
    const combined = signal ? combineSignals(signal, timeoutCtrl.signal) : timeoutCtrl.signal;

    try {
      const res = await fetch(hermesApiUrl(endpoint), {
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
      return parseHermesResponse(res, schema, endpoint);
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retryDelays.length) {
        await new Promise((r) => setTimeout(r, retryDelays[attempt]));
      }
    }
  }
  throw lastError;
}

async function hermesGet<T>(
  endpoint: string,
  schema: z.ZodType<T>,
  params?: Record<string, string>,
  signal?: AbortSignal,
): Promise<T> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  let lastError: Error = new Error('Unknown error');
  const retryDelays = retryDelaysFor(endpoint);

  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const timeoutCtrl = new AbortController();
    const timeoutId = setTimeout(() => timeoutCtrl.abort(), requestTimeoutFor(endpoint));
    const combined = signal ? combineSignals(signal, timeoutCtrl.signal) : timeoutCtrl.signal;

    try {
      const res = await fetch(hermesApiUrl(`${endpoint}${qs}`), { signal: combined });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Hermes API error ${res.status}: ${text}`);
      }
      return parseHermesResponse(res, schema, endpoint);
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retryDelays.length) {
        await new Promise((r) => setTimeout(r, retryDelays[attempt]));
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
  contexto?: string;
  foto_base64?: string;
  codigo_falla?: string;
  horometro?: number;
}

export interface DiagnoseResult {
  causas_probables: string[];
  checklist_diagnostico: string[];
  partes_probables: Array<string | Record<string, unknown>>;
  tiempo_estimado_hrs?: number;
  prioridad: string;
  advertencias?: string[];
  decision_operativa?: string;
  pregunta_clave?: string;
  nota_tecnica?: string;
}

const booleanishSchema = z.union([z.boolean(), z.string(), z.number()]).transform((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return value.trim().toLowerCase() === 'true';
});

const unknownObjectSchema = z.record(z.string(), z.unknown());

const diagnoseResultSchema: z.ZodType<DiagnoseResult> = z.object({
  causas_probables: z.array(z.string()).catch([]),
  checklist_diagnostico: z.array(z.string()).catch([]),
  partes_probables: z.array(z.union([z.string(), unknownObjectSchema])).catch([]),
  tiempo_estimado_hrs: z.coerce.number().optional(),
  prioridad: z.string().catch('MEDIA'),
  advertencias: z.array(z.string()).optional(),
  decision_operativa: z.string().optional(),
  pregunta_clave: z.string().optional(),
  nota_tecnica: z.string().optional(),
}).transform((value) => ({
  ...value,
  causas_probables: value.causas_probables.map((item) => item.trim()).filter(Boolean),
  checklist_diagnostico: value.checklist_diagnostico.map((item) => item.trim()).filter(Boolean),
  partes_probables: value.partes_probables.filter((item) => {
    if (typeof item === 'string') return item.trim().length > 0;
    return Object.keys(item).length > 0;
  }),
}));

/** Run AI diagnosis on a failure description and return probable causes, checklist, and parts. */
export async function diagnose(params: DiagnoseParams, signal?: AbortSignal): Promise<DiagnoseResult> {
  return hermesPost('/ai/diagnose', params as unknown as Record<string, unknown>, diagnoseResultSchema, signal);
}

export interface PhotoAnalysisParams {
  foto_base64: string;
  equipo?: string;
  contexto?: string;
  media_type?: string;
}

export interface PhotoAnalysisResult {
  componente_probable: string;
  tipo_de_dano: string;
  severidad: string;
  recomendacion_inicial: string;
}

const photoAnalysisResultSchema: z.ZodType<PhotoAnalysisResult> = z.object({
  componente_probable: z.string(),
  tipo_de_dano: z.string(),
  severidad: z.string(),
  recomendacion_inicial: z.string(),
});

/** Analyze a photo (base64 JPEG/PNG) and return probable component, damage type, and initial recommendation. */
export async function photoToFailure(params: PhotoAnalysisParams, signal?: AbortSignal): Promise<PhotoAnalysisResult> {
  return hermesPost('/ai/photo_to_failure', params as unknown as Record<string, unknown>, photoAnalysisResultSchema, signal);
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

const manualLookupResultSchema: z.ZodType<ManualLookupResult> = z.object({
  extracto: z.string(),
  pasos_tecnicos: z.array(z.string()).catch([]),
  herramientas_requeridas: z.array(z.string()).catch([]),
  torque_specs: z.string().optional(),
}).transform((value) => ({
  ...value,
  pasos_tecnicos: value.pasos_tecnicos.map((item) => item.trim()).filter(Boolean),
  herramientas_requeridas: value.herramientas_requeridas.map((item) => item.trim()).filter(Boolean),
}));

/** Retrieve a relevant manual excerpt plus technical steps and torque specs for a given equipment/topic. */
export async function manualLookup(params: ManualLookupParams, signal?: AbortSignal): Promise<ManualLookupResult> {
  return hermesPost('/ai/manual_lookup', params as unknown as Record<string, unknown>, manualLookupResultSchema, signal);
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

type RawPartResult = Omit<Partial<PartResult>, 'stock_quantity' | 'stock_minimum' | 'unit_price'> & {
  supplier?: string;
  last_updated?: string;
  stock_quantity?: number | string;
  stock_minimum?: number | string;
  unit_price?: number | string;
};

const rawPartResultSchema = z.object({
  part_number: z.string().optional(),
  description: z.string().optional(),
  supplier: z.string().optional(),
  last_updated: z.string().optional(),
  oem_ref: z.string().optional(),
  compatible_units: z.array(z.string()).optional(),
  stock_quantity: z.union([z.number(), z.string()]).optional(),
  stock_minimum: z.union([z.number(), z.string()]).optional(),
  location: z.string().optional(),
  unit_price: z.union([z.number(), z.string()]).optional(),
  alternatives: z.array(z.string()).optional(),
}).passthrough();

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
  const raw = await hermesGet('/parts', z.array(rawPartResultSchema), params, signal);
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

const diagramResultSchema: z.ZodType<DiagramResult> = z.object({
  found: booleanishSchema.catch(false),
  pdf: z.string().optional(),
  page: z.coerce.number().optional(),
  section: z.string().optional(),
  image_url: z.string().optional(),
  message: z.string().optional(),
});

/** Locate a diagram (PDF page or extracted image) matching the given equipment and search term. */
export async function findDiagram(equipo: string, search: string, signal?: AbortSignal): Promise<DiagramResult> {
  return hermesGet('/diagrams/find', diagramResultSchema, { equipo, search }, signal);
}

export interface FaultCodePagesResult {
  found: boolean;
  pdf?: string;
  page_start?: number;
  page_end?: number;
  codigo?: string;
  message?: string;
}

const faultCodePagesResultSchema: z.ZodType<FaultCodePagesResult> = z.object({
  found: booleanishSchema.catch(false),
  pdf: z.string().optional(),
  page_start: z.coerce.number().optional(),
  page_end: z.coerce.number().optional(),
  codigo: z.string().optional(),
  message: z.string().optional(),
});

/** Return the PDF page range in the equipment manual where the given fault code is documented. */
export async function getFaultCodePages(equipo: string, codigo_falla: string, signal?: AbortSignal): Promise<FaultCodePagesResult> {
  return hermesGet('/ai/fault_code_pages', faultCodePagesResultSchema, { equipo, codigo_falla }, signal);
}
