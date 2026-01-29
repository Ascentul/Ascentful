# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

- **Framework**: Next.js 14 (App Router, TypeScript)
- **Auth**: Clerk (JWT-based authentication)
- **Database**: Convex (realtime, typed queries/mutations)
- **UI**: Tailwind CSS + Radix UI components
- **Payments**: Clerk Billing (integrated with Stripe)
- **AI**: OpenAI API (resume analysis, career coaching)
- **Email**: SendGrid + Mailgun

## Development Commands

```bash
# Development
npm run dev                    # Start Next.js dev server (localhost:3000)
npm run build                  # Production build
npm run start                  # Start production server
npm run lint                   # Run ESLint
npm run type-check             # TypeScript type checking

# Testing
npm test                       # Run Jest tests
npm run test:watch             # Run tests in watch mode
npm run test:coverage          # Generate coverage report
npm run test:ci                # CI test run

# Seeding/Scripts
npm run seed:clerk             # Seed test users in Clerk
npm run sync:convex:roles      # Sync user roles to Convex
npm run seed:university        # Create university and assign users
npm run set:subscription       # Set subscription status in Convex
```

## Environment Setup

Copy `.env.example` to `.env.local` and configure:

**Required:**
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_JWT_ISSUER_DOMAIN` (Clerk Dashboard)
- `NEXT_PUBLIC_CONVEX_URL` (Convex deployment)

**Optional:**
- `OPENAI_API_KEY` (AI features)
- `CLERK_WEBHOOK_SECRET` (Clerk webhooks for subscription sync)
- `SENDGRID_API_KEY`, `MAILGUN_SENDING_API_KEY` (email)

⚠️ **Do not add Supabase or Stripe Payment Link variables** - project uses Clerk Billing.

### Secrets Management

See **[docs/SECRETS_MANAGEMENT.md](docs/SECRETS_MANAGEMENT.md)** for:
- Secret categories (High/Medium/Low sensitivity)
- Rotation policies and schedules
- Access control requirements
- Storage locations (Vercel, Convex, local)

**Key rules:**
- Never commit secrets to git
- Use `.env.example` as reference (contains no real values)
- High sensitivity secrets rotate every 90 days
- Rotate immediately on personnel changes or suspected compromise

## Clerk Billing Configuration

The app uses **Clerk Billing** for premium subscriptions (Stripe integration managed by Clerk).

### Setup in Clerk Dashboard

1. **Enable Billing:**
   - Go to Clerk Dashboard → Billing Settings
   - Click "Finish setup" and connect your Stripe account

2. **Create Plan:**
   - Go to Plans → "Plans for Users"
   - Create plan with key: `premium_monthly`
   - Name: "Premium Monthly" (or any display name)
   - Enable both monthly and annual billing options:
     - Monthly: $30.00/month
     - Annual: $240.00/year (billed as $20/month)

3. **Configure Webhook:**
   - Go to Webhooks → Add Endpoint
   - URL: `https://yourdomain.com/api/clerk/webhook`
   - Subscribe to events: `user.created`, `user.updated`, `user.deleted`
   - Copy the signing secret and set `CLERK_WEBHOOK_SECRET` in environment

### How It Works

1. **Pricing Page**: `/pricing` shows Clerk's `<PricingTable />` component
2. **Payment**: Clerk handles checkout, processes payment via Stripe
3. **Webhook**: Clerk sends `user.updated` event with subscription data in `publicMetadata`
4. **Sync**: Webhook handler syncs subscription to Convex (cached display data)
5. **Feature Gating**: Uses Clerk `publicMetadata` as source of truth via `useSubscription()` hook
6. **Admin Display**: Shows cached Convex fields for fast loading

### Subscription Data Architecture

```
Clerk Billing (Source of Truth - user.publicMetadata)
  ↓ user.updated webhook
Convex (Cached Display: subscription_plan, subscription_status)
  ↑ query for admin UIs
Admin Pages (Display Only)

Clerk publicMetadata
  ↓ useSubscription() hook
Feature Gating (Access Control)
```

## Architecture

### Authentication & Authorization
- **Clerk** handles authentication via JWT tokens
- **Clerk `publicMetadata.role`** is the source of truth for all authorization (see [Roles & Permissions](#roles--permissions) for details)
- Middleware (`src/middleware.ts`) protects routes and enforces role-based redirects:
  - Regular users → `/dashboard`
  - `super_admin`/`admin` → `/admin`
  - `university_admin` → `/university`
- Auth config: `convex/auth.config.ts` integrates Clerk JWT with Convex

### Database (Convex)
- Schema: `convex/schema.ts` defines all tables with typed validators
- Functions organized by domain: `convex/users.ts`, `convex/applications.ts`, etc.
- Use `useQuery()` for reads, `useMutation()` for writes
- All data access goes through Convex - **no direct database calls**

### Key Tables
- `users`: Core user profiles with roles, subscription status, university affiliation
- `universities`: Institutional licensing with seat limits
- `applications`: Job application tracking with status workflow
- `resumes`, `cover_letters`: Career documents
- `goals`, `projects`, `networking_contacts`: Career development tools
- `support_tickets`: Help desk system
- `ai_coach_conversations`, `ai_coach_messages`: AI coaching chat history

### Advisor-Student Relationships

**CONSOLIDATED**: The `student_advisors` table is now the canonical source for advisor-student relationships.

| Table | Status | Notes |
|-------|--------|-------|
| `student_advisors` | **Active** | Use for ALL new code |
| `advisorStudents` | **Deprecated** | Legacy table, being removed |

**Guidelines**:
- ALL advisor features should use `student_advisors`
- University admin `assignAdvisorToStudent` now uses `student_advisors`
- Migration script available: `npx convex run migrations/consolidate_advisor_students:migrate`
- See `docs/TECH_DEBT_ADVISOR_STUDENT_TABLES.md` for migration status

### App Structure (Next.js App Router)
- `src/app/(auth)/`: Sign-in/sign-up flows
- `src/app/(dashboard)/`: Protected routes for regular users
  - `dashboard/`: Main dashboard
  - `applications/`, `resumes/`, `cover-letters/`: Career tools
  - `goals/`, `projects/`, `contacts/`: Professional development
  - `account/`: User settings
- `src/app/(dashboard)/admin/`: Super admin panel
- `src/app/(dashboard)/university/`: University admin panel
- `src/app/api/`: API routes (Stripe webhooks, file uploads, etc.)

### Roles & Permissions

**IMPORTANT: Clerk `publicMetadata.role` is the source of truth for all authorization.**

#### Available Roles

- **`super_admin`**: Full platform access - manage all users, universities, system settings, audit logs
- **`university_admin`**: University-scoped admin - manage students and settings for assigned university only
- **`advisor`**: University advisor - view and assist students within assigned university
- **`student`**: University-affiliated user with career tools access (auto university subscription)
- **`individual`**: Non-university user with free or premium subscription
- **`staff`**: Internal staff member with support access
- **`user`**: Legacy role (being migrated to `individual`)

#### Role Management Architecture

```
Role Change Flow:
Admin Action → Clerk publicMetadata.role (Source of Truth)
                    ↓ webhook (user.updated)
              Convex users.role (Cached for Display)

Authorization Checks:
Page Component → Reads clerkUser.publicMetadata.role ✅
Admin UI Display → Reads convexUser.role (display only) 📊
```

**Key Principles:**
- ✅ Set roles in Clerk Dashboard or via Clerk API
- ✅ Authorization checks use `clerkUser.publicMetadata.role`
- ✅ Convex `users.role` is cached for display and queries only
- ❌ Never manually update Convex role without updating Clerk
- ❌ Never use Convex role for authorization decisions

#### Managing Roles

**Option 1: Via Admin UI (Recommended)**
1. Go to `/admin/settings` → "User Roles" tab
2. Find user in role management table
3. Click "Change Role" and select new role
4. System updates Clerk and syncs to Convex automatically

**Option 2: Via Clerk Dashboard**
1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Users → Find user → Public Metadata
3. Add/update: `{"role": "super_admin"}`
4. Webhook automatically syncs to Convex

**Option 3: Programmatically**
```typescript
import { clerkClient } from '@clerk/nextjs/server'

const client = await clerkClient()
await client.users.updateUserMetadata(userId, {
  publicMetadata: { role: 'super_admin' }
})
// Webhook will automatically sync to Convex
```

#### Making Someone Super Admin

To grant super admin access:
1. Update Clerk `publicMetadata.role` to `"super_admin"` (via Dashboard or API)
2. Webhook syncs to Convex automatically
3. User must log out and back in for changes to take effect
4. Verify access at `/admin`

#### Role Validation Rules

- `student`, `university_admin`, `advisor`: Require `university_id`
- `individual`: Should NOT have `university_id`
- Cannot remove last super admin
- Role changes logged in audit trail

#### Troubleshooting Role Issues

**User can't access admin pages:**
→ Check Clerk `publicMetadata.role` (not Convex role)
→ Go to `/admin/settings` → "User Roles" → "Role Diagnostics"
→ Enter user email to check role sync status

**Role mismatch between Clerk and Convex:**
→ Use "Role Diagnostics" tool to detect and fix
→ Recommended: Sync from Convex to Clerk
→ Webhook will automatically sync back to Convex

**Bulk role sync needed:**
→ Run: `npx convex run admin/syncRolesToClerk:syncAllRolesToClerk --clerkId YOUR_CLERK_ID --dryRun true`
→ Review changes, then run without `--dryRun` flag

#### Role Features & Access

| Feature | super_admin | university_admin | advisor | student | individual |
|---------|-------------|------------------|---------|---------|------------|
| Platform Settings | ✅ | ❌ | ❌ | ❌ | ❌ |
| All Users Management | ✅ | ❌ | ❌ | ❌ | ❌ |
| University Management | ✅ | ✅ (own) | ❌ | ❌ | ❌ |
| Student Management | ✅ | ✅ (own) | ✅ (assigned) | ❌ | ❌ |
| Platform Analytics | ✅ | ❌ | ❌ | ❌ | ❌ |
| University Analytics | ✅ | ✅ (own) | ✅ (own) | ❌ | ❌ |
| Audit Logs | ✅ | ❌ | ❌ | ❌ | ❌ |
| Career Tools | ✅ | ✅ | ✅ | ✅ | ✅ |

#### Protected Routes

- `/admin/*` → `super_admin` only
- `/university/*` → `university_admin`, `advisor`
- `/dashboard/*` → All authenticated users
- `/applications/*`, `/resumes/*`, `/goals/*` → All authenticated users

### TypeScript Paths
```typescript
@/*           → ./src/*
@/components  → ./src/components/*
@/lib         → ./src/lib/*
@/utils       → ./src/utils/*
@/types       → ./src/types/*
@/styles      → ./src/styles/*
convex/*      → ./convex/*
```

### Styling & Design System

**Modern Rounded Dashboard Shell:**
The app uses a floating rounded shell design with clean, modern SaaS styling:
- Light neutral background (`bg-neutral-100`) for entire viewport
- Content and sidebar inside one large rounded white shell (`rounded-shell`, `shadow-card`)
- Inner content area with slightly tinted surface (`bg-neutral-100/60`)
- All cards use `rounded-card` with `shadow-card`

**Brand Colors:**
- Primary brand: `#5371FF` (use `bg-primary-500`, `text-primary-500`)
- Primary hover: `bg-primary-700`
- Neutral grays: `neutral-100/300/500/700/900` for UI elements
- Semantic colors: `success-500`, `warning-500`, `danger-500`

**Border Radius Tokens:**
- `rounded-shell`: 24px (outer app shell, main containers)
- `rounded-card`: 18px (inner cards, panels)
- `rounded-control`: 999px (pills, buttons, inputs)

**Component Library:**
- Radix UI primitives in `src/components/ui/`
- AppShell: `src/components/AppShell.tsx` - wraps all authenticated pages
- PageHeader: `src/components/ui/page-header.tsx` - standardized page headers
- Card: Updated with default padding and rounded corners
- Button: Uses `rounded-control` and new primary colors

**Navigation:**
- Active nav items: `bg-neutral-900 text-white`
- Inactive nav items: `text-neutral-700 hover:bg-neutral-100`
- Responsive design: Mobile-first with drawer navigation on mobile

## Common Patterns

### Convex Queries/Mutations
```typescript
// In component
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";

const data = useQuery(api.moduleName.functionName, { args });
const mutation = useMutation(api.moduleName.mutationName);
```

### Auth in Components
```typescript
import { useUser } from "@clerk/nextjs";

const { user, isLoaded } = useUser();
const userRole = user?.publicMetadata?.role;
```

### Auth in API Routes
```typescript
import { auth } from "@clerk/nextjs/server";

const { userId } = await auth();
if (!userId) return new Response("Unauthorized", { status: 401 });
```

## University Lifecycle Management

### University Statuses
Universities can have the following statuses:
- `trial`: University in trial period
- `active`: Fully active university with paid license
- `expired`: License has expired
- `suspended`: Temporarily suspended by admin
- `archived`: Non-destructively disabled (preferred for real universities)
- `deleted`: Hard deleted (only for test universities)

### Safe Lifecycle Operations

**Archive (Preferred for Real Universities):**
```typescript
await archiveUniversity({ universityId })
```
- **Non-destructive**: Preserves all data (users, applications, goals, metrics)
- University becomes inactive and stops appearing in active lists
- Can be restored if needed
- Counts toward "total universities all time" metric but not "active"

**Hard Delete (Test Universities Only):**
```typescript
await hardDeleteUniversity({ universityId })
```
- **Destructive**: Permanently removes university and related data
- Only allowed for universities marked as `is_test: true`
- Deletes: university record, memberships, student profiles, invitations, departments, courses
- Unlinks users (sets `university_id` to null, marks as test users)
- Clears `university_id` from applications/goals but preserves records
- Real universities are protected by guard - will throw error directing to use archive

**Toggle Test Status:**
```typescript
await toggleTestUniversity({ universityId, isTest: boolean })
```
- Marks university as test or production
- Test universities are automatically excluded from investor metrics
- Use this before hard deleting a university for cleanup

### Investor-Facing Metrics

Centralized metrics in `convex/metrics.ts`:

```typescript
// Single query for all metrics
const metrics = await getAllMetrics({})

// Or individual queries
const totalUniversities = await getTotalUniversitiesAllTime({})
const activeUniversities = await getActiveUniversitiesCurrent({})
const archivedUniversities = await getArchivedUniversities({})
const totalUsers = await getTotalUsersAllTime({})
const activeUsers = await getActiveUsers30d({})
```

**Metric Definitions:**
- `totalUniversitiesAllTime`: Real universities with status in (trial, active, archived)
- `activeUniversitiesCurrent`: Real universities with status in (trial, active)
- `archivedUniversities`: Real universities with status = archived
- `totalUsersAllTime`: All non-test, non-internal users ever created
- `activeUsers30d`: Non-test users who logged in within 30 days, on active/trial universities

**Automatic Exclusions:**
- Test universities (`is_test = true`) never appear in metrics
- Test users (`is_test_user = true`) never appear in metrics
- Internal users (`role = "super_admin"`) never appear in metrics

### Dev Sanity Check

Verify lifecycle and metrics are working correctly:
```bash
npx convex run dev/checkMetrics:runSanityCheck --clerkId YOUR_CLERK_ID
```

This creates test data, performs operations, and validates that:
- Test universities are excluded from metrics
- Real universities count correctly
- Archive removes from active but keeps in total
- Hard delete is blocked for real universities
- Hard delete works for test universities

## AI Evaluation Framework

All AI-generated content is evaluated using a centralized evaluator model (GPT-4o-mini) combined with deterministic rule-based checks.

**Full documentation:** [docs/AI_EVALUATOR_STRATEGY.md](docs/AI_EVALUATOR_STRATEGY.md)

### Architecture

```
User Request → AI Tool (GPT-4o) → AI Output
                                     ↓
                          Pre-Evaluation Rules (Zod, length, forbidden patterns)
                                     ↓
                          Model Evaluation (GPT-4o-mini judges quality)
                                     ↓
                          Post-Evaluation Rules (threshold enforcement)
                                     ↓
                          Result: pass/fail + score + risk_flags
                                     ↓
                          Convex Storage (audit trail)
```

### Key Components

| Component | Location | Description |
|-----------|----------|-------------|
| Types | `src/lib/ai-evaluation/types.ts` | Core types, tool IDs, risk flags |
| Evaluator | `src/lib/ai-evaluation/evaluator.ts` | Main `AIEvaluator` class |
| Rubrics | `src/lib/ai-evaluation/rubrics/` | Per-tool scoring rubrics |
| Rules | `src/lib/ai-evaluation/rules/` | Pre/post evaluation rules |
| Convex | `convex/ai_evaluations.ts` | Storage, metrics, config |

### Usage in API Routes

```typescript
import { evaluate } from '@/lib/ai-evaluation';

// After AI generates output
const evalResult = await evaluate({
  tool_id: 'resume-generation',
  input: { jobDescription, userProfile },
  output: generatedResume,
  user_id: userId,  // optional
});

if (!evalResult.passed) {
  // Log, retry, or return degraded response
  console.warn('Evaluation failed:', evalResult.risk_flags);
}
```

### Risk Flags

Critical flags that block output:
- `pii_detected` - Personal identifiable information found
- `discriminatory_content` - Bias or discrimination detected
- `hallucination_detected` - Made-up facts or information
- `factual_inconsistency` - Contradicts provided context
- `safety_concern` - Potentially harmful content

### Convex Tables

- `ai_evaluations` - Stores all evaluation results with scores, flags, metadata
- `ai_evaluation_config` - Per-tool configuration overrides (thresholds, enable/disable)

### Admin Dashboard

Access at `/admin/ai-evaluations` to view:
- Pass rates by tool
- Score distributions
- Risk flag frequency
- Recent evaluation details

## Testing

- Jest configured (`jest.config.js`, `jest.setup.js`)
- Convex tests disabled (see `convex/__tests_disabled__/` - compatibility issues documented)
- Run single test: `npx jest path/to/test.spec.ts`

## Important Notes

- **No Supabase**: All legacy Supabase code is archived in `docs/legacy/supabase/`
- **Documentation**: Keep new docs in `docs/`, archive deprecated content in `docs/legacy/`
- **Scripts**: Utility scripts in `scripts/` for seeding, syncing roles, etc.
- **Protected Routes**: Always check middleware config when adding new protected routes
- **University Features**: University admins can only manage users within their `university_id`

## Deployment

- Vercel recommended (configured via `vercel.json`)
- Set all env vars in hosting provider
- Configure Stripe webhook endpoint: `/api/stripe/webhook`
- Convex deployment: Use `CONVEX_DEPLOYMENT` env var or deploy via `npx convex deploy`

---

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.

## No Workarounds Policy
NEVER implement workarounds, hacks, or band-aid fixes. Always implement clean, architecturally sound solutions.

When you encounter a problem:
1. **Understand the root cause** - Don't patch symptoms, fix the underlying issue
2. **Consider the architecture** - If the current structure doesn't support the needed behavior cleanly, restructure it
3. **Rewrite when necessary** - If a clean solution requires rewriting code, do it. A proper rewrite is better than a workaround that creates tech debt
4. **Ask if unsure** - If multiple approaches exist and you're unsure which is cleanest, ask before implementing

Examples of workarounds to AVOID:
- Adding exception lists or special cases to bypass existing logic
- Using flags or conditionals to handle edge cases that indicate structural problems
- Patching behavior in one place to fix issues caused by another place
- Any solution that requires comments like "workaround for...", "hack to fix...", "temporary fix..."

Examples of clean solutions to PREFER:
- Creating proper route groups or layouts for different access patterns
- Restructuring data flow to eliminate the need for special handling
- Refactoring components to have single responsibilities
- Moving code to the appropriate architectural layer

## Code Quality Guidelines

These guidelines prevent common mistakes and ensure clean, maintainable code.

### 1. Understand the Full Data Flow Before Writing Code

**Before inserting data:**
- Trace where the data will be read from
- Find the query that consumes the data FIRST
- Verify you're writing to the correct table (e.g., `follow_ups` vs `advisor_follow_ups`)

**Before changing routes:**
- Audit ALL links and redirects that reference those routes
- Check authorization/gate components that may redirect users
- Verify the full navigation path works end-to-end

**Example of what goes wrong:**
```
❌ Writing to table A when the query reads from table B
❌ Linking to /advisor/students when Layout.tsx redirects advisors away from /advisor/*
```

### 2. Schema is the Contract

**Always read the schema before inserting records:**
```typescript
// ALWAYS check convex/schema.ts for required fields
// before writing insert code
const schema = defineSchema({
  queue_items: defineTable({
    title: v.string(),           // Required!
    version: v.number(),         // Required!
    created_from: v.string(),    // Required!
    // ...
  })
});
```

Missing required fields cause runtime errors that are easily preventable.

### 3. One Feature, One Location

Before adding a feature, check if a similar feature exists elsewhere:
- Search the codebase for related components
- Consolidate rather than duplicate
- If duplicates exist, refactor to a single source

**Example:**
```
❌ Search bar in top bar AND search bar in content area
✅ Single search bar in top bar, remove duplicate from content
```

### 4. Authorization Flows Through Multiple Systems

This codebase has TWO sources of user data:
- **Clerk `publicMetadata`** - Source of truth for authorization
- **Convex `users` table** - Cached for display and queries

**Before implementing auth-related features:**
1. Identify which system the check reads from
2. Ensure both systems are in sync
3. Update Clerk first, let webhook sync to Convex

**Common mistake:**
```
❌ Setting role in Convex but not Clerk → Auth checks fail
✅ Set in Clerk → Webhook syncs to Convex → Both in sync
```

### 5. Complete Migrations Fully

When migrating from one pattern to another (e.g., `/university/` → `/u/`):

**DO:**
- Update ALL references to use the new pattern
- Add explicit redirects from old routes to new
- Remove or deprecate old code paths

**DON'T:**
- Leave both patterns half-working
- Assume old links will "just work"
- Mix old and new patterns in the same component

### 6. Test the Full User Journey

Before declaring work complete:
1. Login as the actual user role (not just any user)
2. Navigate the way they would (click links, don't type URLs)
3. Test the complete flow end-to-end
4. Verify on both desktop and mobile viewports

### 7. Edits Have Blast Radius

Before editing a shared component, consider:
- What else uses this component?
- How will other consumers be affected?
- Should this be a new component instead of modifying existing?

**Example:**
```
❌ Adding redirect to Layout.tsx without checking all routes that use it
✅ Check all usages, create separate layout if behavior should differ
```

### 8. Route Group Conventions

This codebase uses Next.js route groups:

| Route Group | Purpose | Layout |
|-------------|---------|--------|
| `(auth)` | Sign-in/sign-up | Minimal, no sidebar |
| `(dashboard)` | Regular user pages | `Layout.tsx` - redirects advisors to /u/ |
| `/u/*` | University workspace | `UniversityWorkspaceLayout` - for advisors/admins |
| `(shared)` | Cross-cutting pages | Shared between contexts |

**When adding routes:**
- University/advisor features → `/u/*`
- Regular user features → `(dashboard)/*`
- Don't mix contexts within a route group

## AI Code Quality Standards

These guidelines address common failure modes in AI-generated code. Follow them rigorously.

### Correctness Over Plausibility

**The "looks right but is wrong" problem:** AI code often passes happy-path tests but fails edge cases.

**Requirements:**
- Handle null/undefined explicitly - don't assume data exists
- Consider off-by-one errors in loops and array operations
- Validate assumptions about inputs - add guards where needed
- Check for race conditions in async code (especially with React state)
- Verify logic matches the actual spec, not just a plausible interpretation

**Before submitting code, verify:**
```
✓ What happens when the array is empty?
✓ What happens when the user is not found?
✓ What happens when the API returns an error?
✓ What happens on the boundary values?
✓ Does this match what the existing code expects?
```

### Security by Default

**Never assume security can be "added later."**

**Always include:**
- Input validation at system boundaries (API routes, form handlers)
- Proper authentication checks before data access
- Authorization checks (is this user allowed to access THIS resource?)
- Parameterized queries (Convex handles this, but be aware)
- Secure headers in API responses where needed

**This codebase patterns:**
```typescript
// API routes - ALWAYS check auth first
const { userId } = await auth();
if (!userId) return new Response("Unauthorized", { status: 401 });

// Convex - ALWAYS verify user can access the resource
const user = await getCurrentUser(ctx, args.clerkId);
if (resource.user_id !== user._id && user.role !== 'super_admin') {
  throw new Error('Unauthorized');
}
```

**Watch for:**
- Exposing user IDs or internal IDs in client-facing code unnecessarily
- Missing role checks on admin-only operations
- Leaking data through error messages

### Codebase Conformance

**The "context failure" problem:** Code that works but doesn't fit the existing architecture.

**Before writing new code:**
1. Search for existing utilities that do what you need
2. Check how similar features are implemented elsewhere
3. Follow established patterns for the feature type
4. Use existing abstractions rather than creating new ones

**This codebase specifics:**
- State management: Convex queries/mutations, not local state for server data
- Auth: Clerk `publicMetadata.role` for authorization, not Convex role
- UI: Radix primitives in `src/components/ui/`, not raw HTML
- Styling: Tailwind with design system tokens (`rounded-card`, `primary-500`)
- Forms: Follow existing patterns in similar forms

**Anti-patterns to avoid:**
```
❌ Creating a new date formatting utility when one exists
❌ Using raw fetch() when Convex mutations exist
❌ Inline styles when Tailwind classes exist
❌ New state management patterns (Redux, Zustand) - use Convex
❌ Different component structure than existing similar components
```

### Minimal Footprint

**The "maintainability debt" problem:** Bloated, over-abstracted, or inconsistent code.

**Principles:**
- Write the minimum code needed to solve the problem
- Don't add "nice to have" features that weren't requested
- Don't create abstractions for single-use code
- Don't add configuration options unless needed
- Match the verbosity level of surrounding code

**Avoid:**
- Generic utilities for one-time operations
- Wrapper components that just pass props through
- Configuration objects when a simple parameter works
- Comments that restate what the code does
- Types/interfaces for objects used in only one place

**Example:**
```typescript
// ❌ Over-engineered
interface UserDisplayOptions {
  showAvatar?: boolean;
  showEmail?: boolean;
  avatarSize?: 'sm' | 'md' | 'lg';
}
function UserDisplay({ user, options = {} }: { user: User; options?: UserDisplayOptions }) { ... }

// ✅ Simple and direct (if only used one way)
function UserDisplay({ user }: { user: User }) { ... }
```

### Testing and Observability

**The "missing safety net" problem:** Code without verification or debugging support.

**Requirements:**
- Error handling should be explicit, not silent failures
- Async operations need proper error states in UI
- Console.error for unexpected errors (not console.log)
- Toast notifications for user-facing errors
- Loading states for async operations

**Patterns in this codebase:**
```typescript
// Mutations with proper error handling
try {
  await mutation({ ... });
  toast({ title: 'Success', description: '...' });
} catch (error) {
  console.error('Operation failed:', error);
  toast({
    title: 'Error',
    description: error instanceof Error ? error.message : 'Operation failed',
    variant: 'destructive'
  });
}

// Queries with loading/error states
const data = useQuery(api.module.query, args);
if (data === undefined) return <Loading />;
if (data === null) return <NotFound />;
```

### React-Specific Patterns

**Common React mistakes to avoid:**

```typescript
// ❌ Setting state during render
if (condition) {
  setState(value);
}

// ✅ Use useEffect
useEffect(() => {
  if (condition) {
    setState(value);
  }
}, [condition]);

// ❌ Missing dependencies in useEffect
useEffect(() => {
  doSomething(prop);
}, []); // prop is missing

// ✅ Include all dependencies
useEffect(() => {
  doSomething(prop);
}, [prop]);

// ❌ Mutating state directly
items.push(newItem);
setItems(items);

// ✅ Create new references
setItems([...items, newItem]);

// ❌ useEffect for derived state
useEffect(() => {
  setFullName(`${firstName} ${lastName}`);
}, [firstName, lastName]);

// ✅ Compute during render or useMemo
const fullName = `${firstName} ${lastName}`;
```

### Verification Checklist

Before considering code complete, verify:

**Functional correctness:**
- [ ] Handles empty/null/undefined cases
- [ ] Handles error cases explicitly
- [ ] Logic matches the actual requirement (re-read the request)
- [ ] Edge cases considered

**Security:**
- [ ] Auth check present for protected operations
- [ ] Authorization verified (user can access THIS resource)
- [ ] No sensitive data exposed

**Codebase fit:**
- [ ] Uses existing utilities and patterns
- [ ] Follows established conventions
- [ ] No unnecessary new abstractions
- [ ] Consistent with similar features

**Maintainability:**
- [ ] Minimal code to solve the problem
- [ ] No unused code left behind
- [ ] Clear error messages
- [ ] Loading/error states handled in UI
