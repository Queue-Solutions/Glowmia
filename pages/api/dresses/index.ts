import type { NextApiRequest, NextApiResponse } from 'next';
import { getAllDesignsFromSupabase, PUBLIC_PAGE_CACHE_CONTROL } from '@/src/services/dresses';

type DressesResponse = {
  ok?: boolean;
  dresses?: Awaited<ReturnType<typeof getAllDesignsFromSupabase>>;
  error?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<DressesResponse>) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  res.setHeader('Cache-Control', PUBLIC_PAGE_CACHE_CONTROL);

  try {
    const dresses = await getAllDesignsFromSupabase();
    console.info(`[api/dresses] Returned ${dresses.length} dresses.`);
    return res.status(200).json({
      ok: true,
      dresses,
    });
  } catch (error) {
    console.error('[api/dresses] Failed to load dresses', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unable to load dresses.',
    });
  }
}
