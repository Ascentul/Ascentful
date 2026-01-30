/**
 * Dev utility: Seed inbox threads and messages for testing
 *
 * Usage:
 *   npx convex run dev/seedInboxData:seed '{"universitySlug": "acme-university"}'
 *
 * To clear all inbox data:
 *   npx convex run dev/seedInboxData:clearInboxData '{"universitySlug": "acme-university"}'
 */

import { v } from 'convex/values';

import { internal } from '../_generated/api';
import { priorityRank, toDescTimestamp } from '../lib/inboxThreadUtils';
import { Id } from '../_generated/dataModel';
import { internalMutation, internalQuery } from '../_generated/server';

// Thread templates for seeding
const THREAD_TEMPLATES = [
  // Student-initiated threads
  {
    subject: 'Question about resume format',
    messages: [
      {
        body: 'Hi, I have a question about formatting my resume. Should I use one page or two?',
        sender_type: 'student' as const,
      },
      {
        body: "Great question! For most entry-level positions, stick to one page. I'd be happy to review your current draft.",
        sender_type: 'advisor' as const,
      },
      { body: "Thanks! I've attached my current version.", sender_type: 'student' as const },
    ],
    priority: 'P3' as const,
    status: 'IN_PROGRESS' as const,
  },
  {
    subject: 'Interview prep help needed',
    messages: [
      {
        body: "I have an interview at Google next week and I'm really nervous. Can we schedule a mock interview?",
        sender_type: 'student' as const,
      },
    ],
    priority: 'P1' as const,
    status: 'NEW' as const,
  },
  {
    subject: 'Internship application deadline',
    messages: [
      {
        body: "The McKinsey internship deadline is Friday. I'm not sure if my cover letter is strong enough.",
        sender_type: 'student' as const,
      },
      {
        body: "Let's review it today. Can you come by office hours at 2pm?",
        sender_type: 'advisor' as const,
      },
      { body: "Yes, I'll be there. Thank you!", sender_type: 'student' as const },
      {
        body: 'I reviewed your cover letter - nice work! Just a few suggestions...',
        sender_type: 'advisor' as const,
        is_internal: false,
      },
    ],
    priority: 'P2' as const,
    status: 'WAITING_ON_STUDENT' as const,
  },
  {
    subject: 'Job offer negotiation advice',
    messages: [
      {
        body: 'I received an offer from Deloitte! But the salary is lower than expected. How should I approach negotiation?',
        sender_type: 'student' as const,
      },
      {
        body: "Congratulations! Let's discuss strategy. What's the offer breakdown?",
        sender_type: 'advisor' as const,
      },
    ],
    priority: 'P1' as const,
    status: 'IN_PROGRESS' as const,
  },
  {
    subject: 'Career fair preparation',
    messages: [
      {
        body: 'Which companies should I prioritize at the career fair next week?',
        sender_type: 'student' as const,
      },
      {
        body: "Based on your interests, I'd recommend focusing on...",
        sender_type: 'advisor' as const,
      },
      {
        body: 'Student seemed overwhelmed during our call - follow up in person',
        sender_type: 'advisor' as const,
        is_internal: true,
      },
    ],
    priority: 'P2' as const,
    status: 'RESOLVED' as const,
  },
  {
    subject: 'LinkedIn profile review request',
    messages: [
      {
        body: "Can you take a look at my LinkedIn profile? I want to make sure it's recruiter-ready.",
        sender_type: 'student' as const,
      },
    ],
    priority: 'P3' as const,
    status: 'OPEN' as const,
  },
  {
    subject: 'Feeling stuck with job search',
    messages: [
      {
        body: "I've applied to 50+ jobs and haven't heard back from anyone. I'm feeling really discouraged.",
        sender_type: 'student' as const,
      },
      {
        body: "I understand this is frustrating. Let's review your application strategy together.",
        sender_type: 'advisor' as const,
      },
      {
        body: 'Flagging for wellness check - student seems very stressed',
        sender_type: 'advisor' as const,
        is_internal: true,
      },
    ],
    priority: 'P1' as const,
    status: 'IN_PROGRESS' as const,
  },
  {
    subject: 'Networking event follow-up',
    messages: [
      {
        body: 'I met some great people at the alumni event! How do I follow up without being annoying?',
        sender_type: 'student' as const,
      },
      {
        body: 'Great initiative! Send a personalized LinkedIn connection request within 24-48 hours...',
        sender_type: 'advisor' as const,
      },
    ],
    priority: 'P3' as const,
    status: 'RESOLVED' as const,
  },
  {
    subject: 'Grad school vs job decision',
    messages: [
      {
        body: "I got into Stanford's MBA program but also have a job offer. I don't know what to do.",
        sender_type: 'student' as const,
      },
      {
        body: "This is a great problem to have! Let's schedule a longer call to discuss pros and cons.",
        sender_type: 'advisor' as const,
      },
    ],
    priority: 'P2' as const,
    status: 'OPEN' as const,
  },
  {
    subject: 'Industry research help',
    messages: [
      {
        body: "I'm interested in product management but don't know where to start. Can you point me to some resources?",
        sender_type: 'student' as const,
      },
    ],
    priority: 'P3' as const,
    status: 'NEW' as const,
  },
];

// External sender templates (unmatched)
const EXTERNAL_SENDER_TEMPLATES: Array<{
  email: string;
  name: string | null;
  subject: string;
  messages: Array<{ body: string; sender_type: 'external' }>;
  priority: 'P1' | 'P2' | 'P3';
}> = [
  {
    email: 'john.smith.alum@gmail.com',
    name: 'John Smith',
    subject: 'Question from prospective student',
    messages: [
      {
        body: "Hi, I'm a prospective student interested in learning about career services. Can someone contact me?",
        sender_type: 'external',
      },
    ],
    priority: 'P3',
  },
  {
    email: 'parent.concerned@yahoo.com',
    name: null,
    subject: 'Parent inquiry about student services',
    messages: [
      {
        body: "My daughter mentioned she's struggling with job applications. Is there someone she can talk to?",
        sender_type: 'external',
      },
    ],
    priority: 'P2',
  },
];

/**
 * Get students and advisors in a university
 */
export const getUniversityUsers = internalQuery({
  args: {
    universityId: v.id('universities'),
  },
  handler: async (ctx, args) => {
    const students = await ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
      .filter((q) => q.eq(q.field('role'), 'student'))
      .take(30);

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
 * Get primary advisor for a student
 */
async function getPrimaryAdvisor(
  ctx: any,
  studentId: Id<'users'>,
): Promise<Id<'users'> | undefined> {
  const ownership = await ctx.db
    .query('student_advisors')
    .withIndex('by_student', (q: any) => q.eq('student_id', studentId))
    .filter((q: any) => q.eq(q.field('is_owner'), true))
    .first();

  return ownership?.advisor_id;
}

/**
 * Seed inbox data for a specific university
 */
export const seed = internalMutation({
  args: {
    universitySlug: v.optional(v.string()),
    universityId: v.optional(v.id('universities')),
    threadCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get university
    let universityId = args.universityId;
    if (!universityId && args.universitySlug) {
      const university = await ctx.db
        .query('universities')
        .withIndex('by_slug', (q) => q.eq('slug', args.universitySlug!))
        .unique();
      if (!university) {
        throw new Error(`University with slug "${args.universitySlug}" not found`);
      }
      universityId = university._id;
    }

    if (!universityId) {
      throw new Error('Either universityId or universitySlug is required');
    }

    // Get students and advisors
    const users = await ctx.runQuery(internal.dev.seedInboxData.getUniversityUsers, {
      universityId,
    });

    if (users.students.length === 0) {
      throw new Error('No students found in university');
    }

    if (users.advisors.length === 0) {
      throw new Error('No advisors found in university');
    }

    const now = Date.now();
    const threadCount = args.threadCount ?? 50;
    let createdCount = 0;

    // Create threads for students
    for (let i = 0; i < Math.min(threadCount, users.students.length * 3); i++) {
      const student = users.students[i % users.students.length];
      const template = THREAD_TEMPLATES[i % THREAD_TEMPLATES.length];
      const advisor = users.advisors[i % users.advisors.length];

      // Get primary advisor if available
      const primaryAdvisorId = await getPrimaryAdvisor(ctx, student.id);
      const assignedTo = primaryAdvisorId ?? advisor.id;

      // Randomize timestamps (within last 7 days)
      const createdOffset = Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000);
      const createdAt = now - createdOffset;

      // Calculate SLA based on priority
      const slaHours = template.priority === 'P1' ? 4 : template.priority === 'P2' ? 24 : 72;
      const slaDueAt = createdAt + slaHours * 60 * 60 * 1000;
      const slaBreached = slaDueAt < now && template.status !== 'RESOLVED';

      // Create thread
      const lastMessageAt = createdAt + (template.messages.length - 1) * 60 * 60 * 1000;
      const threadId = await ctx.db.insert('inbox_threads', {
        university_id: universityId,
        thread_type: 'student',
        student_id: student.id,
        identity_status: 'matched',
        subject: template.subject,
        snippet: template.messages[template.messages.length - 1].body.slice(0, 150),
        channel: 'in_app',
        status: template.status,
        assigned_to: assignedTo,
        assigned_at: createdAt,
        assigned_by: advisor.id,
        sla_due_at: slaDueAt,
        sla_breached: slaBreached,
        priority: template.priority,
        priority_rank: priorityRank(template.priority),
        message_count: template.messages.length,
        last_message_at: lastMessageAt,
        last_message_at_desc: toDescTimestamp(lastMessageAt),
        last_message_sender_type: template.messages[template.messages.length - 1].sender_type,
        has_unread: template.status === 'NEW' || template.status === 'OPEN',
        created_at: createdAt,
        updated_at: now,
      });

      // Create messages
      for (let j = 0; j < template.messages.length; j++) {
        const msg = template.messages[j];
        const messageCreatedAt = createdAt + j * 60 * 60 * 1000; // 1 hour apart

        await ctx.db.insert('inbox_messages', {
          thread_id: threadId,
          university_id: universityId,
          sender_type: msg.sender_type,
          sender_user_id: msg.sender_type === 'student' ? student.id : advisor.id,
          body: msg.body,
          channel: 'in_app',
          is_internal: (msg as any).is_internal ?? false,
          created_at: messageCreatedAt,
        });
      }

      // Create initial action
      await ctx.db.insert('inbox_thread_actions', {
        thread_id: threadId,
        actor_id: student.id,
        action_type: 'created',
        created_at: createdAt,
      });

      createdCount++;
    }

    // Create some unmatched (external) threads
    for (let i = 0; i < Math.min(5, users.advisors.length); i++) {
      const template = EXTERNAL_SENDER_TEMPLATES[i % EXTERNAL_SENDER_TEMPLATES.length];
      const advisor = users.advisors[i % users.advisors.length];

      const createdOffset = Math.floor(Math.random() * 3 * 24 * 60 * 60 * 1000);
      const createdAt = now - createdOffset;

      const slaHours = template.priority === 'P1' ? 4 : template.priority === 'P2' ? 24 : 72;
      const slaDueAt = createdAt + slaHours * 60 * 60 * 1000;

      const threadId = await ctx.db.insert('inbox_threads', {
        university_id: universityId,
        thread_type: 'student',
        identity_status: 'unmatched',
        external_sender_email: template.email,
        external_sender_name: template.name ?? undefined,
        subject: template.subject,
        snippet: template.messages[0].body.slice(0, 150),
        channel: 'email_other',
        status: 'NEW',
        sla_due_at: slaDueAt,
        sla_breached: false,
        priority: template.priority,
        priority_rank: priorityRank(template.priority),
        message_count: template.messages.length,
        last_message_at: createdAt,
        last_message_at_desc: toDescTimestamp(createdAt),
        last_message_sender_type: 'external',
        has_unread: true,
        created_at: createdAt,
        updated_at: now,
      });

      // Create message
      await ctx.db.insert('inbox_messages', {
        thread_id: threadId,
        university_id: universityId,
        sender_type: 'external',
        sender_email: template.email,
        sender_name: template.name ?? undefined,
        body: template.messages[0].body,
        channel: 'email_other',
        is_internal: false,
        created_at: createdAt,
      });

      // Create identity match record (pending)
      await ctx.db.insert('inbox_identity_matches', {
        thread_id: threadId,
        university_id: universityId,
        external_email: template.email,
        external_name: template.name ?? undefined,
        status: 'pending',
        created_at: createdAt,
        updated_at: now,
      });

      createdCount++;
    }

    return {
      success: true,
      createdThreads: createdCount,
      message: `Created ${createdCount} inbox threads with messages`,
    };
  },
});

/**
 * Clear all inbox data for a university
 */
export const clearInboxData = internalMutation({
  args: {
    universitySlug: v.optional(v.string()),
    universityId: v.optional(v.id('universities')),
  },
  handler: async (ctx, args) => {
    // Get university
    let universityId = args.universityId;
    if (!universityId && args.universitySlug) {
      const university = await ctx.db
        .query('universities')
        .withIndex('by_slug', (q) => q.eq('slug', args.universitySlug!))
        .unique();
      if (!university) {
        throw new Error(`University with slug "${args.universitySlug}" not found`);
      }
      universityId = university._id;
    }

    if (!universityId) {
      throw new Error('Either universityId or universitySlug is required');
    }

    // Safety guard: only allow hard-delete for test universities
    const university = await ctx.db.get(universityId);
    if (!university?.is_test) {
      throw new Error('Refusing to hard-delete inbox data for non-test universities.');
    }

    // Delete in order: messages -> actions -> read_state -> identity_matches -> threads
    const threads = await ctx.db
      .query('inbox_threads')
      .withIndex('by_university', (q) => q.eq('university_id', universityId!))
      .collect();

    const now = Date.now();
    let deletedMessages = 0;
    let deletedActions = 0;
    let deletedReadStates = 0;
    let deletedMatches = 0;

    for (const thread of threads) {
      // Clear linked queue item reference to avoid dangling pointers
      if (thread.linked_queue_item_id) {
        await ctx.db.patch(thread.linked_queue_item_id, {
          linked_thread_id: undefined,
          updated_at: now,
        });
      }

      // Delete messages
      const messages = await ctx.db
        .query('inbox_messages')
        .withIndex('by_thread', (q) => q.eq('thread_id', thread._id))
        .collect();
      for (const msg of messages) {
        await ctx.db.delete(msg._id);
        deletedMessages++;
      }

      // Delete actions
      const actions = await ctx.db
        .query('inbox_thread_actions')
        .withIndex('by_thread', (q) => q.eq('thread_id', thread._id))
        .collect();
      for (const action of actions) {
        await ctx.db.delete(action._id);
        deletedActions++;
      }

      // Delete read states
      const readStates = await ctx.db
        .query('inbox_read_state')
        .withIndex('by_thread', (q) => q.eq('thread_id', thread._id))
        .collect();
      for (const rs of readStates) {
        await ctx.db.delete(rs._id);
        deletedReadStates++;
      }

      // Delete identity matches
      const matches = await ctx.db
        .query('inbox_identity_matches')
        .withIndex('by_thread', (q) => q.eq('thread_id', thread._id))
        .collect();
      for (const match of matches) {
        await ctx.db.delete(match._id);
        deletedMatches++;
      }

      // Delete thread
      await ctx.db.delete(thread._id);
    }

    return {
      success: true,
      deletedThreads: threads.length,
      deletedMessages,
      deletedActions,
      deletedReadStates,
      deletedMatches,
    };
  },
});
