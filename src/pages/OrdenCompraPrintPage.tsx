import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { displayMoney, isApprovalRecorded, purchaseOrder, type PurchaseOrder } from '../lib/purchasing-api';

function dateLabel(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('/') : value || '—';
}

export default function OrdenCompraPrintPage() {
  const { ocId = '' } = useParams();
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [failure, setFailure] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    purchaseOrder(ocId, controller.signal).then(({ order: record }) => setOrder(record)).catch((cause) => {
      if (!controller.signal.aborted) {
        setFailure(cause instanceof Error ? cause.message : 'No se pudo leer la orden.');
      }
    });
    return () => controller.abort();
  }, [ocId, attempt]);

  if (failure) {
    return (
      <div className="space-y-3 p-4">
        <Link className="text-sm font-semibold text-blue-800" to="/admin/ordenes-compra">Volver a órdenes</Link>
        <p className="rounded-lg bg-red-50 p-3 text-red-800" role="alert">{failure}</p>
        <button className="text-sm font-semibold text-blue-800" type="button" onClick={() => {
          setFailure('');
          setAttempt((previous) => previous + 1);
        }}>Reintentar</button>
      </div>
    );
  }

  if (!order || order.folio.toUpperCase() !== ocId.toUpperCase()) return <p className="p-4 text-sm text-slate-600">Cargando la orden…</p>;

  const issuer = order.issuer;
  const authorized = isApprovalRecorded(order);
  const ultratk = issuer?.template === 'ultratk';
  const accent = ultratk ? '#C91D17' : '#182133';
  const amount = (value: string) => issuer ? displayMoney(value, issuer.currency) : value || '—';
  const totals: [string, string][] = [
    ['Subtotal', order.subtotal],
    [issuer?.taxLabel || 'Impuesto', order.tax],
    ['Envío', order.shipping],
    ['Otros cargos', order.other],
    ['Total', order.total],
  ];
  const approvedAt = authorized ? new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Mexico_City',
  }).format(new Date(order.approvedAt)) : '';

  return (
    <>
      <style>{`
        .po-document { font-family: Arial, Helvetica, sans-serif; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        .po-document th, .po-document td { padding: 5px 6px; }
        @media print {
          @page { size: letter; margin: 12mm; }
          html, body { background: white !important; margin: 0 !important; overflow: visible !important; }
          body * { visibility: hidden; }
          .po-document, .po-document * { visibility: visible; }
          .po-toolbar { display: none !important; }
          .po-document {
            position: absolute; top: 0; left: 0; width: 100%; max-width: none !important;
            margin: 0 !important; padding: 0 !important; box-shadow: none !important;
          }
          .po-document .po-table { overflow: visible; }
          .po-document .po-table table { min-width: 0; }
          .po-document .po-heading { grid-template-columns: 1fr 1fr; }
          .po-document .po-section, .po-document tr { break-inside: avoid; }
          .po-document thead { display: table-header-group; }
        }
      `}</style>
      <div className="po-toolbar flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 py-3">
        <Link to="/admin/ordenes-compra" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700">
          <ArrowLeft size={16} aria-hidden /> Volver
        </Link>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
          <Printer size={16} aria-hidden /> Imprimir / Guardar como PDF
        </button>
      </div>

      <article className="po-document mx-auto my-4 max-w-[8.5in] bg-white p-4 text-xs text-slate-900 shadow sm:p-8">
        <header className="po-heading po-section grid gap-3 border-b-2 pb-3 sm:grid-cols-2" style={{ borderColor: accent }}>
          <div className="min-w-0">
            {ultratk && <p className="mb-2 inline-block rounded px-3 py-1 text-xl font-black tracking-tight text-white" style={{ backgroundColor: accent }}>ULTRATK</p>}
            {issuer?.template === 'transplus' && <img className="mb-2 h-10 w-auto max-w-[160px] object-contain" src="/logo-transplus.svg" alt="Trans Plus" />}
            <p className="font-bold">{issuer?.name || 'Entidad emisora por confirmar'}</p>
            {issuer?.address && <p>{issuer.address}</p>}
            {issuer?.taxId && <p>Registro fiscal {issuer.taxId}</p>}
            {issuer?.phone && <p>{issuer.phone}</p>}
          </div>
          <div className="min-w-0 sm:text-right">
            <h1 className="text-xl font-black uppercase tracking-tight sm:text-2xl" style={{ color: accent }}>Orden de compra</h1>
            <p className="mt-1 break-words font-mono text-sm font-bold">{order.folio}</p>
            <p className="mt-1 font-semibold">{order.status}</p>
          </div>
        </header>

        <section className="po-section grid grid-cols-2 gap-x-3 gap-y-2 border-b border-slate-300 py-3">
          <div className="col-span-2 min-w-0 sm:col-span-1">
            <h2 className="font-bold uppercase">Proveedor</h2>
            <p className="break-words">{order.vendorName}</p>
            {order.vendorRfc && <p>Registro fiscal {order.vendorRfc}</p>}
            <p className="break-words">{order.vendorAddress}</p>
          </div>
          <dl className="col-span-2 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 sm:col-span-1">
            <dt className="font-semibold">Unidad</dt><dd className="break-words">{order.unit || '—'}</dd>
            <dt className="font-semibold">Fecha de la orden</dt><dd>{dateLabel(order.date)}</dd>
            <dt className="font-semibold">Fecha de entrega</dt><dd>{dateLabel(order.deliveryDate)}</dd>
            {order.requestedBy && <><dt className="font-semibold">Registrada por</dt><dd>{order.requestedBy}</dd></>}
          </dl>
        </section>

        <div className="po-table mt-3 overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-[10px] sm:text-xs">
            <thead style={{ backgroundColor: accent, color: '#FFFFFF' }}>
              <tr>
                <th scope="col" className="w-[8%] text-left">N.º</th>
                <th scope="col" className="w-[40%] text-left">Descripción</th>
                <th scope="col" className="w-[12%] text-right">Cant.</th>
                <th scope="col" className="w-[20%] text-right">Precio unit.</th>
                <th scope="col" className="w-[20%] text-right">Importe</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line) => (
                <tr key={line.id} className="border-b border-slate-300 align-top">
                  <td>{line.number}</td>
                  <td className="break-words">
                    {line.description}
                    {line.partNumber && <p className="font-mono text-[10px]">{line.partNumber}</p>}
                    {line.requestId && <p className="break-words text-[10px]">Pedido {line.requestId}</p>}
                  </td>
                  <td className="break-words text-right tabular-nums">{line.quantity}</td>
                  <td className="break-words text-right tabular-nums">{amount(line.unitPrice)}</td>
                  <td className="break-words text-right tabular-nums">{amount(line.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="po-section mt-3 grid items-start gap-3 sm:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            {order.comments && <><h2 className="font-bold">Observaciones</h2><p className="whitespace-pre-wrap break-words">{order.comments}</p></>}
          </div>
          <dl className="min-w-0 sm:min-w-48">
            {totals.map(([label, value], index) => (
              <div key={label} className={`flex justify-between gap-3 px-2 py-1 ${index === totals.length - 1 ? 'font-bold text-white' : 'border-b border-slate-200'}`}
                style={index === totals.length - 1 ? { backgroundColor: accent } : undefined}>
                <dt>{label}</dt><dd className="text-right tabular-nums">{amount(value)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <footer className="po-section mt-5 border-t border-slate-300 pt-2">
          {authorized ? (
            <div data-testid="purchase-approval-provenance">
              <p className="font-bold">Autorización digital registrada</p>
              <p>{order.approvedBy} · {approvedAt} · {order.folio}</p>
            </div>
          ) : <p className="font-semibold">Aprobación digital pendiente de comprobar</p>}
        </footer>
      </article>
    </>
  );
}
