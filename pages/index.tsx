import Head from 'next/head';
import type { GetStaticProps, InferGetStaticPropsType } from 'next';
import { SiteLayout } from '@/src/components/layout/SiteLayout';
import { HomeHero } from '@/src/components/site/HomeHero';
import { BrandIntro } from '@/src/components/site/BrandIntro';
import { FeaturedDesigns } from '@/src/components/designs/FeaturedDesigns';
import { AgentTeaser } from '@/src/components/site/AgentTeaser';
import { getFeaturedDesignsFromList, type Design } from '@/src/data/designs';
import { getAllDesignsFromSupabase } from '@/src/services/dresses';

type HomePageProps = {
  featuredDesigns: Design[];
};

export const getStaticProps: GetStaticProps<HomePageProps> = async () => {
  const designs = await getAllDesignsFromSupabase();

  return {
    props: {
      featuredDesigns: getFeaturedDesignsFromList(designs),
    },
    revalidate: 60,
  };
};

export default function HomePage({ featuredDesigns }: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <>
      <Head>
        <title>Glowmia</title>
        <meta
          name="description"
          content="Glowmia is a premium fashion destination for refined dress designs, mood-led storytelling, and a live AI styling experience."
        />
      </Head>

      <SiteLayout currentPath="/">
        <HomeHero />
        <BrandIntro />
        <FeaturedDesigns designs={featuredDesigns} />
        <AgentTeaser />
      </SiteLayout>
    </>
  );
}
