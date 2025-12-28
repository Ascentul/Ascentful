# Ascentul Documentation Hub

Welcome to the Ascentul docs. This repository has been reorganized to keep the project root clean and to separate current docs from legacy resources.

## Current Architecture

- Frontend: Next.js App Router (TypeScript, Tailwind)
- Auth: Clerk
- Database: Convex
- Realtime + typed queries: Convex functions and generated types

For implementation details, see the code under `src/` and `convex/`.

## Index

- Admin
  - [`docs/admin/ADMIN_STRUCTURE.md`](./admin/ADMIN_STRUCTURE.md)
- Product
  - [`docs/product/FEATURE_AUDIT.md`](./product/FEATURE_AUDIT.md)
- QA
  - [`docs/qa/CAREER_APP_BUG_CHECKLIST.md`](./qa/CAREER_APP_BUG_CHECKLIST.md)
- Operations
  - Resume version counter backfill: `npx convex run migrations:backfillResumeVersionCounter '{"dryRun": true}'`
- Migration → Next.js
  - [`docs/migration/nextjs/MIGRATION_GUIDE.md`](./migration/nextjs/MIGRATION_GUIDE.md)
  - [`docs/migration/nextjs/COMPLETE_FEATURE_MIGRATION.md`](./migration/nextjs/COMPLETE_FEATURE_MIGRATION.md)
  - [`docs/migration/nextjs/VERCEL_DEPLOYMENT_FIX.md`](./migration/nextjs/VERCEL_DEPLOYMENT_FIX.md)
- Legacy
  - Architecture (pre-Next.js, Express/Vite):
    - [`docs/legacy/architecture/REORGANIZATION.md`](./legacy/architecture/REORGANIZATION.md)
  - Supabase (deprecated)
    - [`docs/legacy/supabase/README-database.md`](./legacy/supabase/README-database.md)
    - [`docs/legacy/supabase/SUPABASE_README.md`](./legacy/supabase/SUPABASE_README.md)
    - [`docs/legacy/supabase/SUPABASE_SETUP.md`](./legacy/supabase/SUPABASE_SETUP.md)
  - Admin (deprecated)
    - [`docs/legacy/admin/ADMIN_ACCESS_GUIDE.md`](./legacy/admin/ADMIN_ACCESS_GUIDE.md)

## Legacy Notice

The project has fully migrated to Clerk + Convex. Any Supabase-related guides are archived under `docs/legacy/supabase/` and kept only for historical reference. Do not add new Supabase code, env vars, or RLS. All persistence must use Convex queries/mutations in `convex/`.

## Conventions

- New documentation should live under `docs/`.
- Archived/legacy docs must live under `docs/legacy/` with a banner at the top indicating deprecation.
- Keep the project root limited to operational files (e.g., `README.md`, configs) and avoid adding new Markdown files there.
