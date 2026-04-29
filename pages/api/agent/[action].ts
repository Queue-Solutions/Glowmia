import type { NextApiRequest, NextApiResponse } from 'next';
import {
  createAgentSessionWithFallback,
  sendAgentMessageWithFallback,
  type AgentLanguage,
  type AgentModeHint,
} from '@/src/server/agent';

type JsonResponse = Record<string, unknown> | { detail: string };

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function readLanguage(value: unknown): AgentLanguage {
  return value === 'ar' ? 'ar' : 'en';
}

function readModeHint(value: unknown): AgentModeHint | null {
  const normalized = readString(value);
  return normalized === 'recommend' || normalized === 'edit' || normalized === 'styling' || normalized === 'chat'
    ? normalized
    : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<JsonResponse>) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ detail: 'Method not allowed' });
  }

  const action = Array.isArray(req.query.action) ? req.query.action[0] : req.query.action;

  try {
    if (action === 'session') {
      const result = await createAgentSessionWithFallback(readLanguage(req.body?.language));
      console.info(`[api/agent/[action]] session responded via ${result.source} with status ${result.status}.`);
      return res.status(result.status).json(result.body);
    }

    if (action === 'message' || action === 'edit') {
      const sessionId = readString(req.body?.sessionId);
      const message = readString(req.body?.message);

      if (!sessionId || !message) {
        return res.status(400).json({ detail: 'Missing sessionId or message' });
      }

      const result = await sendAgentMessageWithFallback(
        {
          sessionId,
          message,
          language: readLanguage(req.body?.language),
          selectedDressId: readString(req.body?.selectedDressId) || null,
          selectedDressImageUrl: readString(req.body?.selectedDressImageUrl) || null,
          modeHint: action === 'edit' ? 'edit' : readModeHint(req.body?.modeHint),
        },
        { forceEdit: action === 'edit' },
      );

      console.info(`[api/agent/[action]] ${action} responded via ${result.source} with status ${result.status}.`);
      return res.status(result.status).json(result.body);
    }

    return res.status(404).json({ detail: 'Unknown agent action' });
  } catch (error) {
    console.error('[api/agent/[action]] Route failed', error);
    return res.status(502).json({
      detail: error instanceof Error ? error.message : 'Glowmia stylist is unavailable right now.',
    });
  }
}
