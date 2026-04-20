import type { NextApiRequest, NextApiResponse } from 'next';
import { randomUUID } from 'crypto';
import { saveAgentDesign } from '@/src/lib/glowmiaOrders';

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
  const userId = typeof request.body?.userId === 'string' ? request.body.userId.trim() : '';
  const guestId = typeof request.body?.guestId === 'string' ? request.body.guestId.trim() : '';
  const dressId = typeof request.body?.dressId === 'string' ? request.body.dressId.trim() : '';
  const dressName = typeof request.body?.dressName === 'string' ? request.body.dressName.trim() : '';
  const originalImageUrl = typeof request.body?.originalImageUrl === 'string' ? request.body.originalImageUrl.trim() : '';
  const editedImageUrl = typeof request.body?.editedImageUrl === 'string' ? request.body.editedImageUrl.trim() : '';
  const prompt = typeof request.body?.prompt === 'string' ? request.body.prompt.trim() : '';
  const language = request.body?.language === 'ar' ? 'ar' : 'en';

  if (!dressId || !dressName || !originalImageUrl || !editedImageUrl) {
    response.status(400).json({ error: 'Missing required saved design details.' });
    return;
  }

  try {
    const savedDesign = await saveAgentDesign({
      userId: userId || null,
      guestId: userId ? null : guestId || randomUUID(),
      dressId,
      originalImageUrl,
      editedImageUrl,
      prompt,
      designName: dressName,
      notes: {
        sessionId,
        language,
        customerName,
        customerPhone,
      },
      isOrdered: false,
    });

    response.status(201).json({
      ok: true,
      savedDesign,
    });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Unable to save the edited design.',
    });
  }
}
