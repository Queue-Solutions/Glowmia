import axios from "axios";

const API = axios.create({
  baseURL: "http://127.0.0.1:8000",
});

// ===== CHAT SESSION =====

export async function createSession() {
  const res = await API.post("/chat/sessions", {
    title: "Frontend Test Session",
  });
  return res.data.session;
}

export async function sendMessage(sessionId, query) {
  const res = await API.post(`/chat/sessions/${sessionId}/recommend`, {
    query,
  });
  return res.data;
}

export async function sendEdit(sessionId, payload) {
  const res = await API.post(`/chat/sessions/${sessionId}/edit`, payload);
  return res.data;
}

export async function getMessages(sessionId) {
  const res = await API.get(`/chat/sessions/${sessionId}/messages`);
  return res.data.messages;
}