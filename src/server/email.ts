import { Resend } from 'resend';
import { sendOrderConfirmationEmail } from '@/src/lib/newsletter';

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

function getEmailApiKey() {
  return readEnv(process.env.EMAIL_API_KEY) || readEnv(process.env.RESEND_API_KEY);
}

function getEmailFrom() {
  return readEnv(process.env.EMAIL_FROM) || readEnv(process.env.NEWSLETTER_FROM_EMAIL);
}

function getEmailTo() {
  return (
    readEnv(process.env.EMAIL_TO) ||
    readEnv(process.env.CHECKOUT_EMAIL_TO) ||
    readEnv(process.env.GLOWMIA_CONTACT_EMAIL) ||
    'glowmia.sa@hotmail.com'
  );
}

export function getTransactionalEmailConfig() {
  const apiKey = getEmailApiKey();
  const from = getEmailFrom();
  const to = getEmailTo();

  if (!apiKey || !from || !to) {
    return null;
  }

  return {
    resend: new Resend(apiKey),
    from,
    to,
  };
}

export async function sendTeamOrderNotification(input: TeamOrderNotificationInput) {
  const config = getTransactionalEmailConfig();

  if (!config) {
    console.warn('[orders.create] Team order notification skipped because EMAIL_API_KEY/EMAIL_FROM/EMAIL_TO are not fully configured.');
    return { skipped: true };
  }

  const itemsHtml = input.items
    .map(
      (item) =>
        `<li><strong>${item.designName}</strong> (${item.designId})${item.size ? ` - Size: ${item.size}` : ''} - Qty: ${item.quantity}${item.color ? ` - Color: ${item.color}` : ''}</li>`,
    )
    .join('');

  const itemsText = input.items
    .map(
      (item) =>
        `${item.designName} (${item.designId})${item.size ? ` - Size: ${item.size}` : ''} - Qty: ${item.quantity}${item.color ? ` - Color: ${item.color}` : ''}`,
    )
    .join('\n');

  const subject = `New Glowmia Order ${input.orderId}`;

  const { error } = await config.resend.emails.send({
    from: config.from,
    to: config.to,
    replyTo: input.customer.email || getEmailTo(),
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
    text: [
      `New Glowmia order`,
      `Order ID: ${input.orderId}`,
      `Name: ${input.customer.name}`,
      `Phone: ${input.customer.phone}`,
      `Email: ${input.customer.email || 'N/A'}`,
      `Address: ${input.customer.address}`,
      `City: ${input.customer.city}`,
      `Notes: ${input.notes || 'N/A'}`,
      ``,
      `Items:`,
      itemsText,
    ].join('\n'),
  });

  if (error) {
    throw new Error(error.message || 'Unable to send team order notification.');
  }

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
