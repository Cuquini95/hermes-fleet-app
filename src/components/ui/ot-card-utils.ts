function parseWorkOrderDate(dateStr: string): Date | null {
  const text = (dateStr ?? '').trim();
  if (!text) return null;

  const localDate = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (localDate) {
    const [, d, m, y, hh = '0', mm = '0', ss = '0'] = localDate;
    let year = Number(y);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    return new Date(year, Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function timeSince(dateStr: string): string {
  const now = new Date();
  const then = parseWorkOrderDate(dateStr);
  if (!then) return 'Sin fecha';

  const diffMs = now.getTime() - then.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 0) return 'Fecha futura';
  if (diffHours < 1) return 'Hace menos de 1h';
  if (diffHours < 24) return `Hace ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Hace ${diffDays}d`;
}
