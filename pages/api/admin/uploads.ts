import { readFile } from 'fs/promises';
import path from 'path';
import formidable, { type File } from 'formidable';
import type { NextApiRequest, NextApiResponse } from 'next';
import { isAdminAuthenticatedRequest } from '@/src/lib/adminAuth';
import { DRESS_IMAGES_BUCKET, getSupabaseAdminClient } from '@/src/lib/adminSupabase';

export const config = {
  api: {
    bodyParser: false,
  },
};

function parseUploadRequest(request: NextApiRequest) {
  const form = formidable({
    multiples: false,
    keepExtensions: true,
    maxFiles: 1,
    maxFileSize: 10 * 1024 * 1024,
    filter: ({ mimetype }) => Boolean(mimetype?.startsWith('image/')),
  });

  return new Promise<{ fields: formidable.Fields; files: formidable.Files }>((resolve, reject) => {
    form.parse(request, (error, fields, files) => {
      if (error) {
        reject(error);
        return;
      }

      resolve({ fields, files });
    });
  });
}

function pickFile(fileValue: File | File[] | undefined) {
  if (!fileValue) {
    return null;
  }

  return Array.isArray(fileValue) ? fileValue[0] ?? null : fileValue;
}

function sanitizeFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-');
}

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  if (!isAdminAuthenticatedRequest(request)) {
    response.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  const adminSupabase = getSupabaseAdminClient() as any;

  if (!adminSupabase) {
    response.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY is required for uploads.' });
    return;
  }

  try {
    const { fields, files } = await parseUploadRequest(request);
    const uploadKind = Array.isArray(fields.kind) ? fields.kind[0] : fields.kind;
    const kind = typeof uploadKind === 'string' && uploadKind.trim() === 'cover' ? 'cover' : 'full';
    const file = pickFile(files.file as File | File[] | undefined);

    if (!file) {
      response.status(400).json({ error: 'An image file is required.' });
      return;
    }

    const extension = path.extname(file.originalFilename || file.filepath || '').toLowerCase() || '.jpg';
    const safeName = sanitizeFileName(path.basename(file.originalFilename || `upload${extension}`, extension));
    const storagePath = `admin-uploads/${kind}s/${Date.now()}-${safeName}${extension}`;
    const fileBuffer = await readFile(file.filepath);

    const { error } = await adminSupabase.storage.from(DRESS_IMAGES_BUCKET).upload(storagePath, fileBuffer, {
      contentType: file.mimetype || 'application/octet-stream',
      upsert: false,
    });

    if (error) {
      response.status(500).json({ error: error.message });
      return;
    }

    const { data } = adminSupabase.storage.from(DRESS_IMAGES_BUCKET).getPublicUrl(storagePath);

    response.status(201).json({
      ok: true,
      path: storagePath,
      publicUrl: data.publicUrl,
    });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Upload failed.',
    });
  }
}
