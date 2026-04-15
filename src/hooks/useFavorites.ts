import { useEffect, useMemo, useState } from 'react';
import { syncDesignLike } from '@/src/services/engagement';

const DEFAULT_STORAGE_KEY = 'glowmia:saved-dresses';
const CLIENT_ID_STORAGE_KEY = 'glowmia:client-id';

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
  const [clientId, setClientId] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const raw = window.localStorage.getItem(storageKey);
      setFavorites(raw ? normalizeIds(JSON.parse(raw)) : []);

      const storedClientId = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY);
      const nextClientId =
        storedClientId ||
        (typeof window.crypto?.randomUUID === 'function'
          ? window.crypto.randomUUID()
          : `glowmia-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

      if (!storedClientId) {
        window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, nextClientId);
      }

      setClientId(nextClientId);
    } catch {
      setFavorites([]);
    } finally {
      setHydrated(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated || !clientId) {
      return;
    }

    favorites.forEach((designId) => {
      void syncDesignLike({ designId, clientId, liked: true }).catch(() => undefined);
    });
  }, [clientId, favorites, hydrated]);

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
      if (clientId) {
        void syncDesignLike({ designId: normalizedId, clientId, liked: false }).catch(() => undefined);
      }
      return;
    }

    persistFavorites([...favorites, normalizedId]);
    if (clientId) {
      void syncDesignLike({ designId: normalizedId, clientId, liked: true }).catch(() => undefined);
    }
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
