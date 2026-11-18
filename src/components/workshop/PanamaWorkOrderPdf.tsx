import { useEffect, useRef, useState } from 'react';
import type { WorkOrder } from '../../types/workorder';
import type { Equipment } from '../../types/equipment';
import { purchaseRead, type InventoryMovement } from '../../lib/purchasing-api';
import type { OrderCosts } from './PanamaWorkOrderCost';
import { useAuthStore } from '../../stores/auth-store';
import { orderHistoryTime, useWorkOrderStore } from '../../stores/workorder-store';

export default function PanamaWorkOrderPdf({ order, equipment }: { order: WorkOrder; equipment?: Equipment }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function download() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller; setBusy(true); setError('');
    const actor = useAuthStore.getState();
    try {
      await useWorkOrderStore.getState().fetchWorkOrders();
      const store = useWorkOrderStore.getState();
      const current = store.getWorkOrderById(order.ot_id);
      if (store.error || !current || current.unidad !== order.unidad) throw new Error('No se pudo verificar la OT antes de exportar.');
      const notes: string[] = [];
      let movements: InventoryMovement[] | undefined;
      if (['jefe_taller', 'coordinador', 'supervisor', 'gerencia'].includes(actor.role ?? '')) {
        try { movements = (await purchaseRead<{ items: InventoryMovement[] }>('inventory-movements', { ot: current.ot_id }, controller.signal)).items; }
        catch { notes.push('Movimientos de repuestos no disponibles; consulta el registro en la aplicación.'); }
      } else notes.push('Este perfil exporta los datos de su OT sin los movimientos de almacén.');
      let costs: OrderCosts | undefined;
      if (actor.role === 'gerencia') {
        try {
          const data = await purchaseRead<OrderCosts>('workorder-cost', { ot: current.ot_id }, controller.signal);
          if (data.ot !== current.ot_id || data.unit !== current.unidad || data.project !== 'tmf-panama') throw new Error('Costos de otra orden');
          costs = data;
        } catch { notes.push('Los costos no se pudieron verificar. No se presentan como cero.'); }
      } else notes.push('Costos disponibles para Gerencia según permisos.');
      if (controller.signal.aborted || useAuthStore.getState().userId !== actor.userId) return;
      const { makeWorkOrderPdf } = await import('../../lib/panama-workorder-pdf');
      if (!controller.signal.aborted) makeWorkOrderPdf({ order: current, equipment,
        history: store.statusLog.filter(event => event.ot_id === current.ot_id)
          .sort((a, b) => orderHistoryTime(b.timestamp) - orderHistoryTime(a.timestamp)), movements, costs, notes,
      }).save(`${(current.folio || current.ot_id).replace(/[^\w-]/g, '_')}-${current.unidad}.pdf`);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'No se pudo generar el PDF.');
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return <div className="min-w-0">
    <button type="button" onClick={() => void download()} disabled={busy} className="inline-flex min-h-11 items-center rounded-lg border border-border bg-white px-3 text-sm font-semibold disabled:opacity-50">
      {busy ? 'Preparando PDF…' : 'Descargar OT e historial'}
    </button>
    {error && <p role="alert" className="mt-1 text-sm text-red-700">{error}</p>}
  </div>;
}
