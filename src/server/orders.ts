import { getAllDesignsFromSupabase } from '@/src/services/dresses';
import { createCheckoutOrders, getSavedDesignById, markSavedDesignOrdered, type CheckoutOrderRecord } from '@/src/lib/glowmiaOrders';
import {
  clearAbandonedCart,
  isValidNewsletterEmail,
  normalizeNewsletterEmail,
  trackEmailEvent,
  upsertNewsletterSubscriber,
} from '@/src/lib/newsletter';
import { sendCustomerOrderEmail, sendTeamOrderNotification } from '@/src/server/email';

type CheckoutItemInput = {
  designId?: unknown;
  size?: unknown;
  quantity?: unknown;
};

export type OrdersCreateRequestBody = {
  customer?: {
    name?: unknown;
    phone?: unknown;
    email?: unknown;
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

export async function createOrderFromRequestBody(
  body: OrdersCreateRequestBody,
  options: { notifyTeam?: boolean } = {},
) {
  const customer = {
    name: readTrimmedString(body.customer?.name),
    phone: readTrimmedString(body.customer?.phone),
    email: normalizeNewsletterEmail(body.customer?.email),
    address: readTrimmedString(body.customer?.address),
    city: readTrimmedString(body.customer?.city),
  };
  const notes = readTrimmedString(body.notes, 1000);
  const userId = readTrimmedString(body.userId, 200) || null;
  const guestId = readTrimmedString(body.guestId, 200) || null;
  const savedDesignId = readTrimmedString(body.savedDesignId, 200);
  const itemInputs = readCheckoutItems(body.items);

  if (!customer.name || !customer.phone || !customer.email || !customer.address || !customer.city) {
    return { status: 400, body: { error: 'Name, phone, email, address, and city are required.' } };
  }

  if (!isValidNewsletterEmail(customer.email)) {
    return { status: 400, body: { error: 'A valid email address is required.' } };
  }

  if (itemInputs.length === 0 && !savedDesignId) {
    return { status: 400, body: { error: 'At least one selected dress is required.' } };
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
        return { status: 404, body: { error: 'The saved design could not be found.' } };
      }

      if (savedDesign.isOrdered) {
        return { status: 409, body: { error: 'This saved design has already been linked to an order.' } };
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
        backViewUrl:
          originalDress?.galleryImages[2] ||
          originalDress?.galleryImages[1] ||
          originalDress?.coverImage ||
          savedDesign.originalImageUrl,
        color: originalDress?.color.ar || originalDress?.color.en || null,
        savedDesignId: savedDesign.id,
        originalImageUrl: savedDesign.originalImageUrl,
        editedImageUrl: savedDesign.editedImageUrl,
      };
    }

    const items = savedDesignItem ? [savedDesignItem, ...cartItems] : cartItems;

    if (items.length === 0) {
      return { status: 400, body: { error: 'The selected dresses are no longer available.' } };
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

    await upsertNewsletterSubscriber({
      email: customer.email,
      source: 'order',
      metadata: {
        order_id: orderReference,
        customer_name: customer.name,
        item_count: items.length,
      },
    });

    await trackEmailEvent({
      email: customer.email,
      eventType: 'order_created',
      metadata: {
        order_id: orderReference,
        customer_name: customer.name,
        items,
      },
    });

    await sendCustomerOrderEmail({
      email: customer.email,
      customerName: customer.name,
      orderId: orderReference,
      items: items.map((item) => ({
        designId: item.designId,
        designName: item.designName,
        imageUrl: item.imageUrl,
        quantity: item.quantity,
        size: item.size,
      })),
    });

    if (options.notifyTeam) {
      await sendTeamOrderNotification({
        orderId: orderReference,
        customer,
        items: items.map((item) => ({
          designId: item.designId,
          designName: item.designName,
          quantity: item.quantity,
          size: item.size,
          color: item.color,
        })),
        notes,
      });
    }

    await clearAbandonedCart(customer.email);

    return {
      status: 201,
      body: {
        ok: true,
        orderId: orderReference,
      },
    };
  } catch (error) {
    console.error('[orders.create] Failed to create order', error);
    return {
      status: 500,
      body: {
        error: error instanceof Error ? error.message : 'Unable to place the order.',
      },
    };
  }
}
