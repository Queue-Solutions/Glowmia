import type { NextApiRequest, NextApiResponse } from 'next';
import { getAllDesignsFromSupabase } from '@/src/services/dresses';
import { localizeText } from '@/src/data/designs';
import { addCheckoutOrder, type StoredCheckoutItem, type StoredCheckoutNotifications } from '@/src/lib/checkoutStore';

type CheckoutItemInput = {
  designId?: unknown;
  size?: unknown;
  quantity?: unknown;
};

type CheckoutRequestBody = {
  customer?: {
    name?: unknown;
    phone?: unknown;
    email?: unknown;
    country?: unknown;
  };
  items?: unknown;
};

type NotificationResult = {
  status: 'sent' | 'skipped' | 'failed';
  error?: string;
};

const VALID_SIZES = new Set(['S', 'M', 'L']);
const MAX_CUSTOMER_FIELD_LENGTH = 160;
const MAX_ITEMS = 30;
const DEFAULT_CHECKOUT_EMAIL_TO = 'queuesolutions25@gmail.com';
const DEFAULT_WHATSAPP_TO = '201090911069';

function readTrimmedString(value: unknown, maxLength = MAX_CUSTOMER_FIELD_LENGTH) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function readCheckoutItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(0, MAX_ITEMS)
    .map((rawItem) => {
      const item = rawItem as CheckoutItemInput;
      const designId = readTrimmedString(item?.designId, 200);
      const size = readTrimmedString(item?.size, 4);
      const quantity = Math.max(1, Math.min(99, Math.round(Number(item?.quantity) || 1)));

      if (!designId || !VALID_SIZES.has(size)) {
        return null;
      }

      return {
        designId,
        size: size as 'S' | 'M' | 'L',
        quantity,
      };
    })
    .filter((item): item is { designId: string; size: 'S' | 'M' | 'L'; quantity: number } => Boolean(item));
}

function getBaseUrl(request: NextApiRequest) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configured) {
    return configured.replace(/\/$/, '');
  }

  const proto = request.headers['x-forwarded-proto'] || 'http';
  const host = request.headers.host || 'localhost:3001';
  return `${Array.isArray(proto) ? proto[0] : proto}://${host}`;
}

function formatOrderMessage(input: {
  orderId?: string;
  customer: { name: string; phone: string; email: string; country: string };
  items: StoredCheckoutItem[];
  baseUrl: string;
}) {
  const totalItems = input.items.reduce((sum, item) => sum + item.quantity, 0);
  const itemLines = input.items
    .map((item, index) => {
      const designUrl = `${input.baseUrl}/designs/${item.slug}`;
      return [
        `${index + 1}) ${item.designName}`,
        `   Dress ID: ${item.designId}`,
        `   Size: ${item.size}`,
        `   Qty: ${item.quantity}`,
        `   Link: ${designUrl}`,
      ].join('\n');
    })
    .join('\n\n');

  return [
    'GLOWMIA CHECKOUT RECEIPT',
    '========================',
    input.orderId ? `Receipt No: ${input.orderId}` : null,
    `Date: ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' })}`,
    `Total items: ${totalItems}`,
    '',
    'CUSTOMER CREDENTIALS',
    '--------------------',
    `Full name: ${input.customer.name}`,
    `Phone number: ${input.customer.phone}`,
    `Email address: ${input.customer.email}`,
    `Country / county: ${input.customer.country}`,
    '',
    'CHOSEN DRESSES',
    '--------------',
    itemLines,
    '',
    'Please contact the customer to confirm availability, sizing, and final details.',
  ]
    .filter((line) => line !== null)
    .join('\n');
}

async function sendEmail(message: string, customerEmail: string): Promise<NotificationResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const to = process.env.CHECKOUT_EMAIL_TO?.trim() || DEFAULT_CHECKOUT_EMAIL_TO;
  const from = process.env.CHECKOUT_EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    return { status: 'skipped' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: customerEmail,
        subject: 'Glowmia checkout receipt',
        text: message,
      }),
    });

    if (!response.ok) {
      return { status: 'failed', error: await response.text() };
    }

    return { status: 'sent' };
  } catch (error) {
    return { status: 'failed', error: error instanceof Error ? error.message : 'Unable to send email.' };
  }
}

async function sendWhatsapp(message: string): Promise<NotificationResult> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const to = (process.env.WHATSAPP_TO?.trim() || DEFAULT_WHATSAPP_TO).replace(/[^\d]/g, '');

  if (!accessToken || !phoneNumberId) {
    return { status: 'skipped' };
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: {
          preview_url: true,
          body: message,
        },
      }),
    });

    if (!response.ok) {
      return { status: 'failed', error: await response.text() };
    }

    return { status: 'sent' };
  } catch (error) {
    return { status: 'failed', error: error instanceof Error ? error.message : 'Unable to send WhatsApp message.' };
  }
}

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const body = request.body as CheckoutRequestBody;
  const customer = {
    name: readTrimmedString(body.customer?.name),
    phone: readTrimmedString(body.customer?.phone),
    email: readTrimmedString(body.customer?.email),
    country: readTrimmedString(body.customer?.country),
  };
  const itemInputs = readCheckoutItems(body.items);

  if (!customer.name || !customer.phone || !customer.email || !customer.country) {
    response.status(400).json({ error: 'Name, phone number, email, and country/county are required.' });
    return;
  }

  if (!customer.email.includes('@')) {
    response.status(400).json({ error: 'A valid email address is required.' });
    return;
  }

  if (itemInputs.length === 0) {
    response.status(400).json({ error: 'At least one selected dress is required.' });
    return;
  }

  const designs = await getAllDesignsFromSupabase();
  const designsById = new Map(designs.map((design) => [design.id, design]));
  const items: StoredCheckoutItem[] = itemInputs
    .map((item) => {
      const design = designsById.get(item.designId);

      if (!design) {
        return null;
      }

      return {
        designId: item.designId,
        designName: localizeText('en', design.name),
        slug: design.slug,
        size: item.size,
        quantity: item.quantity,
        imageUrl: design.coverImage,
      };
    })
    .filter((item): item is StoredCheckoutItem => Boolean(item));

  if (items.length === 0) {
    response.status(400).json({ error: 'The selected dresses are no longer available.' });
    return;
  }

  const baseUrl = getBaseUrl(request);
  const orderId = `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const message = formatOrderMessage({ orderId, customer, items, baseUrl });
  const [emailResult, whatsappResult] = await Promise.all([
    sendEmail(message, customer.email),
    sendWhatsapp(message),
  ]);
  const notifications: StoredCheckoutNotifications = {
    email: emailResult.status,
    whatsapp: whatsappResult.status,
  };

  const order = await addCheckoutOrder({
    id: orderId,
    customer,
    items,
    notifications,
  });

  response.status(201).json({
    ok: true,
    orderId: order.id,
    notifications,
  });
}
