export default function BriefingCard() {
  return (
    <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
      {/* Header */}
      <div className="p-4" style={{ backgroundColor: '#162252' }}>
        <p className="font-bold text-white text-sm tracking-wide">BRIEFING FLOTA GTP</p>
        <p className="text-white text-xs mt-0.5 opacity-80">4 Abril 2026 · 06:00 hrs</p>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* Disponibilidad */}
        <div>
          <p className="font-semibold text-text text-sm">
            DISPONIBILIDAD: 88% (27/30 equipos)
          </p>
          <p className="text-text-secondary text-sm mt-0.5">
            EN TALLER: EPAK-09 (fuga motor), EPEX-27 (eléctrico)
          </p>
        </div>

        {/* Alertas PM */}
        <div>
          <p className="font-semibold text-text text-sm">ALERTAS PM:</p>
          <p className="text-sm mt-1" style={{ color: '#DC2626' }}>
            ⚠️ EPTK-08 — PM-3 VENCIDO (38 hrs sobre límite)
          </p>
          <p className="text-sm mt-0.5" style={{ color: '#F59E0B' }}>
            ⚠️ EPAK-06 — PM-2 en 23 hrs
          </p>
        </div>

        {/* Combustible */}
        <div>
          <p className="font-semibold text-text text-sm">COMBUSTIBLE (semana):</p>
          <p className="text-sm mt-1" style={{ color: '#F59E0B' }}>
            EPAK-09: 1.15 L/hr ⚠️ (+18% sobre benchmark)
          </p>
          <p className="text-sm mt-0.5" style={{ color: '#16A34A' }}>
            D155AX-6 promedio: 0.97 L/hr ✅
          </p>
        </div>

        {/* DVIR Compliance */}
        <div>
          <p className="font-semibold text-text text-sm">
            DVIR COMPLIANCE: 87% (13/15 operadores)
          </p>
          <p className="text-sm mt-0.5" style={{ color: '#F59E0B' }}>
            ⚠️ Faltaron: Carlos M., Juan A.
          </p>
        </div>

        {/* Partes Críticas */}
        <div>
          <p className="font-semibold text-text text-sm">PARTES CRÍTICAS:</p>
          <p className="text-sm mt-1" style={{ color: '#DC2626' }}>
            🔴 600-319-3750 — AGOTADO (HM400-3 filter)
          </p>
          <p className="text-sm mt-0.5" style={{ color: '#F59E0B' }}>
            🟡 P559000 — BAJO STOCK (1 ud, mín 2)
          </p>
        </div>
      </div>
    </div>
  );
}
