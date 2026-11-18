import { Link } from 'react-router-dom';
import { panamaWorkbookLink } from '../../lib/panama-maintenance';
import { canOpenPanamaPayables } from '../../lib/purchasing-home';
import { useAuthStore } from '../../stores/auth-store';

const valuation = panamaWorkbookLink(import.meta.env.VITE_HERMES_PA_VALUATION_LINK);
const collections = panamaWorkbookLink(import.meta.env.VITE_HERMES_PA_FINANCE_LINK);
const shortcut = 'inline-flex min-h-11 items-center rounded-lg border border-slate-200 px-3 text-sm font-semibold text-[#162252] hover:bg-slate-50';

export default function PanamaFinanceHandoff() {
  const canOpenPayables = useAuthStore(canOpenPanamaPayables);
  return <nav aria-label="Finanzas" className="flex flex-wrap gap-2">
    <Link to="/panama/turnos" className={shortcut}>Partes aceptados</Link>
    {valuation && <a href={valuation} className={shortcut} target="_blank" rel="noreferrer">Valorización</a>}
    {collections && <a href={collections} className={shortcut} target="_blank" rel="noreferrer">Cobros y cierre</a>}
    {canOpenPayables && <Link to="/panama/cuentas-por-pagar" className={shortcut}>Cuentas por pagar</Link>}
  </nav>;
}
