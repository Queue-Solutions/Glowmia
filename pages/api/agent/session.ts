import type { NextApiRequest, NextApiResponse } from 'next';
import { createAgentSessionWithFallback, type AgentLanguage } from '@/src/server/agent';

type ApiError = {
  detail: string;
};

function readLanguage(value: unknown): AgentLanguage {
  return value === 'ar' ? 'ar' : 'en';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Record<string, unknown> | ApiError>) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ detail: 'Method not allowed' });
  }

  try {
    const result = await createAgentSessionWithFallback(readLanguage(req.body?.language));
    console.info(`[api/agent/session] Responded via ${result.source} with status ${result.status}.`);
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('[api/agent/session] Unhandled error', error);
    return res.status(500).json({
      detail: error instanceof Error ? error.message : 'Unable to create agent session.',
    });
  }
}
