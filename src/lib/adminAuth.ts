import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';

const ADMIN_SESSION_COOKIE = '__glowmia_admin';
const SESSION_DURATION_SECONDS = 60 * 60 * 12;

type SessionPayload = {
  username: string;
  exp: number;
};

function toBase64Url(value: Buffer | string) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64');
}

function safeEqualText(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function parseCookies(request: IncomingMessage) {
  const raw = request.headers.cookie ?? '';

  return raw.split(';').reduce<Record<string, string>>((cookies, entry) => {
    const [name, ...rest] = entry.trim().split('=');

    if (!name) {
      return cookies;
    }

    cookies[name] = decodeURIComponent(rest.join('=') || '');
    return cookies;
  }, {});
}

function signValue(value: string, secret: string) {
  return toBase64Url(createHmac('sha256', secret).update(value).digest());
}

function serializeCookie(name: string, value: string, maxAgeSeconds: number) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
  ];

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function appendSetCookieHeader(response: ServerResponse, cookie: string) {
  const current = response.getHeader('Set-Cookie');

  if (!current) {
    response.setHeader('Set-Cookie', cookie);
    return;
  }

  if (Array.isArray(current)) {
    response.setHeader('Set-Cookie', [...current.map(String), cookie]);
    return;
  }

  response.setHeader('Set-Cookie', [String(current), cookie]);
}

function buildSessionToken(username: string, secret: string) {
  const payload: SessionPayload = {
    username,
    exp: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signValue(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

function readSessionPayload(token: string, secret: string) {
  const [encodedPayload, signature] = token.split('.');

  if (!encodedPayload || !signature) {
    return null;
  }

  if (!safeEqualText(signValue(encodedPayload, secret), signature)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload).toString('utf8')) as SessionPayload;

    if (!payload.username || payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function getAdminConfig() {
  const config = {
    username: process.env.ADMIN_USERNAME?.trim() || '',
    passwordHash: process.env.ADMIN_PASSWORD_HASH?.trim() || '',
    sessionSecret: process.env.ADMIN_SESSION_SECRET?.trim() || '',
  };
  
  console.log('[Admin Config] Loaded:', {
    username: config.username ? 'SET' : 'MISSING',
    passwordHash: config.passwordHash ? `SET (length: ${config.passwordHash.length})` : 'MISSING',
    sessionSecret: config.sessionSecret ? 'SET' : 'MISSING',
  });
  
  return config;
}

export function isAdminConfigured() {
  const { username, passwordHash, sessionSecret } = getAdminConfig();
  return Boolean(username && passwordHash && sessionSecret);
}

export function createAdminPasswordHash(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyAdminPassword(password: string, storedHash: string) {
  const [algorithm, salt, expectedHash] = storedHash.split('$');

  if (algorithm !== 'scrypt' || !salt || !expectedHash) {
    console.error('[Admin Auth] Invalid hash format - algorithm:', algorithm, 'salt:', !!salt, 'hash:', !!expectedHash);
    return false;
  }

  const expectedBuffer = Buffer.from(expectedHash, 'hex');
  const derivedBuffer = scryptSync(password, salt, expectedBuffer.length);

  if (expectedBuffer.length !== derivedBuffer.length) {
    console.error('[Admin Auth] Buffer length mismatch');
    return false;
  }

  const isMatch = timingSafeEqual(expectedBuffer, derivedBuffer);
  console.log('[Admin Auth] Password verification:', isMatch ? 'PASS' : 'FAIL');
  return isMatch;
}

export function verifyAdminCredentials(username: string, password: string) {
  const config = getAdminConfig();

  if (!isAdminConfigured()) {
    return false;
  }

  return safeEqualText(username, config.username) && verifyAdminPassword(password, config.passwordHash);
}

export function setAdminSessionCookie(response: ServerResponse, username: string) {
  const { sessionSecret } = getAdminConfig();
  const token = buildSessionToken(username, sessionSecret);
  appendSetCookieHeader(response, serializeCookie(ADMIN_SESSION_COOKIE, token, SESSION_DURATION_SECONDS));
}

export function clearAdminSessionCookie(response: ServerResponse) {
  appendSetCookieHeader(response, serializeCookie(ADMIN_SESSION_COOKIE, '', 0));
}

export function getAdminUsernameFromRequest(request: IncomingMessage) {
  if (!isAdminConfigured()) {
    return null;
  }

  const cookies = parseCookies(request);
  const token = cookies[ADMIN_SESSION_COOKIE];

  if (!token) {
    return null;
  }

  const { username, sessionSecret } = getAdminConfig();
  const payload = readSessionPayload(token, sessionSecret);

  if (!payload || !safeEqualText(payload.username, username)) {
    return null;
  }

  return payload.username;
}

export function isAdminAuthenticatedRequest(request: IncomingMessage) {
  return Boolean(getAdminUsernameFromRequest(request));
}
