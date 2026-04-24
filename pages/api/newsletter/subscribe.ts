import type { NextApiRequest, NextApiResponse } from 'next';
import {
  captureNewsletterEmail,
  isDuplicateNewsletterError,
  isValidNewsletterEmail,
  normalizeNewsletterEmail,
  trackEmailEvent,
} from '@/src/lib/newsletter';

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  const email = normalizeNewsletterEmail(request.body?.email);

  if (!email || !isValidNewsletterEmail(email)) {
    response.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
    return;
  }

  try {
    const result = await captureNewsletterEmail({
      email,
      source: 'newsletter',
    });

    if (result.created) {
      await trackEmailEvent({
        email,
        eventType: 'subscribed',
        metadata: {
          source: 'newsletter',
        },
      });
    }

    response.status(result.created ? 201 : 200).json({
      ok: true,
      alreadySubscribed: !result.created,
      message: result.created
        ? 'You are now subscribed to Glowmia updates.'
        : 'You are already subscribed to Glowmia updates.',
    });
  } catch (error) {
    if (isDuplicateNewsletterError(error)) {
      response.status(200).json({
        ok: true,
        alreadySubscribed: true,
        message: 'You are already subscribed to Glowmia updates.',
      });
      return;
    }

    console.error('[Newsletter Subscribe]', error);
    response.status(500).json({
      ok: false,
      error: 'We could not save your subscription right now. Please try again shortly.',
    });
  }
}
