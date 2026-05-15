import type { NextApiRequest, NextApiResponse } from 'next';
import { isAdminAuthenticatedRequest } from '@/src/lib/adminAuth';
import { createDiscountCode, listDiscountCodes } from '@/src/lib/discountCodes';

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'GET' && request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST');
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  if (!isAdminAuthenticatedRequest(request)) {
    response.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  try {
    if (request.method === 'GET') {
      response.status(200).json({ codes: await listDiscountCodes() });
      return;
    }

    const percentage = Number(request.body?.percentage ?? 0);

    if (!Number.isFinite(percentage) || percentage < 1 || percentage > 100) {
      response.status(400).json({ error: 'Discount percentage must be between 1 and 100.' });
      return;
    }

    response.status(201).json({
      ok: true,
      code: await createDiscountCode(percentage),
    });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Unable to manage discount codes.',
    });
  }
}
