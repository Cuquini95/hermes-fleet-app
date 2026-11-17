import { readRange, SHEET_TABS } from './sheets-api';
import { panamaPmIntervals, parsePanamaPmNextService, pmMasterNumber, projectPanamaPmNextService, type PanamaPmNextService } from './panama-pm-next-service.js';

export const PANAMA_PM_MASTER_URL = panamaWorkbookLink(import.meta.env.VITE_HERMES_PA_PM_MASTER_LINK);
export const PANAMA_PM_REGISTER_URL = panamaWorkbookLink(import.meta.env.VITE_HERMES_PA_PM_REGISTER_LINK);

export function panamaWorkbookLink(value: unknown) {
  return typeof value === 'string' && /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[\w-]+\/edit(?:#gid=\d+)?$/.test(value) ? value : undefined;
}

type SourceRow = Record<string, string | undefined> & { unit: string };
type Sources = Record<string, SourceRow[] | null | undefined>;

export interface AcceptedPm {
  folio: string;
  unit: string;
  level: string;
  meter: number;
  performedOn: string;
  acceptedAt: string;
  reviewer: string;
  reference: string;
  nextService: PanamaPmNextService | null;
}

export interface MaintenanceEntry {
  unit: string;
  model: string;
  level: string;
  dueAt: number | null;
  currentHours: number | null;
  remaining: number | null;
  state: 'overdue' | 'upcoming' | 'ok' | 'unknown';
  sourceStatus: string;
  reading: string;
  plan: string;
  lastOfficial: string;
  checklistUrl: string | null;
  allowedLevels: string[];
  latestAccepted: AcceptedPm | null;
  reconciliationPending: boolean;
  batchBlock: string | null;
  projectedNext: { dueAt: number; level: string } | null;
}

export interface MaintenanceComponent {
  unit: string;
  critical: number | null;
  upcoming: number | null;
  noData: number | null;
}

export interface PanamaMaintenance {
  entries: MaintenanceEntry[] | null;
  sourceDate?: string;
  historyAvailable: boolean;
  acceptedHistory: AcceptedPm[];
  components: MaintenanceComponent[] | null;
  componentSourcesAvailable: boolean;
}

const clean = (value = '') => value.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();
function meterFromMaster(value?: string): number | null {
  const meter = pmMasterNumber(value);
  return meter !== null && meter >= 0 ? meter : null;
}

export function panamaPmLevel(value?: string): string {
  const match = /^PM[ -]?(\d{2,5}|\d{1,2},\d{3})$/i.exec(value?.trim() ?? '');
  return match ? `PM-${match[1]?.replace(',', '')}` : '';
}

function checklistLink(value?: string): string | null {
  return /^https:\/\/docs\.google\.com\/spreadsheets\/d\/1AeTvqR052hJHhEQ7jbkJ3_VIxwPa5ftwGKeVxVlasYw\/edit(?:#gid=\d+)?$/.test(value ?? '') ? value! : null;
}

function latestAccepted(history: string[][]): Map<string, AcceptedPm> {
  const accepted = new Map<string, AcceptedPm>();
  for (const row of history) {
    const [, folio = '', unit = '', , rawLevel, , rawMeter, , , , status, , , performedOn = '', reviewerId, reviewer = '', acceptedAt = '', reference = '', nextService] = row;
    const meter = meterFromMaster(rawMeter);
    const level = panamaPmLevel(rawLevel);
    if (clean(status) !== 'COMPLETADA' || !/^OT-[\w-]+$/i.test(folio) || !unit || !level || meter === null
      || !/^\d{4}-\d{2}-\d{2}$/.test(performedOn) || !Number.isFinite(Date.parse(acceptedAt)) || !reviewerId?.trim() || !reference.trim()) continue;
    const key = clean(unit);
    const previous = accepted.get(key);
    if (!previous || meter > previous.meter || (meter === previous.meter && Date.parse(acceptedAt) > Date.parse(previous.acceptedAt))) {
      accepted.set(key, { folio, unit: key, level, meter, performedOn, acceptedAt, reviewer, reference, nextService: parsePanamaPmNextService(nextService) });
    }
  }
  return accepted;
}

function sourceState(row: SourceRow, remaining: number | null): MaintenanceEntry['state'] {
  const status = clean(row.status);
  if (remaining !== null && (remaining <= 0 || status.includes('VENCIDO'))) return 'overdue';
  if (remaining === null || /SIN |FALTA|ACTUALIZAR|INACTIVO|ATRASAD/.test(`${status} ${clean(row.reading)}`)) return 'unknown';
  if (/PROGRAMAR|PRONTO/.test(status)) return 'upcoming';
  return status === 'AL DIA' || status.includes('BIEN') ? 'ok' : 'unknown';
}

export function buildPanamaMaintenance(sections: Sources, history: string[][] | null): PanamaMaintenance {
  const plans = new Map((sections.maintenancePlan ?? []).map(row => [clean(row.unit), row]));
  const anchors = new Map((sections.maintenanceAnchor ?? []).map(row => [clean(row.unit), meterFromMaster(row.anchor)]));
  const closures = latestAccepted(history ?? []);
  const entries = sections.maintenance?.map((row): MaintenanceEntry => {
    const unit = clean(row.unit);
    const plan = plans.get(unit);
    const intervals = panamaPmIntervals(plan);
    const accepted = closures.get(unit) ?? null;
    const officialLevel = panamaPmLevel(row.next);
    const dueAt = meterFromMaster(row.due);
    const currentHours = meterFromMaster(row.hours);
    const remaining = pmMasterNumber(row.remaining);
    const masterLast = meterFromMaster(/\ba\s+([\d,.]+)\s*h/i.exec(row.last ?? '')?.[1]);
    const reconciliationPending = accepted !== null && (masterLast === null || accepted.meter > masterLast
      || (accepted.meter === masterLast && /POR CONFIRMAR/.test(clean(row.last))));
    const projection = accepted && reconciliationPending ? projectPanamaPmNextService(accepted, plan, anchors.get(unit) ?? null) : null;
    const projectedNext = projection ? { dueAt: projection.dueAt, level: projection.level } : null;
    let batchBlock = null;
    if (reconciliationPending) batchBlock = 'Cierre por conciliar';
    else if (!officialLevel || dueAt === null || currentHours === null) batchBlock = 'Vencimiento por verificar';
    else if (/SIN |FALTA|ACTUALIZAR|INACTIVO|ATRASAD|PROVISIONAL/.test(clean(`${row.reading ?? ''} ${row.status ?? ''}`))) batchBlock = 'Lectura o estado por verificar';
    else if (clean(plan?.active) !== 'SI' || clean(plan?.approved) !== 'SI') batchBlock = 'Plan de PM por confirmar';
    return {
      unit, model: row.model || plan?.model || '', level: officialLevel, dueAt, currentHours, remaining,
      state: officialLevel && dueAt !== null && currentHours !== null ? sourceState(row, remaining) : 'unknown',
      sourceStatus: row.status ?? '', reading: row.reading ?? '', plan: row.plan ?? '', lastOfficial: row.last ?? '',
      checklistUrl: checklistLink(plan?.checklist), allowedLevels: intervals.map(interval => `PM-${interval}`),
      latestAccepted: accepted, reconciliationPending, batchBlock,
      projectedNext,
    };
  }) ?? null;
  const componentRows = [sections.dozers, sections.excavators].filter((rows): rows is SourceRow[] => Array.isArray(rows));
  const components = componentRows.length > 0 ? componentRows.flat().map(row => ({
    unit: row.unit, critical: meterFromMaster(row.critical), upcoming: meterFromMaster(row.upcoming), noData: meterFromMaster(row.noData),
  })) : null;
  return { entries, historyAvailable: history !== null, acceptedHistory: [...closures.values()], components,
    componentSourcesAvailable: componentRows.length === 2 };
}

export const isPmAlert = (entry: MaintenanceEntry): boolean => entry.state === 'overdue' || entry.state === 'upcoming';

export function maintenanceFullyVerified(data: PanamaMaintenance): boolean {
  return data.entries !== null && data.entries.length > 0 && data.historyAvailable
    && data.entries.every(row => row.state !== 'unknown' && !row.reconciliationPending && !/PROVISIONAL|ATRASAD/.test(clean(`${row.sourceStatus} ${row.reading}`)))
    && data.componentSourcesAvailable && data.components !== null && data.components.length > 0
    && data.components.every(row => row.critical !== null && row.upcoming !== null && row.noData === 0);
}

export async function fetchPanamaMaintenance(signal?: AbortSignal, historySignal = signal): Promise<PanamaMaintenance> {
  const [source, history] = await Promise.allSettled([
    fetch('/hermes-api/api/panama/maintenance', { cache: 'no-store', credentials: 'same-origin', signal })
      .then(async response => {
        if (!response.ok) throw new Error('No se pudo consultar el maestro PM FLOTA.');
        const data = await response.json();
        if (data?.project !== 'tmf-panama' || !data.sections) throw new Error('Respuesta fuera del proyecto.');
        return { sections: data.sections as Sources, sourceDate: data.snapshots?.maintenance as string | undefined };
      }),
    // An explicit offset bypasses the shared client cache when refreshing after an acceptance.
    readRange(SHEET_TABS.HISTORIAL_PM, historySignal, undefined, 0),
  ]);
  if (signal?.aborted) throw new DOMException('Consulta cancelada', 'AbortError');
  const master = source.status === 'fulfilled' ? source.value : undefined;
  return { ...buildPanamaMaintenance(master?.sections ?? {}, history.status === 'fulfilled' ? history.value : null), sourceDate: master?.sourceDate };
}
