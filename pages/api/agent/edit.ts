import type { NextApiRequest, NextApiResponse } from 'next';
import { sendAgentMessageWithFallback, type AgentLanguage } from '@/src/server/agent';

type ApiError = {
  detail: string;
};

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function readLanguage(value: unknown): AgentLanguage {
  return value === 'ar' ? 'ar' : 'en';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Record<string, unknown> | ApiError>) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ detail: 'Method not allowed' });
  }

  const sessionId = readString(req.body?.sessionId);
  const message = readString(req.body?.message);

  if (!sessionId || !message) {
    return res.status(400).json({ detail: 'Missing sessionId or message' });
  }

  try {
    const result = await sendAgentMessageWithFallback(
      {
        sessionId,
        message,
        language: readLanguage(req.body?.language),
        selectedDressId: readString(req.body?.selectedDressId) || null,
        selectedDressImageUrl: readString(req.body?.selectedDressImageUrl) || null,
        modeHint: 'edit',
      },
      { forceEdit: true },
    );

    console.info(`[api/agent/edit] Responded via ${result.source} with status ${result.status}.`);
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('[api/agent/edit] Unhandled error', error);
    return res.status(500).json({
      detail: error instanceof Error ? error.message : 'Unable to edit dress image.',
    });
  }
}
