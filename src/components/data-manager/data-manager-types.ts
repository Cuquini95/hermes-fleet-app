/** Shared types for the DataManager feature. */

export type ColumnAlign = 'left' | 'right' | 'center';

export interface ColumnDef {
  label: string;
  /** Source column index from the Google Sheet. */
  index: number;
  align?: ColumnAlign;
  /** Render value in monospace font (numbers / codes). */
  mono?: boolean;
  /** Format value as MXN currency. */
  currency?: boolean;
  badge?: 'severity' | 'status' | 'resultado';
  /** Hide on small screens. */
  hideOnMobile?: boolean;
  /** Pin as the sticky first column. */
  sticky?: boolean;
  minWidth?: string;
}

export interface Collection {
  id: string;
  /** Emoji icon shown in the tab bar. */
  icon: string;
  label: string;
  /** Google Sheet tab name. */
  tab: string;
  emptyMessage: string;
  columns: ColumnDef[];
}

export type EditingCell = { rowIndex: number; colIndex: number; value: string } | null;
export type SavingCell = { rowIndex: number; colIndex: number } | null;
export type FlashCell = { rowIndex: number; colIndex: number; type: 'success' | 'error' } | null;
