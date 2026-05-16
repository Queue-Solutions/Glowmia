import type { NextApiRequest, NextApiResponse } from 'next';
import { isAdminAuthenticatedRequest } from '@/src/lib/adminAuth';
import { createDiscountCode, listDiscountCodes, updateDiscountCode } from '@/src/lib/discountCodes';

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'GET' && request.method !== 'POST' && request.method !== 'PATCH') {
    response.setHeader('Allow', 'GET, POST, PATCH');
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

    const payload = {
      code: typeof request.body?.code === 'string' ? request.body.code : '',
      percentage: Number(request.body?.percentage ?? 0),
      isActive: request.body?.isActive !== false,
      usageLimit: request.body?.usageLimit ?? null,
      expiresAt: request.body?.expiresAt ?? null,
    };

    console.info('[api/admin/discount-codes] Request received', {
      method: request.method,
      requestBody: request.body,
      normalizedPayload: payload,
    });

    if (request.method === 'POST') {
      const created = await createDiscountCode(payload);
      console.info('[api/admin/discount-codes] Coupon created', {
        id: created.id,
        code: created.code,
        percentage: created.percentage,
      });
      response.status(201).json({
        ok: true,
        code: created,
      });
      return;
    }

    const couponId = typeof request.body?.id === 'string' ? request.body.id.trim() : '';

    if (!couponId) {
      response.status(400).json({ error: 'Coupon id is required.' });
      return;
    }

    response.status(200).json({
      ok: true,
      code: await updateDiscountCode({
        id: couponId,
        ...payload,
      }),
    });
  } catch (error) {
    console.error('[api/admin/discount-codes] Error', {
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
      error,
    });
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Unable to manage discount codes.',
    });
  }
}
