/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as achievements from "../achievements.js";
import type * as activity from "../activity.js";
import type * as activity_events from "../activity_events.js";
import type * as admin_syncRolesToClerk from "../admin/syncRolesToClerk.js";
import type * as admin_engagement_analytics from "../admin_engagement_analytics.js";
import type * as admin_users from "../admin_users.js";
import type * as admin_users_actions from "../admin_users_actions.js";
import type * as advisor_applications from "../advisor_applications.js";
import type * as advisor_auth from "../advisor_auth.js";
import type * as advisor_availability from "../advisor_availability.js";
import type * as advisor_calendar from "../advisor_calendar.js";
import type * as advisor_comments from "../advisor_comments.js";
import type * as advisor_comments_mutations from "../advisor_comments_mutations.js";
import type * as advisor_constants from "../advisor_constants.js";
import type * as advisor_dashboard from "../advisor_dashboard.js";
import type * as advisor_dashboard_v2 from "../advisor_dashboard_v2.js";
import type * as advisor_follow_ups from "../advisor_follow_ups.js";
import type * as advisor_reviews from "../advisor_reviews.js";
import type * as advisor_reviews_mutations from "../advisor_reviews_mutations.js";
import type * as advisor_reviews_queries from "../advisor_reviews_queries.js";
import type * as advisor_sessions from "../advisor_sessions.js";
import type * as advisor_sessions_mutations from "../advisor_sessions_mutations.js";
import type * as advisor_students from "../advisor_students.js";
import type * as advisor_today from "../advisor_today.js";
import type * as ai_coach from "../ai_coach.js";
import type * as ai_evaluations from "../ai_evaluations.js";
import type * as ai_institution_config from "../ai_institution_config.js";
import type * as analytics from "../analytics.js";
import type * as applications from "../applications.js";
import type * as audit_logs from "../audit_logs.js";
import type * as avatar from "../avatar.js";
import type * as career_explorer from "../career_explorer.js";
import type * as career_paths from "../career_paths.js";
import type * as constants_advisor_flags from "../constants/advisor_flags.js";
import type * as contact_interactions from "../contact_interactions.js";
import type * as contacts from "../contacts.js";
import type * as cover_letters from "../cover_letters.js";
import type * as crons from "../crons.js";
import type * as departments from "../departments.js";
import type * as dev_assignTestStudents from "../dev/assignTestStudents.js";
import type * as dev_checkMetrics from "../dev/checkMetrics.js";
import type * as dev_seedInboxData from "../dev/seedInboxData.js";
import type * as dev_seedQueueItems from "../dev/seedQueueItems.js";
import type * as dev_seedTestUniversity from "../dev/seedTestUniversity.js";
import type * as documents from "../documents.js";
import type * as email from "../email.js";
import type * as email_auto_updates from "../email_auto_updates.js";
import type * as email_auto_updates_actions from "../email_auto_updates_actions.js";
import type * as enable_advisor_features from "../enable_advisor_features.js";
import type * as engagement_cache from "../engagement_cache.js";
import type * as engagement_definitions from "../engagement_definitions.js";
import type * as engagement_prediction from "../engagement_prediction.js";
import type * as feature_flags from "../feature_flags.js";
import type * as followups from "../followups.js";
import type * as gdpr from "../gdpr.js";
import type * as goals from "../goals.js";
import type * as graduation_outcomes from "../graduation_outcomes.js";
import type * as inbox_identity from "../inbox_identity.js";
import type * as inbox_messages from "../inbox_messages.js";
import type * as inbox_queue_integration from "../inbox_queue_integration.js";
import type * as inbox_threads from "../inbox_threads.js";
import type * as inbox_threads_mutations from "../inbox_threads_mutations.js";
import type * as interview_practice from "../interview_practice.js";
import type * as interviews from "../interviews.js";
import type * as investor_metrics from "../investor_metrics.js";
import type * as jobs from "../jobs.js";
import type * as lib_activityTracker from "../lib/activityTracker.js";
import type * as lib_auditLogger from "../lib/auditLogger.js";
import type * as lib_authorization from "../lib/authorization.js";
import type * as lib_companyAliases from "../lib/companyAliases.js";
import type * as lib_emailAutoUpdates from "../lib/emailAutoUpdates.js";
import type * as lib_emailAutoUpdatesAi from "../lib/emailAutoUpdatesAi.js";
import type * as lib_emailAutoUpdatesAiBatch from "../lib/emailAutoUpdatesAiBatch.js";
import type * as lib_emailAutoUpdatesPatterns from "../lib/emailAutoUpdatesPatterns.js";
import type * as lib_engagementHelpers from "../lib/engagementHelpers.js";
import type * as lib_engagementScoring from "../lib/engagementScoring.js";
import type * as lib_followUpConstants from "../lib/followUpConstants.js";
import type * as lib_followUpValidation from "../lib/followUpValidation.js";
import type * as lib_importUtils from "../lib/importUtils.js";
import type * as lib_logger from "../lib/logger.js";
import type * as lib_outcomeMetrics from "../lib/outcomeMetrics.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_piiSafe from "../lib/piiSafe.js";
import type * as lib_roleValidation from "../lib/roleValidation.js";
import type * as lib_roles from "../lib/roles.js";
import type * as lib_sanitizeHtml from "../lib/sanitizeHtml.js";
import type * as lib_signalConditions from "../lib/signalConditions.js";
import type * as majors from "../majors.js";
import type * as metrics from "../metrics.js";
import type * as migrate_application_sort_order from "../migrate_application_sort_order.js";
import type * as migrate_application_status_to_stage from "../migrate_application_status_to_stage.js";
import type * as migrate_follow_ups from "../migrate_follow_ups.js";
import type * as migrate_session_scheduled_at from "../migrate_session_scheduled_at.js";
import type * as migrations from "../migrations.js";
import type * as migrations_backfill_ai_coach_university_id from "../migrations/backfill_ai_coach_university_id.js";
import type * as migrations_backfill_engagement_cache from "../migrations/backfill_engagement_cache.js";
import type * as migrations_consolidate_advisor_students from "../migrations/consolidate_advisor_students.js";
import type * as migrations_migrate_user_to_individual from "../migrations/migrate_user_to_individual.js";
import type * as notifications from "../notifications.js";
import type * as password_reset from "../password_reset.js";
import type * as platform_settings from "../platform_settings.js";
import type * as projects from "../projects.js";
import type * as push_subscriptions from "../push_subscriptions.js";
import type * as queue_items from "../queue_items.js";
import type * as recommendations from "../recommendations.js";
import type * as resumes from "../resumes.js";
import type * as roleValidation from "../roleValidation.js";
import type * as search from "../search.js";
import type * as seed_activity_events from "../seed_activity_events.js";
import type * as seed_advisor_data from "../seed_advisor_data.js";
import type * as seed_outcomes_demo from "../seed_outcomes_demo.js";
import type * as seed_signals_demo from "../seed_signals_demo.js";
import type * as seed_test_student from "../seed_test_student.js";
import type * as set_advisor_role from "../set_advisor_role.js";
import type * as signal_notifications from "../signal_notifications.js";
import type * as signal_rules from "../signal_rules.js";
import type * as signals from "../signals.js";
import type * as student_advisor_auth from "../student_advisor_auth.js";
import type * as student_advisor_hub from "../student_advisor_hub.js";
import type * as student_advisor_hub_mutations from "../student_advisor_hub_mutations.js";
import type * as students from "../students.js";
import type * as students_all from "../students_all.js";
import type * as support_tickets from "../support_tickets.js";
import type * as universities from "../universities.js";
import type * as universities_admin from "../universities_admin.js";
import type * as universities_assignments from "../universities_assignments.js";
import type * as universities_queries from "../universities_queries.js";
import type * as university_admin from "../university_admin.js";
import type * as university_overview_cache from "../university_overview_cache.js";
import type * as usage from "../usage.js";
import type * as users from "../users.js";
import type * as users_core from "../users_core.js";
import type * as users_onboarding from "../users_onboarding.js";
import type * as users_profile from "../users_profile.js";
import type * as users_queries from "../users_queries.js";
import type * as users_subscriptions from "../users_subscriptions.js";
import type * as viewer from "../viewer.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  achievements: typeof achievements;
  activity: typeof activity;
  activity_events: typeof activity_events;
  "admin/syncRolesToClerk": typeof admin_syncRolesToClerk;
  admin_engagement_analytics: typeof admin_engagement_analytics;
  admin_users: typeof admin_users;
  admin_users_actions: typeof admin_users_actions;
  advisor_applications: typeof advisor_applications;
  advisor_auth: typeof advisor_auth;
  advisor_availability: typeof advisor_availability;
  advisor_calendar: typeof advisor_calendar;
  advisor_comments: typeof advisor_comments;
  advisor_comments_mutations: typeof advisor_comments_mutations;
  advisor_constants: typeof advisor_constants;
  advisor_dashboard: typeof advisor_dashboard;
  advisor_dashboard_v2: typeof advisor_dashboard_v2;
  advisor_follow_ups: typeof advisor_follow_ups;
  advisor_reviews: typeof advisor_reviews;
  advisor_reviews_mutations: typeof advisor_reviews_mutations;
  advisor_reviews_queries: typeof advisor_reviews_queries;
  advisor_sessions: typeof advisor_sessions;
  advisor_sessions_mutations: typeof advisor_sessions_mutations;
  advisor_students: typeof advisor_students;
  advisor_today: typeof advisor_today;
  ai_coach: typeof ai_coach;
  ai_evaluations: typeof ai_evaluations;
  ai_institution_config: typeof ai_institution_config;
  analytics: typeof analytics;
  applications: typeof applications;
  audit_logs: typeof audit_logs;
  avatar: typeof avatar;
  career_explorer: typeof career_explorer;
  career_paths: typeof career_paths;
  "constants/advisor_flags": typeof constants_advisor_flags;
  contact_interactions: typeof contact_interactions;
  contacts: typeof contacts;
  cover_letters: typeof cover_letters;
  crons: typeof crons;
  departments: typeof departments;
  "dev/assignTestStudents": typeof dev_assignTestStudents;
  "dev/checkMetrics": typeof dev_checkMetrics;
  "dev/seedInboxData": typeof dev_seedInboxData;
  "dev/seedQueueItems": typeof dev_seedQueueItems;
  "dev/seedTestUniversity": typeof dev_seedTestUniversity;
  documents: typeof documents;
  email: typeof email;
  email_auto_updates: typeof email_auto_updates;
  email_auto_updates_actions: typeof email_auto_updates_actions;
  enable_advisor_features: typeof enable_advisor_features;
  engagement_cache: typeof engagement_cache;
  engagement_definitions: typeof engagement_definitions;
  engagement_prediction: typeof engagement_prediction;
  feature_flags: typeof feature_flags;
  followups: typeof followups;
  gdpr: typeof gdpr;
  goals: typeof goals;
  graduation_outcomes: typeof graduation_outcomes;
  inbox_identity: typeof inbox_identity;
  inbox_messages: typeof inbox_messages;
  inbox_queue_integration: typeof inbox_queue_integration;
  inbox_threads: typeof inbox_threads;
  inbox_threads_mutations: typeof inbox_threads_mutations;
  interview_practice: typeof interview_practice;
  interviews: typeof interviews;
  investor_metrics: typeof investor_metrics;
  jobs: typeof jobs;
  "lib/activityTracker": typeof lib_activityTracker;
  "lib/auditLogger": typeof lib_auditLogger;
  "lib/authorization": typeof lib_authorization;
  "lib/companyAliases": typeof lib_companyAliases;
  "lib/emailAutoUpdates": typeof lib_emailAutoUpdates;
  "lib/emailAutoUpdatesAi": typeof lib_emailAutoUpdatesAi;
  "lib/emailAutoUpdatesAiBatch": typeof lib_emailAutoUpdatesAiBatch;
  "lib/emailAutoUpdatesPatterns": typeof lib_emailAutoUpdatesPatterns;
  "lib/engagementHelpers": typeof lib_engagementHelpers;
  "lib/engagementScoring": typeof lib_engagementScoring;
  "lib/followUpConstants": typeof lib_followUpConstants;
  "lib/followUpValidation": typeof lib_followUpValidation;
  "lib/importUtils": typeof lib_importUtils;
  "lib/logger": typeof lib_logger;
  "lib/outcomeMetrics": typeof lib_outcomeMetrics;
  "lib/permissions": typeof lib_permissions;
  "lib/piiSafe": typeof lib_piiSafe;
  "lib/roleValidation": typeof lib_roleValidation;
  "lib/roles": typeof lib_roles;
  "lib/sanitizeHtml": typeof lib_sanitizeHtml;
  "lib/signalConditions": typeof lib_signalConditions;
  majors: typeof majors;
  metrics: typeof metrics;
  migrate_application_sort_order: typeof migrate_application_sort_order;
  migrate_application_status_to_stage: typeof migrate_application_status_to_stage;
  migrate_follow_ups: typeof migrate_follow_ups;
  migrate_session_scheduled_at: typeof migrate_session_scheduled_at;
  migrations: typeof migrations;
  "migrations/backfill_ai_coach_university_id": typeof migrations_backfill_ai_coach_university_id;
  "migrations/backfill_engagement_cache": typeof migrations_backfill_engagement_cache;
  "migrations/consolidate_advisor_students": typeof migrations_consolidate_advisor_students;
  "migrations/migrate_user_to_individual": typeof migrations_migrate_user_to_individual;
  notifications: typeof notifications;
  password_reset: typeof password_reset;
  platform_settings: typeof platform_settings;
  projects: typeof projects;
  push_subscriptions: typeof push_subscriptions;
  queue_items: typeof queue_items;
  recommendations: typeof recommendations;
  resumes: typeof resumes;
  roleValidation: typeof roleValidation;
  search: typeof search;
  seed_activity_events: typeof seed_activity_events;
  seed_advisor_data: typeof seed_advisor_data;
  seed_outcomes_demo: typeof seed_outcomes_demo;
  seed_signals_demo: typeof seed_signals_demo;
  seed_test_student: typeof seed_test_student;
  set_advisor_role: typeof set_advisor_role;
  signal_notifications: typeof signal_notifications;
  signal_rules: typeof signal_rules;
  signals: typeof signals;
  student_advisor_auth: typeof student_advisor_auth;
  student_advisor_hub: typeof student_advisor_hub;
  student_advisor_hub_mutations: typeof student_advisor_hub_mutations;
  students: typeof students;
  students_all: typeof students_all;
  support_tickets: typeof support_tickets;
  universities: typeof universities;
  universities_admin: typeof universities_admin;
  universities_assignments: typeof universities_assignments;
  universities_queries: typeof universities_queries;
  university_admin: typeof university_admin;
  university_overview_cache: typeof university_overview_cache;
  usage: typeof usage;
  users: typeof users;
  users_core: typeof users_core;
  users_onboarding: typeof users_onboarding;
  users_profile: typeof users_profile;
  users_queries: typeof users_queries;
  users_subscriptions: typeof users_subscriptions;
  viewer: typeof viewer;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
