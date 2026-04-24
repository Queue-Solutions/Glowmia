import { useState } from 'react';
import { useSitePreferencesContext } from '@/src/context/SitePreferencesContext';

const newsletterCopy = {
  en: {
    eyebrow: 'Private updates',
    title: 'Join the Glowmia list.',
    description: 'Receive weekly announcements, new design drops, and a soft reminder to continue shopping.',
    placeholder: 'Email address',
    submit: 'Subscribe',
    submitting: 'Subscribing...',
    success: 'You are subscribed to Glowmia updates.',
    alreadySubscribed: 'You are already on the Glowmia list.',
    invalid: 'Please enter a valid email address.',
    error: 'We could not subscribe you right now. Please try again shortly.',
  },
  ar: {
    eyebrow: 'تحديثات خاصة',
    title: 'انضمي إلى قائمة Glowmia.',
    description: 'استلمي الإعلانات الأسبوعية والتصاميم الجديدة وتذكيراً لطيفاً لمتابعة التسوق.',
    placeholder: 'البريد الإلكتروني',
    submit: 'اشتراك',
    submitting: 'جارٍ الاشتراك...',
    success: 'تم اشتراكك في تحديثات Glowmia.',
    alreadySubscribed: 'أنتِ مشتركة بالفعل في قائمة Glowmia.',
    invalid: 'يرجى إدخال بريد إلكتروني صحيح.',
    error: 'تعذر إتمام الاشتراك الآن. حاولي مرة أخرى بعد قليل.',
  },
} as const;

type FormState = {
  kind: 'idle' | 'success' | 'error';
  message: string;
};

export function NewsletterSignup() {
  const { language } = useSitePreferencesContext();
  const copy = newsletterCopy[language];
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [state, setState] = useState<FormState>({ kind: 'idle', message: '' });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setState({ kind: 'error', message: copy.invalid });
      return;
    }

    setIsSubmitting(true);
    setState({ kind: 'idle', message: '' });

    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        setState({
          kind: 'error',
          message: payload?.error || copy.error,
        });
        return;
      }

      setEmail('');
      setState({
        kind: 'success',
        message: payload.alreadySubscribed ? copy.alreadySubscribed : copy.success,
      });
    } catch (error) {
      console.error('[Newsletter Signup]', error);
      setState({ kind: 'error', message: copy.error });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="site-footer__newsletter" aria-labelledby="newsletter-signup-title">
      <div className="site-footer__newsletter-copy">
        <p className="site-footer__newsletter-eyebrow">{copy.eyebrow}</p>
        <h2 id="newsletter-signup-title" className="site-footer__newsletter-title font-display">
          {copy.title}
        </h2>
        <p className="site-footer__newsletter-description">{copy.description}</p>
      </div>

      <form onSubmit={handleSubmit} className="site-footer__newsletter-form">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={copy.placeholder}
          autoComplete="email"
          className="site-footer__newsletter-input"
          aria-label={copy.placeholder}
          disabled={isSubmitting}
        />
        <button type="submit" className="primary-button site-footer__newsletter-button" disabled={isSubmitting}>
          {isSubmitting ? copy.submitting : copy.submit}
        </button>
      </form>

      {state.kind !== 'idle' ? (
        <p
          className={
            state.kind === 'success'
              ? 'site-footer__newsletter-status site-footer__newsletter-status--success'
              : 'site-footer__newsletter-status site-footer__newsletter-status--error'
          }
          role="status"
        >
          {state.message}
        </p>
      ) : null}
    </section>
  );
}
