import { v } from 'convex/values';

import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';
import { safeLogAudit } from './lib/auditLogger';
import { auth } from './lib/authorization';

import {
  AUTO_UPDATE_CONFIDENCE_THRESHOLD,
  EMAIL_SUBJECT_GATE_VERSION,
  mapEmailEventTypeToStage,
  mapStageToLegacyStatus,
  type ApplicationStage,
  type EmailEventType,
  type EmailProvider,
  type LegacyApplicationStatus,
  subjectGate,
} from './lib/emailAutoUpdates';
import { STAGE_TRANSITIONS } from './advisor_constants';

type IntegrationDoc = Doc<'email_integrations'>;

const SORT_ORDER_GAP = 1000;

function nowMs(): number {
  return Date.now();
}

function isTransitionAllowed(currentStage: ApplicationStage, newStage: ApplicationStage): boolean {
  const allowed = STAGE_TRANSITIONS[currentStage] || [];
  return allowed.includes(newStage as any);
}

async function getTopSortOrderForStatus(
  ctx: { db: any },
  userId: Id<'users'>,
  status: string,
  excludeApplicationId?: Id<'applications'>,
): Promise<number> {
  const apps = await ctx.db
    .query('applications')
    .withIndex('by_user_status_order', (q: any) => q.eq('user_id', userId).eq('status', status))
    .collect();

  const orders = apps
    .filter((a: any) => a._id !== excludeApplicationId)
    .map((a: any) => a.sort_order)
    .filter((o: any) => typeof o === 'number');

  const min = orders.length > 0 ? Math.min(...orders) : 0;
  return min - SORT_ORDER_GAP;
}

function requireServiceOrThrow(serviceToken: string | undefined) {
  if (!auth.isServiceRequest(serviceToken)) {
    throw new Error('Unauthorized: Service token required');
  }
}

const LEGACY_APPLICATION_STATUSES: ReadonlyArray<LegacyApplicationStatus> = [
  'saved',
  'applied',
  'interview',
  'offer',
  'rejected',
];

function isLegacyApplicationStatus(value: unknown): value is LegacyApplicationStatus {
  return (
    typeof value === 'string' &&
    (LEGACY_APPLICATION_STATUSES as ReadonlyArray<string>).includes(value)
  );
}

export const getMyEmailIntegrations = query({
  args: {},
  handler: async (ctx) => {
    const user = await auth.getAuthenticatedUser(ctx);

    const integrations = await ctx.db
      .query('email_integrations')
      .withIndex('by_user', (q) => q.eq('user_id', user._id))
      .collect();

    return integrations.map((i: IntegrationDoc) => ({
      _id: i._id,
      provider: i.provider,
      status: i.status,
      enabled: i.enabled,
      mode: i.mode,
      scopes: i.scopes,
      provider_account_email: i.provider_account_email,
      last_scan_at: i.last_scan_at,
      updated_at: i.updated_at,
    }));
  },
});

export const getReviewQueueCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await auth.getAuthenticatedUser(ctx);
    const suggested = await ctx.db
      .query('email_application_signals')
      .withIndex('by_user_status_created', (q) =>
        q.eq('user_id', user._id).eq('status', 'suggested'),
      )
      .collect();
    return suggested.length;
  },
});

export const listReviewQueue = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await auth.getAuthenticatedUser(ctx);
    const limit = Math.min(args.limit ?? 20, 50);

    const items = await ctx.db
      .query('email_application_signals')
      .withIndex('by_user_status_created', (q) =>
        q.eq('user_id', user._id).eq('status', 'suggested'),
      )
      .order('desc')
      .take(limit);

    return items.map((s: Doc<'email_application_signals'>) => ({
      _id: s._id,
      provider: s.provider,
      message_id: s.message_id,
      thread_id: s.thread_id,
      from: s.from,
      subject: s.subject,
      received_at: s.received_at,
      event_type: s.event_type,
      confidence: s.confidence,
      extracted_entities: s.extracted_entities,
      matched_application_id: s.matched_application_id,
      match_confidence: s.match_confidence,
      candidate_applications: s.candidate_applications,
      suggested_stage: s.suggested_stage,
      snippet_limited: s.snippet_limited,
      created_at: s.created_at,
    }));
  },
});

export const getStageEventsForApplication = query({
  args: {
    applicationId: v.id('applications'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await auth.getAuthenticatedUser(ctx);
    const application = await ctx.db.get(args.applicationId);
    if (!application || application.user_id !== user._id) {
      throw new Error('Application not found or unauthorized');
    }

    const limit = Math.min(args.limit ?? 25, 100);
    const events = await ctx.db
      .query('application_stage_events')
      .withIndex('by_application', (q) => q.eq('application_id', args.applicationId))
      .order('desc')
      .take(limit);

    return events.map((e: Doc<'application_stage_events'>) => ({
      _id: e._id,
      source: e.source,
      actor_type: e.actor_type,
      created_at: e.created_at,
      previous_stage: e.previous_stage,
      new_stage: e.new_stage,
      previous_status: e.previous_status,
      new_status: e.new_status,
      provider: e.provider,
      classification_confidence: e.classification_confidence,
      match_confidence: e.match_confidence,
      undone_at: e.undone_at,
    }));
  },
});

export const setEmailAutoUpdatesEnabled = mutation({
  args: {
    provider: v.union(v.literal('gmail'), v.literal('outlook')),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await auth.getAuthenticatedUser(ctx);
    const now = nowMs();

    const integration = await ctx.db
      .query('email_integrations')
      .withIndex('by_user_provider', (q) => q.eq('user_id', user._id).eq('provider', args.provider))
      .unique();

    if (!integration || integration.status !== 'connected') {
      throw new Error('Integration not connected');
    }

    await ctx.db.patch(integration._id, {
      enabled: args.enabled,
      last_scan_at: args.enabled ? (integration.last_scan_at ?? now) : integration.last_scan_at,
      consented_at: args.enabled ? (integration.consented_at ?? now) : integration.consented_at,
      updated_at: now,
    });

    await safeLogAudit(ctx, {
      category: 'user_action',
      action: 'account.settings_updated',
      actorUserId: user._id,
      actorRole: user.role,
      actorUniversityId: user.university_id ?? undefined,
      targetType: 'email_integration',
      targetId: integration._id,
      metadata: {
        feature: 'email_auto_updates',
        provider: args.provider,
        enabled: args.enabled,
        mode: integration.mode,
      },
    });

    if (args.enabled) {
      await ctx.scheduler.runAfter(0, internal.email_auto_updates.enqueueIntegrationScan, {
        integrationId: integration._id,
        reason: 'user_enabled',
      });
    }

    return { success: true };
  },
});

export const setEmailAutoUpdatesMode = mutation({
  args: {
    provider: v.union(v.literal('gmail'), v.literal('outlook')),
    mode: v.union(v.literal('metadata_only'), v.literal('enhanced')),
  },
  handler: async (ctx, args) => {
    const user = await auth.getAuthenticatedUser(ctx);
    const now = nowMs();

    const integration = await ctx.db
      .query('email_integrations')
      .withIndex('by_user_provider', (q) => q.eq('user_id', user._id).eq('provider', args.provider))
      .unique();

    if (!integration || integration.status !== 'connected') {
      throw new Error('Integration not connected');
    }

    // Enforce least-privilege scopes per mode (upgrade requires reconnect)
    if (args.provider === 'gmail') {
      const hasReadonly = integration.scopes.includes(
        'https://www.googleapis.com/auth/gmail.readonly',
      );
      const hasMetadata = integration.scopes.includes(
        'https://www.googleapis.com/auth/gmail.metadata',
      );
      if (args.mode === 'enhanced' && !hasReadonly) {
        throw new Error('Reauthentication required to enable enhanced parsing for Gmail');
      }
      if (args.mode === 'metadata_only' && !(hasMetadata || hasReadonly)) {
        throw new Error('Gmail integration scopes invalid; reconnect required');
      }
    } else {
      const hasMailRead = integration.scopes.includes('Mail.Read');
      const hasMailReadBasic = integration.scopes.includes('Mail.ReadBasic');
      if (args.mode === 'enhanced' && !hasMailRead) {
        throw new Error('Reauthentication required to enable enhanced parsing for Outlook');
      }
      if (args.mode === 'metadata_only' && !(hasMailReadBasic || hasMailRead)) {
        throw new Error('Outlook integration scopes invalid; reconnect required');
      }
    }

    const patch: Record<string, unknown> = {
      mode: args.mode,
      updated_at: now,
    };
    if (args.provider === 'outlook' && args.mode !== integration.mode) {
      patch.cursor = undefined;
    }

    await ctx.db.patch(integration._id, patch);

    await safeLogAudit(ctx, {
      category: 'user_action',
      action: 'account.settings_updated',
      actorUserId: user._id,
      actorRole: user.role,
      actorUniversityId: user.university_id ?? undefined,
      targetType: 'email_integration',
      targetId: integration._id,
      metadata: {
        feature: 'email_auto_updates',
        provider: args.provider,
        mode: args.mode,
      },
    });

    return { success: true };
  },
});

export const disconnectEmailIntegration = mutation({
  args: {
    provider: v.union(v.literal('gmail'), v.literal('outlook')),
  },
  handler: async (ctx, args) => {
    const user = await auth.getAuthenticatedUser(ctx);
    const now = nowMs();

    const integration = await ctx.db
      .query('email_integrations')
      .withIndex('by_user_provider', (q) => q.eq('user_id', user._id).eq('provider', args.provider))
      .unique();

    if (!integration) {
      return { success: true };
    }

    await ctx.db.patch(integration._id, {
      status: 'revoked',
      enabled: false,
      revoked_at: now,
      encrypted_refresh_token: undefined,
      token_cipher_version: undefined,
      cursor: undefined,
      gmail_history_id: undefined,
      gmail_watch_expiration: undefined,
      outlook_subscription_id: undefined,
      outlook_subscription_expiration: undefined,
      outlook_client_state_hash: undefined,
      updated_at: now,
    });

    await safeLogAudit(ctx, {
      category: 'user_action',
      action: 'account.settings_updated',
      actorUserId: user._id,
      actorRole: user.role,
      actorUniversityId: user.university_id ?? undefined,
      targetType: 'email_integration',
      targetId: integration._id,
      metadata: {
        feature: 'email_auto_updates',
        provider: args.provider,
        action: 'disconnect',
      },
    });

    return { success: true };
  },
});

export const deleteEmailAutoUpdateData = mutation({
  args: {
    provider: v.optional(v.union(v.literal('gmail'), v.literal('outlook'))),
    includeStageEvents: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await auth.getAuthenticatedUser(ctx);
    await ctx.scheduler.runAfter(0, internal.email_auto_updates.deleteEmailDataInternal, {
      userId: user._id,
      provider: args.provider,
      includeStageEvents: args.includeStageEvents ?? false,
    });
    return { scheduled: true };
  },
});

export const approveSuggestedUpdate = mutation({
  args: {
    signalId: v.id('email_application_signals'),
    applicationId: v.optional(v.id('applications')),
  },
  handler: async (ctx, args) => {
    const user = await auth.getAuthenticatedUser(ctx);
    const signal = await ctx.db.get(args.signalId);
    if (!signal || signal.user_id !== user._id) {
      throw new Error('Signal not found or unauthorized');
    }
    if (signal.status !== 'suggested') {
      throw new Error('Only suggested updates can be approved');
    }

    const applicationId = (args.applicationId ?? signal.matched_application_id) as
      | Id<'applications'>
      | undefined;
    if (!applicationId) {
      throw new Error('Select an application to apply this update');
    }

    const result = await applyStageChangeFromSignal(ctx, {
      signal,
      applicationId,
      actorType: 'user',
      actorUserId: user._id,
      enforceThresholds: false,
    });

    return result;
  },
});

export const dismissSuggestedUpdate = mutation({
  args: {
    signalId: v.id('email_application_signals'),
  },
  handler: async (ctx, args) => {
    const user = await auth.getAuthenticatedUser(ctx);
    const signal = await ctx.db.get(args.signalId);
    if (!signal || signal.user_id !== user._id) {
      throw new Error('Signal not found or unauthorized');
    }
    if (signal.status !== 'suggested') {
      return { success: true };
    }
    await ctx.db.patch(signal._id, { status: 'dismissed', updated_at: nowMs() });
    return { success: true };
  },
});

export const undoEmailStageChange = mutation({
  args: {
    stageEventId: v.id('application_stage_events'),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await auth.getAuthenticatedUser(ctx);
    const event = await ctx.db.get(args.stageEventId);
    if (!event || event.user_id !== user._id) {
      throw new Error('Stage event not found or unauthorized');
    }
    if (event.source !== 'email_auto_update') {
      throw new Error('Only email auto updates can be undone here');
    }
    if (event.undone_at) {
      return { success: true };
    }

    const application = await ctx.db.get(event.application_id);
    if (!application || application.user_id !== user._id) {
      throw new Error('Application not found or unauthorized');
    }

    const now = nowMs();
    const previousStage = event.previous_stage as ApplicationStage;
    const previousStatus: LegacyApplicationStatus = isLegacyApplicationStatus(event.previous_status)
      ? event.previous_status
      : mapStageToLegacyStatus(previousStage);

    const sortOrder =
      previousStatus !== application.status
        ? await getTopSortOrderForStatus(ctx, user._id, previousStatus, application._id)
        : application.sort_order;

    await ctx.db.patch(application._id, {
      stage: previousStage,
      status: previousStatus,
      stage_set_at: now,
      sort_order: sortOrder,
      updated_at: now,
    });

    await ctx.db.patch(event._id, {
      undone_at: now,
      undone_by_user_id: user._id,
      undo_reason: args.reason,
    });

    await safeLogAudit(ctx, {
      category: 'user_action',
      action: 'application.updated',
      actorUserId: user._id,
      actorRole: user.role,
      actorUniversityId: user.university_id ?? undefined,
      targetType: 'application',
      targetId: application._id,
      previousValue: { stage: application.stage, status: application.status },
      newValue: { stage: previousStage, status: previousStatus, source: 'email_auto_update_undo' },
      metadata: {
        source: 'email_auto_update',
        stageEventId: event._id,
      },
    });

    return { success: true };
  },
});

export const handleGmailPushNotification = mutation({
  args: {
    serviceToken: v.optional(v.string()),
    emailAddress: v.string(),
    historyId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireServiceOrThrow(args.serviceToken);

    const integration = await ctx.db
      .query('email_integrations')
      .withIndex('by_provider_account_email', (q) =>
        q.eq('provider', 'gmail').eq('provider_account_email', args.emailAddress),
      )
      .first();

    if (!integration || integration.status !== 'connected') {
      return { accepted: true };
    }

    await ctx.scheduler.runAfter(0, internal.email_auto_updates.enqueueIntegrationScan, {
      integrationId: integration._id,
      reason: 'gmail_push',
    });

    if (args.historyId) {
      await ctx.db.patch(integration._id, {
        gmail_history_id: args.historyId,
        updated_at: nowMs(),
      });
    }

    return { accepted: true };
  },
});

export const handleOutlookWebhookNotification = mutation({
  args: {
    serviceToken: v.optional(v.string()),
    subscriptionId: v.string(),
    clientStateHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireServiceOrThrow(args.serviceToken);

    const integration = await ctx.db
      .query('email_integrations')
      .withIndex('by_provider_outlook_subscription', (q) =>
        q.eq('provider', 'outlook').eq('outlook_subscription_id', args.subscriptionId),
      )
      .first();

    if (!integration || integration.status !== 'connected') {
      return { accepted: true };
    }

    if (integration.outlook_client_state_hash && args.clientStateHash) {
      if (integration.outlook_client_state_hash !== args.clientStateHash) {
        throw new Error('Unauthorized: Invalid client state');
      }
    }

    await ctx.scheduler.runAfter(0, internal.email_auto_updates.enqueueIntegrationScan, {
      integrationId: integration._id,
      reason: 'outlook_push',
    });

    return { accepted: true };
  },
});

export const enqueueIntegrationScan = internalMutation({
  args: {
    integrationId: v.id('email_integrations'),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const integration = await ctx.db.get(args.integrationId);
    if (!integration || integration.status !== 'connected' || !integration.enabled) {
      return { enqueued: false };
    }

    const now = nowMs();
    const recentlyEnqueued =
      integration.last_scan_enqueued_at && now - integration.last_scan_enqueued_at < 30_000;
    const locked = integration.scan_lock_until && integration.scan_lock_until > now;
    if (recentlyEnqueued || locked) {
      return { enqueued: false };
    }

    await ctx.db.patch(integration._id, {
      last_scan_enqueued_at: now,
      scan_lock_until: now + 5 * 60 * 1000,
      updated_at: now,
    });

    await ctx.scheduler.runAfter(0, internal.email_auto_updates_actions.runIntegrationScan, {
      integrationId: integration._id,
    });

    return { enqueued: true };
  },
});

export const getIntegrationForScan = internalQuery({
  args: {
    integrationId: v.id('email_integrations'),
  },
  handler: async (ctx, args) => {
    const integration = await ctx.db.get(args.integrationId);
    if (!integration) return null;
    return integration;
  },
});

export const getUserApplicationsForMatching = internalQuery({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const applications = await ctx.db
      .query('applications')
      .withIndex('by_user', (q) => q.eq('user_id', args.userId))
      .take(500);
    return applications.map((a: any) => ({
      _id: a._id,
      company: a.company,
      job_title: a.job_title,
    }));
  },
});

export const getUserIdByClerkId = internalQuery({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();
    return user ? { userId: user._id } : null;
  },
});

export const upsertIntegrationFromOAuth = internalMutation({
  args: {
    userId: v.id('users'),
    provider: v.union(v.literal('gmail'), v.literal('outlook')),
    encryptedRefreshToken: v.string(),
    tokenCipherVersion: v.string(),
    scopes: v.array(v.string()),
    mode: v.union(v.literal('metadata_only'), v.literal('enhanced')),
    providerAccountEmail: v.optional(v.string()),
    providerAccountId: v.optional(v.string()),
    cursor: v.optional(v.string()),
    gmailHistoryId: v.optional(v.string()),
    gmailWatchExpiration: v.optional(v.number()),
    outlookSubscriptionId: v.optional(v.string()),
    outlookSubscriptionExpiration: v.optional(v.number()),
    outlookClientStateHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = nowMs();
    const existing = await ctx.db
      .query('email_integrations')
      .withIndex('by_user_provider', (q) =>
        q.eq('user_id', args.userId).eq('provider', args.provider),
      )
      .unique();

    const patch = {
      status: 'connected' as const,
      scopes: args.scopes,
      mode: args.mode,
      encrypted_refresh_token: args.encryptedRefreshToken,
      token_cipher_version: args.tokenCipherVersion,
      provider_account_email: args.providerAccountEmail,
      provider_account_id: args.providerAccountId,
      cursor: args.cursor,
      gmail_history_id: args.gmailHistoryId,
      gmail_watch_expiration: args.gmailWatchExpiration,
      outlook_subscription_id: args.outlookSubscriptionId,
      outlook_subscription_expiration: args.outlookSubscriptionExpiration,
      outlook_client_state_hash: args.outlookClientStateHash,
      revoked_at: undefined,
      updated_at: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      await safeLogAudit(ctx, {
        category: 'user_action',
        action: 'account.settings_updated',
        actorUserId: args.userId,
        targetType: 'email_integration',
        targetId: existing._id,
        metadata: {
          feature: 'email_auto_updates',
          provider: args.provider,
          action: 'connected',
          mode: args.mode,
        },
      });
      return { integrationId: existing._id };
    }

    const integrationId = await ctx.db.insert('email_integrations', {
      user_id: args.userId,
      provider: args.provider,
      status: 'connected',
      enabled: false,
      mode: args.mode,
      scopes: args.scopes,
      encrypted_refresh_token: args.encryptedRefreshToken,
      token_cipher_version: args.tokenCipherVersion,
      provider_account_email: args.providerAccountEmail,
      provider_account_id: args.providerAccountId,
      last_scan_at: undefined,
      last_scan_enqueued_at: undefined,
      scan_lock_until: undefined,
      cursor: args.cursor,
      gmail_history_id: args.gmailHistoryId,
      gmail_watch_expiration: args.gmailWatchExpiration,
      outlook_subscription_id: args.outlookSubscriptionId,
      outlook_subscription_expiration: args.outlookSubscriptionExpiration,
      outlook_client_state_hash: args.outlookClientStateHash,
      consented_at: undefined,
      revoked_at: undefined,
      created_at: now,
      updated_at: now,
    });

    await safeLogAudit(ctx, {
      category: 'user_action',
      action: 'account.settings_updated',
      actorUserId: args.userId,
      targetType: 'email_integration',
      targetId: integrationId,
      metadata: {
        feature: 'email_auto_updates',
        provider: args.provider,
        action: 'connected',
        mode: args.mode,
      },
    });

    return { integrationId };
  },
});

export const updateIntegrationRefreshToken = internalMutation({
  args: {
    integrationId: v.id('email_integrations'),
    encryptedRefreshToken: v.string(),
    tokenCipherVersion: v.string(),
    scopes: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const now = nowMs();
    await ctx.db.patch(args.integrationId, {
      encrypted_refresh_token: args.encryptedRefreshToken,
      token_cipher_version: args.tokenCipherVersion,
      scopes: args.scopes,
      updated_at: now,
    });
    return { success: true };
  },
});

export const updateIntegrationAfterScan = internalMutation({
  args: {
    integrationId: v.id('email_integrations'),
    lastScanAt: v.optional(v.number()),
    cursor: v.optional(v.string()),
    gmailHistoryId: v.optional(v.string()),
    scanLockRelease: v.boolean(),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = {
      updated_at: nowMs(),
    };
    if (args.lastScanAt !== undefined) patch.last_scan_at = args.lastScanAt;
    if (args.cursor !== undefined) patch.cursor = args.cursor;
    if (args.gmailHistoryId !== undefined) patch.gmail_history_id = args.gmailHistoryId;
    if (args.scanLockRelease) patch.scan_lock_until = undefined;
    await ctx.db.patch(args.integrationId, patch);
    return { success: true };
  },
});

export const ingestScanResults = internalMutation({
  args: {
    integrationId: v.id('email_integrations'),
    runAt: v.number(),
    provider: v.union(v.literal('gmail'), v.literal('outlook')),
    results: v.array(
      v.object({
        message_id: v.string(),
        thread_id: v.string(),
        subject: v.string(),
        from: v.string(),
        from_domain: v.optional(v.string()),
        received_at: v.number(),
        snippet_limited: v.optional(v.string()),
        event_type: v.optional(v.string()),
        confidence: v.optional(v.number()),
        extracted_entities: v.optional(v.any()),
        classification_source: v.optional(v.string()),
        classification_reason: v.optional(v.string()),
        ai_prompt_version: v.optional(v.string()),
        ai_model: v.optional(v.string()),
        ai_summary: v.optional(v.string()),
        matched_application_id: v.optional(v.id('applications')),
        match_confidence: v.optional(v.number()),
        match_signals: v.optional(v.any()),
        candidate_applications: v.optional(v.any()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const integration = await ctx.db.get(args.integrationId);
    if (!integration || integration.status !== 'connected' || !integration.enabled) {
      return { processed: 0, matched: 0, suggested: 0, applied: 0 };
    }

    const now = nowMs();
    let processed = 0;
    let matched = 0;
    let suggested = 0;
    let applied = 0;

    const suggestionsByApplication = new Map<string, number>();

    for (const r of args.results) {
      const gate = subjectGate({ subject: r.subject, from: r.from });
      if (!gate.passed) continue;

      const confidence = r.confidence ?? 0;
      if (confidence < 0.6) continue;

      const existing = await ctx.db
        .query('email_application_signals')
        .withIndex('by_integration_message', (q) =>
          q.eq('integration_id', args.integrationId).eq('message_id', r.message_id),
        )
        .unique();
      if (existing) continue;

      processed += 1;

      // Thread continuity: reuse prior applied mapping if available
      let matchedApplicationId = r.matched_application_id as Id<'applications'> | undefined;
      let matchConfidence = r.match_confidence;
      let matchSignals = r.match_signals;
      let candidateApplications = r.candidate_applications;

      if (!matchedApplicationId) {
        const prior = await ctx.db
          .query('email_application_signals')
          .withIndex('by_user_provider_thread', (q) =>
            q
              .eq('user_id', integration.user_id)
              .eq('provider', args.provider)
              .eq('thread_id', r.thread_id),
          )
          .filter((q) => q.eq(q.field('status'), 'applied'))
          .first();
        if (prior?.matched_application_id) {
          matchedApplicationId = prior.matched_application_id;
          matchConfidence = Math.max(matchConfidence ?? 0, 0.95);
          matchSignals = { ...(matchSignals || {}), thread_link: true };
        }
      }

      const signalId = await ctx.db.insert('email_application_signals', {
        integration_id: args.integrationId,
        user_id: integration.user_id,
        provider: args.provider,
        message_id: r.message_id,
        thread_id: r.thread_id,
        subject: r.subject,
        from: r.from,
        from_domain: r.from_domain,
        received_at: r.received_at,
        snippet_limited: r.snippet_limited,
        subject_gate_version: EMAIL_SUBJECT_GATE_VERSION,
        subject_gate_passed: true,
        event_type: r.event_type,
        confidence: r.confidence,
        extracted_entities: r.extracted_entities,
        classification_source: r.classification_source,
        classification_reason: r.classification_reason,
        ai_prompt_version: r.ai_prompt_version,
        ai_model: r.ai_model,
        ai_summary: r.ai_summary,
        matched_application_id: matchedApplicationId,
        match_confidence: matchConfidence,
        match_signals: matchSignals,
        candidate_applications: candidateApplications,
        status: 'suggested',
        suggested_stage: r.event_type
          ? mapEmailEventTypeToStage(r.event_type as EmailEventType)
          : undefined,
        applied_stage_event_id: undefined,
        created_at: now,
        updated_at: now,
      });

      if (matchedApplicationId && matchConfidence != null) matched += 1;

      const shouldAutoApply =
        r.event_type &&
        (r.confidence ?? 0) >= AUTO_UPDATE_CONFIDENCE_THRESHOLD &&
        (matchConfidence ?? 0) >= AUTO_UPDATE_CONFIDENCE_THRESHOLD &&
        matchedApplicationId != null;

      if (shouldAutoApply) {
        const signal = (await ctx.db.get(signalId))!;
        const res = await applyStageChangeFromSignal(ctx, {
          signal,
          applicationId: matchedApplicationId!,
          actorType: 'system',
          actorUserId: undefined,
          enforceThresholds: true,
        });
        if (res.applied) {
          applied += 1;
          continue;
        }
      }

      suggested += 1;
      const key = r.matched_application_id ? r.matched_application_id.toString() : 'unmatched';
      suggestionsByApplication.set(key, (suggestionsByApplication.get(key) ?? 0) + 1);
    }

    await ctx.db.insert('email_scan_events', {
      integration_id: args.integrationId,
      user_id: integration.user_id,
      provider: args.provider,
      run_at: args.runAt,
      processed_count: processed,
      matched_count: matched,
      suggested_count: suggested,
      errors_count: 0,
      error_summary: undefined,
      created_at: now,
    });

    if (suggested > 0) {
      await ctx.runMutation(internal.notifications.createNotification, {
        user_id: integration.user_id,
        type: 'application_update',
        title: 'Review email updates',
        message: `We found ${suggested} potential application update(s) from your email. Review to confirm.`,
        link: '/account?tab=settings',
      });
    }

    return { processed, matched, suggested, applied };
  },
});

async function applyStageChangeFromSignal(
  ctx: any,
  args: {
    signal: Doc<'email_application_signals'>;
    applicationId: Id<'applications'>;
    actorType: 'system' | 'user';
    actorUserId?: Id<'users'>;
    enforceThresholds: boolean;
  },
): Promise<{ applied: boolean; stageEventId?: Id<'application_stage_events'> }> {
  const now = nowMs();
  const application = await ctx.db.get(args.applicationId);
  if (!application || application.user_id !== args.signal.user_id) {
    return { applied: false };
  }

  const eventType = args.signal.event_type as EmailEventType | undefined;
  if (!eventType) return { applied: false };

  const classificationConfidence = args.signal.confidence ?? 0;
  const matchConfidence = args.signal.match_confidence ?? 0;
  if (args.enforceThresholds) {
    if (classificationConfidence < AUTO_UPDATE_CONFIDENCE_THRESHOLD) return { applied: false };
    if (matchConfidence < AUTO_UPDATE_CONFIDENCE_THRESHOLD) return { applied: false };
  }

  const currentStage = (application.stage || 'Prospect') as ApplicationStage;
  const newStage = mapEmailEventTypeToStage(eventType);
  const newStatus = mapStageToLegacyStatus(newStage);

  if (currentStage === newStage && application.status === newStatus) {
    await ctx.db.patch(args.signal._id, {
      status: 'dismissed',
      updated_at: now,
    });
    return { applied: false };
  }

  if (!isTransitionAllowed(currentStage, newStage)) {
    return { applied: false };
  }

  const sortOrder =
    application.status !== newStatus
      ? await getTopSortOrderForStatus(ctx, application.user_id, newStatus, application._id)
      : application.sort_order;

  const previousStatus = application.status;

  await ctx.db.patch(application._id, {
    stage: newStage,
    status: newStatus,
    stage_set_at: now,
    sort_order: sortOrder,
    updated_at: now,
    reason_code:
      newStage === 'Rejected' ? (application.reason_code ?? 'other') : application.reason_code,
  });

  const stageEventId = await ctx.db.insert('application_stage_events', {
    application_id: application._id,
    user_id: application.user_id,
    actor_type: args.actorType,
    actor_user_id: args.actorUserId,
    source: 'email_auto_update',
    provider: args.signal.provider as EmailProvider,
    message_id: args.signal.message_id,
    thread_id: args.signal.thread_id,
    signal_id: args.signal._id,
    previous_stage: currentStage,
    new_stage: newStage,
    previous_status: previousStatus,
    new_status: newStatus,
    classification_confidence: classificationConfidence,
    match_confidence: matchConfidence,
    created_at: now,
    undone_at: undefined,
    undone_by_user_id: undefined,
    undo_reason: undefined,
  });

  await ctx.db.patch(args.signal._id, {
    status: 'applied',
    applied_stage_event_id: stageEventId,
    updated_at: now,
  });

  await safeLogAudit(ctx, {
    category: args.actorType === 'system' ? 'system' : 'user_action',
    action: 'application.status_changed',
    actorType: args.actorType === 'system' ? 'system' : 'user',
    actorUserId: args.actorUserId,
    actorRole: args.actorType === 'system' ? 'system' : undefined,
    actorUniversityId: undefined,
    targetType: 'application',
    targetId: application._id,
    studentId: application.user_id,
    previousValue: { stage: currentStage, status: previousStatus },
    newValue: { stage: newStage, status: newStatus },
    metadata: {
      source: 'email_auto_update',
      provider: args.signal.provider,
      signalId: args.signal._id,
      stageEventId,
      confidence: classificationConfidence,
      matchConfidence,
    },
  });

  // Notify user when applied automatically
  if (args.actorType === 'system') {
    await ctx.runMutation(internal.notifications.createNotification, {
      user_id: application.user_id,
      type: 'application_update',
      title: 'Application updated from email',
      message: `We moved "${application.company}" to ${newStatus === 'rejected' ? 'Rejected' : newStatus}.`,
      link: '/applications',
      related_id: application._id,
    });
  }

  return { applied: true, stageEventId };
}

export const pollEnabledIntegrations = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = nowMs();
    const candidates = await ctx.db
      .query('email_integrations')
      .withIndex('by_status_enabled', (q) => q.eq('status', 'connected').eq('enabled', true))
      .collect();

    const due = candidates.filter((i: IntegrationDoc) => {
      if (!i.enabled) return false;
      if (i.scan_lock_until && i.scan_lock_until > now) return false;
      const last = i.last_scan_at ?? 0;
      return now - last > 5 * 60 * 1000;
    });

    // Cap per run to avoid long cron executions
    const slice = due.slice(0, 25);
    for (const integration of slice) {
      await ctx.scheduler.runAfter(0, internal.email_auto_updates.enqueueIntegrationScan, {
        integrationId: integration._id,
        reason: 'poll',
      });
    }

    return { scheduled: slice.length };
  },
});

export const deleteEmailDataInternal = internalMutation({
  args: {
    userId: v.id('users'),
    provider: v.optional(v.union(v.literal('gmail'), v.literal('outlook'))),
    includeStageEvents: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = nowMs();
    const integrations = await ctx.db
      .query('email_integrations')
      .withIndex('by_user', (q) => q.eq('user_id', args.userId))
      .collect();

    const integrationIds = integrations
      .filter((i: IntegrationDoc) => (args.provider ? i.provider === args.provider : true))
      .map((i: IntegrationDoc) => i._id);

    const integrationIdSet = new Set(integrationIds.map((id) => id.toString()));

    // Delete signals (paginate to avoid overloading)
    let cursor: string | null = null;
    let done = false;
    while (!done) {
      const page = await ctx.db
        .query('email_application_signals')
        .withIndex('by_user_created_at', (q) => q.eq('user_id', args.userId))
        .paginate({ cursor, numItems: 200 });
      for (const s of page.page) {
        if (integrationIdSet.has(s.integration_id.toString())) {
          await ctx.db.delete(s._id);
        }
      }
      cursor = page.continueCursor;
      done = page.isDone;
    }

    // Delete scan events
    cursor = null;
    done = false;
    while (!done) {
      const page = await ctx.db
        .query('email_scan_events')
        .withIndex('by_user', (q) => q.eq('user_id', args.userId))
        .paginate({ cursor, numItems: 200 });
      for (const e of page.page) {
        if (integrationIdSet.has(e.integration_id.toString())) {
          await ctx.db.delete(e._id);
        }
      }
      cursor = page.continueCursor;
      done = page.isDone;
    }

    if (args.includeStageEvents) {
      let cursor: string | null = null;
      let done = false;
      while (!done) {
        const page = await ctx.db
          .query('application_stage_events')
          .withIndex('by_user', (q) => q.eq('user_id', args.userId))
          .paginate({ cursor, numItems: 200 });
        for (const e of page.page) {
          if (
            e.source === 'email_auto_update' &&
            (!args.provider || e.provider === args.provider)
          ) {
            await ctx.db.delete(e._id);
          }
        }
        cursor = page.continueCursor;
        done = page.isDone;
      }
    }

    await safeLogAudit(ctx, {
      category: 'system',
      action: 'system.data_cleanup',
      actorType: 'system',
      targetType: 'email_auto_updates',
      targetId: args.userId,
      metadata: {
        source: 'email_auto_updates',
        provider: args.provider,
        includeStageEvents: args.includeStageEvents,
        executedAt: now,
      },
    });

    return { success: true };
  },
});

export const pruneOldEmailSignals = internalMutation({
  args: {
    olderThanMs: v.number(),
  },
  handler: async (ctx, args) => {
    const cutoff = nowMs() - args.olderThanMs;
    let cursor: string | null = null;
    let done = false;
    let deleted = 0;

    while (!done) {
      const page = await ctx.db
        .query('email_application_signals')
        .withIndex('by_created_at', (q) => q.lt('created_at', cutoff))
        .paginate({ cursor, numItems: 200 });

      for (const s of page.page) {
        if (s.status === 'ignored' || s.status === 'dismissed') {
          await ctx.db.delete(s._id);
          deleted += 1;
        }
      }

      cursor = page.continueCursor;
      done = page.isDone;
    }

    return { deleted };
  },
});
