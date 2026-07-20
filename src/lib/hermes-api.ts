// Always proxy through /hermes-api — Vite dev server and Vercel both rewrite to VPS
import { useAuthStore } from '../stores/auth-store';
import type { NormalizedFaultCode } from './fault-code-parser';
import type { MechanicDiagnosisResult } from './mechanic-diagnosis';
import {
  canonicalizeHermesEquipment,
  filterPartsForCanonicalEquipment,
  isDiagramResultCompatible,
} from './equipment-normalization';

const HERMES_BASE = '/hermes-api';

/** Backoff delays: 1s, 2s, 4s, 8s */
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];
const REQUEST_TIMEOUT_MS = 15_000;
const AI_REQUEST_TIMEOUT_MS = 120_000;

function requestHeaders(includeJson = false): Record<string, string> {
  const token = useAuthStore.getState().token;
  return {
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function hermesPost<T>(
  endpoint: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const timeoutCtrl = new AbortController();
    const requestTimeoutMs = endpoint.startsWith('/ai/') ? AI_REQUEST_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
    const timeoutId = setTimeout(() => timeoutCtrl.abort(), requestTimeoutMs);
    const combined = signal ? combineSignals(signal, timeoutCtrl.signal) : timeoutCtrl.signal;

    try {
      const res = await fetch(`${HERMES_BASE}${endpoint}`, {
        method: 'POST',
        headers: requestHeaders(true),
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
      const res = await fetch(`${HERMES_BASE}${endpoint}${qs}`, {
        headers: requestHeaders(),
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
  partes_probables: Array<string | Record<string, unknown>>;
  prioridad: string;
  probable_system?: string;
  safety_level?: string;
  stop_machine_required?: boolean;
  confidence?: number;
  spanish_answer?: string;
  recommended_parts_to_inspect?: string[];
}

/** Run AI diagnosis on a failure description and return probable causes, checklist, and parts. */
export async function diagnose(params: DiagnoseParams, signal?: AbortSignal): Promise<DiagnoseResult> {
  return hermesPost('/ai/diagnose', params as unknown as Record<string, unknown>, signal);
}

export interface MechanicChatParams {
  user_input: string;
  equipo?: string;
  unit_number?: string;
  user_role?: string;
  detected_code?: NormalizedFaultCode | null;
  equipment_history?: string;
  recent_failures?: string;
  dvir_context?: string;
  maintenance_history?: string;
  photo_base64?: string;
  model_tier?: 'auto' | 'fast' | 'reasoning';
}

/** Full mechanic-brain flow: code detection, manual/catalog/history context, model routing, structured Spanish answer. */
export async function mechanicChat(params: MechanicChatParams, signal?: AbortSignal): Promise<MechanicDiagnosisResult> {
  return hermesPost('/ai/mechanic-chat', params as unknown as Record<string, unknown>, signal);
}

export async function extractCode(text: string, signal?: AbortSignal): Promise<NormalizedFaultCode> {
  return hermesPost('/ai/extract-code', { text }, signal);
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

/** OCR/photo route that extracts dashboard/manual text first, then returns the structured mechanic-brain diagnosis. */
export async function photoDiagnose(params: PhotoAnalysisParams, signal?: AbortSignal): Promise<MechanicDiagnosisResult> {
  return hermesPost('/ai/photo-diagnose', params as unknown as Record<string, unknown>, signal);
}

/** Compatibility wrapper for older callers. New code should use photoDiagnose. */
export async function photoToFailure(params: PhotoAnalysisParams, signal?: AbortSignal): Promise<PhotoAnalysisResult> {
  const result = await photoDiagnose(params, signal);
  return {
    componente_probable: result.probable_system,
    tipo_de_dano: result.likely_causes[0] ?? result.probable_system,
    severidad: result.safety_level,
    recomendacion_inicial: result.spanish_answer,
  };
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
  oem_ref: string;
  compatible_units: string[];
  stock_quantity: number;
  stock_minimum: number;
  location: string;
  unit_price: number;
  alternatives: string[];
}

/** Search the parts catalog by free-text query, optionally filtered by equipment model. */
export async function searchParts(query: string, equipo?: string, signal?: AbortSignal): Promise<PartResult[]> {
  const params: Record<string, string> = { q: query };
  const canonicalEquipment = canonicalizeHermesEquipment(equipo);
  if (canonicalEquipment) params.equipo = canonicalEquipment;

  const results = await hermesGet<PartResult[]>('/parts', params, signal);
  return canonicalEquipment
    ? filterPartsForCanonicalEquipment(results, canonicalEquipment)
    : results;
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
  const canonicalEquipment = canonicalizeHermesEquipment(equipo) ?? equipo;
  const result = await hermesGet<DiagramResult>('/diagrams/find', { equipo: canonicalEquipment, search }, signal);

  if (result.found && !isDiagramResultCompatible(result.pdf, canonicalEquipment)) {
    return {
      found: false,
      pdf: result.pdf,
      message: `Diagram mismatch for ${canonicalEquipment}`,
    };
  }

  return result;
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
