import { sendOrderConfirmationEmail } from '@/src/lib/newsletter';
import { maskEmailForLogs, sendEmail as sendTransactionalEmail } from '@/src/lib/sendEmail';

type TeamOrderNotificationInput = {
  orderId: string;
  createdAt?: string | null;
  customer: {
    name: string;
    phone: string;
    email?: string;
    address: string;
    city: string;
  };
  pricing?: {
    subtotal: number;
    discountCode?: string | null;
    discountPercentage?: number | null;
    discountAmount?: number | null;
    total: number;
  };
  metadata?: {
    paymentMethod?: string | null;
    deliveryMethod?: string | null;
    whatsappNumber?: string | null;
    userId?: string | null;
    guestId?: string | null;
  };
  items: Array<{
    designId: string;
    designName: string;
    designSlug?: string | null;
    quantity: number;
    size: string | null;
    color?: string | null;
    unitPrice?: number | null;
    lineTotal?: number | null;
  }>;
  notes?: string;
};

function readEnv(value: string | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function getEmailTo() {
  return (
    readEnv(process.env.EMAIL_TO) ||
    readEnv(process.env.CHECKOUT_EMAIL_TO) ||
    readEnv(process.env.GLOWMIA_CONTACT_EMAIL) ||
    'glowmiasa@hotmail.com'
  );
}

export function getTransactionalEmailConfig() {
  const to = getEmailTo();

  if (!to) {
    return null;
  }

  return {
    to,
  };
}

export function getTeamOrderNotificationTarget() {
  return getEmailTo();
}

function formatAmount(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(2)} SAR` : 'N/A';
}

function formatValue(value: string | null | undefined) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || 'N/A';
}

function escapeHtml(value: string | null | undefined) {
  return formatValue(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendTeamOrderNotification(input: TeamOrderNotificationInput) {
  const config = getTransactionalEmailConfig();

  if (!config) {
    console.warn('[orders.create] Team order notification skipped because no destination inbox is configured.');
    return { skipped: true };
  }

  console.info('[orders.create] Sending team order notification.', {
    orderId: input.orderId,
    adminEmailTarget: maskEmailForLogs(config.to),
  });

  const itemsHtml = input.items
    .map(
      (item) =>
        `
          <tr>
            <td style="padding:10px;border:1px solid #d8cfc6;vertical-align:top;">${escapeHtml(item.designName)}</td>
            <td style="padding:10px;border:1px solid #d8cfc6;vertical-align:top;">${escapeHtml(item.designId)}</td>
            <td style="padding:10px;border:1px solid #d8cfc6;vertical-align:top;">${escapeHtml(item.designSlug)}</td>
            <td style="padding:10px;border:1px solid #d8cfc6;vertical-align:top;">${escapeHtml(item.size)}</td>
            <td style="padding:10px;border:1px solid #d8cfc6;vertical-align:top;">${escapeHtml(item.color)}</td>
            <td style="padding:10px;border:1px solid #d8cfc6;vertical-align:top;">${item.quantity}</td>
            <td style="padding:10px;border:1px solid #d8cfc6;vertical-align:top;">${formatAmount(item.unitPrice)}</td>
            <td style="padding:10px;border:1px solid #d8cfc6;vertical-align:top;">${formatAmount(item.lineTotal)}</td>
          </tr>
        `,
    )
    .join('');

  const subject = `New Glowmia Order - ${input.customer.name}`;

  const delivery = await sendTransactionalEmail({
    to: config.to,
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;color:#241715;background:#f8f5f1;padding:24px;">
        <div style="max-width:900px;margin:0 auto;background:#ffffff;border:1px solid #e4dbd3;border-radius:18px;overflow:hidden;">
          <div style="padding:24px 28px;border-bottom:1px solid #e4dbd3;background:#f4ede7;">
            <h1 style="margin:0;font-size:26px;line-height:1.3;">New Glowmia Order</h1>
            <p style="margin:10px 0 0;font-size:15px;color:#5d4b43;">Operational order details for preparation.</p>
          </div>

          <div style="padding:24px 28px;">
            <h2 style="margin:0 0 12px;font-size:18px;">Order Summary</h2>
            <table style="width:100%;border-collapse:collapse;margin-bottom:22px;">
              <tbody>
                <tr><td style="padding:8px 0;font-weight:700;width:220px;">Order ID</td><td style="padding:8px 0;">${escapeHtml(input.orderId)}</td></tr>
                <tr><td style="padding:8px 0;font-weight:700;">Timestamp</td><td style="padding:8px 0;">${escapeHtml(input.createdAt)}</td></tr>
                <tr><td style="padding:8px 0;font-weight:700;">Subtotal</td><td style="padding:8px 0;">${formatAmount(input.pricing?.subtotal)}</td></tr>
                <tr><td style="padding:8px 0;font-weight:700;">Discount Code</td><td style="padding:8px 0;">${escapeHtml(input.pricing?.discountCode)}</td></tr>
                <tr><td style="padding:8px 0;font-weight:700;">Discount</td><td style="padding:8px 0;">${input.pricing?.discountPercentage ? `${input.pricing.discountPercentage}%` : 'N/A'}${input.pricing?.discountAmount ? ` (${formatAmount(input.pricing.discountAmount)})` : ''}</td></tr>
                <tr><td style="padding:8px 0;font-weight:700;">Order Total</td><td style="padding:8px 0;">${formatAmount(input.pricing?.total)}</td></tr>
                <tr><td style="padding:8px 0;font-weight:700;">Delivery Method</td><td style="padding:8px 0;">${escapeHtml(input.metadata?.deliveryMethod)}</td></tr>
                <tr><td style="padding:8px 0;font-weight:700;">Payment Method</td><td style="padding:8px 0;">${escapeHtml(input.metadata?.paymentMethod)}</td></tr>
              </tbody>
            </table>

            <h2 style="margin:0 0 12px;font-size:18px;">Customer Details</h2>
            <table style="width:100%;border-collapse:collapse;margin-bottom:22px;">
              <tbody>
                <tr><td style="padding:8px 0;font-weight:700;width:220px;">Customer Name</td><td style="padding:8px 0;">${escapeHtml(input.customer.name)}</td></tr>
                <tr><td style="padding:8px 0;font-weight:700;">Customer Email</td><td style="padding:8px 0;">${escapeHtml(input.customer.email)}</td></tr>
                <tr><td style="padding:8px 0;font-weight:700;">Phone Number</td><td style="padding:8px 0;">${escapeHtml(input.customer.phone)}</td></tr>
                <tr><td style="padding:8px 0;font-weight:700;">WhatsApp Number</td><td style="padding:8px 0;">${escapeHtml(input.metadata?.whatsappNumber || input.customer.phone)}</td></tr>
                <tr><td style="padding:8px 0;font-weight:700;">Address</td><td style="padding:8px 0;">${escapeHtml(input.customer.address)}</td></tr>
                <tr><td style="padding:8px 0;font-weight:700;">City / Governorate</td><td style="padding:8px 0;">${escapeHtml(input.customer.city)}</td></tr>
                <tr><td style="padding:8px 0;font-weight:700;">User ID</td><td style="padding:8px 0;">${escapeHtml(input.metadata?.userId)}</td></tr>
                <tr><td style="padding:8px 0;font-weight:700;">Guest ID</td><td style="padding:8px 0;">${escapeHtml(input.metadata?.guestId)}</td></tr>
              </tbody>
            </table>

            <h2 style="margin:0 0 12px;font-size:18px;">Items</h2>
            <table style="width:100%;border-collapse:collapse;margin-bottom:22px;">
              <thead>
                <tr style="background:#f4ede7;">
                  <th style="padding:10px;border:1px solid #d8cfc6;text-align:left;">Dress / Product</th>
                  <th style="padding:10px;border:1px solid #d8cfc6;text-align:left;">Design ID</th>
                  <th style="padding:10px;border:1px solid #d8cfc6;text-align:left;">Slug</th>
                  <th style="padding:10px;border:1px solid #d8cfc6;text-align:left;">Size</th>
                  <th style="padding:10px;border:1px solid #d8cfc6;text-align:left;">Color</th>
                  <th style="padding:10px;border:1px solid #d8cfc6;text-align:left;">Qty</th>
                  <th style="padding:10px;border:1px solid #d8cfc6;text-align:left;">Unit Price</th>
                  <th style="padding:10px;border:1px solid #d8cfc6;text-align:left;">Line Total</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
            </table>

            <h2 style="margin:0 0 12px;font-size:18px;">Notes</h2>
            <div style="white-space:pre-wrap;line-height:1.7;border:1px solid #e4dbd3;border-radius:12px;padding:14px;background:#faf8f5;">${escapeHtml(input.notes)}</div>
          </div>
        </div>
      </div>
    `,
    tag: 'team-order-notification',
    logContext: 'orders.team-notification',
  });

  console.info('[orders.create] Team order notification sent.', {
    orderId: input.orderId,
    adminEmailTarget: maskEmailForLogs(config.to),
    messageId: delivery.messageId,
  });

  return { skipped: false, messageId: delivery.messageId, to: config.to };
}

export async function sendCustomerOrderEmail(input: {
  email: string;
  customerName?: string | null;
  orderId: string;
  pricing?: {
    subtotal: number;
    discountCode?: string | null;
    discountPercentage?: number | null;
    discountAmount?: number | null;
    finalTotal: number;
  };
  items: Array<{
    designId: string;
    designName: string;
    imageUrl?: string;
    quantity: number;
    size: string | null;
  }>;
}) {
  console.info('[orders.create] Sending customer confirmation email.', {
    orderId: input.orderId,
    customerEmailTarget: maskEmailForLogs(input.email),
  });

  const delivery = await sendOrderConfirmationEmail(input);

  console.info('[orders.create] Customer confirmation email sent.', {
    orderId: input.orderId,
    customerEmailTarget: maskEmailForLogs(input.email),
    messageId: delivery.messageId ?? null,
  });

  return delivery;
}
