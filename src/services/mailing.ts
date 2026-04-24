export type PublicCaptureSource = 'agent' | 'cart' | 'checkout';

export type PublicMailingCartItem = {
  designId?: string;
  designName?: string;
  imageUrl?: string;
  quantity?: number;
  size?: string | null;
  href?: string | null;
};

const EMAIL_STORAGE_KEY = 'glowmia:contact-email';

export function normalizeClientEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidClientEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeClientEmail(value));
}

export function getStoredContactEmail() {
  if (typeof window === 'undefined') {
    return '';
  }

  return normalizeClientEmail(window.localStorage.getItem(EMAIL_STORAGE_KEY) || '');
}

export function setStoredContactEmail(email: string) {
  if (typeof window === 'undefined') {
    return;
  }

  const normalized = normalizeClientEmail(email);

  if (!normalized) {
    window.localStorage.removeItem(EMAIL_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(EMAIL_STORAGE_KEY, normalized);
}

export async function captureMailingEmail(input: {
  email: string;
  source: PublicCaptureSource;
  items?: PublicMailingCartItem[];
  metadata?: Record<string, unknown>;
}) {
  const response = await fetch('/api/newsletter/capture', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: normalizeClientEmail(input.email),
      source: input.source,
      items: input.items ?? [],
      metadata: input.metadata ?? {},
    }),
  });

  const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || 'Unable to capture the email.');
  }

  return payload;
}
