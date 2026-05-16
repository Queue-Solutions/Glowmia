const BREVO_TRANSACTIONAL_EMAIL_URL = 'https://api.brevo.com/v3/smtp/email';
const DEFAULT_SENDER_NAME = 'Glowmia';
const DEFAULT_SENDER_EMAIL = 'noreply@queuesolutions.org';
const DEFAULT_REPLY_TO_EMAIL = 'glowmiasa@hotmail.com';

export class EmailConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailConfigurationError';
  }
}

export class EmailDeliveryError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'EmailDeliveryError';
    this.status = status;
  }
}

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  tag?: string;
  logContext?: string;
};

function readEnv(value: string | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function getBrevoApiKey() {
  const apiKey = readEnv(process.env.BREVO_API_KEY);

  if (!apiKey) {
    throw new EmailConfigurationError('Transactional email is not configured. Set BREVO_API_KEY on the server.');
  }

  return apiKey;
}

function extractProviderMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return '';
  }

  const value = payload as Record<string, unknown>;
  const message = value.message;

  if (typeof message === 'string' && message.trim()) {
    return message.trim();
  }

  const code = value.code;

  if (typeof code === 'string' && code.trim()) {
    return `Brevo request failed: ${code.trim()}.`;
  }

  return '';
}

export function isEmailConfigurationError(error: unknown): error is EmailConfigurationError {
  return error instanceof EmailConfigurationError;
}

export function maskEmailForLogs(email: string) {
  const normalized = readEnv(email).toLowerCase();
  const [localPart, domain] = normalized.split('@');

  if (!localPart || !domain) {
    return normalized || 'unknown-recipient';
  }

  if (localPart.length <= 2) {
    return `${localPart[0] || '*'}*@${domain}`;
  }

  return `${localPart.slice(0, 2)}***@${domain}`;
}

export function assertEmailConfiguration() {
  getBrevoApiKey();
}

function ensureUtf8HtmlDocument(html: string) {
  const trimmedHtml = html.trim();

  if (/<!doctype html>/i.test(trimmedHtml) && /<meta[^>]+charset=/i.test(trimmedHtml)) {
    return trimmedHtml;
  }

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>${trimmedHtml}</body>
</html>`;
}

export async function sendEmail(input: SendEmailInput) {
  const apiKey = getBrevoApiKey();
  const htmlContent = ensureUtf8HtmlDocument(input.html);
  const response = await fetch(BREVO_TRANSACTIONAL_EMAIL_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json; charset=utf-8',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      sender: {
        name: DEFAULT_SENDER_NAME,
        email: DEFAULT_SENDER_EMAIL,
      },
      to: [{ email: input.to }],
      replyTo: {
        name: DEFAULT_SENDER_NAME,
        email: DEFAULT_REPLY_TO_EMAIL,
      },
      subject: input.subject,
      htmlContent,
      headers: {
        charset: 'utf-8',
        'Content-Type': 'text/html; charset=utf-8',
      },
      ...(input.tag ? { tags: [input.tag] } : {}),
    }),
  });

  const rawBody = await response.text();
  let parsedBody: unknown = null;

  if (rawBody) {
    try {
      parsedBody = JSON.parse(rawBody) as unknown;
    } catch {
      parsedBody = rawBody;
    }
  }

  if (!response.ok) {
    const providerMessage = extractProviderMessage(parsedBody);
    const message = providerMessage || `Brevo transactional email request failed with status ${response.status}.`;

    console.error('[email.brevo] Delivery failed.', {
      context: input.logContext || 'transactional',
      recipient: maskEmailForLogs(input.to),
      status: response.status,
      providerMessage: providerMessage || null,
    });

    throw new EmailDeliveryError(message, response.status);
  }

  const parsedObject =
    parsedBody && typeof parsedBody === 'object' && !Array.isArray(parsedBody) ? (parsedBody as Record<string, unknown>) : null;
  const messageId = typeof parsedObject?.messageId === 'string' ? parsedObject.messageId : null;

  console.info('[email.brevo] Delivered.', {
    context: input.logContext || 'transactional',
    recipient: maskEmailForLogs(input.to),
    messageId,
  });

  return {
    ok: true as const,
    messageId,
  };
}
