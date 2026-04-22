import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { Loader2, Minus, Plus, ShoppingCart, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import type { GetStaticProps, InferGetStaticPropsType } from 'next';
import { useRouter } from 'next/router';
import { SiteLayout } from '@/src/components/layout/SiteLayout';
import { copyFor, glowmiaCopy } from '@/src/content/glowmia';
import { localizeText, type Design } from '@/src/data/designs';
import { getAllDesignsFromSupabase } from '@/src/services/dresses';
import { useSitePreferencesContext } from '@/src/context/SitePreferencesContext';
import { useCartContext } from '@/src/context/CartContext';
import { fetchSavedDesign, type SavedDesignEntry } from '@/src/services/engagement';

type CartPageProps = {
  designs: Design[];
};

export const getStaticProps: GetStaticProps<CartPageProps> = async () => {
  const designs = await getAllDesignsFromSupabase();

  return {
    props: {
      designs,
    },
    revalidate: 60,
  };
};

export default function CartPage({ designs }: InferGetStaticPropsType<typeof getStaticProps>) {
  const router = useRouter();
  const { language } = useSitePreferencesContext();
  const { entries, totalQuantity, updateQuantity, removeItem, clearCart } = useCartContext();
  const [showClearCartConfirm, setShowClearCartConfirm] = useState(false);
  const [savedDesign, setSavedDesign] = useState<SavedDesignEntry | null>(null);
  const [savedDesignState, setSavedDesignState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [savedDesignError, setSavedDesignError] = useState('');
  const clearCartDialogMessage =
    language === 'ar'
      ? '\u0647\u0644 \u0623\u0646\u062a \u0645\u062a\u0623\u0643\u062f \u0623\u0646\u0643 \u062a\u0631\u064a\u062f \u0625\u0641\u0631\u0627\u063a \u0627\u0644\u0633\u0644\u0629\u061f'
      : 'Are you sure you want to clear the cart?';
  const clearCartYesLabel = language === 'ar' ? '\u0646\u0639\u0645' : 'Yes';
  const clearCartNoLabel = language === 'ar' ? '\u0644\u0627' : 'No';

  const designsById = useMemo(
    () => new Map(designs.map((design) => [design.id, design])),
    [designs],
  );

  const cartItems = useMemo(
    () =>
      entries
        .map((entry) => ({
          entry,
          design: designsById.get(entry.designId) ?? null,
        }))
        .filter((item) => item.design),
    [designsById, entries],
  );

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    const savedDesignId = typeof router.query.savedDesignId === 'string' ? router.query.savedDesignId.trim() : '';

    if (!savedDesignId) {
      setSavedDesign(null);
      setSavedDesignState('idle');
      setSavedDesignError('');
      return;
    }

    let cancelled = false;
    setSavedDesignState('loading');
    setSavedDesignError('');

    void fetchSavedDesign(savedDesignId)
      .then((nextSavedDesign) => {
        if (cancelled) {
          return;
        }

        if (!nextSavedDesign) {
          setSavedDesign(null);
          setSavedDesignState('error');
          setSavedDesignError(language === 'ar' ? 'تعذر العثور على التصميم المحفوظ.' : 'The saved design could not be found.');
          return;
        }

        setSavedDesign(nextSavedDesign);
        setSavedDesignState('loaded');
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        setSavedDesign(null);
        setSavedDesignState('error');
        setSavedDesignError(loadError instanceof Error ? loadError.message : language === 'ar' ? 'تعذر تحميل التصميم المحفوظ.' : 'Unable to load the saved design.');
      });

    return () => {
      cancelled = true;
    };
  }, [language, router.isReady, router.query.savedDesignId]);

  const savedDesignBase = useMemo(
    () => (savedDesign ? designsById.get(savedDesign.dressId) ?? null : null),
    [designsById, savedDesign],
  );

  const hasItems = cartItems.length > 0 || savedDesignState === 'loading' || Boolean(savedDesign);
  const effectiveItemCount = totalQuantity + (savedDesign ? 1 : 0);

  async function removeSavedDesignFromCart() {
    await router.replace('/cart', undefined, { shallow: true });
  }

  const handleClearCart = () => {
    setShowClearCartConfirm(true);
  };

  const confirmClearCart = () => {
    clearCart();
    if (router.query.savedDesignId) {
      void router.replace('/cart', undefined, { shallow: true });
    }
    setShowClearCartConfirm(false);
  };

  const dismissClearCartConfirm = () => {
    setShowClearCartConfirm(false);
  };

  return (
    <>
      <Head>
        <title>{`Glowmia | ${copyFor(language, glowmiaCopy.cart.title)}`}</title>
        <meta name="description" content={copyFor(language, glowmiaCopy.cart.description)} />
      </Head>

      <SiteLayout currentPath="/cart">
        <section className="mx-auto grid w-full max-w-7xl gap-8 px-6 py-6 md:px-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="eyebrow-chip">
                <ShoppingCart className="h-4 w-4" />
                Glowmia
              </p>
              <h1 className="font-display text-5xl text-[color:var(--text-primary)] md:text-6xl">
                {copyFor(language, glowmiaCopy.cart.title)}
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-[color:var(--text-muted)]">
                {copyFor(language, glowmiaCopy.cart.description)}
              </p>
            </div>

            <Link href="/designs" className="secondary-button w-full justify-center sm:w-auto">
              {copyFor(language, glowmiaCopy.cart.continueShopping)}
            </Link>
          </div>

          {savedDesignState === 'error' && savedDesignError ? <p className="checkout-error">{savedDesignError}</p> : null}

          {hasItems ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
              <div className="grid gap-4">
                {savedDesignState === 'loading' ? (
                  <div className="rounded-[1.5rem] border border-[color:var(--line)] bg-[color:var(--surface-elevated)] px-6 py-10 text-center text-sm text-[color:var(--text-muted)]">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {language === 'ar' ? 'جارٍ تحميل التصميم المحفوظ...' : 'Loading saved design...'}
                    </span>
                  </div>
                ) : null}

                {savedDesign ? (
                  <article className="cart-line-item cart-line-item--saved">
                    <div className="cart-line-item__media">
                      <div className="cart-line-item__media-stage">
                        <img
                          src={savedDesign.editedImageUrl || savedDesign.originalImageUrl}
                          alt={savedDesign.designName || (language === 'ar' ? 'تصميم محفوظ' : 'Saved design')}
                          className="cart-line-item__media-image"
                        />
                      </div>
                    </div>

                    <div className="cart-line-item__body">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="eyebrow-chip !px-3 !py-2 !text-[0.65rem]">
                            {language === 'ar' ? 'تصميم محفوظ' : 'Saved design'}
                          </span>
                          <span className="cart-size-pill">
                            {copyFor(language, glowmiaCopy.cart.quantity)} 1
                          </span>
                        </div>

                        <div>
                          {savedDesignBase ? (
                            <Link href={`/designs/${savedDesignBase.slug}`} className="text-2xl font-semibold tracking-[-0.02em] text-[color:var(--text-primary)] transition hover:text-[color:var(--accent)]">
                              {savedDesign.designName || localizeText(language, savedDesignBase.name)}
                            </Link>
                          ) : (
                            <p className="text-2xl font-semibold tracking-[-0.02em] text-[color:var(--text-primary)]">
                              {savedDesign.designName || (language === 'ar' ? 'تصميم محفوظ' : 'Saved design')}
                            </p>
                          )}
                          <p className="mt-2 line-clamp-2 text-sm leading-7 text-[color:var(--text-muted)]">
                            {savedDesign.prompt || (language === 'ar' ? 'التصميم المعدل المحفوظ من Glowmia Stylist.' : 'Edited design saved from Glowmia Stylist.')}
                          </p>
                        </div>
                      </div>

                      <div className="cart-line-item__controls">
                        <button type="button" onClick={() => void removeSavedDesignFromCart()} className="secondary-button cart-remove-button">
                          <X className="h-4 w-4" />
                          {language === 'ar' ? 'إزالة التصميم' : 'Remove design'}
                        </button>
                      </div>
                    </div>
                  </article>
                ) : null}

                {cartItems.map(({ entry, design }) => {
                  if (!design) {
                    return null;
                  }

                  return (
                    <article key={`${entry.designId}-${entry.size}`} className="cart-line-item">
                      <Link href={`/designs/${design.slug}`} className="cart-line-item__media">
                        <div className="cart-line-item__media-stage">
                          <Image
                            src={design.coverImage}
                            alt={localizeText(language, design.name)}
                            fill
                            className="cart-line-item__media-image"
                            sizes="(max-width: 768px) 38vw, 12rem"
                          />
                        </div>
                      </Link>

                      <div className="cart-line-item__body">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="eyebrow-chip !px-3 !py-2 !text-[0.65rem]">
                              {localizeText(language, design.categoryLabel)}
                            </span>
                            <span className="cart-size-pill">
                              {copyFor(language, glowmiaCopy.cart.sizeLabel)} {entry.size}
                            </span>
                          </div>

                          <div>
                            <Link href={`/designs/${design.slug}`} className="text-2xl font-semibold tracking-[-0.02em] text-[color:var(--text-primary)] transition hover:text-[color:var(--accent)]">
                              {localizeText(language, design.name)}
                            </Link>
                            <p className="mt-2 line-clamp-2 text-sm leading-7 text-[color:var(--text-muted)]">
                              {localizeText(language, design.description)}
                            </p>
                          </div>
                        </div>

                        <div className="cart-line-item__controls">
                          <div className="cart-quantity-control" aria-label={copyFor(language, glowmiaCopy.cart.quantity)}>
                            <button
                              type="button"
                              onClick={() => updateQuantity(entry.designId, entry.size, entry.quantity - 1)}
                              aria-label="Decrease quantity"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span>{entry.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(entry.designId, entry.size, entry.quantity + 1)}
                              aria-label="Increase quantity"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>

                          <button type="button" onClick={() => removeItem(entry.designId, entry.size)} className="secondary-button cart-remove-button">
                            <Trash2 className="h-4 w-4" />
                            {copyFor(language, glowmiaCopy.cart.remove)}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <aside className="cart-summary-panel">
                <div className="space-y-3">
                  <p className="text-sm uppercase tracking-[0.24em] text-[color:var(--text-muted)]">
                    {copyFor(language, glowmiaCopy.cart.summaryTitle)}
                  </p>
                  <div className="cart-summary-count">
                    <span>{copyFor(language, glowmiaCopy.cart.itemCount)}</span>
                    <strong>{effectiveItemCount}</strong>
                  </div>
                  <p className="text-sm leading-7 text-[color:var(--text-muted)]">
                    {copyFor(language, glowmiaCopy.cart.fittingNote)}
                  </p>
                </div>

                <div className="grid gap-3">
                  <Link
                    href={{
                      pathname: '/checkout',
                      query: {
                        savedDesignId: savedDesign?.id || undefined,
                        prefillName:
                          typeof router.query.prefillName === 'string' ? router.query.prefillName : undefined,
                        prefillPhone:
                          typeof router.query.prefillPhone === 'string' ? router.query.prefillPhone : undefined,
                      },
                    }}
                    className="primary-button w-full"
                  >
                    {copyFor(language, glowmiaCopy.cart.checkout)}
                  </Link>
                  <button type="button" onClick={handleClearCart} className="secondary-button w-full">
                    {copyFor(language, glowmiaCopy.cart.clearCart)}
                  </button>
                </div>
              </aside>
            </div>
          ) : (
            <div className="cart-empty-state">
              <div className="cart-empty-state__icon">
                <ShoppingCart className="h-10 w-10" />
              </div>
              <div className="space-y-3">
                <h2 className="font-display text-4xl text-[color:var(--text-primary)]">
                  {copyFor(language, glowmiaCopy.cart.emptyTitle)}
                </h2>
                <p className="mx-auto max-w-xl text-base leading-8 text-[color:var(--text-muted)]">
                  {copyFor(language, glowmiaCopy.cart.emptyDescription)}
                </p>
              </div>
              <Link href="/designs" className="primary-button">
                {copyFor(language, glowmiaCopy.cart.continueShopping)}
              </Link>
            </div>
          )}
        </section>
      </SiteLayout>
      <AnimatePresence>
        {showClearCartConfirm ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="checkout-modal">
            <button
              type="button"
              className="checkout-modal__backdrop"
              onClick={dismissClearCartConfirm}
              aria-label={clearCartNoLabel}
            />
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="checkout-modal__panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="clear-cart-confirm-title"
            >
              <div className="space-y-3 text-center">
                <h2 id="clear-cart-confirm-title" className="text-2xl font-semibold tracking-[-0.02em] text-[color:var(--text-primary)]">
                  {copyFor(language, glowmiaCopy.cart.clearCart)}
                </h2>
                <p className="text-sm leading-7 text-[color:var(--text-muted)]">{clearCartDialogMessage}</p>
              </div>

              <div className="grid w-full gap-3 sm:grid-cols-2">
                <button type="button" onClick={confirmClearCart} className="primary-button w-full">
                  {clearCartYesLabel}
                </button>
                <button type="button" onClick={dismissClearCartConfirm} className="secondary-button w-full">
                  {clearCartNoLabel}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
