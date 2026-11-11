import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';
import { activeApp } from '../../apps/active-app';
import { ROLE_HOME } from '../../types/roles';
import type { AppRole } from '../../types/roles';

interface RequireRoleProps {
  /** Roles allowed to view this route. Empty array = any authenticated user. */
  roles: AppRole[];
  children: React.ReactNode;
}

/**
 * Route guard. Redirect to /login if not authenticated.
 * Redirect to role home if authenticated but not in the allowed roles list.
 */
export default function RequireRole({ roles, children }: RequireRoleProps) {
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.role);
  const sessionChecked = useAuthStore((s) => s.sessionChecked);

  if (!sessionChecked) {
    return <div role="status" aria-live="polite" className="flex min-h-screen items-center justify-center text-sm text-slate-500">Validando sesión…</div>;
  }

  if (!isAuthenticated || !role) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }

  if (roles.length > 0 && !roles.includes(role)) {
    return <Navigate to={activeApp ? '/' : ROLE_HOME[role]} replace />;
  }

  return <>{children}</>;
}
