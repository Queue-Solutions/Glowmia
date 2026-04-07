import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useSitePreferences } from '@/src/hooks/useSitePreferences';

type SitePreferencesValue = ReturnType<typeof useSitePreferences>;

const SitePreferencesContext = createContext<SitePreferencesValue | null>(null);

export function SitePreferencesProvider({ children }: { children: ReactNode }) {
  const preferences = useSitePreferences();

  useEffect(() => {
    document.documentElement.lang = preferences.language;
    document.documentElement.dir = preferences.language === 'ar' ? 'rtl' : 'ltr';
  }, [preferences.language]);

  return (
    <SitePreferencesContext.Provider value={preferences}>
      {children}
    </SitePreferencesContext.Provider>
  );
}

export function useSitePreferencesContext() {
  const context = useContext(SitePreferencesContext);

  if (!context) {
    throw new Error('useSitePreferencesContext must be used within SitePreferencesProvider');
  }

  return context;
}
