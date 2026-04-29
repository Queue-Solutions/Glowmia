import Link from 'next/link';
import { ArrowRight, Bot, Sparkles, Wand2 } from 'lucide-react';
import { glowmiaCopy, copyFor } from '@/src/content/glowmia';
import { useSitePreferencesContext } from '@/src/context/SitePreferencesContext';

export function AgentTeaser() {
  const { language } = useSitePreferencesContext();

  const featureItems =
    language === 'ar'
      ? ['توصيات مخصصة', 'مقارنات سريعة', 'تعديل للتصميم']
      : ['Personalized picks', 'Fast comparisons', 'Design refinements'];

  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-10 md:px-10 md:py-14">
      <div className="grid gap-6 rounded-[2rem] border border-[color:var(--line)] bg-[linear-gradient(135deg,var(--surface-elevated),var(--accent-soft))] px-5 py-6 shadow-[var(--shadow-soft)] sm:px-6 sm:py-8 md:grid-cols-[1.05fr_0.95fr] md:items-center md:px-8">
        <div className="space-y-4">
          <span className="eyebrow-chip">
            {copyFor(language, glowmiaCopy.home.agentEyebrow)}
          </span>

          <h2 className="font-display text-3xl text-[color:var(--text-primary)] sm:text-4xl md:text-5xl">
            {copyFor(language, glowmiaCopy.home.agentTitle)}
          </h2>

          <p className="max-w-2xl text-base leading-7 text-[color:var(--text-muted)] sm:text-lg sm:leading-8">
            {copyFor(language, glowmiaCopy.home.agentDescription)}
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href="/agent" className="primary-button w-full justify-center sm:w-auto">
              {copyFor(language, glowmiaCopy.home.agentCta)}
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link href="/designs" className="secondary-button w-full justify-center sm:w-auto">
              {language === 'ar' ? 'تصفحي التصاميم أولًا' : 'Browse designs first'}
            </Link>
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-[color:var(--line)] bg-[color:var(--surface-elevated)]/80 p-4 backdrop-blur sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-[color:var(--text-primary)]">
              <Bot className="h-5 w-5" />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
                Glowmia Stylist
              </p>

              <p className="text-sm leading-7 text-[color:var(--text-muted)]">
                {language === 'ar'
                  ? 'اطلبي لوكات مناسبة، قارني بين الموديلات، واحفظي التصميم المعدل بخطوات واضحة.'
                  : 'Ask for matched looks, compare moods, and save a refined version of any design in a few steps.'}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {featureItems.map((item, index) => {
              const Icon = index === 0 ? Sparkles : index === 1 ? ArrowRight : Wand2;

              return (
                <div
                  key={item}
                  className="flex items-center gap-2 rounded-[1.1rem] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-3 text-sm text-[color:var(--text-primary)]"
                >
                  <Icon className="h-4 w-4 shrink-0 text-[color:var(--accent)]" />
                  <span>{item}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}