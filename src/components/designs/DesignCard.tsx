import Link from 'next/link';
import Image from 'next/image';
import { Check, Heart, ShoppingCart } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import type { Design } from '@/src/data/designs';
import { copyFor, glowmiaCopy } from '@/src/content/glowmia';
import { useSitePreferencesContext } from '@/src/context/SitePreferencesContext';
import { useFavoritesContext } from '@/src/context/FavoritesContext';
import { useCartContext } from '@/src/context/CartContext';
import { cartSizes, type CartSize } from '@/src/hooks/useCart';
import { localizeText } from '@/src/data/designs';

type DesignCardProps = {
  design: Design;
  priority?: boolean;
};

export function DesignCard({ design, priority = false }: DesignCardProps) {
  const { language } = useSitePreferencesContext();
  const { isFavorite, toggleFavorite } = useFavoritesContext();
  const { addItem, hasItem } = useCartContext();
  const saved = isFavorite(design.id);
  const [burstToken, setBurstToken] = useState<number | null>(null);
  const [selectedSize, setSelectedSize] = useState<CartSize>('M');
  const [addedToken, setAddedToken] = useState<number | null>(null);

  const handleFavoriteToggle = () => {
    toggleFavorite(design.id);
    const nextToken = Date.now();
    setBurstToken(nextToken);
    window.setTimeout(() => {
      setBurstToken((currentToken) => (currentToken === nextToken ? null : currentToken));
    }, 620);
  };

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
    <motion.article whileHover={{ y: -4 }} transition={{ duration: 0.22, ease: 'easeOut' }} className="group relative">
      <button
        type="button"
        onClick={handleFavoriteToggle}
        className={`favorite-chip ${saved ? 'favorite-chip--active' : ''}`}
        aria-label={saved ? copyFor(language, glowmiaCopy.favorites.saved) : copyFor(language, glowmiaCopy.favorites.save)}
      >
        <Heart className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
      </button>

      <AnimatePresence>
        {burstToken ? (
          <motion.div
            key={burstToken}
            initial={{ opacity: 0, y: 6, scale: 0.8 }}
            animate={{ opacity: [0, 1, 0], y: [4, -14, -24], scale: [0.84, 1.05, 0.96] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.58, ease: 'easeOut' }}
            className="favorite-burst"
          >
            <Heart className="h-4 w-4 fill-current" />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Link href={`/designs/${design.slug}`} className="design-card">
        <div className="design-card__image">
          <div className="design-card__image-stage">
            <Image
              src={design.coverImage}
              alt={localizeText(language, design.name)}
              fill
              priority={priority}
              className="design-card__media transition duration-500 group-hover:scale-[1.015]"
              style={{ objectPosition: design.coverImagePosition ?? 'center top' }}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          </div>
        </div>

        <div className="space-y-2 px-1 pb-1 pt-4">
          <div className="space-y-1">
            <h3 className="text-xl font-semibold tracking-[-0.02em] text-[color:var(--text-primary)]">
              {localizeText(language, design.name)}
            </h3>
            <p className="text-sm text-[color:var(--text-muted)]">{localizeText(language, design.subtitle)}</p>
          </div>
          <p className="line-clamp-2 text-sm leading-7 text-[color:var(--text-muted)]">
            {localizeText(language, design.description)}
          </p>
        </div>
      </Link>

      <div className="cart-card-controls">
        <div className="cart-size-group" aria-label={copyFor(language, glowmiaCopy.cart.sizeLabel)}>
          <span className="cart-size-label">{copyFor(language, glowmiaCopy.cart.sizeLabel)}</span>
          <div className="cart-size-options">
            {cartSizes.map((size) => (
              <button
                key={`${design.id}-${size}`}
                type="button"
                onClick={() => setSelectedSize(size)}
                className={`cart-size-button ${selectedSize === size ? 'cart-size-button--active' : ''}`}
                aria-pressed={selectedSize === size}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        <button type="button" onClick={handleAddToCart} className={`primary-button cart-add-button ${addedToken ? 'cart-add-button--added' : ''}`}>
          {addedToken ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
          {addedToken || itemAlreadyInCart ? copyFor(language, glowmiaCopy.cart.added) : copyFor(language, glowmiaCopy.cart.addToCart)}
        </button>
      </div>
    </motion.article>
  );
}
