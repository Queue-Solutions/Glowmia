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
    response.status(400).json({ error: 'Discount code is required.' });
    return;
  }

  const discountCode = await validateDiscountCode(code);

  if (!discountCode) {
    response.status(404).json({ error: 'This discount code is invalid or has already been used.' });
    return;
  }

  response.status(200).json({
    ok: true,
    discount: {
      code: discountCode.code,
      percentage: discountCode.percentage,
      amount: calculateDiscountAmount(Number.isFinite(subtotal) ? subtotal : 0, discountCode.percentage),
    },
  });
}
