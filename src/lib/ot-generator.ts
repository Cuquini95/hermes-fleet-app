import { mexicoDateCompact, mexicoTimeCompact } from './date-utils';

export function generateOTId(): string {
  const now = new Date();
  const suffix = crypto.randomUUID().slice(0, 4);
  return `OT-${mexicoDateCompact(now)}-${mexicoTimeCompact(now)}-${suffix}`;
}
