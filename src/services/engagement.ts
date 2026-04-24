import { getSupabaseClient } from '@/src/lib/supabase';

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

export type SavedDesignOrderEntry = {
  id: string;
  sessionId: string | null;
  language: 'en' | 'ar';
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  dressId: string;
  dressName: string;
  originalImageUrl: string;
  editedImageUrl: string;
  createdAt: string;
};

export type SavedDesignEntry = {
  id: string;
  userId: string | null;
  guestId: string | null;
  dressId: string;
  orderId: string | null;
  originalImageUrl: string;
  editedImageUrl: string;
  prompt: string;
  designName: string;
  notes: string;
  isOrdered: boolean;
  createdAt: string;
  sessionId?: string | null;
  language?: 'en' | 'ar';
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  email?: string | null;
};

export type AdminInsights = {
  designLikes: Array<{
    designId: string;
    count: number;
    updatedAt: string | null;
  }>;
  designFeedback: DesignFeedbackEntry[];
  agentFeedback: AgentFeedbackEntry[];
  savedDesignOrders: SavedDesignOrderEntry[];
  totals: {
    totalLikes: number;
    designFeedbackCount: number;
    agentFeedbackCount: number;
    savedDesignOrdersCount: number;
    averageDesignRating: number;
    averageAgentRating: number;
  };
};

export type CheckoutOrderEntry = {
  id: string;
  customer: {
    name: string;
    phone: string;
    address: string;
    city: string;
  };
  items: Array<{
    designId: string;
    designName: string;
    size: string | null;
    quantity: number;
    imageUrl: string;
    frontViewUrl: string;
    sideViewUrl: string;
    backViewUrl: string;
    color: string | null;
  }>;
  notes: string;
  status: string;
  createdAt: string;
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

export async function submitSavedDesignOrder(input: {
  sessionId: string | null;
  language: 'en' | 'ar';
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  userId?: string | null;
  guestId?: string | null;
  dressId: string;
  dressName: string;
  originalImageUrl: string;
  editedImageUrl: string;
  prompt?: string;
}) {
  const payload = await postJson<{ savedDesign: SavedDesignEntry }>('/api/engagement/agent-design-order', input);
  return payload.savedDesign;
}

export async function fetchSavedDesign(savedDesignId: string) {
  const response = await fetch(`/api/engagement/saved-design?id=${encodeURIComponent(savedDesignId)}`);
  const payload = (await response.json()) as { savedDesign?: SavedDesignEntry | null; error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? 'Unable to load the saved design.');
  }

  return payload.savedDesign ?? null;
}

export async function resolveViewerIdentity() {
  const guestStorageKey = 'glowmia:guest-id';
  const supabase = getSupabaseClient();

  if (supabase) {
    const { data, error } = await supabase.auth.getUser();

    if (!error && data.user?.id) {
      return { userId: data.user.id, guestId: null };
    }
  }

  if (typeof window === 'undefined') {
    return { userId: null, guestId: null };
  }

  const existingGuestId = window.localStorage.getItem(guestStorageKey)?.trim();

  if (existingGuestId) {
    return { userId: null, guestId: existingGuestId };
  }

  const nextGuestId =
    typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `guest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  window.localStorage.setItem(guestStorageKey, nextGuestId);
  return { userId: null, guestId: nextGuestId };
}

export async function fetchAdminInsights() {
  const response = await fetch('/api/admin/insights');
  const payload = (await response.json()) as AdminInsights & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? 'Unable to load insights.');
  }

  return payload;
}

export async function fetchAdminCheckoutOrders() {
  const response = await fetch('/api/admin/checkout-orders');
  const payload = (await response.json()) as { orders?: CheckoutOrderEntry[]; error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? 'Unable to load checkout orders.');
  }

  return payload.orders ?? [];
}
