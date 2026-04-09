import type { NextApiRequest, NextApiResponse } from 'next';
import { isAdminAuthenticatedRequest } from '@/src/lib/adminAuth';
import { DRESS_IMAGES_BUCKET, getSupabaseAdminClient } from '@/src/lib/adminSupabase';
import { getManagedUploadPath, toDressInsertPayload, validateAdminDressPayload } from '@/src/lib/adminDesigns';
import { normalizeDressRow, type DressRow } from '@/src/data/designs';

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'DELETE' && request.method !== 'PATCH') {
    response.setHeader('Allow', 'DELETE, PATCH');
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  if (!isAdminAuthenticatedRequest(request)) {
    response.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  const adminSupabase = getSupabaseAdminClient() as any;

  if (!adminSupabase) {
    response.status(503).json({
      error: 'SUPABASE_SERVICE_ROLE_KEY is required for secure admin writes.',
    });
    return;
  }

  const id = typeof request.query.id === 'string' ? request.query.id : '';

  if (!id) {
    response.status(400).json({ error: 'A design id is required.' });
    return;
  }

  const { data: design, error: fetchError } = await adminSupabase
    .from('dresses')
    .select('cover_image_url, image_url')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    response.status(500).json({ error: fetchError.message });
    return;
  }

  if (request.method === 'PATCH') {
    const { payload, error: validationError } = validateAdminDressPayload(request.body);

    if (!payload) {
      response.status(400).json({ error: validationError });
      return;
    }

    const { data: updatedRow, error } = await adminSupabase
      .from('dresses')
      .update(toDressInsertPayload(payload))
      .select('*')
      .eq('id', id);

    if (error) {
      response.status(500).json({ error: error.message });
      return;
    }

    const normalizedRow = Array.isArray(updatedRow) ? updatedRow[0] : updatedRow;

    const replacedPaths = Array.from(
      new Set(
        [
          design?.cover_image_url !== payload.coverImageUrl ? getManagedUploadPath(design?.cover_image_url) : null,
          design?.image_url !== payload.imageUrl ? getManagedUploadPath(design?.image_url) : null,
        ].filter(Boolean),
      ),
    ) as string[];

    if (replacedPaths.length > 0) {
      await adminSupabase.storage.from(DRESS_IMAGES_BUCKET).remove(replacedPaths);
    }

    response.status(200).json({
      ok: true,
      design: normalizedRow ? normalizeDressRow(normalizedRow as DressRow, 0) : null,
    });
    return;
  }

  const { error } = await adminSupabase.from('dresses').delete().eq('id', id);

  if (error) {
    response.status(500).json({ error: error.message });
    return;
  }

  const storagePaths = Array.from(
    new Set([getManagedUploadPath(design?.cover_image_url), getManagedUploadPath(design?.image_url)].filter(Boolean)),
  ) as string[];

  if (storagePaths.length > 0) {
    await adminSupabase.storage.from(DRESS_IMAGES_BUCKET).remove(storagePaths);
  }

  response.status(200).json({ ok: true });
}
