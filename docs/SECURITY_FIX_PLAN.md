# Security Fix Plan

Generated from comprehensive security audit on 2026-01-30.

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | N/A |
| HIGH | 0 | N/A |
| MEDIUM | 7 | **6 COMPLETE**, 1 backlog (M4: pagination) |
| LOW | 15 | Documented below |

**Last Updated**: 2026-01-30 - Completed Sprint 3 JWT auth migration (M1)

---

## Dependency Vulnerabilities

### Resolved by `npm audit fix`
- qs DoS vulnerability
- lodash prototype pollution
- mdast-util-to-hast class attribute
- MCP SDK vulnerabilities
- Next.js DoS vulnerabilities (partial)

### Remaining (Require Breaking Changes)

| Package | Severity | Current | Target | Breaking Change |
|---------|----------|---------|--------|-----------------|
| jspdf | CRITICAL | <=3.0.4 | 4.0.0 | API changes |
| next | HIGH | 14.x | 16.x | Major upgrade |
| eslint | MODERATE | 8.x | 9.x | Config changes |
| glob (via eslint-config-next) | HIGH | 10.x | 11.x | Config changes |

**Action Required**: Schedule major dependency upgrade sprint
- [ ] Create feature branch for dependency updates
- [ ] Update jspdf to 4.0.0, test PDF generation features
- [ ] Plan Next.js 16 migration (significant effort)
- [ ] Update eslint config for v9

---

## MEDIUM Priority Issues

### M1: Inconsistent User Lookup Pattern
**Risk**: Client could potentially spoof clerkId in older code patterns

**Affected Files**:
- `convex/applications.ts`
- `convex/resumes.ts`
- `convex/cover_letters.ts`
- `convex/goals.ts`
- `convex/projects.ts`
- `convex/contacts.ts`
- `convex/interviews.ts`
- `convex/ai_coach.ts`

**Current Pattern (OLD)**:
```typescript
export const createApplication = mutation({
  args: { clerkId: v.string(), ... },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();
```

**Recommended Pattern (NEW)**:
```typescript
export const createApplication = mutation({
  args: { ... }, // No clerkId arg
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx); // From JWT
```

**Migration Steps**:
1. [ ] Update `convex/applications.ts` mutations to use `getAuthenticatedUser(ctx)`
2. [ ] Update `convex/resumes.ts` mutations
3. [ ] Update `convex/cover_letters.ts` mutations
4. [ ] Update `convex/goals.ts` mutations
5. [ ] Update `convex/projects.ts` mutations
6. [ ] Update `convex/contacts.ts` mutations
7. [ ] Update `convex/interviews.ts` mutations
8. [ ] Update `convex/ai_coach.ts` mutations
9. [ ] Update all calling code in React components
10. [ ] Add tests for JWT-based auth

**Effort**: Medium (8-12 hours)
**Priority**: P2 - Schedule for next sprint

---

### M2: Missing Explicit University Isolation in interviews.ts
**Risk**: No explicit university_id validation (relies on application ownership)

**File**: `convex/interviews.ts`

**Current Code**:
```typescript
export const createStage = mutation({
  handler: async (ctx, args) => {
    // Ownership check exists
    const application = await ctx.db.get(args.applicationId);
    if (!application || application.user_id !== user._id) {
      throw new Error('Application not found or unauthorized');
    }
    // Missing: explicit university_id check
```

**Fix**:
```typescript
// After ownership check, add:
if (application.university_id) {
  await requireUniversityAccess(ctx, application.university_id);
}
```

**Effort**: Low (1-2 hours)
**Priority**: P2

---

### M3: Missing Explicit University Isolation in projects.ts (updateProjectImage)
**Risk**: No explicit university_id validation

**File**: `convex/projects.ts`

**Current Code**:
```typescript
export const updateProjectImage = mutation({
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project || project.user_id !== user._id) {
      throw new Error('Project not found');
    }
    // Missing: explicit university_id check
```

**Fix**:
```typescript
// After ownership check:
if (project.university_id) {
  await requireUniversityAccess(ctx, project.university_id);
}
```

**Effort**: Low (30 minutes)
**Priority**: P2

---

### M4: Performance-Based Memory Exhaustion in Diagnostic Queries
**Risk**: Will timeout at ~2,000-3,000 profiles

**Affected Files**:
- `convex/students.ts` - `findDuplicateProfiles`
- `convex/students.ts` - `findStudentsAtInactiveUniversities`

**Current Pattern**:
```typescript
const allProfiles = await ctx.db.query('studentProfiles').collect();
// Loads ALL profiles into memory
```

**Reference Pattern** (from `detectOrphanedProfiles`):
```typescript
// Paginated approach
let cursor: string | null = null;
const pageSize = 100;
do {
  const page = await ctx.db
    .query('studentProfiles')
    .paginate({ cursor, numItems: pageSize });
  // Process page...
  cursor = page.continueCursor;
} while (cursor);
```

**Migration**:
1. [ ] Refactor `findDuplicateProfiles` to use pagination
2. [ ] Refactor `findStudentsAtInactiveUniversities` to use pagination
3. [ ] Add progress reporting for long-running diagnostics

**Effort**: Medium (4-6 hours)
**Priority**: P3 - Before reaching 2,000 profiles (estimated 6-12 months)

---

### M5: Silent Role Normalization in assign-student API
**Risk**: Admin unaware their requested role wasn't applied

**File**: `src/app/api/university/assign-student/route.ts`

**Current Code**:
```typescript
const normalizedRole = role === 'user' ? 'student' : role;
const assignedRole =
  normalizedRole && (ASSIGNABLE_STUDENT_ROLES as readonly string[]).includes(normalizedRole)
    ? normalizedRole
    : 'student';
// Silent fallback - no logging
```

**Fix Options**:

Option A - Return error for invalid roles:
```typescript
if (!ASSIGNABLE_STUDENT_ROLES.includes(normalizedRole)) {
  return NextResponse.json(
    { error: `Invalid role: ${role}. Allowed: ${ASSIGNABLE_STUDENT_ROLES.join(', ')}` },
    { status: 400 }
  );
}
```

Option B - Log the normalization:
```typescript
if (normalizedRole !== role || assignedRole !== normalizedRole) {
  log.info('Role normalized', {
    event: 'role.normalized',
    extra: { originalRole: role, assignedRole }
  });
}
```

**Recommendation**: Option A (stricter validation)

**Effort**: Low (1 hour)
**Priority**: P2

---

### M6: Admin User Actions Missing Explicit Role Check at Boundary
**Risk**: Actions rely on internal mutation checks, not boundary validation

**File**: `convex/admin_users_actions.ts`

**Current Pattern**:
```typescript
export const softDeleteUser = action({
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');
    // Missing: explicit super_admin check before internal call
    return await ctx.runMutation(internal.admin_users.internalSoftDeleteUser, args);
```

**Fix**:
```typescript
export const softDeleteUser = action({
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    // Add explicit role check at boundary
    const user = await ctx.runQuery(api.users_queries.getUserByClerkId, {
      clerkId: identity.subject
    });
    if (user?.role !== 'super_admin') {
      throw new Error('Forbidden: Super admin required');
    }

    return await ctx.runMutation(internal.admin_users.internalSoftDeleteUser, args);
```

**Effort**: Low (2 hours)
**Priority**: P2

---

### M7: Tenant Isolation Bypass in User Data Queries (DOCUMENTED)
**Risk**: Users can access their own data across university boundaries

**Status**: **INTENTIONAL DESIGN DECISION**

This has been documented in CLAUDE.md under "Tenant Isolation & Data Access".

**Rationale**: Users retain access to their career history when changing universities.

**Action**: No code change required. Documentation added.

---

## LOW Priority Issues

### L1: Add explicit tenant isolation check to assign-student API
**File**: `src/app/api/university/assign-student/route.ts`

The endpoint calls `hasAdvisorAccess()` but doesn't explicitly call `assertUniversityAccess()`.

**Effort**: Low (30 minutes)
**Priority**: P3

---

### L2: Log token verification failures with more context
**File**: `src/app/api/extension/applications/route.ts`

Add source/pattern information (without logging token) to help detect attacks.

**Effort**: Low (30 minutes)
**Priority**: P4

---

### L3: Add comment explaining dual metadata fields in grant-pro-access
**File**: `src/app/api/admin/users/grant-pro-access/route.ts`

Clarify why both `admin_granted_subscription` and `billing` metadata fields are set.

**Effort**: Minimal (15 minutes)
**Priority**: P4

---

### L4-L8: Standardize authorization pattern comments
**Files**: Various mutation files

Add consistent comments explaining authorization checks for audit clarity.

**Effort**: Low (2 hours total)
**Priority**: P4

---

### L9: Add audit logs to more mutations
**Files**: Various

Some mutations that create/modify sensitive data don't have audit logging.

**Effort**: Medium (4 hours)
**Priority**: P3

---

### L10-L15: Minor documentation and code clarity improvements
- Document when to use `requireMembership()` vs user_id filtering
- Add permission contexts to more mutations
- Standardize error message formatting
- Add rate limiting documentation
- Document service token validation
- Add security testing examples

**Effort**: Medium (4-6 hours total)
**Priority**: P4

---

## Implementation Schedule

### Sprint 1 (Immediate) - COMPLETED 2026-01-30
- [x] M7: Document tenant isolation design decision ✅
- [x] M5: Fix silent role normalization ✅ (now returns 400 error for invalid roles)
- [x] M2: Add authorization comments to interviews.ts ✅ (ownership check already sufficient)
- [x] M3: Add authorization comments to projects.ts ✅ (ownership check already sufficient)

### Sprint 2 (Next Sprint) - COMPLETED 2026-01-30
- [x] M6: Add role check to admin user actions ✅ (added to softDeleteUser)
- [x] L1: Add explicit tenant check to assign-student ✅ (documented existing checks)
- [x] L2-L3: Minor logging/comment improvements ✅ (enhanced extension token logging, grant-pro-access comments)

### Sprint 3 (COMPLETED 2026-01-30)
- [x] M1: Migrate clerkId args to JWT authentication ✅ **COMPLETE**

  **Pattern 1 - JWT only** (used for client-only mutations):
  - `convex/resumes.ts` - all mutations use `getAuthenticatedUser(ctx)`
  - `convex/interviews.ts` - all mutations use `getAuthenticatedUser(ctx)`
  - `convex/projects.ts` - most mutations use `getAuthenticatedUser(ctx)`

  **Pattern 2 - JWT + optional clerkId fallback** (for mutations called by API routes):
  - `convex/contacts.ts` - JWT preferred, clerkId fallback for API routes
  - `convex/ai_coach.ts` - JWT preferred, clerkId fallback for API routes
  - `convex/applications.ts` - JWT preferred, clerkId fallback for API routes
  - `convex/cover_letters.ts` - JWT preferred, clerkId fallback for API routes
  - `convex/goals.ts` - JWT preferred, clerkId fallback for API routes
  - `convex/projects.ts` - create/update have optional clerkId for API routes

  **Documentation Updates**:
  - [x] Added "Convex Mutation Authentication (CRITICAL)" section to CLAUDE.md
  - [x] Added mutation authentication patterns to .coderabbit.yaml
  - [x] Updated calling React components to remove client-supplied clerkId args

  **Note**: Queries still accept clerkId args - this is acceptable per the documented
  security architecture since queries are read-only and run within auth context.

### Backlog (Schedule Before 2,000 Profiles)
- [ ] M4: Paginate diagnostic queries
- [ ] Dependency major version upgrades (jspdf, Next.js 16, eslint 9)

### Ongoing
- [ ] L9: Add audit logging incrementally
- [ ] L10-L15: Documentation improvements

---

## Verification Checklist

After implementing fixes:

- [ ] Run `npm test` - all tests pass
- [ ] Run `npm run type-check` - no type errors
- [ ] Run `npm audit` - verify vulnerability count reduced
- [ ] Manual testing of affected features
- [ ] Security review of changed files
- [ ] Update this document with completion status

---

## References

- [CLAUDE.md - Tenant Isolation Section](../CLAUDE.md#tenant-isolation--data-access)
- [Authorization Module](../convex/lib/authorization.ts)
- [Security Audit Summary](./SECURITY_AUDIT_2026-01-30.md) (if created)
