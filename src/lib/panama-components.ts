import { hermesApiUrl } from './hermes-api-base';

export interface ComponentRow {
  part: string;
  position: string;
  source: string;
  status: string;
  date?: string;
  meter?: string;
  reason?: string;
  target?: string;
  currentMeter?: string;
  remaining?: string;
  installedMeter?: string;
  elapsed?: string;
  calculation?: { status: 'verified' | 'reproduced' | 'mismatch'; elapsed: number; remaining: number }
    | { status: 'regressed' | 'incomplete' };
}

export interface ComponentHistory {
  unit: string;
  changes: ComponentRow[];
  life: ComponentRow[];
  unavailable: string[];
  snapshots?: Record<string, string>;
}

export async function fetchPanamaComponents(unit: string, signal: AbortSignal): Promise<ComponentHistory> {
  const response = await fetch(hermesApiUrl('/api/panama/componentes?' + new URLSearchParams({ unit })), {
    signal, cache: 'no-store', credentials: 'same-origin',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Consulta no disponible');
  if (data.unit !== unit || !Array.isArray(data.life)) throw new Error('La consulta devolvió otro equipo.');
  return data;
}
