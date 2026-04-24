import type { NextApiRequest, NextApiResponse } from 'next';
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

    for (const cart of carts) {
      try {
        await sendCartReminderEmail({
          email: cart.email,
          items: cart.items,
        });

        if (cart.id) {
          await markCartReminderSent(cart.id);
        }

        sentCount += 1;
      } catch (error) {
        failures.push({
          email: cart.email,
          error: error instanceof Error ? error.message : 'Unable to send cart reminder.',
        });
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
    response.status(500).json({
      ok: false,
      error: 'Unable to send cart reminders right now.',
    });
  }
}
