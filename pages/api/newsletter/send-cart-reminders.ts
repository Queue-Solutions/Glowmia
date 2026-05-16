import type { NextApiRequest, NextApiResponse } from 'next';
import { assertEmailConfiguration, isEmailConfigurationError, maskEmailForLogs } from '@/src/lib/sendEmail';
import {
  isCronAuthorized,
  listRemindableAbandonedCarts,
  markCartReminderSent,
  sendCartReminderEmail,
} from '@/src/lib/newsletter';

type SendFailure = {
  email: string;
  error: string;
};

const CART_REMINDER_BATCH_SIZE = 10;
const CART_REMINDER_BATCH_DELAY_MS = 500;

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

    const carts = await listRemindableAbandonedCarts();

    if (carts.length === 0) {
      response.status(200).json({
        ok: true,
        recipients: 0,
        sent: 0,
        failed: 0,
        message: 'No abandoned carts are ready for reminders.',
      });
      return;
    }

    const failures: SendFailure[] = [];
    let sentCount = 0;

    for (let index = 0; index < carts.length; index += CART_REMINDER_BATCH_SIZE) {
      const batch = carts.slice(index, index + CART_REMINDER_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (cart) => {
          await sendCartReminderEmail({
            email: cart.email,
            items: cart.items,
          });

          if (cart.id) {
            await markCartReminderSent(cart.id);
          }
        }),
      );

      results.forEach((result, batchIndex) => {
        if (result.status === 'fulfilled') {
          sentCount += 1;
          return;
        }

        failures.push({
          email: maskEmailForLogs(batch[batchIndex]?.email || ''),
          error: result.reason instanceof Error ? result.reason.message : 'Unable to send cart reminder.',
        });
      });

      if (index + CART_REMINDER_BATCH_SIZE < carts.length) {
        await wait(CART_REMINDER_BATCH_DELAY_MS);
      }
    }

    response.status(failures.length > 0 ? 207 : 200).json({
      ok: failures.length === 0,
      recipients: carts.length,
      sent: sentCount,
      failed: failures.length,
      failures,
      message:
        failures.length > 0
          ? 'Cart reminders sent with some delivery failures.'
          : 'Cart reminders sent successfully.',
    });
  } catch (error) {
    console.error('[Newsletter Cart Reminders]', error);
    if (isEmailConfigurationError(error)) {
      response.status(500).json({
        ok: false,
        error: error.message,
      });
      return;
    }

    response.status(500).json({
      ok: false,
      error: 'Unable to send cart reminders right now.',
    });
  }
}
