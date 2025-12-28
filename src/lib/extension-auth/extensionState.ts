import crypto from 'crypto';

/**
 * Extension OAuth State Management
 *
 * Handles HMAC-signed state tokens for the Chrome extension authentication flow.
 * Pattern follows src/lib/email-integrations/oauthState.ts
 */

type ExtensionStatePayload = {
  v: 1;
  extensionId: string;
  redirectUri: string;
  ts: number;
  nonce: string;
};

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecodeToString(input: string): string {
  const padded = input
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(input.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64').toString('utf8');
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function getStateSecret(): string {
  const secret = process.env.EXTENSION_STATE_SECRET;
  if (!secret) {
    throw new Error('Missing EXTENSION_STATE_SECRET environment variable');
  }
  return secret;
}

function sign(payloadB64: string): string {
  const secret = getStateSecret();
  const mac = crypto.createHmac('sha256', secret).update(payloadB64).digest();
  return base64UrlEncode(mac);
}

/**
 * Create a signed state token for extension OAuth flow
 */
export function createExtensionState(input: { extensionId: string; redirectUri: string }): string {
  const payload: ExtensionStatePayload = {
    v: 1,
    extensionId: input.extensionId,
    redirectUri: input.redirectUri,
    ts: Date.now(),
    nonce: crypto.randomUUID(),
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sigB64 = sign(payloadB64);
  return `${payloadB64}.${sigB64}`;
}

/**
 * Verify a signed state token and extract the payload
 */
export function verifyExtensionState(
  state: string,
  options?: { maxAgeMs?: number },
): ExtensionStatePayload {
  const parts = state.split('.');
  if (parts.length !== 2) {
    throw new Error('Invalid state format');
  }

  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) {
    throw new Error('Invalid state format');
  }

  // Verify signature using timing-safe comparison
  const expectedSig = sign(payloadB64);
  if (!timingSafeEqual(sigB64, expectedSig)) {
    throw new Error('Invalid state signature');
  }

  // Parse payload
  let payload: ExtensionStatePayload;
  try {
    payload = JSON.parse(base64UrlDecodeToString(payloadB64)) as ExtensionStatePayload;
  } catch {
    throw new Error('Invalid state payload');
  }

  // Validate version
  if (payload.v !== 1) {
    throw new Error('Invalid state version');
  }

  // Check expiry (default 10 minutes)
  const maxAgeMs = options?.maxAgeMs ?? 10 * 60 * 1000;
  if (Date.now() - payload.ts > maxAgeMs) {
    throw new Error('State expired');
  }

  return payload;
}

/**
 * Generate a short-lived session token for the extension
 * This token is used by the extension to authenticate API requests
 */
export function generateExtensionSessionToken(clerkId: string): {
  token: string;
  expiresAt: number;
} {
  const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour

  const payload = {
    v: 1,
    clerkId,
    expiresAt,
    nonce: crypto.randomUUID(),
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sigB64 = sign(payloadB64);

  return {
    token: `${payloadB64}.${sigB64}`,
    expiresAt,
  };
}

/**
 * Verify an extension session token and return the clerkId
 */
export function verifyExtensionSessionToken(token: string): { clerkId: string } {
  const parts = token.split('.');
  if (parts.length !== 2) {
    throw new Error('Invalid token format');
  }

  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) {
    throw new Error('Invalid token format');
  }

  // Verify signature
  const expectedSig = sign(payloadB64);
  if (!timingSafeEqual(sigB64, expectedSig)) {
    throw new Error('Invalid token signature');
  }

  // Parse payload
  let payload: { v: number; clerkId: string; expiresAt: number };
  try {
    payload = JSON.parse(base64UrlDecodeToString(payloadB64));
  } catch {
    throw new Error('Invalid token payload');
  }

  // Check expiry
  if (Date.now() > payload.expiresAt) {
    throw new Error('Token expired');
  }

  return { clerkId: payload.clerkId };
}
