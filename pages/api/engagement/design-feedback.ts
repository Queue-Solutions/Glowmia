import type { NextApiRequest, NextApiResponse } from 'next';
import { addDesignFeedback, listDesignFeedback } from '@/src/lib/engagementStore';

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method === 'GET') {
    const designId = typeof request.query.designId === 'string' ? request.query.designId.trim() : '';

    if (!designId) {
      response.status(400).json({ error: 'A design id is required.' });
      return;
    }

    response.status(200).json({ comments: await listDesignFeedback(designId) });
    return;
  }

  if (request.method === 'POST') {
    const designId = typeof request.body?.designId === 'string' ? request.body.designId.trim() : '';
    const author = typeof request.body?.author === 'string' ? request.body.author : '';
    const message = typeof request.body?.message === 'string' ? request.body.message.trim() : '';
    const rating = Number(request.body?.rating ?? 0);

    if (!designId) {
      response.status(400).json({ error: 'A design id is required.' });
      return;
    }

    if (!message || !Number.isFinite(rating) || rating < 1) {
      response.status(400).json({ error: 'A message and rating are required.' });
      return;
    }

    response.status(201).json({
      ok: true,
      comment: await addDesignFeedback({
        designId,
        author,
        message,
        rating,
      }),
    });
    return;
  }

  response.setHeader('Allow', 'GET, POST');
  response.status(405).json({ error: 'Method not allowed.' });
}
