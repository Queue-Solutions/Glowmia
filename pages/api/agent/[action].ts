import type { NextApiRequest, NextApiResponse } from 'next';
import { getAgentProxyTimeoutMs, resolveAgentBackendConfig } from '@/src/lib/agentBackendConfig';
import { ensureGlowmiaAgentBackend } from '@/src/lib/glowmiaAgentRuntime';

type JsonBody = Record<string, unknown>;
type JsonResponse = JsonBody & { detail?: string; code?: string };

const DEFAULT_SESSION_TITLE = 'Glowmia Stylist Session';
const MAX_SESSION_TITLE_LENGTH = 140;
const MAX_TEXT_FIELD_LENGTH = 4000;

class RequestValidationError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = 'INVALID_REQUEST') {
    super(message);
    this.name = 'RequestValidationError';
    this.status = status;
    this.code = code;
  }
}

class UpstreamRequestError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 502, code = 'AGENT_BACKEND_UNAVAILABLE') {
    super(message);
    this.name = 'UpstreamRequestError';
    this.status = status;
    this.code = code;
  }
}

function readAction(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function readTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function readRequiredString(value: unknown, fieldName: string, maxLength = MAX_TEXT_FIELD_LENGTH) {
  const nextValue = readTrimmedString(value);

  if (!nextValue) {
    throw new RequestValidationError(`Missing ${fieldName}.`);
  }

  if (nextValue.length > maxLength) {
    throw new RequestValidationError(`${fieldName} exceeds the ${maxLength}-character limit.`);
  }

  return nextValue;
}

function readOptionalSessionTitle(value: unknown) {
  const title = readTrimmedString(value) || DEFAULT_SESSION_TITLE;

  if (title.length > MAX_SESSION_TITLE_LENGTH) {
    throw new RequestValidationError(`title exceeds the ${MAX_SESSION_TITLE_LENGTH}-character limit.`);
  }

  return title;
}

function parseJsonResponseBody(text: string): JsonResponse {
  if (!text.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(text) as unknown;

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as JsonResponse;
    }

    return {
      data: parsed,
    };
  } catch {
    return {
      detail: text.trim(),
    };
  }
}

function extractImageUrl(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    return /^https?:\/\//i.test(normalized) ? normalized : null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractImageUrl(item);
      if (nested) {
        return nested;
      }
    }

    return null;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;

    for (const key of ['edited_image_url', 'editedImageUrl', 'url', 'image_url', 'imageUrl', 'output_url', 'outputUrl']) {
      const direct = extractImageUrl(record[key]);
      if (direct) {
        return direct;
      }
    }

    for (const key of ['output', 'outputs', 'data', 'result', 'results', 'prediction', 'predictions']) {
      const nested = extractImageUrl(record[key]);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

function normalizeEditResponse(data: JsonResponse): JsonResponse & {
  edited_image_url: string | null;
  editedImageUrl: string | null;
  error?: unknown;
  message?: unknown;
} {
  const editedImageUrl =
    extractImageUrl(data.edited_image_url) ||
    extractImageUrl(data.editedImageUrl) ||
    extractImageUrl(data.output) ||
    extractImageUrl(data.data) ||
    null;

  return {
    ...data,
    edited_image_url: editedImageUrl,
    editedImageUrl,
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new UpstreamRequestError(
        `Glowmia stylist took longer than ${timeoutMs}ms to respond.`,
        504,
        'AGENT_BACKEND_TIMEOUT',
      );
    }

    throw new UpstreamRequestError(
      'Glowmia stylist is unavailable right now.',
      502,
      'AGENT_BACKEND_UNREACHABLE',
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function readBackendJson(baseUrl: string, path: string, payload: JsonBody, timeoutMs: number) {
  const response = await fetchWithTimeout(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }, timeoutMs);

  const text = await response.text();
  const data = parseJsonResponseBody(text);

  if (!response.ok && !data.detail && typeof data.message !== 'string') {
    data.detail = `Glowmia stylist request failed with status ${response.status}.`;
  }

  return {
    status: response.status,
    data,
  };
}

function sendJson(res: NextApiResponse<JsonResponse>, status: number, body: JsonResponse) {
  return res.status(status).json(body);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<JsonResponse>) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, {
      detail: 'Method not allowed.',
      code: 'METHOD_NOT_ALLOWED',
    });
  }

  const action = readAction(req.query.action);
  const timeoutMs = getAgentProxyTimeoutMs();
  const startedAt = Date.now();

  let backendConfig;

  try {
    backendConfig = resolveAgentBackendConfig();
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Glowmia stylist backend is not configured.';

    console.error('[agent proxy] backend configuration error', {
      action,
      detail,
    });

    return sendJson(res, 503, {
      detail,
      code: 'AGENT_BACKEND_MISCONFIGURED',
    });
  }

  try {
    await ensureGlowmiaAgentBackend(backendConfig.baseUrl);

    if (action === 'session') {
      const title = readOptionalSessionTitle(req.body?.title);
      const { status, data } = await readBackendJson(backendConfig.baseUrl, '/chat/sessions', { title }, timeoutMs);
      return sendJson(res, status, data);
    }

    if (action === 'recommend') {
      const sessionId = readRequiredString(req.body?.sessionId, 'sessionId', 200);
      const query = readRequiredString(req.body?.query, 'query');
      const { status, data } = await readBackendJson(
        backendConfig.baseUrl,
        `/chat/sessions/${encodeURIComponent(sessionId)}/recommend`,
        { query },
        timeoutMs,
      );

      return sendJson(res, status, data);
    }

    if (action === 'edit') {
      const sessionId = readRequiredString(req.body?.sessionId, 'sessionId', 200);
      const dressId = readRequiredString(req.body?.dressId, 'dressId', 200);
      const imageUrl = readRequiredString(req.body?.imageUrl, 'imageUrl', 2000);
      const instruction = readRequiredString(req.body?.instruction, 'instruction');
      const { status, data } = await readBackendJson(
        backendConfig.baseUrl,
        `/chat/sessions/${encodeURIComponent(sessionId)}/edit`,
        {
          dress_id: dressId,
          image_url: imageUrl,
          instruction,
        },
        timeoutMs,
      );

      const normalizedData = normalizeEditResponse(data);

      if (status >= 200 && status < 300) {
        console.info('[agent proxy] edit response received', {
          status,
          sessionId,
          dressId,
          hasEditedImageUrl: Boolean(normalizedData.edited_image_url),
          upstreamKeys: Object.keys(data),
        });

        if (!normalizedData.edited_image_url) {
          const detail =
            (typeof normalizedData.error === 'string' && normalizedData.error) ||
            (typeof normalizedData.message === 'string' && normalizedData.message) ||
            'The edit request completed but no edited image URL was returned.';

          console.error('[agent proxy] edit response missing usable image URL', {
            status,
            sessionId,
            dressId,
            backendUrl: backendConfig.baseUrl,
            upstreamKeys: Object.keys(data),
            normalizedKeys: Object.keys(normalizedData),
          });

          return sendJson(res, 502, {
            detail,
            code: 'AGENT_EDIT_NO_IMAGE',
          });
        }
      }

      return sendJson(res, status, normalizedData);
    }

    return sendJson(res, 404, {
      detail: 'Unknown agent action.',
      code: 'UNKNOWN_AGENT_ACTION',
    });
  } catch (error) {
    const status =
      error instanceof RequestValidationError || error instanceof UpstreamRequestError ? error.status : 502;
    const code =
      error instanceof RequestValidationError || error instanceof UpstreamRequestError
        ? error.code
        : 'AGENT_PROXY_FAILED';
    const detail =
      error instanceof Error ? error.message : 'Glowmia stylist is unavailable right now.';

    console.error('[agent proxy] request failed', {
      action,
      backendUrl: backendConfig.baseUrl,
      backendSource: backendConfig.source,
      isLocalBackend: backendConfig.isLocal,
      timeoutMs,
      durationMs: Date.now() - startedAt,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: detail,
    });

    return sendJson(res, status, {
      detail,
      code,
    });
  }
}
