/**
 * Database migrations for schema changes
 */

import { v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { internalMutation, query } from './_generated/server';
import { maskId } from './lib/piiSafe';
import { requireSuperAdmin } from './lib/roles';

/**
 * Migrate users with role "admin" to "super_admin"
 * This is needed after removing "admin" role from the schema
 *
 * IMPORTANT - Clerk Sync Required:
 * This is a ONE-TIME legacy data migration. After running, sync roles to Clerk:
 *   npx convex run admin/syncRolesToClerk:syncAllRolesToClerk --dryRun true
 *   npx convex run admin/syncRolesToClerk:syncAllRolesToClerk --dryRun false
 */
export const migrateAdminToSuperAdmin = internalMutation({
  args: {},
  handler: async (ctx) => {
    let migratedCount = 0;
    let failedCount = 0;
    const failedUsers: Array<Id<'users'>> = [];

    // Use pagination to handle large user tables
    // Convex pagination uses isDone flag, not cursor === null, to indicate completion
    // Note: Convex paginate() accepts null for initial cursor (continueCursor returns string | null)
    const BATCH_SIZE = 100;
    let cursor: string | null = null;
    let isDone = false;
    let totalProcessed = 0;

    do {
      const page = await ctx.db.query('users').paginate({ cursor, numItems: BATCH_SIZE });

      for (const user of page.page) {
        totalProcessed++;
        // @ts-ignore - temporarily ignore type error for old "admin" role
        if (user.role === 'admin') {
          try {
            await ctx.db.patch(user._id, {
              role: 'super_admin',
              updated_at: Date.now(),
            });
            migratedCount++;
            console.log(`✓ Migrated user ${maskId(user._id)} from admin to super_admin`);
          } catch (error) {
            failedCount++;
            failedUsers.push(user._id);
            console.error(`✗ Failed to migrate user ${maskId(user._id)}:`, error);
          }
        }
      }

      cursor = page.continueCursor;
      isDone = page.isDone;
      console.log(
        `Processed batch: ${totalProcessed} users checked, ${migratedCount} migrated so far`,
      );
    } while (!isDone);

    console.log(
      `\nMigration complete: ${totalProcessed} users checked, ${migratedCount} users updated, ${failedCount} failed`,
    );
    if (failedUsers.length > 0) {
      console.log(`Failed user IDs: ${failedUsers.map((id) => maskId(id)).join(', ')}`);
    }

    return {
      success: failedCount === 0,
      migratedCount,
      failedCount,
      failedUsers,
      totalProcessed,
      message: `Migrated ${migratedCount} users from 'admin' to 'super_admin' (checked ${totalProcessed} total users)${failedCount > 0 ? ` (${failedCount} failed)` : ''}`,
    };
  },
});

/**
 * Backfill student roles and profiles
 *
 * This migration:
 * 1. Migrates legacy "user" role to "individual" or "student" based on university_id
 * 2. Creates studentProfiles for users who should be students
 * 3. Ensures all students have proper studentProfile records
 *
 * IMPORTANT - Clerk Sync Required:
 * This is a ONE-TIME legacy data migration that updates Convex roles directly.
 * Per the Clerk-first role update pattern, Clerk publicMetadata.role is the source
 * of truth for authorization. After running this migration, you MUST sync the
 * updated roles to Clerk:
 *
 *   npx convex run admin/syncRolesToClerk:syncAllRolesToClerk --dryRun true
 *   npx convex run admin/syncRolesToClerk:syncAllRolesToClerk --dryRun false
 *
 * This migration updates Convex first (instead of Clerk-first) because:
 * - It's a bulk backfill of pre-existing users who already have data in Convex
 * - The "user" role being migrated was never in Clerk (legacy role)
 * - Convex is the source of university_id which determines student vs individual
 *
 * Run via: npx convex run migrations:backfillStudentRoles
 */
export const backfillStudentRoles = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()), // If true, only logs changes without applying them
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const dryRun = args.dryRun ?? false;

    console.log(`🚀 Starting student role backfill (dryRun: ${dryRun})...`);

    // Get all users with role "user" (legacy role)
    const legacyUsers = await ctx.db
      .query('users')
      .filter((q) => q.eq(q.field('role'), 'user'))
      .collect();

    console.log(`📊 Found ${legacyUsers.length} users with legacy 'user' role`);

    let studentsConverted = 0;
    let individualsConverted = 0;
    let profilesCreated = 0;
    const errors: string[] = [];

    for (const user of legacyUsers) {
      const userLabel = `user:${user._id}`;
      try {
        // Determine if user should be a student (has university_id)
        const isStudent = !!user.university_id;

        if (isStudent) {
          // TypeScript type narrowing: assert university_id is defined
          const universityId = user.university_id!;

          // User should be a student
          console.log(`👨‍🎓 Converting ${userLabel} to student (university: ${universityId})`);

          // Validate university exists and has capacity
          const university = await ctx.db.get(universityId);
          if (!university) {
            const errorMsg = `University ${user.university_id} not found for ${userLabel}`;
            console.error(`❌ ${errorMsg}`);
            errors.push(errorMsg);
            continue;
          }

          // Status check: Log warning but proceed (backfill context)
          // These are EXISTING users who are already enrolled and using the system.
          // Skipping them would leave the database in an inconsistent state.
          // If university is inactive, admins should review these users post-migration.
          if (university.status !== 'active') {
            const warnMsg = `⚠️  University ${university.name} is ${university.status} for ${userLabel}`;
            console.warn(warnMsg);
            console.warn(`   This user is already enrolled - proceeding with migration.`);
            console.warn(`   Admin action: Review students at inactive universities and decide:`);
            console.warn(`     - Keep them as students (if university will be reactivated)`);
            console.warn(`     - Change role to "individual" (if permanently leaving university)`);
            // Continue with migration - don't skip existing enrolled users
          }

          // Check if studentProfile already exists BEFORE capacity check
          // (Capacity only increases if we create a NEW profile)
          const existingProfile = await ctx.db
            .query('studentProfiles')
            .withIndex('by_user_id', (q) => q.eq('user_id', user._id))
            .first();

          // Capacity check: Only warn if we'll actually create a profile
          // These are EXISTING users who are already enrolled and using the system.
          // Skipping them would leave the database in an inconsistent state.
          // If capacity is exceeded, university admins should increase license_seats.
          if (!existingProfile) {
            const currentUsage = university.license_used || 0;
            if (currentUsage >= university.license_seats) {
              const warnMsg = `⚠️  University ${university.name} will exceed capacity: ${currentUsage + 1}/${university.license_seats} after creating profile for ${userLabel}`;
              console.warn(warnMsg);
              console.warn(`   This user is already enrolled - proceeding with migration.`);
              console.warn(
                `   Admin action: Increase license_seats for ${university.name} to accommodate existing students.`,
              );
              // Continue with migration - don't skip existing enrolled users
            }
          }

          if (!existingProfile) {
            console.log(`  📝 Creating studentProfile for ${userLabel}`);

            if (!dryRun) {
              // Double-check immediately before insert to prevent race condition
              // If migration runs concurrently or is re-executed, this prevents duplicates
              const raceCheck = await ctx.db
                .query('studentProfiles')
                .withIndex('by_user_id', (q) => q.eq('user_id', user._id))
                .first();

              if (raceCheck) {
                console.log(`  ⚠️  Profile created by concurrent operation for ${userLabel}`);
                // Profile exists - count it as created (ensures dry run matches actual run counts)
                profilesCreated++;
              } else {
                // Safe to create profile
                // Create student profile FIRST (before updating user role)
                // CRITICAL: This ordering prevents orphaned "student" users without profiles
                // If profile creation fails, user role remains unchanged (data integrity preserved)
                await ctx.db.insert('studentProfiles', {
                  user_id: user._id,
                  university_id: universityId,
                  major: user.major,
                  // Use user account creation date as enrollment_date estimate
                  // NOTE: This is an approximation - actual enrollment may be earlier/later
                  // Real enrollment dates should be set via invite acceptance or admin import
                  enrollment_date: user.created_at,
                  status: 'active',
                  created_at: now,
                  updated_at: now,
                });

                // Increment university license usage
                // IDEMPOTENCY NOTE: This only runs when profile is actually inserted
                // If migration is re-run, the race check above (line 144) skips profile
                // creation AND this license increment, preventing double-counting
                await ctx.db.patch(universityId, {
                  license_used: (university.license_used || 0) + 1,
                  updated_at: now,
                });

                profilesCreated++;
              }
            } else {
              profilesCreated++;
            }
          } else {
            console.log(`  ✓ studentProfile already exists for ${userLabel}`);
          }

          if (!dryRun) {
            // Update role to student AFTER ensuring profile exists
            // This ensures we NEVER have a student role without a valid profile
            await ctx.db.patch(user._id, {
              role: 'student',
              subscription_plan: 'university',
              subscription_status: 'active',
              updated_at: now,
            });
          }
          studentsConverted++;
        } else {
          // User should be an individual (no university)
          console.log(`👤 Converting ${userLabel} to individual`);

          if (!dryRun) {
            await ctx.db.patch(user._id, {
              role: 'individual',
              updated_at: now,
            });
          }
          individualsConverted++;
        }
      } catch (error) {
        const errorMsg = `Error processing ${userLabel}: ${error}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    const summary = {
      success: errors.length === 0,
      dryRun,
      totalProcessed: legacyUsers.length,
      studentsConverted,
      individualsConverted,
      profilesCreated,
      errors,
      message: dryRun
        ? `DRY RUN: Would convert ${studentsConverted} students and ${individualsConverted} individuals`
        : `Successfully converted ${studentsConverted} students and ${individualsConverted} individuals`,
    };

    console.log('\n✅ Migration complete!');
    console.log(JSON.stringify(summary, null, 2));

    return summary;
  },
});

/**
 * Backfill resume version_counter for existing resumes.
 *
 * Run via: npx convex run migrations:backfillResumeVersionCounter '{"dryRun": true}'
 */
export const backfillResumeVersionCounter = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;
    const BATCH_SIZE = 100;
    let cursor: string | null = null;
    let isDone = false;
    let totalProcessed = 0;
    let updatedCount = 0;
    let alreadySetCount = 0;
    let skippedCount = 0;
    let wouldUpdateCount = 0;

    console.log(`🚀 Starting resume version_counter backfill (dryRun: ${dryRun})...`);

    do {
      const page = await ctx.db.query('resumes').paginate({ cursor, numItems: BATCH_SIZE });

      for (const resume of page.page) {
        totalProcessed++;
        if (resume.version_counter !== undefined) {
          alreadySetCount++;
          continue;
        }

        const latestVersion = await ctx.db
          .query('resume_versions')
          .withIndex('by_resume', (q) => q.eq('resume_id', resume._id))
          .order('desc')
          .first();

        const versionCounter = latestVersion?.version_number ?? 0;

        if (dryRun) {
          wouldUpdateCount++;
          console.log(
            `📝 DRY RUN: Would set version_counter=${versionCounter} for resume ${maskId(resume._id)}`,
          );
        } else {
          try {
            await ctx.db.patch(resume._id, { version_counter: versionCounter });
            updatedCount++;
          } catch (error) {
            skippedCount++;
            console.warn(
              `⚠️  Failed to update resume ${maskId(resume._id)}:`,
              error instanceof Error ? error.message : error,
            );
          }
        }
      }

      cursor = page.continueCursor;
      isDone = page.isDone;
    } while (!isDone);

    const summary = {
      success: skippedCount === 0,
      totalProcessed,
      updatedCount: dryRun ? wouldUpdateCount : updatedCount,
      alreadySetCount,
      skippedCount,
      dryRun,
    };

    console.log(
      `✅ Resume version_counter backfill complete: ${totalProcessed} checked, ${alreadySetCount} already set, ${summary.updatedCount} ${dryRun ? 'would be updated (dry run)' : 'updated'}`,
    );

    return summary;
  },
});

/**
 * List all super_admin users
 * Run via: npx convex run migrations:listSuperAdmins '{"clerkId": "your_clerk_id"}'
 */
export const listSuperAdmins = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    // Use shared authorization utility
    await requireSuperAdmin(ctx);

    // PERFORMANCE: Use by_role index for efficient query
    const superAdmins = await ctx.db
      .query('users')
      .withIndex('by_role', (q) => q.eq('role', 'super_admin'))
      .collect();

    return {
      count: superAdmins.length,
      users: superAdmins.map((u) => ({
        name: u.name,
        email: u.email,
        clerkId: u.clerkId,
        created_at: u.created_at,
      })),
    };
  },
});

/**
 * Backfill account_status for existing users
 *
 * This migration sets account_status to "active" for all users who don't have it set.
 * This must run before updating the schema to add "deleted" as a new status option.
 *
 * Run via: npx convex run migrations:backfillAccountStatus
 */
export const backfillAccountStatus = internalMutation({
  args: {},
  handler: async (ctx) => {
    console.log('Starting account_status backfill...');

    // Query all users
    const allUsers = await ctx.db.query('users').collect();

    let updatedCount = 0;
    let alreadySetCount = 0;

    for (const user of allUsers) {
      // Check if account_status is undefined or null
      if (!user.account_status) {
        await ctx.db.patch(user._id, {
          account_status: 'active',
        });
        updatedCount++;

        if (updatedCount % 10 === 0) {
          console.log(`Updated ${updatedCount} users so far...`);
        }
      } else {
        alreadySetCount++;
      }
    }

    console.log('Backfill complete!');
    console.log(`Total users: ${allUsers.length}`);
    console.log(`Updated to "active": ${updatedCount}`);
    console.log(`Already had status: ${alreadySetCount}`);

    return {
      success: true,
      total: allUsers.length,
      updated: updatedCount,
      alreadySet: alreadySetCount,
    };
  },
});

/**
 * Backfill memberships for existing users with university_id.
 *
 * Creates/updates active memberships for roles: student, advisor, university_admin.
 * Run via: npx convex run migrations:backfillMemberships
 */
export const backfillMemberships = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Note: No auth check - this is an internal mutation meant to be run from CLI
    const dryRun = args.dryRun ?? false;
    const now = Date.now();
    const supportedRoles = new Set(['student', 'advisor', 'university_admin']);

    const users = await ctx.db.query('users').collect();
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const user of users) {
      if (!user.university_id || !supportedRoles.has(user.role)) {
        skipped++;
        continue;
      }

      const existingMembership = await ctx.db
        .query('memberships')
        .withIndex('by_user_role', (q) => q.eq('user_id', user._id).eq('role', user.role as any))
        .first();

      if (!existingMembership) {
        if (!dryRun) {
          await ctx.db.insert('memberships', {
            user_id: user._id,
            university_id: user.university_id,
            role: user.role as 'student' | 'advisor' | 'university_admin',
            status: 'active',
            created_at: now,
            updated_at: now,
          });
        }
        created++;
        continue;
      }

      if (
        existingMembership.university_id !== user.university_id ||
        existingMembership.status !== 'active'
      ) {
        if (!dryRun) {
          await ctx.db.patch(existingMembership._id, {
            university_id: user.university_id,
            status: 'active',
            updated_at: now,
          });
        }
        updated++;
      } else {
        skipped++;
      }
    }

    return {
      success: true,
      created,
      updated,
      skipped,
      message: `Membership backfill complete (dryRun: ${dryRun})`,
    };
  },
});
