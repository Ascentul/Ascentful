/**
 * Seed Activity Events for Engagement Predictions
 *
 * Creates sample activity events for existing students to enable
 * the engagement prediction engine to work.
 *
 * Run via: npx convex run seed_activity_events:seedActivityEvents --args '{"universityId": "YOUR_UNIVERSITY_ID"}'
 */

import { v } from 'convex/values';

import { internalMutation, internalQuery } from './_generated/server';

const EVENT_TYPES = [
  { type: 'login', category: 'auth' as const, weight: 3 },
  { type: 'application_created', category: 'application' as const, weight: 2 },
  { type: 'application_updated', category: 'application' as const, weight: 2 },
  { type: 'resume_updated', category: 'document' as const, weight: 2 },
  { type: 'cover_letter_created', category: 'document' as const, weight: 1 },
  { type: 'goal_created', category: 'goal' as const, weight: 1 },
  { type: 'goal_completed', category: 'goal' as const, weight: 1 },
  { type: 'ai_coach_session', category: 'ai_coach' as const, weight: 1 },
  { type: 'career_explorer_used', category: 'career_explorer' as const, weight: 1 },
];

function randomElement<T>(arr: T[]): T {
  if (arr.length === 0) {
    throw new Error('Cannot select from empty array');
  }
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate weighted random event type
function getRandomEventType() {
  const totalWeight = EVENT_TYPES.reduce((sum, e) => sum + e.weight, 0);
  let random = Math.random() * totalWeight;

  for (const event of EVENT_TYPES) {
    random -= event.weight;
    if (random <= 0) {
      return event;
    }
  }
  return EVENT_TYPES[0];
}

export const seedActivityEvents = internalMutation({
  args: {
    universityId: v.id('universities'),
    weeksOfData: v.optional(v.number()), // Default 10 weeks
    clearExisting: v.optional(v.boolean()), // Default false
  },
  handler: async (ctx, args) => {
    const { universityId, weeksOfData = 10, clearExisting = false } = args;
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;
    const msPerWeek = 7 * msPerDay;

    console.log('Starting activity events seed...');

    // Check if university is marked as test - only test universities can have last_login_at updated
    const university = await ctx.db.get(universityId);
    if (!university) {
      return {
        success: false,
        error: 'University not found',
        studentsProcessed: 0,
        eventsCreated: 0,
      };
    }
    const isTestUniversity = university.is_test === true;

    // Get all students for this university
    const students = await ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', universityId))
      .filter((q) => q.eq(q.field('role'), 'student'))
      .collect();

    console.log(`Found ${students.length} students`);

    if (students.length === 0) {
      console.log('No students found in this university. Please add students first.');
      return {
        success: false,
        error: 'No students found in university. Add users with role="student" first.',
        studentsProcessed: 0,
        eventsCreated: 0,
      };
    }

    // Optionally clear existing seeded activity events for these students
    if (clearExisting) {
      console.log('Clearing existing seeded activity events...');
      let cleared = 0;
      for (const student of students) {
        const existing = await ctx.db
          .query('activity_events')
          .withIndex('by_user', (q) => q.eq('user_id', student._id))
          .collect();

        for (const event of existing) {
          // Only delete seeded events to avoid destroying production data
          const metadata = event.metadata as { source?: string } | undefined;
          if (metadata?.source === 'seed_script') {
            await ctx.db.delete(event._id);
            cleared++;
          }
        }
      }
      console.log(`Cleared ${cleared} seeded events`);
    }

    // Define engagement profiles
    const profiles = [
      { name: 'highly_engaged', eventsPerWeek: [8, 15], probability: 0.25 },
      { name: 'moderate', eventsPerWeek: [3, 7], probability: 0.35 },
      { name: 'declining', eventsPerWeek: [1, 4], trend: 'down', probability: 0.2 },
      { name: 'at_risk', eventsPerWeek: [0, 2], probability: 0.15 },
      { name: 'recovering', eventsPerWeek: [2, 6], trend: 'up', probability: 0.05 },
    ];

    let totalEvents = 0;

    for (const student of students) {
      // Assign a random profile
      const roll = Math.random();
      let cumulative = 0;
      let profile = profiles[0];

      for (const p of profiles) {
        cumulative += p.probability;
        if (roll < cumulative) {
          profile = p;
          break;
        }
      }

      // Generate events for each week
      for (let week = weeksOfData - 1; week >= 0; week--) {
        const weekStart = now - (week + 1) * msPerWeek;
        const weekEnd = now - week * msPerWeek;

        // Calculate events for this week based on profile and trend
        let [minEvents, maxEvents] = profile.eventsPerWeek;

        // Apply trend
        if (profile.trend === 'down') {
          // Declining: more events in earlier weeks, fewer in recent weeks
          const weekFactor = week / weeksOfData;
          minEvents = Math.floor(minEvents * (0.5 + weekFactor));
          maxEvents = Math.floor(maxEvents * (0.5 + weekFactor));
        } else if (profile.trend === 'up') {
          // Recovering: fewer events in earlier weeks, more in recent weeks
          const weekFactor = 1 - week / weeksOfData;
          minEvents = Math.floor(minEvents * (0.3 + weekFactor * 0.7));
          maxEvents = Math.floor(maxEvents * (0.3 + weekFactor * 0.7));
        }

        // For at-risk students, skip recent weeks sometimes
        if (profile.name === 'at_risk' && week < 2 && Math.random() < 0.7) {
          continue;
        }

        const numEvents = randomBetween(Math.max(0, minEvents), maxEvents);

        for (let i = 0; i < numEvents; i++) {
          const eventTime = randomBetween(weekStart, weekEnd);
          const eventType = getRandomEventType();

          await ctx.db.insert('activity_events', {
            user_id: student._id,
            university_id: universityId,
            event_type: eventType.type,
            event_category: eventType.category,
            occurred_at: eventTime,
            created_at: eventTime,
            metadata: { source: 'seed_script' },
          });

          totalEvents++;
        }
      }

      // Update last_login_at based on most recent activity by occurred_at
      // GUARD: Only update last_login_at for test universities to avoid corrupting production analytics
      if (isTestUniversity) {
        // Note: .order('desc') orders by _creationTime, not occurred_at
        const allStudentEvents = await ctx.db
          .query('activity_events')
          .withIndex('by_user', (q) => q.eq('user_id', student._id))
          .collect();

        const lastActivity =
          allStudentEvents.length > 0
            ? allStudentEvents.reduce((latest, e) =>
                e.occurred_at > latest.occurred_at ? e : latest,
              )
            : null;

        if (lastActivity) {
          await ctx.db.patch(student._id, {
            last_login_at: lastActivity.occurred_at,
          });
        }
      }
    }

    console.log(`\nSeed completed!`);
    console.log(`- Students processed: ${students.length}`);
    console.log(`- Activity events created: ${totalEvents}`);

    return {
      success: true,
      studentsProcessed: students.length,
      eventsCreated: totalEvents,
    };
  },
});

// Helper to list universities (for finding the ID)
export const listUniversities = internalQuery({
  args: {},
  handler: async (ctx) => {
    const universities = await ctx.db.query('universities').take(10);
    return universities.map((u) => ({
      id: u._id,
      name: u.name,
      status: u.status,
    }));
  },
});

// Mask email for debug output (e.g., "john.doe@example.com" → "joh***@example.com")
function maskEmail(email: string | undefined): string {
  if (!email) return '(no email)';
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const visibleChars = Math.min(3, local.length);
  return `${local.slice(0, visibleChars)}***@${domain}`;
}

// Debug: Check users and activity events for a university
export const debugUniversityData = internalQuery({
  args: {
    universityId: v.id('universities'),
  },
  handler: async (ctx, args) => {
    const students = await ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
      .filter((q) => q.eq(q.field('role'), 'student'))
      .collect();

    const allUsers = await ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
      .collect();

    const events = await ctx.db
      .query('activity_events')
      .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
      .take(100);

    return {
      studentCount: students.length,
      students: students.map((s) => ({
        id: s._id,
        name: s.name,
        email: maskEmail(s.email),
        role: s.role,
      })),
      allUserCount: allUsers.length,
      allUsers: allUsers.map((u) => ({
        id: u._id,
        name: u.name,
        email: maskEmail(u.email),
        role: u.role,
      })),
      activityEventCount: events.length,
    };
  },
});

// Helper to clear seeded test data (only deletes events created by seed script)
export const clearActivityEvents = internalMutation({
  args: {
    universityId: v.id('universities'),
  },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query('activity_events')
      .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
      .collect();

    let deleted = 0;
    for (const event of events) {
      // Only delete events created by the seed script to avoid destroying production data
      const metadata = event.metadata as { source?: string } | undefined;
      if (metadata?.source === 'seed_script') {
        await ctx.db.delete(event._id);
        deleted++;
      }
    }

    console.log(
      `Deleted ${deleted} seeded activity events (${events.length - deleted} production events preserved)`,
    );
    return { deleted, preserved: events.length - deleted };
  },
});
