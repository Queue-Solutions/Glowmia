import { useEffect, useMemo, useState } from 'react';

const DEFAULT_STORAGE_KEY = 'glowmia:saved-dresses';

function normalizeIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item))
    .filter(Boolean);
}

export function useFavorites(storageKey = DEFAULT_STORAGE_KEY) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const raw = window.localStorage.getItem(storageKey);
      setFavorites(raw ? normalizeIds(JSON.parse(raw)) : []);
    } catch {
      setFavorites([]);
    } finally {
      setHydrated(true);
    }
  }, [storageKey]);

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);

  const persistFavorites = (nextFavorites: string[]) => {
    setFavorites(nextFavorites);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, JSON.stringify(nextFavorites));
    }
  };

  const toggleFavorite = (id: string | number) => {
    const normalizedId = String(id);

    if (favoriteSet.has(normalizedId)) {
      persistFavorites(favorites.filter((item) => item !== normalizedId));
      return;
    }

    persistFavorites([...favorites, normalizedId]);
  };

  return {
    favorites,
    favoriteSet,
    favoritesCount: favorites.length,
    hydrated,
    isFavorite: (id: string | number) => favoriteSet.has(String(id)),
    toggleFavorite,
  };
}
