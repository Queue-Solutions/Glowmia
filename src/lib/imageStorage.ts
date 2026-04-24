import { randomUUID } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const BUCKET_NAME = 'saved-designs';
const SUPPORTED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/avif'];

let supabaseStorageClient: SupabaseClient | null = null;

/**
 * Gets or creates the Supabase client for image storage operations.
 * Uses SUPABASE_SERVICE_ROLE_KEY for server-side uploads.
 */
function getSupabaseStorageClient(): SupabaseClient {
  if (supabaseStorageClient) {
    return supabaseStorageClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    throw new Error(
      'Supabase is not configured for image storage. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in environment variables.',
    );
  }

  supabaseStorageClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return supabaseStorageClient;
}

/**
 * Validates if a string is a valid HTTP/HTTPS URL.
 */
function isValidHttpUrl(url: string): boolean {
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Extracts a file extension from a MIME type.
 */
function getExtensionFromMimeType(mimeType: string): string {
  const baseType = mimeType.split(';')[0].toLowerCase();
  switch (baseType) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/avif':
      return 'avif';
    default:
      return 'png';
  }
}

/**
 * Fetches a remote image and returns its buffer and MIME type.
 */
async function fetchRemoteImage(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const response = await fetch(url, {
    // Set a reasonable timeout
    signal: AbortSignal.timeout(30000),
    // Don't follow redirects beyond a reasonable limit
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch image from remote URL: HTTP ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || 'image/png';

  // Validate MIME type
  const baseContentType = contentType.split(';')[0].toLowerCase();
  if (!SUPPORTED_MIME_TYPES.includes(baseContentType)) {
    throw new Error(`Unsupported image MIME type: ${baseContentType}. Supported types: ${SUPPORTED_MIME_TYPES.join(', ')}`);
  }

  // Get the response as an array buffer and convert to Buffer
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Validate that we got some data
  if (buffer.length === 0) {
    throw new Error('Remote image is empty or unreachable.');
  }

  // Reasonable size limit: 50MB
  const MAX_IMAGE_SIZE = 50 * 1024 * 1024;
  if (buffer.length > MAX_IMAGE_SIZE) {
    throw new Error(`Image size exceeds maximum limit of ${MAX_IMAGE_SIZE / (1024 * 1024)}MB.`);
  }

  return { buffer, mimeType: baseContentType };
}

/**
 * Uploads an image buffer to Supabase Storage and returns the public URL.
 */
async function uploadImageToSupabaseStorage(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const supabase = getSupabaseStorageClient();

  // Generate a unique file path: saved-designs/{YYYY}/{MM}/{uuid}.{ext}
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const uuid = randomUUID();
  const extension = getExtensionFromMimeType(mimeType);
  const filePath = `${year}/${month}/${uuid}.${extension}`;

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage.from(BUCKET_NAME).upload(filePath, buffer, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) {
    throw new Error(`Failed to upload image to Supabase Storage: ${error.message}`);
  }

  if (!data || !data.path) {
    throw new Error('Upload returned no file path.');
  }

  // Get the public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET_NAME).getPublicUrl(data.path);

  if (!publicUrl) {
    throw new Error('Failed to generate public URL for uploaded image.');
  }

  return publicUrl;
}

/**
 * Persists a remote image (e.g., from Replicate) to Supabase Storage.
 *
 * This function:
 * 1. Validates the remote URL
 * 2. Fetches the image from the remote URL
 * 3. Validates the image MIME type and size
 * 4. Uploads to Supabase Storage bucket "saved-designs"
 * 5. Returns the permanent public Supabase URL
 *
 * @param remoteUrl - The temporary image URL (e.g., from Replicate)
 * @returns The permanent public Supabase Storage URL
 * @throws Error if any step fails
 */
export async function persistRemoteImageToSupabaseStorage(remoteUrl: string): Promise<string> {
  // Step 1: Validate the URL
  if (!isValidHttpUrl(remoteUrl)) {
    throw new Error('Remote image URL is invalid or not an HTTP/HTTPS URL.');
  }

  // Step 2: Fetch the remote image
  console.log('[imageStorage] Fetching remote image from:', remoteUrl);
  const { buffer, mimeType } = await fetchRemoteImage(remoteUrl);
  console.log('[imageStorage] Successfully fetched image:', { size: buffer.length, mimeType });

  // Step 3: Upload to Supabase Storage
  console.log('[imageStorage] Uploading image to Supabase Storage bucket:', BUCKET_NAME);
  const permanentUrl = await uploadImageToSupabaseStorage(buffer, mimeType);
  console.log('[imageStorage] Successfully uploaded image:', { permanentUrl });

  return permanentUrl;
}
