import { useEffect } from 'react';

interface SuccessToastProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
}

function AnimatedCheck() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" className="shrink-0">
      <circle
        cx="12" cy="12" r="10"
        fill="none"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="2"
      />
      <circle
        cx="12" cy="12" r="10"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeDasharray="63"
        strokeDashoffset="63"
        style={{
          animation: 'check-circle-draw 0.4s ease-out 0.1s forwards',
        }}
      />
      <path
        d="M7 13l3 3 7-7"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="24"
        strokeDashoffset="24"
        style={{
          animation: 'check-draw 0.3s ease-out 0.5s forwards',
        }}
      />
    </svg>
  );
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
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(-16px) scale(0.95)',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {visible && <AnimatedCheck />}
      <span className="font-medium text-sm">{message}</span>
    </div>
  );
}
