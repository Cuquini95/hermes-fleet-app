import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock zustand persist middleware storage so tests don't hit localStorage
vi.mock('zustand/middleware', async () => {
  const actual = await vi.importActual<typeof import('zustand/middleware')>('zustand/middleware');
  return {
    ...actual,
    persist: (config: unknown) => config, // no-op persist in tests
  };
});

// Import AFTER mocks
const { useCartStore } = await import('./cart-store');

function getStore() {
  return useCartStore.getState();
}

const SAMPLE_PART = {
  part_number: 'F001-123',
  description: 'Filtro de aceite',
  quantity: 1,
  unit_price: 450,
  equipment: 'CA20',
  urgencia: 'Normal' as const,
  notes: '',
  isManual: false,
  source: 'Catálogo Komatsu',
};

describe('cart-store', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [] });
  });

  // addItem
  describe('addItem', () => {
    it('adds a new item to an empty cart', () => {
      getStore().addItem(SAMPLE_PART);
      expect(getStore().items).toHaveLength(1);
      expect(getStore().items[0].part_number).toBe('F001-123');
    });

    it('assigns a unique cartId to each item', () => {
      getStore().addItem(SAMPLE_PART);
      getStore().addItem({ ...SAMPLE_PART, part_number: 'F002-999' });
      const ids = getStore().items.map((i) => i.cartId);
      expect(ids[0]).not.toBe(ids[1]);
    });

    it('bumps quantity instead of adding a duplicate for catalog parts', () => {
      getStore().addItem(SAMPLE_PART);
      getStore().addItem(SAMPLE_PART); // same part_number, isManual=false
      const items = getStore().items;
      expect(items).toHaveLength(1);
      expect(items[0].quantity).toBe(2);
    });

    it('adds a second line for the same part_number when isManual=true', () => {
      getStore().addItem({ ...SAMPLE_PART, isManual: true });
      getStore().addItem({ ...SAMPLE_PART, isManual: true });
      expect(getStore().items).toHaveLength(2);
    });

    it('adds multiple different parts without merging', () => {
      getStore().addItem(SAMPLE_PART);
      getStore().addItem({ ...SAMPLE_PART, part_number: 'F002-999' });
      expect(getStore().items).toHaveLength(2);
    });
  });

  // removeItem
  describe('removeItem', () => {
    it('removes the item with the given cartId', () => {
      getStore().addItem(SAMPLE_PART);
      const id = getStore().items[0].cartId;
      getStore().removeItem(id);
      expect(getStore().items).toHaveLength(0);
    });

    it('leaves other items intact when removing one', () => {
      getStore().addItem(SAMPLE_PART);
      getStore().addItem({ ...SAMPLE_PART, part_number: 'F002-999' });
      const [first] = getStore().items;
      getStore().removeItem(first.cartId);
      expect(getStore().items).toHaveLength(1);
      expect(getStore().items[0].part_number).toBe('F002-999');
    });

    it('is a no-op when cartId does not exist', () => {
      getStore().addItem(SAMPLE_PART);
      getStore().removeItem('nonexistent-id');
      expect(getStore().items).toHaveLength(1);
    });
  });

  // updateItem
  describe('updateItem', () => {
    it('updates the quantity of a specific item', () => {
      getStore().addItem(SAMPLE_PART);
      const id = getStore().items[0].cartId;
      getStore().updateItem(id, { quantity: 5 });
      expect(getStore().items[0].quantity).toBe(5);
    });

    it('updates multiple fields at once', () => {
      getStore().addItem(SAMPLE_PART);
      const id = getStore().items[0].cartId;
      getStore().updateItem(id, { quantity: 3, notes: 'Urgente hoy' });
      expect(getStore().items[0].quantity).toBe(3);
      expect(getStore().items[0].notes).toBe('Urgente hoy');
    });

    it('does not affect other items when updating one', () => {
      getStore().addItem(SAMPLE_PART);
      getStore().addItem({ ...SAMPLE_PART, part_number: 'F002-999' });
      const [, second] = getStore().items;
      getStore().updateItem(second.cartId, { quantity: 10 });
      expect(getStore().items[0].quantity).toBe(1); // unchanged
      expect(getStore().items[1].quantity).toBe(10);
    });

    it('is a no-op when cartId does not exist', () => {
      getStore().addItem(SAMPLE_PART);
      getStore().updateItem('ghost-id', { quantity: 99 });
      expect(getStore().items[0].quantity).toBe(1); // unchanged
    });
  });

  // clearCart
  describe('clearCart', () => {
    it('empties all items', () => {
      getStore().addItem(SAMPLE_PART);
      getStore().addItem({ ...SAMPLE_PART, part_number: 'F002-999' });
      getStore().clearCart();
      expect(getStore().items).toHaveLength(0);
    });

    it('is idempotent on an empty cart', () => {
      getStore().clearCart();
      expect(getStore().items).toHaveLength(0);
    });
  });

  // total calculation (derived)
  describe('total calculation', () => {
    it('total price equals sum of quantity * unit_price for all items', () => {
      getStore().addItem({ ...SAMPLE_PART, quantity: 2, unit_price: 500 });
      getStore().addItem({ ...SAMPLE_PART, part_number: 'F002', quantity: 1, unit_price: 300 });
      const total = getStore().items.reduce(
        (sum, item) => sum + item.quantity * item.unit_price,
        0,
      );
      expect(total).toBe(1300); // 2*500 + 1*300
    });
  });
});
