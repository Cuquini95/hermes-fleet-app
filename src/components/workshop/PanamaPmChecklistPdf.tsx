import { useEffect, useRef, useState } from 'react';
import type { PrintablePmChecklist } from '../../lib/panama-pm-checklist-pdf';

interface Props {
  unit: string;
  level: string;
  orderId?: string;
}

export default function PanamaPmChecklistPdf(props: Props) {
  return <Download key={`${props.unit}/${props.level}/${props.orderId ?? ''}`} {...props} />;
}

function Download({ unit, level, orderId }: Props) {
  const running = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => () => running.current?.abort(), []);

  async function download() {
    if (running.current) return;
    const controller = new AbortController();
    running.current = controller;
    setBusy(true);
    setError('');
    try {
      const path = orderId
        ? `workshop/pmchecklist?${new URLSearchParams({ otId: orderId, format: 'print' })}`
        : `panama/pm-checklist?${new URLSearchParams({ unit, level })}`;
      const response = await fetch(`/hermes-api/api/${path}`, {
        cache: 'no-store', credentials: 'same-origin', signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'No se pudo consultar el checklist.');
      const document = data as PrintablePmChecklist;
      if (document.unit !== unit.trim().toUpperCase() || document.hours !== Number(level.replace(/^PM[- ]?/i, '').replace(',', ''))
        || !document.sections?.length) throw new Error('El checklist disponible no coincide con el equipo y el intervalo.');
      const { makePmChecklistPdf } = await import('../../lib/panama-pm-checklist-pdf');
      if (!controller.signal.aborted) makePmChecklistPdf(document).save(`${document.unit}-PM-${document.hours}h.pdf`);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'No se pudo generar el PDF.');
    } finally {
      running.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return <div className="min-w-0">
    <button type="button" onClick={() => void download()} disabled={busy} className="inline-flex min-h-11 items-center font-semibold underline disabled:opacity-60">
      {busy ? 'Preparando PDF…' : 'Checklist PDF'}
    </button>
    {error && <p role="alert" className="break-words text-sm font-normal text-red-700">{error}</p>}
  </div>;
}
