import { useMemo, useState } from 'react';
import Head from 'next/head';
import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { Search } from 'lucide-react';
import { SiteLayout } from '@/src/components/layout/SiteLayout';
import { DesignGrid } from '@/src/components/designs/DesignGrid';
import { copyFor, glowmiaCopy } from '@/src/content/glowmia';
import { localizeText, type Design } from '@/src/data/designs';
import { useSitePreferencesContext } from '@/src/context/SitePreferencesContext';
import { getAllDesignsFromSupabase } from '@/src/services/dresses';

type FilterKey = 'all' | 'evening' | 'casual' | 'formal' | 'new';

type DesignsPageProps = {
  designs: Design[];
};

const filterOrder: FilterKey[] = ['all', 'evening', 'casual', 'formal', 'new'];

export const getServerSideProps: GetServerSideProps<DesignsPageProps> = async () => {
  const designs = await getAllDesignsFromSupabase();

  return {
    props: {
      designs,
    },
  };
};

export default function DesignsPage({ designs }: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { language } = useSitePreferencesContext();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');

  const filteredDesigns = useMemo(() => {
    return designs.filter((design) => {
      const matchesFilter =
        activeFilter === 'all' ||
        (activeFilter === 'new' ? design.isNew : design.category === activeFilter);

      const searchTarget = [
        design.name.en,
        design.name.ar,
        design.subtitle.en,
        design.subtitle.ar,
        design.description.en,
        design.description.ar,
        design.categoryLabel.en,
        design.categoryLabel.ar,
        design.occasion.en,
        design.occasion.ar,
        design.color.en,
        design.color.ar,
      ]
        .join(' ')
        .toLowerCase();

      const matchesQuery = searchTarget.includes(query.trim().toLowerCase());

      return matchesFilter && matchesQuery;
    });
  }, [activeFilter, designs, language, query]);

  return (
    <>
      <Head>
        <title>Glowmia | Designs</title>
        <meta name="description" content="Browse the full Glowmia dress portfolio and discover refined evening, formal, and casual designs." />
      </Head>

      <SiteLayout currentPath="/designs">
        <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6 md:px-10">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.26em] text-[color:var(--text-muted)]">Glowmia</p>
            <h1 className="font-display text-5xl text-[color:var(--text-primary)] md:text-6xl">
              {copyFor(language, glowmiaCopy.designs.title)}
            </h1>
            <p className="max-w-3xl text-lg leading-8 text-[color:var(--text-muted)]">
              {copyFor(language, glowmiaCopy.designs.description)}
            </p>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {filterOrder.map((filterKey) => (
                <button
                  key={filterKey}
                  type="button"
                  onClick={() => setActiveFilter(filterKey)}
                  className={`pill-button ${activeFilter === filterKey ? 'pill-button--active' : ''}`}
                >
                  {copyFor(language, glowmiaCopy.designs.filters[filterKey])}
                </button>
              ))}
            </div>

            <label className="search-shell">
              <Search className="h-4 w-4 text-[color:var(--text-muted)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copyFor(language, glowmiaCopy.designs.searchPlaceholder)}
                className="w-full bg-transparent text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)]"
              />
            </label>
          </div>

          {filteredDesigns.length > 0 ? (
            <DesignGrid designs={filteredDesigns} />
          ) : (
            <div className="rounded-[2rem] border border-dashed border-[color:var(--line)] px-6 py-12 text-center">
              <h2 className="font-display text-3xl text-[color:var(--text-primary)]">
                {copyFor(language, glowmiaCopy.designs.emptyTitle)}
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-[color:var(--text-muted)]">
                {copyFor(language, glowmiaCopy.designs.emptyDescription)}
              </p>
              <button type="button" onClick={() => { setActiveFilter('all'); setQuery(''); }} className="secondary-button mt-6">
                {copyFor(language, glowmiaCopy.designs.clearFilters)}
              </button>
            </div>
          )}
        </section>
      </SiteLayout>
    </>
  );
}
