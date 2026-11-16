import type { PanamaPmNextService } from '../../lib/panama-pm-next-service.js';

const unavailable = {
  source: 'El maestro estaba fuera de servicio al cerrar la OT.',
  plan: 'Falta un plan activo y aprobado para la unidad.',
  anchor: 'Falta un ancla de ciclo verificable en CALC.',
  rule: 'El nivel o los intervalos del plan aprobado requieren revisión.',
};

const hours = (value: number) => `${value.toLocaleString('es-PA', { maximumFractionDigits: 3 })} h`;
const cutDate = new Intl.DateTimeFormat('es-PA', { timeZone: 'America/Panama', dateStyle: 'short', timeStyle: 'short' });

function formatCut(cut?: string) {
  if (!cut || !Number.isFinite(Date.parse(cut))) return '';
  return ` · Corte ${cutDate.format(new Date(cut))}, hora de Panamá`;
}

export default function PanamaPmNextService({ service }: { service: PanamaPmNextService | null }) {
  if (!service || service.status === 'unavailable') {
    return <div className="space-y-1 text-sm">
      <p className="font-semibold text-amber-800">Próximo servicio sin verificar</p>
      <p className="text-text-secondary">{service ? unavailable[service.reason] : 'El historial de este cierre no registra la regla aplicada.'}</p>
    </div>;
  }
  return <div className="space-y-1 text-sm">
    <p className="font-semibold text-text">Próximo servicio · {service.level} a {hours(service.dueAt)}</p>
    <p className={service.status === 'verified' ? 'text-text-secondary' : 'text-amber-800'}>
      {service.status === 'verified' ? 'Coincide con PM FLOTA por nivel y horómetro al cierre.'
        : service.status === 'projected' ? 'Proyección del plan aprobado. Pendiente de conciliación con PM FLOTA.'
          : `Diferencia con PM FLOTA · ${service.official.level} a ${hours(service.official.dueAt)}.`}
    </p>
    <details className="text-text-secondary">
      <summary className="cursor-pointer">Regla del maestro</summary>
      <p>AJUSTES · Ciclo de {hours(service.cycle)} · Niveles {service.intervals.map(interval => `PM-${interval}`).join(', ')}{formatCut(service.planCut)}</p>
      <p>CALC · Ancla aplicada de {hours(service.anchor)}{formatCut(service.anchorCut)}</p>
      {service.status !== 'projected' && <p>PM FLOTA{formatCut(service.official.cut)}</p>}
    </details>
  </div>;
}
