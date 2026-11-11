import { ChevronRight, Grid2X2, LogOut } from 'lucide-react';
import { Link, Navigate, Outlet, matchPath, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';
import { NAV_ICONS } from '../lib/nav-icons';
import { APPS, appUrl } from './catalog';
import { activeApp } from './active-app';
import { OfflineBanner } from '../components/ui/OfflineBanner';
import ConsentBanner from '../components/ui/ConsentBanner';

const rowClass = 'flex min-h-16 w-full items-center gap-3 rounded-xl border border-border bg-white p-3 text-left font-semibold text-text shadow-sm active:bg-blue-50';

function AppRow({ label, icon }: { label: string; icon: string }) {
  const Icon = NAV_ICONS[icon];
  return <>
    {Icon && <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-amber"><Icon size={22} aria-hidden="true" /></span>}
    <span className="min-w-0 flex-1 break-words">{label}</span>
    <ChevronRight size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
  </>;
}

export function AppDirectory() {
  const role = useAuthStore((state) => state.role);
  const apps = APPS.filter((app) => role && app.actions.some((action) => action.roles.includes(role)));
  return (
    <section className="mx-auto max-w-lg py-4">
      <h1 className="mb-4 text-2xl font-bold">Aplicaciones</h1>
      <div className="grid gap-3">
        {apps.map((app) => <a key={app.id} className={rowClass} href={`${appUrl(app)}/`}><AppRow {...app} /></a>)}
      </div>
    </section>
  );
}

export function AppStart() {
  const role = useAuthStore((state) => state.role);
  const actions = activeApp?.actions.filter((action) => role && action.roles.includes(role)) ?? [];
  return (
    <section className="grid gap-3 py-2">
      <h1 className="mb-1 text-2xl font-bold">{activeApp?.label}</h1>
      {actions.map((action, index) => (
        <Link key={action.path} className={index === 0 ? `${rowClass} border-blue-300` : rowClass} to={action.path}>
          <AppRow {...action} />
        </Link>
      ))}
      {actions.length === 0 && <p role="status">Tu rol no tiene acceso a esta aplicación.</p>}
    </section>
  );
}

export function FocusedAppShell() {
  const { pathname } = useLocation();
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  if (activeApp) {
    const paths = ['/', '/perfil', ...activeApp.actions.map((action) => action.path), ...(activeApp.related ?? [])];
    if (!paths.some((path) => matchPath({ path, end: true }, pathname))) return <Navigate to="/" replace />;
  }

  return (
    <div className="focused-app min-h-svh bg-cream">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:bg-white focus:p-3">Saltar al contenido</a>
      <header className="sticky top-0 z-40 bg-teal text-white">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-3 px-4">
          <Link to={activeApp ? "/" : "/apps"} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 font-semibold">
            <img src="/logo-transplus.svg" alt="" className="h-8 w-8 shrink-0 rounded" />
            <span className="min-w-0 break-words">Hermes</span>
          </Link>
          {activeApp && <a href="/apps" className="grid h-11 w-11 place-items-center rounded-lg hover:bg-white/10" aria-label="Aplicaciones" title="Aplicaciones"><Grid2X2 size={22} aria-hidden="true" /></a>}
          <button type="button" className="grid h-11 w-11 place-items-center rounded-lg hover:bg-white/10" aria-label="Cerrar sesión" onClick={() => void logout().finally(() => navigate('/login', { replace: true }))}><LogOut size={20} aria-hidden="true" /></button>
        </div>
      </header>
      <OfflineBanner />
      <main id="main-content" tabIndex={-1} className="mx-auto min-w-0 max-w-lg px-4 pb-16 pt-3">
        <Outlet />
      </main>
      <ConsentBanner />
    </div>
  );
}
