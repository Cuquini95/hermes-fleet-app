import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  cartId: string;
  part_number: string;
  description: string;
  quantity: number;
  unit_price: number;
  equipment: string;         // machine the part is for
  urgencia: 'Normal' | 'Urgente' | 'Crítico';
  notes: string;
  isManual: boolean;         // true = added manually (not from catalog)
  source: string;            // e.g. "Catálogo Komatsu D155AX-6"
}

interface CartStore {
  items: CartItem[];
  addItem: (part: Omit<CartItem, 'cartId'>) => void;
  removeItem: (cartId: string) => void;
  updateItem: (cartId: string, updates: Partial<CartItem>) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set) => ({
      items: [],

      addItem: (part) =>
        set((state) => {
          // If same part_number already in cart (catalog parts), bump qty
          if (!part.isManual) {
            const existing = state.items.find((i) => i.part_number === part.part_number && !i.isManual);
            if (existing) {
              return {
                items: state.items.map((i) =>
                  i.cartId === existing.cartId ? { ...i, quantity: i.quantity + 1 } : i
                ),
              };
            }
          }
          const cartId = `cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          return { items: [...state.items, { ...part, cartId }] };
        }),

      removeItem: (cartId) =>
        set((state) => ({ items: state.items.filter((i) => i.cartId !== cartId) })),

      updateItem: (cartId, updates) =>
        set((state) => ({
          items: state.items.map((i) => (i.cartId === cartId ? { ...i, ...updates } : i)),
        })),

      clearCart: () => set({ items: [] }),
    }),
    { name: 'hermes-cart-v1' }
  )
);
