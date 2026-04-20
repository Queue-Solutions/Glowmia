import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import type { GetStaticProps, InferGetStaticPropsType } from 'next';
import { SiteLayout } from '@/src/components/layout/SiteLayout';
import { copyFor, glowmiaCopy } from '@/src/content/glowmia';
import { localizeText, type Design } from '@/src/data/designs';
import { getAllDesignsFromSupabase } from '@/src/services/dresses';
import { useSitePreferencesContext } from '@/src/context/SitePreferencesContext';
import { useCartContext } from '@/src/context/CartContext';

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
  const { language } = useSitePreferencesContext();
  const { entries, totalQuantity, updateQuantity, removeItem, clearCart } = useCartContext();

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

  const hasItems = cartItems.length > 0;

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

          {hasItems ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
              <div className="grid gap-4">
                {cartItems.map(({ entry, design }) => {
                  if (!design) {
                    return null;
                  }

                  return (
                    <article key={`${entry.designId}-${entry.size}`} className="cart-line-item">
                      <Link href={`/designs/${design.slug}`} className="cart-line-item__media">
                        <Image
                          src={design.coverImage}
                          alt={localizeText(language, design.name)}
                          fill
                          className="object-cover object-top"
                          sizes="(max-width: 768px) 38vw, 12rem"
                        />
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
                    <strong>{totalQuantity}</strong>
                  </div>
                  <p className="text-sm leading-7 text-[color:var(--text-muted)]">
                    {copyFor(language, glowmiaCopy.cart.fittingNote)}
                  </p>
                </div>

                <div className="grid gap-3">
                  <Link href="/checkout" className="primary-button w-full">
                    {copyFor(language, glowmiaCopy.cart.checkout)}
                  </Link>
                  <button type="button" onClick={clearCart} className="secondary-button w-full">
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
    </>
  );
}
