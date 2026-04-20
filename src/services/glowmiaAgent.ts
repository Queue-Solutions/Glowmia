export type AgentSession = {
  id: string;
  title?: string | null;
  created_at?: string | null;
};

export type AgentDress = {
  id: string;
  name: string;
  image_url: string;
  detail_image_url?: string | null;
  front_view_url?: string | null;
  category?: string | null;
  occasion?: string[] | string | null;
  color?: string | null;
  sleeve_type?: string | null;
  length?: string | null;
  style?: string[] | string | null;
  fabric?: string | null;
  fit?: string | null;
  description?: string | null;
  name_ar?: string | null;
  description_ar?: string | null;
  color_ar?: string | null;
  sleeve_type_ar?: string | null;
  length_ar?: string | null;
  fabric_ar?: string | null;
  fit_ar?: string | null;
  occasion_ar?: string[] | string | null;
  style_ar?: string[] | string | null;
};

export type AgentRecommendationResponse = {
  session_id: string;
  parsed_preferences?: Record<string, unknown>;
  results: AgentDress[];
};

export type AgentEditResponse = {
  session_id: string;
  dress_id: string;
  original_image_url: string;
  edited_image_url?: string | null;
  parsed_edits: Record<string, unknown>;
  provider: string;
  model?: string | null;
  message: string;
  error?: string;
};

type JsonRecord = Record<string, unknown>;

async function postJson<TResponse>(path: string, payload: JsonRecord): Promise<TResponse> {
  const response = await fetch(`/api/agent/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as JsonRecord) : {};

  if (!response.ok) {
    const detail =
      (typeof data.detail === 'string' && data.detail) ||
      (typeof data.message === 'string' && data.message) ||
      'Unable to reach the Glowmia stylist service.';

    throw new Error(detail);
  }

  return data as TResponse;
}

export async function createAgentSession(title: string) {
  const data = await postJson<{ session: AgentSession }>('session', { title });
  return data.session;
}

export async function requestAgentRecommendations(sessionId: string, query: string) {
  return postJson<AgentRecommendationResponse>('recommend', {
    sessionId,
    query,
  });
}

export async function requestAgentEdit(
  sessionId: string,
  payload: {
    dressId: string;
    imageUrl: string;
    instruction: string;
  },
) {
  return postJson<AgentEditResponse>('edit', {
    sessionId,
    dressId: payload.dressId,
    imageUrl: payload.imageUrl,
    instruction: payload.instruction,
  });
}
