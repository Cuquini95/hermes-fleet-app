import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MonthSelectorProps {
  /** Currently displayed year (e.g. 2026) */
  year: number;
  /** Currently displayed month (1-12) */
  month: number;
  /** Called when the user navigates to a different month */
  onChange: (year: number, month: number) => void;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/**
 * Month navigator: ◀ Abril 2026 ▶
 * Cannot navigate into the future (max = current month).
 */
export default function MonthSelector({ year, month, onChange }: MonthSelectorProps) {
  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth() + 1;
  const isAtCurrent = year === nowYear && month === nowMonth;

  function goPrev() {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear  = month === 1 ? year - 1 : year;
    onChange(prevYear, prevMonth);
  }

  function goNext() {
    if (isAtCurrent) return;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear  = month === 12 ? year + 1 : year;
    onChange(nextYear, nextMonth);
  }

  const label = `${MONTH_NAMES[month - 1]} ${year}`;

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={goPrev}
        className="p-1.5 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
        aria-label="Mes anterior"
      >
        <ChevronLeft size={18} className="text-text-secondary" />
      </button>
      <span className="text-sm font-medium text-text-secondary min-w-[110px] text-center capitalize">
        {label}
      </span>
      <button
        type="button"
        onClick={goNext}
        disabled={isAtCurrent}
        className="p-1.5 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
        aria-label="Mes siguiente"
      >
        <ChevronRight size={18} className="text-text-secondary" />
      </button>
    </div>
  );
}
