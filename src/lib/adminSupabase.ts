import { createClient } from '@supabase/supabase-js';

let adminSupabaseClient: ReturnType<typeof createClient> | null = null;
export const DRESS_IMAGES_BUCKET = 'dress-images';

export function getSupabaseAdminClient() {
  if (adminSupabaseClient) {
    return adminSupabaseClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

  if (!url || !serviceRoleKey) {
    return null;
  }

  adminSupabaseClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return adminSupabaseClient;
}
