import type { PanamaPmNextService } from '../../lib/panama-pm-next-service.js';

const unavailable = {
  source: 'El maestro no respondió al cierre.',
  plan: 'Sin plan aprobado.',
  anchor: 'Falta la lectura base en CALC.',
  rule: 'Revisar nivel e intervalos del plan.',
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
      <p className="text-text-secondary">{service ? unavailable[service.reason] : 'El cierre no tiene una regla registrada.'}</p>
    </div>;
  }
  return <div className="space-y-1 text-sm">
    <p className="font-semibold text-text">Próximo servicio · {service.level} a {hours(service.dueAt)}</p>
    {service.status !== 'verified' && <p className="text-amber-800">
      {service.status === 'projected' ? 'Proyectado. Falta confirmar con PM FLOTA.'
        : `PM FLOTA indica ${service.official.level} a ${hours(service.official.dueAt)}.`}
    </p>}
    <details className="text-text-secondary">
      <summary className="cursor-pointer">Regla del maestro</summary>
      <p>AJUSTES · Ciclo de {hours(service.cycle)} · Niveles {service.intervals.map(interval => `PM-${interval}`).join(', ')}{formatCut(service.planCut)}</p>
      <p>CALC · Ancla aplicada de {hours(service.anchor)}{formatCut(service.anchorCut)}</p>
      {service.status !== 'projected' && <p>PM FLOTA{formatCut(service.official.cut)}</p>}
    </details>
  </div>;
}
