export type DesignFeedbackEntry = {
  id: string;
  designId: string;
  author: string;
  message: string;
  rating: number;
  createdAt: string;
};

export type AgentFeedbackEntry = {
  id: string;
  sessionId: string | null;
  language: 'en' | 'ar';
  rating: number;
  message: string;
  createdAt: string;
};

export type AdminInsights = {
  designLikes: Array<{
    designId: string;
    count: number;
    updatedAt: string | null;
  }>;
  designFeedback: DesignFeedbackEntry[];
  agentFeedback: AgentFeedbackEntry[];
  totals: {
    totalLikes: number;
    designFeedbackCount: number;
    agentFeedbackCount: number;
    averageDesignRating: number;
    averageAgentRating: number;
  };
};

async function postJson<T>(url: string, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? 'Request failed.');
  }

  return payload;
}

export async function listDesignFeedback(designId: string) {
  const response = await fetch(`/api/engagement/design-feedback?designId=${encodeURIComponent(designId)}`);
  const payload = (await response.json()) as { comments?: DesignFeedbackEntry[]; error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? 'Unable to load feedback.');
  }

  return payload.comments ?? [];
}

export async function submitDesignFeedback(input: {
  designId: string;
  author: string;
  message: string;
  rating: number;
}) {
  const payload = await postJson<{ comment: DesignFeedbackEntry }>('/api/engagement/design-feedback', input);
  return payload.comment;
}

export async function syncDesignLike(input: { designId: string; clientId: string; liked: boolean }) {
  const payload = await postJson<{ count: number }>('/api/engagement/design-like', input);
  return payload.count;
}

export async function submitAgentFeedback(input: {
  sessionId: string | null;
  language: 'en' | 'ar';
  rating: number;
  message: string;
}) {
  const payload = await postJson<{ feedback: AgentFeedbackEntry }>('/api/engagement/agent-feedback', input);
  return payload.feedback;
}

export async function fetchAdminInsights() {
  const response = await fetch('/api/admin/insights');
  const payload = (await response.json()) as AdminInsights & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? 'Unable to load insights.');
  }

  return payload;
}
