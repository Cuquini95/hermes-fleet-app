export const SBM_CONSTRUCTORA = 'SBM Constructora';

const SBM_ALIASES = new Set([
  'la salada',
  'la sabida',
  'la balada',
  'sin cliente',
  'la saludo',
  'lla sallada',
  'la saladaily',
  'la saladala',
]);

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ');
}

export function normalizeCustomerName(value: string): string {
  if (!value.trim()) return value;
  return SBM_ALIASES.has(normalizeKey(value)) ? SBM_CONSTRUCTORA : value;
}
