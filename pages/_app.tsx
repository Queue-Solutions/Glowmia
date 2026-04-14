import '@/styles/globals.css';
import '@/styles/agent.css';
import type { AppProps } from 'next/app';
import { SitePreferencesProvider } from '@/src/context/SitePreferencesContext';
import { FavoritesProvider } from '@/src/context/FavoritesContext';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <SitePreferencesProvider>
      <FavoritesProvider>
        <Component {...pageProps} />
      </FavoritesProvider>
    </SitePreferencesProvider>
  );
}
