import type { NextApiRequest, NextApiResponse } from 'next';
import { addSavedDesignOrder } from '@/src/lib/engagementStore';

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const sessionId = typeof request.body?.sessionId === 'string' ? request.body.sessionId.trim() : null;
  const customerName = typeof request.body?.customerName === 'string' ? request.body.customerName.trim() : '';
  const customerPhone = typeof request.body?.customerPhone === 'string' ? request.body.customerPhone.trim() : '';
  const dressId = typeof request.body?.dressId === 'string' ? request.body.dressId.trim() : '';
  const dressName = typeof request.body?.dressName === 'string' ? request.body.dressName.trim() : '';
  const originalImageUrl = typeof request.body?.originalImageUrl === 'string' ? request.body.originalImageUrl.trim() : '';
  const editedImageUrl = typeof request.body?.editedImageUrl === 'string' ? request.body.editedImageUrl.trim() : '';
  const language = request.body?.language === 'ar' ? 'ar' : 'en';

  if (!customerName || !customerPhone || !dressId || !dressName || !originalImageUrl || !editedImageUrl) {
    response.status(400).json({ error: 'Missing required order details.' });
    return;
  }

  response.status(201).json({
    ok: true,
    order: await addSavedDesignOrder({
      sessionId,
      language,
      customerName,
      customerPhone,
      dressId,
      dressName,
      originalImageUrl,
      editedImageUrl,
    }),
  });
}
