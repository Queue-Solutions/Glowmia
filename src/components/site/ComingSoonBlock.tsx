import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { glowmiaCopy, copyFor } from '@/src/content/glowmia';
import { useSitePreferencesContext } from '@/src/context/SitePreferencesContext';

export function ComingSoonBlock() {
  const { language } = useSitePreferencesContext();

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-6 py-16 text-center md:px-10 md:py-24">
      <span className="eyebrow-chip">
        <Sparkles className="h-4 w-4" />
        {copyFor(language, glowmiaCopy.agent.eyebrow)}
      </span>
      <div className="space-y-4">
        <h1 className="font-display text-5xl text-[color:var(--text-primary)] md:text-6xl">
          {copyFor(language, glowmiaCopy.agent.title)}
        </h1>
        <p className="mx-auto max-w-2xl text-lg leading-8 text-[color:var(--text-muted)]">
          {copyFor(language, glowmiaCopy.agent.description)}
        </p>
        <p className="mx-auto max-w-xl text-base leading-7 text-[color:var(--text-muted)]">
          {copyFor(language, glowmiaCopy.agent.note)}
        </p>
      </div>
      <div className="coming-soon-orb" />
      <Link href="/designs" className="secondary-button">
        {copyFor(language, glowmiaCopy.agent.cta)}
      </Link>
    </section>
  );
}
