import type { NextApiRequest, NextApiResponse } from 'next';
import { getAllDesignsFromSupabase } from '@/src/services/dresses';
import { createCheckoutOrders, getSavedDesignById, markSavedDesignOrdered, type CheckoutOrderRecord } from '@/src/lib/glowmiaOrders';

type CheckoutItemInput = {
  designId?: unknown;
  size?: unknown;
  quantity?: unknown;
};

type CheckoutRequestBody = {
  customer?: {
    name?: unknown;
    phone?: unknown;
    address?: unknown;
    city?: unknown;
  };
  items?: unknown;
  notes?: unknown;
  savedDesignId?: unknown;
  userId?: unknown;
  guestId?: unknown;
};

type NotificationResult = {
  status: 'sent' | 'skipped' | 'failed';
  error?: string;
};

type CheckoutOrderItem = CheckoutOrderRecord['items'][number];

const VALID_SIZES = new Set(['S', 'M', 'L']);
const MAX_FIELD_LENGTH = 300;
const MAX_ITEMS = 30;
const DEFAULT_CHECKOUT_EMAIL_TO = 'queuesolutions25@gmail.com';

function readTrimmedString(value: unknown, maxLength = MAX_FIELD_LENGTH) {
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
      const size = readTrimmedString(item?.size, 24);
      const quantity = Math.max(1, Math.min(99, Math.round(Number(item?.quantity) || 1)));

      if (!designId || !VALID_SIZES.has(size)) {
        return null;
      }

      return {
        designId,
        size,
        quantity,
      };
    })
    .filter((item): item is { designId: string; size: string; quantity: number } => Boolean(item));
}

function formatMultiValueField(values: Array<string | null | undefined>) {
  const normalized = values.map((value) => value?.trim()).filter((value): value is string => Boolean(value));
  return normalized.length > 0 ? normalized.join('\n') : '';
}

function buildFormSubmitPayload(input: {
  orderReference: string;
  customer: { name: string; phone: string; address: string; city: string };
  notes: string;
  items: CheckoutOrderItem[];
}) {
  const payload = new URLSearchParams();

  payload.set('_subject', 'New Glowmia Order');
  payload.set('_template', 'table');
  payload.set('_captcha', 'false');

  payload.set('order_reference', input.orderReference);
  payload.set('customer_name', input.customer.name);
  payload.set('phone', input.customer.phone);
  payload.set('email', '');
  payload.set('address', input.customer.address);
  payload.set('city', input.customer.city);
  payload.set('notes', input.notes);
  payload.set('dress_id', formatMultiValueField(input.items.map((item) => item.designId)));
  payload.set('dress_name', formatMultiValueField(input.items.map((item) => item.designName)));
  payload.set('size', formatMultiValueField(input.items.map((item) => item.size || 'custom')));
  payload.set('color', formatMultiValueField(input.items.map((item) => item.color || '')));
  payload.set('quantity', formatMultiValueField(input.items.map((item) => String(item.quantity))));
  payload.set('saved_design_id', formatMultiValueField(input.items.map((item) => item.savedDesignId || '')));
  payload.set('edited_image_url', formatMultiValueField(input.items.map((item) => item.editedImageUrl || '')));
  payload.set('order_total', '');
  payload.set('front_view_url', formatMultiValueField(input.items.map((item) => item.frontViewUrl)));
  payload.set('side_view_url', formatMultiValueField(input.items.map((item) => item.sideViewUrl || '')));
  payload.set('back_view_url', formatMultiValueField(input.items.map((item) => item.backViewUrl || '')));
  payload.set(
    'items_summary',
    input.items
      .map((item, index) =>
        [
          `${index + 1}. ${item.designName}`,
          `Dress ID: ${item.designId}`,
          `Size: ${item.size || 'custom'}`,
          `Color: ${item.color || '-'}`,
          `Quantity: ${item.quantity}`,
          `Saved design ID: ${item.savedDesignId || '-'}`,
          `Edited image: ${item.editedImageUrl || '-'}`,
        ].join(' | '),
      )
      .join('\n'),
  );

  return payload;
}

async function sendEmailViaFormSubmit(payload: URLSearchParams): Promise<NotificationResult> {
  const to = process.env.CHECKOUT_EMAIL_TO?.trim() || DEFAULT_CHECKOUT_EMAIL_TO;

  try {
    const apiResponse = await fetch(`https://formsubmit.co/${encodeURIComponent(to)}`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: payload.toString(),
    });

    if (apiResponse.status >= 400) {
      return { status: 'failed', error: await apiResponse.text() };
    }

    return { status: 'sent' };
  } catch (error) {
    return { status: 'failed', error: error instanceof Error ? error.message : 'Unable to send email.' };
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
    address: readTrimmedString(body.customer?.address),
    city: readTrimmedString(body.customer?.city),
  };
  const notes = readTrimmedString(body.notes, 1000);
  const userId = readTrimmedString(body.userId, 200) || null;
  const guestId = readTrimmedString(body.guestId, 200) || null;
  const savedDesignId = readTrimmedString(body.savedDesignId, 200);
  const itemInputs = readCheckoutItems(body.items);

  if (!customer.name || !customer.phone || !customer.address || !customer.city) {
    response.status(400).json({ error: 'Name, phone, address, and city are required.' });
    return;
  }

  if (itemInputs.length === 0 && !savedDesignId) {
    response.status(400).json({ error: 'At least one selected dress is required.' });
    return;
  }

  try {
    const designs = await getAllDesignsFromSupabase();
    const designsById = new Map(designs.map((design) => [design.id, design]));
    const cartItems = itemInputs.reduce<CheckoutOrderItem[]>((accumulator, item) => {
      const design = designsById.get(item.designId);

      if (!design) {
        return accumulator;
      }

      accumulator.push({
        designId: item.designId,
        designName: design.name.ar || design.name.en,
        size: item.size,
        quantity: item.quantity,
        imageUrl: design.coverImage,
        frontViewUrl: design.coverImage,
        sideViewUrl: design.galleryImages[1] || design.coverImage,
        backViewUrl: design.galleryImages[2] || design.galleryImages[1] || design.coverImage,
        color: design.color.ar || design.color.en,
      });

      return accumulator;
    }, []);

    let savedDesign = null;
    let savedDesignItem: CheckoutOrderItem | null = null;

    if (savedDesignId) {
      savedDesign = await getSavedDesignById(savedDesignId);

      if (!savedDesign) {
        response.status(404).json({ error: 'The saved design could not be found.' });
        return;
      }

      if (savedDesign.isOrdered) {
        response.status(409).json({ error: 'This saved design has already been linked to an order.' });
        return;
      }

      const originalDress = designsById.get(savedDesign.dressId) ?? null;
      savedDesignItem = {
        designId: savedDesign.dressId,
        designName: originalDress?.name.ar || savedDesign.designName || originalDress?.name.en || 'تصميم محفوظ',
        size: null,
        quantity: 1,
        imageUrl: savedDesign.editedImageUrl || savedDesign.originalImageUrl,
        frontViewUrl: savedDesign.editedImageUrl || savedDesign.originalImageUrl,
        sideViewUrl: originalDress?.galleryImages[1] || originalDress?.coverImage || savedDesign.originalImageUrl,
        backViewUrl: originalDress?.galleryImages[2] || originalDress?.galleryImages[1] || originalDress?.coverImage || savedDesign.originalImageUrl,
        color: originalDress?.color.ar || originalDress?.color.en || null,
        savedDesignId: savedDesign.id,
        originalImageUrl: savedDesign.originalImageUrl,
        editedImageUrl: savedDesign.editedImageUrl,
      };
    }

    const items = savedDesignItem ? [savedDesignItem, ...cartItems] : cartItems;

    if (items.length === 0) {
      response.status(400).json({ error: 'The selected dresses are no longer available.' });
      return;
    }

    const createdOrders = await createCheckoutOrders({
      customer,
      items,
      notes,
      userId: savedDesign?.userId || userId,
      guestId: savedDesign?.guestId || guestId,
      status: 'pending',
    });

    const orderReference = createdOrders[0]?.id || '';

    if (savedDesign?.id && orderReference) {
      await markSavedDesignOrdered(savedDesign.id, orderReference);
    }

    const emailPayload = buildFormSubmitPayload({
      orderReference,
      customer,
      notes,
      items,
    });
    const emailResult = await sendEmailViaFormSubmit(emailPayload);

    if (emailResult.status === 'failed') {
      console.error('FormSubmit order email failed:', emailResult.error || 'Unknown FormSubmit error.');
    }

    response.status(201).json({
      ok: true,
      orderId: orderReference,
      emailStatus: emailResult.status,
      emailError: emailResult.status === 'failed' ? emailResult.error || 'Unable to send order email.' : null,
    });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Unable to place the order.',
    });
  }
}
