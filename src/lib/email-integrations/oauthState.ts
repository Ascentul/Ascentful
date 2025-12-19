import crypto from 'crypto';

export type EmailProvider = 'gmail' | 'outlook';
export type EmailScanMode = 'metadata_only' | 'enhanced';

type OAuthStatePayload = {
  v: 1;
  clerkId: string;
  provider: EmailProvider;
  mode: EmailScanMode;
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
  const secret = process.env.EMAIL_OAUTH_STATE_SECRET;
  if (!secret) {
    throw new Error('Missing EMAIL_OAUTH_STATE_SECRET');
  }
  return secret;
}

function sign(payloadB64: string): string {
  const secret = getStateSecret();
  const mac = crypto.createHmac('sha256', secret).update(payloadB64).digest();
  return base64UrlEncode(mac);
}

export function createOAuthState(input: {
  clerkId: string;
  provider: EmailProvider;
  mode: EmailScanMode;
}): string {
  const payload: OAuthStatePayload = {
    v: 1,
    clerkId: input.clerkId,
    provider: input.provider,
    mode: input.mode,
    ts: Date.now(),
    nonce: crypto.randomUUID(),
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sigB64 = sign(payloadB64);
  return `${payloadB64}.${sigB64}`;
}

export function verifyOAuthState(
  state: string,
  expected: { clerkId: string; provider: EmailProvider; maxAgeMs?: number },
): { mode: EmailScanMode } {
  const [payloadB64, sigB64] = state.split('.');
  if (!payloadB64 || !sigB64) {
    throw new Error('Invalid state');
  }

  const expectedSig = sign(payloadB64);
  if (!timingSafeEqual(sigB64, expectedSig)) {
    throw new Error('Invalid state signature');
  }

  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(base64UrlDecodeToString(payloadB64)) as OAuthStatePayload;
  } catch {
    throw new Error('Invalid state payload');
  }
  if (payload.v !== 1) throw new Error('Invalid state version');
  if (payload.clerkId !== expected.clerkId) throw new Error('State user mismatch');
  if (payload.provider !== expected.provider) throw new Error('State provider mismatch');

  const maxAgeMs = expected.maxAgeMs ?? 10 * 60 * 1000;
  if (Date.now() - payload.ts > maxAgeMs) {
    throw new Error('State expired');
  }

  return { mode: payload.mode };
}
