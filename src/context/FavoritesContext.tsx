import { createContext, useContext, type ReactNode } from 'react';
import { useFavorites } from '@/src/hooks/useFavorites';

type FavoritesValue = ReturnType<typeof useFavorites>;

const FavoritesContext = createContext<FavoritesValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const favorites = useFavorites();

  return <FavoritesContext.Provider value={favorites}>{children}</FavoritesContext.Provider>;
}

export function useFavoritesContext() {
  const context = useContext(FavoritesContext);

  if (!context) {
    throw new Error('useFavoritesContext must be used within FavoritesProvider');
  }

  return context;
}
