import { createContext, useContext, type ReactNode } from 'react';
import { useCart } from '@/src/hooks/useCart';

type CartValue = ReturnType<typeof useCart>;

const CartContext = createContext<CartValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const cart = useCart();

  return <CartContext.Provider value={cart}>{children}</CartContext.Provider>;
}

export function useCartContext() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error('useCartContext must be used within CartProvider');
  }

  return context;
}
