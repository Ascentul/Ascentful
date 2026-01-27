# Technical Debt: Consolidate Advisor-Student Relationship Tables

## Issue

**Priority**: HIGH
**Effort**: Medium-High (multiple files affected, data migration required)
**Risk**: MEDIUM - Data consistency issues possible during transition
**Impact**: Data Integrity, Developer Experience, Query Performance

## Problem

The codebase contains **two separate tables** for managing advisor-student relationships:

### Table 1: `student_advisors` (line ~921 in schema.ts)
- **Used by**: Advisor module (`convex/advisor_*.ts`)
- **References**: `users` table directly (`student_id`, `advisor_id`)
- **Features**: Ownership semantics (`is_owner`, `shared_type`), assignment tracking
- **Usage**: Caseload queries, session scheduling, document reviews

### Table 2: `advisorStudents` (line ~1245 in schema.ts)
- **Used by**: University admin module (`convex/university_admin.ts`, `convex/universities_admin.ts`)
- **References**: `studentProfiles` table (`student_profile_id`)
- **Features**: Simple roster management, no ownership semantics
- **Usage**: Bulk assignment via university admin UI

## Risks

1. **Data Consistency**: Assignments may exist in one table but not the other
2. **Developer Confusion**: Unclear which table to use for new features
3. **Query Complexity**: May need to check both tables for complete relationship data
4. **Maintenance Burden**: Bug fixes and features may need to be applied to both tables

## Current File Usage

### Files using `student_advisors`:
- `convex/advisor_students.ts` (4 usages)
- `convex/advisor_auth.ts` (2 usages)
- `convex/seed_advisor_data.ts` (1 usage)
- `convex/seed_test_student.ts` (1 usage)

### Files using `advisorStudents`:
- `convex/university_admin.ts` (1 usage)
- `convex/universities_admin.ts` (1 usage)

## Recommended Solution

### Phase 1: Interim Measures (IMMEDIATE)

1. **Add validation query** to detect inconsistencies between tables:
```typescript
// convex/admin/advisor_student_audit.ts
export const detectInconsistencies = query({
  handler: async (ctx) => {
    // Find assignments in student_advisors without corresponding advisorStudents entry
    // Find assignments in advisorStudents without corresponding student_advisors entry
    // Return discrepancies for admin review
  }
});
```

2. **Document usage guidelines** in CLAUDE.md:
   - New advisor features should use `student_advisors`
   - University admin bulk operations should use `advisorStudents` (until consolidated)
   - Always check both tables when querying "all advisors for a student"

### Phase 2: Consolidation (PLANNED)

**Target**: Consolidate to single `student_advisors` table

1. **Migration Script**: Create records in `student_advisors` for all `advisorStudents` entries
   - Map `student_profile_id` to corresponding `user_id`
   - Set `is_owner: true` for university admin assignments
   - Preserve `assigned_by_id` as `assigned_by`

2. **Update University Admin Module**:
   - Modify `convex/university_admin.ts` to use `student_advisors`
   - Modify `convex/universities_admin.ts` to use `student_advisors`

3. **Deprecate `advisorStudents`**:
   - Add deprecation warning
   - Remove table after all code is migrated
   - Update schema.ts

### Phase 3: Cleanup

1. Delete `advisorStudents` table definition from schema
2. Remove any migration/compatibility code
3. Update this documentation to mark complete

## Migration Considerations

- **Backward Compatibility**: Ensure existing university admin features work during migration
- **Data Integrity**: Verify all relationships are preserved
- **Testing**: Comprehensive testing of advisor assignment flows
- **Rollback Plan**: Keep both tables until consolidation is verified

## Schema Comparison

| Aspect | `student_advisors` | `advisorStudents` |
|--------|-------------------|-------------------|
| Student Reference | `student_id: v.id("users")` | `student_profile_id: v.id("studentProfiles")` |
| Ownership | `is_owner: v.boolean()` | None |
| Sharing | `shared_type: v.optional(...)` | None |
| Assignment Tracking | `assigned_at`, `assigned_by` | `assigned_by_id` |
| Notes | `notes: v.optional(v.string())` | None |

## Acceptance Criteria

- [x] Validation query created to detect inconsistencies
  - See: `convex/migrations/consolidate_advisor_students.ts:auditInconsistencies`
- [x] Usage guidelines documented
  - Updated schema.ts with deprecation notice
  - Updated CLAUDE.md with usage guidelines
- [x] Migration script created and tested
  - See: `convex/migrations/consolidate_advisor_students.ts`
  - Dry run: `npx convex run migrations/consolidate_advisor_students:dryRun`
  - Migrate: `npx convex run migrations/consolidate_advisor_students:migrate`
- [x] University admin module updated to use `student_advisors`
  - `university_admin.assignAdvisorToStudent` now uses `student_advisors`
  - `universities_admin.hardDeleteUniversity` deletes from both tables (cleanup)
- [x] All active queries now use `student_advisors` (verified 2025-01-26)
  - `inbox_threads.ts` - uses variable named `advisorStudents` but queries correct table
  - No active code reads from legacy `advisorStudents` table
- [ ] `advisorStudents` table deprecated and removed
  - Table is now deprecated (see schema.ts comments)
  - Will be removed after migration is verified in production
- [ ] Run migration in production
  - Run: `npx convex run migrations/consolidate_advisor_students:migrate`
  - With deletion: `npx convex run migrations/consolidate_advisor_students:migrate '{"deleteAfterMigration": true}'`
- [ ] Verify no data inconsistencies
  - Run: `npx convex run migrations/consolidate_advisor_students:auditInconsistencies`
  - Ensure `inAdvisorStudentsOnly` and `inStudentAdvisorsOnly` are empty
- [ ] Remove `advisorStudents` table from schema after production verification

## References

- Schema definitions: `convex/schema.ts` (lines ~902-924, ~1235-1248)
- Advisor module: `convex/advisor_*.ts`
- University admin: `convex/university_admin.ts`, `convex/universities_admin.ts`
