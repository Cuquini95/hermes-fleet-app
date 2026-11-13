import { useState } from 'react';
import { useApiHealth } from '../../hooks/useApiHealth';

const STATUS_COLOR: Record<string, string> = {
  ok: '#22C55E',
  degraded: '#F59E0B',
  down: '#EF4444',
  loading: '#94A3B8',
};

const CHECK_LABELS = { identity: 'Sesión', fleet: 'Maestro de flota', operations: 'Libro operativo' };

const STATUS_LABEL: Record<string, string> = {
  ok: 'API OK',
  degraded: 'API degradada',
  down: 'API inaccesible',
  loading: 'Verificando…',
};

function UptimeStr({ seconds }: { seconds?: number }) {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return <span className="text-xs text-white/50">Uptime {h}h {m}m</span>;
}

export default function ApiHealthDot() {
  const health = useApiHealth();
  const [open, setOpen] = useState(false);

  const color = STATUS_COLOR[health.status] ?? STATUS_COLOR.loading;
  const label = STATUS_LABEL[health.status] ?? 'Desconocido';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Estado de la API: ${label}`}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
      >
        <span
          className="rounded-full shrink-0"
          style={{
            width: 8,
            height: 8,
            backgroundColor: color,
            boxShadow: health.status === 'ok' ? `0 0 0 2px ${color}33` : 'none',
          }}
        />
        <span className="text-white/70 text-xs hidden sm:inline">{label}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 rounded-xl p-4 shadow-xl z-50 w-56 max-w-[calc(100vw-2rem)] flex flex-col gap-2 text-xs"
          style={{ backgroundColor: '#162252', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <div className="flex justify-between items-center">
            <span className="text-white font-semibold">Estado API</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-white/50 hover:text-white text-sm leading-none"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>

          {health.status !== 'loading' && (
            <>
              <div className="flex items-center gap-2">
                <span
                  className="rounded-full"
                  style={{ width: 8, height: 8, backgroundColor: color }}
                />
                <span className="text-white capitalize">{health.status}</span>
              </div>

              {health.checks && (
                <dl className="space-y-1 border-t border-white/10 pt-2">
                  {Object.entries(health.checks).map(([check, state]) => (
                    <div key={check} className="flex justify-between gap-3">
                      <dt className="text-white/80">{CHECK_LABELS[check as keyof typeof CHECK_LABELS] ?? check}</dt>
                      <dd className={state === 'up' ? 'text-green-300' : 'text-amber-300'}>
                        {state === 'up' ? 'Disponible' : 'No disponible'}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}

              {health.db && (
                <div className="border-t border-white/10 pt-2">
                  <p className="text-white/50 mb-1">Base de datos</p>
                  {Object.entries(health.db).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-white/70 capitalize">{k}</span>
                      <span style={{ color: v === 'up' ? '#22C55E' : '#EF4444' }}>{v}</span>
                    </div>
                  ))}
                </div>
              )}

              {health.integrations && (
                <div className="border-t border-white/10 pt-2">
                  <p className="text-white/50 mb-1">Integraciones</p>
                  {Object.entries(health.integrations).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-white/70 capitalize">{k}</span>
                      <span style={{ color: v === 'up' ? '#22C55E' : '#EF4444' }}>{v}</span>
                    </div>
                  ))}
                </div>
              )}

              {health.deployment && (
                <dl className="space-y-1 break-all border-t border-white/10 pt-2 text-white/80">
                  <div><dt>Proyecto y ambiente</dt><dd>{health.deployment.project} · {health.deployment.environment}</dd></div>
                  {health.deployment.host && <div><dt>Despliegue</dt><dd>{health.deployment.host}</dd></div>}
                  {health.deployment.id && <div><dt>ID de Vercel</dt><dd>{health.deployment.id}</dd></div>}
                  {health.deployment.commit && <div><dt>Commit</dt><dd>{health.deployment.commit}</dd></div>}
                  <div><dt>Datos</dt><dd>{health.dataMode === 'demo' ? 'Prueba' : 'Operativos'} · {health.writeEnabled ? 'Escritura habilitada' : 'Consulta'}</dd></div>
                </dl>
              )}
              <UptimeStr seconds={health.uptime_seconds} />
              {health.version && (
                <span className="text-white/30">v{health.version}</span>
              )}
              {health.lastChecked && (
                <span className="text-white/30">
                  Verificado {health.lastChecked.toLocaleTimeString('es-PA', { timeZone: 'America/Panama' })}
                </span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
