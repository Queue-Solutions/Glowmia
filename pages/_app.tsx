import '@/styles/globals.css';
import '@/styles/agent.css';
import type { AppProps } from 'next/app';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/router';
import { SitePreferencesProvider } from '@/src/context/SitePreferencesContext';
import { FavoritesProvider } from '@/src/context/FavoritesContext';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  return (
    <SitePreferencesProvider>
      <FavoritesProvider>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={router.asPath}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <Component {...pageProps} />
          </motion.div>
        </AnimatePresence>
      </FavoritesProvider>
    </SitePreferencesProvider>
  );
}
