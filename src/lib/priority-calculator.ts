import type { OTPriority } from '../types/workorder';

interface FallaFields {
  puede_moverse: boolean;
  cliente_afectado: string;
  tipo_falla: string;
}

const CLIENT_BLOCKLIST = ['', 'n/a', 'ninguno', '--', 'na', 'none'];

function isRealClient(value: string): boolean {
  return !CLIENT_BLOCKLIST.includes(value.trim().toLowerCase());
}

export function calculatePriority(fields: FallaFields): OTPriority {
  if (!fields.puede_moverse && isRealClient(fields.cliente_afectado)) return 'CRITICA';
  if (!fields.puede_moverse) return 'ALTA';
  if (fields.tipo_falla && fields.tipo_falla !== '') return 'MEDIA';
  return 'BAJA';
}
