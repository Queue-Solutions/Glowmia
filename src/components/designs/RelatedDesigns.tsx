import { glowmiaCopy, copyFor } from '@/src/content/glowmia';
import { useSitePreferencesContext } from '@/src/context/SitePreferencesContext';
import type { Design } from '@/src/data/designs';
import { DesignGrid } from '@/src/components/designs/DesignGrid';

export function RelatedDesigns({ designs }: { designs: Design[] }) {
  const { language } = useSitePreferencesContext();

  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <h2 className="font-display text-4xl text-[color:var(--text-primary)]">
          {copyFor(language, glowmiaCopy.detail.relatedLabel)}
        </h2>
        <p className="text-base leading-8 text-[color:var(--text-muted)]">
          {copyFor(language, glowmiaCopy.detail.relatedDescription)}
        </p>
      </div>
      <DesignGrid designs={designs} />
    </section>
  );
}
