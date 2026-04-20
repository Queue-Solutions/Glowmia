import { useEffect, useMemo, useState } from 'react';

export type CartSize = 'S' | 'M' | 'L';

export type CartEntry = {
  designId: string;
  size: CartSize;
  quantity: number;
  addedAt: string;
};

const DEFAULT_STORAGE_KEY = 'glowmia:cart';
const VALID_SIZES = new Set<CartSize>(['S', 'M', 'L']);

function normalizeCartEntry(value: unknown): CartEntry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const entry = value as Partial<CartEntry>;
  const designId = typeof entry.designId === 'string' ? entry.designId.trim() : '';
  const size = entry.size;

  if (!designId || !size || !VALID_SIZES.has(size)) {
    return null;
  }

  return {
    designId,
    size,
    quantity: Math.max(1, Math.min(99, Math.round(Number(entry.quantity) || 1))),
    addedAt: typeof entry.addedAt === 'string' && entry.addedAt ? entry.addedAt : new Date().toISOString(),
  };
}

function normalizeCartEntries(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeCartEntry)
    .filter((entry): entry is CartEntry => Boolean(entry));
}

function cartKey(designId: string, size: CartSize) {
  return `${designId}::${size}`;
}

export const cartSizes: CartSize[] = ['S', 'M', 'L'];

export function useCart(storageKey = DEFAULT_STORAGE_KEY) {
  const [entries, setEntries] = useState<CartEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const raw = window.localStorage.getItem(storageKey);
      setEntries(raw ? normalizeCartEntries(JSON.parse(raw)) : []);
    } catch {
      setEntries([]);
    } finally {
      setHydrated(true);
    }
  }, [storageKey]);

  const persistEntries = (nextEntries: CartEntry[]) => {
    setEntries(nextEntries);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, JSON.stringify(nextEntries));
    }
  };

  const addItem = (designId: string | number, size: CartSize) => {
    const normalizedId = String(designId);
    const key = cartKey(normalizedId, size);
    let added = false;

    const nextEntries = entries.map((entry) => {
      if (cartKey(entry.designId, entry.size) !== key) {
        return entry;
      }

      added = true;
      return {
        ...entry,
        quantity: Math.min(99, entry.quantity + 1),
        addedAt: new Date().toISOString(),
      };
    });

    if (!added) {
      nextEntries.unshift({
        designId: normalizedId,
        size,
        quantity: 1,
        addedAt: new Date().toISOString(),
      });
    }

    persistEntries(nextEntries);
  };

  const updateQuantity = (designId: string | number, size: CartSize, quantity: number) => {
    const normalizedId = String(designId);
    const nextQuantity = Math.max(0, Math.min(99, Math.round(quantity)));

    if (nextQuantity === 0) {
      persistEntries(entries.filter((entry) => cartKey(entry.designId, entry.size) !== cartKey(normalizedId, size)));
      return;
    }

    persistEntries(
      entries.map((entry) =>
        cartKey(entry.designId, entry.size) === cartKey(normalizedId, size)
          ? { ...entry, quantity: nextQuantity }
          : entry,
      ),
    );
  };

  const removeItem = (designId: string | number, size: CartSize) => {
    const normalizedId = String(designId);
    persistEntries(entries.filter((entry) => cartKey(entry.designId, entry.size) !== cartKey(normalizedId, size)));
  };

  const clearCart = () => {
    persistEntries([]);
  };

  const totalQuantity = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.quantity, 0),
    [entries],
  );

  const entrySet = useMemo(
    () => new Set(entries.map((entry) => cartKey(entry.designId, entry.size))),
    [entries],
  );

  return {
    entries,
    entrySet,
    totalQuantity,
    hydrated,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    hasItem: (designId: string | number, size: CartSize) => entrySet.has(cartKey(String(designId), size)),
  };
}
