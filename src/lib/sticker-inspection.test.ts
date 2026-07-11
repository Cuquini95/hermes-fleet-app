import { describe, expect, it } from 'vitest';
import { evaluateStickerInspection } from './sticker-inspection';
import type { StickerInspectionItem } from '../types/sticker-inspection';

const items: StickerInspectionItem[] = [
  { id: 'frenos', section: 'Frenos', label: 'Prueba de frenos', hardStop: true },
  { id: 'asiento', section: 'Cabina', label: 'Asiento', defaultDueDays: 15 },
  { id: 'luces', section: 'Electrico', label: 'Luces', defaultDueDays: 1 },
];

describe('evaluateStickerInspection', () => {
  it('approves a machine when every finding complies or does not apply', () => {
    const result = evaluateStickerInspection(items, [
      { itemId: 'frenos', status: 'cumple', canOperate: true },
      { itemId: 'asiento', status: 'no_aplica', canOperate: true },
      { itemId: 'luces', status: 'cumple', canOperate: true },
    ]);

    expect(result.recommendedColor).toBe('green');
    expect(result.canDispatch).toBe(true);
    expect(result.requiresSupervisorApproval).toBe(false);
  });

  it('recommends yellow when only conditional findings remain operable', () => {
    const result = evaluateStickerInspection(items, [
      { itemId: 'frenos', status: 'cumple', canOperate: true },
      { itemId: 'asiento', status: 'condicionado', canOperate: true, dueDate: '2026-07-22' },
      { itemId: 'luces', status: 'cumple', canOperate: true },
    ]);

    expect(result.recommendedColor).toBe('yellow');
    expect(result.canDispatch).toBe(true);
    expect(result.requiresSupervisorApproval).toBe(true);
    expect(result.conditionalItemIds).toEqual(['asiento']);
  });

  it('recommends red when a hard-stop item is conditional or any item cannot operate', () => {
    const hardStopResult = evaluateStickerInspection(items, [
      { itemId: 'frenos', status: 'condicionado', canOperate: true, dueDate: '2026-07-08' },
    ]);
    const blockedResult = evaluateStickerInspection(items, [
      { itemId: 'luces', status: 'condicionado', canOperate: false, dueDate: '2026-07-08' },
    ]);

    expect(hardStopResult.recommendedColor).toBe('red');
    expect(hardStopResult.canDispatch).toBe(false);
    expect(blockedResult.recommendedColor).toBe('red');
    expect(blockedResult.hardStopItemIds).toEqual(['luces']);
  });
});
