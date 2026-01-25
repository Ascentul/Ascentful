import { v } from 'convex/values';

import { mutation, query } from './_generated/server';

// Helper to get a setting by key
async function getSetting(ctx: any, key: string, defaultValue: any) {
  const setting = await ctx.db
    .query('platform_settings')
    .withIndex('by_setting_key', (q: any) => q.eq('setting_key', key))
    .unique();
  return setting ? setting.setting_value : defaultValue;
}

// Platform settings for configurable system-wide preferences
export const getPlatformSettings = query({
  args: {},
  handler: async (ctx) => {
    return {
      // AI Settings
      openai_model: await getSetting(ctx, 'openai_model', process.env.OPENAI_MODEL || 'gpt-5'),
      openai_temperature: await getSetting(ctx, 'openai_temperature', 0.7),
      openai_max_tokens: await getSetting(ctx, 'openai_max_tokens', 4000),
      openai_enabled: await getSetting(ctx, 'openai_enabled', true),
      rate_limit_enabled: await getSetting(ctx, 'rate_limit_enabled', true),
      rate_limit_requests: await getSetting(ctx, 'rate_limit_requests', 100),
      rate_limit_window: await getSetting(ctx, 'rate_limit_window', 3600),

      // System Settings
      maintenance_mode: await getSetting(ctx, 'maintenance_mode', false),
      allow_signups: await getSetting(ctx, 'allow_signups', true),
      email_verification_required: await getSetting(ctx, 'email_verification_required', true),
      session_timeout: await getSetting(ctx, 'session_timeout', 24),
      max_file_upload_size: await getSetting(ctx, 'max_file_upload_size', 10),
      debug_mode: await getSetting(ctx, 'debug_mode', false),
      default_user_role: await getSetting(ctx, 'default_user_role', 'individual'),

      // General Settings
      platform_name: await getSetting(ctx, 'platform_name', 'Ascentul'),
      support_email: await getSetting(ctx, 'support_email', 'support@ascentful.io'),
      base_url: await getSetting(ctx, 'base_url', 'https://app.ascentful.io'),
      default_timezone: await getSetting(ctx, 'default_timezone', 'UTC'),
      university_plan_limit: await getSetting(ctx, 'university_plan_limit', 1000),
      premium_plan_limit: await getSetting(ctx, 'premium_plan_limit', 100),

      // Security Settings
      two_factor_required: await getSetting(ctx, 'two_factor_required', false),
      password_complexity: await getSetting(ctx, 'password_complexity', 'medium'),
      login_attempt_limit: await getSetting(ctx, 'login_attempt_limit', 5),
      ip_whitelist_enabled: await getSetting(ctx, 'ip_whitelist_enabled', false),
      audit_logging: await getSetting(ctx, 'audit_logging', true),
      session_encryption: await getSetting(ctx, 'session_encryption', true),

      // Notification Settings
      email_notifications: await getSetting(ctx, 'email_notifications', true),
      slack_integration: await getSetting(ctx, 'slack_integration', false),
      slack_webhook_url: await getSetting(ctx, 'slack_webhook_url', ''),
      critical_alerts_only: await getSetting(ctx, 'critical_alerts_only', false),
      daily_reports: await getSetting(ctx, 'daily_reports', true),
      weekly_analytics: await getSetting(ctx, 'weekly_analytics', true),
    };
  },
});

// Helper to upsert a setting
async function upsertSetting(ctx: any, key: string, value: any) {
  const existing = await ctx.db
    .query('platform_settings')
    .withIndex('by_setting_key', (q: any) => q.eq('setting_key', key))
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      setting_value: value,
      updated_at: Date.now(),
    });
  } else {
    await ctx.db.insert('platform_settings', {
      setting_key: key,
      setting_value: value,
      created_at: Date.now(),
      updated_at: Date.now(),
    });
  }
}

// Update platform settings (admin only)
export const updatePlatformSettings = mutation({
  args: {
    clerkId: v.string(),
    settings: v.any(), // Accept any settings object to be flexible
  },
  handler: async (ctx, args) => {
    const currentUser = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!currentUser) throw new Error('User not found');

    const isAdmin = currentUser.role === 'super_admin';
    if (!isAdmin) throw new Error('Unauthorized - Super Admin access required');

    // Save each setting to database
    for (const [key, value] of Object.entries(args.settings)) {
      if (value !== undefined) {
        await upsertSetting(ctx, key, value);
      }
    }

    return {
      success: true,
      message: 'Settings updated successfully',
    };
  },
});

// Get available OpenAI models
export const getAvailableOpenAIModels = query({
  args: {},
  handler: async (ctx) => {
    return [
      {
        id: 'gpt-5',
        name: 'GPT-5',
        description:
          'Most intelligent model, best for complex reasoning, coding, and agentic tasks',
        cost_per_1k_tokens: 0.0125, // $1.25 per million input tokens
        max_tokens: 32768,
      },
      {
        id: 'gpt-5-mini',
        name: 'GPT-5 Mini',
        description: 'Cost-optimized reasoning and chat, balances speed, cost, and capability',
        cost_per_1k_tokens: 0.004,
        max_tokens: 16384,
      },
      {
        id: 'gpt-5-nano',
        name: 'GPT-5 Nano',
        description: 'High-throughput for simple instruction-following or classification',
        cost_per_1k_tokens: 0.001,
        max_tokens: 8192,
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: 'Previous generation model with multimodal capabilities',
        cost_per_1k_tokens: 0.03,
        max_tokens: 4096,
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: 'Legacy cost-effective variant',
        cost_per_1k_tokens: 0.0015,
        max_tokens: 4096,
      },
    ];
  },
});
