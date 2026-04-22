import type { NextApiRequest, NextApiResponse } from 'next';

type JsonRecord = Record<string, unknown>;
type JsonResponse = JsonRecord | { detail: string };

const FALLBACK_UPSTREAM_PATHS = ['/api/v1/chat', '/api/v1/chat/message'] as const;

function readConfiguredBackendUrl() {
  const raw =
    process.env.GLOWMIA_AGENT_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_GLOWMIA_AGENT_API_URL?.trim() ||
    '';

  if (!raw) {
    throw new Error(
      'Missing GLOWMIA_AGENT_API_URL. Set GLOWMIA_AGENT_API_URL or NEXT_PUBLIC_GLOWMIA_AGENT_API_URL to the Railway backend URL.',
    );
  }

  try {
    return new URL(raw).toString().replace(/\/$/, '');
  } catch {
    throw new Error('GLOWMIA_AGENT_API_URL must be a valid absolute URL.');
  }
}

async function readJsonSafely(response: Response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as JsonResponse;
  } catch {
    return {
      detail: text || 'Invalid JSON response from upstream agent backend.',
    } satisfies JsonResponse;
  }
}

function normalizeChatPayload(body: NextApiRequest['body']) {
  const payload = typeof body === 'object' && body ? { ...(body as JsonRecord) } : {};

  if (typeof payload.session_id === 'string' && typeof payload.message === 'string') {
    return payload;
  }

  return {
    session_id: typeof body?.sessionId === 'string' ? body.sessionId.trim() : '',
    message: typeof body?.message === 'string' ? body.message.trim() : '',
    language: body?.language === 'ar' ? 'ar' : 'en',
    selected_dress_id: typeof body?.selectedDressId === 'string' ? body.selectedDressId.trim() || null : null,
    selected_dress_image_url:
      typeof body?.selectedDressImageUrl === 'string' ? body.selectedDressImageUrl.trim() || null : null,
    mode_hint: typeof body?.modeHint === 'string' ? body.modeHint.trim() || null : null,
  } satisfies JsonRecord;
}

async function postUpstream(baseUrl: string, payload: JsonRecord) {
  let lastResponse: { status: number; data: JsonResponse } | null = null;

  for (const path of FALLBACK_UPSTREAM_PATHS) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await readJsonSafely(response);
    lastResponse = { status: response.status, data };

    if (response.status !== 404) {
      return lastResponse;
    }
  }

  return lastResponse ?? { status: 502, data: { detail: 'Unable to reach the agent backend.' } };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<JsonResponse>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ detail: 'Method not allowed' });
  }

  try {
    const payload = normalizeChatPayload(req.body);

    if (typeof payload.session_id !== 'string' || !payload.session_id.trim()) {
      return res.status(400).json({ detail: 'Missing sessionId or session_id.' });
    }

    if (typeof payload.message !== 'string' || !payload.message.trim()) {
      return res.status(400).json({ detail: 'Missing message.' });
    }

    const baseUrl = readConfiguredBackendUrl();
    const upstream = await postUpstream(baseUrl, payload);
    return res.status(upstream.status).json(upstream.data);
  } catch (error) {
    console.error('[api/agent/message] Proxy failed', error);

    return res.status(502).json({
      detail:
        error instanceof Error
          ? error.message
          : 'Glowmia stylist is unavailable right now. Check the Railway backend URL and network connectivity.',
    });
  }
}
