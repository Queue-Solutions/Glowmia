import type { NextApiRequest } from 'next';
import { Resend } from 'resend';
import { getSupabaseAdminClient } from '@/src/lib/adminSupabase';

const NEWSLETTER_TABLE = 'newsletter_subscribers';
const ABANDONED_CARTS_TABLE = 'abandoned_carts';
const EMAIL_EVENTS_TABLE = 'email_events';
const DEFAULT_SITE_URL = 'https://glowmia.vercel.app';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CART_REMINDER_COOLDOWN_HOURS = 48;

const NEWSLETTER_SUBSCRIBER_FIELDS = ['id', 'email', 'source', 'created_at', 'last_seen_at', 'metadata'] as const;
const ABANDONED_CART_FIELDS = ['id', 'email', 'items', 'created_at', 'last_reminder_sent_at', 'last_seen_at', 'metadata'] as const;
const EMAIL_EVENT_FIELDS = ['id', 'email', 'event_type', 'metadata', 'created_at'] as const;

export type CaptureSource =
  | 'newsletter'
  | 'agent'
  | 'cart'
  | 'checkout'
  | 'order'
  | 'saved_design'
  | 'designer_request';

export type EmailEventType =
  | 'subscribed'
  | 'order_created'
  | 'design_created'
  | 'design_saved'
  | 'designer_request'
  | 'cart_abandoned'
  | 'newsletter_sent'
  | 'cart_reminder_sent';

export type MailingCartItem = {
  designId?: string;
  designName?: string;
  imageUrl?: string;
  quantity?: number;
  size?: string | null;
  href?: string | null;
};

type JsonObject = Record<string, unknown>;

type WeeklyEmailContent = {
  subject: string;
  html: string;
  text: string;
};

type NewsletterSubscriberRow = {
  id: string | null;
  email: string | null;
  source: string | null;
  created_at?: string | null;
  last_seen_at?: string | null;
  metadata?: unknown;
};

type AbandonedCartRow = {
  id: string | null;
  email: string | null;
  items?: unknown;
  created_at?: string | null;
  last_reminder_sent_at?: string | null;
  last_seen_at?: string | null;
  metadata?: unknown;
};

type AdminSupabaseClient = NonNullable<ReturnType<typeof getSupabaseAdminClient>>;
type NewsletterSender = NonNullable<ReturnType<typeof getNewsletterSender>>;
type ColumnCacheEntry = Promise<Set<string>>;

const tableColumnCache = new Map<string, ColumnCacheEntry>();

function getTable(supabase: AdminSupabaseClient, table: string) {
  return (supabase.from as (tableName: string) => any)(table);
}

function isMissingTableError(message: string) {
  return /Could not find the table/i.test(message);
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNullableString(value: unknown) {
  const normalized = normalizeString(value);
  return normalized || null;
}

function normalizeJsonObject(value: unknown): JsonObject {
  if (!value) {
    return {};
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as JsonObject;
  }

  if (typeof value !== 'string') {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === 'object' && parsed && !Array.isArray(parsed) ? (parsed as JsonObject) : {};
  } catch {
    return {};
  }
}

function mergeMetadata(base: unknown, extra?: JsonObject | null) {
  return {
    ...normalizeJsonObject(base),
    ...(extra ?? {}),
  };
}

export function isDuplicateNewsletterError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /duplicate key value|unique constraint/i.test(error.message);
}

function normalizeCartItems(items: unknown): MailingCartItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return [];
      }

      const value = item as Record<string, unknown>;

      return [
        {
          designId: normalizeString(value.designId) || undefined,
          designName: normalizeString(value.designName) || undefined,
          imageUrl: normalizeString(value.imageUrl) || undefined,
          quantity: Math.max(1, Math.min(99, Math.round(Number(value.quantity) || 1))),
          size: normalizeNullableString(value.size),
          href: normalizeNullableString(value.href),
        } satisfies MailingCartItem,
      ];
    });
}

async function getAvailableColumns(
  table: string,
  candidates: readonly string[],
  options: { optional?: boolean } = {},
) {
  const cacheKey = `${table}:${candidates.join(',')}:${options.optional ? 'optional' : 'required'}`;
  const cached = tableColumnCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const pending = (async () => {
    const supabase = getSupabaseAdminClient();

    if (!supabase) {
      throw new Error('Supabase admin client is not configured.');
    }

    const found = new Set<string>();

    for (const column of candidates) {
      const { error } = await getTable(supabase, table).select(column).limit(1);

      if (!error) {
        found.add(column);
        continue;
      }

      if (isMissingTableError(error.message)) {
        if (options.optional) {
          return new Set<string>();
        }

        throw new Error(`Supabase table "${table}" is not available in the public schema.`);
      }
    }

    return found;
  })();

  tableColumnCache.set(cacheKey, pending);
  return pending;
}

function buildSelect(columns: Set<string>, candidates: readonly string[]) {
  return candidates.filter((column) => columns.has(column)).join(', ');
}

async function findSubscriberByEmail(email: string, columns: Set<string>) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error('Supabase admin client is not configured.');
  }

  const select = buildSelect(columns, NEWSLETTER_SUBSCRIBER_FIELDS);
  let query = getTable(supabase, NEWSLETTER_TABLE).select(select).ilike('email', email).limit(1);

  if (columns.has('created_at')) {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || 'Unable to load newsletter subscriber.');
  }

  const rows = (data as NewsletterSubscriberRow[] | null) ?? [];
  return rows[0] ?? null;
}

async function findAbandonedCartByEmail(email: string, columns: Set<string>) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error('Supabase admin client is not configured.');
  }

  const select = buildSelect(columns, ABANDONED_CART_FIELDS);
  let query = getTable(supabase, ABANDONED_CARTS_TABLE).select(select).ilike('email', email).limit(1);

  if (columns.has('created_at')) {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || 'Unable to load abandoned cart.');
  }

  const rows = (data as AbandonedCartRow[] | null) ?? [];
  return rows[0] ?? null;
}

function buildRtlEmailShell(input: {
  eyebrow: string;
  title: string;
  lead: string;
  body: string[];
  ctaLabel: string;
  ctaHref: string;
  footerNote: string;
  unsubscribeLabel: string;
  unsubscribeHref: string;
  accentLabel?: string;
  accentValue?: string;
  extraHtml?: string;
}) {
  return `
    <div dir="rtl" style="margin:0;padding:32px 16px;background:#f7f2eb;font-family:Tahoma, Arial, sans-serif;color:#241715;">
      <div style="max-width:640px;margin:0 auto;background:rgba(255,251,247,0.97);border:1px solid rgba(85,67,56,0.1);border-radius:28px;overflow:hidden;box-shadow:0 24px 60px rgba(87,64,51,0.08);">
        <div style="padding:36px 32px 18px;background:linear-gradient(180deg, rgba(255,248,245,0.98), rgba(247,242,235,0.92));">
          <p style="margin:0 0 12px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#7c6960;">${input.eyebrow}</p>
          <h1 style="margin:0;font-family:'Cormorant Garamond', Georgia, serif;font-size:36px;line-height:1.2;color:#241715;">${input.title}</h1>
          ${input.accentLabel && input.accentValue ? `<p style="margin:14px 0 0;font-size:14px;line-height:1.7;color:#7c6960;"><strong style="color:#241715;">${input.accentLabel}:</strong> ${input.accentValue}</p>` : ''}
        </div>
        <div style="padding:0 32px 32px;">
          <p style="margin:0 0 14px;font-size:16px;line-height:1.95;color:#5d4b43;">${input.lead}</p>
          ${input.body.map((paragraph) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.95;color:#7c6960;">${paragraph}</p>`).join('')}
          ${input.extraHtml ?? ''}
          <div style="margin-top:24px;">
            <a
              href="${input.ctaHref}"
              style="display:inline-block;padding:14px 24px;border-radius:999px;background:linear-gradient(135deg,#89234b 0%, #6d1837 44%, #4e1026 100%);color:#fff8f5;text-decoration:none;font-weight:700;letter-spacing:0.01em;"
            >
              ${input.ctaLabel}
            </a>
          </div>
          <div style="margin-top:26px;padding-top:18px;border-top:1px solid rgba(85,67,56,0.1);font-size:13px;line-height:1.9;color:#7c6960;">
            <p style="margin:0 0 8px;">${input.footerNote}</p>
            <p style="margin:0;">
              <a href="${input.unsubscribeHref}" style="color:#6d1837;text-decoration:underline;">${input.unsubscribeLabel}</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildItemsHtml(items: MailingCartItem[]) {
  if (items.length === 0) {
    return '';
  }

  return `
    <div style="display:grid;gap:12px;margin:18px 0 6px;">
      ${items
        .slice(0, 4)
        .map((item) => {
          const details = [`${item.designName || 'تصميم Glowmia'}`];

          if (item.size) {
            details.push(`المقاس: ${item.size}`);
          }

          if (item.quantity) {
            details.push(`الكمية: ${item.quantity}`);
          }

          return `
            <div style="display:grid;grid-template-columns:${item.imageUrl ? '92px 1fr' : '1fr'};gap:12px;align-items:center;border:1px solid rgba(85,67,56,0.08);border-radius:20px;background:rgba(255,255,255,0.72);padding:12px;">
              ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.designName || 'Glowmia'}" style="width:92px;height:118px;border-radius:16px;object-fit:cover;background:#f4ece6;" />` : ''}
              <div>
                <p style="margin:0 0 6px;font-size:15px;line-height:1.8;color:#241715;font-weight:700;">${item.designName || 'تصميم Glowmia'}</p>
                <p style="margin:0;font-size:13px;line-height:1.85;color:#7c6960;">${details.slice(1).join(' • ')}</p>
              </div>
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}

function buildEmailText(input: { title: string; body: string[]; ctaLabel: string; ctaHref: string; unsubscribeHref: string }) {
  return [input.title, ...input.body, `${input.ctaLabel}: ${input.ctaHref}`, `إلغاء الاشتراك: ${input.unsubscribeHref}`].join('\n\n');
}

export function normalizeNewsletterEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isValidNewsletterEmail(email: string) {
  return EMAIL_REGEX.test(email);
}

export function isCronAuthorized(request: NextApiRequest) {
  const secret = process.env.CRON_SECRET?.trim() || '';

  if (!secret) {
    return false;
  }

  return request.headers.authorization === `Bearer ${secret}`;
}

export function getNewsletterSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL;
}

export function getNewsletterAdminClient() {
  return getSupabaseAdminClient();
}

export function getNewsletterSender() {
  const apiKey = process.env.RESEND_API_KEY?.trim() || '';
  const fromInput = process.env.NEWSLETTER_FROM_EMAIL?.trim() || '';

  if (!apiKey || !fromInput) {
    return null;
  }

  const from = fromInput.includes('<') ? fromInput : `Glowmia <${fromInput}>`;
  const fromEmailMatch = from.match(/<([^>]+)>/);
  const fromEmail = (fromEmailMatch?.[1] || fromInput).trim();

  return {
    resend: new Resend(apiKey),
    from,
    fromEmail,
  };
}

export async function upsertNewsletterSubscriber(input: {
  email: string;
  source: CaptureSource;
  metadata?: JsonObject | null;
}) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error('Supabase admin client is not configured.');
  }

  const columns = await getAvailableColumns(NEWSLETTER_TABLE, NEWSLETTER_SUBSCRIBER_FIELDS);
  const normalizedEmail = normalizeNewsletterEmail(input.email);

  if (!normalizedEmail || !columns.has('email')) {
    throw new Error('Newsletter subscriber email is required.');
  }

  const now = new Date().toISOString();
  const existing = await findSubscriberByEmail(normalizedEmail, columns);
  const payload: Record<string, unknown> = {
    email: normalizedEmail,
  };

  if (columns.has('source')) {
    payload.source = input.source;
  }

  if (columns.has('last_seen_at')) {
    payload.last_seen_at = now;
  }

  if (columns.has('metadata')) {
    payload.metadata = mergeMetadata(existing?.metadata, {
      ...(input.metadata ?? {}),
      latest_source: input.source,
      last_seen_at: now,
    });
  }

  if (existing?.id && columns.has('id')) {
    const { error } = await getTable(supabase, NEWSLETTER_TABLE).update(payload).eq('id', existing.id);

    if (error) {
      throw error;
    }

    return { created: false, subscriberId: existing.id, email: normalizedEmail };
  }

  const { data, error } = await getTable(supabase, NEWSLETTER_TABLE).insert(payload).select(columns.has('id') ? 'id' : 'email').limit(1);

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? (data[0] as { id?: string } | undefined) : undefined;
  return { created: true, subscriberId: row?.id || null, email: normalizedEmail };
}

export async function captureNewsletterEmail(input: {
  email: string;
  source: CaptureSource;
  metadata?: JsonObject | null;
  abandonedCartItems?: MailingCartItem[];
}) {
  const normalizedEmail = normalizeNewsletterEmail(input.email);

  if (!normalizedEmail || !isValidNewsletterEmail(normalizedEmail)) {
    throw new Error('A valid email address is required.');
  }

  const subscriber = await upsertNewsletterSubscriber({
    email: normalizedEmail,
    source: input.source,
    metadata: input.metadata ?? null,
  });

  let abandonedCart: { created: boolean } | null = null;

  if ((input.source === 'cart' || input.source === 'checkout') && (input.abandonedCartItems?.length ?? 0) > 0) {
    abandonedCart = await saveAbandonedCart({
      email: normalizedEmail,
      items: input.abandonedCartItems ?? [],
      metadata: input.metadata ?? null,
    });

    if (abandonedCart.created) {
      await trackEmailEvent({
        email: normalizedEmail,
        eventType: 'cart_abandoned',
        metadata: {
          source: input.source,
          items: input.abandonedCartItems ?? [],
        },
      });
    }
  }

  return {
    ok: true,
    email: normalizedEmail,
    created: subscriber.created,
    abandonedCartCreated: abandonedCart?.created ?? false,
  };
}

export async function saveAbandonedCart(input: {
  email: string;
  items: MailingCartItem[];
  metadata?: JsonObject | null;
}) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error('Supabase admin client is not configured.');
  }

  const columns = await getAvailableColumns(ABANDONED_CARTS_TABLE, ABANDONED_CART_FIELDS);
  const normalizedEmail = normalizeNewsletterEmail(input.email);
  const items = normalizeCartItems(input.items);

  if (!normalizedEmail || !columns.has('email')) {
    throw new Error('Abandoned cart email is required.');
  }

  const existing = await findAbandonedCartByEmail(normalizedEmail, columns);
  const payload: Record<string, unknown> = {
    email: normalizedEmail,
  };

  if (columns.has('items')) {
    payload.items = items;
  }

  if (columns.has('last_reminder_sent_at')) {
    payload.last_reminder_sent_at = null;
  }

  if (columns.has('last_seen_at')) {
    payload.last_seen_at = new Date().toISOString();
  }

  if (columns.has('metadata')) {
    payload.metadata = mergeMetadata(existing?.metadata, input.metadata ?? null);
  }

  if (existing?.id && columns.has('id')) {
    const { error } = await getTable(supabase, ABANDONED_CARTS_TABLE).update(payload).eq('id', existing.id);

    if (error) {
      throw new Error(error.message || 'Unable to update abandoned cart.');
    }

    return { created: false, id: existing.id };
  }

  const { data, error } = await getTable(supabase, ABANDONED_CARTS_TABLE).insert(payload).select(columns.has('id') ? 'id' : 'email').limit(1);

  if (error) {
    throw new Error(error.message || 'Unable to save abandoned cart.');
  }

  const row = Array.isArray(data) ? (data[0] as { id?: string } | undefined) : undefined;
  return { created: true, id: row?.id || null };
}

export async function clearAbandonedCart(email: string) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error('Supabase admin client is not configured.');
  }

  const columns = await getAvailableColumns(ABANDONED_CARTS_TABLE, ABANDONED_CART_FIELDS);
  const existing = await findAbandonedCartByEmail(normalizeNewsletterEmail(email), columns);

  if (!existing?.id || !columns.has('id')) {
    return;
  }

  const payload: Record<string, unknown> = {};

  if (columns.has('items')) {
    payload.items = [];
  }

  if (columns.has('last_seen_at')) {
    payload.last_seen_at = new Date().toISOString();
  }

  const { error } = await getTable(supabase, ABANDONED_CARTS_TABLE).update(payload).eq('id', existing.id);

  if (error) {
    throw new Error(error.message || 'Unable to clear abandoned cart.');
  }
}

export async function listRemindableAbandonedCarts() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error('Supabase admin client is not configured.');
  }

  const columns = await getAvailableColumns(ABANDONED_CARTS_TABLE, ABANDONED_CART_FIELDS);
  const select = buildSelect(columns, ABANDONED_CART_FIELDS);
  let query = getTable(supabase, ABANDONED_CARTS_TABLE).select(select).not('email', 'is', null);

  if (columns.has('created_at')) {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || 'Unable to load abandoned carts.');
  }

  const cooldownMs = CART_REMINDER_COOLDOWN_HOURS * 60 * 60 * 1000;
  const now = Date.now();

  return ((data as AbandonedCartRow[] | null) ?? [])
    .map((row) => ({
      id: row.id,
      email: normalizeNewsletterEmail(row.email),
      items: normalizeCartItems(row.items),
      createdAt: normalizeNullableString(row.created_at),
      lastReminderSentAt: normalizeNullableString(row.last_reminder_sent_at),
    }))
    .filter((row) => row.email && row.items.length > 0)
    .filter((row) => {
      if (!row.lastReminderSentAt) {
        return true;
      }

      return now - new Date(row.lastReminderSentAt).getTime() >= cooldownMs;
    });
}

export async function markCartReminderSent(cartId: string) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error('Supabase admin client is not configured.');
  }

  const columns = await getAvailableColumns(ABANDONED_CARTS_TABLE, ABANDONED_CART_FIELDS);

  if (!columns.has('id') || !columns.has('last_reminder_sent_at')) {
    return;
  }

  const payload: Record<string, unknown> = {
    last_reminder_sent_at: new Date().toISOString(),
  };

  if (columns.has('last_seen_at')) {
    payload.last_seen_at = new Date().toISOString();
  }

  const { error } = await getTable(supabase, ABANDONED_CARTS_TABLE).update(payload).eq('id', cartId);

  if (error) {
    throw new Error(error.message || 'Unable to update abandoned cart reminder timestamp.');
  }
}

export async function trackEmailEvent(input: {
  email: string;
  eventType: EmailEventType;
  metadata?: JsonObject | null;
}) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error('Supabase admin client is not configured.');
  }

  const columns = await getAvailableColumns(EMAIL_EVENTS_TABLE, EMAIL_EVENT_FIELDS, { optional: true });

  if (columns.size === 0) {
    return null;
  }

  const payload: Record<string, unknown> = {
    email: normalizeNewsletterEmail(input.email),
  };

  if (columns.has('event_type')) {
    payload.event_type = input.eventType;
  }

  if (columns.has('metadata')) {
    payload.metadata = input.metadata ?? {};
  }

  const { error } = await getTable(supabase, EMAIL_EVENTS_TABLE).insert(payload);

  if (error) {
    throw new Error(error.message || 'Unable to save email event.');
  }

  return { ok: true };
}

export async function listNewsletterSubscribers(): Promise<string[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error('Supabase admin client is not configured.');
  }

  const { data, error } = await getTable(supabase, NEWSLETTER_TABLE).select('email').not('email', 'is', null);

  if (error) {
    throw new Error(error.message || 'Unable to load newsletter subscribers.');
  }

  return ((data as Array<{ email: string | null }> | null) ?? [])
    .map((entry) => normalizeNewsletterEmail(entry.email))
    .filter(Boolean);
}

function getUnsubscribeHref(fromEmail: string) {
  return `mailto:${fromEmail}?subject=${encodeURIComponent('إلغاء اشتراك Glowmia')}`;
}

async function sendEmail(input: {
  sender: NewsletterSender;
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const { error } = await input.sender.resend.emails.send({
    from: input.sender.from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  if (error) {
    throw new Error(error.message || 'Unable to send email.');
  }
}

export function buildWeeklyEmail(siteUrl: string, unsubscribeHref: string): WeeklyEmailContent {
  const subject = '\u2728 تصاميم جديدة من Glowmia بانتظارك';
  const html = buildRtlEmailShell({
    eyebrow: 'Glowmia Weekly',
    title: 'تصاميم جديدة بانتظارك هذا الأسبوع',
    lead: 'أضفنا لمسات جديدة واختيارات أنيقة تحافظ على هدوء Glowmia ولمعته الراقية.',
    body: [
      'هذه الرسالة مخصصة لقائمة صغيرة من المهتمات بمتابعة أحدث التصاميم والإعلانات الهادئة والعودة السلسة إلى تجربة التسوق.',
      'اكتشفي القطع الجديدة، راجعي اختياراتك السابقة، وابدئي من جديد بإطلالة أقرب لذوقك.',
    ],
    ctaLabel: 'اكتشفي تصاميم Glowmia',
    ctaHref: siteUrl,
    footerNote: 'تصلك هذه الرسالة لأنك اشتركتِ في تحديثات Glowmia.',
    unsubscribeLabel: 'لإلغاء الاشتراك من هذه الرسائل اضغطي هنا',
    unsubscribeHref,
  });
  const text = buildEmailText({
    title: 'تصاميم جديدة من Glowmia بانتظارك',
    body: [
      'أضفنا لمسات جديدة واختيارات أنيقة هذا الأسبوع.',
      'اكتشفي التصاميم الجديدة وراجعي اختياراتك السابقة.',
    ],
    ctaLabel: 'اكتشفي تصاميم Glowmia',
    ctaHref: siteUrl,
    unsubscribeHref,
  });

  return { subject, html, text };
}

export function buildCartReminderEmail(input: {
  siteUrl: string;
  unsubscribeHref: string;
  items: MailingCartItem[];
}): WeeklyEmailContent {
  const subject = '\ud83d\uded2 تصميمك في Glowmia لسه مستنيك';
  const html = buildRtlEmailShell({
    eyebrow: 'Glowmia Reminder',
    title: 'تصميمك ما زال بانتظارك',
    lead: 'احتفظنا لك باختيارك حتى تكملي الخطوة الأخيرة بهدوء وبدون استعجال.',
    body: [
      'إذا كان هناك تصميم لفت انتباهك، يمكنك الرجوع الآن وإكمال الطلب أو متابعة التعديل من حيث توقفتِ.',
    ],
    ctaLabel: 'كمّلي التسوق الآن',
    ctaHref: input.siteUrl,
    footerNote: 'هذه تذكرة لطيفة لأنك شاركتِ بريدك أثناء تجهيز سلتك في Glowmia.',
    unsubscribeLabel: 'إلغاء رسائل التذكير',
    unsubscribeHref: input.unsubscribeHref,
    extraHtml: buildItemsHtml(input.items),
  });
  const text = buildEmailText({
    title: 'تصميمك في Glowmia لسه مستنيك',
    body: input.items.slice(0, 4).map((item) => `${item.designName || 'تصميم Glowmia'}${item.size ? ` - المقاس ${item.size}` : ''}`),
    ctaLabel: 'كمّلي التسوق الآن',
    ctaHref: input.siteUrl,
    unsubscribeHref: input.unsubscribeHref,
  });

  return { subject, html, text };
}

export function buildOrderConfirmationEmail(input: {
  siteUrl: string;
  unsubscribeHref: string;
  customerName?: string | null;
  orderId: string;
  items: MailingCartItem[];
}): WeeklyEmailContent {
  const subject = 'تم استلام طلبك من Glowmia \u2728';
  const greetingName = normalizeString(input.customerName);
  const html = buildRtlEmailShell({
    eyebrow: 'Glowmia Order',
    title: greetingName ? `أهلًا ${greetingName}، تم استلام طلبك` : 'تم استلام طلبك بنجاح',
    lead: 'وصل طلبك إلى فريق Glowmia، وسنتواصل معك قريبًا لتأكيد التفاصيل النهائية.',
    body: [
      'احتفظي برقم الطلب للرجوع إليه عند الحاجة، ويمكنك في أي وقت العودة إلى الموقع لاكتشاف تصاميم أخرى.',
    ],
    ctaLabel: 'زيارة Glowmia',
    ctaHref: input.siteUrl,
    footerNote: 'نشكرك على ثقتك في Glowmia.',
    unsubscribeLabel: 'للتواصل حول الرسائل',
    unsubscribeHref: input.unsubscribeHref,
    accentLabel: 'رقم الطلب',
    accentValue: input.orderId,
    extraHtml: buildItemsHtml(input.items),
  });
  const text = buildEmailText({
    title: `تم استلام طلبك من Glowmia - رقم الطلب: ${input.orderId}`,
    body: ['وصل طلبك إلى فريق Glowmia وسنتواصل معك قريبًا.'],
    ctaLabel: 'زيارة Glowmia',
    ctaHref: input.siteUrl,
    unsubscribeHref: input.unsubscribeHref,
  });

  return { subject, html, text };
}

export function buildDesignConfirmationEmail(input: {
  siteUrl: string;
  unsubscribeHref: string;
  dressName?: string | null;
  imageUrl?: string | null;
  prompt?: string | null;
}): WeeklyEmailContent {
  const subject = 'تصميمك في Glowmia جاهز \ud83d\udc97';
  const body = [
    'تم حفظ تصميمك بنجاح، وأصبح جاهزًا للمتابعة مع فريق Glowmia أو لإكمال الطلب لاحقًا.',
  ];

  if (normalizeString(input.prompt)) {
    body.push(`تفاصيل التعديل: ${normalizeString(input.prompt)}`);
  }

  const extraHtml = `
    ${input.imageUrl ? `<div style="margin:18px 0 14px;"><img src="${input.imageUrl}" alt="${input.dressName || 'Glowmia'}" style="width:100%;max-width:280px;border-radius:22px;object-fit:cover;background:#f4ece6;" /></div>` : ''}
    ${normalizeString(input.dressName) ? `<p style="margin:0 0 10px;font-size:14px;line-height:1.9;color:#7c6960;"><strong style="color:#241715;">التصميم:</strong> ${normalizeString(input.dressName)}</p>` : ''}
  `;

  const html = buildRtlEmailShell({
    eyebrow: 'Glowmia Design',
    title: 'تصميمك أصبح جاهزًا',
    lead: 'أبقينا نسختك المحفوظة جاهزة حتى تراجعيها بهدوء أو تكمليها في الوقت المناسب.',
    body,
    ctaLabel: 'شاهدي Glowmia',
    ctaHref: input.siteUrl,
    footerNote: 'أرسلنا لك هذه الرسالة لأنك حفظتِ تصميمًا داخل Glowmia.',
    unsubscribeLabel: 'إيقاف رسائل التصميم',
    unsubscribeHref: input.unsubscribeHref,
    extraHtml,
  });
  const text = buildEmailText({
    title: 'تصميمك في Glowmia جاهز',
    body,
    ctaLabel: 'شاهدي Glowmia',
    ctaHref: input.siteUrl,
    unsubscribeHref: input.unsubscribeHref,
  });

  return { subject, html, text };
}

export async function sendWeeklyNewsletterEmail(email: string) {
  const sender = getNewsletterSender();

  if (!sender) {
    throw new Error('Newsletter email is not configured. Add RESEND_API_KEY and NEWSLETTER_FROM_EMAIL.');
  }

  const content = buildWeeklyEmail(getNewsletterSiteUrl(), getUnsubscribeHref(sender.fromEmail));
  await sendEmail({
    sender,
    to: email,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });

  await trackEmailEvent({
    email,
    eventType: 'newsletter_sent',
    metadata: {
      subject: content.subject,
    },
  });

  return { ok: true };
}

export async function sendCartReminderEmail(input: { email: string; items: MailingCartItem[] }) {
  const sender = getNewsletterSender();

  if (!sender) {
    throw new Error('Newsletter email is not configured. Add RESEND_API_KEY and NEWSLETTER_FROM_EMAIL.');
  }

  const content = buildCartReminderEmail({
    siteUrl: getNewsletterSiteUrl(),
    unsubscribeHref: getUnsubscribeHref(sender.fromEmail),
    items: input.items,
  });
  await sendEmail({
    sender,
    to: input.email,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });

  await trackEmailEvent({
    email: input.email,
    eventType: 'cart_reminder_sent',
    metadata: {
      items: input.items,
    },
  });

  return { ok: true };
}

export async function sendOrderConfirmationEmail(input: {
  email: string;
  customerName?: string | null;
  orderId: string;
  items: MailingCartItem[];
}) {
  const sender = getNewsletterSender();

  if (!sender) {
    throw new Error('Newsletter email is not configured. Add RESEND_API_KEY and NEWSLETTER_FROM_EMAIL.');
  }

  const content = buildOrderConfirmationEmail({
    siteUrl: getNewsletterSiteUrl(),
    unsubscribeHref: getUnsubscribeHref(sender.fromEmail),
    customerName: input.customerName,
    orderId: input.orderId,
    items: input.items,
  });
  await sendEmail({
    sender,
    to: input.email,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });

  return { ok: true };
}

export async function sendDesignConfirmationEmail(input: {
  email: string;
  dressName?: string | null;
  imageUrl?: string | null;
  prompt?: string | null;
}) {
  const sender = getNewsletterSender();

  if (!sender) {
    throw new Error('Newsletter email is not configured. Add RESEND_API_KEY and NEWSLETTER_FROM_EMAIL.');
  }

  const content = buildDesignConfirmationEmail({
    siteUrl: getNewsletterSiteUrl(),
    unsubscribeHref: getUnsubscribeHref(sender.fromEmail),
    dressName: input.dressName,
    imageUrl: input.imageUrl,
    prompt: input.prompt,
  });
  await sendEmail({
    sender,
    to: input.email,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });

  return { ok: true };
}
