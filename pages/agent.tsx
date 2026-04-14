import Head from 'next/head';
import { SiteLayout } from '@/src/components/layout/SiteLayout';
import { AgentExperience } from '@/src/components/agent/AgentExperience';

export default function AgentPage() {
  return (
    <>
      <Head>
        <title>Glowmia | AI Agent</title>
        <meta
          name="description"
          content="Talk to Glowmia Stylist for dress recommendations and visual refinements inside one fashion-led assistant experience."
        />
      </Head>

      <SiteLayout currentPath="/agent">
        <AgentExperience />
      </SiteLayout>
    </>
  );
}
