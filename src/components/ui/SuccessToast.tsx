import { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface SuccessToastProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  type?: ToastType;
  /** Optional retry action shown as a button inside the toast */
  onRetry?: () => void;
}

function AnimatedCheck() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" className="shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
      <circle
        cx="12" cy="12" r="10"
        fill="none" stroke="white" strokeWidth="2"
        strokeDasharray="63" strokeDashoffset="63"
        style={{ animation: 'check-circle-draw 0.4s ease-out 0.1s forwards' }}
      />
      <path
        d="M7 13l3 3 7-7" fill="none" stroke="white" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray="24" strokeDashoffset="24"
        style={{ animation: 'check-draw 0.3s ease-out 0.5s forwards' }}
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

function InfoIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" className="shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
      <line x1="12" y1="8" x2="12" y2="8" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="12" y1="12" x2="12" y2="16" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const BG: Record<ToastType, string> = {
  success: 'var(--color-success, #16A34A)',
  error: '#DC2626',
  info: '#2563EB',
};

const AUTO_DISMISS_MS = 5000;

export default function SuccessToast({
  message,
  visible,
  onDismiss,
  type = 'success',
  onRetry,
}: SuccessToastProps) {
  useEffect(() => {
    if (!visible || onRetry) return; // don't auto-dismiss if there's a retry action
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [visible, onDismiss, onRetry]);

  const bg = BG[type];

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
      {visible && (
        type === 'error' ? <ErrorIcon /> :
        type === 'info'  ? <InfoIcon />  :
                           <AnimatedCheck />
      )}
      <span className="font-medium text-sm flex-1">{message}</span>
      {onRetry && visible && (
        <button
          type="button"
          onClick={() => { onRetry(); onDismiss(); }}
          className="text-white/80 hover:text-white text-xs font-semibold underline shrink-0"
        >
          Reintentar
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Cerrar"
        className="text-white/70 hover:text-white text-base leading-none shrink-0 ml-1"
      >
        ✕
      </button>
    </div>
  );
}
