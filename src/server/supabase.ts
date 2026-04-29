import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let publicServerClient: SupabaseClient | null | undefined;
let adminServerClient: SupabaseClient | null | undefined;

function readEnv(value: string | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

export function getServerSupabaseUrl() {
  return readEnv(process.env.SUPABASE_URL) || readEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function getServerSupabaseAnonKey() {
  return (
    readEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    readEnv(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  );
}

export function getServerSupabaseServiceRoleKey() {
  return readEnv(process.env.SUPABASE_SERVICE_ROLE_KEY) || readEnv(process.env.SUPABASE_KEY);
}

export function getServerSupabaseClient() {
  if (publicServerClient !== undefined) {
    return publicServerClient;
  }

  const url = getServerSupabaseUrl();
  const key = getServerSupabaseAnonKey();

  if (!url || !key) {
    publicServerClient = null;
    return publicServerClient;
  }

  publicServerClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return publicServerClient;
}

export function getServerSupabaseAdminClient() {
  if (adminServerClient !== undefined) {
    return adminServerClient;
  }

  const url = getServerSupabaseUrl();
  const key = getServerSupabaseServiceRoleKey();

  if (!url || !key) {
    adminServerClient = null;
    return adminServerClient;
  }

  adminServerClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return adminServerClient;
}

export function requireServerSupabaseAdminClient() {
  const client = getServerSupabaseAdminClient();

  if (!client) {
    throw new Error('Supabase admin client is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  return client;
}
