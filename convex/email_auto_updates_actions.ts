'use node';

import { v } from 'convex/values';
import crypto from 'crypto';
import OpenAI from 'openai';

import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { action, internalAction } from './_generated/server';
import {
  type ApplicationForMatching,
  AUTO_UPDATE_CONFIDENCE_THRESHOLD,
  classifyEmail,
  type EmailProvider,
  type EmailScanMode,
  extractEmailAddressDomain,
  limitSnippet,
  rankApplicationsForEmail,
  subjectGate,
  SUGGEST_CONFIDENCE_THRESHOLD,
} from './lib/emailAutoUpdates';
import {
  buildEmailAiExtractorMessages,
  EMAIL_AI_EXTRACTOR_PROMPT_VERSION,
  type EmailAiExtractorOutput,
  EmailAiExtractorOutputSchema,
  mergeRuleAndAiClassification,
} from './lib/emailAutoUpdatesAi';
import { sanitizeError } from './lib/piiSafe';

type CipherPayload = {
  version: 'v1';
  ivB64Url: string;
  dataB64Url: string;
  tagB64Url: string;
};

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(input: string): Buffer {
  const padded = input
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(input.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64');
}

function getEncryptionKey(): Buffer {
  const raw = process.env.EMAIL_INTEGRATION_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('Missing EMAIL_INTEGRATION_ENCRYPTION_KEY');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('EMAIL_INTEGRATION_ENCRYPTION_KEY must be 32 bytes (base64-encoded)');
  }
  return key;
}

function encryptSecret(plaintext: string, aad: string): { ciphertext: string; version: 'v1' } {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload: CipherPayload = {
    version: 'v1',
    ivB64Url: base64UrlEncode(iv),
    dataB64Url: base64UrlEncode(encrypted),
    tagB64Url: base64UrlEncode(tag),
  };
  const ciphertext = `v1.${payload.ivB64Url}.${payload.dataB64Url}.${payload.tagB64Url}`;
  return { ciphertext, version: 'v1' };
}

function decryptSecret(ciphertext: string, aad: string): string {
  const [version, ivB64Url, dataB64Url, tagB64Url] = ciphertext.split('.');
  if (version !== 'v1' || !ivB64Url || !dataB64Url || !tagB64Url) {
    throw new Error('Unsupported token cipher version');
  }
  const key = getEncryptionKey();
  const iv = base64UrlDecode(ivB64Url);
  const data = base64UrlDecode(dataB64Url);
  const tag = base64UrlDecode(tagB64Url);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

function sha256Base64Url(input: string): string {
  return base64UrlEncode(crypto.createHash('sha256').update(input, 'utf8').digest());
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function getAppBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://app.ascentful.io';
}

function getGmailScopes(mode: EmailScanMode): string[] {
  const gmailScope =
    mode === 'enhanced'
      ? 'https://www.googleapis.com/auth/gmail.readonly'
      : 'https://www.googleapis.com/auth/gmail.metadata';
  return ['openid', 'email', gmailScope];
}

function getOutlookScopes(mode: EmailScanMode): string[] {
  const mailScope = mode === 'enhanced' ? 'Mail.Read' : 'Mail.ReadBasic';
  return ['openid', 'email', 'offline_access', mailScope];
}

const DEFAULT_FETCH_TIMEOUT_MS = 15000; // 15 seconds

async function postForm<T>(
  url: string,
  body: Record<string, string>,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body).toString(),
      signal: controller.signal,
    });
    if (!res.ok) {
      // Truncate error body to avoid logging sensitive data (tokens, user info)
      const errorBody = await res.text().catch(() => '');
      const truncatedBody = errorBody.slice(0, 200);
      console.error(`[postForm] HTTP ${res.status} for ${url}:`, truncatedBody);
      throw new Error(`HTTP ${res.status}: ${truncatedBody}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getJson<T>(
  url: string,
  accessToken: string,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    if (!res.ok) {
      // Truncate error body to avoid logging sensitive data (tokens, user info)
      const errorBody = await res.text().catch(() => '');
      const truncatedBody = errorBody.slice(0, 200);
      console.error(`[getJson] HTTP ${res.status} for ${url}:`, truncatedBody);
      throw new Error(`HTTP ${res.status}: ${truncatedBody}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function postJson<T>(
  url: string,
  accessToken: string,
  body: unknown,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

function decodeJwtPayload(jwt: string): Record<string, any> | null {
  const parts = jwt.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(parts[1]).toString('utf8'));
    return payload;
  } catch {
    return null;
  }
}

type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
};

type GmailProfileResponse = {
  emailAddress: string;
  historyId?: string;
};

type GmailWatchResponse = {
  historyId?: string;
  expiration?: string;
};

type MicrosoftTokenResponse = {
  token_type: string;
  scope?: string;
  expires_in?: number;
  access_token: string;
  refresh_token?: string;
  id_token?: string;
};

type GraphSubscriptionResponse = {
  id: string;
  expirationDateTime: string;
};

type CompleteOAuthConnectionResult = {
  success: true;
  integrationId: Id<'email_integrations'>;
  email?: string;
  outlook?: { subscriptionId?: string };
};

type RunIntegrationScanResult =
  | { success: true; skipped: true }
  | { success: true; processed: number }
  | { success: false; reason: 'not_found' | 'token_decrypt_failed' }
  | { success: false; error: string };

export const completeOAuthConnection = action({
  args: {
    provider: v.union(v.literal('gmail'), v.literal('outlook')),
    code: v.string(),
    redirectUri: v.string(),
    mode: v.union(v.literal('metadata_only'), v.literal('enhanced')),
  },
  handler: async (ctx, args): Promise<CompleteOAuthConnectionResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }

    const userRes = await ctx.runQuery(internal.email_auto_updates.getUserIdByClerkId, {
      clerkId: identity.subject,
    });
    if (!userRes) {
      throw new Error('User not found');
    }
    const userId = userRes.userId as Id<'users'>;

    if (args.provider === 'gmail') {
      const clientId = requireEnv('GOOGLE_OAUTH_CLIENT_ID');
      const clientSecret = requireEnv('GOOGLE_OAUTH_CLIENT_SECRET');

      console.log('[completeOAuthConnection] Exchanging code for token...');
      const token = await postForm<GoogleTokenResponse>('https://oauth2.googleapis.com/token', {
        code: args.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: args.redirectUri,
        grant_type: 'authorization_code',
      });

      console.log('[completeOAuthConnection] Token exchange successful, scopes:', token.scope);

      if (!token.refresh_token) {
        throw new Error(
          'Missing refresh token (reconnect with consent to enable background scanning)',
        );
      }

      const aad = `email_integrations:gmail:${userId}`;
      const encrypted = encryptSecret(token.refresh_token, aad);
      const scopes = (token.scope || getGmailScopes(args.mode).join(' '))
        .split(' ')
        .filter(Boolean);

      console.log('[completeOAuthConnection] Fetching Gmail profile with access token...');

      // Check if Gmail scope was actually granted
      const grantedScopes = (token.scope || '').split(' ');
      const hasGmailScope = grantedScopes.some((s) => s.includes('gmail.'));
      console.log(
        '[completeOAuthConnection] Gmail scope granted:',
        hasGmailScope,
        'All scopes:',
        grantedScopes,
      );

      let profile: GmailProfileResponse;
      if (hasGmailScope) {
        try {
          profile = await getJson<GmailProfileResponse>(
            'https://gmail.googleapis.com/gmail/v1/users/me/profile',
            token.access_token,
          );
        } catch (gmailError) {
          console.error(
            '[completeOAuthConnection] Gmail profile fetch failed, trying userinfo fallback:',
            gmailError,
          );
          // Fallback to userinfo endpoint if Gmail API fails
          const userinfo = await getJson<{ email: string }>(
            'https://www.googleapis.com/oauth2/v2/userinfo',
            token.access_token,
          );
          profile = { emailAddress: userinfo.email };
        }
      } else {
        // No Gmail scope, use userinfo endpoint
        console.log('[completeOAuthConnection] No Gmail scope, using userinfo endpoint...');
        const userinfo = await getJson<{ email: string }>(
          'https://www.googleapis.com/oauth2/v2/userinfo',
          token.access_token,
        );
        profile = { emailAddress: userinfo.email };
      }

      let watchExpiration: number | undefined;
      let watchHistoryId: string | undefined;

      const topicName = process.env.GMAIL_PUBSUB_TOPIC;
      if (topicName) {
        try {
          const watch = await postJson<GmailWatchResponse>(
            'https://gmail.googleapis.com/gmail/v1/users/me/watch',
            token.access_token,
            { labelIds: ['INBOX'], topicName },
          );
          watchHistoryId = watch.historyId;
          watchExpiration = watch.expiration ? Number(watch.expiration) : undefined;
        } catch (e) {
          // Push setup failure should not block connection; polling fallback handles scanning.
        }
      }

      const upsert = await ctx.runMutation(internal.email_auto_updates.upsertIntegrationFromOAuth, {
        userId,
        provider: 'gmail',
        encryptedRefreshToken: encrypted.ciphertext,
        tokenCipherVersion: encrypted.version,
        scopes,
        mode: args.mode,
        providerAccountEmail: profile.emailAddress,
        providerAccountId: profile.emailAddress,
        cursor: undefined,
        gmailHistoryId: watchHistoryId || profile.historyId,
        gmailWatchExpiration: watchExpiration,
        outlookSubscriptionId: undefined,
        outlookSubscriptionExpiration: undefined,
        outlookClientStateHash: undefined,
      });

      return { success: true, integrationId: upsert.integrationId, email: profile.emailAddress };
    }

    const tenant = process.env.MICROSOFT_OAUTH_TENANT || 'common';
    const clientId = requireEnv('MICROSOFT_OAUTH_CLIENT_ID');
    const clientSecret = requireEnv('MICROSOFT_OAUTH_CLIENT_SECRET');
    const scope = getOutlookScopes(args.mode).join(' ');

    const token = await postForm<MicrosoftTokenResponse>(
      `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      {
        client_id: clientId,
        client_secret: clientSecret,
        code: args.code,
        redirect_uri: args.redirectUri,
        grant_type: 'authorization_code',
        scope,
      },
    );

    if (!token.refresh_token) {
      throw new Error('Missing refresh token (offline_access scope required)');
    }

    const idTokenPayload = token.id_token ? decodeJwtPayload(token.id_token) : null;
    const providerEmail =
      (idTokenPayload?.preferred_username as string | undefined) ||
      (idTokenPayload?.email as string | undefined);
    const providerAccountId = (idTokenPayload?.oid as string | undefined) || providerEmail;

    const notificationUrl = `${getAppBaseUrl()}/api/integrations/outlook/webhook`;
    const clientState = base64UrlEncode(crypto.randomBytes(32));
    const clientStateHash = sha256Base64Url(clientState);

    let subscriptionId: string | undefined;
    let subscriptionExpiration: number | undefined;

    try {
      const expires = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 - 5 * 60 * 1000).toISOString();
      const sub = await postJson<GraphSubscriptionResponse>(
        'https://graph.microsoft.com/v1.0/subscriptions',
        token.access_token,
        {
          changeType: 'created',
          notificationUrl,
          resource: "me/mailFolders('inbox')/messages",
          expirationDateTime: expires,
          clientState,
          latestSupportedTlsVersion: 'v1_2',
        },
      );
      subscriptionId = sub.id;
      subscriptionExpiration = Date.parse(sub.expirationDateTime);
    } catch (e) {
      // Subscription setup failure should not block connection; polling fallback handles scanning.
    }

    const aad = `email_integrations:outlook:${userId}`;
    const encrypted = encryptSecret(token.refresh_token, aad);
    const scopes = (token.scope || scope).split(' ').filter(Boolean);

    const upsert = await ctx.runMutation(internal.email_auto_updates.upsertIntegrationFromOAuth, {
      userId,
      provider: 'outlook',
      encryptedRefreshToken: encrypted.ciphertext,
      tokenCipherVersion: encrypted.version,
      scopes,
      mode: args.mode,
      providerAccountEmail: providerEmail,
      providerAccountId,
      cursor: undefined,
      gmailHistoryId: undefined,
      gmailWatchExpiration: undefined,
      outlookSubscriptionId: subscriptionId,
      outlookSubscriptionExpiration: subscriptionExpiration,
      outlookClientStateHash: subscriptionId ? clientStateHash : undefined,
    });

    return {
      success: true,
      integrationId: upsert.integrationId,
      email: providerEmail,
      outlook: { subscriptionId },
    };
  },
});

export const runIntegrationScan = internalAction({
  args: {
    integrationId: v.id('email_integrations'),
  },
  handler: async (ctx, args): Promise<RunIntegrationScanResult> => {
    const runAt = Date.now();
    const integration = await ctx.runQuery(internal.email_auto_updates.getIntegrationForScan, {
      integrationId: args.integrationId,
    });

    if (!integration) return { success: false, reason: 'not_found' };
    if (integration.status !== 'connected' || !integration.enabled) {
      await ctx.runMutation(internal.email_auto_updates.updateIntegrationAfterScan, {
        integrationId: args.integrationId,
        lastScanAt: integration.last_scan_at,
        cursor: integration.cursor,
        gmailHistoryId: integration.gmail_history_id,
        scanLockRelease: true,
      });
      return { success: true, skipped: true };
    }

    const userId = integration.user_id as Id<'users'>;
    const provider = integration.provider as EmailProvider;
    const mode = integration.mode as EmailScanMode;

    const aad = `email_integrations:${provider}:${userId}`;
    let refreshToken: string;
    try {
      if (!integration.encrypted_refresh_token) {
        throw new Error('Missing encrypted refresh token');
      }
      refreshToken = decryptSecret(integration.encrypted_refresh_token, aad);
    } catch (e) {
      await ctx.runMutation(internal.email_auto_updates.updateIntegrationAfterScan, {
        integrationId: args.integrationId,
        scanLockRelease: true,
      });
      return { success: false, reason: 'token_decrypt_failed' };
    }

    const applications = (await ctx.runQuery(
      internal.email_auto_updates.getUserApplicationsForMatching,
      {
        userId,
      },
    )) as ApplicationForMatching[];

    try {
      if (provider === 'gmail') {
        const access = await refreshGoogleAccessToken(refreshToken, integration.scopes as string[]);
        if (access.refreshTokenRotated) {
          const encrypted = encryptSecret(access.refreshTokenRotated, aad);
          await ctx.runMutation(internal.email_auto_updates.updateIntegrationRefreshToken, {
            integrationId: args.integrationId,
            encryptedRefreshToken: encrypted.ciphertext,
            tokenCipherVersion: encrypted.version,
            scopes: access.scopes,
          });
        }

        const scan = await scanGmailInbox({
          accessToken: access.accessToken,
          sinceMs: integration.last_scan_at ?? runAt,
          mode,
          applications,
        });

        await ctx.runMutation(internal.email_auto_updates.ingestScanResults, {
          integrationId: args.integrationId,
          runAt,
          provider: 'gmail',
          results: scan.results,
        });

        await ctx.runMutation(internal.email_auto_updates.updateIntegrationAfterScan, {
          integrationId: args.integrationId,
          lastScanAt: scan.newLastScanAt,
          cursor: integration.cursor,
          gmailHistoryId: integration.gmail_history_id,
          scanLockRelease: true,
        });

        return { success: true, processed: scan.results.length };
      }

      const access = await refreshMicrosoftAccessToken(
        refreshToken,
        integration.scopes as string[],
      );
      if (access.refreshTokenRotated) {
        const encrypted = encryptSecret(access.refreshTokenRotated, aad);
        await ctx.runMutation(internal.email_auto_updates.updateIntegrationRefreshToken, {
          integrationId: args.integrationId,
          encryptedRefreshToken: encrypted.ciphertext,
          tokenCipherVersion: encrypted.version,
          scopes: access.scopes,
        });
      }

      const scan = await scanOutlookInbox({
        accessToken: access.accessToken,
        cursor: integration.cursor,
        sinceMs: integration.last_scan_at ?? runAt,
        mode,
        applications,
      });

      await ctx.runMutation(internal.email_auto_updates.ingestScanResults, {
        integrationId: args.integrationId,
        runAt,
        provider: 'outlook',
        results: scan.results,
      });

      await ctx.runMutation(internal.email_auto_updates.updateIntegrationAfterScan, {
        integrationId: args.integrationId,
        lastScanAt: scan.newLastScanAt,
        cursor: scan.newCursor,
        gmailHistoryId: integration.gmail_history_id,
        scanLockRelease: true,
      });

      return { success: true, processed: scan.results.length };
    } catch (error) {
      const sanitized = sanitizeError(error);
      await ctx.runMutation(internal.email_auto_updates.updateIntegrationAfterScan, {
        integrationId: args.integrationId,
        scanLockRelease: true,
      });
      return { success: false, error: sanitized.message };
    }
  },
});

async function refreshGoogleAccessToken(
  refreshToken: string,
  scopes: string[],
): Promise<{
  accessToken: string;
  scopes: string[];
  refreshTokenRotated?: string;
}> {
  const clientId = requireEnv('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = requireEnv('GOOGLE_OAUTH_CLIENT_SECRET');

  const res = await postForm<GoogleTokenResponse>('https://oauth2.googleapis.com/token', {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  return {
    accessToken: res.access_token,
    scopes: (res.scope ? res.scope.split(' ') : scopes).filter(Boolean),
    refreshTokenRotated: res.refresh_token,
  };
}

async function refreshMicrosoftAccessToken(
  refreshToken: string,
  scopes: string[],
): Promise<{ accessToken: string; scopes: string[]; refreshTokenRotated?: string }> {
  const tenant = process.env.MICROSOFT_OAUTH_TENANT || 'common';
  const clientId = requireEnv('MICROSOFT_OAUTH_CLIENT_ID');
  const clientSecret = requireEnv('MICROSOFT_OAUTH_CLIENT_SECRET');
  const scope = scopes.length > 0 ? scopes.join(' ') : 'offline_access Mail.ReadBasic';

  const res = await postForm<MicrosoftTokenResponse>(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope,
    },
  );

  return {
    accessToken: res.access_token,
    scopes: (res.scope ? res.scope.split(' ') : scopes).filter(Boolean),
    refreshTokenRotated: res.refresh_token,
  };
}

type GmailListResponse = {
  messages?: Array<{ id: string; threadId: string }>;
};

type GmailMessageResponse = {
  id: string;
  threadId: string;
  internalDate?: string;
  snippet?: string;
  payload?: { headers?: Array<{ name: string; value: string }> };
};

function getHeader(
  headers: Array<{ name: string; value: string }> | undefined,
  name: string,
): string | undefined {
  if (!headers) return undefined;
  const found = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return found?.value;
}

function stripJsonCodeFences(content: string): string {
  let clean = (content || '').trim();
  if (clean.startsWith('```')) {
    clean = clean
      .replace(/^```json\n?/, '')
      .replace(/^```\n?/, '')
      .replace(/\n?```$/, '')
      .trim();
  }
  return clean;
}

function getEmailAiExtractorConfig(): { model: string; maxCallsPerScan: number } {
  const model = process.env.EMAIL_AUTO_UPDATES_AI_MODEL || 'gpt-4o-mini';
  const rawMaxCalls = process.env.EMAIL_AUTO_UPDATES_AI_MAX_CALLS;
  const parsedMaxCalls = rawMaxCalls ? Number(rawMaxCalls) : 5;
  const maxCallsPerScan =
    Number.isFinite(parsedMaxCalls) && parsedMaxCalls > 0 ? parsedMaxCalls : 5;
  return { model, maxCallsPerScan: Math.min(25, Math.floor(maxCallsPerScan)) };
}

function getOpenAiClientIfEnabled(mode: EmailScanMode): OpenAI | null {
  if (mode !== 'enhanced') return null;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

async function tryAiClassifyEmail(input: {
  openai: OpenAI;
  model: string;
  subject: string;
  from: string;
  snippet?: string;
}): Promise<EmailAiExtractorOutput | null> {
  const messages = buildEmailAiExtractorMessages({
    subject: input.subject,
    from: input.from,
    snippet: input.snippet,
  });

  const response = await input.openai.chat.completions.create({
    model: input.model,
    response_format: { type: 'json_object' },
    messages,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonCodeFences(content));
  } catch {
    return null;
  }

  const validation = EmailAiExtractorOutputSchema.safeParse(parsed);
  if (!validation.success) return null;

  return validation.data;
}

async function scanGmailInbox(input: {
  accessToken: string;
  sinceMs: number;
  mode: EmailScanMode;
  applications: ApplicationForMatching[];
}): Promise<{ results: any[]; newLastScanAt: number }> {
  const afterSeconds = Math.floor(input.sinceMs / 1000);
  let effectiveMode = input.mode;

  const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  listUrl.searchParams.set('labelIds', 'INBOX');
  listUrl.searchParams.set('maxResults', '25');

  // Only use 'q' parameter in enhanced mode - metadata scope doesn't support it
  if (input.mode === 'enhanced') {
    listUrl.searchParams.set('q', `after:${afterSeconds}`);
  }

  console.log(
    '[scanGmailInbox] Scanning for emails after:',
    new Date(input.sinceMs).toISOString(),
    'mode:',
    input.mode,
  );

  let listed: GmailListResponse;
  try {
    listed = await getJson<GmailListResponse>(listUrl.toString(), input.accessToken);
  } catch (error: any) {
    // If we get a scope error in enhanced mode, fall back to metadata-only behavior
    if (input.mode === 'enhanced' && error?.message?.includes('Metadata scope')) {
      console.log(
        '[scanGmailInbox] Enhanced mode failed due to scope mismatch, falling back to metadata-only mode',
      );
      effectiveMode = 'metadata_only';
      listUrl.searchParams.delete('q');
      listed = await getJson<GmailListResponse>(listUrl.toString(), input.accessToken);
    } else {
      throw error;
    }
  }
  const messages = listed.messages || [];

  console.log(
    '[scanGmailInbox] Found',
    messages.length,
    'messages to process, effectiveMode:',
    effectiveMode,
  );

  const openai = getOpenAiClientIfEnabled(effectiveMode);
  const aiConfig = getEmailAiExtractorConfig();
  let aiCallsRemaining = openai ? aiConfig.maxCallsPerScan : 0;
  let aiErrorLogged = false;

  let newLastScanAt = input.sinceMs;
  const results: any[] = [];

  for (const m of messages) {
    const msgUrl = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}`);
    msgUrl.searchParams.set('format', effectiveMode === 'enhanced' ? 'full' : 'metadata');
    msgUrl.searchParams.append('metadataHeaders', 'Subject');
    msgUrl.searchParams.append('metadataHeaders', 'From');
    msgUrl.searchParams.append('metadataHeaders', 'Date');

    const msg = await getJson<GmailMessageResponse>(msgUrl.toString(), input.accessToken);
    const headers = msg.payload?.headers || [];
    const subject = getHeader(headers, 'Subject') || '';
    const from = getHeader(headers, 'From') || '';
    const receivedAt = msg.internalDate ? Number(msg.internalDate) : Date.now();
    if (receivedAt > newLastScanAt) newLastScanAt = receivedAt;

    // In metadata mode, filter by date client-side since we can't use 'q' parameter
    if (effectiveMode === 'metadata_only' && receivedAt < input.sinceMs) {
      console.log('[scanGmailInbox] Skipping old email:', {
        subject,
        receivedAt: new Date(receivedAt).toISOString(),
      });
      continue;
    }

    const gate = subjectGate({ subject, from });
    console.log('[scanGmailInbox] Processing email:', {
      subject,
      from,
      gatePassed: gate.passed,
      matchedPatterns: gate.matchedPatterns,
    });
    if (!gate.passed) continue;

    const snippet = effectiveMode === 'enhanced' ? limitSnippet(msg.snippet) : undefined;
    const baseClassification = classifyEmail({ subject, from, snippet });
    console.log('[scanGmailInbox] Classification:', {
      eventType: baseClassification.eventType,
      confidence: baseClassification.confidence,
      reason: baseClassification.reason,
    });
    if (
      baseClassification.confidence < SUGGEST_CONFIDENCE_THRESHOLD ||
      !baseClassification.eventType
    )
      continue;

    let classification = baseClassification;
    let classificationSource: string = 'rules';
    const classificationReason: string | undefined = baseClassification.reason;
    let aiPromptVersion: string | undefined;
    let aiModel: string | undefined;
    let aiSummary: string | undefined;

    if (
      openai &&
      aiCallsRemaining > 0 &&
      input.mode === 'enhanced' &&
      classification.confidence < AUTO_UPDATE_CONFIDENCE_THRESHOLD
    ) {
      aiCallsRemaining -= 1;
      try {
        const aiRes = await tryAiClassifyEmail({
          openai,
          model: aiConfig.model,
          subject,
          from,
          snippet,
        });
        if (aiRes) {
          const merged = mergeRuleAndAiClassification({ rule: classification, ai: aiRes });
          classification = {
            ...classification,
            eventType: merged.eventType,
            confidence: merged.confidence,
            entities: merged.entities,
          };
          classificationSource = merged.classificationSource;
          aiPromptVersion = EMAIL_AI_EXTRACTOR_PROMPT_VERSION;
          aiModel = aiConfig.model;
          aiSummary = aiRes.summary;
        }
      } catch (e) {
        if (!aiErrorLogged) {
          aiErrorLogged = true;
          console.warn('[email_auto_updates] AI extractor failed:', sanitizeError(e));
        }
      }
    }

    const threadLinkedApplicationId: string | undefined = undefined;
    const match = rankApplicationsForEmail({
      applications: input.applications,
      extracted: classification.entities,
      subject,
      from,
      threadLinkedApplicationId,
    });

    const best = match.best;
    results.push({
      message_id: msg.id,
      thread_id: msg.threadId,
      subject,
      from,
      received_at: receivedAt,
      snippet_limited: snippet,
      event_type: classification.eventType,
      confidence: classification.confidence,
      extracted_entities: classification.entities,
      classification_source: classificationSource,
      classification_reason: classificationReason,
      ai_prompt_version: aiPromptVersion,
      ai_model: aiModel,
      ai_summary: aiSummary,
      matched_application_id: best?.applicationId as any,
      match_confidence: best?.score,
      match_signals: best?.signals,
      candidate_applications: match.top,
      from_domain: extractEmailAddressDomain(from),
    });
  }

  return { results, newLastScanAt };
}

type GraphDeltaResponse = {
  value: any[];
  '@odata.nextLink'?: string;
  '@odata.deltaLink'?: string;
};

async function scanOutlookInbox(input: {
  accessToken: string;
  cursor?: string;
  sinceMs: number;
  mode: EmailScanMode;
  applications: ApplicationForMatching[];
}): Promise<{ results: any[]; newLastScanAt: number; newCursor?: string }> {
  const select =
    input.mode === 'enhanced'
      ? 'id,conversationId,receivedDateTime,from,subject,bodyPreview'
      : 'id,conversationId,receivedDateTime,from,subject';
  let url =
    input.cursor ||
    `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$select=${select}&$top=25`;

  const results: any[] = [];
  let newLastScanAt = input.sinceMs;
  let newCursor: string | undefined = input.cursor;

  const openai = getOpenAiClientIfEnabled(input.mode);
  const aiConfig = getEmailAiExtractorConfig();
  let aiCallsRemaining = openai ? aiConfig.maxCallsPerScan : 0;
  let aiErrorLogged = false;

  while (results.length < 25 && url) {
    const delta = await getJson<GraphDeltaResponse>(url, input.accessToken);
    for (const item of delta.value || []) {
      if (item['@removed']) continue;
      const subject = item.subject || '';
      const fromAddress = item.from?.emailAddress?.address || '';
      const fromName = item.from?.emailAddress?.name || '';
      const from =
        fromName && fromAddress ? `${fromName} <${fromAddress}>` : fromAddress || fromName || '';
      const receivedAt = item.receivedDateTime ? Date.parse(item.receivedDateTime) : Date.now();
      if (receivedAt < input.sinceMs) continue;
      if (receivedAt > newLastScanAt) newLastScanAt = receivedAt;

      const gate = subjectGate({ subject, from });
      if (!gate.passed) continue;

      const snippet = input.mode === 'enhanced' ? limitSnippet(item.bodyPreview) : undefined;
      const baseClassification = classifyEmail({ subject, from, snippet });
      if (
        baseClassification.confidence < SUGGEST_CONFIDENCE_THRESHOLD ||
        !baseClassification.eventType
      )
        continue;

      let classification = baseClassification;
      let classificationSource: string = 'rules';
      const classificationReason: string | undefined = baseClassification.reason;
      let aiPromptVersion: string | undefined;
      let aiModel: string | undefined;
      let aiSummary: string | undefined;

      if (
        openai &&
        aiCallsRemaining > 0 &&
        input.mode === 'enhanced' &&
        classification.confidence < AUTO_UPDATE_CONFIDENCE_THRESHOLD
      ) {
        aiCallsRemaining -= 1;
        try {
          const aiRes = await tryAiClassifyEmail({
            openai,
            model: aiConfig.model,
            subject,
            from,
            snippet,
          });
          if (aiRes) {
            const merged = mergeRuleAndAiClassification({ rule: classification, ai: aiRes });
            classification = {
              ...classification,
              eventType: merged.eventType,
              confidence: merged.confidence,
              entities: merged.entities,
            };
            classificationSource = merged.classificationSource;
            aiPromptVersion = EMAIL_AI_EXTRACTOR_PROMPT_VERSION;
            aiModel = aiConfig.model;
            aiSummary = aiRes.summary;
          }
        } catch (e) {
          if (!aiErrorLogged) {
            aiErrorLogged = true;
            console.warn('[email_auto_updates] AI extractor failed:', sanitizeError(e));
          }
        }
      }

      const match = rankApplicationsForEmail({
        applications: input.applications,
        extracted: classification.entities,
        subject,
        from,
        threadLinkedApplicationId: undefined,
      });
      const best = match.best;

      results.push({
        message_id: item.id,
        thread_id: item.conversationId || item.id,
        subject,
        from,
        received_at: receivedAt,
        snippet_limited: snippet,
        event_type: classification.eventType,
        confidence: classification.confidence,
        extracted_entities: classification.entities,
        classification_source: classificationSource,
        classification_reason: classificationReason,
        ai_prompt_version: aiPromptVersion,
        ai_model: aiModel,
        ai_summary: aiSummary,
        matched_application_id: best?.applicationId as any,
        match_confidence: best?.score,
        match_signals: best?.signals,
        candidate_applications: match.top,
        from_domain: extractEmailAddressDomain(from),
      });

      if (results.length >= 25) break;
    }

    url = delta['@odata.nextLink'] || '';
    if (delta['@odata.deltaLink']) {
      newCursor = delta['@odata.deltaLink'];
    }
    if (!url) break;
  }

  return { results, newLastScanAt, newCursor };
}
