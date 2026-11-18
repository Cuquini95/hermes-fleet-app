import { lazy } from 'react';
import { useAuthStore } from '../stores/auth-store';

const ExecutiveDashboard = lazy(() => import('../components/dashboard/ExecutiveDashboard'));
const PanamaDashboard = lazy(() => import('../components/dashboard/PanamaDashboard'));

export default function DashboardPage() {
  const panama = useAuthStore(state => state.project === 'tmf-panama' && !state.previewDemo);
  const scope = useAuthStore(state => JSON.stringify([state.userId, state.role, state.allUnits, state.assignedUnits]));
  return panama ? <PanamaDashboard key={scope} /> : <ExecutiveDashboard />;
}
