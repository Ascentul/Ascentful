# Technical Debt: Application Status/Stage Dual Field Data Consistency Risk

## Issue

**Priority**: CRITICAL
**Effort**: High (20+ files affected)
**Risk**: HIGH - Active data consistency issues

## Problem

The `applications` table has two fields tracking application state:

1. **`status`** (required): Legacy field with values `saved|applied|interview|offer|rejected`
2. **`stage`** (optional): New field with values `Prospect|Applied|Interview|Offer|Accepted|Rejected|Withdrawn|Archived`

### Critical Issues

```typescript
// convex/schema.ts (lines 342-362)
applications: defineTable({
  // DEPRECATED field (but required!)
  status: v.union(
    v.literal("saved"), // DEPRECATED: Use stage field instead
    v.literal("applied"), // DEPRECATED: Use stage field instead
    v.literal("interview"), // DEPRECATED: Use stage field instead
    v.literal("offer"), // DEPRECATED: Use stage field instead
    v.literal("rejected"), // DEPRECATED: Use stage field instead
  ),

  // PRIMARY FIELD: stage is the source of truth for application state
  // status field is maintained for backward compatibility only
  stage: v.optional(
    v.union(
      v.literal("Prospect"), // Active - researching/considering
      v.literal("Applied"), // Active - application submitted
      v.literal("Interview"), // Active - in interview process
      v.literal("Offer"), // Not Active - offer received
      v.literal("Accepted"), // Final - offer accepted (NOT ACTIVE)
      v.literal("Rejected"), // Not Active - application rejected
      v.literal("Withdrawn"), // Not Active - candidate withdrew
      v.literal("Archived"), // Not Active - archived
    ),
  ),
})
```

**The problem:**
- Comments claim `stage` is "source of truth" but `status` is required (not optional)
- No synchronization mechanism between fields
- Different code paths update different fields
- Analytics uses `status`, advisor features use `stage`
- Creates data integrity risk and query ambiguity

### Current Usage Analysis

**Files writing to `status` (12 files):**
- `convex/applications.ts` - ✅ Creates applications with both `status` AND `stage` (migration complete)
- `convex/followups.ts`
- `convex/advisor_calendar.ts`
- `convex/advisor_follow_ups.ts`
- `convex/support_tickets.ts`
- `convex/analytics.ts`
- `convex/advisor_reviews.ts`
- `convex/migrate_follow_ups.ts`
- `convex/advisor_sessions_mutations.ts`
- `convex/contact_interactions.ts`
- `convex/advisor_reviews_queries.ts`
- `convex/goals.ts`
- `convex/recommendations.ts`

**Files writing to `stage` (3 files):**
- `convex/advisor_students.ts`
- `convex/advisor_dashboard.ts`
- `convex/advisor_applications.ts`

**Files querying `status` (10 files):**
- `convex/analytics.ts` - Application status breakdown (lines 1025-1028)
- `convex/recommendations.ts` - Daily recommendations (lines 98, 152)
- `convex/advisor_calendar.ts`
- `convex/advisor_students.ts`
- `convex/support_tickets.ts`
- `convex/students.ts`
- `convex/advisor_dashboard.ts`
- `convex/advisor_reviews.ts`
- `convex/advisor_today.ts`
- `convex/advisor_reviews_queries.ts`
- `convex/applications.ts`

**Files querying `stage` (3 files):**
- `convex/advisor_applications.ts` - Application stats (lines 249-251)
- `convex/advisor_students.ts` - Offer detection (lines 172-173)
- `convex/advisor_dashboard.ts` - Offer detection (lines 63-64)

### Impact

1. **Data Inconsistency**: ~~Applications created via `convex/applications.ts` have `status` but no `stage`~~ (FIXED - now sets both fields)
2. **Reporting Discrepancies**: Analytics queries use `status`, advisor queries use `stage`
3. **Silent Failures**: Advisor features looking for `stage: "Offer"` won't find applications created with `status: "offer"`
4. **Query Ambiguity**: No clear guidance on which field to query
5. **Index Waste**: Both fields indexed (lines 418-420 in schema.ts) but inconsistently populated

### Example Data Inconsistency (Legacy Records Only)

> **Note**: This issue has been fixed for NEW applications. `convex/applications.ts` now sets both fields.
> However, LEGACY records created before the fix may still have this issue and require migration.

```typescript
// LEGACY record (created before fix)
{
  _id: "abc123",
  status: "offer",  // ✓ Set by user creation
  stage: undefined, // ❌ Never set (legacy record)
  // ... other fields
}

// Advisor query in convex/advisor_students.ts:172
const hasOffer = application.stage === "Offer"  // ❌ Returns false for legacy records!
// Should match, but doesn't because stage is undefined
```

## Recommended Solution

### Option 1: Complete Migration (RECOMMENDED)

Make `stage` the single source of truth:

1. **Create Migration Script** (`convex/migrate_application_status_to_stage.ts`):
   ```typescript
   export const backfillStage = internalMutation({
     args: {
       dryRun: v.optional(v.boolean()),
     },
     handler: async (ctx, args) => {
       const dryRun = args.dryRun ?? false;
       const now = Date.now();

       console.log(`🚀 Starting application status→stage migration (dryRun: ${dryRun})...`);

       let totalProcessed = 0;
       let migrated = 0;
       let alreadyMigrated = 0;
       let skipped = 0;
       const errors: string[] = [];

       // Get all applications at once (Convex doesn't allow multiple paginated queries)
       const applications = await ctx.db.query("applications").collect();

       for (const app of applications) {
         totalProcessed++;
         const appLabel = `app:${app._id}`;

         try {
           // Skip if stage is already set
           if (app.stage) {
             alreadyMigrated++;
             continue;
           }

           // Skip if no status to migrate from
           if (!app.status) {
             console.error(`❌ ${appLabel} has no status field - cannot migrate`);
             errors.push(`${appLabel}: missing status`);
             skipped++;
             continue;
           }

           const newStage = mapStatusToStage(app.status);
           console.log(`📝 ${appLabel}: migrating status "${app.status}" → stage "${newStage}"`);

           if (!dryRun) {
             await ctx.db.patch(app._id, {
               stage: newStage as any,
               stage_set_at: app.updated_at || app.created_at || now,
               updated_at: now,
             });
           }

           migrated++;

           if (totalProcessed % 50 === 0) {
             console.log(`Progress: ${totalProcessed} processed, ${migrated} migrated`);
           }
         } catch (error) {
           const errorMsg = `Error migrating ${appLabel}: ${error}`;
           console.error(`❌ ${errorMsg}`);
           errors.push(errorMsg);
           skipped++;
         }
       }

       const summary = {
         success: errors.length === 0,
         dryRun,
         totalProcessed,
         migrated,
         alreadyMigrated,
         skipped,
         errors,
         message: dryRun
           ? `DRY RUN: Would migrate ${migrated} applications`
           : `Successfully migrated ${migrated} applications (${alreadyMigrated} already had stage, ${skipped} skipped)`,
       };

       console.log("\n✅ Migration complete!");
       console.log(JSON.stringify(summary, null, 2));

       return summary;
     },
   });

   function mapStatusToStage(status: string): string {
     const map = {
       saved: "Prospect",
       applied: "Applied",
       interview: "Interview",
       offer: "Offer",
       rejected: "Rejected",
     };
     return map[status] || "Prospect";
   }

   export const verifyMigration = query({
     args: {},
     handler: async (ctx) => {
       const allApps = await ctx.db.query("applications").collect();
       const withoutStage = allApps.filter(app => !app.stage);
       const withStage = allApps.filter(app => app.stage);

       const result = {
         total: allApps.length,
         withStage: withStage.length,
         withoutStage: withoutStage.length,
         complete: withoutStage.length === 0,
       };

       console.log(JSON.stringify(result, null, 2));
       return result;
     },
   });
   ```

2. **Update Application Creation** (`convex/applications.ts:72`):
   ```diff
   const applicationId = await ctx.db.insert("applications", {
     user_id: user._id,
     company: args.company,
     job_title: args.job_title,
   - status: args.status,
   + status: args.status, // Keep for backward compatibility during transition
   + stage: mapStatusToStage(args.status),
   + stage_set_at: Date.now(),
     source: args.source,
     // ... other fields
   });
   ```

3. **Add Helper Function**:
   ```typescript
   function mapStatusToStage(status: string): string {
     const map = {
       saved: "Prospect",
       applied: "Applied",
       interview: "Interview",
       offer: "Offer",
       rejected: "Rejected",
     };
     return map[status] || "Prospect";
   }
   ```

4. **Update All Queries** (20+ files):
   - Replace `app.status === "applied"` with `app.stage === "Applied"`
   - Replace `app.status === "interview"` with `app.stage === "Interview"`
   - Replace `app.status === "offer"` with `app.stage === "Offer"`
   - etc.

5. **Update Schema** (after migration complete):
   ```diff
   applications: defineTable({
   - status: v.union(
   -   v.literal("saved"),
   -   v.literal("applied"),
   -   v.literal("interview"),
   -   v.literal("offer"),
   -   v.literal("rejected"),
   - ),
   + // REMOVED: Migrated to stage field
   +
   - stage: v.optional(
   + stage: v.union(  // Now required
       v.literal("Prospect"),
       v.literal("Applied"),
       v.literal("Interview"),
       v.literal("Offer"),
       v.literal("Accepted"),
       v.literal("Rejected"),
       v.literal("Withdrawn"),
       v.literal("Archived"),
     ),
   ```

6. **Remove Deprecated Index**:
   ```diff
   - .index("by_user_status", ["user_id", "status"])
   + // Removed - use by_user_stage instead
   ```

### Option 2: Transition Period with Computed Field

If immediate migration isn't feasible:

1. **Make status optional**:
   ```diff
   - status: v.union(
   + status: v.optional(v.union(
       v.literal("saved"),
       v.literal("applied"),
       v.literal("interview"),
       v.literal("offer"),
       v.literal("rejected"),
   - ),
   + )),
   ```

2. **Sync both fields in all writes**:
   ```typescript
   // In every mutation that updates status OR stage
   await ctx.db.patch(appId, {
     stage: newStage,
     status: mapStageToStatus(newStage), // Computed
     stage_set_at: Date.now(),
   });
   ```

3. **Add sync helper**:
   ```typescript
   function mapStageToStatus(stage: string): string {
     const map = {
       Prospect: "saved",
       Applied: "applied",
       Interview: "interview",
       Offer: "offer",
       Accepted: "offer", // Loses distinction between received vs accepted offer
       Rejected: "rejected",
       Withdrawn: "rejected", // Loses student-driven withdrawal semantics
       Archived: "saved", // Archives are indistinguishable from saved in legacy field
     };
     return map[stage] || "saved";
   }
   ```

> ⚠️ Semantic loss: The legacy `status` field cannot represent all `stage` values precisely.  
> - `Accepted` collapses to `offer` (no accepted vs received distinction)  
> - `Withdrawn` collapses to `rejected` (student vs employer action is lost)  
> - `Archived` collapses to `saved` (archives are no longer distinguishable)  
> If we keep this mapping, document these gaps wherever surfaced, or consider preserving the original stage alongside status for audit/analytics.

## Migration Steps

### Phase 1: Data Migration (Week 1)
1. Create migration script
2. Run migration in dev environment
3. Verify all applications have `stage` field populated
4. Run migration in production

### Phase 2: Code Updates (Week 2-3)
1. Update `convex/applications.ts` to set both fields
2. Update all 20+ query files to use `stage` instead of `status`
3. Update frontend components to use `stage`
4. Test thoroughly

### Phase 3: Cleanup (Week 4)
1. Remove `status` field from schema
2. Remove `by_user_status` index
3. Remove mapping helper functions
4. Update documentation

## Testing Strategy

1. **Pre-Migration Verification**:
   ```typescript
   // Query to find applications without stage
   const missingStage = await ctx.db
     .query("applications")
     .filter(q => q.eq(q.field("stage"), undefined))
     .collect();
   ```

2. **Post-Migration Verification**:
   ```typescript
   // Verify all applications have stage
   const allApps = await ctx.db.query("applications").collect();
   const withoutStage = allApps.filter(app => !app.stage);
   if (withoutStage.length > 0) throw new Error("Migration incomplete");
   ```

3. **Consistency Check**:
   ```typescript
   // Verify stage matches expected status mapping
   for (const app of allApps) {
     const expectedStage = mapStatusToStage(app.status);
     if (app.stage !== expectedStage) {
       console.error(`Mismatch: ${app._id} has status=${app.status} but stage=${app.stage}`);
     }
   }
   ```

## Rollback Plan

If migration causes issues:

1. **Keep status field** during entire migration
2. **Revert code changes** via git
3. **Schema remains backward compatible** (both fields present)
4. **No data loss** (status never removed until Phase 3)

## Breaking Changes

**None during transition** - both fields maintained until cleanup phase.

After Phase 3 (status field removal):
- Frontend must use `stage` instead of `status`
- API contracts change (breaking for external consumers)

## Files Requiring Updates

### High Priority (Create/Update Data)
- [x] `convex/applications.ts:72` - Application creation (critical!)
- [x] `convex/interviews.ts:84` - Interview stage creation now syncs both fields (fixed 2025-01-26)
- [x] `convex/email_auto_updates.ts` - All inserts/patches sync both fields
- [x] `convex/seed_test_student.ts` - Test data sets both fields
- [x] `convex/advisor_applications.ts` - Already uses stage
- [x] `convex/advisor_students.ts` - Has fallback pattern for transition
- [x] `convex/advisor_dashboard.ts` - Has fallback pattern for transition

### Medium Priority (Query Data)
- [ ] `convex/analytics.ts:1025-1098` - Status breakdown
- [ ] `convex/recommendations.ts:98,152` - Filters
- [ ] `convex/advisor_calendar.ts`
- [ ] `convex/support_tickets.ts`
- [ ] `convex/students.ts`
- [ ] `convex/advisor_reviews.ts`
- [ ] `convex/advisor_today.ts`
- [ ] `convex/advisor_reviews_queries.ts`

### Frontend (Unknown count)
- Search for `application.status` in `src/` directory
- Update to use `application.stage`

## References

- Schema Definition: `convex/schema.ts:342-420`
- Index Definitions: `convex/schema.ts:418-420`
- Analytics Usage: `convex/analytics.ts:1025-1098`
- Advisor Usage: `convex/advisor_applications.ts:249-251`
- Original Issue: Identified during code review (2025-11-18)

## Notes

- **2025-01-26 Status**: All write operations now sync both `status` and `stage` fields
- Query code uses fallback patterns (`app.stage === 'X' || (!app.stage && app.status === 'x')`)
- **Next Step**: Run migration to backfill legacy records, then remove fallback patterns
- Dual indexes waste storage and query performance (can be removed after migration)
- **Action Required**: Run migration script, then complete Phase 2 cleanup
