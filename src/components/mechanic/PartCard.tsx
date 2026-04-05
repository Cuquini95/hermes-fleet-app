import { ShoppingCart, Check } from 'lucide-react';
import { useState } from 'react';
import type { PartResult } from '../../lib/hermes-api';
import { useCartStore } from '../../stores/cart-store';
import { useAuthStore } from '../../stores/auth-store';

interface PartCardProps {
  part: PartResult;
}

export default function PartCard({ part }: PartCardProps) {
  const role = useAuthStore((s) => s.role);
  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);
  const [added, setAdded] = useState(false);

  const canOrder = role === 'jefe_taller';
  const alreadyInCart = cartItems.some((i) => i.part_number === part.part_number && !i.isManual);

  const needsOrder =
    part.stock_quantity === 0 || part.stock_quantity <= part.stock_minimum;

  const stockStatus =
    part.stock_quantity === 0
      ? { label: 'Agotado', color: '#DC2626', bg: '#FEE2E2' }
      : part.stock_quantity <= part.stock_minimum
        ? { label: `Bajo: ${part.stock_quantity}`, color: '#D97706', bg: '#FEF3C7' }
        : { label: `En stock: ${part.stock_quantity}`, color: '#16A34A', bg: '#DCFCE7' };

  function handleAddToCart() {
    addItem({
      part_number: part.part_number,
      description: part.description,
      quantity: 1,
      unit_price: part.unit_price,
      equipment: part.compatible_units[0] ?? '',
      urgencia: part.stock_quantity === 0 ? 'Urgente' : 'Normal',
      notes: '',
      isManual: false,
      source: part.oem_ref ? `OEM ${part.oem_ref}` : 'Catálogo',
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-4 mb-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Row 1: part number + description */}
          <div className="flex items-baseline gap-2 flex-wrap mb-1">
            <span className="font-mono font-semibold text-amber text-sm">{part.part_number}</span>
            <span className="text-sm font-medium text-text">{part.description}</span>
          </div>

          {/* Row 2: OEM ref + location */}
          <div className="flex gap-3 text-xs text-text-secondary mb-1 flex-wrap">
            <span>OEM: {part.oem_ref}</span>
            <span>Ubicación: {part.location}</span>
          </div>

          {/* Row 3: alternatives */}
          {part.alternatives.length > 0 && (
            <p className="text-xs text-amber">
              Alternativas: {part.alternatives.join(', ')}
            </p>
          )}
        </div>

        {/* Right: stock badge + price */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
            style={{ color: stockStatus.color, backgroundColor: stockStatus.bg }}
          >
            {stockStatus.label}
          </span>
          <span className="text-sm font-bold text-text">${part.unit_price.toFixed(2)}</span>
        </div>
      </div>

      {/* Add to cart button — only for jefe_taller when stock is low/out */}
      {canOrder && needsOrder && (
        <div className="mt-3 pt-3 border-t border-border">
          <button
            onClick={handleAddToCart}
            disabled={alreadyInCart || added}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              backgroundColor: alreadyInCart || added ? '#DCFCE7' : '#162252',
              color: alreadyInCart || added ? '#16A34A' : '#FFFFFF',
            }}
          >
            {alreadyInCart || added ? (
              <>
                <Check size={15} />
                {alreadyInCart ? 'En el carrito' : 'Agregado ✓'}
              </>
            ) : (
              <>
                <ShoppingCart size={15} />
                Agregar al Pedido
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
