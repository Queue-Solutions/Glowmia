import type { NextApiRequest, NextApiResponse } from 'next';
import { randomUUID } from 'crypto';
import { saveAgentDesign } from '@/src/lib/glowmiaOrders';
import {
  isValidNewsletterEmail,
  normalizeNewsletterEmail,
  sendDesignConfirmationEmail,
  trackEmailEvent,
  upsertNewsletterSubscriber,
} from '@/src/lib/newsletter';

function readTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isHttpUrl(value: string) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const sessionId = readTrimmedString(request.body?.sessionId) || null;
  const customerName = readTrimmedString(request.body?.customerName);
  const customerPhone = readTrimmedString(request.body?.customerPhone);
  const customerEmail = normalizeNewsletterEmail(request.body?.customerEmail);
  const userId = readTrimmedString(request.body?.userId);
  const guestId = readTrimmedString(request.body?.guestId);
  const dressId = readTrimmedString(request.body?.dressId);
  const dressName = readTrimmedString(request.body?.dressName);
  const originalImageUrl = readTrimmedString(request.body?.originalImageUrl);
  const editedImageUrl = readTrimmedString(request.body?.editedImageUrl);
  const prompt = readTrimmedString(request.body?.prompt);
  const language = request.body?.language === 'ar' ? 'ar' : 'en';
  const normalizedUserId = isUuid(userId) ? userId : '';
  const normalizedGuestId = isUuid(guestId) ? guestId : '';

  if (!dressId || !dressName || !originalImageUrl || !editedImageUrl) {
    response.status(400).json({ error: 'Missing required saved design details.' });
    return;
  }

  if (!customerEmail || !isValidNewsletterEmail(customerEmail)) {
    response.status(400).json({ error: 'A valid email address is required.' });
    return;
  }

  if (!isUuid(dressId)) {
    response.status(400).json({ error: 'dressId must be a valid UUID.' });
    return;
  }

  if (!isHttpUrl(originalImageUrl) || !isHttpUrl(editedImageUrl)) {
    response.status(400).json({ error: 'originalImageUrl and editedImageUrl must be valid http or https URLs.' });
    return;
  }

  try {
    const savedDesign = await saveAgentDesign({
      userId: normalizedUserId || null,
      guestId: normalizedUserId ? null : normalizedGuestId || randomUUID(),
      dressId,
      email: customerEmail,
      originalImageUrl,
      editedImageUrl,
      prompt,
      designName: dressName,
      notes: {
        sessionId,
        language,
        customerName,
        customerPhone,
        customerEmail,
      },
      isOrdered: false,
    });

    await upsertNewsletterSubscriber({
      email: customerEmail,
      source: 'designer_request',
      metadata: {
        design_id: savedDesign.id,
        dress_id: dressId,
        dress_name: dressName,
        image_url: editedImageUrl,
        edit_prompt: prompt || null,
        created_at: savedDesign.createdAt,
      },
    });

    await trackEmailEvent({
      email: customerEmail,
      eventType: 'design_created',
      metadata: {
        design_id: savedDesign.id,
        dress_id: dressId,
        dress_name: dressName,
        image_url: editedImageUrl,
        edit_prompt: prompt || null,
        created_at: savedDesign.createdAt,
      },
    });

    await trackEmailEvent({
      email: customerEmail,
      eventType: 'design_saved',
      metadata: {
        design_id: savedDesign.id,
        dress_id: dressId,
        dress_name: dressName,
        image_url: editedImageUrl,
        edit_prompt: prompt || null,
        created_at: savedDesign.createdAt,
      },
    });

    await trackEmailEvent({
      email: customerEmail,
      eventType: 'designer_request',
      metadata: {
        design_id: savedDesign.id,
        dress_id: dressId,
        dress_name: dressName,
      },
    });

    await sendDesignConfirmationEmail({
      email: customerEmail,
      dressName: dressName,
      imageUrl: editedImageUrl,
      prompt: prompt || null,
    });

    response.status(201).json({
      ok: true,
      savedDesign,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to save the edited design. Check the server logs for the insert failure details.';

    console.error('[api/engagement/agent-design-order] Failed to save edited design.', {
      error: message,
      dressId,
      dressName,
      hasOriginalImageUrl: Boolean(originalImageUrl),
      hasEditedImageUrl: Boolean(editedImageUrl),
      hasUserId: Boolean(normalizedUserId),
      hasGuestId: Boolean(normalizedGuestId),
      hasCustomerEmail: Boolean(customerEmail),
      hasPrompt: Boolean(prompt),
      sessionId,
      language,
    });

    if (/row-level security policy|SUPABASE_SERVICE_ROLE_KEY|Supabase is not configured/i.test(message)) {
      response.status(503).json({ error: message });
      return;
    }

    response.status(500).json({ error: message });
  }
}
