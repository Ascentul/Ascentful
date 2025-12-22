/**
 * Create Test Student for Advisor Testing
 *
 * Run via: npx convex run seed_test_student:createTestStudent
 *
 * Creates a complete test student profile with:
 * - Student account linked to advisor
 * - Sample resume
 * - Sample applications
 * - Sample goals
 * - Follow-ups from advisor
 *
 * IMPORTANT: This script creates "pending" user profiles with empty clerkId
 * and account_status="pending_activation". When the test user signs in via
 * Clerk for the first time, the webhook handler (users:createUser) will:
 * 1. Detect the pending user by email
 * 2. Update it with the real Clerk ID
 * 3. Set account_status to "active"
 * 4. Preserve all test data (university, role, goals, etc.)
 *
 * This prevents duplicate user records and ensures test data is properly
 * linked to the real authenticated user.
 */

import { v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { internalMutation } from './_generated/server';

type CreateTestStudentResult =
  | { success: false; message: string }
  | {
      success: true;
      studentId: Id<'users'>;
      advisorId: Id<'users'>;
      universityId: Id<'universities'>;
      resumeId?: Id<'resumes'>;
      applicationCount: number;
      followUpCount: number;
    };

export const createTestStudent = internalMutation({
  args: {
    studentEmail: v.optional(v.string()),
    advisorEmail: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<CreateTestStudentResult> => {
    const now = Date.now();

    // Default emails
    const studentEmail = args.studentEmail || 'test.student@ascentful.io';
    const advisorEmail = args.advisorEmail || 'test.advisor@ascentful.io';

    console.log(`🚀 Creating test student: ${studentEmail}`);

    // 1. Find or create university
    let university = await ctx.db
      .query('universities')
      .filter((q) => q.eq(q.field('name'), 'Test University - Advisor Demo'))
      .first();

    if (!university) {
      const uniId = await ctx.db.insert('universities', {
        name: 'Test University - Advisor Demo',
        slug: 'test-advisor-demo',
        description: 'Test university for advisor feature development',
        is_test: true,
        license_plan: 'Pro',
        license_seats: 100,
        license_used: 0,
        max_students: 100,
        license_start: now,
        status: 'active',
        created_at: now,
        updated_at: now,
      });
      university = await ctx.db.get(uniId);
      console.log(`✓ Created test university: ${uniId}`);
    } else {
      console.log(`✓ Using existing university: ${university._id}`);
    }

    if (!university) {
      throw new Error('Failed to create/find university');
    }

    // 2. Find advisor
    const advisor = await ctx.db
      .query('users')
      .filter((q) => q.eq(q.field('email'), advisorEmail))
      .first();

    if (!advisor) {
      console.log(`⚠️  Advisor not found: ${advisorEmail}`);
      console.log('Please ensure the advisor account exists first.');
      return {
        success: false,
        message: `Advisor ${advisorEmail} not found. Please sign in with advisor account first.`,
      };
    }

    // Ensure advisor has correct role and university
    // Only update role if not already properly configured (preserve university_admin role)
    if (advisor.role !== 'advisor' && advisor.role !== 'university_admin') {
      await ctx.db.patch(advisor._id, {
        university_id: university._id,
        role: 'advisor',
        subscription_plan: 'university',
        subscription_status: 'active',
        is_test_user: true,
        updated_at: now,
      });
      console.log(`✓ Updated advisor role: ${advisor.email}`);
    } else {
      // Just ensure university linkage without overwriting role
      await ctx.db.patch(advisor._id, {
        university_id: university._id,
        subscription_plan: 'university',
        subscription_status: 'active',
        is_test_user: true,
        updated_at: now,
      });
      console.log(
        `✓ Linked advisor to university (preserved ${advisor.role} role): ${advisor.email}`,
      );
    }

    // 3. Find or create student
    let student = await ctx.db
      .query('users')
      .filter((q) => q.eq(q.field('email'), studentEmail))
      .first();

    if (!student) {
      // Create student profile as "pending" (will be activated by Clerk webhook on first sign-in)
      console.log(`Creating pending student profile: ${studentEmail}`);

      const studentId = await ctx.db.insert('users', {
        clerkId: `pending_${studentEmail}`, // Placeholder - will be replaced by webhook
        email: studentEmail,
        name: 'Test Student',
        username: `student_${now}`,
        role: 'student',
        subscription_plan: 'university',
        subscription_status: 'active',
        account_status: 'pending_activation', // Signals to webhook this is a pre-created user
        onboarding_completed: true,
        university_id: university._id,
        is_test_user: true,
        major: 'Computer Science',
        graduation_year: '2025',
        created_at: now,
        updated_at: now,
      });

      student = await ctx.db.get(studentId);
      console.log(`✓ Created pending student profile: ${studentEmail}`);
      console.log(`   (Will be activated when user signs in via Clerk)`);
    } else {
      // Update existing student profile with university and role
      await ctx.db.patch(student._id, {
        university_id: university._id,
        role: 'student',
        subscription_plan: 'university',
        subscription_status: 'active',
        is_test_user: true,
        major: 'Computer Science',
        graduation_year: '2025',
        updated_at: now,
      });
      console.log(`✓ Updated student profile: ${student.email}`);
    }

    if (!student) {
      throw new Error('Failed to create/update student profile');
    }

    // 4. Create student-advisor relationship
    const existingRelationship = await ctx.db
      .query('student_advisors')
      .filter((q) =>
        q.and(q.eq(q.field('student_id'), student._id), q.eq(q.field('advisor_id'), advisor._id)),
      )
      .first();

    if (!existingRelationship) {
      await ctx.db.insert('student_advisors', {
        student_id: student._id,
        advisor_id: advisor._id,
        university_id: university._id,
        is_owner: true,
        assigned_at: now,
        assigned_by: advisor._id,
        notes: 'Test student-advisor relationship for development',
        created_at: now,
        updated_at: now,
      });
      console.log(`✓ Created student-advisor relationship`);
    } else {
      console.log(`✓ Student-advisor relationship already exists`);
    }

    // 5. Create sample resume
    const existingResume = await ctx.db
      .query('resumes')
      .filter((q) => q.eq(q.field('user_id'), student._id))
      .first();

    let resumeId;
    if (!existingResume) {
      resumeId = await ctx.db.insert('resumes', {
        user_id: student._id,
        title: 'Software Engineer Resume - 2025',
        content: JSON.stringify({
          basics: {
            name: student.name,
            email: student.email,
            phone: '(555) 123-4567',
            summary:
              'Computer Science student with strong programming skills seeking software engineering internship opportunities.',
          },
          education: [
            {
              institution: 'Test University',
              degree: 'Bachelor of Science in Computer Science',
              startDate: '2021-09',
              endDate: '2025-05',
              gpa: '3.8',
            },
          ],
          experience: [
            {
              company: 'Tech Startup Inc.',
              position: 'Software Engineering Intern',
              startDate: '2024-06',
              endDate: '2024-08',
              description:
                'Built full-stack features using React and Node.js. Improved API performance by 40%.',
            },
          ],
          skills: {
            languages: ['JavaScript', 'TypeScript', 'Python', 'Java'],
            frameworks: ['React', 'Next.js', 'Node.js', 'Express'],
            tools: ['Git', 'Docker', 'AWS', 'PostgreSQL'],
          },
        }),
        visibility: 'private',
        source: 'manual',
        version_counter: 0,
        created_at: now,
        updated_at: now,
      });
      console.log(`✓ Created sample resume: ${resumeId}`);
    } else {
      resumeId = existingResume._id;
      console.log(`✓ Using existing resume: ${resumeId}`);
    }

    // 6. Create sample applications
    type Stage =
      | 'Prospect'
      | 'Applied'
      | 'Interview'
      | 'Offer'
      | 'Accepted'
      | 'Rejected'
      | 'Withdrawn'
      | 'Archived';
    const companies: { name: string; position: string; stage: Stage }[] = [
      { name: 'Google', position: 'Software Engineer Intern', stage: 'Applied' },
      { name: 'Microsoft', position: 'SWE Intern', stage: 'Interview' },
      { name: 'Amazon', position: 'Software Development Engineer Intern', stage: 'Prospect' },
    ];

    const applicationIds = [];
    for (const company of companies) {
      // Check if application already exists
      const existing = await ctx.db
        .query('applications')
        .withIndex('by_user', (q) => q.eq('user_id', student._id))
        .filter((q) => q.eq(q.field('company'), company.name))
        .first();

      if (!existing) {
        // Map stage to status
        let status: 'saved' | 'applied' | 'interview' = 'saved';
        if (company.stage === 'Applied') status = 'applied';
        else if (company.stage === 'Interview') status = 'interview';

        const appId = await ctx.db.insert('applications', {
          user_id: student._id,
          assigned_advisor_id: advisor._id,
          company: company.name,
          job_title: company.position,
          status: status,
          stage: company.stage,
          stage_set_at: now,
          applied_at: company.stage === 'Applied' ? now - 3 * 24 * 60 * 60 * 1000 : undefined,
          url: `https://careers.${company.name.toLowerCase()}.com/job/12345`,
          notes: `Application for ${company.position} role`,
          created_at: now,
          updated_at: now,
        });
        applicationIds.push(appId);
        console.log(`✓ Created application: ${company.name}`);
      } else {
        applicationIds.push(existing._id);
        console.log(`✓ Using existing application: ${company.name}`);
      }
    }

    // 7. Create sample goals
    const goals = [
      {
        title: 'Complete 3 technical interview practice problems weekly',
        category: 'Interview Prep',
      },
      { title: 'Update resume with recent internship experience', category: 'Resume' },
      { title: 'Apply to 5 companies per week', category: 'Applications' },
    ];

    for (const goal of goals) {
      const existing = await ctx.db
        .query('goals')
        .filter((q) =>
          q.and(q.eq(q.field('user_id'), student._id), q.eq(q.field('title'), goal.title)),
        )
        .first();

      if (!existing) {
        await ctx.db.insert('goals', {
          user_id: student._id,
          title: goal.title,
          description: `Track progress on ${goal.title.toLowerCase()}`,
          category: goal.category,
          target_date: now + 30 * 24 * 60 * 60 * 1000, // 30 days from now
          status: 'active',
          progress: 0,
          created_at: now,
          updated_at: now,
        });
        console.log(`✓ Created goal: ${goal.title}`);
      }
    }

    // 8. Create follow-ups from advisor
    const followUps = [
      {
        title: 'Review updated resume',
        description: 'Student should update resume with latest internship details for review',
        due_at: now + 3 * 24 * 60 * 60 * 1000, // 3 days
        priority: 'high' as const,
        related_type: 'general' as const,
      },
      {
        title: 'Prepare for Microsoft interview',
        description: 'Practice coding questions and system design. Schedule mock interview.',
        due_at: now + 7 * 24 * 60 * 60 * 1000, // 7 days
        priority: 'high' as const,
        related_type: 'application' as const,
      },
      {
        title: 'Follow up on Google application',
        description: 'Send follow-up email to recruiter regarding application status',
        due_at: now + 5 * 24 * 60 * 60 * 1000, // 5 days
        priority: 'medium' as const,
        related_type: 'application' as const,
      },
    ];

    for (const followUp of followUps) {
      const existing = await ctx.db
        .query('follow_ups')
        .filter((q) =>
          q.and(q.eq(q.field('user_id'), student._id), q.eq(q.field('title'), followUp.title)),
        )
        .first();

      if (!existing) {
        await ctx.db.insert('follow_ups', {
          user_id: student._id,
          owner_id: student._id,
          created_by_id: advisor._id,
          created_by_type: 'advisor' as const,
          university_id: university._id,
          title: followUp.title,
          description: followUp.description,
          due_at: followUp.due_at,
          priority: followUp.priority,
          status: 'open',
          related_type: followUp.related_type,
          created_at: now,
          updated_at: now,
        });
        console.log(`✓ Created follow-up: ${followUp.title}`);
      }
    }

    // 9. Create an advisor session
    const existingSession = await ctx.db
      .query('advisor_sessions')
      .filter((q) =>
        q.and(q.eq(q.field('student_id'), student._id), q.eq(q.field('advisor_id'), advisor._id)),
      )
      .first();

    if (!existingSession) {
      await ctx.db.insert('advisor_sessions', {
        student_id: student._id,
        advisor_id: advisor._id,
        university_id: university._id,
        title: 'Career Planning Check-in',
        scheduled_at: now + 2 * 24 * 60 * 60 * 1000, // 2 days from now
        start_at: now + 2 * 24 * 60 * 60 * 1000,
        duration_minutes: 60,
        session_type: 'career_planning',
        status: 'scheduled',
        notes: 'Discuss internship applications and interview preparation strategy',
        outcomes: [],
        visibility: 'shared',
        tasks: [],
        attachments: [],
        version: 1,
        created_at: now,
        updated_at: now,
      });
      console.log(`✓ Created advisor session`);
    } else {
      console.log(`✓ Using existing advisor session`);
    }

    console.log('\n✅ Test student setup complete!');
    console.log('\nTest Accounts:');
    console.log(`  Student: ${studentEmail}`);
    console.log(`  Advisor: ${advisorEmail}`);
    console.log('\nCreated Data:');
    console.log(`  - Student profile with university affiliation`);
    console.log(`  - Student-advisor relationship`);
    console.log(`  - Resume with sample content`);
    console.log(`  - ${applicationIds.length} job applications`);
    console.log(`  - 3 career development goals`);
    console.log(`  - ${followUps.length} advisor follow-ups`);
    console.log(`  - 1 upcoming advisor session`);
    console.log('\nYou can now sign in as the student to test:');
    console.log(`  - Resume submission and viewing`);
    console.log(`  - Application tracking`);
    console.log(`  - Follow-up tasks from advisor`);
    console.log(`  - Upcoming advisor sessions`);

    return {
      success: true,
      studentId: student._id,
      advisorId: advisor._id,
      universityId: university._id,
      resumeId,
      applicationCount: applicationIds.length,
      followUpCount: followUps.length,
    };
  },
});
