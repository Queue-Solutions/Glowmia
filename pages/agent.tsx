import Head from 'next/head';
import { SiteLayout } from '@/src/components/layout/SiteLayout';
import { ComingSoonBlock } from '@/src/components/site/ComingSoonBlock';

export default function AgentPage() {
  return (
    <>
      <Head>
        <title>Glowmia | AI Agent</title>
        <meta name="description" content="Glowmia AI Agent is coming soon with a guided styling and inspiration experience." />
      </Head>

      <SiteLayout currentPath="/agent">
        <ComingSoonBlock />
      </SiteLayout>
    </>
  );
}
