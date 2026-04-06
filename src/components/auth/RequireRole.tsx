import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';
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
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.role);

  if (!isAuthenticated || !role) {
    return <Navigate to="/login" replace />;
  }

  if (roles.length > 0 && !roles.includes(role)) {
    return <Navigate to={ROLE_HOME[role]} replace />;
  }

  return <>{children}</>;
}
