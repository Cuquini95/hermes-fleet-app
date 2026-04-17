import { useState, useEffect, useRef, useId } from 'react';

interface ConfirmModalProps {
  open: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  title: string;
  message: string;
  loading?: boolean;
}

export default function ConfirmModal({ open, onConfirm, onCancel, title, message, loading: externalLoading }: ConfirmModalProps) {
  const [internalSubmitting, setInternalSubmitting] = useState(false);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<Element | null>(null);
  const titleId = useId();
  const messageId = useId();

  // Store the previously focused element on open and focus the confirm button
  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement;
      confirmBtnRef.current?.focus();
    } else {
      // Return focus when modal closes
      if (previouslyFocused.current instanceof HTMLElement) {
        previouslyFocused.current.focus();
      }
    }
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const isDisabled = externalLoading || internalSubmitting;

  const handleConfirm = async () => {
    if (isDisabled) return;
    setInternalSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setInternalSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={messageId}
    >
      <div className="bg-white rounded-2xl p-6 mx-4 max-w-sm w-full">
        <h2 id={titleId} className="font-semibold text-lg text-text">{title}</h2>
        <p id={messageId} className="text-text-secondary mt-2">{message}</p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDisabled}
            className="flex-1 border border-border rounded-xl px-6 py-3 font-medium text-text disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={handleConfirm}
            disabled={isDisabled}
            className="flex-1 bg-amber text-white rounded-xl px-6 py-3 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isDisabled ? 'Enviando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
