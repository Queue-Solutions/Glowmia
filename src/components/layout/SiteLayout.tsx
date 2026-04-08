import type { ReactNode } from 'react';
import { useSitePreferencesContext } from '@/src/context/SitePreferencesContext';
import { SiteHeader } from '@/src/components/site/Header';
import { SiteFooter } from '@/src/components/site/Footer';
import { CursorAura } from '@/src/components/site/CursorAura';

type SiteLayoutProps = {
  currentPath: string;
  children: ReactNode;
};

export function SiteLayout({ currentPath, children }: SiteLayoutProps) {
  const { darkMode, language } = useSitePreferencesContext();

  return (
    <div className={`site-theme ${darkMode ? 'theme-dark' : 'theme-light'} ${language === 'ar' ? 'lang-ar' : ''}`}>
      <CursorAura />
      <div className="site-background" />
      <div className="site-shell min-h-screen">
        <SiteHeader currentPath={currentPath} />
        <main className="pb-16 pt-6 md:pt-8">{children}</main>
        <SiteFooter />
      </div>
    </div>
  );
}
