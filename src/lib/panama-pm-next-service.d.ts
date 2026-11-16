type Plan = Record<string, string | undefined>;
type SourceDue = { level: string; dueAt: number; cut?: string };
type Projection = { dueAt: number; level: string; cycle: number; anchor: number; intervals: number[] };
export type PanamaPmNextService = { status: 'unavailable'; reason: 'source' | 'plan' | 'anchor' | 'rule' }
  | (Projection & { planCut?: string; anchorCut?: string } & ({ status: 'projected' } | { status: 'verified' | 'mismatch'; official: SourceDue }));
export function pmMasterNumber(value: string | undefined): number | null;
export function panamaPmIntervals(plan?: Plan): number[];
export function projectPanamaPmNextService(accepted: { level: string; meter: number }, plan: Plan | undefined, anchor: number | null): Projection | null;
export function parsePanamaPmNextService(value: unknown): PanamaPmNextService | null;
