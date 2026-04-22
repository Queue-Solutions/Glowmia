import type { NextApiRequest, NextApiResponse } from 'next';
import { getAgentProxyTimeoutMs, resolveAgentBackendConfig } from '@/src/lib/agentBackendConfig';
import { ensureGlowmiaAgentBackend } from '@/src/lib/glowmiaAgentRuntime';

type JsonResponse = Record<string, unknown> | { detail: string };

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readBackendJson(path: string, payload: Record<string, unknown>) {
  const { baseUrl } = resolveAgentBackendConfig();
  await ensureGlowmiaAgentBackend(baseUrl);

  const url = `${baseUrl}${path}`;

  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
    getAgentProxyTimeoutMs(),
  );

  const text = await response.text();

  let data: JsonResponse = {};
  try {
    data = text ? (JSON.parse(text) as JsonResponse) : {};
  } catch {
    data = { detail: text || 'Invalid JSON response from backend' };
  }

  return {
    status: response.status,
    data,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<JsonResponse>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ detail: 'Method not allowed' });
  }

  const action = Array.isArray(req.query.action) ? req.query.action[0] : req.query.action;

  try {
    if (action === 'session') {
      const language = readString(req.body?.language) === 'ar' ? 'ar' : 'en';
      const { status, data } = await readBackendJson('/api/v1/sessions', { language });
      return res.status(status).json(data);
    }

    if (action === 'message') {
      const sessionId = readString(req.body?.sessionId);
      const message = readString(req.body?.message);
      const language = readString(req.body?.language) === 'ar' ? 'ar' : 'en';
      const selectedDressId = readString(req.body?.selectedDressId);
      const selectedDressImageUrl = readString(req.body?.selectedDressImageUrl);
      const modeHint = readString(req.body?.modeHint);

      if (!sessionId || !message) {
        return res.status(400).json({ detail: 'Missing sessionId or message' });
      }

      const { status, data } = await readBackendJson('/api/v1/chat/message', {
        session_id: sessionId,
        message,
        language,
        selected_dress_id: selectedDressId || null,
        selected_dress_image_url: selectedDressImageUrl || null,
        mode_hint: modeHint || null,
      });

      return res.status(status).json(data);
    }

    return res.status(404).json({ detail: 'Unknown agent action' });
  } catch (error) {
    console.error('Glowmia agent proxy failed', error);

    if (error instanceof Error && error.name === 'AbortError') {
      return res.status(504).json({
        detail: 'Glowmia stylist took too long to respond. Image edits can take longer than chat replies, so please try again.',
      });
    }

    return res.status(502).json({
      detail: 'Glowmia stylist is unavailable right now. Make sure the agent backend is running.',
    });
  }
}
