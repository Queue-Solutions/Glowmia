import { glowmiaCopy, copyFor } from '@/src/content/glowmia';
import { useSitePreferencesContext } from '@/src/context/SitePreferencesContext';

export function BrandIntro() {
  const { language } = useSitePreferencesContext();

  return (
    <section id="brand-intro" className="mx-auto w-full max-w-7xl px-6 py-8 md:px-10 md:py-10">
      <div className="grid gap-6 rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--surface-elevated)] px-6 py-8 shadow-[var(--shadow-soft)] md:grid-cols-[0.75fr_1.25fr] md:px-8">
        <p className="text-sm uppercase tracking-[0.28em] text-[color:var(--text-muted)]">Glowmia</p>
        <div className="space-y-4">
          <h2 className="font-display text-3xl leading-tight text-[color:var(--text-primary)] sm:text-4xl md:text-[2.75rem]">
            {copyFor(language, glowmiaCopy.home.introTitle)}
          </h2>
          <p className="max-w-3xl text-base leading-8 text-[color:var(--text-muted)] md:text-lg">
            {copyFor(language, glowmiaCopy.home.introBody)}
          </p>
        </div>
      </div>
    </section>
  );
}
