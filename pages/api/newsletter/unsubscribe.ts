import type { NextApiRequest, NextApiResponse } from 'next';
import { unsubscribeNewsletterSubscriber } from '@/src/lib/newsletter';

function renderHtml(title: string, message: string, ctaLabel = 'Return to Glowmia') {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        background: #f7f2eb;
        color: #241715;
        font-family: Arial, sans-serif;
      }

      main {
        width: min(100%, 540px);
        padding: 36px 32px;
        border-radius: 28px;
        background: rgba(255, 251, 247, 0.98);
        border: 1px solid rgba(85, 67, 56, 0.1);
        box-shadow: 0 24px 60px rgba(87, 64, 51, 0.08);
        text-align: center;
      }

      h1 {
        margin: 0 0 12px;
        font-size: 28px;
      }

      p {
        margin: 0 0 24px;
        font-size: 16px;
        line-height: 1.7;
        color: #5d4b43;
      }

      a {
        display: inline-block;
        padding: 14px 22px;
        border-radius: 999px;
        background: linear-gradient(135deg, #89234b 0%, #6d1837 44%, #4e1026 100%);
        color: #fff8f5;
        text-decoration: none;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>${message}</p>
      <a href="/">${ctaLabel}</a>
    </main>
  </body>
</html>`;
}

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  const subscriberId = typeof request.query.subscriber === 'string' ? request.query.subscriber.trim() : '';
  const token = typeof request.query.token === 'string' ? request.query.token.trim() : '';

  try {
    const result = await unsubscribeNewsletterSubscriber({
      subscriberId,
      token,
    });

    if (!result.ok && (result.reason === 'invalid_request' || result.reason === 'invalid_token')) {
      response.status(400).send(renderHtml('Invalid unsubscribe link', 'This unsubscribe link is invalid or has expired.'));
      return;
    }

    if (!result.ok && result.reason === 'not_found') {
      response.status(404).send(renderHtml('Subscription not found', 'We could not find a matching newsletter subscription for this link.'));
      return;
    }

    response
      .status(200)
      .send(
        renderHtml(
          result.alreadyUnsubscribed ? 'Already unsubscribed' : 'You are unsubscribed',
          result.alreadyUnsubscribed
            ? 'This email address has already been removed from Glowmia newsletter and reminder emails.'
            : 'You will no longer receive Glowmia newsletter or cart reminder emails at this address.',
        ),
      );
  } catch (error) {
    console.error('[Newsletter Unsubscribe]', error);
    response.status(500).send(renderHtml('Unable to unsubscribe', 'We could not process the unsubscribe request right now. Please try again shortly.'));
  }
}
