import type { NextApiRequest, NextApiResponse } from 'next';
import { setDesignLike } from '@/src/lib/engagementStore';

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const designId = typeof request.body?.designId === 'string' ? request.body.designId.trim() : '';
  const clientId = typeof request.body?.clientId === 'string' ? request.body.clientId.trim() : '';
  const liked = Boolean(request.body?.liked);

  if (!designId || !clientId) {
    response.status(400).json({ error: 'Design id and client id are required.' });
    return;
  }

  response.status(200).json({
    ok: true,
    count: await setDesignLike({ designId, clientId, liked }),
  });
}
