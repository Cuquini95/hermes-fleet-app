import type { PMTrigger } from '../../types/workorder';

const labels = { hours: 'Horas', date: 'Fecha', condition: 'Condición' };
const status = { due: 'Vencido', ok: 'Al día', unknown: 'Sin dato confirmado', not_configured: 'Sin regla aprobada' };
const cutDate = new Intl.DateTimeFormat('es-PA', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Panama' });

export default function PmTriggerList({ rules }: { rules: PMTrigger[] }) {
  return <ul className="space-y-1.5 text-sm">
    {rules.map(rule => <li key={rule.kind} className="break-words">
      <span className={rule.state === 'due' ? 'font-semibold text-critical' : 'font-medium'}>
        {labels[rule.kind]} · {status[rule.state]}
      </span>
      {rule.threshold !== null && <span>
        {' · '}{rule.kind === 'hours'
          ? `${rule.actual ?? '—'} h registradas / ${rule.threshold} h programadas`
          : rule.kind === 'date'
            ? `${rule.actual} / vence ${rule.threshold}`
            : `${rule.actual ?? '—'} críticos / umbral ${rule.threshold}`}
      </span>}
      {rule.source && <span className="block text-xs text-text-secondary">
        {rule.source}{rule.reference && ` · ${rule.reference}`}
        {rule.cut && Number.isFinite(Date.parse(rule.cut)) && ` · Corte ${cutDate.format(new Date(rule.cut))} Panamá`}
      </span>}
    </li>)}
  </ul>;
}
