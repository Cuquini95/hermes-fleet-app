import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

let cartOwner = '';

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

/** Persisted shopping-cart store for parts orders: add/remove/update items and clear the cart. */
export const useCartStore = create<CartStore>()(
  persist(
    (set) => ({
      items: [],

      addItem: (part) =>
        set((state) => {
          // Each unit has its own line, even when it uses the same catalog part.
          if (!part.isManual) {
            const existing = state.items.find((i) => i.part_number === part.part_number && i.equipment === part.equipment && !i.isManual);
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
    {
      name: 'hermes-cart-v2',
      skipHydration: true,
      storage: createJSONStorage(() => ({
        getItem: (key) => cartOwner ? globalThis.localStorage?.getItem(`${key}:${cartOwner}`) ?? null : null,
        setItem: (key, value) => { if (cartOwner) globalThis.localStorage?.setItem(`${key}:${cartOwner}`, value); },
        removeItem: (key) => { if (cartOwner) globalThis.localStorage?.removeItem(`${key}:${cartOwner}`); },
      })),
    }
  )
);

export function setCartSession(owner: string) {
  if (owner === cartOwner) return;
  cartOwner = '';
  useCartStore.setState({ items: [] });
  cartOwner = owner;
  if (owner) void useCartStore.persist.rehydrate();
}
