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

function readJsonBody(request: NextApiRequest) {
  return new Promise<any>((resolve, reject) => {
    const chunks: Buffer[] = [];

    request.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    request.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(error);
      }
    });

    request.on('error', reject);
  });
}

function normalizeImageKind(value: string) {
  if (value === 'side' || value === 'back') {
    return value;
  }

  return 'front';
}

function sanitizeDressId(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-');
}

async function removeStoragePaths(adminSupabase: any, paths: unknown) {
  const storagePaths = Array.isArray(paths)
    ? paths.filter((entry): entry is string => typeof entry === 'string' && entry.startsWith('dresses/'))
    : [];

  if (storagePaths.length === 0) {
    return { error: null };
  }

  return adminSupabase.storage.from(DRESS_IMAGES_BUCKET).remove(storagePaths);
}

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'POST' && request.method !== 'DELETE') {
    response.setHeader('Allow', 'POST, DELETE');
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
    if (request.method === 'DELETE') {
      const body = await readJsonBody(request);
      const { error } = await removeStoragePaths(adminSupabase, body?.paths);

      if (error) {
        response.status(500).json({ error: error.message });
        return;
      }

      response.status(200).json({ ok: true });
      return;
    }

    const { fields, files } = await parseUploadRequest(request);
    const uploadKind = Array.isArray(fields.kind) ? fields.kind[0] : fields.kind;
    const normalizedKind = typeof uploadKind === 'string' ? uploadKind.trim() : '';
    const kind = normalizeImageKind(normalizedKind);
    const rawDressId = Array.isArray(fields.dressId) ? fields.dressId[0] : fields.dressId;
    const dressId = typeof rawDressId === 'string' ? sanitizeDressId(rawDressId) : '';
    const file = pickFile(files.file as File | File[] | undefined);

    if (!dressId) {
      response.status(400).json({ error: 'A dress id is required before uploading dress images.' });
      return;
    }

    if (!file) {
      response.status(400).json({ error: 'An image file is required.' });
      return;
    }

    const extension = path.extname(file.originalFilename || file.filepath || '').toLowerCase() || '.jpg';
    const storagePath = `dresses/${dressId}/${kind}-${Date.now()}${extension}`;
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
