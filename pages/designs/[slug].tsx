import Head from 'next/head';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { SiteLayout } from '@/src/components/layout/SiteLayout';
import { DesignGallery } from '@/src/components/designs/DesignGallery';
import { DesignInfo } from '@/src/components/designs/DesignInfo';
import { FeedbackSection } from '@/src/components/designs/FeedbackSection';
import { RelatedDesigns } from '@/src/components/designs/RelatedDesigns';
import { copyFor, glowmiaCopy } from '@/src/content/glowmia';
import { getAllDesignsFromSupabase } from '@/src/services/dresses';
import { getDesignBySlug, getRelatedDesignsFromList, localizeText, type Design } from '@/src/data/designs';
import { useSitePreferencesContext } from '@/src/context/SitePreferencesContext';

type DesignDetailPageProps = {
  design: Design;
  related: Design[];
};

export const getServerSideProps: GetServerSideProps<DesignDetailPageProps> = async ({ params }) => {
  const slug = String(params?.slug ?? '');
  const designs = await getAllDesignsFromSupabase();
  const design = getDesignBySlug(designs, slug);

  if (!design) {
    return { notFound: true };
  }

  return {
    props: {
      design,
      related: getRelatedDesignsFromList(designs, design),
    },
  };
};

export default function DesignDetailPage({ design, related }: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { language } = useSitePreferencesContext();

  return (
    <>
      <Head>
        <title>{`Glowmia | ${localizeText(language, design.name)}`}</title>
        <meta name="description" content={localizeText(language, design.description)} />
      </Head>

      <SiteLayout currentPath="/designs">
        <section className="mx-auto w-full max-w-7xl px-6 py-6 md:px-10">
          <Link href="/designs" className="inline-flex items-center gap-2 text-sm text-[color:var(--text-muted)] transition hover:text-[color:var(--text-primary)]">
            <ArrowLeft className="h-4 w-4" />
            {copyFor(language, glowmiaCopy.detail.back)}
          </Link>

          <div className="mt-6 grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <DesignGallery design={design} />
            <DesignInfo design={design} />
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-10 md:px-10">
          <FeedbackSection designId={design.id} />
          <RelatedDesigns designs={related} />
        </section>
      </SiteLayout>
    </>
  );
}
