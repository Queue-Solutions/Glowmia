import type { NextApiRequest, NextApiResponse } from 'next';
import type { CaptureSource } from '@/src/lib/newsletter';
import { captureNewsletterEmail, isValidNewsletterEmail, normalizeNewsletterEmail } from '@/src/lib/newsletter';

const ALLOWED_SOURCES = new Set<CaptureSource>([
  'newsletter',
  'agent',
  'cart',
  'checkout',
  'order',
  'saved_design',
  'designer_request',
]);

function isCaptureSource(value: string): value is CaptureSource {
  return ALLOWED_SOURCES.has(value as CaptureSource);
}

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  const email = normalizeNewsletterEmail(request.body?.email);
  const rawSource = typeof request.body?.source === 'string' ? request.body.source.trim() : '';
  const items = Array.isArray(request.body?.items) ? request.body.items : [];
  const metadata =
    request.body?.metadata && typeof request.body.metadata === 'object' && !Array.isArray(request.body.metadata)
      ? (request.body.metadata as Record<string, unknown>)
      : null;

  if (!email || !isValidNewsletterEmail(email)) {
    response.status(400).json({ ok: false, error: 'A valid email address is required.' });
    return;
  }

  if (!isCaptureSource(rawSource)) {
    response.status(400).json({ ok: false, error: 'A valid source is required.' });
    return;
  }

  try {
    const result = await captureNewsletterEmail({
      email,
      source: rawSource,
      metadata,
      abandonedCartItems: items,
    });

    response.status(200).json({
      ok: true,
      created: result.created,
      abandonedCartCreated: result.abandonedCartCreated,
    });
  } catch (error) {
    console.error('[Newsletter Capture]', error);
    response.status(500).json({
      ok: false,
      error: 'Unable to capture the email right now.',
    });
  }
}
