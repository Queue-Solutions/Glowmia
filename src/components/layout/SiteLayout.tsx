import type { ReactNode } from 'react';
import { useSitePreferencesContext } from '@/src/context/SitePreferencesContext';
import { SiteHeader } from '@/src/components/site/Header';
import { SiteFooter } from '@/src/components/site/Footer';

type SiteLayoutProps = {
  currentPath: string;
  children: ReactNode;
  immersive?: boolean;
  showFooter?: boolean;
};

export function SiteLayout({ currentPath, children, immersive = false, showFooter = true }: SiteLayoutProps) {
  const { darkMode, language } = useSitePreferencesContext();
  const mainClassName = immersive ? 'site-main site-main--immersive' : 'site-main pb-16 pt-6 md:pt-8';

  return (
    <div className={`site-theme ${darkMode ? 'theme-dark' : 'theme-light'} ${language === 'ar' ? 'lang-ar' : ''}`}>
      <div className="site-background" />
      <div className={`site-shell min-h-screen ${immersive ? 'site-shell--immersive' : ''}`}>
        <SiteHeader currentPath={currentPath} />
        <main className={mainClassName}>{children}</main>
        {showFooter ? <SiteFooter /> : null}
      </div>
    </div>
  );
}
