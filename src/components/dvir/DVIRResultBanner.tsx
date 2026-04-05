import type { CheckStatus, DVIRResult } from '../../types/dvir';

interface CheckSummary {
  status: CheckStatus;
}

interface DVIRResultBannerProps {
  checks: CheckSummary[];
}

export default function DVIRResultBanner({ checks }: DVIRResultBannerProps) {
  const allChecked = checks.every((c) => c.status !== null);
  if (!allChecked) return null;

  const okCount = checks.filter((c) => c.status === 'ok').length;
  const alertaCount = checks.filter((c) => c.status === 'alerta').length;
  const fallaCount = checks.filter((c) => c.status === 'falla').length;

  let result: DVIRResult;
  if (fallaCount > 0) {
    result = 'reprobado';
  } else if (alertaCount > 0) {
    result = 'condicional';
  } else {
    result = 'aprobado';
  }

  if (result === 'aprobado') {
    return (
      <div className="bg-green-50 border-l-4 border-success rounded-lg p-4 mt-4">
        <p className="text-success font-semibold text-sm">
          APROBADO {okCount}/12 — Equipo habilitado para operar
        </p>
      </div>
    );
  }

  if (result === 'condicional') {
    return (
      <div className="bg-amber-50 border-l-4 border-warning rounded-lg p-4 mt-4">
        <p className="text-amber-800 font-semibold text-sm">
          CONDICIONAL — Supervisor será notificado
        </p>
      </div>
    );
  }

  return (
    <div className="bg-red-50 border-l-4 border-critical rounded-lg p-4 mt-4">
      <p className="text-critical font-semibold text-sm">
        REPROBADO — OT auto-generada. Equipo FUERA DE SERVICIO
      </p>
    </div>
  );
}
