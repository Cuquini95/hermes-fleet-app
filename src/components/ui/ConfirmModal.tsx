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
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);
  const titleId = useId();
  const messageId = useId();

  const isDisabled = externalLoading || internalSubmitting;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement;
    if (cancelBtnRef.current?.disabled) dialogRef.current?.focus();
    else cancelBtnRef.current?.focus();
    return () => {
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isDisabled && !submitting.current) {
        event.preventDefault();
        onCancel();
      } else if (event.key === 'Tab') {
        const buttons = [...(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
        const current = buttons.findIndex(button => button === document.activeElement);
        const next = event.shiftKey
          ? (current <= 0 ? buttons.length - 1 : current - 1)
          : (current + 1) % buttons.length;
        event.preventDefault();
        (buttons[next] ?? dialogRef.current)?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel, isDisabled]);

  if (!open) return null;

  const handleConfirm = async () => {
    if (isDisabled || submitting.current) return;
    submitting.current = true;
    setInternalSubmitting(true);
    try {
      await onConfirm();
    } finally {
      submitting.current = false;
      setInternalSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      ref={dialogRef}
      tabIndex={-1}
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
            ref={cancelBtnRef}
            onClick={onCancel}
            disabled={isDisabled}
            className="min-h-12 flex-1 border border-border rounded-xl px-4 py-3 font-medium text-text disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDisabled}
            className="min-h-12 flex-1 bg-[#9A5706] text-white rounded-xl px-4 py-3 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isDisabled ? 'Enviando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
