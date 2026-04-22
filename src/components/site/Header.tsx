import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Home, Menu, Moon, Shirt, ShoppingCart, Sun, X } from 'lucide-react';
import { glowmiaCopy, copyFor } from '@/src/content/glowmia';
import { useSitePreferencesContext } from '@/src/context/SitePreferencesContext';
import { useCartContext } from '@/src/context/CartContext';

type SiteHeaderProps = {
  currentPath: string;
};

function HangerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 6.25a2.25 2.25 0 1 0-2.15-2.88" />
      <path d="M12 6.25v1.35c0 .74-.41 1.41-1.07 1.75l-5.7 2.96A2.25 2.25 0 0 0 6.27 16h11.46a2.25 2.25 0 0 0 1.04-4.24l-5.7-2.96A1.97 1.97 0 0 1 12 7.6" />
    </svg>
  );
}

const navIcons = {
  '/': Home,
  '/designs': HangerIcon,
  '/agent': Bot,
} as const;

export function SiteHeader({ currentPath }: SiteHeaderProps) {
  const { darkMode, language, toggleDarkMode, toggleLanguage } = useSitePreferencesContext();
  const { totalQuantity, hydrated } = useCartContext();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAgentHeaderHidden, setIsAgentHeaderHidden] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [currentPath]);

  useEffect(() => {
    if (currentPath !== '/agent') {
      setIsAgentHeaderHidden(false);
      return;
    }

    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const nextScrollY = window.scrollY;
      const scrollingDown = nextScrollY > lastScrollY;
      const movedEnough = Math.abs(nextScrollY - lastScrollY) > 10;
      const shouldHide = nextScrollY > 64 && scrollingDown && movedEnough && !mobileMenuOpen;

      if (nextScrollY <= 16 || !scrollingDown || mobileMenuOpen) {
        setIsAgentHeaderHidden(false);
      } else if (shouldHide) {
        setIsAgentHeaderHidden(true);
      }

      lastScrollY = nextScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentPath, mobileMenuOpen]);

  return (
    <header
      className={`site-header sticky top-0 z-40 bg-[color:var(--surface)]/92 backdrop-blur-xl ${isAgentHeaderHidden ? 'site-header--hidden' : ''}`}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-4 md:px-10">
        <div className="header-brand-cluster">
          <Link
            href="/cart"
            className={`header-cart-link ${currentPath === '/cart' ? 'header-cart-link--active' : ''}`}
            aria-label={copyFor(language, glowmiaCopy.cart.title)}
            title={copyFor(language, glowmiaCopy.cart.title)}
          >
            <ShoppingCart className="h-[1.05rem] w-[1.05rem]" />
            {hydrated && totalQuantity > 0 ? <span className="cart-nav-badge">{totalQuantity}</span> : null}
          </Link>

          <Link href="/" className="flex items-center text-[color:var(--text-primary)] transition-opacity hover:opacity-80" aria-label="Glowmia">
            <Image src="/glowmia-logo.svg" alt="Glowmia" width={164} height={44} priority className="h-9 w-auto md:h-10" />
          </Link>
        </div>

        <nav className="hidden items-center rounded-full border border-[color:var(--line)] bg-[color:var(--surface-elevated)]/92 p-1 md:flex">
          {glowmiaCopy.header.nav.map((item) => {
            const isActive = currentPath === item.href;
            const Icon = navIcons[item.href as keyof typeof navIcons] ?? Shirt;

            return (
              <Link key={item.href} href={item.href} className="header-nav-link group" aria-label={copyFor(language, item.label)} title={copyFor(language, item.label)}>
                {isActive ? <motion.span layoutId="header-nav-pill" className="header-nav-pill" transition={{ type: 'spring', stiffness: 430, damping: 34, mass: 0.45 }} /> : null}
                <motion.span whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} className={`header-nav-inner relative z-[1] ${isActive ? 'text-[color:var(--surface-base)]' : 'text-[color:var(--text-muted)]'}`}>
                  <Icon className="h-[1.05rem] w-[1.05rem] shrink-0" />
                </motion.span>
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <button type="button" onClick={toggleLanguage} className="chrome-button min-w-[6.75rem]">
            {copyFor(language, glowmiaCopy.header.languageToggle)}
          </button>
          <button type="button" onClick={toggleDarkMode} className="chrome-button chrome-icon-button" aria-label={copyFor(language, glowmiaCopy.header.themeToggle)}>
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <button type="button" onClick={toggleDarkMode} className="chrome-button chrome-icon-button" aria-label={copyFor(language, glowmiaCopy.header.themeToggle)}>
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => setMobileMenuOpen((current) => !current)} className="chrome-button chrome-icon-button" aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}>
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-[color:var(--line)]/70 md:hidden"
          >
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-5 py-4">
              <div className="mobile-menu-shell">
                {glowmiaCopy.header.nav.map((item, index) => {
                  const isActive = currentPath === item.href;

                  return (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, x: language === 'ar' ? 16 : -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: language === 'ar' ? 12 : -12 }}
                      transition={{ duration: 0.16, delay: index * 0.025 }}
                    >
                      <Link href={item.href} onClick={() => setMobileMenuOpen(false)} className={`mobile-menu-link ${isActive ? 'mobile-menu-link--active' : ''}`}>
                        <span>{copyFor(language, item.label)}</span>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    toggleLanguage();
                    setMobileMenuOpen(false);
                  }}
                  className="chrome-button flex-1"
                >
                  {copyFor(language, glowmiaCopy.header.languageToggle)}
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
