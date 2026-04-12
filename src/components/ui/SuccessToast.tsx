import { useEffect } from 'react';

interface SuccessToastProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  type?: 'success' | 'error';
}

function AnimatedCheck() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" className="shrink-0" aria-hidden="true">
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

function ErrorIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" className="shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
      <line x1="8" y1="8" x2="16" y2="16" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <line x1="16" y1="8" x2="8" y2="16" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function SuccessToast({ message, visible, onDismiss, type = 'success' }: SuccessToastProps) {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 4000);
    return () => clearTimeout(timer);
  }, [visible, onDismiss]);

  const bg = type === 'error' ? '#DC2626' : 'var(--color-success, #16A34A)';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="fixed top-4 left-4 right-4 z-50 text-white rounded-xl p-4 shadow-lg flex items-center gap-3 transition-all duration-300"
      style={{
        backgroundColor: bg,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(-16px) scale(0.95)',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {visible && (type === 'error' ? <ErrorIcon /> : <AnimatedCheck />)}
      <span className="font-medium text-sm">{message}</span>
    </div>
  );
}
