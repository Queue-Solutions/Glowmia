import type { NextApiRequest, NextApiResponse } from 'next';
import { assertEmailConfiguration, isEmailConfigurationError, maskEmailForLogs } from '@/src/lib/sendEmail';
import {
  isCronAuthorized,
  listNewsletterSubscribers,
  sendWeeklyNewsletterEmail,
} from '@/src/lib/newsletter';

type SendFailure = {
  email: string;
  error: string;
};

const NEWSLETTER_BATCH_SIZE = 10;
const NEWSLETTER_BATCH_DELAY_MS = 750;

function wait(delayMs: number) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

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
    assertEmailConfiguration();

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

    for (let index = 0; index < subscribers.length; index += NEWSLETTER_BATCH_SIZE) {
      const batch = subscribers.slice(index, index + NEWSLETTER_BATCH_SIZE);

      console.info('[Newsletter Weekly Send] Processing batch.', {
        batchNumber: Math.floor(index / NEWSLETTER_BATCH_SIZE) + 1,
        batchSize: batch.length,
        totalRecipients: subscribers.length,
      });

      const results = await Promise.allSettled(batch.map((recipient) => sendWeeklyNewsletterEmail(recipient)));

      results.forEach((result, batchIndex) => {
        if (result.status === 'fulfilled') {
          sentCount += 1;
          return;
        }

        failures.push({
          email: maskEmailForLogs(batch[batchIndex] || ''),
          error: result.reason instanceof Error ? result.reason.message : 'Unable to send newsletter email.',
        });
      });

      if (index + NEWSLETTER_BATCH_SIZE < subscribers.length) {
        await wait(NEWSLETTER_BATCH_DELAY_MS);
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
    if (isEmailConfigurationError(error)) {
      response.status(500).json({
        ok: false,
        error: error.message,
      });
      return;
    }

    response.status(500).json({
      ok: false,
      error: 'Unable to send the weekly newsletter right now.',
    });
  }
}
