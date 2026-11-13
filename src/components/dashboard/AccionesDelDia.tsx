import { Link } from 'react-router-dom';
import { normalizeUnitId, type UnitDispatchReadiness } from '../../lib/dispatch-readiness';

export default function AccionesDelDia({ exceptions, readiness, verified }: {
  exceptions: string[];
  readiness: ReadonlyMap<string, UnitDispatchReadiness>;
  verified: boolean;
}) {
  return (
    <div className="bg-card rounded-xl shadow-sm p-4 border border-border">
      <h3 className="font-semibold text-text mb-3">Excepciones de despacho</h3>
      {!verified && <p className="text-sm text-text-secondary">Revisión pendiente de las fuentes de despacho.</p>}
      {verified && exceptions.length === 0 && <p className="text-sm text-text-secondary">Sin excepciones de despacho registradas.</p>}
      {exceptions.length > 0 && <ul className="space-y-1">
        {exceptions.map((unit) => <li key={unit} className="text-sm">
          <Link to={`/fleet?unit=${encodeURIComponent(unit)}`} className="font-semibold text-blue-800 underline">{unit}</Link>
          {' · '}{readiness.get(normalizeUnitId(unit))?.reason ?? 'Estado de flota no disponible para despacho'}
        </li>)}
      </ul>}
    </div>
  );
}
