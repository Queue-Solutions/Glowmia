import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { CheckCircle2, Loader2, ShoppingCart, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState, type FormEvent } from 'react';
import type { GetStaticProps, InferGetStaticPropsType } from 'next';
import { SiteLayout } from '@/src/components/layout/SiteLayout';
import { copyFor, glowmiaCopy } from '@/src/content/glowmia';
import { localizeText, type Design } from '@/src/data/designs';
import { getAllDesignsFromSupabase } from '@/src/services/dresses';
import { useSitePreferencesContext } from '@/src/context/SitePreferencesContext';
import { useCartContext } from '@/src/context/CartContext';
import type { CartEntry } from '@/src/hooks/useCart';
import { countryCodeOptions } from '@/src/data/countryCodes';

type CheckoutPageProps = {
  designs: Design[];
};

type CheckoutResponse = {
  ok?: boolean;
  orderId?: string;
  error?: string;
};

export const getStaticProps: GetStaticProps<CheckoutPageProps> = async () => {
  const designs = await getAllDesignsFromSupabase();

  return {
    props: {
      designs,
    },
    revalidate: 60,
  };
};

export default function CheckoutPage({ designs }: InferGetStaticPropsType<typeof getStaticProps>) {
  const { language } = useSitePreferencesContext();
  const { entries, hydrated, clearCart } = useCartContext();
  const [formState, setFormState] = useState({
    name: '',
    phoneCode: '+20',
    phone: '',
    email: '',
    country: '',
  });
  const [submitState, setSubmitState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const [orderId, setOrderId] = useState('');

  const designsById = useMemo(
    () => new Map(designs.map((design) => [design.id, design])),
    [designs],
  );

  const checkoutItems = useMemo(
    () =>
      entries
        .map((entry) => ({
          entry,
          design: designsById.get(entry.designId) ?? null,
        }))
        .filter((item): item is { entry: CartEntry; design: Design } => Boolean(item.design)),
    [designsById, entries],
  );

  const totalQuantity = useMemo(
    () => checkoutItems.reduce((sum, item) => sum + item.entry.quantity, 0),
    [checkoutItems],
  );
  const hasItems = hydrated && checkoutItems.length > 0;

  const updateField = (field: keyof typeof formState, value: string) => {
    setFormState((current) => ({ ...current, [field]: value }));
    setSubmitState('idle');
    setError('');
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const hasAllFields = Object.values(formState).every((value) => value.trim());
    const normalizedLocalPhone = formState.phone.replace(/[\s()-]/g, '').replace(/^0+/, '');
    const fullPhone = `${formState.phoneCode}${normalizedLocalPhone}`;

    if (!hasAllFields || checkoutItems.length === 0) {
      setSubmitState('error');
      setError(copyFor(language, glowmiaCopy.checkout.requiredError));
      return;
    }

    setSubmitState('sending');
    setError('');

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer: {
            ...formState,
            phone: fullPhone,
          },
          items: checkoutItems.map(({ entry }) => ({
            designId: entry.designId,
            size: entry.size,
            quantity: entry.quantity,
          })),
        }),
      });
      const data = (await response.json()) as CheckoutResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || copyFor(language, glowmiaCopy.checkout.requiredError));
      }

      setOrderId(data.orderId || '');
      setSubmitState('success');
      clearCart();
    } catch (submitError) {
      setSubmitState('error');
      setError(submitError instanceof Error ? submitError.message : copyFor(language, glowmiaCopy.checkout.requiredError));
    }
  }

  return (
    <>
      <Head>
        <title>{`Glowmia | ${copyFor(language, glowmiaCopy.checkout.title)}`}</title>
        <meta name="description" content={copyFor(language, glowmiaCopy.checkout.description)} />
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
                {copyFor(language, glowmiaCopy.checkout.title)}
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-[color:var(--text-muted)]">
                {copyFor(language, glowmiaCopy.checkout.description)}
              </p>
            </div>

            <Link href="/cart" className="secondary-button w-full justify-center sm:w-auto">
              {copyFor(language, glowmiaCopy.cart.title)}
            </Link>
          </div>

          {hasItems ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start">
              <section className="grid gap-4">
                <div className="checkout-section-heading">
                  <h2>{copyFor(language, glowmiaCopy.checkout.selectedTitle)}</h2>
                  <span>
                    {copyFor(language, glowmiaCopy.cart.itemCount)}: {totalQuantity}
                  </span>
                </div>

                {checkoutItems.map(({ entry, design }) => (
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
                          <span className="cart-size-pill">
                            {copyFor(language, glowmiaCopy.cart.quantity)} {entry.quantity}
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
                    </div>
                  </article>
                ))}
              </section>

              <form onSubmit={handleSubmit} className="checkout-form-panel">
                <div className="space-y-2">
                  <p className="text-sm uppercase tracking-[0.24em] text-[color:var(--text-muted)]">
                    {copyFor(language, glowmiaCopy.checkout.formTitle)}
                  </p>
                  <p className="text-sm leading-7 text-[color:var(--text-muted)]">
                    {copyFor(language, glowmiaCopy.checkout.formDescription)}
                  </p>
                </div>

                <label className="checkout-field">
                  <span>{copyFor(language, glowmiaCopy.checkout.name)}</span>
                  <input
                    value={formState.name}
                    onChange={(event) => updateField('name', event.target.value)}
                    placeholder={copyFor(language, glowmiaCopy.checkout.namePlaceholder)}
                    className="field-input"
                  />
                </label>

                <label className="checkout-field">
                  <span>{copyFor(language, glowmiaCopy.checkout.phone)}</span>
                  <div className="checkout-phone-grid">
                    <select
                      value={formState.phoneCode}
                      onChange={(event) => updateField('phoneCode', event.target.value)}
                      className="field-input checkout-code-select"
                      aria-label={copyFor(language, glowmiaCopy.checkout.phoneCode)}
                    >
                      {countryCodeOptions.map((option) => (
                        <option key={`${option.iso}-${option.dialCode}`} value={option.dialCode}>
                          {option.name} ({option.dialCode})
                        </option>
                      ))}
                    </select>
                    <input
                      value={formState.phone}
                      onChange={(event) => updateField('phone', event.target.value)}
                      placeholder={copyFor(language, glowmiaCopy.checkout.phonePlaceholder)}
                      className="field-input"
                      inputMode="tel"
                    />
                  </div>
                </label>

                <label className="checkout-field">
                  <span>{copyFor(language, glowmiaCopy.checkout.email)}</span>
                  <input
                    value={formState.email}
                    onChange={(event) => updateField('email', event.target.value)}
                    placeholder={copyFor(language, glowmiaCopy.checkout.emailPlaceholder)}
                    className="field-input"
                    inputMode="email"
                  />
                </label>

                <label className="checkout-field">
                  <span>{copyFor(language, glowmiaCopy.checkout.country)}</span>
                  <input
                    value={formState.country}
                    onChange={(event) => updateField('country', event.target.value)}
                    placeholder={copyFor(language, glowmiaCopy.checkout.countryPlaceholder)}
                    className="field-input"
                  />
                </label>

                {submitState === 'error' && error ? <p className="checkout-error">{error}</p> : null}

                <button type="submit" className="primary-button w-full" disabled={submitState === 'sending'}>
                  {submitState === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {submitState === 'sending' ? copyFor(language, glowmiaCopy.checkout.submitting) : copyFor(language, glowmiaCopy.checkout.submit)}
                </button>
              </form>
            </div>
          ) : (
            <div className="cart-empty-state">
              <div className="cart-empty-state__icon">
                <ShoppingCart className="h-10 w-10" />
              </div>
              <div className="space-y-3">
                <h2 className="font-display text-4xl text-[color:var(--text-primary)]">
                  {copyFor(language, glowmiaCopy.checkout.emptyTitle)}
                </h2>
                <p className="mx-auto max-w-xl text-base leading-8 text-[color:var(--text-muted)]">
                  {copyFor(language, glowmiaCopy.checkout.emptyDescription)}
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
        {submitState === 'success' ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="checkout-modal">
            <button type="button" className="checkout-modal__backdrop" onClick={() => setSubmitState('idle')} aria-label={copyFor(language, glowmiaCopy.checkout.close)} />
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="checkout-modal__panel"
            >
              <button type="button" onClick={() => setSubmitState('idle')} className="checkout-modal__close" aria-label={copyFor(language, glowmiaCopy.checkout.close)}>
                <X className="h-4 w-4" />
              </button>
              <div className="checkout-modal__icon">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div className="space-y-3 text-center">
                <h2 className="font-display text-4xl text-[color:var(--text-primary)]">
                  {copyFor(language, glowmiaCopy.checkout.thankYouTitle)}
                </h2>
                <p className="text-base leading-8 text-[color:var(--text-muted)]">
                  {copyFor(language, glowmiaCopy.checkout.thankYouDescription)}
                </p>
              </div>
              {orderId ? (
                <p className="checkout-order-reference">
                  {copyFor(language, glowmiaCopy.checkout.orderReference)}: {orderId}
                </p>
              ) : null}
              <Link href="/designs" className="primary-button">
                {copyFor(language, glowmiaCopy.cart.continueShopping)}
              </Link>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
