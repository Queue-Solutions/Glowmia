export type AgentLanguage = 'en' | 'ar';

export type AgentSession = {
  session_id: string;
  language: AgentLanguage;
};

export type AgentDress = {
  id: string;
  name: string;
  image_url?: string | null;
  detail_image_url?: string | null;
  front_view_url?: string | null;
  back_view_url?: string | null;
  side_view_url?: string | null;
  cover_image_url?: string | null;
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

export type AgentTool = 'llm' | 'recommend' | 'edit' | 'styling';
export type AgentIntent = 'recommend' | 'styling' | 'edit' | 'chat';
export type AgentModeHint = 'recommend' | 'edit' | 'styling' | 'chat';

export type AgentChatResponse = {
  session_id: string;
  tool: AgentTool;
  intent: AgentIntent;
  language: AgentLanguage;
  message: string;
  dresses: AgentDress[];
  edited_image_url?: string | null;
  selected_dress_id?: string | null;
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

export async function createAgentSession(language: AgentLanguage) {
  return postJson<AgentSession>('session', { language });
}

export async function sendAgentMessage(payload: {
  sessionId: string;
  message: string;
  language: AgentLanguage;
  selectedDressId?: string | null;
  selectedDressImageUrl?: string | null;
  modeHint?: AgentModeHint | null;
}) {
  return postJson<AgentChatResponse>('message', {
    sessionId: payload.sessionId,
    message: payload.message,
    language: payload.language,
    selectedDressId: payload.selectedDressId ?? null,
    selectedDressImageUrl: payload.selectedDressImageUrl ?? null,
    modeHint: payload.modeHint ?? null,
  });
}
