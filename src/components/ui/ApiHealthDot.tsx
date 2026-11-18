import { useEffect, useRef, useState } from 'react';
import { useApiHealth } from '../../hooks/useApiHealth';
import { useAuthStore } from '../../stores/auth-store';

const STATUS_COLOR: Record<string, string> = {
  ok: '#22C55E',
  degraded: '#F59E0B',
  down: '#EF4444',
  loading: '#94A3B8',
};

const CHECK_LABELS = { identity: 'Sesión', fleet: 'Maestro de flota', operations: 'Registro operativo',
  masters: 'Maestros de Taller', evidence: 'Adjuntos privados' };
const CHECK_ACTIONS: Record<keyof typeof CHECK_LABELS, string> = {
  identity: 'Vuelve a iniciar sesión.',
  fleet: 'Reintenta la consulta.',
  operations: 'Conserva el borrador y comprueba si el folio existe antes de reintentar.',
  masters: 'Usa el último corte visible con su fecha.',
  evidence: 'Conserva el archivo y vuelve a intentar adjuntarlo cuando el servicio regrese.',
};
const CHECK_STATUS = { ok: 'Disponible', degraded: 'Servicio parcial', down: 'Fuera de servicio' };

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
  const isPanama = useAuthStore((state) => state.project === 'tmf-panama');
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeOnEscape); };
  }, [open]);

  const color = STATUS_COLOR[health.status] ?? STATUS_COLOR.loading;
  const label = isPanama && health.status !== 'loading'
    ? (health.status === 'ok' ? 'Conectado' : CHECK_STATUS[health.status])
    : STATUS_LABEL[health.status] ?? 'Desconocido';

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        ref={trigger}
        onClick={() => setOpen((v) => !v)}
        aria-label={`${isPanama ? 'Estado del servicio' : 'Estado de la API'}: ${label}`}
        aria-expanded={open}
        aria-controls="service-status-panel"
        className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-white"
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
          id="service-status-panel"
          role="region"
          aria-label={isPanama ? 'Estado del servicio' : 'Estado API'}
          className={`${isPanama ? 'fixed inset-x-3 top-[72px] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80' : 'absolute right-0 top-full mt-2 w-56'} max-h-[calc(var(--app-viewport-height,100dvh)-100px)] overflow-y-auto rounded-xl p-4 shadow-xl z-50 max-w-[calc(100vw-1.5rem)] flex flex-col gap-2 text-xs`}
          style={{ backgroundColor: '#162252', border: '1px solid rgba(255,255,255,0.1)', overflowWrap: 'anywhere' }}
        >
          <div className="flex justify-between items-center">
            <span className="text-white font-semibold">{isPanama ? 'Estado del servicio' : 'Estado API'}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-white/70 hover:text-white text-sm leading-none focus-visible:ring-2 focus-visible:ring-white"
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
                <span className="text-white">{CHECK_STATUS[health.status]}</span>
              </div>

              {health.checks && (
                <dl className="space-y-1 border-t border-white/10 pt-2">
                  {Object.entries(health.checks).map(([check, state]) => (
                    <div key={check} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                      <dt className="text-white/80">{CHECK_LABELS[check as keyof typeof CHECK_LABELS] ?? check}</dt>
                      <dd className={`min-w-0 ${state === 'up' ? 'text-green-300' : 'text-amber-300'}`}>
                        {state === 'up' ? <>
                          Disponible
                          {check === 'fleet' && health.fleetCapturedAt && <time className="block text-white/60" dateTime={health.fleetCapturedAt}>
                            Corte del {new Date(health.fleetCapturedAt).toLocaleString('es-PA', { timeZone: 'America/Panama', dateStyle: 'short', timeStyle: 'short' })}
                          </time>}
                        </> : <>
                          <span>No disponible</span>
                          <span className="block mt-1">{CHECK_ACTIONS[check as keyof typeof CHECK_LABELS]}</span>
                        </>}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {health.status !== 'ok' && <button type="button" onClick={() => void health.refresh()}
                className="mt-2 min-h-11 rounded-md border border-white/30 px-2 py-1 text-white">
                {isPanama ? 'Reintentar' : 'Volver a comprobar'}
              </button>}

              {isPanama && health.deployment && <p className="text-white/80">
                {health.dataMode === 'demo' ? 'Datos de prueba' : 'Datos operativos'}
                {!health.writeEnabled && ' · Solo consulta'}
              </p>}
              {(health.db || health.integrations || health.deployment || health.uptime_seconds || health.version) && (
                <details open={isPanama ? undefined : true} className={isPanama ? 'border-t border-white/10 pt-2 text-white/80' : 'contents'}>
                  <summary className={isPanama ? 'cursor-pointer' : 'hidden'}>Detalles técnicos</summary>
                  <div className="space-y-2">
                    {health.db && (
                      <div className="border-t border-white/10 pt-2">
                        <p className="text-white/50 mb-1">Base de datos</p>
                        {Object.entries(health.db).map(([name, status]) => (
                          <div key={name} className="flex justify-between">
                            <span className="text-white/70 capitalize">{name}</span>
                            <span style={{ color: status === 'up' ? '#22C55E' : '#EF4444' }}>{status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {health.integrations && (
                      <div className="border-t border-white/10 pt-2">
                        <p className="text-white/50 mb-1">Integraciones</p>
                        {Object.entries(health.integrations).map(([name, status]) => (
                          <div key={name} className="flex justify-between">
                            <span className="text-white/70 capitalize">{name}</span>
                            <span style={{ color: status === 'up' ? '#22C55E' : '#EF4444' }}>{status}</span>
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
                        {!!health.operationGroups?.length && <div><dt>Flujos habilitados</dt><dd>{health.operationGroups.join(', ')}</dd></div>}
                      </dl>
                    )}
                    <UptimeStr seconds={health.uptime_seconds} />
                    {health.version && <span className="text-white/30">v{health.version}</span>}
                  </div>
                </details>
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
