import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';

/** A shortcut can prefill an existing choice. The inventory and server still govern access. */
export function usePanamaCaptureUnit(units: readonly { unit_id: string }[]) {
  const [params] = useSearchParams();
  const isPanama = useAuthStore(state => state.project === 'tmf-panama');
  const [chosen, setChosen] = useState<string>();
  const requested = isPanama ? params.get('unit')?.trim().toUpperCase() : undefined;
  const prefilled = requested ? units.find(({ unit_id }) => unit_id.toUpperCase() === requested)?.unit_id : undefined;
  return [chosen ?? prefilled ?? '', setChosen] as const;
}
