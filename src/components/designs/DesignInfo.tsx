import { Heart } from 'lucide-react';
import type { Design } from '@/src/data/designs';
import { glowmiaCopy, copyFor } from '@/src/content/glowmia';
import { useSitePreferencesContext } from '@/src/context/SitePreferencesContext';
import { useFavoritesContext } from '@/src/context/FavoritesContext';
import { localizeText } from '@/src/data/designs';

export function DesignInfo({ design }: { design: Design }) {
  const { language } = useSitePreferencesContext();
  const { isFavorite, toggleFavorite } = useFavoritesContext();
  const saved = isFavorite(design.id);

  const details = [
    ['category', design.categoryLabel],
    ['occasion', design.occasion],
    ['color', design.color],
    ['sleeveType', design.sleeveType],
    ['length', design.length],
    ['style', design.style],
    ['fabric', design.fabric],
    ['fit', design.fit],
  ] as const;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <p className="text-sm uppercase tracking-[0.28em] text-[color:var(--text-muted)]">
          {localizeText(language, design.subtitle)}
        </p>
        <div className="space-y-3">
          <h1 className="font-display text-5xl leading-none text-[color:var(--text-primary)] md:text-6xl">
            {localizeText(language, design.name)}
          </h1>
          <p className="max-w-xl text-lg leading-8 text-[color:var(--text-muted)]">
            {localizeText(language, design.description)}
          </p>
        </div>
        <button type="button" onClick={() => toggleFavorite(design.id)} className={`secondary-button ${saved ? 'secondary-button--active' : ''}`}>
          <Heart className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
          {saved ? copyFor(language, glowmiaCopy.favorites.saved) : copyFor(language, glowmiaCopy.favorites.save)}
        </button>
      </div>

      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.24em] text-[color:var(--text-muted)]">
          {copyFor(language, glowmiaCopy.detail.storyLabel)}
        </p>
        <p className="text-base leading-8 text-[color:var(--text-muted)]">{localizeText(language, design.story)}</p>
      </div>

      <div className="space-y-4">
        <p className="text-sm uppercase tracking-[0.24em] text-[color:var(--text-muted)]">
          {copyFor(language, glowmiaCopy.detail.detailsLabel)}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {details.map(([key, value]) => (
            <div key={key} className="rounded-[1.4rem] border border-[color:var(--line)] bg-[color:var(--surface-elevated)] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
                {copyFor(language, glowmiaCopy.detail.attributes[key])}
              </p>
              <p className="mt-2 text-base font-medium text-[color:var(--text-primary)]">{localizeText(language, value)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
