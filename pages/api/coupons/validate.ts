import type { NextApiRequest, NextApiResponse } from 'next';
import { calculateDiscountAmount } from '@/src/lib/pricing';
import { validateDiscountCode } from '@/src/lib/discountCodes';

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const code = typeof request.body?.code === 'string' ? request.body.code.trim() : '';
  const subtotal = Number(request.body?.subtotal ?? 0);

  if (!code) {
    response.status(400).json({ error: 'Coupon code is required.' });
    return;
  }

  try {
    const coupon = await validateDiscountCode(code);

    if (!coupon) {
      response.status(404).json({ error: 'This coupon is invalid, inactive, expired, or has reached its usage limit.' });
      return;
    }

    const safeSubtotal = Number.isFinite(subtotal) ? subtotal : 0;
    response.status(200).json({
      ok: true,
      discount: {
        code: coupon.code,
        percentage: coupon.percentage,
        amount: calculateDiscountAmount(safeSubtotal, coupon.percentage),
      },
    });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Unable to validate the coupon right now.',
    });
  }
}
