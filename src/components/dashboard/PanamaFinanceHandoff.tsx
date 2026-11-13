import { Link } from 'react-router-dom';
import { panamaWorkbookLink } from '../../lib/panama-maintenance';

const TMF = panamaWorkbookLink(import.meta.env.VITE_HERMES_PA_VALUATION_LINK);
const RENTABILIDAD = panamaWorkbookLink(import.meta.env.VITE_HERMES_PA_FINANCE_LINK);

function Source({ href, children }: { href?: string; children: string }) {
  return href
    ? <a href={href} target="_blank" rel="noreferrer" className="font-semibold text-blue-800 underline">{children}</a>
    : <strong>{children}</strong>;
}

export default function PanamaFinanceHandoff() {
  return (
    <section className="rounded-xl border border-border bg-card p-4" aria-labelledby="tmf-finance">
      <h2 id="tmf-finance" className="font-semibold text-text">Valorización, cobro y cierre de TMF</h2>
      <p className="mt-1 text-sm text-text-secondary">Usa el corte, la unidad y el folio de origen para conciliar cada etapa. La confirmación se registra en el maestro correspondiente.</p>
      <Link to="/panama/turnos" className="mt-3 inline-block text-sm font-semibold text-blue-800 underline">Descargar un parte aceptado</Link>
      <ol className="mt-3 space-y-2 text-sm text-text">
        <li><strong>Operaciones</strong> · Concilia parte aceptado, unidad y horas del corte en <Source href={TMF}>Disponibilidad TMF · VALORIZACION</Source>.</li>
        <li><strong>Facturación</strong> · Vincula corte, cliente, referencia y fecha de la factura en <Source href={RENTABILIDAD}>Rentabilidad por Unidad · DOCUMENTOS COBRO</Source>.</li>
        <li><strong>Tesorería y Contabilidad</strong> · Concilia el comprobante, la fecha efectiva, la moneda y el saldo en <Source href={RENTABILIDAD}>MOVIMIENTOS y CIERRE</Source>.</li>
      </ol>
    </section>
  );
}
