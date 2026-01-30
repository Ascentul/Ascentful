#!/usr/bin/env bash
set -euo pipefail

ENV_FLAG="${1:-}"

if [[ "$ENV_FLAG" != "" && "$ENV_FLAG" != "--prod" ]]; then
  echo "Usage: scripts/recompute-admin-caches.sh [--prod]"
  exit 1
fi

if [[ -z "${CONVEX_INTERNAL_SERVICE_TOKEN:-}" && -f ".env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source ".env.local"
  set +a
fi

if [[ -z "${CONVEX_INTERNAL_SERVICE_TOKEN:-}" ]]; then
  echo "CONVEX_INTERNAL_SERVICE_TOKEN is required (set env or add to .env.local)."
  exit 1
fi

ARGS=$(printf '{"serviceToken":"%s"}' "$CONVEX_INTERNAL_SERVICE_TOKEN")

npx convex run analytics:triggerAdminAnalyticsRecompute "$ARGS" ${ENV_FLAG}
npx convex run admin_engagement_analytics:triggerEngagementMetricsRecompute "$ARGS" ${ENV_FLAG}
npx convex run analytics:getAnalyticsCacheStatus "$ARGS" ${ENV_FLAG}
