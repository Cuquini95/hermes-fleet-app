import { useEffect } from 'react';
import { CheckCircle } from 'lucide-react';

interface SuccessToastProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
}

export default function SuccessToast({ message, visible, onDismiss }: SuccessToastProps) {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 4000);
    return () => clearTimeout(timer);
  }, [visible, onDismiss]);

  return (
    <div
      className="fixed top-4 left-4 right-4 z-50 bg-success text-white rounded-xl p-4 shadow-lg flex items-center gap-3 transition-all duration-300"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-16px)',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <CheckCircle size={20} className="shrink-0" />
      <span className="font-medium text-sm">{message}</span>
    </div>
  );
}
