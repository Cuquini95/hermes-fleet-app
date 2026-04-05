import { mexicoDateCompact, mexicoTimeCompact } from './date-utils';

export function generateOTId(): string {
  const now = new Date();
  return `OT-${mexicoDateCompact(now)}-${mexicoTimeCompact(now)}`;
}
