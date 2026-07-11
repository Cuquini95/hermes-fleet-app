import { afterEach, describe, expect, it, vi } from 'vitest';
import { cmmsSeverityFromHermesPriority, reportCmmsDamage } from './cmms-events';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CMMS damage bridge client', () => {
  it('maps Hermes Spanish priorities to CMMS severity', () => {
    expect(cmmsSeverityFromHermesPriority('CRITICA')).toBe('critical');
    expect(cmmsSeverityFromHermesPriority('ALTA')).toBe('high');
    expect(cmmsSeverityFromHermesPriority('MEDIA')).toBe('medium');
    expect(cmmsSeverityFromHermesPriority('BAJA')).toBe('low');
  });

  it('posts a damage handoff to the local server route', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, cmms: { authority: 'hermes' } }), { status: 200 }),
    );

    const result = await reportCmmsDamage({
      assetId: 'CA25',
      title: 'Hidraulica - CA25',
      severity: 'medium',
      description: 'Acumuladores',
      photoUrl: 'https://cdn.example.test/falla.jpg',
      relatedWorkOrderId: 'OT-1',
      externalEventId: 'hermes-falla-OT-1',
    });

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('/api/cmms/damage', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }));
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toMatchObject({
      asset_id: 'CA25',
      related_work_order_id: 'OT-1',
      external_event_id: 'hermes-falla-OT-1',
    });
  });
});
