import { useState } from 'react';

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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-6 mx-4 max-w-sm w-full">
        <h2 className="font-semibold text-lg text-text">{title}</h2>
        <p className="text-text-secondary mt-2">{message}</p>
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
