import { getAllDesignsFromSupabase } from '@/src/services/dresses';
import { createCheckoutOrders, getSavedDesignById, markSavedDesignOrdered, type CheckoutOrderRecord } from '@/src/lib/glowmiaOrders';
import { redeemDiscountCode, validateDiscountCode } from '@/src/lib/discountCodes';
import {
  clearAbandonedCart,
  isValidNewsletterEmail,
  normalizeNewsletterEmail,
  trackEmailEvent,
  upsertNewsletterSubscriber,
} from '@/src/lib/newsletter';
import { calculateDiscountAmount } from '@/src/lib/pricing';
import { getTeamOrderNotificationTarget, sendCustomerOrderEmail, sendTeamOrderNotification } from '@/src/server/email';
import { isEmailConfigurationError, maskEmailForLogs } from '@/src/lib/sendEmail';

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
  discountCode?: unknown;
  userId?: unknown;
  guestId?: unknown;
};

type EmailDeliveryStatus = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
  messageId?: string | null;
  target?: string;
};

function readFirstOrderTimestamp(createdAt: string | undefined) {
  return createdAt || new Date().toISOString();
}

type CheckoutOrderItem = CheckoutOrderRecord['items'][number];

const VALID_SIZES = new Set(['S', 'M', 'L', 'XL']);
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
  const discountCode = readTrimmedString(body.discountCode, 80).toUpperCase();
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
        unitPrice: design.price ?? 0,
        lineTotal: (design.price ?? 0) * item.quantity,
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
        unitPrice: originalDress?.price ?? 0,
        lineTotal: originalDress?.price ?? 0,
      };
    }

    const items = savedDesignItem ? [savedDesignItem, ...cartItems] : cartItems;

    if (items.length === 0) {
      return { status: 400, body: { error: 'The selected dresses are no longer available.' } };
    }

    const subtotal = items.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0);
    let appliedDiscount: { code: string; percentage: number; amount: number } | null = null;
    let discountAmount = 0;

    if (discountCode) {
      const validDiscount = await validateDiscountCode(discountCode);

      if (!validDiscount) {
        return { status: 400, body: { error: 'This discount code is invalid or has already been used.' } };
      }

      discountAmount = calculateDiscountAmount(subtotal, validDiscount.percentage);
      appliedDiscount = {
        code: validDiscount.code,
        percentage: validDiscount.percentage,
        amount: discountAmount,
      };
    }
    const finalTotal = Math.max(0, subtotal - discountAmount);

    const pricingNote =
      subtotal > 0
        ? [
            `Subtotal: ${subtotal}`,
            appliedDiscount ? `Discount ${appliedDiscount.code} (${appliedDiscount.percentage}%): -${discountAmount}` : '',
            `Total: ${finalTotal}`,
          ]
            .filter(Boolean)
            .join('\n')
        : '';
    const orderNotes = [notes, pricingNote].filter(Boolean).join('\n\n');

    const createdOrders = await createCheckoutOrders({
      customer,
      items,
      notes: orderNotes,
      pricing: {
        couponCode: appliedDiscount?.code ?? null,
        discountPercentage: appliedDiscount?.percentage ?? null,
        discountAmount,
        finalTotal,
      },
      userId: savedDesign?.userId || userId,
      guestId: savedDesign?.guestId || guestId,
      status: 'pending',
    });

    const orderReference = createdOrders[0]?.id || '';
    const orderTimestamp = readFirstOrderTimestamp(createdOrders[0]?.createdAt);

    console.info('[orders.create] Order saved.', {
      orderId: orderReference,
      customerEmailTarget: maskEmailForLogs(customer.email),
      adminEmailTarget: maskEmailForLogs(getTeamOrderNotificationTarget()),
      itemCount: items.length,
      notifyTeam: Boolean(options.notifyTeam),
    });

    if (savedDesign?.id && orderReference) {
      await markSavedDesignOrdered(savedDesign.id, orderReference);
    }

    if (appliedDiscount && orderReference) {
      await redeemDiscountCode({
        code: appliedDiscount.code,
        orderId: orderReference,
        customerName: customer.name,
      });
    }

    await upsertNewsletterSubscriber({
      email: customer.email,
      source: 'order',
      metadata: {
        order_id: orderReference,
        customer_name: customer.name,
        item_count: items.length,
        discount_code: appliedDiscount?.code ?? null,
        discount_amount: appliedDiscount?.amount ?? 0,
      },
    });

    await trackEmailEvent({
      email: customer.email,
      eventType: 'order_created',
      metadata: {
        order_id: orderReference,
        customer_name: customer.name,
        items,
        subtotal,
        discount: appliedDiscount,
        total: finalTotal,
      },
    });

    const customerEmailPayload = {
      email: customer.email,
      customerName: customer.name,
      orderId: orderReference,
      pricing: {
        subtotal,
        discountCode: appliedDiscount?.code ?? null,
        discountPercentage: appliedDiscount?.percentage ?? null,
        discountAmount,
        finalTotal,
      },
      items: items.map((item) => ({
        designId: item.designId,
        designName: item.designName,
        imageUrl: item.imageUrl,
        quantity: item.quantity,
        size: item.size,
      })),
    };
    const teamEmailPayload = {
      orderId: orderReference,
      createdAt: orderTimestamp,
      customer,
      pricing: {
        subtotal,
        discountCode: appliedDiscount?.code ?? null,
        discountPercentage: appliedDiscount?.percentage ?? null,
        discountAmount: appliedDiscount?.amount ?? null,
        total: finalTotal,
      },
      metadata: {
        paymentMethod: null,
        deliveryMethod: null,
        whatsappNumber: customer.phone,
        userId,
        guestId,
      },
      items: items.map((item) => ({
        designId: item.designId,
        designName: item.designName,
        designSlug: designsById.get(item.designId)?.slug ?? null,
        quantity: item.quantity,
        size: item.size,
        color: item.color,
        unitPrice: item.unitPrice ?? null,
        lineTotal: item.lineTotal ?? null,
      })),
      notes: orderNotes,
    };
    const emailStatus: {
      customer: EmailDeliveryStatus;
      team: EmailDeliveryStatus;
    } = {
      customer: {
        ok: false,
        target: maskEmailForLogs(customer.email),
      },
      team: {
        ok: false,
        target: maskEmailForLogs(getTeamOrderNotificationTarget()),
        skipped: !options.notifyTeam,
      },
    };

    try {
      const delivery = await sendCustomerOrderEmail(customerEmailPayload);
      emailStatus.customer = {
        ok: true,
        messageId: delivery.messageId ?? null,
        target: maskEmailForLogs(customer.email),
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to send customer confirmation email.';

      console.error('[orders.create] Customer confirmation email failed.', {
        orderId: orderReference,
        customerEmailTarget: maskEmailForLogs(customer.email),
        error: message,
        isConfigurationError: isEmailConfigurationError(error),
      });

      emailStatus.customer = {
        ok: false,
        error: message,
        target: maskEmailForLogs(customer.email),
      };
    }

    if (options.notifyTeam) {
      try {
        const delivery = await sendTeamOrderNotification(teamEmailPayload);
        emailStatus.team = {
          ok: !delivery.skipped,
          skipped: Boolean(delivery.skipped),
          messageId: delivery.messageId ?? null,
          target: maskEmailForLogs(delivery.to || getTeamOrderNotificationTarget()),
        };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to send admin order notification.';

        console.error('[orders.create] Team order notification failed.', {
          orderId: orderReference,
          adminEmailTarget: maskEmailForLogs(getTeamOrderNotificationTarget()),
          error: message,
          isConfigurationError: isEmailConfigurationError(error),
        });

        emailStatus.team = {
          ok: false,
          error: message,
          target: maskEmailForLogs(getTeamOrderNotificationTarget()),
        };
      }
    }

    await clearAbandonedCart(customer.email);

    return {
      status: 201,
      body: {
        ok: true,
        orderId: orderReference,
        discount: appliedDiscount,
        finalTotal,
        ...(process.env.NODE_ENV !== 'production'
          ? {
              emailStatus,
            }
          : {}),
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
