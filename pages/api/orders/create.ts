import type { NextApiRequest, NextApiResponse } from 'next';
import { createOrderFromRequestBody, type OrdersCreateRequestBody } from '@/src/server/orders';

type ApiResponse = {
  ok?: boolean;
  orderId?: string;
  error?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const result = await createOrderFromRequestBody(req.body as OrdersCreateRequestBody, { notifyTeam: true });
    console.info(`[api/orders/create] Completed with status ${result.status}.`);
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('[api/orders/create] Unhandled error', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unable to create order.',
    });
  }
}
