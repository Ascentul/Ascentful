import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { ACTIVITY_EVENTS, trackActivity } from './lib/activityTracker';
import { getAuthenticatedUser } from './lib/authorization';

// Get conversations for a user
export const getConversations = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    // Get user first
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      throw new Error('User not found');
    }

    // Get conversations for the user
    const conversations = await ctx.db
      .query('ai_coach_conversations')
      .withIndex('by_user', (q) => q.eq('user_id', user._id))
      .order('desc')
      .collect();

    return conversations.map((conv) => ({
      id: conv._id,
      title: conv.title,
      createdAt: new Date(conv.created_at).toISOString(),
      userId: conv.user_id,
    }));
  },
});

// Create a new conversation
export const createConversation = mutation({
  args: {
    title: v.string(),
    // SECURITY: Optional clerkId for server-side API routes that have already
    // authenticated the user through their own mechanisms.
    // Client-side calls should NOT pass this - JWT auth is preferred.
    clerkId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // SECURITY: Prefer JWT token authentication for client-side calls.
    // Fall back to clerkId lookup only for authenticated server-side API routes.
    const identity = await ctx.auth.getUserIdentity();
    let user;
    if (identity) {
      user = await ctx.db
        .query('users')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
        .first();
    } else if (args.clerkId) {
      // Server-side call with clerkId (API routes that verified auth separately)
      const clerkIdForLookup = args.clerkId;
      user = await ctx.db
        .query('users')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkIdForLookup))
        .first();
    }
    if (!user) {
      throw new Error('Unauthorized: User not found');
    }

    const now = Date.now();
    const conversationId = await ctx.db.insert('ai_coach_conversations', {
      user_id: user._id,
      university_id: user.university_id ?? undefined,
      title: args.title,
      created_at: now,
      updated_at: now,
    });

    // Track activity event for engagement scoring
    try {
      await trackActivity(ctx, {
        userId: user._id,
        universityId: user.university_id ?? undefined,
        eventType: ACTIVITY_EVENTS.COACH_CONVERSATION_STARTED,
        eventCategory: 'ai_coach',
        entityType: 'conversation',
        entityId: conversationId,
        metadata: {
          // Avoid storing raw title which may contain PII
          titleLength: args.title.length,
        },
      });
    } catch {
      // Don't fail conversation creation if activity tracking fails
    }

    return {
      id: conversationId,
      title: args.title,
      createdAt: new Date(now).toISOString(),
      userId: user._id,
    };
  },
});

// Get messages for a conversation
export const getMessages = query({
  args: {
    clerkId: v.string(),
    conversationId: v.id('ai_coach_conversations'),
  },
  handler: async (ctx, args) => {
    // Get user first
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      throw new Error('User not found');
    }

    // Verify conversation belongs to user
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.user_id !== user._id) {
      throw new Error('Conversation not found or access denied');
    }

    // Get messages for the conversation
    const messages = await ctx.db
      .query('ai_coach_messages')
      .withIndex('by_conversation', (q) => q.eq('conversation_id', args.conversationId))
      .order('asc')
      .collect();

    return messages.map((msg) => ({
      id: msg._id,
      conversationId: msg.conversation_id,
      isUser: msg.is_user,
      message: msg.message,
      timestamp: new Date(msg.timestamp).toISOString(),
    }));
  },
});

// Add messages to a conversation
export const addMessages = mutation({
  args: {
    conversationId: v.id('ai_coach_conversations'),
    userMessage: v.string(),
    aiMessage: v.string(),
    // SECURITY: Optional clerkId for server-side API routes
    clerkId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // SECURITY: Prefer JWT token authentication for client-side calls.
    // Fall back to clerkId lookup only for authenticated server-side API routes.
    const identity = await ctx.auth.getUserIdentity();
    let user;
    if (identity) {
      user = await ctx.db
        .query('users')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
        .first();
    } else if (args.clerkId) {
      const clerkIdForLookup = args.clerkId;
      user = await ctx.db
        .query('users')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkIdForLookup))
        .first();
    }
    if (!user) {
      throw new Error('Unauthorized: User not found');
    }

    // Verify conversation belongs to user
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.user_id !== user._id) {
      throw new Error('Conversation not found or access denied');
    }

    const now = Date.now();

    // Add user message
    const userMessageId = await ctx.db.insert('ai_coach_messages', {
      conversation_id: args.conversationId,
      user_id: user._id,
      is_user: true,
      message: args.userMessage,
      timestamp: now,
    });

    // Add AI message
    const aiMessageId = await ctx.db.insert('ai_coach_messages', {
      conversation_id: args.conversationId,
      user_id: user._id,
      is_user: false,
      message: args.aiMessage,
      timestamp: now + 1, // Slightly later timestamp
    });

    // Update conversation timestamp
    await ctx.db.patch(args.conversationId, {
      updated_at: now,
    });

    // Track activity event for engagement scoring
    try {
      await trackActivity(ctx, {
        userId: user._id,
        universityId: user.university_id ?? undefined,
        eventType: ACTIVITY_EVENTS.COACH_MESSAGE_SENT,
        eventCategory: 'ai_coach',
        entityType: 'conversation',
        entityId: args.conversationId,
        metadata: {
          messageLength: args.userMessage.length,
        },
      });
    } catch {
      // Don't fail message addition if activity tracking fails
    }

    return [
      {
        id: userMessageId,
        conversationId: args.conversationId,
        isUser: true,
        message: args.userMessage,
        timestamp: new Date(now).toISOString(),
      },
      {
        id: aiMessageId,
        conversationId: args.conversationId,
        isUser: false,
        message: args.aiMessage,
        timestamp: new Date(now + 1).toISOString(),
      },
    ];
  },
});
