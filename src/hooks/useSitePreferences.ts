'use client';

import { useEffect, useState } from 'react';
import type { Language } from '@/src/content/glowmia';

const LANGUAGE_KEY = 'glowmia:language';
const THEME_KEY = 'glowmia:theme';

export function useSitePreferences() {
  const [language, setLanguage] = useState<Language>('en');
  const [darkMode, setDarkMode] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const storedLanguage = window.localStorage.getItem(LANGUAGE_KEY);
    const storedTheme = window.localStorage.getItem(THEME_KEY);

    if (storedLanguage === 'en' || storedLanguage === 'ar') {
      setLanguage(storedLanguage);
    }

    if (storedTheme === 'dark') {
      setDarkMode(true);
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(LANGUAGE_KEY, language);
  }, [hydrated, language]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(THEME_KEY, darkMode ? 'dark' : 'light');
  }, [darkMode, hydrated]);

  return {
    darkMode,
    hydrated,
    language,
    setDarkMode,
    setLanguage,
    toggleDarkMode: () => setDarkMode((current) => !current),
    toggleLanguage: () => setLanguage((current) => (current === 'en' ? 'ar' : 'en')),
  };
}
