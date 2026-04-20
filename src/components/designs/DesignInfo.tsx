import Link from 'next/link';
import { Check, Heart, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import type { Design } from '@/src/data/designs';
import { glowmiaCopy, copyFor } from '@/src/content/glowmia';
import { useSitePreferencesContext } from '@/src/context/SitePreferencesContext';
import { useFavoritesContext } from '@/src/context/FavoritesContext';
import { useCartContext } from '@/src/context/CartContext';
import { cartSizes, type CartSize } from '@/src/hooks/useCart';
import { localizeText } from '@/src/data/designs';

export function DesignInfo({ design }: { design: Design }) {
  const { language } = useSitePreferencesContext();
  const { isFavorite, toggleFavorite } = useFavoritesContext();
  const { addItem, hasItem } = useCartContext();
  const saved = isFavorite(design.id);
  const [selectedSize, setSelectedSize] = useState<CartSize>('M');
  const [addedToken, setAddedToken] = useState<number | null>(null);

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

  const handleAddToCart = () => {
    addItem(design.id, selectedSize);
    const nextToken = Date.now();
    setAddedToken(nextToken);
    window.setTimeout(() => {
      setAddedToken((currentToken) => (currentToken === nextToken ? null : currentToken));
    }, 1500);
  };

  const itemAlreadyInCart = hasItem(design.id, selectedSize);

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

      <section className="cart-detail-panel">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-[color:var(--text-muted)]">
            {copyFor(language, glowmiaCopy.cart.sizeLabel)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {cartSizes.map((size) => (
              <button
                key={`${design.id}-detail-${size}`}
                type="button"
                onClick={() => setSelectedSize(size)}
                className={`cart-size-button cart-size-button--large ${selectedSize === size ? 'cart-size-button--active' : ''}`}
                aria-pressed={selectedSize === size}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={handleAddToCart} className={`primary-button flex-1 ${addedToken ? 'cart-add-button--added' : ''}`}>
            {addedToken ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
            {addedToken || itemAlreadyInCart ? copyFor(language, glowmiaCopy.cart.added) : copyFor(language, glowmiaCopy.cart.addToCart)}
          </button>
          <Link href="/cart" className="secondary-button flex-1">
            {copyFor(language, glowmiaCopy.cart.viewCart)}
          </Link>
        </div>
      </section>

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
