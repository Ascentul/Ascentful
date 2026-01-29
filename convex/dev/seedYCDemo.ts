/**
 * Demo University Seed Script
 *
 * Creates a dedicated test university for demo/investor presentations.
 * This university is completely isolated from production data.
 *
 * Usage:
 *   Seed:    npx convex run dev/seedYCDemo:seed
 *   Cleanup: npx convex run dev/seedYCDemo:cleanup
 *
 * Safety:
 *   - University marked with is_test: true (excluded from investor metrics)
 *   - All students linked only to Demo University
 *   - Cleanup removes only demo data, never touches other universities
 */

import { mutation, query } from '../_generated/server';
import { v } from 'convex/values';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEMO_CONFIG = {
  university: {
    name: 'Demo University',
    slug: 'demo',
    description: 'Demo university for investor presentations',
    website: 'https://demo.ascentul.io',
    contact_email: 'demo@ascentul.io',
    license_plan: 'Enterprise' as const,
    license_seats: 500,
    max_students: 1000,
    status: 'active' as const,
    is_test: true,
    institution_type: 'private_nonprofit' as const,
    primary_color: '#5371FF',
  },
  departments: [
    {
      name: 'School of Finance',
      code: 'FIN',
      dean_name: 'Dr. Sarah Chen',
      dean_email: 'schen@demo.edu',
      engagement_target: 85,
      placement_target: 92,
    },
    {
      name: 'College of Liberal Arts',
      code: 'LA',
      dean_name: 'Dr. Michael Torres',
      dean_email: 'mtorres@demo.edu',
      engagement_target: 80,
      placement_target: 78,
    },
  ],
  // Demo users that should be created in Clerk
  clerkUsers: [
    {
      email: 'demo-admin@ascentul.io',
      firstName: 'Demo',
      lastName: 'Admin',
      role: 'university_admin' as const,
    },
    {
      email: 'demo-advisor@ascentul.io',
      firstName: 'Demo',
      lastName: 'Advisor',
      role: 'advisor' as const,
    },
    {
      email: 'demo-student@ascentul.io',
      firstName: 'Alex',
      lastName: 'Chen',
      role: 'student' as const,
    },
  ],
};

// Student name templates for realistic data
const FIRST_NAMES = [
  'Marcus',
  'Emma',
  'Liam',
  'Olivia',
  'Noah',
  'Ava',
  'Ethan',
  'Sophia',
  'Mason',
  'Isabella',
  'Lucas',
  'Mia',
  'Oliver',
  'Charlotte',
  'Aiden',
  'Amelia',
  'Elijah',
  'Harper',
  'James',
  'Evelyn',
  'Benjamin',
  'Abigail',
  'Sebastian',
  'Emily',
  'Jack',
  'Elizabeth',
  'Henry',
  'Sofia',
  'Alexander',
  'Avery',
  'Michael',
  'Ella',
  'Daniel',
  'Scarlett',
  'Matthew',
  'Grace',
  'Jackson',
  'Chloe',
  'David',
  'Victoria',
  'Joseph',
  'Riley',
  'Samuel',
  'Aria',
  'Carter',
  'Lily',
  'Owen',
  'Aurora',
  'Wyatt',
  'Zoey',
];

const LAST_NAMES = [
  'Patel',
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Garcia',
  'Miller',
  'Davis',
  'Rodriguez',
  'Martinez',
  'Hernandez',
  'Lopez',
  'Wilson',
  'Anderson',
  'Thomas',
  'Taylor',
  'Moore',
  'Jackson',
  'Martin',
  'Lee',
  'Perez',
  'Thompson',
  'White',
  'Harris',
  'Sanchez',
  'Clark',
  'Ramirez',
  'Lewis',
  'Robinson',
  'Walker',
  'Young',
  'Allen',
  'King',
  'Wright',
  'Scott',
  'Torres',
  'Nguyen',
  'Hill',
  'Flores',
  'Green',
  'Adams',
  'Nelson',
  'Baker',
  'Hall',
  'Rivera',
  'Campbell',
  'Mitchell',
  'Carter',
];

// ============================================================================
// SEED FUNCTION
// ============================================================================

export const seed = mutation({
  args: {
    confirmProd: v.optional(v.boolean()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const isDryRun = args.dryRun === true;

    console.log('='.repeat(60));
    console.log('Demo University Seed Script');
    console.log('='.repeat(60));

    if (isDryRun) {
      console.log('DRY RUN MODE - No changes will be made');
    }

    // Step 1: Create or get university
    console.log('\n[1/5] Creating Demo University...');

    const existingUniversity = await ctx.db
      .query('universities')
      .withIndex('by_slug', (q) => q.eq('slug', DEMO_CONFIG.university.slug))
      .first();

    let universityId;

    if (existingUniversity) {
      console.log('  University already exists, using existing record');
      universityId = existingUniversity._id;
    } else if (!isDryRun) {
      universityId = await ctx.db.insert('universities', {
        ...DEMO_CONFIG.university,
        license_used: 0,
        license_start: now,
        license_end: now + 365 * 24 * 60 * 60 * 1000, // 1 year
        created_at: now,
        updated_at: now,
      });
      console.log('  Created university:', universityId);
    } else {
      console.log('  Would create university (dry run)');
      universityId = 'dry-run-id' as any;
    }

    // Step 2: Create departments
    console.log('\n[2/5] Creating departments...');
    const departmentIds: Record<string, any> = {};

    for (const dept of DEMO_CONFIG.departments) {
      const existing = await ctx.db
        .query('departments')
        .withIndex('by_university', (q) => q.eq('university_id', universityId))
        .filter((q) => q.eq(q.field('name'), dept.name))
        .first();

      if (existing) {
        console.log(`  Department "${dept.name}" already exists`);
        departmentIds[dept.code] = existing._id;
      } else if (!isDryRun) {
        const deptId = await ctx.db.insert('departments', {
          university_id: universityId,
          name: dept.name,
          code: dept.code,
          dean_name: dept.dean_name,
          dean_email: dept.dean_email,
          engagement_target: dept.engagement_target,
          placement_target: dept.placement_target,
          created_at: now,
          updated_at: now,
        });
        departmentIds[dept.code] = deptId;
        console.log(`  Created department: ${dept.name}`);
      } else {
        console.log(`  Would create department: ${dept.name} (dry run)`);
        departmentIds[dept.code] = 'dry-run-dept-id';
      }
    }

    // Step 3: Link Clerk users if they exist
    console.log('\n[3/5] Linking Clerk demo users...');

    for (const clerkUser of DEMO_CONFIG.clerkUsers) {
      const user = await ctx.db
        .query('users')
        .withIndex('by_email', (q) => q.eq('email', clerkUser.email))
        .first();

      if (user) {
        if (!isDryRun) {
          await ctx.db.patch(user._id, {
            university_id: universityId,
            role: clerkUser.role,
            updated_at: now,
          });
          console.log(`  Linked ${clerkUser.email} as ${clerkUser.role}`);
        } else {
          console.log(`  Would link ${clerkUser.email} (dry run)`);
        }
      } else {
        console.log(`  User not found: ${clerkUser.email}`);
        console.log(`    -> Create in Clerk Dashboard with role: ${clerkUser.role}`);
      }
    }

    // Step 4: Create demo students
    console.log('\n[4/5] Creating demo students...');

    const STUDENT_COUNT = 75; // Create 75 demo students
    const studentsCreated: string[] = [];

    // Check how many demo students already exist
    const existingStudents = await ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', universityId))
      .filter((q) => q.eq(q.field('role'), 'student'))
      .collect();

    if (existingStudents.length >= STUDENT_COUNT) {
      console.log(`  Already have ${existingStudents.length} students, skipping creation`);
    } else {
      const studentsToCreate = STUDENT_COUNT - existingStudents.length;
      console.log(`  Creating ${studentsToCreate} new students...`);

      for (let i = 0; i < studentsToCreate; i++) {
        const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
        const lastName = LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length];
        const name = `${firstName} ${lastName.charAt(0)}.`;
        const fullName = `${firstName} ${lastName}`;

        // Alternate between departments
        const deptCode = i % 2 === 0 ? 'FIN' : 'LA';
        const deptId = departmentIds[deptCode];

        // Create a fake clerk ID for demo purposes
        const fakeClerkId = `demo_student_${i + 1}_${Date.now()}`;
        const email = `demo.student.${i + 1}@demo.edu`;

        if (!isDryRun) {
          const studentId = await ctx.db.insert('users', {
            clerkId: fakeClerkId,
            email,
            name: fullName,
            role: 'student',
            university_id: universityId,
            department_id: deptId,
            subscription_plan: 'university',
            subscription_status: 'active',
            is_test_user: true, // Mark as test user
            created_at: now - Math.random() * 90 * 24 * 60 * 60 * 1000, // Random date in last 90 days
            updated_at: now,
            last_login_at: now - Math.random() * 30 * 24 * 60 * 60 * 1000, // Random in last 30 days
          });
          studentsCreated.push(email);
        }
      }

      if (!isDryRun) {
        console.log(`  Created ${studentsCreated.length} students`);
      } else {
        console.log(`  Would create ${studentsToCreate} students (dry run)`);
      }
    }

    // Step 5: Create Marcus P. (our hero demo student)
    console.log('\n[5/5] Creating Marcus P. (hero demo student)...');

    const marcusEmail = 'marcus.patel@demo.edu';
    const existingMarcus = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', marcusEmail))
      .first();

    if (existingMarcus) {
      console.log('  Marcus P. already exists');
    } else if (!isDryRun) {
      const marcusId = await ctx.db.insert('users', {
        clerkId: `demo_marcus_${Date.now()}`,
        email: marcusEmail,
        name: 'Marcus Patel',
        role: 'student',
        university_id: universityId,
        department_id: departmentIds['LA'], // Liberal Arts - for "stalled" demo
        subscription_plan: 'university',
        subscription_status: 'active',
        is_test_user: true,
        created_at: now - 120 * 24 * 60 * 60 * 1000, // 120 days ago
        updated_at: now,
        last_login_at: now - 3 * 24 * 60 * 60 * 1000, // 3 days ago (still active)
      });
      console.log('  Created Marcus P.');

      // Create an old resume for Marcus (60 days old)
      const resumeCreatedAt = now - 60 * 24 * 60 * 60 * 1000;
      await ctx.db.insert('resumes', {
        user_id: marcusId,
        university_id: universityId,
        title: 'Marketing Resume',
        content: {
          sections: {
            contact: { name: 'Marcus Patel', email: marcusEmail },
            summary: 'Marketing student seeking internship opportunities',
            experience: [],
            education: [{ school: 'Demo University', degree: 'BA Marketing' }],
          },
        },
        visibility: 'private',
        source: 'manual',
        intent: 'internship',
        created_at: resumeCreatedAt,
        updated_at: resumeCreatedAt, // Not updated since creation
      });
      console.log('  Created resume for Marcus (60 days old)');
    } else {
      console.log('  Would create Marcus P. (dry run)');
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('SEED COMPLETE');
    console.log('='.repeat(60));
    console.log(`
University: ${DEMO_CONFIG.university.name}
Departments: ${DEMO_CONFIG.departments.map((d) => d.name).join(', ')}
Students: ${studentsCreated.length} created

NEXT STEPS:
1. Seed momentum data:
   npx convex run momentum:seedDemoMomentum '{"universityId": "${universityId}"}'

2. Create Clerk users (if not done):
   - demo-admin@ascentul.io
     First Name: Demo, Last Name: Admin
     Role: university_admin

   - demo-advisor@ascentul.io
     First Name: Demo, Last Name: Advisor
     Role: advisor

   - demo-student@ascentul.io
     First Name: Alex, Last Name: Chen
     Role: student

3. Set Clerk publicMetadata for each user:
   Admin:   {"role": "university_admin", "university_id": "${universityId}"}
   Advisor: {"role": "advisor", "university_id": "${universityId}"}
   Student: {"role": "student", "university_id": "${universityId}"}

4. Login and verify:
   - Admin/Advisor: /u/home (see dashboard with Health Score)
   - Student: /dashboard (see student career tools)
`);

    return {
      success: true,
      isDryRun,
      universityId,
      departments: Object.keys(departmentIds),
      studentsCreated: studentsCreated.length,
    };
  },
});

// ============================================================================
// CLEANUP FUNCTION
// ============================================================================

export const cleanup = mutation({
  args: {
    removeUniversity: v.optional(v.boolean()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const isDryRun = args.dryRun === true;
    const removeUniversity = args.removeUniversity === true;

    console.log('='.repeat(60));
    console.log('Demo University Cleanup');
    console.log('='.repeat(60));

    if (isDryRun) {
      console.log('DRY RUN MODE - No changes will be made');
    }

    // Find the Demo University
    const university = await ctx.db
      .query('universities')
      .withIndex('by_slug', (q) => q.eq('slug', DEMO_CONFIG.university.slug))
      .first();

    if (!university) {
      console.log('Demo University not found - nothing to clean up');
      return { success: true, message: 'Nothing to clean up' };
    }

    const universityId = university._id;
    console.log(`Found university: ${university.name} (${universityId})`);

    // Safety check: Ensure this is a test university
    if (!university.is_test) {
      throw new Error('SAFETY: Cannot cleanup non-test university!');
    }

    // Step 1: Delete demo students (only those with is_test_user flag)
    console.log('\n[1/5] Removing demo students...');
    const students = await ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', universityId))
      .filter((q) => q.and(q.eq(q.field('role'), 'student'), q.eq(q.field('is_test_user'), true)))
      .collect();

    let studentsDeleted = 0;
    for (const student of students) {
      if (!isDryRun) {
        // Delete related data first
        const resumes = await ctx.db
          .query('resumes')
          .withIndex('by_user', (q) => q.eq('user_id', student._id))
          .collect();
        for (const resume of resumes) {
          await ctx.db.delete(resume._id);
        }

        // Delete the student
        await ctx.db.delete(student._id);
        studentsDeleted++;
      }
    }
    console.log(`  ${isDryRun ? 'Would delete' : 'Deleted'} ${students.length} students`);

    // Step 2: Unlink (don't delete) Clerk demo users
    console.log('\n[2/5] Unlinking Clerk demo users...');
    for (const clerkUser of DEMO_CONFIG.clerkUsers) {
      const user = await ctx.db
        .query('users')
        .withIndex('by_email', (q) => q.eq('email', clerkUser.email))
        .first();

      if (user && !isDryRun) {
        await ctx.db.patch(user._id, {
          university_id: undefined,
          department_id: undefined,
          updated_at: Date.now(),
        });
        console.log(`  Unlinked ${clerkUser.email}`);
      }
    }

    // Step 3: Delete departments
    console.log('\n[3/5] Removing departments...');
    const departments = await ctx.db
      .query('departments')
      .withIndex('by_university', (q) => q.eq('university_id', universityId))
      .collect();

    for (const dept of departments) {
      if (!isDryRun) {
        await ctx.db.delete(dept._id);
      }
    }
    console.log(`  ${isDryRun ? 'Would delete' : 'Deleted'} ${departments.length} departments`);

    // Step 4: Delete queue items linked to demo students
    console.log('\n[4/5] Removing queue items...');
    // Note: Queue items are linked by student_id, which we've already deleted
    // This step would query by student IDs if we tracked them

    // Step 5: Optionally delete university record
    console.log('\n[5/5] University record...');
    if (removeUniversity) {
      if (!isDryRun) {
        await ctx.db.delete(universityId);
        console.log('  Deleted university record');
      } else {
        console.log('  Would delete university record (dry run)');
      }
    } else {
      console.log('  Keeping university record (use removeUniversity: true to delete)');
    }

    console.log('\n' + '='.repeat(60));
    console.log('CLEANUP COMPLETE');
    console.log('='.repeat(60));

    return {
      success: true,
      isDryRun,
      studentsDeleted: students.length,
      departmentsDeleted: departments.length,
      universityDeleted: removeUniversity,
    };
  },
});

// ============================================================================
// QUERY: Check demo status
// ============================================================================

export const status = query({
  args: {},
  handler: async (ctx) => {
    const university = await ctx.db
      .query('universities')
      .withIndex('by_slug', (q) => q.eq('slug', DEMO_CONFIG.university.slug))
      .first();

    if (!university) {
      return {
        exists: false,
        message: 'Demo University not found. Run seed to create.',
      };
    }

    const students = await ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', university._id))
      .filter((q) => q.eq(q.field('role'), 'student'))
      .collect();

    const departments = await ctx.db
      .query('departments')
      .withIndex('by_university', (q) => q.eq('university_id', university._id))
      .collect();

    const marcus = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', 'marcus.patel@demo.edu'))
      .first();

    return {
      exists: true,
      universityId: university._id,
      universityName: university.name,
      isTest: university.is_test,
      studentCount: students.length,
      departmentCount: departments.length,
      departments: departments.map((d) => d.name),
      hasMarcus: !!marcus,
    };
  },
});

// ============================================================================
// SEED ADVISOR DATA - Assigns students and creates queue/inbox items
// ============================================================================

export const seedAdvisorData = mutation({
  args: {
    universityId: v.id('universities'),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const isDryRun = args.dryRun === true;

    console.log('='.repeat(60));
    console.log('Seeding Advisor Data');
    console.log('='.repeat(60));

    if (isDryRun) {
      console.log('DRY RUN MODE - No changes will be made');
    }

    // Find the demo advisor
    const advisor = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', 'demo-advisor@ascentul.io'))
      .first();

    if (!advisor) {
      console.log('Demo advisor not found. Create the Clerk user first.');
      return { success: false, message: 'Advisor not found' };
    }

    console.log(`Found advisor: ${advisor.name} (${advisor._id})`);

    // Find the demo admin (for assignment tracking)
    const admin = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', 'demo-admin@ascentul.io'))
      .first();

    const assignedById = admin?._id || advisor._id;

    // Get all demo students
    const students = await ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
      .filter((q) => q.and(q.eq(q.field('role'), 'student'), q.eq(q.field('is_test_user'), true)))
      .collect();

    console.log(`\n[1/5] Assigning ${Math.min(30, students.length)} students to advisor...`);

    // Assign first 30 students to the advisor
    const studentsToAssign = students.slice(0, 30);
    let assignmentsCreated = 0;

    for (let i = 0; i < studentsToAssign.length; i++) {
      const student = studentsToAssign[i];

      // Check if assignment already exists
      const existing = await ctx.db
        .query('student_advisors')
        .withIndex('by_student', (q) =>
          q.eq('student_id', student._id).eq('university_id', args.universityId),
        )
        .first();

      if (!existing && !isDryRun) {
        await ctx.db.insert('student_advisors', {
          student_id: student._id,
          advisor_id: advisor._id,
          university_id: args.universityId,
          is_owner: true,
          assigned_at: now - Math.random() * 30 * 24 * 60 * 60 * 1000, // Random time in last 30 days
          assigned_by: assignedById,
          created_at: now,
          updated_at: now,
        });
        assignmentsCreated++;
      }
    }
    console.log(`  Created ${assignmentsCreated} student assignments`);

    // Create queue items for students with red/yellow momentum
    console.log('\n[2/5] Creating queue items...');
    let queueItemsCreated = 0;

    const queueReasons = [
      { reason: 'Resume needs review', priority: 'P2' as const },
      { reason: 'Application stalled', priority: 'P1' as const },
      { reason: 'No activity in 14 days', priority: 'P2' as const },
      { reason: 'Goal deadline approaching', priority: 'P3' as const },
      { reason: 'Interview prep needed', priority: 'P1' as const },
    ];

    // Get students with yellow/red momentum
    const atRiskStudents = studentsToAssign.filter(
      (s) => s.momentum_signal === 'red' || s.momentum_signal === 'yellow',
    );

    for (let i = 0; i < Math.min(15, atRiskStudents.length); i++) {
      const student = atRiskStudents[i];
      const reasonData = queueReasons[i % queueReasons.length];

      // Check if queue item already exists for this student
      const existingItem = await ctx.db
        .query('queue_items')
        .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
        .filter((q) =>
          q.and(q.eq(q.field('student_id'), student._id), q.eq(q.field('status'), 'OPEN')),
        )
        .first();

      if (!existingItem && !isDryRun) {
        await ctx.db.insert('queue_items', {
          university_id: args.universityId,
          student_id: student._id,
          signal_id: undefined,
          owner_id: advisor._id,
          status: i < 3 ? 'IN_PROGRESS' : 'OPEN',
          priority: reasonData.priority,
          due_at: now + (i + 1) * 24 * 60 * 60 * 1000, // Staggered due dates
          created_at: now - Math.random() * 7 * 24 * 60 * 60 * 1000,
          updated_at: now,
        });
        queueItemsCreated++;
      }
    }
    console.log(`  Created ${queueItemsCreated} queue items`);

    // Create inbox threads and messages
    console.log('\n[3/5] Creating inbox threads and messages...');
    let threadsCreated = 0;

    const messageTemplates = [
      {
        studentMsg:
          'Hi! I wanted to ask about my resume - do you have time to review it this week?',
        advisorMsg:
          "Hi! Of course, I'd be happy to review your resume. Can you upload the latest version and I'll take a look.",
      },
      {
        studentMsg:
          "I'm feeling stuck with my job search. Haven't heard back from any companies in 2 weeks.",
        advisorMsg:
          "I understand the frustration. Let's schedule a call to review your application strategy and see if we can identify areas for improvement.",
      },
      {
        studentMsg: 'Just got an interview invite from Google! Any tips for technical interviews?',
        advisorMsg:
          "That's fantastic news! Congratulations! Let's schedule a mock interview session to help you prepare.",
      },
      {
        studentMsg:
          'Thank you so much for the feedback on my cover letter. I made the changes you suggested.',
        advisorMsg: "Great work! The revisions look much stronger. You're ready to submit.",
      },
      {
        studentMsg:
          "I'm not sure if I should accept this offer or wait for other responses. What do you think?",
        advisorMsg:
          "That's an exciting position to be in! Let's discuss the offer details and timeline in our next session.",
      },
    ];

    // Create threads for first 8 students
    for (let i = 0; i < Math.min(8, studentsToAssign.length); i++) {
      const student = studentsToAssign[i];
      const template = messageTemplates[i % messageTemplates.length];

      // Check if thread already exists
      const existingThread = await ctx.db
        .query('inbox_threads')
        .withIndex('by_student', (q) => q.eq('student_id', student._id))
        .first();

      if (!existingThread && !isDryRun) {
        const threadId = await ctx.db.insert('inbox_threads', {
          university_id: args.universityId,
          thread_type: 'student',
          student_id: student._id,
          identity_status: 'matched',
          subject: `Chat with ${student.name}`,
          assigned_to: advisor._id,
          status: i < 3 ? 'open' : 'active',
          last_message_at: now - i * 2 * 60 * 60 * 1000, // Staggered messages
          last_message_preview: template.advisorMsg.substring(0, 100),
          last_message_sender_type: i % 2 === 0 ? 'student' : 'advisor',
          has_unread: i < 2,
          created_at: now - (10 - i) * 24 * 60 * 60 * 1000,
          updated_at: now,
        });

        // Create student message
        await ctx.db.insert('inbox_messages', {
          thread_id: threadId,
          university_id: args.universityId,
          sender_type: 'student',
          sender_user_id: student._id,
          sender_name: student.name,
          body: template.studentMsg,
          channel: 'in_app',
          is_internal: false,
          created_at: now - (10 - i) * 24 * 60 * 60 * 1000,
        });

        // Create advisor response
        await ctx.db.insert('inbox_messages', {
          thread_id: threadId,
          university_id: args.universityId,
          sender_type: 'advisor',
          sender_user_id: advisor._id,
          sender_name: advisor.name,
          body: template.advisorMsg,
          channel: 'in_app',
          is_internal: false,
          created_at: now - (10 - i) * 24 * 60 * 60 * 1000 + 60 * 60 * 1000,
        });

        threadsCreated++;
      }
    }
    console.log(`  Created ${threadsCreated} inbox threads with messages`);

    // Create upcoming sessions
    console.log('\n[4/5] Creating upcoming advisor sessions...');
    let sessionsCreated = 0;

    const sessionTypes = [
      'career_planning',
      'resume_review',
      'mock_interview',
      'application_strategy',
    ] as const;

    for (let i = 0; i < Math.min(5, studentsToAssign.length); i++) {
      const student = studentsToAssign[i];
      const sessionType = sessionTypes[i % sessionTypes.length];

      // Check if session already exists
      const existingSession = await ctx.db
        .query('advisor_sessions')
        .withIndex('by_student', (q) =>
          q.eq('student_id', student._id).eq('university_id', args.universityId),
        )
        .first();

      if (!existingSession && !isDryRun) {
        const startAt = now + (i + 1) * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000; // Future dates at 10am
        await ctx.db.insert('advisor_sessions', {
          student_id: student._id,
          advisor_id: advisor._id,
          university_id: args.universityId,
          title: `${sessionType.replace('_', ' ')} with ${student.name?.split(' ')[0]}`,
          start_at: startAt,
          end_at: startAt + 30 * 60 * 1000, // 30 min
          duration_minutes: 30,
          session_type: sessionType,
          status: 'scheduled',
          visibility: 'shared',
          created_at: now,
          updated_at: now,
        });
        sessionsCreated++;
      }
    }
    console.log(`  Created ${sessionsCreated} upcoming sessions`);

    // Create review requests
    console.log('\n[5/5] Creating review requests...');
    let reviewsCreated = 0;

    for (let i = 0; i < Math.min(5, studentsToAssign.length); i++) {
      const student = studentsToAssign[i + 5]; // Use different students
      if (!student) continue;

      // Check if review already exists
      const existingReview = await ctx.db
        .query('advisor_reviews')
        .withIndex('by_student', (q) =>
          q.eq('student_id', student._id).eq('university_id', args.universityId),
        )
        .first();

      if (!existingReview && !isDryRun) {
        await ctx.db.insert('advisor_reviews', {
          student_id: student._id,
          university_id: args.universityId,
          asset_type: i % 2 === 0 ? 'resume' : 'cover_letter',
          status: i === 0 ? 'in_review' : 'waiting',
          created_at: now - i * 24 * 60 * 60 * 1000,
          updated_at: now,
        });
        reviewsCreated++;
      }
    }
    console.log(`  Created ${reviewsCreated} review requests`);

    console.log('\n' + '='.repeat(60));
    console.log('ADVISOR DATA SEED COMPLETE');
    console.log('='.repeat(60));

    return {
      success: true,
      isDryRun,
      assignmentsCreated,
      queueItemsCreated,
      threadsCreated,
      sessionsCreated,
      reviewsCreated,
    };
  },
});

// ============================================================================
// ONE-TIME MIGRATION: Clean up old 'yc-demo' slug data
// ============================================================================

export const cleanupOldYCDemo = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const isDryRun = args.dryRun === true;

    console.log('='.repeat(60));
    console.log('Cleaning up old YC Demo data (slug: yc-demo)');
    console.log('='.repeat(60));

    // Find the old university with slug 'yc-demo'
    const oldUniversity = await ctx.db
      .query('universities')
      .withIndex('by_slug', (q) => q.eq('slug', 'yc-demo'))
      .first();

    if (!oldUniversity) {
      console.log('No old YC Demo University found (slug: yc-demo)');
      return { success: true, message: 'Nothing to clean up' };
    }

    const universityId = oldUniversity._id;
    console.log(`Found old university: ${oldUniversity.name} (${universityId})`);

    // Safety check
    if (!oldUniversity.is_test) {
      throw new Error('SAFETY: Cannot cleanup non-test university!');
    }

    // Delete demo students
    console.log('\n[1/4] Removing demo students...');
    const students = await ctx.db
      .query('users')
      .withIndex('by_university', (q) => q.eq('university_id', universityId))
      .filter((q) => q.and(q.eq(q.field('role'), 'student'), q.eq(q.field('is_test_user'), true)))
      .collect();

    for (const student of students) {
      if (!isDryRun) {
        // Delete resumes first
        const resumes = await ctx.db
          .query('resumes')
          .withIndex('by_user', (q) => q.eq('user_id', student._id))
          .collect();
        for (const resume of resumes) {
          await ctx.db.delete(resume._id);
        }
        await ctx.db.delete(student._id);
      }
    }
    console.log(`  ${isDryRun ? 'Would delete' : 'Deleted'} ${students.length} students`);

    // Delete departments
    console.log('\n[2/4] Removing departments...');
    const departments = await ctx.db
      .query('departments')
      .withIndex('by_university', (q) => q.eq('university_id', universityId))
      .collect();

    for (const dept of departments) {
      if (!isDryRun) {
        await ctx.db.delete(dept._id);
      }
    }
    console.log(`  ${isDryRun ? 'Would delete' : 'Deleted'} ${departments.length} departments`);

    // Unlink any linked users (old emails)
    console.log('\n[3/4] Unlinking old demo users...');
    const oldEmails = [
      'yc-demo-admin@ascentul.io',
      'yc-demo-advisor@ascentul.io',
      'yc-demo-student@ascentul.io',
    ];
    for (const email of oldEmails) {
      const user = await ctx.db
        .query('users')
        .withIndex('by_email', (q) => q.eq('email', email))
        .first();
      if (user && !isDryRun) {
        await ctx.db.patch(user._id, {
          university_id: undefined,
          department_id: undefined,
          updated_at: Date.now(),
        });
        console.log(`  Unlinked ${email}`);
      }
    }

    // Delete university
    console.log('\n[4/4] Removing university record...');
    if (!isDryRun) {
      await ctx.db.delete(universityId);
      console.log('  Deleted university');
    } else {
      console.log('  Would delete university (dry run)');
    }

    console.log('\n' + '='.repeat(60));
    console.log('OLD YC DEMO CLEANUP COMPLETE');
    console.log('='.repeat(60));
    console.log('\nNow run: npx convex run dev/seedYCDemo:seed');

    return {
      success: true,
      isDryRun,
      studentsDeleted: students.length,
      departmentsDeleted: departments.length,
    };
  },
});
