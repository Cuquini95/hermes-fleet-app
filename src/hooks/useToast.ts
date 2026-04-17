/**
 * Global toast hook.
 * Usage:
 *   const { showToast } = useToast();
 *   showToast('Guardado correctamente', 'success');
 *   showToast('Error al guardar', 'error');
 */
import { useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastState {
  message: string;
  visible: boolean;
  type: ToastType;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState>({
    message: '',
    visible: false,
    type: 'success',
  });

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    setToast({ message, visible: true, type });
  }, []);

  const dismissToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  return { toast, showToast, dismissToast };
}
