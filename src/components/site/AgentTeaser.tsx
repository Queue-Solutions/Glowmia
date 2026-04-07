import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { glowmiaCopy, copyFor } from '@/src/content/glowmia';
import { useSitePreferencesContext } from '@/src/context/SitePreferencesContext';

export function AgentTeaser() {
  const { language } = useSitePreferencesContext();

  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-10 md:px-10 md:py-14">
      <div className="grid gap-8 rounded-[2rem] border border-[color:var(--line)] bg-[linear-gradient(135deg,var(--surface-elevated),var(--accent-soft))] px-6 py-8 md:grid-cols-[1.1fr_0.9fr] md:items-center md:px-8">
        <div className="space-y-4">
          <span className="eyebrow-chip">{copyFor(language, glowmiaCopy.home.agentEyebrow)}</span>
          <h2 className="font-display text-4xl text-[color:var(--text-primary)] md:text-5xl">
            {copyFor(language, glowmiaCopy.home.agentTitle)}
          </h2>
          <p className="max-w-2xl text-lg leading-8 text-[color:var(--text-muted)]">
            {copyFor(language, glowmiaCopy.home.agentDescription)}
          </p>
        </div>

        <div className="flex justify-start md:justify-end">
          <Link href="/agent" className="primary-button">
            {copyFor(language, glowmiaCopy.home.agentCta)}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
