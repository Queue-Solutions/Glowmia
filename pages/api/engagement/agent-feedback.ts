import type { NextApiRequest, NextApiResponse } from 'next';
import { addAgentFeedback } from '@/src/lib/engagementStore';

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const sessionId = typeof request.body?.sessionId === 'string' ? request.body.sessionId.trim() : null;
  const message = typeof request.body?.message === 'string' ? request.body.message.trim() : '';
  const language = request.body?.language === 'ar' ? 'ar' : 'en';
  const rating = Number(request.body?.rating ?? 0);

  if (!Number.isFinite(rating) || rating < 1) {
    response.status(400).json({ error: 'A rating is required.' });
    return;
  }

  try {
    const feedback = await addAgentFeedback({
      sessionId,
      language,
      rating,
      message,
    });

    response.status(201).json({
      ok: true,
      feedback,
    });
  } catch (error) {
    console.error('[api/engagement/agent-feedback] Failed to save agent feedback.', {
      error: error instanceof Error ? error.message : error,
      sessionId,
      language,
      rating,
      hasMessage: Boolean(message),
    });

    response.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Unable to save the agent feedback. Check the server logs for more details.',
    });
  }
}
