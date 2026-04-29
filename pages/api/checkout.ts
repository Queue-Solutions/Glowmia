import type { NextApiRequest, NextApiResponse } from 'next';
import { createOrderFromRequestBody, type OrdersCreateRequestBody } from '@/src/server/orders';

type ApiResponse = {
  ok?: boolean;
  orderId?: string;
  error?: string;
};

export default async function handler(request: NextApiRequest, response: NextApiResponse<ApiResponse>) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    const result = await createOrderFromRequestBody(request.body as OrdersCreateRequestBody, { notifyTeam: false });
    console.info(`[api/checkout] Completed with status ${result.status}.`);
    response.status(result.status).json(result.body);
  } catch (error) {
    console.error('[api/checkout] Unhandled error', error);
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Unable to place the order.',
    });
  }
}
