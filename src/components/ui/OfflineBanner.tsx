import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;
  return (
    <div className="fixed top-16 left-0 right-0 z-40 bg-gray-600 text-white text-center py-2 text-sm flex items-center justify-center gap-2">
      <WifiOff size={16} />
      Sin conexión — datos en cola
    </div>
  );
}
