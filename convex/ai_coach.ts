import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { ACTIVITY_EVENTS, trackActivity } from './lib/activityTracker';

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
    clerkId: v.string(),
    title: v.string(),
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

    const now = Date.now();
    const conversationId = await ctx.db.insert('ai_coach_conversations', {
      user_id: user._id,
      university_id: user.university_id,
      title: args.title,
      created_at: now,
      updated_at: now,
    });

    // Track activity event for engagement scoring
    try {
      await trackActivity(ctx, {
        userId: user._id,
        universityId: user.university_id,
        eventType: ACTIVITY_EVENTS.COACH_CONVERSATION_STARTED,
        eventCategory: 'ai_coach',
        entityType: 'conversation',
        entityId: conversationId,
        metadata: {
          title: args.title,
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
    clerkId: v.string(),
    conversationId: v.id('ai_coach_conversations'),
    userMessage: v.string(),
    aiMessage: v.string(),
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
        universityId: user.university_id,
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
