import type { NextApiRequest, NextApiResponse } from 'next';
import { isAdminAuthenticatedRequest } from '@/src/lib/adminAuth';
import { getSupabaseAdminClient } from '@/src/lib/adminSupabase';
import { toDressInsertPayload, validateAdminDressPayload } from '@/src/lib/adminDesigns';
import { normalizeDressRow, type DressRow } from '@/src/data/designs';

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
    response.status(503).json({
      error: 'SUPABASE_SERVICE_ROLE_KEY is required for secure admin writes.',
    });
    return;
  }

  const { payload, error: validationError } = validateAdminDressPayload(request.body);

  if (!payload) {
    response.status(400).json({ error: validationError });
    return;
  }

  const { data, error } = await adminSupabase
    .from('dresses')
    .insert(toDressInsertPayload(payload))
    .select('*')
    .single();

  if (error) {
    response.status(500).json({ error: error.message });
    return;
  }

  response.status(201).json({
    ok: true,
    id: data.id,
    design: normalizeDressRow(data as DressRow, 0),
  });
}
