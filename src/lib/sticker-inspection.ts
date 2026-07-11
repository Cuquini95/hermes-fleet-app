import type {
  StickerColor,
  StickerFindingInput,
  StickerInspectionDecision,
  StickerInspectionItem,
  StickerInspectionStatus,
} from '../types/sticker-inspection';

export function addDaysToInputDate(inputDate: string, days: number): string {
  const date = inputDate ? new Date(`${inputDate}T00:00:00`) : new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function colorLabel(color: StickerColor): string {
  if (color === 'green') return 'Aprobado';
  if (color === 'yellow') return 'Condicionado';
  return 'Rechazado';
}

export function colorClass(color: StickerColor): string {
  if (color === 'green') return 'bg-green-600';
  if (color === 'yellow') return 'bg-yellow-500';
  return 'bg-red-600';
}

export function statusLabel(status: StickerInspectionStatus): string {
  if (status === 'cumple') return 'Cumple';
  if (status === 'condicionado') return 'Condicionado';
  if (status === 'no_cumple') return 'No cumple';
  return 'No aplica';
}

export function evaluateStickerInspection(
  items: StickerInspectionItem[],
  findings: StickerFindingInput[],
): StickerInspectionDecision {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const conditionalItemIds: string[] = [];
  const findingItemIds: string[] = [];
  const hardStopItemIds: string[] = [];
  let hasBlockingFinding = false;

  for (const finding of findings) {
    if (finding.status !== 'condicionado' && finding.status !== 'no_cumple') continue;

    findingItemIds.push(finding.itemId);
    const item = itemById.get(finding.itemId);

    if (finding.status === 'condicionado') {
      conditionalItemIds.push(finding.itemId);
    }

    if (finding.status === 'no_cumple' || finding.canOperate === false || item?.hardStop === true) {
      hardStopItemIds.push(finding.itemId);
      hasBlockingFinding = true;
    }
  }

  const recommendedColor: StickerColor = hasBlockingFinding
    ? 'red'
    : conditionalItemIds.length > 0
      ? 'yellow'
      : 'green';

  const badges: string[] = [];
  if (recommendedColor === 'yellow') badges.push('Fecha compromiso');
  if (recommendedColor === 'red') badges.push('Despacho bloqueado');
  if (hardStopItemIds.length > 0) badges.push('Debe cumplir');
  if (conditionalItemIds.length > 0) badges.push('Hallazgos abiertos');

  return {
    recommendedColor,
    canDispatch: recommendedColor !== 'red',
    requiresSupervisorApproval: recommendedColor !== 'green' || hardStopItemIds.length > 0,
    hardStopItemIds,
    conditionalItemIds,
    findingItemIds,
    badges,
  };
}
