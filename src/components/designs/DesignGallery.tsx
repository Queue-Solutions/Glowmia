import { useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import type { Design } from '@/src/data/designs';
import { glowmiaCopy, copyFor } from '@/src/content/glowmia';
import { useSitePreferencesContext } from '@/src/context/SitePreferencesContext';
import { localizeText } from '@/src/data/designs';

export function DesignGallery({ design }: { design: Design }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const { language } = useSitePreferencesContext();

  const baseViews = [
    {
      id: `${design.id}-cover`,
      image: design.coverImage,
      label: language === 'ar' ? 'صورة الغلاف' : 'Cover View',
      objectPosition: 'center top',
    },
  ];

  const fullView =
    design.detailImage && design.detailImage !== design.coverImage
      ? [
          {
            id: `${design.id}-full`,
            image: design.detailImage,
            label: language === 'ar' ? 'الصورة الكاملة' : 'Full 3-View',
            objectPosition: 'center center',
          },
        ]
      : [];

  const additionalViews = design.galleryImages
    .filter((image) => image !== design.coverImage && image !== design.detailImage)
    .map((image, index) => ({
      id: `${design.id}-extra-${index + 1}`,
      image,
      label: language === 'ar' ? `عرض إضافي ${index + 1}` : `Additional ${index + 1}`,
      objectPosition: 'center center',
    }));

  const selectableViews = [...baseViews, ...fullView, ...additionalViews];
  const activeView = selectableViews[activeIndex] ?? selectableViews[0];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.24em] text-[color:var(--text-muted)]">
          {copyFor(language, glowmiaCopy.detail.galleryLabel)}
        </p>
        <div className="detail-gallery__frame">
          <div className="detail-gallery__stage">
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
                  className="detail-gallery__media"
                  style={{ objectPosition: activeView.objectPosition }}
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </motion.div>
            </AnimatePresence>
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
