import { useRef, type PointerEvent } from 'react';

interface Props {
  onChange: (signature: string) => void;
}

export default function PurchaseSignaturePad({ onChange }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ pointer: number; x: number; y: number } | null>(null);

  function move(event: PointerEvent<HTMLCanvasElement>) {
    const element = event.currentTarget;
    const previous = last.current;
    if (previous?.pointer !== event.pointerId) return;
    const rect = element.getBoundingClientRect();
    const x = (event.clientX - rect.left) * element.width / rect.width;
    const y = (event.clientY - rect.top) * element.height / rect.height;
    const context = element.getContext('2d');
    if (context && Number.isFinite(previous.x)) {
      context.strokeStyle = '#111827';
      context.lineWidth = 2.5;
      context.lineCap = 'round';
      context.beginPath();
      context.moveTo(previous.x, previous.y);
      context.lineTo(x, y);
      context.stroke();
      onChange(element.toDataURL('image/png').split(',')[1] ?? '');
    }
    last.current = { pointer: event.pointerId, x, y };
  }

  function clear() {
    const element = canvas.current;
    if (element) element.getContext('2d')?.clearRect(0, 0, element.width, element.height);
    onChange('');
  }

  return (
    <fieldset className="min-w-0 space-y-1">
      <legend className="text-sm font-semibold">Firma para esta OC</legend>
      <canvas ref={canvas} width={360} height={116} aria-label="Área para dibujar la firma"
        className="block h-28 w-full max-w-sm touch-none rounded-lg border border-slate-400 bg-white"
        onPointerDown={(event) => {
          if (last.current || event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          last.current = { pointer: event.pointerId, x: NaN, y: NaN };
          move(event);
        }}
        onPointerMove={move}
        onLostPointerCapture={(event) => {
          if (last.current?.pointer === event.pointerId) last.current = null;
        }}
      />
      <button type="button" className="px-2 py-1 text-sm font-semibold text-slate-700" onClick={clear}>Borrar firma</button>
    </fieldset>
  );
}
