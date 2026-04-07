import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { glowmiaCopy, copyFor } from '@/src/content/glowmia';
import { useSitePreferencesContext } from '@/src/context/SitePreferencesContext';

export function HomeHero() {
  const { language } = useSitePreferencesContext();

  return (
    <section className="mx-auto grid w-full max-w-7xl gap-8 px-6 py-8 md:grid-cols-[1.05fr_0.95fr] md:items-center md:px-10 lg:gap-12 lg:py-12">
      <motion.div
        className="space-y-6"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="eyebrow-chip">
          <Sparkles className="h-4 w-4" />
          {copyFor(language, glowmiaCopy.home.heroEyebrow)}
        </span>

        <div className="space-y-4">
          <h1 className="max-w-2xl font-display text-5xl leading-[0.95] tracking-[-0.04em] text-[color:var(--text-primary)] md:text-6xl">
            {copyFor(language, glowmiaCopy.home.heroTitle)}
          </h1>
          <p className="max-w-xl text-lg leading-8 text-[color:var(--text-muted)]">
            {copyFor(language, glowmiaCopy.home.heroDescription)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link href="/designs" className="primary-button">
            {copyFor(language, glowmiaCopy.home.heroPrimary)}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a href="#brand-intro" className="secondary-button">
            {copyFor(language, glowmiaCopy.home.heroSecondary)}
          </a>
        </div>
      </motion.div>

      <motion.div
        className="hero-visual"
        initial={{ opacity: 0, x: 20, y: 6 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.42, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="hero-visual__floating">
          <Image
            src="/dresses/covers/home-page.png"
            alt="Glowmia featured design"
            fill
            priority
            className="hero-visual__image"
            sizes="(max-width: 768px) 100vw, 42vw"
          />
        </div>
        <div className="hero-visual__accent hero-visual__accent--small" />
        <div className="hero-visual__accent hero-visual__accent--large" />
      </motion.div>
    </section>
  );
}
