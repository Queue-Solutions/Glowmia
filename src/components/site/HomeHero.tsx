import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { glowmiaCopy, copyFor } from '@/src/content/glowmia';
import { useSitePreferencesContext } from '@/src/context/SitePreferencesContext';

const heroLooks = [
  {
    src: '/dresses/covers/dress-7-cover.png',
    alt: 'Glowmia rust evening dress',
  },
  {
    src: '/dresses/covers/dress-2-cover.png',
    alt: 'Glowmia taupe evening dress',
  },
  {
    src: '/dresses/covers/dress-8-cover.png',
    alt: 'Glowmia gold evening dress',
  },
  {
    src: '/dresses/covers/dress-6-cover.png',
    alt: 'Glowmia black evening dress',
  },
  {
    src: '/dresses/covers/dress-9-cover.png',
    alt: 'Glowmia embellished evening dress',
  },
];

const HERO_LOOK_INTERVAL = 5400;

export function HomeHero() {
  const { language } = useSitePreferencesContext();
  const [activeLookIndex, setActiveLookIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'hidden') {
        return;
      }

      setActiveLookIndex((current) => (current + 1) % heroLooks.length);
    }, HERO_LOOK_INTERVAL);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <section className="home-hero" aria-labelledby="home-hero-title">
      <div className="home-hero__inner">
        <motion.div
          className="home-hero__copy"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="eyebrow-chip home-hero__eyebrow">
            <Sparkles className="h-4 w-4" />
            {copyFor(language, glowmiaCopy.home.heroEyebrow)}
          </span>

          <div className="home-hero__headline">
            <h1 id="home-hero-title" className="home-hero__title font-display">
              {copyFor(language, glowmiaCopy.home.heroTitle)}
            </h1>
            <p className="home-hero__description">
              {copyFor(language, glowmiaCopy.home.heroDescription)}
            </p>
          </div>

          <div className="home-hero__actions">
            <Link href="/designs" className="primary-button home-hero__primary">
              {copyFor(language, glowmiaCopy.home.heroPrimary)}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#brand-intro" className="secondary-button home-hero__secondary">
              {copyFor(language, glowmiaCopy.home.heroSecondary)}
            </a>
          </div>
        </motion.div>

        <div className="home-hero__atelier" aria-hidden="true">
          <div className="home-hero__carousel">
            {heroLooks.map((look, index) => {
              const isActive = index === activeLookIndex;

              return (
                <motion.div
                  key={look.src}
                  className="home-hero__look"
                  initial={
                    isActive
                      ? { opacity: 1, rotateY: 0, rotate: 0, scale: 1, x: 0 }
                      : { opacity: 0, rotateY: 10, rotate: 1.2, scale: 0.992, x: -6 }
                  }
                  animate={
                    isActive
                      ? { opacity: 1, rotateY: 0, rotate: 0, scale: 1, x: 0 }
                      : { opacity: 0, rotateY: 10, rotate: 1.2, scale: 0.992, x: -6 }
                  }
                  transition={
                    isActive
                      ? { duration: 1.1, ease: [0.22, 1, 0.36, 1] }
                      : {
                          opacity: { duration: 0.16 },
                          rotateY: { duration: 0.3 },
                          rotate: { duration: 0.3 },
                          scale: { duration: 0.3 },
                          x: { duration: 0.3 },
                        }
                  }
                  style={{ zIndex: isActive ? 3 : 1, pointerEvents: 'none', visibility: isActive ? 'visible' : 'hidden' }}
                >
                  <Image
                    src={look.src}
                    alt={look.alt}
                    fill
                    priority={index === 0}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    className="home-hero__look-image"
                    sizes="(max-width: 768px) 74vw, (max-width: 1024px) 56vw, 30vw"
                  />
                </motion.div>
              );
            })}

            <div className="home-hero__carousel-dots">
              {heroLooks.map((look, index) => (
                <span key={look.src} className={index === activeLookIndex ? 'home-hero__carousel-dot home-hero__carousel-dot--active' : 'home-hero__carousel-dot'} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
