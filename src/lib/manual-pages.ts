import type { FaultCodePagesResult } from './hermes-api';
import { hermesApiUrl } from './hermes-api-base';

function manualPageNumbers(start: number, end: number): number[] {
  if (end <= start) return [start];
  return [start, end];
}

export function formatFaultCodeManualPages(
  pages: FaultCodePagesResult,
  code: string,
): string {
  if (!pages.found || !pages.pdf || pages.page_start === undefined || pages.page_end === undefined) {
    const detail = pages.message ? `\n${pages.message}` : '';
    return `\n\n**Manual de Taller - Codigo ${code}**\nNo encontre paginas del manual para este codigo.${detail}`;
  }

  const imageMarkdown = manualPageNumbers(pages.page_start, pages.page_end)
    .map((page) => `![Manual p.${page}](${hermesApiUrl(`/diagrams/workshop-page/${pages.pdf}/${page}`)})`)
    .join('\n\n');

  return `\n\n**Manual de Taller - Codigo ${code}**\nPaginas ${pages.page_start}-${pages.page_end}:\n\n${imageMarkdown}`;
}

export function formatFaultCodeManualPagesUnavailable(code: string): string {
  return `\n\n**Manual de Taller - Codigo ${code}**\nNo pude cargar las paginas del troubleshooting en este momento. La respuesta anterior queda como guia, pero valida en el manual antes de cambiar partes.`;
}
