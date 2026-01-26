/**
 * Dev utility: Seed queue items for testing
 *
 * Usage:
 *   npx convex run dev/seedQueueItems:seed '{"universityId": "k17..."}'
 *
 * Or to seed for all students in a university:
 *   npx convex run dev/seedQueueItems:seedForUniversity '{"universitySlug": "acme-university"}'
 *
 * To clear all queue items:
 *   npx convex run dev/seedQueueItems:clearQueueItems '{"universityId": "k17..."}'
 */

import { v } from 'convex/values';

import { Id } from '../_generated/dataModel';
import { internalMutation, internalQuery } from '../_generated/server';

// Queue item templates for seeding
const QUEUE_ITEM_TEMPLATES = [
  // P1 - Urgent (15 items)
  {
    title: 'URGENT: Student missed deadline',
    description: 'Application deadline was yesterday. Immediate outreach needed.',
    priority: 'P1' as const,
    created_from: 'signal' as const,
  },
  {
    title: 'No activity in 14+ days',
    description: 'Student has not logged in or updated applications in over 2 weeks.',
    priority: 'P1' as const,
    created_from: 'signal' as const,
  },
  {
    title: 'Resume feedback overdue',
    description: 'Student submitted resume 7 days ago, awaiting review.',
    priority: 'P1' as const,
    created_from: 'signal' as const,
  },
  {
    title: 'Interview prep needed',
    description: 'Student has interview scheduled in 3 days, needs preparation.',
    priority: 'P1' as const,
    created_from: 'manual' as const,
  },
  {
    title: 'Application rejection follow-up',
    description: 'Student received rejection, needs support and next steps.',
    priority: 'P1' as const,
    created_from: 'signal' as const,
  },
  {
    title: 'Graduation deadline approaching',
    description: 'Student graduating in 30 days with no job secured.',
    priority: 'P1' as const,
    created_from: 'signal' as const,
  },
  {
    title: 'Career fair follow-up urgent',
    description: 'Student met recruiters at career fair, needs to send thank-yous.',
    priority: 'P1' as const,
    created_from: 'manual' as const,
  },
  {
    title: 'Offer decision deadline',
    description: 'Student has offer expiring in 5 days, needs guidance.',
    priority: 'P1' as const,
    created_from: 'signal' as const,
  },
  {
    title: 'Job search stalled',
    description: 'No new applications in 10 days despite active search.',
    priority: 'P1' as const,
    created_from: 'signal' as const,
  },
  {
    title: 'Scholarship application deadline',
    description: 'Scholarship deadline in 1 week, materials incomplete.',
    priority: 'P1' as const,
    created_from: 'manual' as const,
  },
  {
    title: 'Visa status concern',
    description: 'International student needs employment before OPT deadline.',
    priority: 'P1' as const,
    created_from: 'signal' as const,
  },
  {
    title: 'Failed background check follow-up',
    description: 'Employer flagged issue with background check.',
    priority: 'P1' as const,
    created_from: 'signal' as const,
  },
  {
    title: 'Mental health check-in needed',
    description: 'Student expressed frustration in last session.',
    priority: 'P1' as const,
    created_from: 'manual' as const,
  },
  {
    title: 'Reference letter deadline',
    description: 'Student needs reference letter submitted by Friday.',
    priority: 'P1' as const,
    created_from: 'manual' as const,
  },
  {
    title: 'Networking event RSVP',
    description: 'Industry networking event tomorrow, student should attend.',
    priority: 'P1' as const,
    created_from: 'signal' as const,
  },

  // P2 - Normal (20 items)
  {
    title: 'Cover letter review',
    description: 'Student submitted cover letter for review.',
    priority: 'P2' as const,
    created_from: 'signal' as const,
  },
  {
    title: 'Weekly check-in due',
    description: 'Scheduled weekly check-in with student.',
    priority: 'P2' as const,
    created_from: 'signal' as const,
  },
  {
    title: 'LinkedIn profile optimization',
    description: 'Student profile needs updates for job search.',
    priority: 'P2' as const,
    created_from: 'manual' as const,
  },
  {
    title: 'Career exploration session',
    description: 'Student unsure about career direction.',
    priority: 'P2' as const,
    created_from: 'manual' as const,
  },
  {
    title: 'Mock interview scheduled',
    description: 'Practice interview session coming up.',
    priority: 'P2' as const,
    created_from: 'manual' as const,
  },
  {
    title: 'Application strategy review',
    description: 'Review application approach and target companies.',
    priority: 'P2' as const,
    created_from: 'signal' as const,
  },
  {
    title: 'Skills gap assessment',
    description: 'Identify skills to develop for target roles.',
    priority: 'P2' as const,
    created_from: 'manual' as const,
  },
  {
    title: 'Portfolio review needed',
    description: 'Student portfolio needs feedback.',
    priority: 'P2' as const,
    created_from: 'signal' as const,
  },
  {
    title: 'Salary negotiation prep',
    description: 'Student received offer, needs negotiation guidance.',
    priority: 'P2' as const,
    created_from: 'manual' as const,
  },
  {
    title: 'Industry research support',
    description: 'Help student research target industry.',
    priority: 'P2' as const,
    created_from: 'manual' as const,
  },
  {
    title: 'Application materials update',
    description: 'Resume and cover letter templates need refresh.',
    priority: 'P2' as const,
    created_from: 'signal' as const,
  },
  {
    title: 'Networking strategy session',
    description: 'Develop networking approach for student.',
    priority: 'P2' as const,
    created_from: 'manual' as const,
  },
  {
    title: 'Career fair preparation',
    description: 'Prep student for upcoming career fair.',
    priority: 'P2' as const,
    created_from: 'signal' as const,
  },
  {
    title: 'Follow-up email review',
    description: 'Review thank-you and follow-up emails.',
    priority: 'P2' as const,
    created_from: 'manual' as const,
  },
  {
    title: 'Job board training',
    description: 'Teach student effective job board usage.',
    priority: 'P2' as const,
    created_from: 'manual' as const,
  },
  {
    title: 'Application tracking setup',
    description: 'Help student organize job search tracking.',
    priority: 'P2' as const,
    created_from: 'manual' as const,
  },
  {
    title: 'Industry mentor match',
    description: 'Connect student with industry mentor.',
    priority: 'P2' as const,
    created_from: 'manual' as const,
  },
  {
    title: 'Elevator pitch practice',
    description: 'Help student develop personal pitch.',
    priority: 'P2' as const,
    created_from: 'manual' as const,
  },
  {
    title: 'Professional branding review',
    description: 'Review online presence and branding.',
    priority: 'P2' as const,
    created_from: 'manual' as const,
  },
  {
    title: 'Goal setting session',
    description: 'Quarterly goal review and setting.',
    priority: 'P2' as const,
    created_from: 'signal' as const,
  },

  // P3 - Low (15 items)
  {
    title: 'Resource recommendations',
    description: 'Share career development resources.',
    priority: 'P3' as const,
    created_from: 'manual' as const,
  },
  {
    title: 'Alumni connection intro',
    description: 'Introduce to relevant alumni contact.',
    priority: 'P3' as const,
    created_from: 'manual' as const,
  },
  {
    title: 'Workshop registration',
    description: 'Encourage signup for upcoming workshop.',
    priority: 'P3' as const,
    created_from: 'signal' as const,
  },
  {
    title: 'Career assessment follow-up',
    description: 'Discuss results of career assessment.',
    priority: 'P3' as const,
    created_from: 'signal' as const,
  },
  {
    title: 'Professional development plan',
    description: 'Long-term development planning.',
    priority: 'P3' as const,
    created_from: 'manual' as const,
  },
  {
    title: 'Industry event recommendation',
    description: 'Suggest relevant industry events.',
    priority: 'P3' as const,
    created_from: 'signal' as const,
  },
  {
    title: 'Certificate program info',
    description: 'Share info about relevant certifications.',
    priority: 'P3' as const,
    created_from: 'manual' as const,
  },
  {
    title: 'Internship program awareness',
    description: 'Inform about new internship opportunities.',
    priority: 'P3' as const,
    created_from: 'signal' as const,
  },
  {
    title: 'Book/article recommendation',
    description: 'Share career-related reading material.',
    priority: 'P3' as const,
    created_from: 'manual' as const,
  },
  {
    title: 'Online course suggestion',
    description: 'Recommend skill-building courses.',
    priority: 'P3' as const,
    created_from: 'manual' as const,
  },
  {
    title: 'Company research sharing',
    description: 'Share insights about target companies.',
    priority: 'P3' as const,
    created_from: 'manual' as const,
  },
  {
    title: 'Interview resource packet',
    description: 'Send interview preparation materials.',
    priority: 'P3' as const,
    created_from: 'manual' as const,
  },
  {
    title: 'Peer mentorship opportunity',
    description: 'Connect with peer mentor program.',
    priority: 'P3' as const,
    created_from: 'manual' as const,
  },
  {
    title: 'Success story sharing',
    description: 'Share inspirational alumni stories.',
    priority: 'P3' as const,
    created_from: 'manual' as const,
  },
  {
    title: 'Career newsletter signup',
    description: 'Encourage newsletter subscription.',
    priority: 'P3' as const,
    created_from: 'signal' as const,
  },
];

/**
 * List students and advisors in a university for seeding
 */
export const listUniversityUsers = internalQuery({
  args: {
    universityId: v.id('universities'),
  },
  handler: async (ctx, args) => {
    const students = await ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
      .filter((q) => q.eq(q.field('role'), 'student'))
      .collect();

    const advisors = await ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
      .filter((q) =>
        q.or(q.eq(q.field('role'), 'advisor'), q.eq(q.field('role'), 'university_admin')),
      )
      .collect();

    return {
      students: students.map((s) => ({
        id: s._id,
        email: s.email,
        name: s.name,
      })),
      advisors: advisors.map((a) => ({
        id: a._id,
        email: a.email,
        name: a.name,
        role: a.role,
      })),
    };
  },
});

/**
 * Seed queue items for a specific university
 * Creates 50+ queue items distributed across students
 */
export const seedForUniversity = internalMutation({
  args: {
    universitySlug: v.optional(v.string()),
    universityId: v.optional(v.id('universities')),
    itemCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Find university
    let university;
    if (args.universityId) {
      university = await ctx.db.get(args.universityId);
    } else if (args.universitySlug) {
      university = await ctx.db
        .query('universities')
        .filter((q) => q.eq(q.field('slug'), args.universitySlug))
        .unique();
    }

    if (!university) {
      throw new Error('University not found. Provide universityId or universitySlug.');
    }

    // Get students in university
    const students = await ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', university._id))
      .filter((q) => q.eq(q.field('role'), 'student'))
      .collect();

    if (students.length === 0) {
      throw new Error('No students found in this university');
    }

    // Get advisors for assignment
    const advisors = await ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', university._id))
      .filter((q) =>
        q.or(q.eq(q.field('role'), 'advisor'), q.eq(q.field('role'), 'university_admin')),
      )
      .collect();

    const targetCount = args.itemCount || 50;
    const now = Date.now();
    let created = 0;

    // Create queue items
    for (let i = 0; i < targetCount; i++) {
      const template = QUEUE_ITEM_TEMPLATES[i % QUEUE_ITEM_TEMPLATES.length];
      const student = students[i % students.length];
      const advisor = advisors.length > 0 ? advisors[i % advisors.length] : null;

      // Random status distribution: 70% OPEN, 20% IN_PROGRESS, 10% RESOLVED
      const statusRand = Math.random();
      let status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' = 'OPEN';
      if (statusRand > 0.9) status = 'RESOLVED';
      else if (statusRand > 0.7) status = 'IN_PROGRESS';

      // Random age: 0-14 days ago
      const ageMs = Math.floor(Math.random() * 14 * 24 * 60 * 60 * 1000);
      const createdAt = now - ageMs;

      // Some items snoozed (10%)
      const isSnoozed = Math.random() < 0.1 && status === 'OPEN';
      const snoozeUntil = isSnoozed
        ? now + Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)
        : undefined;

      const queueItemId = await ctx.db.insert('queue_items', {
        university_id: university._id,
        student_id: student._id,
        owner_id: advisor?._id,
        status,
        priority: template.priority,
        created_from: template.created_from,
        title: template.title,
        description: template.description,
        snoozed_until: snoozeUntil,
        closed_reason:
          status === 'RESOLVED' ? 'Student contacted and next steps established.' : undefined,
        closed_at: status === 'RESOLVED' ? now : undefined,
        closed_by: status === 'RESOLVED' && advisor ? advisor._id : undefined,
        version: 0,
        created_at: createdAt,
        updated_at: now,
      });

      // Create initial action
      await ctx.db.insert('queue_item_actions', {
        queue_item_id: queueItemId,
        actor_id: advisor?._id || student._id,
        action_type: 'created',
        notes: template.created_from === 'signal' ? 'Auto-created from signal' : 'Manually created',
        created_at: createdAt,
      });

      // Add some additional actions for variety
      if (status === 'IN_PROGRESS' || status === 'RESOLVED') {
        await ctx.db.insert('queue_item_actions', {
          queue_item_id: queueItemId,
          actor_id: advisor?._id || student._id,
          action_type: 'contacted',
          notes: 'Reached out via email.',
          created_at: createdAt + 60 * 60 * 1000, // 1 hour later
        });
      }

      if (status === 'RESOLVED') {
        await ctx.db.insert('queue_item_actions', {
          queue_item_id: queueItemId,
          actor_id: advisor?._id || student._id,
          action_type: 'resolved',
          notes: 'Follow-up completed.',
          previous_value: { status: 'IN_PROGRESS' },
          new_value: { status: 'RESOLVED' },
          created_at: now,
        });
      }

      if (isSnoozed) {
        const snoozeActionAt = Math.max(createdAt, now - 60 * 60 * 1000);
        await ctx.db.insert('queue_item_actions', {
          queue_item_id: queueItemId,
          actor_id: advisor?._id || student._id,
          action_type: 'snoozed',
          notes: 'Waiting for student response.',
          new_value: { snoozedUntil: snoozeUntil },
          created_at: snoozeActionAt,
        });
      }

      created++;
    }

    return {
      success: true,
      universityId: university._id,
      universityName: university.name,
      created,
      studentCount: students.length,
      advisorCount: advisors.length,
    };
  },
});

/**
 * Clear all queue items for a university
 */
export const clearQueueItems = internalMutation({
  args: {
    universityId: v.id('universities'),
  },
  handler: async (ctx, args) => {
    // Get all queue items
    const items = await ctx.db
      .query('queue_items')
      .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
      .collect();

    let deletedItems = 0;
    let deletedActions = 0;

    for (const item of items) {
      // Delete associated actions first
      const actions = await ctx.db
        .query('queue_item_actions')
        .withIndex('by_queue_item', (q) => q.eq('queue_item_id', item._id))
        .collect();

      for (const action of actions) {
        await ctx.db.delete(action._id);
        deletedActions++;
      }

      await ctx.db.delete(item._id);
      deletedItems++;
    }

    return {
      success: true,
      deletedItems,
      deletedActions,
    };
  },
});

/**
 * Get queue item counts for a university
 */
export const getQueueStats = internalQuery({
  args: {
    universityId: v.id('universities'),
  },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query('queue_items')
      .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
      .collect();

    const now = Date.now();

    return {
      total: items.length,
      byStatus: {
        OPEN: items.filter((i) => i.status === 'OPEN').length,
        IN_PROGRESS: items.filter((i) => i.status === 'IN_PROGRESS').length,
        RESOLVED: items.filter((i) => i.status === 'RESOLVED').length,
        CLOSED: items.filter((i) => i.status === 'CLOSED').length,
      },
      byPriority: {
        P1: items.filter((i) => i.priority === 'P1').length,
        P2: items.filter((i) => i.priority === 'P2').length,
        P3: items.filter((i) => i.priority === 'P3').length,
      },
      snoozed: items.filter((i) => i.snoozed_until && i.snoozed_until > now).length,
    };
  },
});
