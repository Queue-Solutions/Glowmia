import type { NextApiRequest, NextApiResponse } from 'next';
import { isAdminAuthenticatedRequest } from '@/src/lib/adminAuth';
import { getEngagementInsights } from '@/src/lib/engagementStore';
import { listSavedDesignsForAdmin } from '@/src/lib/glowmiaOrders';

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  if (!isAdminAuthenticatedRequest(request)) {
    response.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  try {
    const [insights, savedDesignOrders] = await Promise.all([getEngagementInsights(), listSavedDesignsForAdmin()]);

    response.status(200).json({
      ...insights,
      savedDesignOrders,
      totals: {
        ...insights.totals,
        savedDesignOrdersCount: savedDesignOrders.length,
      },
    });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Unable to load admin insights.',
    });
  }
}
