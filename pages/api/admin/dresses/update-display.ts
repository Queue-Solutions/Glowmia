import type { NextApiRequest, NextApiResponse } from 'next';
import { isAdminAuthenticatedRequest } from '@/src/lib/adminAuth';
import { getSupabaseAdminClient } from '@/src/lib/adminSupabase';

const DISPLAY_COLUMNS = ['display_order', 'is_featured', 'homepage_section', 'collection_section', 'is_visible'] as const;

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

async function getAvailableColumns() {
  const supabase = getSupabaseAdminClient() as any;

  if (!supabase) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for secure admin writes.');
  }

  const found = new Set<string>();

  for (const column of DISPLAY_COLUMNS) {
    const { error } = await supabase.from('dresses').select(column).limit(1);

    if (!error) {
      found.add(column);
    }
  }

  return { supabase, found };
}

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'PATCH') {
    response.setHeader('Allow', 'PATCH');
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  if (!isAdminAuthenticatedRequest(request)) {
    response.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  const id = normalizeString(request.body?.id);

  if (!id) {
    response.status(400).json({ error: 'Dress id is required.' });
    return;
  }

  try {
    const { supabase, found } = await getAvailableColumns();

    if (found.size === 0) {
      response.status(400).json({
        error: 'Dress display columns are not available yet. Add display_order, is_featured, homepage_section, collection_section, and is_visible to the dresses table first.',
      });
      return;
    }

    const payload: Record<string, unknown> = {};
    const displayOrder = Number(request.body?.displayOrder ?? 0);

    if (found.has('display_order')) {
      payload.display_order = Number.isFinite(displayOrder) ? Math.round(displayOrder) : 0;
    }

    if (found.has('is_featured')) {
      payload.is_featured = request.body?.isFeatured === true;
    }

    if (found.has('homepage_section')) {
      payload.homepage_section = normalizeString(request.body?.homepageSection) || null;
    }

    if (found.has('collection_section')) {
      payload.collection_section = normalizeString(request.body?.collectionSection) || null;
    }

    if (found.has('is_visible')) {
      payload.is_visible = request.body?.isVisible !== false;
    }

    const { error } = await supabase.from('dresses').update(payload).eq('id', id);

    if (error) {
      response.status(500).json({ error: error.message });
      return;
    }

    response.status(200).json({ ok: true });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Unable to update dress display settings.',
    });
  }
}
