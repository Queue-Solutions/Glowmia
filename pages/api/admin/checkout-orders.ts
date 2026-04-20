import type { NextApiRequest, NextApiResponse } from 'next';
import { isAdminAuthenticatedRequest } from '@/src/lib/adminAuth';
import { listCheckoutOrdersFromSupabase } from '@/src/lib/glowmiaOrders';

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
    response.status(200).json({ orders: await listCheckoutOrdersFromSupabase() });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Unable to load checkout orders.',
    });
  }
}
