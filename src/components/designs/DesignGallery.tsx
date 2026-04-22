import { useRef, useState, type PointerEvent } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Design } from '@/src/data/designs';
import { glowmiaCopy, copyFor } from '@/src/content/glowmia';
import { useSitePreferencesContext } from '@/src/context/SitePreferencesContext';
import { useFavoritesContext } from '@/src/context/FavoritesContext';
import { localizeText } from '@/src/data/designs';

export function DesignGallery({ design }: { design: Design }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [likeBurstToken, setLikeBurstToken] = useState<number | null>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const { language } = useSitePreferencesContext();
  const { isFavorite, toggleFavorite } = useFavoritesContext();

  const baseViews = [
    {
      id: `${design.id}-cover`,
      image: design.coverImage,
      label: language === 'ar' ? 'الأمام' : 'Front View',
      objectPosition: 'center top',
    },
  ];

  const viewLabels =
    language === 'ar'
      ? ['الجانب', 'الخلف']
      : ['Side View', 'Back View'];

  const additionalViews = design.galleryImages
    .filter((image) => image !== design.coverImage)
    .map((image, index) => ({
      id: `${design.id}-extra-${index + 1}`,
      image,
      label: viewLabels[index] ?? (language === 'ar' ? `عرض إضافي ${index + 1}` : `Additional ${index + 1}`),
      objectPosition: 'center center',
    }));

  const selectableViews = [...baseViews, ...additionalViews];
  const activeView = selectableViews[activeIndex] ?? selectableViews[0];
  const hasMultipleViews = selectableViews.length > 1;

  const showPreviousImage = () => {
    setActiveIndex((current) => (current - 1 + selectableViews.length) % selectableViews.length);
  };

  const showNextImage = () => {
    setActiveIndex((current) => (current + 1) % selectableViews.length);
  };

  const triggerLikeBurst = () => {
    const nextToken = Date.now();
    setLikeBurstToken(nextToken);
    window.setTimeout(() => {
      setLikeBurstToken((currentToken) => (currentToken === nextToken ? null : currentToken));
    }, 720);
  };

  const likeDesign = () => {
    if (!isFavorite(design.id)) {
      toggleFavorite(design.id);
    }

    triggerLikeBurst();
  };

  const handleGalleryPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch' || (event.target as HTMLElement).closest('button')) {
      return;
    }

    const now = Date.now();
    const lastTap = lastTapRef.current;
    const x = event.clientX;
    const y = event.clientY;

    if (lastTap && now - lastTap.time < 320 && Math.hypot(x - lastTap.x, y - lastTap.y) < 28) {
      lastTapRef.current = null;
      likeDesign();
      return;
    }

    lastTapRef.current = { time: now, x, y };
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.24em] text-[color:var(--text-muted)]">
          {copyFor(language, glowmiaCopy.detail.galleryLabel)}
        </p>
        <div className="detail-gallery__frame">
          <div className="detail-gallery__stage" onPointerUp={handleGalleryPointerUp}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className="absolute inset-0"
              >
                <Image
                  src={activeView.image}
                  alt={localizeText(language, design.name)}
                  fill
                  priority={activeIndex === 0}
                  className="detail-gallery__media"
                  style={{ objectPosition: activeView.objectPosition }}
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </motion.div>
            </AnimatePresence>
            <AnimatePresence>
              {likeBurstToken ? (
                <motion.div
                  key={likeBurstToken}
                  className="detail-gallery__like-burst"
                  initial={{ opacity: 0, scale: 0.72, y: 10 }}
                  animate={{ opacity: [0, 1, 0], scale: [0.72, 1.18, 1], y: [10, -4, -18] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.68, ease: 'easeOut' }}
                >
                  <Heart className="h-12 w-12 fill-current" />
                </motion.div>
              ) : null}
            </AnimatePresence>
            {hasMultipleViews ? (
              <div className="detail-gallery__arrows" aria-label={language === 'ar' ? 'تصفح صور التصميم' : 'Cycle design images'}>
                <button
                  type="button"
                  onClick={showPreviousImage}
                  className="detail-gallery__arrow detail-gallery__arrow--previous"
                  aria-label={language === 'ar' ? 'الصورة السابقة' : 'Previous image'}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={showNextImage}
                  className="detail-gallery__arrow detail-gallery__arrow--next"
                  aria-label={language === 'ar' ? 'الصورة التالية' : 'Next image'}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {selectableViews.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {selectableViews.map((view, index) => (
            <button
              key={view.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`gallery-selector ${activeIndex === index ? 'gallery-selector--active' : ''}`}
            >
              {view.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
