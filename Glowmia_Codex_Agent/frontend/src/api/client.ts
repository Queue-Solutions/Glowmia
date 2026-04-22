import type { ChatApiResponse, Language } from "../types";

//const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_GLOWMIA_AGENT_API_URL ||
  "http://127.0.0.1:8000/api/v1";

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Request failed");
  }
  return response.json() as Promise<T>;
}

export async function createSession(language: Language) {
  const response = await fetch(`${API_BASE_URL}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language }),
  });

  return parseJson<{ session_id: string; language: Language }>(response);
}

export async function sendMessage(payload: {
  sessionId: string;
  message: string;
  language: Language;
  selectedDressId?: string | null;
  selectedDressImageUrl?: string | null;
}) {
  const response = await fetch(`${API_BASE_URL}/chat/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: payload.sessionId,
      message: payload.message,
      language: payload.language,
      selected_dress_id: payload.selectedDressId,
      selected_dress_image_url: payload.selectedDressImageUrl,
    }),
  });

  return parseJson<ChatApiResponse>(response);
}
