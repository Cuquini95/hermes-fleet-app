import { useEffect, useState } from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { getPendingCount } from '../../lib/offline-queue';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    function refresh() {
      getPendingCount()
        .then((n) => { if (!cancelled) setPendingCount(n); })
        .catch(() => {});
    }

    refresh();
    const id = setInterval(refresh, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isOnline]);

  if (isOnline) return null;

  return (
    <div className="fixed top-16 left-0 right-0 z-40 bg-gray-600 text-white text-center py-2 text-sm flex items-center justify-center gap-2">
      <WifiOff size={16} />
      <span>
        Sin conexión
        {pendingCount > 0 && (
          <>
            {' — '}
            <span className="font-semibold">
              {pendingCount} {pendingCount === 1 ? 'registro pendiente' : 'registros pendientes'}
            </span>
          </>
        )}
      </span>
    </div>
  );
}
