import type { NextApiRequest, NextApiResponse } from 'next';
import { isAdminAuthenticatedRequest } from '@/src/lib/adminAuth';
import { getSupabaseAdminClient } from '@/src/lib/adminSupabase';
import { getManagedUploadAsset, toDressInsertPayload, validateAdminDressPayload, type ManagedUploadAsset } from '@/src/lib/adminDesigns';
import { normalizeDressRow, type DressRow } from '@/src/data/designs';

function managedUploadKey(asset: ManagedUploadAsset) {
  return `${asset.bucket}/${asset.path}`;
}

function uniqueManagedUploads(values: Array<ManagedUploadAsset | null>) {
  const assets = new Map<string, ManagedUploadAsset>();

  values.forEach((asset) => {
    if (asset) {
      assets.set(managedUploadKey(asset), asset);
    }
  });

  return Array.from(assets.values());
}

async function removeManagedUploads(adminSupabase: any, assets: ManagedUploadAsset[]) {
  const pathsByBucket = assets.reduce<Map<string, string[]>>((buckets, asset) => {
    const bucketPaths = buckets.get(asset.bucket) ?? [];
    bucketPaths.push(asset.path);
    buckets.set(asset.bucket, bucketPaths);
    return buckets;
  }, new Map());

  await Promise.all(
    Array.from(pathsByBucket.entries()).map(([bucket, paths]) => adminSupabase.storage.from(bucket).remove(paths)),
  );
}

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

  let { data: design, error: fetchError } = await adminSupabase
    .from('dresses')
    .select('image_url, front_view_url, side_view_url, back_view_url')
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

    const updatePayload = toDressInsertPayload(payload);
    const { data: updatedRow, error } = await adminSupabase
      .from('dresses')
      .update(updatePayload)
      .select('*')
      .eq('id', id);

    if (error) {
      response.status(500).json({ error: error.message });
      return;
    }

    const normalizedRow = Array.isArray(updatedRow) ? updatedRow[0] : updatedRow;

    const replacedAssets = uniqueManagedUploads([
      design?.image_url !== payload.imageUrl ? getManagedUploadAsset(design?.image_url) : null,
      design?.front_view_url !== payload.frontViewUrl ? getManagedUploadAsset(design?.front_view_url) : null,
      design?.side_view_url !== payload.sideViewUrl ? getManagedUploadAsset(design?.side_view_url) : null,
      design?.back_view_url !== payload.backViewUrl ? getManagedUploadAsset(design?.back_view_url) : null,
    ]);

    if (replacedAssets.length > 0) {
      await removeManagedUploads(adminSupabase, replacedAssets);
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

  const storageAssets = uniqueManagedUploads([
    getManagedUploadAsset(design?.image_url),
    getManagedUploadAsset(design?.front_view_url),
    getManagedUploadAsset(design?.side_view_url),
    getManagedUploadAsset(design?.back_view_url),
  ]);

  if (storageAssets.length > 0) {
    await removeManagedUploads(adminSupabase, storageAssets);
  }

  response.status(200).json({ ok: true });
}
