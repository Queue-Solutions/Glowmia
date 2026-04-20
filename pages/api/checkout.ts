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

type CheckoutOrderItem = CheckoutOrderRecord['items'][number];

const VALID_SIZES = new Set(['S', 'M', 'L']);
const MAX_FIELD_LENGTH = 300;
const MAX_ITEMS = 30;

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

    response.status(201).json({
      ok: true,
      orderId: orderReference,
    });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Unable to place the order.',
    });
  }
}
