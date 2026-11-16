import { displayMoney, type PurchaseOrder } from '../../lib/purchasing-api';

interface Props {
  order: PurchaseOrder;
  authorized: boolean;
  approvedAt: string;
  approvalSignature?: string;
  dateLabel: (value: string) => string;
}

export default function PanamaPurchaseDocument({ order, authorized, approvedAt, approvalSignature, dateLabel }: Props) {
  const { issuer, lines } = order;
  const number = order.number || order.folio;
  const requisitions = [...new Set(lines.map(line => line.requestId).filter(Boolean))];
  const money = (value: string) => displayMoney(value, issuer?.currency ?? 'USD');

  return (
    <article className="po-document po-panama">
      <header className="po-section po-panama-header">
        <div className="po-panama-issuer">
          <strong>{issuer?.name}</strong>
          {issuer?.taxId && <p className="po-panama-tax-id">{issuer.taxId}</p>}
          {issuer?.address && <p>{issuer.address}</p>}
          {issuer?.phone && <p>Tel. {issuer.phone}</p>}
        </div>
        <div className="po-panama-brand">
          <img src="/logo-transplus.svg" width={75} height={73} alt="" />
          <span>TransPlus</span>
        </div>
        <div className="po-panama-id">
          <h1>Orden de compra <span>N.º {number}</span></h1>
          <dl>
            <dt>Fecha</dt><dd>{dateLabel(order.date)}</dd>
            <dt>Estado</dt><dd>{order.status}</dd>
            {order.requestedBy && <><dt>Solicitado por</dt><dd>{order.requestedBy}</dd></>}
            {requisitions.length > 0 && <><dt>Requisición</dt><dd>{requisitions.join(', ')}</dd></>}
          </dl>
        </div>
      </header>

      <div className="po-section po-panama-purchase-details">
        <section aria-label="Proveedor">
          <h2>{order.vendorName}</h2>
          {order.vendorRfc && <p>Registro fiscal {order.vendorRfc}</p>}
          {order.vendorAddress && <p>{order.vendorAddress}</p>}
        </section>
        <p><strong>Equipo</strong><span>{order.unit || '—'}</span></p>
      </div>

      <table className="po-panama-lines" aria-label="Partidas de la orden">
        <colgroup>
          <col className="po-panama-item-col" /><col /><col className="po-panama-part-col" />
          <col className="po-panama-qty-col" /><col className="po-panama-price-col" /><col className="po-panama-price-col" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Ítem</th>
            <th scope="col">Descripción</th>
            <th scope="col">N.º de parte</th>
            <th scope="col">Cantidad</th>
            <th scope="col">Precio unitario</th>
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map(line => (
            <tr key={line.id}>
              <td>{line.number}</td>
              <td>{line.description}</td>
              <td>{line.partNumber || '—'}</td>
              <td>{line.quantity}</td>
              <td>{money(line.unitPrice)}</td>
              <td>{money(line.total)}</td>
            </tr>
          ))}
          {Array.from({ length: Math.max(0, 7 - lines.length) }, (_, index) => (
            <tr key={index} className="po-panama-spacer" aria-hidden="true">
              <td /><td /><td /><td /><td /><td />
            </tr>
          ))}
        </tbody>
      </table>

      <div className="po-section po-panama-summary">
        <dl className="po-panama-terms">
          <div><dt>Fecha de entrega</dt><dd>{dateLabel(order.deliveryDate)}</dd></div>
          <div><dt>Explicación de la compra</dt><dd>{order.comments || '—'}</dd></div>
        </dl>
        <dl className="po-panama-totals">
          <div><dt>Subtotal</dt><dd>{money(order.subtotal)}</dd></div>
          <div><dt>Descuento</dt><dd>{money(order.discount || '0')}</dd></div>
          <div><dt>{issuer?.taxLabel || 'Impuesto'}</dt><dd>{money(order.tax)}</dd></div>
          {Number(order.shipping) > 0 && <div><dt>Envío</dt><dd>{money(order.shipping)}</dd></div>}
          {Number(order.other) > 0 && <div><dt>Otros cargos</dt><dd>{money(order.other)}</dd></div>}
          <div className="po-panama-total"><dt>Total</dt><dd>{money(order.total)}</dd></div>
        </dl>
      </div>

      <footer className="po-section po-panama-footer">
        <div className="po-panama-signature">
          {authorized && approvalSignature && <img src={`data:image/png;base64,${approvalSignature}`} alt={`Firma de ${order.approvedBy}`} />}
          <p>{authorized && !approvalSignature ? 'Firma pendiente' : 'Firma autorizada'}</p>
        </div>
        <div className="po-panama-approval" data-testid="purchase-approval-provenance">
          {authorized ? (
            <>
              <strong>Autorización digital registrada</strong>
              <p>{order.approvedBy}</p>
              <p>{approvedAt} · OC {number}</p>
            </>
          ) : <strong>Aprobación digital pendiente de comprobar</strong>}
        </div>
      </footer>
    </article>
  );
}
