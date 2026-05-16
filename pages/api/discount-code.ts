import type { NextApiRequest, NextApiResponse } from 'next';
import validateCouponHandler from '@/pages/api/coupons/validate';

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  return validateCouponHandler(request, response);
}
