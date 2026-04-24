import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { CheckCircle2, Loader2, ShoppingCart, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { GetStaticProps, InferGetStaticPropsType } from 'next';
import { SiteLayout } from '@/src/components/layout/SiteLayout';
import { copyFor, glowmiaCopy } from '@/src/content/glowmia';
import { localizeText, type Design } from '@/src/data/designs';
import { fetchSavedDesign, resolveViewerIdentity, type SavedDesignEntry } from '@/src/services/engagement';
import { getAllDesignsFromSupabase } from '@/src/services/dresses';
import { useSitePreferencesContext } from '@/src/context/SitePreferencesContext';
import { useCartContext } from '@/src/context/CartContext';
import type { CartEntry } from '@/src/hooks/useCart';
import { countryCodeOptions } from '@/src/data/countryCodes';
import {
  captureMailingEmail,
  getStoredContactEmail,
  isValidClientEmail,
  normalizeClientEmail,
  setStoredContactEmail,
} from '@/src/services/mailing';

type CheckoutPageProps = {
  designs: Design[];
};

type CheckoutResponse = {
  ok?: boolean;
  orderId?: string;
  error?: string;
};

type DisplayCheckoutItem =
  | {
      key: string;
      kind: 'cart';
      design: Design;
      imageUrl: string;
      href: string;
      designName: string;
      description: string;
      size: string | null;
      quantity: number;
    }
  | {
      key: string;
      kind: 'saved';
      design: Design | null;
      savedDesign: SavedDesignEntry;
      imageUrl: string;
      href: string | null;
      designName: string;
      description: string;
      size: string | null;
      quantity: number;
    };

const FORM_SUBMIT_ACTION = 'https://formsubmit.co/queuesolutions25@gmail.com';
const FORM_SUBMIT_FRAME = 'glowmia-formsubmit-frame';
const SUCCESS_REDIRECT_DELAY_MS = 500;

function joinOrderFieldValues(values: Array<string | null | undefined>) {
  return values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)).join('\n');
}

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
  const router = useRouter();
  const { language } = useSitePreferencesContext();
  const { entries, hydrated, clearCart } = useCartContext();
  const [formState, setFormState] = useState({
    name: '',
    phoneCode: '+20',
    phone: '',
    email: '',
    address: '',
    city: '',
    notes: '',
  });
  const [savedDesign, setSavedDesign] = useState<SavedDesignEntry | null>(null);
  const [savedDesignState, setSavedDesignState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [savedDesignError, setSavedDesignError] = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const [orderId, setOrderId] = useState('');

  const designsById = useMemo(() => new Map(designs.map((design) => [design.id, design])), [designs]);

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

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    const prefillName = typeof router.query.prefillName === 'string' ? router.query.prefillName.trim() : '';
    const prefillPhone = typeof router.query.prefillPhone === 'string' ? router.query.prefillPhone.trim() : '';
    const prefillEmail =
      typeof router.query.prefillEmail === 'string' ? normalizeClientEmail(router.query.prefillEmail) : '';
    const storedEmail = getStoredContactEmail();

    if (!prefillName && !prefillPhone && !prefillEmail && !storedEmail) {
      return;
    }

    setFormState((current) => ({
      ...current,
      name: current.name || prefillName,
      phone: current.phone || prefillPhone,
      email: current.email || prefillEmail || storedEmail,
    }));
  }, [router.isReady, router.query.prefillEmail, router.query.prefillName, router.query.prefillPhone]);

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    const success = router.query.success === 'true';
    const queryOrderId = typeof router.query.orderId === 'string' ? router.query.orderId.trim() : '';

    if (!success) {
      return;
    }

    setSubmitState('success');

    if (queryOrderId) {
      setOrderId(queryOrderId);
    }
  }, [router.isReady, router.query.orderId, router.query.success]);

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

  useEffect(() => {
    if (!savedDesign?.customerEmail) {
      return;
    }

    setFormState((current) => ({
      ...current,
      email: current.email || normalizeClientEmail(savedDesign.customerEmail || ''),
    }));
  }, [savedDesign?.customerEmail]);

  const displayItems = useMemo(() => {
    const cartDisplayItems: DisplayCheckoutItem[] = checkoutItems.map(({ entry, design }) => ({
      key: `${entry.designId}-${entry.size}`,
      kind: 'cart',
      design,
      imageUrl: design.coverImage,
      href: `/designs/${design.slug}`,
      designName: localizeText(language, design.name),
      description: localizeText(language, design.description),
      size: entry.size,
      quantity: entry.quantity,
    }));

    if (!savedDesign) {
      return cartDisplayItems;
    }

    const originalDress = designsById.get(savedDesign.dressId) ?? null;
    const savedDesignDisplayItem: DisplayCheckoutItem = {
      key: `saved-design-${savedDesign.id}`,
      kind: 'saved',
      design: originalDress,
      savedDesign,
      imageUrl: savedDesign.editedImageUrl || savedDesign.originalImageUrl,
      href: originalDress ? `/designs/${originalDress.slug}` : null,
      designName: savedDesign.designName || (originalDress ? localizeText(language, originalDress.name) : language === 'ar' ? 'تصميم محفوظ' : 'Saved design'),
      description: savedDesign.prompt || (originalDress ? localizeText(language, originalDress.description) : ''),
      size: null,
      quantity: 1,
    };

    return [savedDesignDisplayItem, ...cartDisplayItems];
  }, [checkoutItems, designsById, language, savedDesign]);

  const totalQuantity = useMemo(() => displayItems.reduce((sum, item) => sum + item.quantity, 0), [displayItems]);
  const hasItems = hydrated && (displayItems.length > 0 || savedDesignState === 'loading');
  const reminderItems = useMemo(
    () =>
      displayItems.map((item) => ({
        designId: item.kind === 'saved' ? item.savedDesign.dressId : item.design.id,
        designName: item.designName,
        imageUrl: item.imageUrl,
        quantity: item.quantity,
        size: item.size,
        href: item.href,
      })),
    [displayItems],
  );

  useEffect(() => {
    setStoredContactEmail(formState.email);
  }, [formState.email]);

  useEffect(() => {
    if (!isValidClientEmail(formState.email) || reminderItems.length === 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void captureMailingEmail({
        email: formState.email,
        source: 'checkout',
        items: reminderItems,
        metadata: {
          saved_design_id: savedDesign?.id ?? null,
          item_count: reminderItems.length,
        },
      }).catch(() => {});
    }, 700);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [formState.email, reminderItems, savedDesign?.id]);

  const updateField = (field: keyof typeof formState, value: string) => {
    setFormState((current) => ({ ...current, [field]: value }));
    setSubmitState('idle');
    setError('');
  };

  const submitOrderEmail = (fullPhone: string) => {
    if (typeof document === 'undefined') {
      throw new Error('Form submission is only available in the browser.');
    }

    let iframe = document.querySelector(`iframe[name="${FORM_SUBMIT_FRAME}"]`) as HTMLIFrameElement | null;

    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.name = FORM_SUBMIT_FRAME;
      iframe.title = FORM_SUBMIT_FRAME;
      iframe.setAttribute('aria-hidden', 'true');
      iframe.tabIndex = -1;
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
    }

    const form = document.createElement('form');
    form.action = FORM_SUBMIT_ACTION;
    form.method = 'POST';
    form.target = FORM_SUBMIT_FRAME;
    form.style.display = 'none';

    const fields = {
      customer_name: formState.name,
      phone: fullPhone,
      customer_email: normalizeClientEmail(formState.email),
      address: formState.address,
      city: formState.city,
      dress_id: joinOrderFieldValues(
        displayItems.map((item) => {
          if (item.kind === 'saved') {
            return item.savedDesign.dressId;
          }

          return item.design.id;
        }),
      ),
      dress_name: joinOrderFieldValues(displayItems.map((item) => item.designName)),
      size: joinOrderFieldValues(displayItems.map((item) => item.size || 'custom')),
      quantity: joinOrderFieldValues(displayItems.map((item) => String(item.quantity))),
      notes: formState.notes,
      edited_image_url: savedDesign?.editedImageUrl || '',
      saved_design_id: savedDesign?.id || '',
      _subject: 'New Glowmia Order',
      _template: 'table',
    };

    Object.entries(fields).forEach(([key, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = value || '';
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();

    window.setTimeout(() => {
      form.remove();
    }, 1000);
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = normalizeClientEmail(formState.email);
    const requiredFields = [formState.name, formState.phone, normalizedEmail, formState.address, formState.city];
    const hasAllFields = requiredFields.every((value) => value.trim());
    const normalizedLocalPhone = formState.phone.replace(/[\s()-]/g, '').replace(/^0+/, '');
    const fullPhone = `${formState.phoneCode}${normalizedLocalPhone}`;

    if (!hasAllFields || !isValidClientEmail(normalizedEmail) || displayItems.length === 0) {
      setSubmitState('error');
      setError(copyFor(language, glowmiaCopy.checkout.requiredError));
      return;
    }

    setSubmitState('sending');
    setError('');

    try {
      const identity = await resolveViewerIdentity();
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer: {
            name: formState.name,
            phone: fullPhone,
            email: normalizedEmail,
            address: formState.address,
            city: formState.city,
          },
          notes: formState.notes,
          userId: identity.userId,
          guestId: identity.guestId,
          items: checkoutItems.map(({ entry }) => ({
            designId: entry.designId,
            size: entry.size,
            quantity: entry.quantity,
          })),
          savedDesignId: savedDesign?.id || null,
        }),
      });
      const data = (await response.json()) as CheckoutResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || copyFor(language, glowmiaCopy.checkout.requiredError));
      }

      try {
        submitOrderEmail(fullPhone);
      } catch (emailError) {
        console.error('Glowmia order email failed:', emailError instanceof Error ? emailError.message : 'Unable to submit the order email.');
      }

      setOrderId(data.orderId || '');
      setSubmitState('success');
      clearCart();
      window.setTimeout(() => {
        void router.replace(
          {
            pathname: '/checkout',
            query: {
              success: 'true',
              orderId: data.orderId || undefined,
            },
          },
          undefined,
          { shallow: true },
        );
      }, SUCCESS_REDIRECT_DELAY_MS);
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

          {savedDesignState === 'error' && savedDesignError ? <p className="checkout-error">{savedDesignError}</p> : null}

          {hasItems ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start">
              <section className="grid gap-4">
                <div className="checkout-section-heading">
                  <h2>{copyFor(language, glowmiaCopy.checkout.selectedTitle)}</h2>
                  <span>
                    {copyFor(language, glowmiaCopy.cart.itemCount)}: {totalQuantity}
                  </span>
                </div>

                {savedDesignState === 'loading' && displayItems.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-[color:var(--line)] bg-[color:var(--surface-elevated)] px-6 py-10 text-center text-sm text-[color:var(--text-muted)]">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {language === 'ar' ? 'جارٍ تحميل التصميم المحفوظ...' : 'Loading saved design...'}
                    </span>
                  </div>
                ) : null}

                {displayItems.map((item) => {
                  const media = (
                    <div className="cart-line-item__media-stage">
                      {item.kind === 'saved' ? (
                        <img src={item.imageUrl} alt={item.designName} className="cart-line-item__media-image" />
                      ) : (
                        <Image
                          src={item.imageUrl}
                          alt={item.designName}
                          fill
                          className="cart-line-item__media-image"
                          sizes="(max-width: 768px) 38vw, 12rem"
                        />
                      )}
                    </div>
                  );

                  return (
                    <article key={item.key} className="cart-line-item">
                      {item.href ? (
                        <Link href={item.href} className="cart-line-item__media">
                          {media}
                        </Link>
                      ) : (
                        <div className="cart-line-item__media">{media}</div>
                      )}

                      <div className="cart-line-item__body">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {item.design ? (
                              <span className="eyebrow-chip !px-3 !py-2 !text-[0.65rem]">
                                {localizeText(language, item.design.categoryLabel)}
                              </span>
                            ) : null}
                            {item.size ? (
                              <span className="cart-size-pill">
                                {copyFor(language, glowmiaCopy.cart.sizeLabel)} {item.size}
                              </span>
                            ) : null}
                            <span className="cart-size-pill">
                              {copyFor(language, glowmiaCopy.cart.quantity)} {item.quantity}
                            </span>
                          </div>

                          <div>
                            {item.href ? (
                              <Link href={item.href} className="text-2xl font-semibold tracking-[-0.02em] text-[color:var(--text-primary)] transition hover:text-[color:var(--accent)]">
                                {item.designName}
                              </Link>
                            ) : (
                              <p className="text-2xl font-semibold tracking-[-0.02em] text-[color:var(--text-primary)]">{item.designName}</p>
                            )}
                            {item.description ? (
                              <p className="mt-2 line-clamp-2 text-sm leading-7 text-[color:var(--text-muted)]">{item.description}</p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
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
                    autoComplete="email"
                  />
                </label>

                <label className="checkout-field">
                  <span>{copyFor(language, glowmiaCopy.checkout.address)}</span>
                  <input
                    value={formState.address}
                    onChange={(event) => updateField('address', event.target.value)}
                    placeholder={copyFor(language, glowmiaCopy.checkout.addressPlaceholder)}
                    className="field-input"
                  />
                </label>

                <label className="checkout-field">
                  <span>{copyFor(language, glowmiaCopy.checkout.city)}</span>
                  <input
                    value={formState.city}
                    onChange={(event) => updateField('city', event.target.value)}
                    placeholder={copyFor(language, glowmiaCopy.checkout.cityPlaceholder)}
                    className="field-input"
                  />
                </label>

                <label className="checkout-field">
                  <span>{copyFor(language, glowmiaCopy.checkout.notes)}</span>
                  <textarea
                    value={formState.notes}
                    onChange={(event) => updateField('notes', event.target.value)}
                    placeholder={copyFor(language, glowmiaCopy.checkout.notesPlaceholder)}
                    className="field-input min-h-[7rem] resize-y"
                    rows={4}
                  />
                </label>

                {submitState === 'error' && error ? <p className="checkout-error">{error}</p> : null}

                <button type="submit" className="primary-button w-full" disabled={submitState === 'sending' || savedDesignState === 'loading'}>
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
