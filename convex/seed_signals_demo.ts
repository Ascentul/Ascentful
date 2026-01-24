/**
 * Seed Script: Engagement Signals Demo Data
 *
 * Creates demo data for the Engagement Signals system:
 * - Engagement definitions
 * - Signal rules
 * - Sample signals
 *
 * Usage:
 *   npx convex run seed_signals_demo:seedSignalsDemo --args '{"universityId": "<id>", "adminUserId": "<id>"}'
 *
 * Or run via the Convex dashboard.
 */

import { v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { internalMutation } from './_generated/server';

export const seedSignalsDemo = internalMutation({
  args: {
    universityId: v.id('universities'),
    adminUserId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const results = {
      engagementDefinitions: [] as Id<'engagement_definitions'>[],
      signalRules: [] as Id<'signal_rules'>[],
      signals: [] as Id<'signals'>[],
      activityEvents: [] as Id<'activity_events'>[],
    };

    console.log('Starting Engagement Signals demo seed...');

    // =========================================================================
    // 1. Create Engagement Definitions
    // =========================================================================
    console.log('Creating engagement definitions...');

    // Default Weekly Active Definition with qualifying event types
    const weeklyActiveDefId = await ctx.db.insert('engagement_definitions', {
      university_id: args.universityId,
      name: 'Weekly Active',
      description:
        'Students are considered engaged based on their qualifying activities in the past 14 days.',
      criteria: {
        qualifying_event_types: [
          'login',
          'application_created',
          'application_updated',
          'application_stage_changed',
          'resume_created',
          'resume_updated',
          'goal_created',
          'goal_updated',
          'goal_completed',
          'coach_conversation_started',
          'coach_message_sent',
        ],
        qualifying_event_categories: ['application', 'document'],
        period_days: 14,
        min_events_in_period: 3,
        min_logins_per_week: 2,
        min_applications_active: 0,
      },
      engaged_threshold: 70,
      at_risk_threshold: 30,
      applies_to: 'all_students' as const,
      is_active: true,
      is_default: true,
      created_by: args.adminUserId,
      created_at: now,
      updated_at: now,
    });
    results.engagementDefinitions.push(weeklyActiveDefId);

    // Application Focused Definition
    const applicationFocusedDefId = await ctx.db.insert('engagement_definitions', {
      university_id: args.universityId,
      name: 'Application Focused',
      description:
        'Measures engagement based on active job applications and application-related activities.',
      criteria: {
        min_logins_per_week: 1,
        min_actions_per_week: 3,
        min_applications_active: 3,
        max_days_since_activity: 21,
      },
      engaged_threshold: 60,
      at_risk_threshold: 25,
      applies_to: 'all_students' as const,
      is_active: true,
      is_default: false,
      created_by: args.adminUserId,
      created_at: now,
      updated_at: now,
    });
    results.engagementDefinitions.push(applicationFocusedDefId);

    // Seniors Definition
    const seniorsDefId = await ctx.db.insert('engagement_definitions', {
      university_id: args.universityId,
      name: 'Senior Year Engagement',
      description: 'Higher expectations for seniors approaching graduation.',
      criteria: {
        min_logins_per_week: 3,
        min_actions_per_week: 10,
        min_applications_active: 5,
        max_days_since_activity: 7,
      },
      engaged_threshold: 80,
      at_risk_threshold: 40,
      applies_to: 'by_year' as const,
      scope_filter: { years: ['Senior'] },
      is_active: true,
      is_default: false,
      created_by: args.adminUserId,
      created_at: now,
      updated_at: now,
    });
    results.engagementDefinitions.push(seniorsDefId);

    console.log(`Created ${results.engagementDefinitions.length} engagement definitions`);

    // =========================================================================
    // 2. Create Signal Rules
    // =========================================================================
    console.log('Creating signal rules...');

    // STALLED Rule - No qualifying activity
    const stalledRuleId = await ctx.db.insert('signal_rules', {
      university_id: args.universityId,
      name: 'Student Stalled',
      description: 'Triggers when a student has no qualifying activity for 14 days.',
      condition: {
        type: 'stalled',
        days: 14,
      },
      signal_type: 'needs_outreach' as const,
      priority: 'medium' as const,
      auto_create_followup: false,
      cooldown_days: 14,
      is_active: true,
      is_default: false,
      created_by: args.adminUserId,
      created_at: now,
      updated_at: now,
    });
    results.signalRules.push(stalledRuleId);

    // HIGH_INTENT_LOW_CONVERSION Rule
    const highIntentRuleId = await ctx.db.insert('signal_rules', {
      university_id: args.universityId,
      name: 'High Intent, Low Conversion',
      description:
        'Triggers when a student has 3+ applications but no advising appointment in 30 days.',
      condition: {
        type: 'high_intent_low_conversion',
        applications_threshold: 3,
        application_period_days: 14,
        appointment_days: 30,
      },
      signal_type: 'application_support' as const,
      priority: 'high' as const,
      auto_create_followup: true,
      followup_template: 'Schedule advising appointment to discuss application strategy.',
      cooldown_days: 14,
      is_active: true,
      is_default: false,
      created_by: args.adminUserId,
      created_at: now,
      updated_at: now,
    });
    results.signalRules.push(highIntentRuleId);

    // STAGE_STUCK Rule - Interview stage
    const stageStuckInterviewRuleId = await ctx.db.insert('signal_rules', {
      university_id: args.universityId,
      name: 'Interview Stage Stuck',
      description: 'Triggers when an application is stuck in Interview stage for 14+ days.',
      condition: {
        type: 'stage_stuck',
        stage: 'Interview',
        days: 14,
      },
      signal_type: 'application_support' as const,
      priority: 'high' as const,
      auto_create_followup: true,
      followup_template: 'Check in on interview progress and offer coaching.',
      cooldown_days: 7,
      is_active: true,
      is_default: false,
      created_by: args.adminUserId,
      created_at: now,
      updated_at: now,
    });
    results.signalRules.push(stageStuckInterviewRuleId);

    // Inactive 2 Weeks Rule (legacy inactivity type)
    const inactive2WeeksRuleId = await ctx.db.insert('signal_rules', {
      university_id: args.universityId,
      name: 'Inactive for 2 Weeks',
      description: 'Triggers when a student has no platform activity for 14 days.',
      condition: {
        type: 'inactivity',
        days: 14,
      },
      signal_type: 'needs_outreach' as const,
      priority: 'medium' as const,
      auto_create_followup: false,
      cooldown_days: 14,
      is_active: true,
      is_default: false,
      created_by: args.adminUserId,
      created_at: now,
      updated_at: now,
    });
    results.signalRules.push(inactive2WeeksRuleId);

    // Inactive 1 Month Rule (High Priority)
    const inactive1MonthRuleId = await ctx.db.insert('signal_rules', {
      university_id: args.universityId,
      name: 'Inactive for 1 Month',
      description:
        'Triggers when a student has no platform activity for 30 days. High priority outreach needed.',
      condition: {
        type: 'inactivity',
        days: 30,
      },
      signal_type: 'needs_outreach' as const,
      priority: 'high' as const,
      auto_create_followup: true,
      followup_template: 'Schedule a check-in meeting with the student.',
      cooldown_days: 21,
      is_active: true,
      is_default: false,
      created_by: args.adminUserId,
      created_at: now,
      updated_at: now,
    });
    results.signalRules.push(inactive1MonthRuleId);

    // Interview Stall Rule
    const interviewStallRuleId = await ctx.db.insert('signal_rules', {
      university_id: args.universityId,
      name: 'Interview Stage Stall',
      description:
        'Triggers when an application has been at Interview stage for 14+ days without progress.',
      condition: {
        type: 'application_stall',
        stage: 'Interview',
        days: 14,
      },
      signal_type: 'application_support' as const,
      priority: 'high' as const,
      auto_create_followup: true,
      followup_template: 'Check in on interview progress and offer support.',
      cooldown_days: 7,
      is_active: true,
      is_default: false,
      created_by: args.adminUserId,
      created_at: now,
      updated_at: now,
    });
    results.signalRules.push(interviewStallRuleId);

    // Offer Pending Rule (Urgent)
    const offerPendingRuleId = await ctx.db.insert('signal_rules', {
      university_id: args.universityId,
      name: 'Offer Pending Too Long',
      description: 'Urgent: Student has an offer pending for 7+ days without a decision.',
      condition: {
        type: 'application_stall',
        stage: 'Offer',
        days: 7,
      },
      signal_type: 'milestone_check' as const,
      priority: 'urgent' as const,
      auto_create_followup: true,
      followup_template: 'URGENT: Discuss offer decision timeline with student.',
      cooldown_days: 3,
      is_active: true,
      is_default: false,
      created_by: args.adminUserId,
      created_at: now,
      updated_at: now,
    });
    results.signalRules.push(offerPendingRuleId);

    // Multiple Rejections Rule
    const rejectionsRuleId = await ctx.db.insert('signal_rules', {
      university_id: args.universityId,
      name: 'Multiple Rejections, No Offers',
      description:
        'Triggers when student has 5+ rejections but no offers. May need resume/strategy review.',
      condition: {
        type: 'no_progress',
        rejections_min: 5,
        offers: 0,
      },
      signal_type: 'application_support' as const,
      priority: 'high' as const,
      auto_create_followup: true,
      followup_template: 'Review application strategy and materials with student.',
      cooldown_days: 14,
      is_active: true,
      is_default: false,
      created_by: args.adminUserId,
      created_at: now,
      updated_at: now,
    });
    results.signalRules.push(rejectionsRuleId);

    // Engagement Drop Rule
    const engagementDropRuleId = await ctx.db.insert('signal_rules', {
      university_id: args.universityId,
      name: 'Engagement Dropped to At-Risk',
      description: 'Triggers when student engagement level drops from engaged to at-risk.',
      condition: {
        type: 'engagement_drop',
        from: 'engaged',
        to: 'at_risk',
      },
      signal_type: 'needs_outreach' as const,
      priority: 'medium' as const,
      auto_create_followup: false,
      cooldown_days: 7,
      is_active: true,
      is_default: false,
      created_by: args.adminUserId,
      created_at: now,
      updated_at: now,
    });
    results.signalRules.push(engagementDropRuleId);

    console.log(`Created ${results.signalRules.length} signal rules`);

    // =========================================================================
    // 3. Create Activity Events for Students
    // =========================================================================
    console.log('Looking for students to create activity events...');

    // Get students from this university
    const students = await ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
      .filter((q) => q.eq(q.field('role'), 'student'))
      .take(20);

    const activityEventsCreated: Id<'activity_events'>[] = [];

    if (students.length > 0) {
      console.log(`Found ${students.length} students, creating activity events...`);

      const eventTypes = [
        { type: 'login', category: 'auth' },
        { type: 'application_created', category: 'application' },
        { type: 'application_updated', category: 'application' },
        { type: 'application_stage_changed', category: 'application' },
        { type: 'resume_created', category: 'document' },
        { type: 'resume_updated', category: 'document' },
        { type: 'goal_created', category: 'goal' },
        { type: 'goal_completed', category: 'goal' },
        { type: 'coach_conversation_started', category: 'ai_coach' },
      ];

      // Create varied activity patterns for different engagement levels
      for (let i = 0; i < students.length; i++) {
        const student = students[i];

        // Determine engagement pattern based on index
        let eventCount: number;
        let daySpread: number;

        if (i < students.length * 0.4) {
          // 40% are engaged - lots of recent activity
          eventCount = 8 + Math.floor(Math.random() * 10);
          daySpread = 7; // Events in last 7 days
        } else if (i < students.length * 0.75) {
          // 35% are moderate - some activity
          eventCount = 3 + Math.floor(Math.random() * 4);
          daySpread = 14; // Events spread over 14 days
        } else {
          // 25% are at-risk - minimal or no activity
          eventCount = Math.floor(Math.random() * 2);
          daySpread = 30; // Old events only
        }

        for (let e = 0; e < eventCount; e++) {
          const eventDef = eventTypes[Math.floor(Math.random() * eventTypes.length)];
          const daysAgo = Math.floor(Math.random() * daySpread);
          const eventTime =
            now - daysAgo * 24 * 60 * 60 * 1000 - Math.floor(Math.random() * 12 * 60 * 60 * 1000);

          const eventId = await ctx.db.insert('activity_events', {
            user_id: student._id,
            event_type: eventDef.type,
            event_category: eventDef.category,
            timestamp: eventTime,
            metadata: {
              source: 'seed_script',
              seeded_at: now,
            },
          });
          activityEventsCreated.push(eventId);
        }
      }

      console.log(
        `Created ${activityEventsCreated.length} activity events for ${students.length} students`,
      );
    }

    // Track activity events created
    results.activityEvents = activityEventsCreated;

    // =========================================================================
    // 4. Create Sample Signals (if students exist)
    // =========================================================================
    if (students.length > 0) {
      console.log(`Creating sample signals for ${students.length} students...`);

      // Create STALLED signals for at-risk students (last 25%)
      const atRiskStartIdx = Math.floor(students.length * 0.75);
      for (let i = atRiskStartIdx; i < students.length; i++) {
        const student = students[i];
        const daysInactive = 15 + Math.floor(Math.random() * 30);
        const signalId = await ctx.db.insert('signals', {
          university_id: args.universityId,
          student_id: student._id,
          rule_id: stalledRuleId,
          source: 'rule' as const,
          signal_type: 'needs_outreach' as const,
          title: 'Student Stalled',
          description: `${student.name || 'This student'} has had no qualifying activity for ${daysInactive} days.`,
          priority: 'medium' as const,
          status: 'active' as const,
          context_snapshot: {
            condition_type: 'stalled',
            days_since_activity: daysInactive,
            threshold_days: 14,
          },
          triggered_at: now - Math.random() * 7 * 24 * 60 * 60 * 1000,
          created_at: now,
          updated_at: now,
        });
        results.signals.push(signalId);
      }

      // Create HIGH_INTENT_LOW_CONVERSION signals for some moderate students
      const moderateStartIdx = Math.floor(students.length * 0.4);
      const moderateEndIdx = Math.floor(students.length * 0.6);
      for (let i = moderateStartIdx; i < moderateEndIdx && i < students.length; i++) {
        const student = students[i];
        const appCount = 3 + Math.floor(Math.random() * 5);
        const signalId = await ctx.db.insert('signals', {
          university_id: args.universityId,
          student_id: student._id,
          rule_id: highIntentRuleId,
          source: 'rule' as const,
          signal_type: 'application_support' as const,
          title: 'High Intent, Low Conversion',
          description: `${student.name || 'This student'} has ${appCount} applications but no advising appointment.`,
          priority: 'high' as const,
          status: 'active' as const,
          context_snapshot: {
            condition_type: 'high_intent_low_conversion',
            application_count: appCount,
            appointment_days: 30,
          },
          triggered_at: now - Math.random() * 5 * 24 * 60 * 60 * 1000,
          created_at: now,
          updated_at: now,
        });
        results.signals.push(signalId);
      }

      // Create STAGE_STUCK signals for a few students
      if (students.length >= 3) {
        const stuckStudents = students.slice(1, 4);
        for (const student of stuckStudents) {
          const daysStuck = 14 + Math.floor(Math.random() * 10);
          const signalId = await ctx.db.insert('signals', {
            university_id: args.universityId,
            student_id: student._id,
            rule_id: stageStuckInterviewRuleId,
            source: 'rule' as const,
            signal_type: 'application_support' as const,
            title: 'Interview Stage Stuck',
            description: `${student.name || 'This student'} has an application stuck in Interview stage for ${daysStuck} days.`,
            priority: 'high' as const,
            status: 'active' as const,
            context_snapshot: {
              condition_type: 'stage_stuck',
              longest_stuck: {
                company: 'Acme Corp',
                stage: 'Interview',
                days_stuck: daysStuck,
              },
              stuck_applications: 1,
            },
            triggered_at: now - Math.random() * 3 * 24 * 60 * 60 * 1000,
            created_at: now,
            updated_at: now,
          });
          results.signals.push(signalId);
        }
      }

      // Create one urgent signal (Offer Pending)
      if (students.length > 0) {
        const urgentSignalId = await ctx.db.insert('signals', {
          university_id: args.universityId,
          student_id: students[0]._id,
          rule_id: offerPendingRuleId,
          source: 'rule' as const,
          signal_type: 'milestone_check' as const,
          title: 'Offer Pending Too Long',
          description: `${students[0].name || 'This student'} has had an offer pending for over 7 days.`,
          priority: 'urgent' as const,
          status: 'active' as const,
          triggered_at: now - 2 * 24 * 60 * 60 * 1000,
          created_at: now,
          updated_at: now,
        });
        results.signals.push(urgentSignalId);
      }

      console.log(`Created ${results.signals.length} sample signals`);
    } else {
      console.log(
        'No students found in this university, skipping sample signals and activity events',
      );
    }

    // =========================================================================
    // Summary
    // =========================================================================
    console.log('\n=== Seed Complete ===');
    console.log(`Engagement Definitions: ${results.engagementDefinitions.length}`);
    console.log(`Signal Rules: ${results.signalRules.length}`);
    console.log(`Activity Events: ${results.activityEvents.length}`);
    console.log(`Sample Signals: ${results.signals.length}`);

    return results;
  },
});

/**
 * Cleanup function to remove seeded demo data.
 *
 * SAFETY: This will delete ALL signals, rules, and definitions for the university.
 * Only runs on test universities (is_test: true) to prevent accidental data loss.
 * For activity events, only seeded records (with source: 'seed_script') are deleted.
 */
export const cleanupSignalsDemo = internalMutation({
  args: {
    universityId: v.id('universities'),
    forceDelete: v.optional(v.boolean()), // Override safety check - use with caution
  },
  handler: async (ctx, args) => {
    // Safety check: Only allow cleanup on test universities unless forced
    const university = await ctx.db.get(args.universityId);
    if (!university) {
      throw new Error('University not found');
    }

    if (!university.is_test && !args.forceDelete) {
      throw new Error(
        'Safety check: Cannot cleanup signals demo on a non-test university. ' +
          'This would delete ALL signals, rules, and definitions. ' +
          'Set forceDelete: true to override (use with extreme caution).',
      );
    }

    if (args.forceDelete && !university.is_test) {
      console.warn('⚠️ WARNING: Force deleting demo data on non-test university!');
    }

    console.log('Cleaning up Engagement Signals demo data...');

    // Delete signals
    const signals = await ctx.db
      .query('signals')
      .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
      .collect();
    for (const signal of signals) {
      await ctx.db.delete(signal._id);
    }
    console.log(`Deleted ${signals.length} signals`);

    // Delete signal rules
    const rules = await ctx.db
      .query('signal_rules')
      .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
      .collect();
    for (const rule of rules) {
      await ctx.db.delete(rule._id);
    }
    console.log(`Deleted ${rules.length} signal rules`);

    // Delete engagement definitions
    const definitions = await ctx.db
      .query('engagement_definitions')
      .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
      .collect();
    for (const def of definitions) {
      await ctx.db.delete(def._id);
    }
    console.log(`Deleted ${definitions.length} engagement definitions`);

    // Delete seeded activity events (only those with seed metadata)
    // Get students in this university to find their activity events
    const students = await ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
      .filter((q) => q.eq(q.field('role'), 'student'))
      .collect();

    let deletedActivityEvents = 0;
    for (const student of students) {
      const events = await ctx.db
        .query('activity_events')
        .withIndex('by_user', (q) => q.eq('user_id', student._id))
        .collect();

      // Only delete events that were seeded (have seed_script source)
      for (const event of events) {
        if (event.metadata && (event.metadata as any).source === 'seed_script') {
          await ctx.db.delete(event._id);
          deletedActivityEvents++;
        }
      }
    }
    console.log(`Deleted ${deletedActivityEvents} activity events`);

    console.log('Cleanup complete!');

    return {
      deletedSignals: signals.length,
      deletedRules: rules.length,
      deletedDefinitions: definitions.length,
      deletedActivityEvents,
    };
  },
});
