import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { DesignGrid } from '@/src/components/designs/DesignGrid';
import { glowmiaCopy, copyFor } from '@/src/content/glowmia';
import { useSitePreferencesContext } from '@/src/context/SitePreferencesContext';
import type { Design } from '@/src/data/designs';

export function FeaturedDesigns({ designs }: { designs: Design[] }) {
  const { language } = useSitePreferencesContext();

  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-10 md:px-10 md:py-12">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <span className="eyebrow-chip">{copyFor(language, glowmiaCopy.home.featureLabel)}</span>
          <h2 className="font-display text-4xl text-[color:var(--text-primary)] md:text-5xl">
            {copyFor(language, glowmiaCopy.home.featureTitle)}
          </h2>
          <p className="max-w-2xl text-base leading-8 text-[color:var(--text-muted)] md:text-lg">
            {copyFor(language, glowmiaCopy.home.featureDescription)}
          </p>
        </div>

        <Link href="/designs" className="secondary-button">
          {copyFor(language, glowmiaCopy.home.featureCta)}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {designs.length > 0 ? (
        <DesignGrid designs={designs} priorityCount={3} />
      ) : (
        <div className="rounded-[2rem] border border-dashed border-[color:var(--line)] px-6 py-12 text-center">
          <p className="text-base leading-7 text-[color:var(--text-muted)]">
            {copyFor(language, glowmiaCopy.designs.emptyDescription)}
          </p>
        </div>
      )}
    </section>
  );
}
