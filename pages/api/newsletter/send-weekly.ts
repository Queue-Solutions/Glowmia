import type { NextApiRequest, NextApiResponse } from 'next';
import {
  isCronAuthorized,
  listNewsletterSubscribers,
  sendWeeklyNewsletterEmail,
} from '@/src/lib/newsletter';

type SendFailure = {
  email: string;
  error: string;
};

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'GET' && request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST');
    response.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  if (!isCronAuthorized(request)) {
    response.status(401).json({ ok: false, error: 'Unauthorized.' });
    return;
  }

  try {
    const subscribers = await listNewsletterSubscribers();

    if (subscribers.length === 0) {
      response.status(200).json({
        ok: true,
        sent: 0,
        failed: 0,
        recipients: 0,
        message: 'No newsletter subscribers found.',
      });
      return;
    }

    const failures: SendFailure[] = [];
    let sentCount = 0;

    for (const recipient of subscribers) {
      try {
        await sendWeeklyNewsletterEmail(recipient);
        sentCount += 1;
      } catch (error) {
        failures.push({
          email: recipient,
          error: error instanceof Error ? error.message : 'Unable to send newsletter email.',
        });
      }
    }

    if (sentCount === 0 && failures.length > 0) {
      response.status(502).json({
        ok: false,
        recipients: subscribers.length,
        sent: 0,
        failed: failures.length,
        failures,
        error: 'Newsletter delivery failed for all recipients.',
      });
      return;
    }

    response.status(failures.length > 0 ? 207 : 200).json({
      ok: failures.length === 0,
      recipients: subscribers.length,
      sent: sentCount,
      failed: failures.length,
      failures,
      message:
        failures.length > 0
          ? 'Weekly newsletter sent with some delivery failures.'
          : 'Weekly newsletter sent successfully.',
    });
  } catch (error) {
    console.error('[Newsletter Weekly Send]', error);
    response.status(500).json({
      ok: false,
      error: 'Unable to send the weekly newsletter right now.',
    });
  }
}
