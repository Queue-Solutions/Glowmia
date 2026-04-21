import type { NextApiRequest, NextApiResponse } from 'next';
import { clearAdminSessionCookie, isAdminConfigured, setAdminSessionCookie, verifyAdminCredentials } from '@/src/lib/adminAuth';

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method === 'DELETE') {
    clearAdminSessionCookie(response);
    response.status(200).json({ ok: true });
    return;
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST, DELETE');
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  if (!isAdminConfigured()) {
    console.error('[Admin Session] Admin not configured - missing env vars');
    response.status(503).json({
      error: 'Admin credentials are not configured yet. Add ADMIN_USERNAME, ADMIN_PASSWORD_HASH, and ADMIN_SESSION_SECRET.',
    });
    return;
  }

  const username = typeof request.body?.username === 'string' ? request.body.username.trim() : '';
  const password = typeof request.body?.password === 'string' ? request.body.password.trim() : '';

  // Detect if password looks like a hash
  const looksLikeHash = 
    password.startsWith('scrypt') ||
    (password.length > 40 && /^[a-f0-9]+$/i.test(password));

  console.log('[Admin Session] Login attempt for username:', username);
  if (looksLikeHash) {
    console.warn('[Admin Session] Password appears to be a hash for username:', username);
    await wait(450);
    response.status(401).json({ 
      error: 'Invalid username or password. Tip: Please enter your password, not a system-generated key.' 
    });
    return;
  }

  if (!verifyAdminCredentials(username, password)) {
    console.error('[Admin Session] Invalid credentials for username:', username);
    await wait(450);
    response.status(401).json({ error: 'Invalid username or password.' });
    return;
  }

  console.log('[Admin Session] Successfully authenticated:', username);
  setAdminSessionCookie(response, username);
  response.status(200).json({ ok: true });
}
