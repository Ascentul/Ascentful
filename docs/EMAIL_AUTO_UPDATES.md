# Auto Email Application Updates (Gmail + Outlook)

This feature lets a user opt in to scanning **incoming email metadata** (and optionally a short snippet) to suggest or automatically apply **job application stage updates** in the Applications Kanban.

## Privacy / Compliance Summary

- **Opt-in only**: no scanning occurs unless the user enables Auto Updates.
- **Least privilege**:
  - Metadata-only mode (default): provider metadata scopes only.
  - Enhanced mode: requires a reconnect to request read scopes needed for a short snippet/preview.
- **Data minimization**: no full email bodies are stored; only identifiers + subject/from + timestamps + derived signals; snippet is stored only in enhanced mode and is length-limited.
- **Server-side only**: tokens never go to the client after OAuth; stage updates happen in Convex using existing stage/status mutation logic.
- **Audit + undo**: every applied change creates an `application_stage_events` record and can be undone.

## Data Model (Convex)

- `email_integrations`: per-user provider connection, encrypted refresh token, scopes, mode, cursors.
- `email_application_signals`: per-message derived signals, matching result, and decision (`suggested` / `applied` / `dismissed` / `ignored`).
- `email_scan_events`: scan run counters + summaries.
- `application_stage_events`: stage history entries (source=`email_auto_update`) used for undo and audit.

## Required Environment Variables

### Next.js (Vercel / `.env.local`)

- `NEXT_PUBLIC_APP_URL`
- `EMAIL_OAUTH_STATE_SECRET` (OAuth state signing)
- `CONVEX_URL` / `NEXT_PUBLIC_CONVEX_URL`
- `CONVEX_INTERNAL_SERVICE_TOKEN` (must match Convex; used by webhook routes to call internal Convex mutations)
- Provider OAuth credentials used by Next.js OAuth start/callback routes:
  - `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`
  - `MICROSOFT_OAUTH_CLIENT_ID`, `MICROSOFT_OAUTH_CLIENT_SECRET`, optional `MICROSOFT_OAUTH_TENANT`
- Optional push verification:
  - `GMAIL_PUBSUB_VERIFICATION_TOKEN`

### Convex Environment

- `EMAIL_INTEGRATION_ENCRYPTION_KEY` (base64 32 bytes; encrypts OAuth refresh tokens at rest)
- `CONVEX_INTERNAL_SERVICE_TOKEN` (must match Next.js)
- Provider OAuth credentials (used by Convex actions to exchange/refresh tokens):
  - `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`
  - `MICROSOFT_OAUTH_CLIENT_ID`, `MICROSOFT_OAUTH_CLIENT_SECRET`, optional `MICROSOFT_OAUTH_TENANT`
- Optional push setup:
  - `GMAIL_PUBSUB_TOPIC` (enables Gmail watch → Pub/Sub; polling still runs regardless)
- Optional enhanced-mode AI extractor (Convex):
  - `OPENAI_API_KEY`
  - `EMAIL_AUTO_UPDATES_AI_MODEL` (default `gpt-4o-mini`)
  - `EMAIL_AUTO_UPDATES_AI_MAX_CALLS` (default `5` per scan run)

## Provider Setup Notes

### Gmail (OAuth + optional Pub/Sub push)

OAuth:
- Redirect URI: `https://<app>/api/integrations/gmail/oauth/callback`
- Scopes:
  - Metadata-only: `https://www.googleapis.com/auth/gmail.metadata`
  - Enhanced: `https://www.googleapis.com/auth/gmail.readonly`

Push (optional):
1. Create a Pub/Sub topic and grant Gmail publisher permissions.
2. Set `GMAIL_PUBSUB_TOPIC` to `projects/<project-id>/topics/<topic-name>`.
3. Create a Pub/Sub **push subscription** with endpoint:
   - `https://<app>/api/integrations/gmail/webhook?token=<GMAIL_PUBSUB_VERIFICATION_TOKEN>`

If push is not configured or fails, polling still runs every ~5 minutes.

### Outlook / Microsoft Graph (OAuth + subscription push)

OAuth:
- Redirect URI: `https://<app>/api/integrations/outlook/oauth/callback`
- Scopes:
  - Metadata-only: `Mail.ReadBasic`
  - Enhanced: `Mail.Read`
  - `offline_access` is required for background refresh tokens

Subscriptions:
- Graph calls `GET /api/integrations/outlook/webhook?validationToken=...` during validation (must be reachable publicly).
- Subscriptions are best-effort; polling is the fallback.

## Operational Notes

- Polling fallback runs via `convex/crons.ts`.
- Old `ignored`/`dismissed` signals are pruned daily (default: 180 days).
- Full deletion (tokens + signals) is available in Settings → Auto Updates.

