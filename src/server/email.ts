import { sendOrderConfirmationEmail } from '@/src/lib/newsletter';
import { sendEmail as sendTransactionalEmail } from '@/src/lib/sendEmail';

type TeamOrderNotificationInput = {
  orderId: string;
  customer: {
    name: string;
    phone: string;
    email?: string;
    address: string;
    city: string;
  };
  items: Array<{
    designId: string;
    designName: string;
    quantity: number;
    size: string | null;
    color?: string | null;
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

export async function sendTeamOrderNotification(input: TeamOrderNotificationInput) {
  const config = getTransactionalEmailConfig();

  if (!config) {
    console.warn('[orders.create] Team order notification skipped because no destination inbox is configured.');
    return { skipped: true };
  }

  const itemsHtml = input.items
    .map(
      (item) =>
        `<li><strong>${item.designName}</strong> (${item.designId})${item.size ? ` - Size: ${item.size}` : ''} - Qty: ${item.quantity}${item.color ? ` - Color: ${item.color}` : ''}</li>`,
    )
    .join('');

  const subject = `New Glowmia Order ${input.orderId}`;

  await sendTransactionalEmail({
    to: config.to,
    subject,
    html: `
      <div>
        <h1>New Glowmia order</h1>
        <p><strong>Order ID:</strong> ${input.orderId}</p>
        <p><strong>Name:</strong> ${input.customer.name}</p>
        <p><strong>Phone:</strong> ${input.customer.phone}</p>
        <p><strong>Email:</strong> ${input.customer.email || 'N/A'}</p>
        <p><strong>Address:</strong> ${input.customer.address}</p>
        <p><strong>City:</strong> ${input.customer.city}</p>
        <p><strong>Notes:</strong> ${input.notes || 'N/A'}</p>
        <h2>Items</h2>
        <ul>${itemsHtml}</ul>
      </div>
    `,
    tag: 'team-order-notification',
    logContext: 'orders.team-notification',
  });

  return { skipped: false };
}

export async function sendCustomerOrderEmail(input: {
  email: string;
  customerName?: string | null;
  orderId: string;
  items: Array<{
    designId: string;
    designName: string;
    imageUrl?: string;
    quantity: number;
    size: string | null;
  }>;
}) {
  return sendOrderConfirmationEmail(input);
}
