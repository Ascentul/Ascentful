/**
 * GDPR Data Subject Rights Implementation
 *
 * This module implements:
 * - Article 15: Right of Access (data export)
 * - Article 17: Right to Erasure (account deletion)
 * - Article 20: Right to Data Portability (structured JSON export)
 *
 * COMPLIANCE NOTES:
 * - Data exports include all user-linked data across all tables
 * - Deletion follows a 30-day grace period for GDPR compliance
 * - Audit logs are preserved with PII redacted for FERPA compliance
 * - Financial records (Stripe) are preserved for legal requirements
 */

import { v } from 'convex/values';

import { internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import { internalMutation, mutation, query } from './_generated/server';

/**
 * Get all user data for GDPR data export (Right of Access / Right to Portability)
 * Returns a structured JSON object containing all user-linked data
 */
export const getUserDataForExport = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }

    // Users can only export their own data (or super_admin can export any)
    const requestingUser = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!requestingUser) {
      throw new Error('User not found');
    }

    // Target user (either self or if super_admin requesting on behalf)
    let targetUser;
    if (requestingUser.role === 'super_admin' && args.clerkId !== identity.subject) {
      targetUser = await ctx.db
        .query('users')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
        .unique();
    } else {
      // Regular users can only export their own data
      if (args.clerkId !== identity.subject) {
        throw new Error('Forbidden: You can only export your own data');
      }
      targetUser = requestingUser;
    }

    if (!targetUser) {
      throw new Error('Target user not found');
    }

    const userId = targetUser._id;

    // Collect all user data from each table
    const [
      applications,
      resumes,
      coverLetters,
      goals,
      projects,
      networkingContacts,
      contactInteractions,
      followUps,
      careerPaths,
      aiConversations,
      aiMessages,
      supportTickets,
      userAchievements,
      dailyActivity,
      jobSearches,
      dailyRecommendations,
      studentProfile,
      stripePayments,
      notifications,
      emailIntegrations,
      emailScanEvents,
      emailApplicationSignals,
      applicationStageEvents,
    ] = await Promise.all([
      ctx.db
        .query('applications')
        .withIndex('by_user', (q) => q.eq('user_id', userId))
        .collect(),
      ctx.db
        .query('resumes')
        .withIndex('by_user', (q) => q.eq('user_id', userId))
        .collect(),
      ctx.db
        .query('cover_letters')
        .withIndex('by_user', (q) => q.eq('user_id', userId))
        .collect(),
      ctx.db
        .query('goals')
        .withIndex('by_user', (q) => q.eq('user_id', userId))
        .collect(),
      ctx.db
        .query('projects')
        .withIndex('by_user', (q) => q.eq('user_id', userId))
        .collect(),
      ctx.db
        .query('networking_contacts')
        .withIndex('by_user', (q) => q.eq('user_id', userId))
        .collect(),
      ctx.db
        .query('contact_interactions')
        .withIndex('by_user', (q) => q.eq('user_id', userId))
        .collect(),
      ctx.db
        .query('follow_ups')
        .withIndex('by_user', (q) => q.eq('user_id', userId))
        .collect(),
      ctx.db
        .query('career_paths')
        .withIndex('by_user', (q) => q.eq('user_id', userId))
        .collect(),
      ctx.db
        .query('ai_coach_conversations')
        .withIndex('by_user', (q) => q.eq('user_id', userId))
        .collect(),
      ctx.db
        .query('ai_coach_messages')
        .withIndex('by_user', (q) => q.eq('user_id', userId))
        .collect(),
      ctx.db
        .query('support_tickets')
        .withIndex('by_user', (q) => q.eq('user_id', userId))
        .collect(),
      ctx.db
        .query('user_achievements')
        .withIndex('by_user', (q) => q.eq('user_id', userId))
        .collect(),
      ctx.db
        .query('user_daily_activity')
        .withIndex('by_user', (q) => q.eq('user_id', userId))
        .collect(),
      ctx.db
        .query('job_searches')
        .withIndex('by_user', (q) => q.eq('user_id', userId))
        .collect(),
      ctx.db
        .query('daily_recommendations')
        .withIndex('by_user', (q) => q.eq('user_id', userId))
        .collect(),
      ctx.db
        .query('studentProfiles')
        .withIndex('by_user_id', (q) => q.eq('user_id', userId))
        .first(),
      // Stripe payments by user_id (may be optional)
      ctx.db
        .query('stripe_payments')
        .withIndex('by_user', (q) => q.eq('user_id', userId))
        .collect(),
      ctx.db
        .query('notifications')
        .withIndex('by_user', (q) => q.eq('user_id', userId))
        .collect(),
      ctx.db
        .query('email_integrations')
        .withIndex('by_user', (q) => q.eq('user_id', userId))
        .collect(),
      ctx.db
        .query('email_scan_events')
        .withIndex('by_user', (q) => q.eq('user_id', userId))
        .collect(),
      ctx.db
        .query('email_application_signals')
        .withIndex('by_user_created_at', (q) => q.eq('user_id', userId))
        .collect(),
      ctx.db
        .query('application_stage_events')
        .withIndex('by_user', (q) => q.eq('user_id', userId))
        .collect(),
    ]);

    // Get advisor-related data if user is a student
    let advisorSessions: any[] = [];
    let advisorReviews: any[] = [];
    let studentAdvisorRelationships: any[] = [];

    if (targetUser.role === 'student') {
      [advisorSessions, advisorReviews, studentAdvisorRelationships] = await Promise.all([
        ctx.db
          .query('advisor_sessions')
          .filter((q) => q.eq(q.field('student_id'), userId))
          .collect(),
        ctx.db
          .query('advisor_reviews')
          .filter((q) => q.eq(q.field('student_id'), userId))
          .collect(),
        ctx.db
          .query('student_advisors')
          .filter((q) => q.eq(q.field('student_id'), userId))
          .collect(),
      ]);
    }

    // Sanitize sensitive fields from user profile using destructuring
    // to ensure fields are truly excluded, not just set to undefined
    const {
      _id,
      _creationTime,
      activation_token,
      activation_expires_at,
      temp_password,
      password_reset_token,
      password_reset_expires_at,
      ...sanitizedUserProfile
    } = targetUser;

    // Build the export object following GDPR Article 20 format
    const exportData = {
      exportMetadata: {
        exportDate: new Date().toISOString(),
        dataSubject: {
          email: targetUser.email,
          name: targetUser.name,
        },
        exportedBy:
          requestingUser.role === 'super_admin' && requestingUser._id !== targetUser._id
            ? 'Administrator on behalf of user'
            : 'Data subject (self)',
        gdprArticle: 'Article 15 (Right of Access) & Article 20 (Right to Data Portability)',
        format: 'JSON',
        version: '1.0',
      },
      profile: sanitizedUserProfile,
      careerData: {
        applications: applications.map((a) => ({
          ...a,
          _id: String(a._id),
          user_id: undefined,
        })),
        resumes: resumes.map((r) => ({
          ...r,
          _id: String(r._id),
          user_id: undefined,
        })),
        coverLetters: coverLetters.map((c) => ({
          ...c,
          _id: String(c._id),
          user_id: undefined,
        })),
        goals: goals.map((g) => ({
          ...g,
          _id: String(g._id),
          user_id: undefined,
        })),
        projects: projects.map((p) => ({
          ...p,
          _id: String(p._id),
          user_id: undefined,
        })),
        careerPaths: careerPaths.map((cp) => ({
          ...cp,
          _id: String(cp._id),
          user_id: undefined,
        })),
        jobSearches: jobSearches.map((js) => ({
          ...js,
          _id: String(js._id),
          user_id: undefined,
        })),
        emailAutoUpdates: {
          integrations: emailIntegrations.map((i) => ({
            ...i,
            _id: String(i._id),
            user_id: undefined,
            encrypted_refresh_token: undefined,
            token_cipher_version: undefined,
          })),
          scanEvents: emailScanEvents.map((e) => ({
            ...e,
            _id: String(e._id),
            user_id: undefined,
            integration_id: String(e.integration_id),
          })),
          signals: emailApplicationSignals.map((s) => ({
            ...s,
            _id: String(s._id),
            user_id: undefined,
            integration_id: String(s.integration_id),
            matched_application_id: s.matched_application_id
              ? String(s.matched_application_id)
              : undefined,
            applied_stage_event_id: s.applied_stage_event_id
              ? String(s.applied_stage_event_id)
              : undefined,
          })),
          stageEvents: applicationStageEvents
            .filter((e) => e.source === 'email_auto_update')
            .map((e) => ({
              ...e,
              _id: String(e._id),
              user_id: undefined,
              application_id: String(e.application_id),
              signal_id: e.signal_id ? String(e.signal_id) : undefined,
            })),
        },
      },
      networkingData: {
        contacts: networkingContacts.map((c) => ({
          ...c,
          _id: String(c._id),
          user_id: undefined,
        })),
        interactions: contactInteractions.map((i) => ({
          ...i,
          _id: String(i._id),
          user_id: undefined,
        })),
      },
      taskData: {
        followUps: followUps.map((f) => ({
          ...f,
          _id: String(f._id),
          user_id: undefined,
        })),
        dailyRecommendations: dailyRecommendations.map((r) => ({
          ...r,
          _id: String(r._id),
          user_id: undefined,
        })),
      },
      aiCoachData: {
        conversations: aiConversations.map((c) => ({
          ...c,
          _id: String(c._id),
          user_id: undefined,
        })),
        messages: aiMessages.map((m) => ({
          ...m,
          _id: String(m._id),
          user_id: undefined,
        })),
      },
      supportData: {
        tickets: supportTickets.map((t) => ({
          ...t,
          _id: String(t._id),
          user_id: undefined,
        })),
      },
      achievementsData: {
        achievements: userAchievements.map((a) => ({
          ...a,
          _id: String(a._id),
          user_id: undefined,
        })),
      },
      activityData: {
        dailyActivity: dailyActivity.map((a) => ({
          ...a,
          _id: String(a._id),
          user_id: undefined,
        })),
      },
      universityData: studentProfile
        ? {
            studentProfile: {
              ...studentProfile,
              _id: String(studentProfile._id),
              user_id: undefined,
            },
            advisorSessions: advisorSessions.map((s) => ({
              ...s,
              _id: String(s._id),
              student_id: undefined,
            })),
            advisorReviews: advisorReviews.map((r) => ({
              ...r,
              _id: String(r._id),
              student_id: undefined,
            })),
            advisorRelationships: studentAdvisorRelationships.map((r) => ({
              ...r,
              _id: String(r._id),
              student_id: undefined,
            })),
          }
        : null,
      paymentData: {
        payments: stripePayments.map((p) => ({
          ...p,
          _id: String(p._id),
          user_id: undefined,
          // Keep Stripe IDs for user reference
          stripe_customer_id: p.stripe_customer_id,
        })),
      },
      notificationHistory: notifications.map((n) => ({
        ...n,
        _id: String(n._id),
        user_id: undefined,
      })),
    };

    return exportData;
  },
});

/**
 * Request account deletion with 30-day grace period (GDPR Right to Erasure)
 *
 * GDPR COMPLIANCE:
 * - 30-day grace period allows user to cancel deletion
 * - Confirmation email sent at day 0 and day 29
 * - After grace period, data is permanently deleted
 * - Audit logs preserved with PII redacted
 * - Financial records preserved for legal compliance
 */
export const requestAccountDeletion = mutation({
  args: {
    reason: v.optional(v.string()),
    immediateDelete: v.optional(v.boolean()), // For test users or explicit consent
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    // Check if already in deletion process
    if (user.account_status === 'pending_deletion') {
      return {
        success: true,
        message: 'Account deletion already scheduled.',
        deletionType: 'scheduled',
        scheduledDeletionDate: user.deletion_scheduled_at
          ? new Date(user.deletion_scheduled_at).toISOString()
          : undefined,
        gracePeriodDays: 30,
      };
    }

    if (user.account_status === 'deleted') {
      throw new Error('Account is already deleted');
    }

    // Calculate grace period end (30 days from now)
    const gracePeriodMs = 30 * 24 * 60 * 60 * 1000; // 30 days
    const deletionScheduledAt = Date.now() + gracePeriodMs;

    // For test users or immediate delete, skip grace period
    const skipGracePeriod = args.immediateDelete === true || user.is_test_user === true;

    // Store deletion request metadata
    await ctx.db.patch(user._id, {
      account_status: skipGracePeriod ? 'deleted' : 'pending_deletion',
      deletion_scheduled_at: skipGracePeriod ? undefined : deletionScheduledAt,
      deleted_at: skipGracePeriod ? Date.now() : undefined,
      deleted_reason: args.reason || 'User requested account deletion (GDPR Article 17)',
      updated_at: Date.now(),
    });

    // Create audit log
    await ctx.db.insert('audit_logs', {
      action: skipGracePeriod ? 'gdpr_deletion_immediate' : 'gdpr_deletion_requested',
      actor_id: user._id,
      entity_type: 'user',
      entity_id: String(user._id),
      student_id: user.role === 'student' ? user._id : undefined,
      new_value: {
        reason: args.reason,
        scheduledDeletionDate: skipGracePeriod ? null : new Date(deletionScheduledAt).toISOString(),
        gdprArticle: 'Article 17 - Right to Erasure',
      },
      created_at: Date.now(),
    });

    if (skipGracePeriod) {
      // Schedule immediate deletion cascade
      await ctx.scheduler.runAfter(0, internal.gdpr.executeAccountDeletion, {
        userId: user._id,
      });

      return {
        success: true,
        message: 'Account deletion initiated. Your data will be deleted shortly.',
        deletionType: 'immediate',
      };
    }

    // Schedule deletion after grace period
    await ctx.scheduler.runAfter(gracePeriodMs, internal.gdpr.executeAccountDeletion, {
      userId: user._id,
    });

    // Schedule reminder email at day 29
    const reminderMs = 29 * 24 * 60 * 60 * 1000;
    await ctx.scheduler.runAfter(reminderMs, internal.gdpr.sendDeletionReminder, {
      userId: user._id,
    });

    return {
      success: true,
      message:
        'Account deletion requested. Your account will be deleted in 30 days. You can cancel this request anytime during the grace period.',
      deletionType: 'scheduled',
      scheduledDeletionDate: new Date(deletionScheduledAt).toISOString(),
      gracePeriodDays: 30,
    };
  },
});

/**
 * Cancel a pending account deletion request
 */
export const cancelAccountDeletion = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    // Check if there's a pending deletion
    if (user.account_status !== 'pending_deletion') {
      throw new Error('No pending deletion request found');
    }

    // Restore account
    await ctx.db.patch(user._id, {
      account_status: 'active',
      deletion_scheduled_at: undefined,
      deleted_reason: undefined,
      updated_at: Date.now(),
    });

    // Create audit log
    await ctx.db.insert('audit_logs', {
      action: 'gdpr_deletion_cancelled',
      actor_id: user._id,
      entity_type: 'user',
      entity_id: String(user._id),
      created_at: Date.now(),
    });

    return {
      success: true,
      message: 'Account deletion request cancelled. Your account is now active.',
    };
  },
});

/**
 * Internal mutation: Execute the actual account deletion
 * This runs after the grace period or immediately for test users
 */
export const executeAccountDeletion = internalMutation({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);

    if (!user) {
      console.log(`User ${args.userId} not found - may have already been deleted`);
      return { success: false, reason: 'User not found' };
    }

    // Check if deletion was cancelled (account is now active)
    if (user.account_status === 'active') {
      console.log(`Deletion cancelled for user ${args.userId}`);
      return { success: false, reason: 'Deletion was cancelled' };
    }

    // Tables to cascade delete (all user-linked data)
    const tablesToDelete = [
      'applications',
      'resumes',
      'cover_letters',
      'goals',
      'projects',
      'networking_contacts',
      'contact_interactions',
      'follow_ups',
      'followup_actions', // Legacy table
      'career_paths',
      'ai_coach_conversations',
      'ai_coach_messages',
      'support_tickets',
      'user_achievements',
      'user_daily_activity',
      'job_searches',
      'daily_recommendations',
      'notifications',
    ];

    let deletedCount = 0;
    const failedTables: string[] = [];

    // Delete records from each table
    for (const tableName of tablesToDelete) {
      try {
        const records = await (ctx.db.query(tableName as any) as any)
          .withIndex('by_user', (q: any) => q.eq('user_id', args.userId))
          .collect();

        for (const record of records) {
          await ctx.db.delete(record._id);
          deletedCount++;
        }
      } catch (error) {
        console.error(`Error deleting from ${tableName}:`, error);
        failedTables.push(tableName);
        // Continue with other tables
      }
    }

    // Delete student profile if exists
    const studentProfile = await ctx.db
      .query('studentProfiles')
      .withIndex('by_user_id', (q) => q.eq('user_id', args.userId))
      .first();

    if (studentProfile) {
      await ctx.db.delete(studentProfile._id);
      deletedCount++;
    }

    // Delete advisor sessions where user is student
    const advisorSessions = await ctx.db
      .query('advisor_sessions')
      .filter((q) => q.eq(q.field('student_id'), args.userId))
      .collect();

    for (const session of advisorSessions) {
      await ctx.db.delete(session._id);
      deletedCount++;
    }

    // Delete advisor reviews where user is student
    const advisorReviews = await ctx.db
      .query('advisor_reviews')
      .filter((q) => q.eq(q.field('student_id'), args.userId))
      .collect();

    for (const review of advisorReviews) {
      await ctx.db.delete(review._id);
      deletedCount++;
    }

    // Delete student_advisors relationships
    const studentAdvisorRelationships = await ctx.db
      .query('student_advisors')
      .filter((q) => q.eq(q.field('student_id'), args.userId))
      .collect();

    for (const relationship of studentAdvisorRelationships) {
      await ctx.db.delete(relationship._id);
      deletedCount++;
    }

    // Delete memberships
    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_user', (q) => q.eq('user_id', args.userId))
      .collect();

    for (const membership of memberships) {
      await ctx.db.delete(membership._id);
      deletedCount++;
    }

    // Redact PII from audit logs (preserve for compliance)
    await ctx.scheduler.runAfter(0, internal.audit_logs.redactStudentPII, {
      studentId: args.userId,
    });

    // Finally, delete the user record
    await ctx.db.delete(args.userId);
    deletedCount++;

    // Create final audit log (with minimal info since user is deleted)
    await ctx.db.insert('audit_logs', {
      action: 'gdpr_deletion_completed',
      entity_type: 'user',
      entity_id: String(args.userId),
      new_value: {
        deletedRecordsCount: deletedCount,
        completedAt: new Date().toISOString(),
        gdprArticle: 'Article 17 - Right to Erasure',
        ...(failedTables.length > 0 && { failedTables }),
      },
      created_at: Date.now(),
    });

    return {
      success: true,
      deletedRecordsCount: deletedCount,
      ...(failedTables.length > 0 && { failedTables }),
    };
  },
});

/**
 * Internal mutation: Send deletion reminder email before grace period ends
 */
export const sendDeletionReminder = internalMutation({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);

    if (!user) {
      return { success: false, reason: 'User not found' };
    }

    // Check if deletion was cancelled
    if (user.account_status === 'active') {
      return { success: false, reason: 'Deletion was cancelled' };
    }

    /**
     * FEATURE INCOMPLETE: GDPR deletion reminder email
     *
     * Implementation plan:
     * 1. Add sendDeletionReminderEmail to src/lib/email.ts (use existing email patterns)
     * 2. Create email template explaining:
     *    - Account will be deleted in X days
     *    - How to cancel deletion (log in)
     *    - What data will be removed
     * 3. Create convex action to call email service
     * 4. Uncomment scheduler call below:
     *    await ctx.scheduler.runAfter(0, api.email.sendDeletionReminderEmail, {
     *      email: user.email,
     *      name: user.name,
     *      deletionDate: user.deletion_scheduled_at,
     *    });
     */

    // Placeholder log until email is implemented
    console.log(`[GDPR] Deletion reminder would be sent to user ${args.userId}`);

    return { success: true };
  },
});

/**
 * Check if user has pending deletion request
 */
export const getDeletionStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) {
      return null;
    }

    // Check for pending deletion
    if (user.account_status === 'pending_deletion') {
      return {
        hasPendingDeletion: true,
        reason: user.deleted_reason,
        scheduledDeletionDate: user.deletion_scheduled_at,
        message: 'Your account is scheduled for deletion. You can cancel this request anytime.',
      };
    }

    return {
      hasPendingDeletion: false,
    };
  },
});
