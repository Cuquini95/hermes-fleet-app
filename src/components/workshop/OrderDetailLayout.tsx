import type { ReactNode } from 'react';
import { ArrowLeft, Wrench } from 'lucide-react';
import { ESTADO_CONFIG, PRIORITY_CONFIG } from '../../types/workorder';
import { orderListPriority, orderListStatus } from '../../lib/panama-order-list';

export function OrderDetailLayout({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-4 pb-6 animate-fade-up">{children}</div>;
}

function priorityStyle(priority?: string) {
  const value = orderListPriority(priority) as keyof typeof PRIORITY_CONFIG | undefined;
  return value ? PRIORITY_CONFIG[value] : { color: '#6B7280', bg: '#F3F4F6', label: priority || 'Por priorizar' };
}

export function OrderDetailHeader({ folio, date, closedDate, priority, onBack }: {
  folio?: string; date?: string; closedDate?: string; priority?: string; onBack: () => void;
}) {
  const style = priorityStyle(priority);
  return <div role="group" aria-label="Encabezado de orden" className="flex flex-wrap items-center gap-3">
    <button type="button" aria-label="Volver" onClick={onBack} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-white p-2 shadow-sm">
      <ArrowLeft size={20} className="text-text" />
    </button>
    <div className="min-w-0 flex-1"><h1 className="break-words text-lg font-bold text-text">{folio || 'Orden de trabajo'}</h1>
      <p className="text-xs text-text-secondary">{date || 'Fecha por confirmar'}</p>
      {closedDate && <p className="text-xs text-text-secondary">Cierre {closedDate}</p>}
    </div>
    <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ color: style.color, backgroundColor: style.bg }}>{style.label}</span>
  </div>;
}

export function OrderDetailStatus({ children }: { children: ReactNode }) {
  return <section aria-label="Estado de la orden" className="rounded-xl border border-border bg-white p-3 shadow-sm">{children}</section>;
}

export function OrderDetailStatusBadge({ status }: { status: string }) {
  const normalized = orderListStatus(status);
  const style = normalized === 'Por verificar' ? { color: '#6B7280' } : ESTADO_CONFIG[normalized];
  return <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium text-white" style={{ backgroundColor: style.color }}>{status || 'Por verificar'}</span>;
}

export interface OrderDetailInformationData {
  unit: string; model?: string; type?: string; serial?: string; priority?: string; mechanic?: string;
  progress?: number | null; description: string;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0 break-words"><p className="text-xs text-text-secondary">{label}</p><div className="text-sm font-semibold text-text">{children}</div></div>;
}
export function OrderDetailInformation({ data, showSerial = true, descriptionExtra, children }: {
  data: OrderDetailInformationData; showSerial?: boolean; descriptionExtra?: ReactNode; children?: ReactNode;
}) {
  const priority = priorityStyle(data.priority);
  return <section aria-label="Datos de la orden" className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
    <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,max(9rem,45%)),1fr))] gap-3">
      <Field label="Unidad">{data.unit}</Field><Field label="Modelo">{data.model || 'Por verificar'}</Field>
      <Field label="Tipo">{data.type || 'Sin dato'}</Field>{showSerial && <Field label="Serie / PIN">{data.serial || 'Por verificar'}</Field>}
      <Field label="Prioridad"><span style={{ color: priority.color }}>{priority.label}</span></Field>
      <Field label="Mecánico"><span className="flex items-center gap-1"><Wrench size={12} className="shrink-0 text-text-secondary" />{data.mechanic || 'Sin dato'}</span></Field>
      <Field label="Progreso">{typeof data.progress === 'number' && Number.isFinite(data.progress) ? `${data.progress}%` : 'Sin registro'}</Field>
    </div>
    <div><p className="mb-1 text-xs text-text-secondary">Descripción</p><p className="break-words text-sm text-text">{data.description || 'Sin descripción'}</p>{descriptionExtra}</div>
    {children}
  </section>;
}
