/**
 * Interview Practice Convex Functions
 *
 * Provides queries and mutations for the interview practice feature.
 * Handles role profiles, sessions, turns, and coaching feedback.
 *
 * Authorization:
 * - Users can CRUD their own sessions
 * - Advisors can read (not write) sessions for students in their university
 * - University admins can read (not write) sessions for students in their university
 * - Super admins can read all sessions
 *
 * @see convex/lib/authorization.ts for auth helpers
 */

import { v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import {
  assertResourceOwnership,
  assertStudentAccess,
  assertUniversityAccess,
  getAuthenticatedUser,
  hasAdvisorAccess,
  logAuthAction,
} from './lib/authorization';

// ============================================================================
// ROLE PROFILES
// ============================================================================

/**
 * Get all role profiles for the authenticated user
 */
export const getRoleProfiles = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);

    const profiles = await ctx.db
      .query('interview_role_profiles')
      .withIndex('by_user', (q) => q.eq('user_id', user._id))
      .order('desc')
      .collect();

    return profiles;
  },
});

/**
 * Get a single role profile by ID
 */
export const getRoleProfile = query({
  args: { profileId: v.id('interview_role_profiles') },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const profile = await ctx.db.get(args.profileId);

    if (!profile) {
      throw new Error('Role profile not found');
    }

    // Check ownership (or advisor access for viewing student data)
    if (profile.user_id !== user._id) {
      if (hasAdvisorAccess(user)) {
        assertUniversityAccess(user, profile.university_id);
      } else {
        throw new Error('Unauthorized: You do not own this role profile');
      }
    }

    return profile;
  },
});

/**
 * Create a new role profile
 */
export const createRoleProfile = mutation({
  args: {
    input_type: v.union(v.literal('title_company'), v.literal('jd_text'), v.literal('jd_link')),
    job_title: v.string(),
    company_name: v.optional(v.string()),
    job_level: v.optional(v.string()),
    job_description_text: v.optional(v.string()),
    job_url: v.optional(v.string()),
    role_summary: v.optional(v.string()),
    competencies: v.optional(
      v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          weight: v.number(),
          description: v.optional(v.string()),
        }),
      ),
    ),
    extracted_keywords: v.optional(v.array(v.string())),
    interview_type: v.optional(
      v.union(
        v.literal('behavioral'),
        v.literal('technical'),
        v.literal('case'),
        v.literal('mixed'),
      ),
    ),
    source_notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const now = Date.now();

    const profileId = await ctx.db.insert('interview_role_profiles', {
      user_id: user._id,
      university_id: user.university_id ?? undefined,
      input_type: args.input_type,
      job_title: args.job_title,
      company_name: args.company_name,
      job_level: args.job_level,
      job_description_text: args.job_description_text,
      job_url: args.job_url,
      role_summary: args.role_summary,
      competencies: args.competencies,
      extracted_keywords: args.extracted_keywords,
      interview_type: args.interview_type,
      source_notes: args.source_notes,
      created_at: now,
      updated_at: now,
    });

    return profileId;
  },
});

/**
 * Update a role profile
 */
export const updateRoleProfile = mutation({
  args: {
    profileId: v.id('interview_role_profiles'),
    job_title: v.optional(v.string()),
    company_name: v.optional(v.string()),
    job_level: v.optional(v.string()),
    role_summary: v.optional(v.string()),
    competencies: v.optional(
      v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          weight: v.number(),
          description: v.optional(v.string()),
        }),
      ),
    ),
    extracted_keywords: v.optional(v.array(v.string())),
    interview_type: v.optional(
      v.union(
        v.literal('behavioral'),
        v.literal('technical'),
        v.literal('case'),
        v.literal('mixed'),
      ),
    ),
    source_notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const profile = await ctx.db.get(args.profileId);

    if (!profile) {
      throw new Error('Role profile not found');
    }

    assertResourceOwnership(user, profile.user_id);

    const { profileId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined),
    );

    await ctx.db.patch(profileId, {
      ...filteredUpdates,
      updated_at: Date.now(),
    });

    return profileId;
  },
});

/**
 * Delete a role profile
 */
export const deleteRoleProfile = mutation({
  args: { profileId: v.id('interview_role_profiles') },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const profile = await ctx.db.get(args.profileId);

    if (!profile) {
      throw new Error('Role profile not found');
    }

    assertResourceOwnership(user, profile.user_id);

    // Check if there are any sessions using this profile
    const sessions = await ctx.db
      .query('interview_practice_sessions')
      .withIndex('by_role_profile', (q) => q.eq('role_profile_id', args.profileId))
      .first();

    if (sessions) {
      throw new Error('Cannot delete role profile: it has associated interview sessions');
    }

    await ctx.db.delete(args.profileId);
    return args.profileId;
  },
});

/**
 * Save a role from a session's embedded snapshot
 * Creates a new role profile from the session's role_snapshot data
 * Optionally links the session to the new profile
 */
export const saveRoleFromSession = mutation({
  args: {
    sessionId: v.id('interview_practice_sessions'),
    linkToSession: v.optional(v.boolean()), // Whether to update session.role_profile_id
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const session = await ctx.db.get(args.sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    assertResourceOwnership(user, session.user_id);

    if (!session.role_snapshot) {
      throw new Error('Session does not have embedded role data to save');
    }

    if (session.role_profile_id) {
      throw new Error('Session already has a saved role profile');
    }

    const now = Date.now();
    const snapshot = session.role_snapshot;

    // Create the role profile from the snapshot
    const profileId = await ctx.db.insert('interview_role_profiles', {
      user_id: user._id,
      university_id: user.university_id ?? undefined,
      input_type: snapshot.input_type,
      job_title: snapshot.job_title,
      company_name: snapshot.company_name,
      job_level: snapshot.job_level,
      job_description_text: snapshot.job_description_text,
      job_url: snapshot.job_url,
      role_summary: snapshot.role_summary,
      competencies: snapshot.competencies,
      extracted_keywords: snapshot.extracted_keywords,
      interview_type: snapshot.interview_type,
      created_at: now,
      updated_at: now,
    });

    // Optionally link the session to the new profile
    if (args.linkToSession !== false) {
      await ctx.db.patch(args.sessionId, {
        role_profile_id: profileId,
        // Keep role_snapshot for historical record
        updated_at: now,
      });
    }

    return profileId;
  },
});

// ============================================================================
// SESSIONS
// ============================================================================

/**
 * Get all sessions for the authenticated user
 */
export const getSessions = query({
  args: {
    status: v.optional(
      v.union(
        v.literal('setup'),
        v.literal('in_progress'),
        v.literal('completed'),
        v.literal('abandoned'),
      ),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const limit = args.limit ?? 50;

    const sessionsQuery = ctx.db
      .query('interview_practice_sessions')
      .withIndex('by_user', (q) => q.eq('user_id', user._id))
      .order('desc');

    const sessions = await sessionsQuery.take(limit);

    // Filter by status if provided
    const filtered = args.status ? sessions.filter((s) => s.status === args.status) : sessions;

    // Fetch role profiles for sessions that have one
    const profileIds = [
      ...new Set(
        filtered
          .map((s) => s.role_profile_id)
          .filter((id): id is Id<'interview_role_profiles'> => id !== undefined),
      ),
    ];
    const profiles = await Promise.all(profileIds.map((id) => ctx.db.get(id)));
    const profileMap = new Map(profiles.filter(Boolean).map((p) => [p!._id, p]));

    return filtered.map((session) => ({
      ...session,
      // Provide role_profile from saved profile OR from embedded snapshot
      role_profile: session.role_profile_id
        ? (profileMap.get(session.role_profile_id) ?? null)
        : session.role_snapshot
          ? { ...session.role_snapshot, _id: null, _creationTime: session.created_at }
          : null,
    }));
  },
});

/**
 * Get a single session by ID
 */
export const getSession = query({
  args: { sessionId: v.id('interview_practice_sessions') },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const session = await ctx.db.get(args.sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    // Check ownership or advisor access
    if (session.user_id !== user._id) {
      if (hasAdvisorAccess(user)) {
        assertUniversityAccess(user, session.university_id);
      } else {
        throw new Error('Unauthorized: You do not own this session');
      }
    }

    // Fetch role profile if referenced, otherwise use snapshot
    const roleProfile = session.role_profile_id
      ? await ctx.db.get(session.role_profile_id)
      : session.role_snapshot
        ? { ...session.role_snapshot, _id: null, _creationTime: session.created_at }
        : null;

    return {
      ...session,
      role_profile: roleProfile,
    };
  },
});

/**
 * Get session with all turns (for report page)
 */
export const getSessionWithTurns = query({
  args: { sessionId: v.id('interview_practice_sessions') },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const session = await ctx.db.get(args.sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    // Check ownership or advisor access
    if (session.user_id !== user._id) {
      if (hasAdvisorAccess(user)) {
        assertUniversityAccess(user, session.university_id);
      } else {
        throw new Error('Unauthorized: You do not own this session');
      }
    }

    // Fetch role profile if referenced, otherwise use snapshot
    const roleProfile = session.role_profile_id
      ? await ctx.db.get(session.role_profile_id)
      : session.role_snapshot
        ? { ...session.role_snapshot, _id: null, _creationTime: session.created_at }
        : null;

    // Fetch all turns
    const turns = await ctx.db
      .query('interview_practice_turns')
      .withIndex('by_session', (q) => q.eq('session_id', args.sessionId))
      .order('asc')
      .collect();

    return {
      ...session,
      role_profile: roleProfile,
      turns,
    };
  },
});

/**
 * Create a new session
 * Supports two modes:
 * 1. Reference a saved role profile (role_profile_id)
 * 2. Embed role data directly (role_snapshot) for unsaved roles
 */
export const createSession = mutation({
  args: {
    // Either provide a saved role profile ID...
    role_profile_id: v.optional(v.id('interview_role_profiles')),
    // ...OR embed role data directly
    role_snapshot: v.optional(
      v.object({
        input_type: v.union(v.literal('title_company'), v.literal('jd_text'), v.literal('jd_link')),
        job_title: v.string(),
        company_name: v.optional(v.string()),
        job_level: v.optional(v.string()),
        job_description_text: v.optional(v.string()),
        job_url: v.optional(v.string()),
        role_summary: v.optional(v.string()),
        competencies: v.optional(
          v.array(
            v.object({
              id: v.string(),
              name: v.string(),
              weight: v.number(),
              description: v.optional(v.string()),
            }),
          ),
        ),
        extracted_keywords: v.optional(v.array(v.string())),
        interview_type: v.optional(
          v.union(
            v.literal('behavioral'),
            v.literal('technical'),
            v.literal('case'),
            v.literal('mixed'),
          ),
        ),
      }),
    ),
    mode: v.union(v.literal('neutral'), v.literal('supportive'), v.literal('pressure')),
    camera_enabled: v.boolean(),
    question_count_target: v.number(),
    consent: v.object({
      mic: v.boolean(),
      camera: v.boolean(),
      timestamp: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    // Validate: must have either role_profile_id or role_snapshot
    if (!args.role_profile_id && !args.role_snapshot) {
      throw new Error('Either role_profile_id or role_snapshot is required');
    }

    // If using role_profile_id, verify it exists and belongs to user
    if (args.role_profile_id) {
      const roleProfile = await ctx.db.get(args.role_profile_id);
      if (!roleProfile) {
        throw new Error('Role profile not found');
      }
      assertResourceOwnership(user, roleProfile.user_id);
    }

    // Validate role_snapshot has required fields
    if (args.role_snapshot && !args.role_snapshot.job_title) {
      throw new Error('Role snapshot must include job_title');
    }

    const now = Date.now();

    // Initialize agent state
    const initialAgentState = {
      coveredCompetencies: {},
      openThreads: [],
      followUpQueue: [],
      difficultyLevel: 3, // Start at medium
      evidenceGaps: [],
      questionHistory: [],
    };

    const sessionId = await ctx.db.insert('interview_practice_sessions', {
      user_id: user._id,
      university_id: user.university_id ?? undefined,
      role_profile_id: args.role_profile_id,
      role_snapshot: args.role_snapshot,
      status: 'setup',
      mode: args.mode,
      camera_enabled: args.camera_enabled,
      question_count_target: args.question_count_target,
      current_question_index: 0,
      agent_state: initialAgentState,
      consent: args.consent,
      created_at: now,
      updated_at: now,
    });

    return sessionId;
  },
});

/**
 * Start a session (transition from setup to in_progress)
 */
export const startSession = mutation({
  args: { sessionId: v.id('interview_practice_sessions') },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const session = await ctx.db.get(args.sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    assertResourceOwnership(user, session.user_id);

    if (session.status !== 'setup') {
      throw new Error('Session can only be started from setup status');
    }

    const now = Date.now();

    await ctx.db.patch(args.sessionId, {
      status: 'in_progress',
      started_at: now,
      updated_at: now,
    });

    return args.sessionId;
  },
});

/**
 * Update session status
 */
export const updateSessionStatus = mutation({
  args: {
    sessionId: v.id('interview_practice_sessions'),
    status: v.union(v.literal('in_progress'), v.literal('completed'), v.literal('abandoned')),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const session = await ctx.db.get(args.sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    assertResourceOwnership(user, session.user_id);

    const now = Date.now();
    const updates: Record<string, unknown> = {
      status: args.status,
      updated_at: now,
    };

    // Set ended_at for terminal states
    if (args.status === 'completed' || args.status === 'abandoned') {
      updates.ended_at = now;
      if (session.started_at) {
        updates.total_duration_ms = now - session.started_at;
      }
    }

    await ctx.db.patch(args.sessionId, updates);
    return args.sessionId;
  },
});

/**
 * Update session agent state
 */
export const updateAgentState = mutation({
  args: {
    sessionId: v.id('interview_practice_sessions'),
    agent_state: v.any(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const session = await ctx.db.get(args.sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    assertResourceOwnership(user, session.user_id);

    await ctx.db.patch(args.sessionId, {
      agent_state: args.agent_state,
      updated_at: Date.now(),
    });

    return args.sessionId;
  },
});

/**
 * Complete a session with final scores and summary
 */
export const completeSession = mutation({
  args: {
    sessionId: v.id('interview_practice_sessions'),
    overall_score: v.number(),
    dimension_scores: v.object({
      communication: v.optional(v.number()),
      relevance: v.optional(v.number()),
      specificity: v.optional(v.number()),
      structure: v.optional(v.number()),
      confidence: v.optional(v.number()),
    }),
    coach_summary: v.string(),
    key_takeaways: v.array(v.string()),
    improvement_priorities: v.optional(v.array(v.string())),
    hire_signal: v.optional(
      v.union(
        v.literal('strong_yes'),
        v.literal('yes'),
        v.literal('mixed'),
        v.literal('no'),
        v.literal('strong_no'),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const session = await ctx.db.get(args.sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    assertResourceOwnership(user, session.user_id);

    const now = Date.now();

    await ctx.db.patch(args.sessionId, {
      status: 'completed',
      overall_score: args.overall_score,
      dimension_scores: args.dimension_scores,
      coach_summary: args.coach_summary,
      key_takeaways: args.key_takeaways,
      improvement_priorities: args.improvement_priorities,
      hire_signal: args.hire_signal,
      ended_at: now,
      total_duration_ms: session.started_at ? now - session.started_at : undefined,
      updated_at: now,
    });

    return args.sessionId;
  },
});

// ============================================================================
// TURNS
// ============================================================================

/**
 * Get a single turn by ID
 */
export const getTurn = query({
  args: { turnId: v.id('interview_practice_turns') },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const turn = await ctx.db.get(args.turnId);

    if (!turn) {
      throw new Error('Turn not found');
    }

    // Check ownership or advisor access
    if (turn.user_id !== user._id) {
      if (hasAdvisorAccess(user)) {
        assertUniversityAccess(user, turn.university_id);
      } else {
        throw new Error('Unauthorized: You do not own this turn');
      }
    }

    return turn;
  },
});

/**
 * Create a new turn (question)
 */
export const createTurn = mutation({
  args: {
    session_id: v.id('interview_practice_sessions'),
    turn_index: v.number(),
    question_text: v.string(),
    question_type: v.union(
      v.literal('behavioral'),
      v.literal('technical'),
      v.literal('situational'),
      v.literal('role_specific'),
      v.literal('culture'),
      v.literal('follow_up'),
    ),
    question_intent: v.optional(v.string()),
    target_competencies: v.optional(v.array(v.string())),
    evaluation_focus: v.optional(v.array(v.string())),
    tts_audio_url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const session = await ctx.db.get(args.session_id);

    if (!session) {
      throw new Error('Session not found');
    }

    assertResourceOwnership(user, session.user_id);

    if (session.status !== 'in_progress') {
      throw new Error('Can only add turns to an in-progress session');
    }

    const now = Date.now();

    const turnId = await ctx.db.insert('interview_practice_turns', {
      session_id: args.session_id,
      user_id: user._id,
      university_id: user.university_id ?? undefined,
      turn_index: args.turn_index,
      question_text: args.question_text,
      question_type: args.question_type,
      question_intent: args.question_intent,
      target_competencies: args.target_competencies,
      evaluation_focus: args.evaluation_focus,
      tts_audio_url: args.tts_audio_url,
      asked_at: now,
      created_at: now,
      updated_at: now,
    });

    // Update session's current question index
    await ctx.db.patch(args.session_id, {
      current_question_index: args.turn_index,
      updated_at: now,
    });

    return turnId;
  },
});

/**
 * Save turn response (audio, transcript, scores)
 */
export const saveTurnResponse = mutation({
  args: {
    turn_id: v.id('interview_practice_turns'),
    user_audio_storage_id: v.optional(v.id('_storage')),
    transcript_text: v.optional(v.string()),
    response_duration_ms: v.optional(v.number()),
    transcript_meta: v.optional(
      v.object({
        words_per_minute: v.optional(v.number()),
        filler_count: v.optional(v.number()),
        filler_words: v.optional(v.any()),
        pauses: v.optional(
          v.object({
            count: v.number(),
            avg_ms: v.number(),
            max_ms: v.number(),
          }),
        ),
        duration_sec: v.optional(v.number()),
      }),
    ),
    content_signals: v.optional(
      v.object({
        metrics_count: v.optional(v.number()),
        examples_count: v.optional(v.number()),
        star_structure_score: v.optional(v.number()),
        relevance_score: v.optional(v.number()),
        role_relevance_score: v.optional(v.number()),
      }),
    ),
    scores: v.optional(
      v.object({
        communication: v.optional(v.number()),
        specificity: v.optional(v.number()),
        structure: v.optional(v.number()),
        role_fit: v.optional(v.number()),
        overall: v.optional(v.number()),
      }),
    ),
    strengths: v.optional(v.array(v.string())),
    improvements: v.optional(v.array(v.string())),
    ideal_answer: v.optional(v.string()),
    keywords_to_include: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const turn = await ctx.db.get(args.turn_id);

    if (!turn) {
      throw new Error('Turn not found');
    }

    assertResourceOwnership(user, turn.user_id);

    const now = Date.now();

    await ctx.db.patch(args.turn_id, {
      user_audio_storage_id: args.user_audio_storage_id,
      transcript_text: args.transcript_text,
      response_duration_ms: args.response_duration_ms,
      transcript_meta: args.transcript_meta,
      content_signals: args.content_signals,
      scores: args.scores,
      strengths: args.strengths,
      improvements: args.improvements,
      ideal_answer: args.ideal_answer,
      keywords_to_include: args.keywords_to_include,
      answered_at: now,
      updated_at: now,
    });

    return args.turn_id;
  },
});

// ============================================================================
// AUDIO STORAGE
// ============================================================================

/**
 * Generate an upload URL for audio storage
 */
export const generateAudioUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await getAuthenticatedUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Get audio URL from storage ID
 */
export const getAudioUrl = query({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    await getAuthenticatedUser(ctx);
    return await ctx.storage.getUrl(args.storageId);
  },
});

// ============================================================================
// ADVISOR ACCESS (for viewing student sessions)
// ============================================================================

/**
 * Get sessions for a student (advisor/admin access)
 */
export const getStudentSessions = query({
  args: {
    studentId: v.id('users'),
    status: v.optional(
      v.union(v.literal('completed'), v.literal('in_progress'), v.literal('abandoned')),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    // Verify advisor/admin has access to this student
    await assertStudentAccess(ctx, user, args.studentId);

    const limit = args.limit ?? 20;

    let sessions = await ctx.db
      .query('interview_practice_sessions')
      .withIndex('by_user', (q) => q.eq('user_id', args.studentId))
      .order('desc')
      .take(limit);

    // Filter by status if provided
    if (args.status) {
      sessions = sessions.filter((s) => s.status === args.status);
    }

    // Fetch role profiles for sessions that have one
    const profileIds = [
      ...new Set(
        sessions
          .map((s) => s.role_profile_id)
          .filter((id): id is Id<'interview_role_profiles'> => id !== undefined),
      ),
    ];
    const profiles = await Promise.all(profileIds.map((id) => ctx.db.get(id)));
    const profileMap = new Map(profiles.filter(Boolean).map((p) => [p!._id, p]));

    return sessions.map((session) => ({
      ...session,
      role_profile: session.role_profile_id
        ? (profileMap.get(session.role_profile_id) ?? null)
        : session.role_snapshot
          ? { ...session.role_snapshot, _id: null, _creationTime: session.created_at }
          : null,
    }));
  },
});

/**
 * Get a student's session report (advisor/admin access)
 * Logs audit event for accountability
 */
export const getStudentSessionReport = query({
  args: { sessionId: v.id('interview_practice_sessions') },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const session = await ctx.db.get(args.sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    // Allow owner access
    if (session.user_id === user._id) {
      // No audit log for own data
    } else if (hasAdvisorAccess(user)) {
      // Verify university access
      assertUniversityAccess(user, session.university_id);
      // Note: In queries, we can't log. Audit logging should happen in mutations/actions
    } else {
      throw new Error('Unauthorized: You do not have access to this session');
    }

    // Fetch role profile if referenced, otherwise use snapshot
    const roleProfile = session.role_profile_id
      ? await ctx.db.get(session.role_profile_id)
      : session.role_snapshot
        ? { ...session.role_snapshot, _id: null, _creationTime: session.created_at }
        : null;

    // Fetch all turns
    const turns = await ctx.db
      .query('interview_practice_turns')
      .withIndex('by_session', (q) => q.eq('session_id', args.sessionId))
      .order('asc')
      .collect();

    // Fetch student info
    const student = await ctx.db.get(session.user_id);

    return {
      ...session,
      role_profile: roleProfile,
      turns,
      student: student
        ? {
            _id: student._id,
            name: student.name,
            email: student.email,
          }
        : null,
    };
  },
});

/**
 * Log advisor view of student session (for audit trail)
 * Call this from the frontend when an advisor views a student session
 */
export const logAdvisorSessionView = mutation({
  args: {
    sessionId: v.id('interview_practice_sessions'),
    studentId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    // Only log for advisor/admin access (not self-access)
    if (!hasAdvisorAccess(user)) {
      return; // No-op for non-advisors
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Verify university access
    assertUniversityAccess(user, session.university_id);

    // Log the access
    await logAuthAction(ctx, {
      actorId: user._id,
      universityId: user.university_id ?? undefined,
      action: 'resource_accessed',
      entityType: 'interview_practice_session',
      entityId: args.sessionId as string,
      metadata: {
        studentId: args.studentId,
        accessType: 'advisor_view',
        sessionStatus: session.status,
      },
    });
  },
});
