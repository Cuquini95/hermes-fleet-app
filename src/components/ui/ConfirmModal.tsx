interface ConfirmModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
}

export default function ConfirmModal({ open, onConfirm, onCancel, title, message }: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-6 mx-4 max-w-sm w-full">
        <h2 className="font-semibold text-lg text-text">{title}</h2>
        <p className="text-text-secondary mt-2">{message}</p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 border border-border rounded-xl px-6 py-3 font-medium text-text"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 bg-amber text-white rounded-xl px-6 py-3 font-medium"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
