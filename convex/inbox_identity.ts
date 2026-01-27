/**
 * Inbox Identity Resolution
 *
 * Handles matching external senders (emails) to students in the system.
 * Supports auto-matching by email and manual matching by advisors.
 */

import { v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { getCurrentUser, requireAdvisorRole, requireTenant } from './advisor_auth';
import { logUserAction } from './lib/auditLogger';

/**
 * Get unmatched threads for identity resolution
 */
export const getUnmatchedThreads = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Auth check
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const limit = args.limit ?? 50;

    // Get threads with unmatched identity status
    const threads = await ctx.db
      .query('inbox_threads')
      .withIndex('by_identity_status', (q) =>
        q.eq('university_id', universityId).eq('identity_status', 'unmatched'),
      )
      .take(limit);

    return threads;
  },
});

/**
 * Search for potential student matches
 * Used in the identity matcher UI
 */
export const searchStudentMatches = query({
  args: {
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Auth check
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const limit = args.limit ?? 10;

    // Search by exact email first (normalize for case-insensitive matching)
    if (args.email) {
      const normalizedEmail = args.email.trim().toLowerCase();
      const exactMatch = await ctx.db
        .query('users')
        .withIndex('by_email', (q) => q.eq('email', normalizedEmail))
        .filter((q) => q.eq(q.field('university_id'), universityId))
        .filter((q) => q.or(q.eq(q.field('role'), 'student'), q.eq(q.field('role'), 'user')))
        .first();

      if (exactMatch) {
        return [
          {
            student: {
              _id: exactMatch._id,
              name: exactMatch.name,
              email: exactMatch.email,
              imageUrl: exactMatch.profile_image,
            },
            matchType: 'exact_email' as const,
            confidence: 'exact' as const,
          },
        ];
      }
    }

    // Get students in university for fuzzy matching
    // NOTE: For large universities (>1000 students), consider implementing
    // a more efficient search strategy (e.g., trigram index, search service)
    const students = await ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', universityId))
      .filter((q) => q.or(q.eq(q.field('role'), 'student'), q.eq(q.field('role'), 'user')))
      .take(1000);

    const matches: Array<{
      student: {
        _id: Id<'users'>;
        name: string;
        email: string;
        imageUrl?: string;
      };
      matchType: 'fuzzy_name' | 'partial_email';
      confidence: 'high' | 'low';
      score: number;
    }> = [];

    // Search by name (fuzzy)
    if (args.name) {
      const searchName = args.name.toLowerCase();
      const nameParts = searchName.split(/\s+/);

      for (const student of students) {
        const studentName = (student.name || '').toLowerCase();

        // Check if all name parts appear in student name
        const allPartsMatch = nameParts.every((part) => studentName.includes(part));

        if (allPartsMatch && studentName) {
          // Calculate score based on how similar names are
          const score = calculateNameSimilarity(searchName, studentName);

          matches.push({
            student: {
              _id: student._id,
              name: student.name || '',
              email: student.email,
              imageUrl: student.profile_image,
            },
            matchType: 'fuzzy_name',
            confidence: score > 0.8 ? 'high' : 'low',
            score,
          });
        }
      }
    }

    // Search by partial email
    if (args.email) {
      const searchEmail = args.email.toLowerCase();
      const emailPrefix = searchEmail.split('@')[0];

      for (const student of students) {
        const studentEmail = student.email.toLowerCase();
        const studentEmailPrefix = studentEmail.split('@')[0];

        // Check for partial email match (prefix similarity)
        if (studentEmailPrefix.includes(emailPrefix) || emailPrefix.includes(studentEmailPrefix)) {
          // Avoid duplicates from name search
          if (!matches.some((m) => m.student._id === student._id)) {
            const score = calculateStringSimilarity(emailPrefix, studentEmailPrefix);

            matches.push({
              student: {
                _id: student._id,
                name: student.name || '',
                email: student.email,
                imageUrl: student.profile_image,
              },
              matchType: 'partial_email',
              confidence: score > 0.7 ? 'high' : 'low',
              score,
            });
          }
        }
      }
    }

    // Sort by score descending and limit
    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, limit);
  },
});

/**
 * Match thread to a student
 * Manual identity resolution by advisors
 */
export const matchToStudent = mutation({
  args: {
    threadId: v.id('inbox_threads'),
    studentId: v.id('users'),
    matchMethod: v.optional(
      v.union(
        v.literal('auto_email'),
        v.literal('auto_external_id'),
        v.literal('manual'),
        v.literal('fuzzy_name'),
      ),
    ),
    confidence: v.optional(
      v.union(v.literal('exact'), v.literal('high'), v.literal('low'), v.literal('none')),
    ),
  },
  handler: async (ctx, args) => {
    // Auth check
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    // Tenant check
    if (thread.university_id !== universityId) {
      throw new Error('Unauthorized: Thread not in your university');
    }

    // Verify student exists and is in same university
    const student = await ctx.db.get(args.studentId);
    if (!student) {
      throw new Error('Student not found');
    }

    if (student.university_id !== universityId) {
      throw new Error('Student must be in the same university');
    }

    if (student.role !== 'student' && student.role !== 'user') {
      throw new Error('Matched user must be a student');
    }

    const now = Date.now();
    const matchMethod = args.matchMethod ?? 'manual';
    const confidence = args.confidence ?? 'exact';

    // Update thread
    await ctx.db.patch(args.threadId, {
      student_id: args.studentId,
      identity_status: 'matched',
      updated_at: now,
    });

    // Create identity match record for audit
    await ctx.db.insert('inbox_identity_matches', {
      thread_id: args.threadId,
      university_id: universityId,
      external_email: thread.external_sender_email || '',
      external_name: thread.external_sender_name,
      matched_student_id: args.studentId,
      match_method: matchMethod,
      confidence,
      matched_by: sessionCtx.userId,
      matched_at: now,
      status: 'matched',
      created_at: now,
      updated_at: now,
    });

    // Create action log
    await ctx.db.insert('inbox_thread_actions', {
      thread_id: args.threadId,
      actor_id: sessionCtx.userId,
      action_type: 'student_matched',
      new_value: {
        student_id: args.studentId,
        match_method: matchMethod,
        confidence,
      },
      created_at: now,
    });

    // Auto-assign to student's primary advisor if thread is unassigned
    if (!thread.assigned_to) {
      const primaryAdvisor = await ctx.db
        .query('student_advisors')
        .withIndex('by_student', (q) => q.eq('student_id', args.studentId))
        .filter((q) => q.eq(q.field('is_owner'), true))
        .first();

      if (primaryAdvisor) {
        await ctx.db.patch(args.threadId, {
          assigned_to: primaryAdvisor.advisor_id,
          assigned_at: now,
          assigned_by: sessionCtx.userId,
        });

        await ctx.db.insert('inbox_thread_actions', {
          thread_id: args.threadId,
          actor_id: sessionCtx.userId,
          action_type: 'assigned',
          new_value: { assigned_to: primaryAdvisor.advisor_id },
          notes: 'Auto-assigned to primary advisor after identity match',
          created_at: now,
        });
      }
    }

    // Audit log
    await logUserAction(ctx, {
      action: 'inbox_thread.identity_matched',
      actorUserId: sessionCtx.userId,
      actorRole: sessionCtx.role,
      targetId: args.threadId,
      targetType: 'inbox_thread',
      studentId: args.studentId,
      actorUniversityId: universityId,
      metadata: {
        matchMethod,
        confidence,
        externalEmail: thread.external_sender_email,
      },
    });

    return { success: true };
  },
});

/**
 * Mark thread as external (no matching student)
 */
export const markAsExternal = mutation({
  args: {
    threadId: v.id('inbox_threads'),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Auth check
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);
    const universityId = requireTenant(sessionCtx);

    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    // Tenant check
    if (thread.university_id !== universityId) {
      throw new Error('Unauthorized: Thread not in your university');
    }

    const now = Date.now();

    // Update thread - clear student_id since external contacts are not students
    await ctx.db.patch(args.threadId, {
      identity_status: 'external',
      student_id: undefined,
      updated_at: now,
    });

    // Create identity match record for audit
    await ctx.db.insert('inbox_identity_matches', {
      thread_id: args.threadId,
      university_id: universityId,
      external_email: thread.external_sender_email || '',
      external_name: thread.external_sender_name,
      status: 'external',
      created_at: now,
      updated_at: now,
    });

    // Create action log
    await ctx.db.insert('inbox_thread_actions', {
      thread_id: args.threadId,
      actor_id: sessionCtx.userId,
      action_type: 'status_changed',
      previous_value: { identity_status: thread.identity_status },
      new_value: { identity_status: 'external' },
      notes: args.reason,
      created_at: now,
    });

    // Audit log
    await logUserAction(ctx, {
      action: 'inbox_thread.marked_external',
      actorUserId: sessionCtx.userId,
      actorRole: sessionCtx.role,
      targetId: args.threadId,
      targetType: 'inbox_thread',
      actorUniversityId: universityId,
      metadata: {
        externalEmail: thread.external_sender_email,
        reason: args.reason,
      },
    });

    return { success: true };
  },
});

/**
 * Get identity match history for a thread
 */
export const getIdentityHistory = query({
  args: {
    threadId: v.id('inbox_threads'),
  },
  handler: async (ctx, args) => {
    // Auth check
    const sessionCtx = await getCurrentUser(ctx);
    requireAdvisorRole(sessionCtx);

    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    // Tenant check
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (thread.university_id !== universityId) {
        throw new Error('Unauthorized: Thread not in your university');
      }
    }

    // Get identity match records
    const matches = await ctx.db
      .query('inbox_identity_matches')
      .withIndex('by_thread', (q) => q.eq('thread_id', args.threadId))
      .order('desc')
      .collect();

    // Enrich with user info
    const enrichedMatches = await Promise.all(
      matches.map(async (match) => {
        let matchedStudent = null;
        let matchedBy = null;

        if (match.matched_student_id) {
          const student = await ctx.db.get(match.matched_student_id);
          if (student) {
            matchedStudent = {
              _id: student._id,
              name: student.name || '',
              email: student.email,
            };
          }
        }

        if (match.matched_by) {
          const user = await ctx.db.get(match.matched_by);
          if (user) {
            matchedBy = {
              _id: user._id,
              name: user.name || '',
              email: user.email,
            };
          }
        }

        return {
          ...match,
          matchedStudent,
          matchedBy,
        };
      }),
    );

    return enrichedMatches;
  },
});

// Helper functions

/**
 * Calculate string similarity using Levenshtein-like approach
 */
function calculateStringSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate name similarity (case-insensitive, handles name order variations)
 */
function calculateNameSimilarity(name1: string, name2: string): number {
  const parts1 = name1.toLowerCase().split(/\s+/).sort();
  const parts2 = name2.toLowerCase().split(/\s+/).sort();

  // If different number of parts, penalize
  const lengthPenalty = Math.abs(parts1.length - parts2.length) * 0.1;

  // Compare sorted parts
  const maxParts = Math.max(parts1.length, parts2.length);
  if (maxParts === 0) return 1.0; // Both names empty - consider identical

  let totalSimilarity = 0;

  for (let i = 0; i < maxParts; i++) {
    const p1 = parts1[i] || '';
    const p2 = parts2[i] || '';
    totalSimilarity += calculateStringSimilarity(p1, p2);
  }

  return Math.max(0, totalSimilarity / maxParts - lengthPenalty);
}

/**
 * Basic Levenshtein distance calculation
 */
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;

  // Create matrix
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost, // substitution
      );
    }
  }

  return dp[m][n];
}
