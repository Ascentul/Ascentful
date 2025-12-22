import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // Users table - core user profiles
  users: defineTable({
    clerkId: v.string(), // Clerk user ID
    email: v.string(),
    name: v.string(),
    username: v.optional(v.string()),
    role: v.union(
      v.literal('individual'), // Individual free/premium user (renamed from "user")
      v.literal('user'), // Legacy role - will be migrated to "individual"
      v.literal('student'), // University student with auto university plan
      v.literal('staff'),
      v.literal('university_admin'),
      v.literal('advisor'),
      v.literal('super_admin'), // Platform administrator
    ),
    // CACHED DISPLAY DATA: Subscription managed by Clerk Billing (source of truth)
    // These fields are auto-synced from Clerk via webhook for fast admin UI display
    // For feature gating, always check Clerk publicMetadata (use useSubscription() hook or checkPremiumAccess())
    subscription_plan: v.optional(
      v.union(v.literal('free'), v.literal('premium'), v.literal('university')),
    ),
    // CACHED DISPLAY DATA: Status auto-synced from Clerk Billing via webhook
    subscription_status: v.optional(
      v.union(
        v.literal('active'),
        v.literal('inactive'),
        v.literal('cancelled'),
        v.literal('past_due'),
      ),
    ),
    university_id: v.optional(v.id('universities')),
    department_id: v.optional(v.id('departments')),
    profile_image: v.optional(v.string()),
    cover_image: v.optional(v.string()),
    linkedin_url: v.optional(v.string()),
    github_url: v.optional(v.string()),
    bio: v.optional(v.string()),
    job_title: v.optional(v.string()),
    company: v.optional(v.string()),
    location: v.optional(v.string()),
    city: v.optional(v.string()),
    phone_number: v.optional(v.string()),
    website: v.optional(v.string()),
    skills: v.optional(v.string()), // Comma-separated skills
    current_position: v.optional(v.string()),
    current_company: v.optional(v.string()),
    education: v.optional(v.string()),
    education_history: v.optional(
      v.array(
        v.object({
          id: v.string(),
          school: v.optional(v.string()),
          degree: v.optional(v.string()),
          field_of_study: v.optional(v.string()),
          start_year: v.optional(v.string()),
          end_year: v.optional(v.string()),
          is_current: v.optional(v.boolean()),
          description: v.optional(v.string()),
        }),
      ),
    ),
    work_history: v.optional(
      v.array(
        v.object({
          id: v.string(),
          role: v.optional(v.string()),
          company: v.optional(v.string()),
          start_date: v.optional(v.string()),
          end_date: v.optional(v.string()),
          is_current: v.optional(v.boolean()),
          location: v.optional(v.string()),
          summary: v.optional(v.string()),
        }),
      ),
    ),
    achievements_history: v.optional(
      v.array(
        v.object({
          id: v.string(),
          title: v.optional(v.string()),
          description: v.optional(v.string()),
          date: v.optional(v.string()),
          organization: v.optional(v.string()),
        }),
      ),
    ),
    university_name: v.optional(v.string()),
    major: v.optional(v.string()),
    graduation_year: v.optional(v.string()),
    dream_job: v.optional(v.string()),
    career_goals: v.optional(v.string()),
    experience_level: v.optional(v.string()),
    industry: v.optional(v.string()),
    stripe_customer_id: v.optional(v.string()),
    stripe_subscription_id: v.optional(v.string()),
    onboarding_completed: v.optional(v.boolean()),
    completed_tasks: v.optional(v.array(v.string())), // Array of completed onboarding task IDs
    // Account activation fields
    account_status: v.optional(
      v.union(
        v.literal('pending_activation'),
        v.literal('pending_deletion'), // GDPR deletion grace period
        v.literal('active'),
        v.literal('suspended'),
        v.literal('deleted'), // Soft delete status for FERPA compliance
      ),
    ),
    activation_token: v.optional(v.string()),
    activation_expires_at: v.optional(v.number()),
    temp_password: v.optional(v.string()), // Encrypted temporary password for admin-created accounts
    created_by_admin: v.optional(v.boolean()),
    // Test user and deletion tracking
    is_test_user: v.optional(v.boolean()), // Flag for test users (can be hard deleted)
    deletion_scheduled_at: v.optional(v.number()), // When account will be permanently deleted (GDPR grace period)
    deleted_at: v.optional(v.number()), // Timestamp when soft deleted
    deleted_by: v.optional(v.id('users')), // Admin who deleted the user
    deleted_reason: v.optional(v.string()), // Reason for deletion
    restored_at: v.optional(v.number()), // Timestamp when restored from deletion
    restored_by: v.optional(v.id('users')), // Admin who restored the user
    // Password reset fields
    password_reset_token: v.optional(v.string()),
    password_reset_expires_at: v.optional(v.number()),
    // University admin notes (visible only to university admins, not to students)
    university_admin_notes: v.optional(v.string()),
    // User preferences
    hide_progress_card: v.optional(v.boolean()),
    // Activity tracking for metrics
    last_login_at: v.optional(v.number()), // Timestamp of last login (for activeUsers30d metric)
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_clerk_id', ['clerkId'])
    .index('by_email', ['email'])
    .index('by_university', ['university_id'])
    .index('by_department', ['department_id'])
    .index('by_role', ['role'])
    .index('by_account_status', ['account_status'])
    .index('by_is_test_user', ['is_test_user'])
    // SECURITY: Index for efficient activation token lookup (avoids full table scan)
    .index('by_activation_token', ['activation_token']),

  // Universities table for institutional licensing
  universities: defineTable({
    name: v.string(),
    slug: v.string(),
    logo_url: v.optional(v.string()), // URL to university logo image
    description: v.optional(v.string()),
    website: v.optional(v.string()),
    contact_email: v.optional(v.string()),
    license_plan: v.union(
      v.literal('Starter'),
      v.literal('Basic'),
      v.literal('Pro'),
      v.literal('Enterprise'),
    ),
    license_seats: v.number(),
    license_used: v.number(),
    max_students: v.optional(v.number()),
    license_start: v.number(), // timestamp
    license_end: v.optional(v.number()), // timestamp
    status: v.union(
      v.literal('active'),
      v.literal('expired'),
      v.literal('trial'),
      v.literal('suspended'),
      v.literal('archived'), // Non-destructive way to disable a university
      v.literal('deleted'), // Only for hard delete with guard
    ),
    admin_email: v.optional(v.string()),
    created_by_id: v.optional(v.id('users')),
    is_test: v.optional(v.boolean()), // Test universities can be hard deleted
    archived_at: v.optional(v.number()), // Timestamp when archived (non-destructive disable)
    deleted_at: v.optional(v.number()), // Timestamp when hard deleted (rare, guarded)
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_slug', ['slug'])
    .index('by_status', ['status'])
    .index('by_admin_email', ['admin_email']),

  // University departments
  departments: defineTable({
    university_id: v.id('universities'),
    name: v.string(),
    code: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_university', ['university_id'])
    .index('by_name', ['name']),

  // University courses (learning modules)
  courses: defineTable({
    university_id: v.id('universities'),
    department_id: v.optional(v.id('departments')),
    title: v.string(),
    category: v.optional(v.string()),
    level: v.optional(v.string()),
    published: v.boolean(),
    enrollments: v.optional(v.number()),
    completion_rate: v.optional(v.number()), // 0-100
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_university', ['university_id'])
    .index('by_department', ['department_id']),

  // Projects table for portfolio functionality
  projects: defineTable({
    user_id: v.id('users'),
    university_id: v.optional(v.id('universities')),
    title: v.string(),
    role: v.optional(v.string()),
    start_date: v.optional(v.number()), // timestamp
    end_date: v.optional(v.number()), // timestamp
    company: v.optional(v.string()),
    url: v.optional(v.string()),
    github_url: v.optional(v.string()),
    description: v.optional(v.string()),
    type: v.string(), // default: 'personal'
    image_url: v.optional(v.string()), // Legacy: base64 data URL (deprecated)
    image_storage_id: v.optional(v.id('_storage')), // Preferred: Convex storage ID for efficient image storage
    technologies: v.array(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_user', ['user_id'])
    .index('by_created_at', ['created_at'])
    // SECURITY: Tenant-scoped index for university reporting
    .index('by_university', ['university_id']),

  // Cover letters table
  cover_letters: defineTable({
    user_id: v.id('users'),
    university_id: v.optional(v.id('universities')),
    name: v.string(),
    job_title: v.string(),
    company_name: v.optional(v.string()),
    template: v.string(), // default: 'standard'
    content: v.optional(v.string()),
    closing: v.string(), // default: 'Sincerely,'
    source: v.optional(
      v.union(
        v.literal('manual'),
        v.literal('ai_generated'),
        v.literal('ai_optimized'),
        v.literal('pdf_upload'),
      ),
    ),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_user', ['user_id'])
    .index('by_created_at', ['created_at'])
    // SECURITY: Tenant-scoped index for university reporting
    .index('by_university', ['university_id']),

  // Support tickets table
  support_tickets: defineTable({
    user_id: v.id('users'),
    university_id: v.optional(v.id('universities')),
    subject: v.string(),
    category: v.string(), // default: 'general'
    priority: v.union(
      v.literal('low'),
      v.literal('medium'),
      v.literal('high'),
      v.literal('urgent'),
    ),
    department: v.string(), // default: 'support'
    contact_person: v.optional(v.string()),
    description: v.string(),
    status: v.union(
      v.literal('open'),
      v.literal('in_progress'),
      v.literal('resolved'),
      v.literal('closed'),
    ),
    ticket_type: v.string(), // default: 'regular'
    assigned_to: v.optional(v.id('users')),
    resolution: v.optional(v.string()),
    resolved_at: v.optional(v.number()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_user', ['user_id'])
    .index('by_university', ['university_id'])
    .index('by_status', ['status'])
    .index('by_created_at', ['created_at']),

  // Diagnostics table for audit log retention (optional, for export tracking)
  audit_log_exports: defineTable({
    exported_count: v.number(),
    cutoff: v.number(),
    created_at: v.number(),
    notes: v.optional(v.string()),
  }).index('by_created_at', ['created_at']),

  // Career paths table for generated career paths
  career_paths: defineTable({
    user_id: v.id('users'),
    target_role: v.string(),
    current_level: v.optional(v.string()),
    estimated_timeframe: v.optional(v.string()),
    steps: v.any(), // JSON data
    status: v.string(), // default: 'active'
    // Career Explorer 2.0 additions
    source_quiz_id: v.optional(v.id('career_quiz_results')),
    bundle_type: v.optional(
      v.union(v.literal('safe'), v.literal('ambitious'), v.literal('alternative')),
    ),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_user', ['user_id'])
    .index('by_status', ['status']),

  // ============================================================================
  // CAREER EXPLORER 2.0
  // Career exploration quiz, path planning, and advisor collaboration
  // ============================================================================

  // Career quiz results - stores AI-generated career exploration insights
  career_quiz_results: defineTable({
    user_id: v.id('users'),
    university_id: v.optional(v.id('universities')),

    // Input snapshot for reproducibility
    profile_snapshot_id: v.optional(v.string()),

    // Major context settings at time of quiz
    major_context: v.object({
      major: v.optional(v.string()),
      enabled: v.boolean(),
      closeness: v.number(), // 0-100: 0=open to anything, 100=strict to major
      open_to_unrelated: v.boolean(),
      grad_school_interest: v.optional(
        v.union(v.literal('none'), v.literal('considering'), v.literal('planning')),
      ),
    }),

    // Quiz answers (structured JSON)
    answers: v.any(), // { questionId: answer }

    // AI-generated results
    themes: v.array(
      v.object({
        name: v.string(),
        description: v.string(),
        weight: v.number(),
      }),
    ),
    recommended_directions: v.array(
      v.object({
        title: v.string(),
        fit_score: v.number(),
        reasoning: v.string(),
      }),
    ),
    roles_to_explore: v.array(
      v.object({
        role_id: v.string(),
        title: v.string(),
        reason: v.string(),
        fit_score: v.number(),
      }),
    ),
    suggested_bundles: v.array(
      v.object({
        bundle_type: v.union(v.literal('safe'), v.literal('ambitious'), v.literal('alternative')),
        name: v.string(),
        path_graph: v.any(), // { nodes: [], edges: [] }
        starter_checklist: v.array(v.string()),
      }),
    ),
    confidence_level: v.union(
      v.literal('exploration'),
      v.literal('leaning'),
      v.literal('locked_in'),
    ),

    // Metadata
    prompt_version: v.optional(v.string()),
    model_used: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_user', ['user_id'])
    .index('by_university', ['university_id']),

  // Career main paths - the student's primary career plan timeline
  career_main_paths: defineTable({
    user_id: v.id('users'),
    university_id: v.optional(v.id('universities')),

    // Path metadata
    title: v.string(),
    source: v.union(
      v.literal('manual'),
      v.literal('quiz'),
      v.literal('suggested'),
      v.literal('search'),
    ),

    // Version control for advisor collaboration
    status: v.union(v.literal('draft'), v.literal('published'), v.literal('archived')),
    version: v.number(),
    published_at: v.optional(v.number()),

    // Major context snapshot at creation
    major_context: v.optional(
      v.object({
        major: v.optional(v.string()),
        closeness: v.number(),
      }),
    ),

    // Path graph (nodes and edges)
    graph: v.any(), // { nodes: [], edges: [] }

    // Notes
    notes: v.optional(v.string()),

    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_user', ['user_id'])
    .index('by_user_status', ['user_id', 'status'])
    .index('by_university', ['university_id']),

  // Career main path steps - individual timeline steps in a main path
  career_main_path_steps: defineTable({
    path_id: v.id('career_main_paths'),
    user_id: v.id('users'),
    university_id: v.optional(v.id('universities')),

    // Position in timeline
    index: v.number(),
    timeframe: v.union(
      v.literal('6m'),
      v.literal('12m'),
      v.literal('24m'),
      v.literal('36m'),
      v.literal('semester_1'),
      v.literal('semester_2'),
      v.literal('summer'),
    ),

    // Step content
    step_type: v.union(
      v.literal('role'),
      v.literal('bridge'),
      v.literal('project'),
      v.literal('internship'),
      v.literal('certification'),
      // New step types for Career Dreamer
      v.literal('foundation_skill'),
      v.literal('portfolio_project'),
      v.literal('stepping_stone'),
      v.literal('target_role'),
    ),
    role_id: v.optional(v.string()),
    title: v.string(),
    details: v.object({
      skills_to_build: v.optional(v.array(v.string())),
      projects: v.optional(v.array(v.string())),
      certifications: v.optional(v.array(v.string())),
      experience_targets: v.optional(v.array(v.string())),
    }),

    // Notes
    notes: v.optional(v.string()),

    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_path', ['path_id'])
    .index('by_path_index', ['path_id', 'index'])
    .index('by_user', ['user_id']),

  // Saved roles - roles bookmarked by students for later reference
  saved_roles: defineTable({
    user_id: v.id('users'),
    role_id: v.string(),
    role_data: v.any(), // Snapshot of role details
    tags: v.optional(v.array(v.string())),
    created_at: v.number(),
  })
    .index('by_user', ['user_id'])
    .index('by_user_role', ['user_id', 'role_id']),

  // Career quiz drafts - save/resume quiz progress
  career_quiz_drafts: defineTable({
    user_id: v.id('users'),
    answers: v.any(), // { questionId: answer } - partial answers
    current_step: v.number(),
    started_at: v.number(),
    updated_at: v.number(),
  }).index('by_user', ['user_id']),

  // Career explorer state - 3-step wizard progress (V4)
  career_explorer_state: defineTable({
    user_id: v.id('users'),
    university_id: v.optional(v.id('universities')),

    // Step 1: Starting Role
    starting_role: v.optional(
      v.object({
        id: v.string(),
        title: v.string(),
        category: v.optional(v.string()),
      }),
    ),

    // Step 2: Skills
    skills_have: v.optional(v.array(v.string())),
    skills_want: v.optional(v.array(v.string())),

    // Step 3: Career Path (placed steps)
    placed_steps: v.optional(
      v.array(
        v.object({
          id: v.string(),
          title: v.string(),
          role_id: v.optional(v.string()),
          fit_score: v.optional(v.number()),
          index: v.number(),
        }),
      ),
    ),

    // Wizard progress
    current_step: v.number(), // 1, 2, 3, or 4
    completed_steps: v.array(v.number()),

    // Timestamps
    created_at: v.number(),
    updated_at: v.number(),
  }).index('by_user', ['user_id']),

  // Interview stages linked to applications
  interview_stages: defineTable({
    user_id: v.id('users'),
    application_id: v.id('applications'),
    title: v.string(),
    scheduled_at: v.optional(v.number()),
    outcome: v.union(
      v.literal('pending'),
      v.literal('scheduled'),
      v.literal('passed'),
      v.literal('failed'),
    ),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_application', ['application_id'])
    .index('by_user', ['user_id'])
    .index('by_scheduled_at', ['scheduled_at']),

  // ============================================================================
  // INTERVIEW PRACTICE FEATURE
  // Mock interview practice with AI-generated questions and coaching feedback
  // ============================================================================

  // Role profiles for interview practice - defines the job being practiced for
  interview_role_profiles: defineTable({
    user_id: v.id('users'),
    university_id: v.optional(v.id('universities')), // For tenant isolation
    // Input method used to create this profile
    input_type: v.union(
      v.literal('title_company'), // User entered job title + company
      v.literal('jd_text'), // User pasted job description text
      v.literal('jd_link'), // User provided link to job posting
    ),
    // Job identification
    job_title: v.string(),
    company_name: v.optional(v.string()),
    job_level: v.optional(v.string()), // entry, mid, senior, lead, etc.
    job_description_text: v.optional(v.string()), // Full JD text (if provided)
    job_url: v.optional(v.string()), // Link to job posting (if provided)
    // AI-extracted/processed data
    role_summary: v.optional(v.string()), // Brief summary of the role
    competencies: v.optional(
      v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          weight: v.number(), // 1-5 importance
          description: v.optional(v.string()),
        }),
      ),
    ),
    extracted_keywords: v.optional(v.array(v.string())),
    interview_type: v.optional(
      v.union(
        v.literal('behavioral'),
        v.literal('technical'),
        v.literal('case'),
        v.literal('mixed'),
      ),
    ),
    // Metadata
    source_notes: v.optional(v.string()), // Notes about the source (no full JD copy)
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_user', ['user_id'])
    .index('by_university', ['university_id'])
    .index('by_created_at', ['created_at']),

  // Interview practice sessions - each mock interview attempt
  interview_practice_sessions: defineTable({
    user_id: v.id('users'),
    university_id: v.optional(v.id('universities')), // For tenant isolation
    // Role reference OR embedded role data (one must be present)
    // Note: This constraint is enforced in the createSession mutation, not at schema level
    role_profile_id: v.optional(v.id('interview_role_profiles')), // Reference to saved role profile
    // Embedded role snapshot for sessions without saved role profiles
    // Populated when role_profile_id is null
    role_snapshot: v.optional(
      v.object({
        input_type: v.union(v.literal('title_company'), v.literal('jd_text'), v.literal('jd_link')),
        job_title: v.string(),
        company_name: v.optional(v.string()),
        job_level: v.optional(v.string()),
        job_description_text: v.optional(v.string()),
        job_url: v.optional(v.string()),
        role_summary: v.optional(v.string()),
        competencies: v.optional(
          v.array(
            v.object({
              id: v.string(),
              name: v.string(),
              weight: v.number(),
              description: v.optional(v.string()),
            }),
          ),
        ),
        extracted_keywords: v.optional(v.array(v.string())),
        interview_type: v.optional(
          v.union(
            v.literal('behavioral'),
            v.literal('technical'),
            v.literal('case'),
            v.literal('mixed'),
          ),
        ),
      }),
    ),
    // Session state
    status: v.union(
      v.literal('setup'), // User configuring session
      v.literal('in_progress'), // Active interview
      v.literal('completed'), // Interview finished
      v.literal('abandoned'), // User quit early
    ),
    mode: v.union(
      v.literal('neutral'), // Standard interview
      v.literal('supportive'), // Encouraging tone
      v.literal('pressure'), // Challenging tone
    ),
    // Configuration
    camera_enabled: v.boolean(),
    question_count_target: v.number(),
    current_question_index: v.number(), // 0-indexed
    // Agent state for dynamic question generation (JSON)
    agent_state: v.optional(v.any()), // { coveredCompetencies, openThreads, difficultyLevel, etc. }
    // Consent tracking for GDPR/privacy
    consent: v.object({
      mic: v.boolean(),
      camera: v.boolean(),
      timestamp: v.number(),
    }),
    // Timing
    started_at: v.optional(v.number()),
    ended_at: v.optional(v.number()),
    total_duration_ms: v.optional(v.number()),
    // Aggregate scores (populated after completion) - 1-100 scale
    overall_score: v.optional(v.number()),
    dimension_scores: v.optional(
      v.object({
        communication: v.optional(v.number()),
        relevance: v.optional(v.number()),
        specificity: v.optional(v.number()),
        structure: v.optional(v.number()),
        confidence: v.optional(v.number()),
      }),
    ),
    // Coaching summary
    coach_summary: v.optional(v.string()),
    key_takeaways: v.optional(v.array(v.string())),
    improvement_priorities: v.optional(v.array(v.string())),
    hire_signal: v.optional(
      v.union(
        v.literal('strong_yes'),
        v.literal('yes'),
        v.literal('mixed'),
        v.literal('no'),
        v.literal('strong_no'),
      ),
    ),
    // Metadata
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_user', ['user_id'])
    .index('by_user_status', ['user_id', 'status'])
    .index('by_university', ['university_id'])
    .index('by_role_profile', ['role_profile_id'])
    .index('by_created_at', ['created_at']),

  // Interview practice turns - each question/answer pair in a session
  interview_practice_turns: defineTable({
    session_id: v.id('interview_practice_sessions'),
    user_id: v.id('users'),
    university_id: v.optional(v.id('universities')), // For tenant isolation
    turn_index: v.number(), // 0-indexed position in session
    // Question details
    question_text: v.string(),
    question_type: v.union(
      v.literal('behavioral'), // "Tell me about a time..."
      v.literal('technical'), // Technical/skill-based
      v.literal('situational'), // "What would you do if..."
      v.literal('role_specific'), // Specific to the job role
      v.literal('culture'), // Culture fit questions
      v.literal('follow_up'), // Follow-up to previous answer
    ),
    question_intent: v.optional(v.string()), // What the question is trying to assess
    target_competencies: v.optional(v.array(v.string())), // Competency IDs being assessed
    evaluation_focus: v.optional(v.array(v.string())), // What to evaluate in response
    tts_audio_url: v.optional(v.string()), // TTS audio URL for question
    // User response
    user_audio_storage_id: v.optional(v.id('_storage')), // Convex storage ID for audio
    transcript_text: v.optional(v.string()), // Transcribed response text
    response_duration_ms: v.optional(v.number()),
    // Transcript analysis metadata
    transcript_meta: v.optional(
      v.object({
        words_per_minute: v.optional(v.number()),
        filler_count: v.optional(v.number()),
        filler_words: v.optional(v.any()), // Record<string, number>
        pauses: v.optional(
          v.object({
            count: v.number(),
            avg_ms: v.number(),
            max_ms: v.number(),
          }),
        ),
        duration_sec: v.optional(v.number()),
      }),
    ),
    // Content signals from response
    content_signals: v.optional(
      v.object({
        metrics_count: v.optional(v.number()), // Number of metrics/numbers mentioned
        examples_count: v.optional(v.number()), // Number of concrete examples
        star_structure_score: v.optional(v.number()), // 1-5 STAR method adherence
        relevance_score: v.optional(v.number()), // 1-5 relevance to question
        role_relevance_score: v.optional(v.number()), // 1-5 relevance to role
      }),
    ),
    // Per-turn scores (1-5 scale)
    scores: v.optional(
      v.object({
        communication: v.optional(v.number()),
        specificity: v.optional(v.number()),
        structure: v.optional(v.number()),
        role_fit: v.optional(v.number()),
        overall: v.optional(v.number()),
      }),
    ),
    // Coaching feedback
    strengths: v.optional(v.array(v.string())),
    improvements: v.optional(v.array(v.string())),
    ideal_answer: v.optional(v.string()), // Example of a strong answer
    keywords_to_include: v.optional(v.array(v.string())), // Keywords that should be mentioned
    // Follow-up tracking for agent state
    follow_up_threads_created: v.optional(v.array(v.string())),
    follow_up_threads_resolved: v.optional(v.array(v.string())),
    // Timing
    asked_at: v.number(),
    answered_at: v.optional(v.number()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_session', ['session_id'])
    .index('by_session_turn', ['session_id', 'turn_index'])
    .index('by_user', ['user_id'])
    .index('by_university', ['university_id']),

  // Interview presence samples - camera-based presence analysis (V2 feature)
  interview_presence_samples: defineTable({
    session_id: v.id('interview_practice_sessions'),
    turn_id: v.optional(v.id('interview_practice_turns')),
    user_id: v.id('users'),
    // Presence metrics captured during response
    timestamp: v.number(),
    eye_contact_score: v.optional(v.number()), // 0-100
    posture_score: v.optional(v.number()), // 0-100
    expressiveness_score: v.optional(v.number()), // 0-100
    distraction_flags: v.optional(v.array(v.string())), // e.g., ['looking_away', 'fidgeting']
    // Privacy-minded: no raw video/image data stored
    created_at: v.number(),
  })
    .index('by_session', ['session_id'])
    .index('by_turn', ['turn_id'])
    .index('by_user', ['user_id']),

  // Job searches table to track user job searches
  job_searches: defineTable({
    user_id: v.id('users'),
    keywords: v.optional(v.string()),
    location: v.optional(v.string()),
    remote_only: v.boolean(),
    results_count: v.number(),
    search_data: v.any(), // JSON data
    created_at: v.number(),
  })
    .index('by_user', ['user_id'])
    .index('by_created_at', ['created_at']),

  // Resumes table
  resumes: defineTable({
    user_id: v.id('users'),
    university_id: v.optional(v.id('universities')),
    title: v.string(),
    content: v.any(), // JSON data
    visibility: v.union(v.literal('private'), v.literal('public')),
    source: v.optional(
      v.union(
        v.literal('manual'),
        v.literal('ai_generated'),
        v.literal('ai_optimized'),
        v.literal('pdf_upload'),
      ),
    ), // Source of resume creation

    // Resume Builder 2.0: Intent and start source
    intent: v.optional(
      v.union(
        v.literal('internship'),
        v.literal('fulltime'),
        v.literal('parttime'),
        v.literal('grad_school'),
        v.literal('unsure'),
      ),
    ),
    start_source: v.optional(
      v.union(
        v.literal('profile'), // Started from Career Profile
        v.literal('upload'), // Started from PDF/DOCX upload
        v.literal('blank'), // Started blank
      ),
    ),

    // Resume Builder 2.0: Template and styling
    template_id: v.optional(
      v.union(
        v.literal('clean'),
        v.literal('modern'),
        v.literal('bold'),
        v.literal('minimal'),
        v.literal('classic'),
        v.literal('ats'),
      ),
    ), // 'clean', 'modern', 'bold', 'minimal', 'classic', 'ats'
    style_config: v.optional(
      v.object({
        font_pairing: v.optional(v.string()), // 'classic', 'modern', 'elegant', 'minimal'
        accent_color: v.optional(v.string()), // hex color
        density: v.optional(v.union(v.literal('comfortable'), v.literal('compact'))),
        heading_style: v.optional(v.union(v.literal('caps'), v.literal('title_case'))),
      }),
    ),

    // Resume Builder 2.0: Section configuration
    sections_config: v.optional(
      v.object({
        enabled_sections: v.optional(v.array(v.string())), // ['summary', 'experience', ...]
        section_order: v.optional(v.array(v.string())), // Order of sections
      }),
    ),

    // Resume Builder 2.0: Autosave tracking
    last_autosave_at: v.optional(v.number()),
    is_draft: v.optional(v.boolean()),
    version_counter: v.optional(v.number()),

    // Analysis data
    extracted_text: v.optional(v.string()), // Text extracted from uploaded PDF/DOCX
    job_description: v.optional(v.string()), // Job description for analysis
    analysis_result: v.optional(v.any()), // Analysis results (score, strengths, gaps, suggestions)
    ai_suggestions: v.optional(v.any()), // AI-generated suggestions (summary, skills)
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_user', ['user_id'])
    // SECURITY: Tenant-scoped index for university reporting
    .index('by_university', ['university_id']),

  // Resume Builder 2.0: Version history for undo support
  resume_versions: defineTable({
    resume_id: v.id('resumes'),
    user_id: v.id('users'),
    version_number: v.number(),
    version_label: v.optional(v.string()), // "Initial draft", "Before AI edit"
    content_snapshot: v.any(), // Full resume content at this point
    trigger: v.union(
      v.literal('creation'),
      v.literal('ai_edit'),
      v.literal('manual_save'),
      v.literal('section_change'),
    ),
    created_at: v.number(),
  })
    .index('by_resume', ['resume_id'])
    .index('by_resume_version', ['resume_id', 'version_number']),

  // Applications table
  applications: defineTable({
    user_id: v.id('users'),
    university_id: v.optional(v.id('universities')),
    company: v.string(),
    job_title: v.string(),
    status: v.union(
      v.literal('saved'), // DEPRECATED: Use stage field instead
      v.literal('applied'), // DEPRECATED: Use stage field instead
      v.literal('interview'), // DEPRECATED: Use stage field instead
      v.literal('offer'), // DEPRECATED: Use stage field instead
      v.literal('rejected'), // DEPRECATED: Use stage field instead
    ),
    // PRIMARY FIELD: stage is the source of truth for application state
    // status field is maintained for backward compatibility only
    // MIGRATION: Run `npx convex run migrations/backfill_application_stages` then change to v.required()
    stage: v.optional(
      v.union(
        v.literal('Prospect'), // Active - researching/considering
        v.literal('Applied'), // Active - application submitted
        v.literal('Interview'), // Active - in interview process
        v.literal('Offer'), // Active - offer received, decision pending
        v.literal('Accepted'), // Final - offer accepted
        v.literal('Rejected'), // Final - application rejected
        v.literal('Withdrawn'), // Final - candidate withdrew
        v.literal('Archived'), // Final - archived
      ),
    ),
    stage_set_at: v.optional(v.number()), // When stage was last changed
    // Manual ordering within status columns (for Kanban drag-and-drop)
    // Uses fractional indexing for efficient reordering without rewriting neighbors
    sort_order: v.optional(v.number()),
    location: v.optional(v.string()),
    source: v.optional(v.string()),
    url: v.optional(v.string()),
    notes: v.optional(v.string()),
    // Company logo URL (auto-fetched from Clearbit/Google when application is created)
    logo_url: v.optional(v.string()),
    applied_at: v.optional(v.number()),
    resume_id: v.optional(v.id('resumes')),
    cover_letter_id: v.optional(v.id('cover_letters')),
    // Advisor workflow fields
    assigned_advisor_id: v.optional(v.id('users')), // Primary advisor for this application
    next_step: v.optional(v.string()), // Next action to take
    due_date: v.optional(v.number()), // Deadline for next step
    sla_status: v.optional(
      v.union(
        v.literal('ok'), // Within SLA
        v.literal('warning'), // Approaching SLA breach
        v.literal('breach'), // Past SLA
      ),
    ),
    // Interview details
    interviews: v.optional(
      v.array(
        v.object({
          id: v.string(),
          date: v.number(), // timestamp
          interviewer: v.optional(v.string()),
          interview_type: v.optional(v.string()), // phone, technical, behavioral, etc.
          notes: v.optional(v.string()),
        }),
      ),
    ),
    // Offer details
    offer: v.optional(
      v.object({
        received_date: v.optional(v.number()),
        deadline: v.optional(v.number()), // Decision deadline
        compensation_summary: v.optional(v.string()),
        decision: v.optional(
          v.union(v.literal('pending'), v.literal('accept'), v.literal('decline')),
        ),
        start_date: v.optional(v.number()), // If accepted
      }),
    ),
    // Reason code for Rejected/Withdrawn stages (validated by updateApplicationStage mutation)
    // See convex/advisor_constants.ts for valid codes (REJECTED_REASON_CODES, WITHDRAWN_REASON_CODES)
    reason_code: v.optional(v.string()),
    // Evidence uploads (for Offer/Accepted stages) - Use Convex storage for proper access control
    evidence_storage_ids: v.optional(v.array(v.id('_storage'))), // Uploaded offer letters, etc.

    // Email auto-update tracking
    auto_created: v.optional(v.boolean()), // true if created by email auto-update
    review_status: v.optional(v.union(v.literal('confirmed'), v.literal('needs_review'))), // Review status for auto-created/updated applications
    auto_update_source_message_id: v.optional(v.string()), // For undo lookup

    // Interview round tracking (for multi-round interview emails)
    interview_round: v.optional(v.number()), // Current interview round (1, 2, 3, etc.)
    interview_round_type: v.optional(v.string()), // "phone_screen", "technical", "onsite", "final", etc.
    last_email_event_at: v.optional(v.number()), // Timestamp of last email event processed

    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_user', ['user_id'])
    .index('by_status', ['status'])
    .index('by_stage', ['stage'])
    .index('by_advisor', ['assigned_advisor_id'])
    .index('by_due_date', ['due_date']) // For overdue/upcoming queries
    .index('by_stage_due_date', ['stage', 'due_date']) // For active + overdue filtering
    // SECURITY: Tenant-scoped indexes for university reporting
    .index('by_university', ['university_id'])
    .index('by_university_stage', ['university_id', 'stage']) // University pipeline view
    .index('by_university_status', ['university_id', 'status']) // Legacy university queries
    // Kanban board indexes for efficient drag-and-drop ordering
    .index('by_user_status_order', ['user_id', 'status', 'sort_order']),

  // Unified follow-ups table (replaces followup_actions and advisor_follow_ups)
  follow_ups: defineTable({
    // Core task fields
    title: v.string(),
    description: v.optional(v.string()),
    type: v.optional(v.string()), // For backwards compatibility: 'follow_up', 'reminder', etc.
    notes: v.optional(v.string()), // Additional notes

    // Ownership & creation tracking
    user_id: v.id('users'), // Primary user (student) this task relates to
    owner_id: v.id('users'), // Who is responsible for completing it (can be student or advisor)
    created_by_id: v.optional(v.id('users')), // User who created this task (may differ from owner)
    created_by_type: v.union(
      v.literal('student'),
      v.literal('advisor'),
      v.literal('system'),
      v.literal('individual'),
    ),

    // Multi-tenancy support
    university_id: v.optional(v.id('universities')), // Null for non-university users, required for advisor-created tasks

    // Flexible relationship tracking
    // DUAL-FIELD PATTERN: This table uses both generic and typed relationship fields.
    //
    // Generic fields (used for all entity types):
    // - related_type: Indicates which entity type this follow-up relates to
    // - related_id: String version of the entity ID (enables composite index queries)
    //
    // Typed fields (used for known entity types with referential integrity):
    // - application_id: Strongly-typed ID for applications (Convex validates referential integrity)
    // - contact_id: Strongly-typed ID for networking_contacts (Convex validates referential integrity)
    //
    // USAGE PATTERN (populate BOTH when applicable):
    // 1. For applications: Set related_type='application', related_id=<id>, application_id=<id>
    // 2. For contacts: Set related_type='contact', related_id=<id>, contact_id=<id>
    // 3. For sessions/reviews/general: Set related_type + related_id only (no typed field exists)
    //
    // QUERY USAGE:
    // - Use typed indexes (by_application, by_contact) when querying a single entity type
    // - Use composite index (by_related_entity) when querying across multiple entity types
    //
    // WHY BOTH? The typed fields provide referential integrity and type safety, while the
    // generic pattern enables flexible cross-entity queries and supports entity types
    // without dedicated typed fields (session, review, general).
    related_type: v.optional(
      v.union(
        v.literal('application'),
        v.literal('contact'),
        v.literal('session'),
        v.literal('review'),
        v.literal('general'),
      ),
    ),
    related_id: v.optional(v.string()), // String representation of entity ID for composite index

    // Typed entity links (provide referential integrity for known entity types)
    application_id: v.optional(v.id('applications')),
    contact_id: v.optional(v.id('networking_contacts')),

    // Task management
    due_at: v.optional(v.number()), // Due date timestamp
    priority: v.optional(
      v.union(v.literal('low'), v.literal('medium'), v.literal('high'), v.literal('urgent')),
    ),
    status: v.union(v.literal('open'), v.literal('done')),

    // Completion audit trail
    // Note: These fields use v.union with v.null() to allow clearing via patch()
    // Setting to null clears the field when reopening a completed follow-up
    completed_at: v.optional(v.union(v.number(), v.null())),
    completed_by: v.optional(v.union(v.id('users'), v.null())),

    // Optimistic concurrency control for FERPA audit accuracy
    version: v.optional(v.number()),

    // Migration tracking - enables idempotent re-runs with force=true
    // Stores the original _id from followup_actions or advisor_follow_ups
    migrated_from_id: v.optional(v.string()),

    // Timestamps
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_user', ['user_id'])
    .index('by_owner_status', ['owner_id', 'status'])
    .index('by_university', ['university_id'])
    .index('by_application', ['application_id'])
    .index('by_contact', ['contact_id'])
    .index('by_due_at', ['due_at'])
    .index('by_owner', ['owner_id'])
    .index('by_related_entity', ['related_type', 'related_id'])
    .index('by_migrated_from', ['migrated_from_id'])
    .index('by_created_by', ['created_by_id'])
    .index('by_user_university', ['user_id', 'university_id']),

  // =============================================================================
  // DEPRECATED: Legacy followup_actions table
  // =============================================================================
  // STATUS: Deprecated - Consolidated into follow_ups table
  // MIGRATION SCRIPT: convex/migrate_follow_ups.ts (migrateFollowUps mutation)
  // USAGE: Run 'npx convex run migrate_follow_ups:migrateFollowUps' to migrate data
  // VERIFICATION: Run 'npx convex query migrate_follow_ups:verifyMigration' after migration
  //
  // NEW CODE: Must use follow_ups table - DO NOT insert/query this table
  // REMOVAL TIMELINE: After successful production migration and verification (TBD)
  //
  // NOTE: This table was replaced to consolidate student-created and advisor-created
  // follow-ups into a single unified table with better ownership tracking.
  // =============================================================================
  followup_actions: defineTable({
    user_id: v.id('users'),
    application_id: v.optional(v.id('applications')),
    contact_id: v.optional(v.id('networking_contacts')),
    type: v.string(), // default: 'follow_up'
    description: v.optional(v.string()),
    due_date: v.optional(v.number()),
    completed: v.boolean(),
    notes: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_user', ['user_id'])
    .index('by_application', ['application_id'])
    .index('by_contact', ['contact_id'])
    .index('by_due_date', ['due_date']),

  // Achievements table
  achievements: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    category: v.string(), // default: 'general'
    points: v.number(),
    created_at: v.number(),
  }).index('by_category', ['category']),

  // User achievements table for tracking user achievements
  user_achievements: defineTable({
    user_id: v.id('users'),
    achievement_id: v.id('achievements'),
    earned_at: v.number(),
    progress: v.number(), // default: 100
  })
    .index('by_user', ['user_id'])
    .index('by_achievement', ['achievement_id'])
    .index('by_user_achievement', ['user_id', 'achievement_id']),

  // Daily recommendations table
  daily_recommendations: defineTable({
    user_id: v.id('users'),
    text: v.string(),
    type: v.string(), // default: 'ai_generated'
    completed: v.boolean(),
    completed_at: v.optional(v.number()),
    priority: v.number(),
    related_entity_id: v.optional(v.string()),
    related_entity_type: v.optional(v.string()),
    notes: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_user', ['user_id'])
    .index('by_created_at', ['created_at'])
    .index('by_completed', ['completed'])
    .index('by_type', ['type']),

  // Networking contacts table (referenced in followup_actions)
  networking_contacts: defineTable({
    user_id: v.id('users'),
    university_id: v.optional(v.id('universities')),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    company: v.optional(v.string()),
    position: v.optional(v.string()),
    linkedin_url: v.optional(v.string()),
    notes: v.optional(v.string()),
    relationship: v.optional(v.string()),
    last_contact: v.optional(v.number()),
    saved: v.optional(v.boolean()), // For saved contacts filter
    tags: v.optional(v.array(v.string())), // Tags for organizing contacts
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_user', ['user_id'])
    .index('by_company', ['company'])
    // SECURITY: Tenant-scoped index for university reporting
    .index('by_university', ['university_id']),

  // Contact interactions table
  contact_interactions: defineTable({
    user_id: v.id('users'),
    contact_id: v.id('networking_contacts'),
    notes: v.optional(v.string()),
    interaction_date: v.number(),
    created_at: v.number(),
  })
    .index('by_contact', ['contact_id'])
    .index('by_user', ['user_id'])
    .index('by_interaction_date', ['interaction_date']),

  // Goals table (referenced in achievements)
  goals: defineTable({
    user_id: v.id('users'),
    university_id: v.optional(v.id('universities')),
    title: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    target_date: v.optional(v.number()),
    status: v.union(
      v.literal('not_started'),
      v.literal('in_progress'),
      v.literal('active'),
      v.literal('completed'),
      v.literal('paused'),
      v.literal('cancelled'),
    ),
    progress: v.number(), // 0-100
    checklist: v.optional(
      v.array(
        v.object({
          id: v.string(),
          text: v.string(),
          completed: v.boolean(),
        }),
      ),
    ),
    completed_at: v.optional(v.number()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_user', ['user_id'])
    .index('by_status', ['status'])
    .index('by_target_date', ['target_date'])
    // SECURITY: Tenant-scoped index for university reporting
    .index('by_university', ['university_id']),

  // AI Coach conversations table
  ai_coach_conversations: defineTable({
    user_id: v.id('users'),
    title: v.string(),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_user', ['user_id'])
    .index('by_created_at', ['created_at']),

  // AI Coach messages table
  ai_coach_messages: defineTable({
    conversation_id: v.id('ai_coach_conversations'),
    user_id: v.id('users'),
    is_user: v.boolean(),
    message: v.string(),
    timestamp: v.number(),
  })
    .index('by_conversation', ['conversation_id'])
    .index('by_user', ['user_id'])
    .index('by_timestamp', ['timestamp']),

  // Platform settings table for system-wide configuration
  platform_settings: defineTable({
    setting_key: v.string(),
    setting_value: v.any(),
    created_at: v.number(),
    updated_at: v.number(),
  }).index('by_setting_key', ['setting_key']),

  // Stripe payments table for revenue tracking
  stripe_payments: defineTable({
    user_id: v.optional(v.id('users')),
    stripe_customer_id: v.string(),
    stripe_subscription_id: v.optional(v.string()),
    stripe_invoice_id: v.optional(v.string()),
    stripe_payment_intent_id: v.optional(v.string()),
    amount: v.number(), // Amount in cents
    currency: v.string(), // e.g., 'usd'
    status: v.union(
      v.literal('succeeded'),
      v.literal('pending'),
      v.literal('failed'),
      v.literal('refunded'),
    ),
    payment_type: v.union(
      v.literal('subscription'),
      v.literal('one_time'),
      v.literal('university_license'),
    ),
    plan_name: v.optional(v.string()), // e.g., 'premium', 'university'
    interval: v.optional(v.string()), // e.g., 'month', 'year'
    description: v.optional(v.string()),
    metadata: v.optional(v.any()), // Additional Stripe metadata
    payment_date: v.number(), // Timestamp of payment
    created_at: v.number(),
  })
    .index('by_user', ['user_id'])
    .index('by_customer', ['stripe_customer_id'])
    .index('by_subscription', ['stripe_subscription_id'])
    .index('by_payment_date', ['payment_date'])
    .index('by_status', ['status']),

  // Stripe subscription events for churn tracking
  stripe_subscription_events: defineTable({
    user_id: v.optional(v.id('users')),
    stripe_customer_id: v.string(),
    stripe_subscription_id: v.string(),
    event_type: v.union(
      v.literal('created'),
      v.literal('updated'),
      v.literal('cancelled'),
      v.literal('renewed'),
      v.literal('trial_started'),
      v.literal('trial_ended'),
    ),
    subscription_status: v.union(
      v.literal('active'),
      v.literal('inactive'),
      v.literal('cancelled'),
      v.literal('past_due'),
      v.literal('trialing'),
    ),
    plan_name: v.optional(v.string()),
    amount: v.optional(v.number()), // Amount in cents
    event_date: v.number(), // Timestamp of event
    metadata: v.optional(v.any()),
    created_at: v.number(),
  })
    .index('by_user', ['user_id'])
    .index('by_customer', ['stripe_customer_id'])
    .index('by_subscription', ['stripe_subscription_id'])
    .index('by_event_date', ['event_date'])
    .index('by_event_type', ['event_type']),

  // User daily activity tracking for streak heatmap
  user_daily_activity: defineTable({
    user_id: v.id('users'),
    clerk_id: v.string(), // For faster lookups by Clerk auth
    date: v.string(), // YYYY-MM-DD in user timezone
    did_login: v.boolean(),
    did_action: v.boolean(),
    action_count: v.number(), // Total actions that day
    created_at: v.number(), // ms
    updated_at: v.number(), // ms
  })
    .index('by_clerk_date', ['clerk_id', 'date'])
    .index('by_user', ['user_id']),

  // Student profiles - links students to universities
  // Students MUST have a studentProfile to access student features
  //
  // RACE CONDITION NOTE: Convex does not support unique constraints beyond primary keys.
  // The by_user_id index is NOT a unique index - multiple profiles per user_id are technically possible.
  //
  // MITIGATION STRATEGY - Defensive double-checking:
  // Both acceptInvite mutation and backfillStudentRoles migration implement:
  // 1. Initial check for existing profile
  // 2. Double-check immediately before insert (minimizes race window to <1ms)
  // 3. Catch insert errors and fetch existing profile if present
  // 4. Application queries use .first() with .order("asc") for deterministic behavior
  //
  // MONITORING:
  // - Run periodically: npx convex run students:findDuplicateProfiles
  // - If duplicates found: Delete newer profiles, keep oldest (by created_at)
  // - See students.ts:findDuplicateProfiles for cleanup instructions
  //
  // INDEXES:
  // - by_user_id: Look up student profile by user (used by acceptInvite, findDuplicateProfiles)
  // - by_university: List all students at a university (general queries)
  // - by_university_status: Efficiently filter active/inactive students by university (recommended for dashboards)
  // - by_university_student_id: Look up student by university-specific ID (e.g., "find student S12345 at MIT")
  //     NOTE: Since student_id is optional, this index is sparse. Use by_university_status for general queries.
  // - by_status: Filter students by enrollment status (cross-university queries)
  //
  // PERFORMANCE NOTES:
  // - For university dashboards showing active students, use by_university_status index
  // - The by_university_student_id index only helps when student_id is non-null
  //
  // DATA VALIDATION:
  // - GPA must be between 0.0 and 4.0 (enforced in mutations, not schema)
  // - status must be one of: active, inactive, graduated, suspended
  //
  // This minimizes (but does not eliminate) the race window. For true uniqueness enforcement,
  // application logic must only create profiles through controlled mutations (acceptInvite, migration).
  studentProfiles: defineTable({
    user_id: v.id('users'), // Reference to users table (should be unique but not enforced)
    university_id: v.id('universities'), // REQUIRED: student must belong to a university
    student_id: v.optional(v.string()), // University-specific student ID (e.g., "S12345")
    enrollment_date: v.number(), // Timestamp when student enrolled (defaults to profile creation time)
    graduation_date: v.optional(v.number()), // Expected graduation timestamp
    major: v.optional(v.string()),
    year: v.optional(v.string()), // Freshman, Sophomore, Junior, Senior
    gpa: v.optional(v.number()), // Must be 0.0-4.0 (validated in mutations)
    status: v.union(
      v.literal('active'),
      v.literal('inactive'),
      v.literal('graduated'),
      v.literal('suspended'),
    ),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_user_id', ['user_id'])
    .index('by_university', ['university_id'])
    .index('by_university_status', ['university_id', 'status'])
    .index('by_university_student_id', ['university_id', 'student_id'])
    .index('by_status', ['status']),

  // Student invites - token-based invite system for students
  //
  // RACE CONDITION MITIGATION:
  // 1. Invite creation: Uses optimistic concurrency control (see students.ts:createInviteInternal)
  //    - Pre-check for existing pending invite
  //    - Post-insert verification to detect concurrent creates
  //    - Auto-cleanup of duplicates (keep oldest, delete newer)
  //    - Monitoring via students:detectDuplicateInvites
  //
  // 2. Invite acceptance: Re-checks status before update (see students.ts:acceptInvite)
  //    - Initial status check (early validation)
  //    - Re-fetch invite before final status update
  //    - Verify status is still "pending" before accepting
  //
  // These patterns minimize (but cannot eliminate) race conditions without database UNIQUE constraints.
  //
  // INDEXES (Optimized - verified usage 2025-11-11):
  // - by_university_email_status: Duplicate detection (PRIMARY - line 286 in students.ts)
  // - by_created_by: Admin view "invites I created" (lines 305, 1034 in students.ts)
  // - by_token: Look up invite by token (lines 387, 661 in students.ts)
  // - by_status: Filter by status for diagnostics (lines 704, 1199 in students.ts)
  // - by_expires_at: Cron job to auto-expire old invites (line 1081 in students.ts)
  //
  // INDEX OPTIMIZATION NOTES:
  // Write performance: Reduced from 8 to 5 indexes (37.5% reduction in write amplification)
  // Removed redundant indexes where compound indexes serve prefix queries:
  //   ✗ by_email - Compound by_university_email_status serves prefix queries
  //   ✗ by_email_status - Compound by_university_email_status serves prefix queries
  //   ✗ by_university - Compound by_university_email_status serves prefix queries
  //   ✗ by_token_status - by_token + filter is sufficient (token is unique, status check is trivial)
  //
  // QUERY PERFORMANCE:
  // - by_university_email_status: O(1) lookups for duplicate checking (most common operation)
  // - by_token: O(1) lookups for invite acceptance (critical path)
  // - by_created_by: O(n) where n = invites by admin (acceptable for admin UI)
  // - by_expires_at: O(n) where n = expired invites (runs hourly, low volume)
  //
  // Trade-off: Invite creation is infrequent (~1-10/day per university), so we optimize
  // for query performance. If write volume increases, consider removing by_status.
  studentInvites: defineTable({
    university_id: v.id('universities'), // University issuing the invite
    email: v.string(), // Email of the invited student
    token: v.string(), // Unique invite token (should be unique but not enforced)
    created_by_id: v.id('users'), // University admin who created the invite
    status: v.union(
      v.literal('pending'),
      v.literal('accepted'),
      v.literal('expired'),
      v.literal('revoked'),
    ),
    expires_at: v.number(), // Timestamp when invite expires
    // Nullable to support explicit clearing during rollback (prevents stale data)
    accepted_at: v.optional(v.union(v.number(), v.null())), // Timestamp when invite was accepted
    accepted_by_user_id: v.optional(v.union(v.id('users'), v.null())), // User who accepted the invite
    metadata: v.optional(v.any()), // Additional invite data (major, year, etc.)
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_university_email_status', ['university_id', 'email', 'status'])
    .index('by_created_by', ['created_by_id'])
    .index('by_token', ['token'])
    .index('by_status', ['status'])
    .index('by_expires_at', ['expires_at']),

  // ========================================
  // ADVISOR FEATURE TABLES
  // ========================================
  //
  // NOTE: There are TWO advisor-student relationship tables:
  //
  // 1. student_advisors (below) - Used by ADVISOR MODULE (convex/advisor_*.ts)
  //    - References users table directly (student_id, advisor_id)
  //    - Supports ownership semantics (is_owner, shared_type)
  //    - Primary advisor can be designated per student
  //    - Used for: caseload queries, session scheduling, document reviews
  //
  // 2. advisorStudents (line ~1219) - Used by UNIVERSITY ADMIN MODULE
  //    - References studentProfiles table (student_profile_id)
  //    - Simpler roster management without ownership semantics
  //    - Used for: bulk assignment via university admin UI
  //
  // TODO: Consider consolidating these tables. Current duplication exists
  // because they were developed in parallel for different features.
  // Migration path: Align advisorStudents to use student_advisors with is_owner=true
  // ========================================

  // Student-Advisor relationship table (many-to-many with ownership)
  // UNIQUENESS CONSTRAINT: is_owner=true must be unique per student_id
  // - Enforced in mutations (no database constraint available)
  // - Diagnostic: Run 'npx convex run advisor_students:findDuplicateOwners' to detect violations
  student_advisors: defineTable({
    student_id: v.id('users'), // Must be a user with role="student"
    advisor_id: v.id('users'), // Must be a user with role="advisor"
    university_id: v.id('universities'), // Denormalized for tenant isolation
    is_owner: v.boolean(), // Primary advisor flag (exactly one per student)
    shared_type: v.optional(
      v.union(
        v.literal('reviewer'), // Can review documents
        v.literal('temp'), // Temporary assignment
      ),
    ),
    assigned_at: v.number(), // timestamp
    assigned_by: v.id('users'), // Admin who made the assignment
    notes: v.optional(v.string()), // Assignment context
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_university', ['university_id'])
    .index('by_advisor', ['advisor_id', 'university_id'])
    .index('by_student', ['student_id', 'university_id'])
    .index('by_advisor_owner', ['advisor_id', 'is_owner', 'university_id'])
    .index('by_student_owner', ['student_id', 'is_owner']),

  // Advisor session/appointment tracking
  advisor_sessions: defineTable({
    student_id: v.id('users'),
    advisor_id: v.id('users'),
    university_id: v.id('universities'), // Denormalized for tenant isolation
    title: v.string(),
    scheduled_at: v.optional(v.number()), // timestamp
    start_at: v.number(), // timestamp
    end_at: v.optional(v.number()), // timestamp
    duration_minutes: v.optional(v.number()),
    session_type: v.optional(
      v.union(
        v.literal('career_planning'),
        v.literal('resume_review'),
        v.literal('mock_interview'),
        v.literal('application_strategy'),
        v.literal('general_advising'),
        v.literal('other'),
      ),
    ),
    template_id: v.optional(v.string()), // Reference to note templates
    outcomes: v.optional(v.array(v.string())), // Checklist of session outcomes
    location: v.optional(v.string()), // Physical location or room
    meeting_url: v.optional(v.string()), // Virtual meeting link
    notes: v.optional(v.string()), // Rich text session notes
    visibility: v.union(
      v.literal('shared'), // Visible to student
      v.literal('advisor_only'), // Private advisor notes
    ),
    status: v.optional(
      v.union(
        v.literal('scheduled'),
        v.literal('completed'),
        v.literal('cancelled'),
        v.literal('no_show'),
      ),
    ),
    tasks: v.optional(
      v.array(
        v.object({
          id: v.string(),
          title: v.string(),
          due_at: v.optional(v.number()),
          // Role-based ownership: tasks are implicitly owned by the session's student_id or advisor_id
          // To query "all tasks for user X", filter by role + session student_id/advisor_id
          // Alternative: use owner_id: v.id("users") for direct user assignment
          owner: v.union(v.literal('student'), v.literal('advisor')),
          status: v.union(v.literal('open'), v.literal('done')),
        }),
      ),
    ),
    attachments: v.optional(
      v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          storage_id: v.id('_storage'), // Use Convex storage for access control
          type: v.string(), // MIME type
          size: v.number(), // bytes
        }),
      ),
    ),
    version: v.optional(v.number()), // For optimistic concurrency control
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_university', ['university_id'])
    .index('by_advisor', ['advisor_id', 'university_id'])
    .index('by_student', ['student_id', 'university_id'])
    .index('by_advisor_student', ['advisor_id', 'student_id', 'university_id'])
    .index('by_scheduled_at', ['scheduled_at'])
    .index('by_advisor_scheduled', ['advisor_id', 'scheduled_at'])
    .index('by_status', ['status', 'university_id']),

  // Resume/Cover Letter review queue for advisors
  advisor_reviews: defineTable({
    student_id: v.id('users'),
    university_id: v.id('universities'), // Denormalized for tenant isolation
    asset_type: v.union(v.literal('resume'), v.literal('cover_letter')),
    // IMPORTANT: Mutations must ensure exactly one of these is set based on asset_type
    resume_id: v.optional(v.id('resumes')),
    cover_letter_id: v.optional(v.id('cover_letters')),
    related_application_id: v.optional(v.id('applications')),
    related_review_id: v.optional(v.id('advisor_reviews')), // Previous review in chain
    status: v.union(
      v.literal('waiting'), // Pending advisor review
      v.literal('in_review'), // Advisor actively reviewing
      v.literal('needs_edits'), // Feedback provided, student needs to revise
      v.literal('approved'), // Advisor approved
    ),
    rubric: v.optional(
      v.object({
        content_quality: v.optional(v.number()), // 0-100
        formatting: v.optional(v.number()), // 0-100
        relevance: v.optional(v.number()), // 0-100
        grammar: v.optional(v.number()), // 0-100
        overall: v.optional(v.number()), // 0-100
      }),
    ),
    // Autosave fields for work-in-progress feedback (before finalization)
    feedback: v.optional(v.string()), // Draft feedback text (autosaved)
    suggestions: v.optional(v.array(v.string())), // Draft suggestion list (autosaved)

    // Structured comments for finalized feedback
    comments: v.optional(
      v.array(
        v.object({
          id: v.string(),
          author_id: v.id('users'), // User ID of commenter
          body: v.string(), // Comment text (sanitized HTML)
          visibility: v.union(
            v.literal('shared'), // Visible to student
            v.literal('advisor_only'), // Private comment
          ),
          created_at: v.number(),
          updated_at: v.number(),
        }),
      ),
    ),
    version_id: v.optional(v.string()), // Track which version was reviewed
    version: v.optional(v.number()), // Optimistic concurrency control version number (optional for backward compat)
    reviewed_by: v.optional(v.id('users')), // Advisor who reviewed
    reviewed_at: v.optional(v.number()), // timestamp
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_university', ['university_id'])
    .index('by_student', ['student_id', 'university_id'])
    .index('by_status', ['status', 'university_id'])
    .index('by_asset_type', ['asset_type', 'university_id'])
    .index('by_resume', ['resume_id'])
    .index('by_cover_letter', ['cover_letter_id']),

  // =============================================================================
  // DEPRECATED: Legacy advisor_follow_ups table
  // =============================================================================
  // STATUS: ✅ READY FOR REMOVAL - All queries migrated to follow_ups table
  // MIGRATION SCRIPT: convex/migrate_follow_ups.ts (migrateFollowUps mutation)
  // MIGRATION STATUS: Complete - all active queries have been updated
  // VERIFICATION: Run 'npx convex query migrate_follow_ups:verifyMigration' to confirm data migration
  //
  // ✅ ALL QUERIES MIGRATED:
  // - convex/advisor_dashboard.ts - Now uses follow_ups table
  // - convex/advisor_calendar.ts - Now uses follow_ups table
  // - convex/advisor_today.ts - Now uses follow_ups table
  //
  // REMOVAL PROCESS:
  // 1. Verify data migration: npx convex query migrate_follow_ups:verifyMigration
  // 2. Confirm no production data loss
  // 3. Remove this table definition from schema
  // 4. Remove convex/advisor_follow_ups.ts file
  // 5. Update migration docs
  //
  // NEW CODE: Must use follow_ups table - DO NOT insert/query this table
  //
  // NOTE: This table was replaced to consolidate student-created and advisor-created
  // follow-ups into a single unified table with better ownership tracking and multi-tenancy.
  // =============================================================================
  advisor_follow_ups: defineTable({
    student_id: v.id('users'),
    advisor_id: v.id('users'),
    university_id: v.id('universities'), // Denormalized for tenant isolation
    related_type: v.optional(
      v.union(
        v.literal('application'),
        v.literal('session'),
        v.literal('review'),
        v.literal('general'),
      ),
    ),
    related_id: v.optional(v.string()), // ID of related entity
    title: v.string(),
    description: v.optional(v.string()),
    due_at: v.optional(v.number()), // timestamp
    priority: v.optional(
      v.union(v.literal('low'), v.literal('medium'), v.literal('high'), v.literal('urgent')),
    ),
    owner_id: v.id('users'), // Who is responsible (student or advisor)
    status: v.union(v.literal('open'), v.literal('done')),
    completed_at: v.optional(v.number()),
    completed_by: v.optional(v.id('users')),
    // MIGRATION ONLY: Version field required for safe operation during migration period
    // This field enables FERPA-compliant optimistic locking in advisor_follow_ups.ts
    // mutations (completeFollowUp, reopenFollowUp) while active queries still reference
    // this deprecated table. Once all queries are migrated to follow_ups table and
    // convex/advisor_follow_ups.ts is removed, this field becomes unused.
    version: v.optional(v.number()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_university', ['university_id'])
    .index('by_advisor', ['advisor_id', 'university_id'])
    .index('by_student', ['student_id', 'university_id'])
    .index('by_owner_status', ['owner_id', 'status'])
    .index('by_due_at', ['due_at'])
    .index('by_advisor_student', ['advisor_id', 'student_id']),

  // Audit log for FERPA compliance and security
  //
  // RETENTION POLICY (FERPA Compliance):
  // - Logs must be retained for a minimum of 3 years from the date of the last action
  // - Recommended retention: 7 years for comprehensive compliance coverage
  // - Implement automated archival/deletion using scheduled Convex functions
  // - Before deletion, ensure export to long-term storage if required by policy
  //
  // PII HANDLING:
  // - previous_value/new_value may contain student PII (names, grades, etc.)
  // - Legacy fields also contain PII that must be redacted:
  //   - performed_by_name, performed_by_email (actor PII)
  //   - target_name, target_email (target user PII)
  // - On student data deletion requests (FERPA/GDPR), audit logs should be:
  //   1. Retained for compliance period (do not delete immediately)
  //   2. PII in previous_value/new_value should be redacted/anonymized
  //   3. Legacy PII fields should be set to "[REDACTED]"
  //   4. Keep student_id/actor_id as reference for audit trail integrity
  // - Redaction mutation should handle BOTH new and legacy formats:
  //   - New: previous_value, new_value (JSON fields - redact PII keys)
  //   - Legacy: performed_by_name, performed_by_email, target_name, target_email
  //
  // TODO: Implement scheduled function for automated log retention management
  //
  // MIGRATION NOTE: Schema supports both legacy and new formats for backward compatibility:
  // - Legacy: performed_by_id, target_id, timestamp, metadata
  // - New: actor_id, entity_id, created_at, previous_value/new_value
  // All new audit logs use the new format (see createAuditLog in advisor_auth.ts)
  audit_logs: defineTable({
    // New format (current - used by createAuditLog)
    actor_id: v.optional(v.id('users')), // User who performed the action
    university_id: v.optional(v.id('universities')), // Tenant isolation
    action: v.string(), // e.g., "session.created", "review.approved"
    entity_type: v.optional(v.string()), // e.g., "advisor_session", "advisor_review"
    entity_id: v.optional(v.string()), // ID of the entity being audited
    student_id: v.optional(v.id('users')), // Student affected by this action (for FERPA queries)
    previous_value: v.optional(v.any()), // Previous state (may contain PII - subject to redaction)
    new_value: v.optional(v.any()), // New state (may contain PII - subject to redaction)
    ip_address: v.optional(v.string()), // IP address for security tracking
    user_agent: v.optional(v.string()), // Browser/client info for security tracking
    created_at: v.optional(v.number()), // Timestamp for retention policy enforcement (optional for legacy records)

    // Category and enhanced actor context (enterprise audit support)
    category: v.optional(
      v.union(
        v.literal('user_action'), // User-initiated data changes
        v.literal('permission_change'), // Role, membership, access changes
        v.literal('sso_event'), // SSO login/logout events (future)
        v.literal('system'), // System-initiated actions
      ),
    ),
    actor_type: v.optional(
      v.union(
        v.literal('user'), // Human user action
        v.literal('system'), // Automated system action
        v.literal('integration'), // External integration/webhook
      ),
    ),
    actor_role: v.optional(v.string()), // Role at time of action (student, advisor, admin, etc.)
    target_university_id: v.optional(v.id('universities')), // University of the target entity
    request_id: v.optional(v.string()), // Correlation ID for request tracing

    // Legacy format (backward compatibility - deprecated)
    performed_by_id: v.optional(v.string()), // Legacy: actor_id
    performed_by_name: v.optional(v.string()), // Legacy: actor name (PII - subject to redaction)
    performed_by_email: v.optional(v.string()), // Legacy: actor email (PII - subject to redaction)
    target_id: v.optional(v.string()), // Legacy: entity_id
    target_type: v.optional(v.string()), // Legacy: entity_type
    target_name: v.optional(v.string()), // Legacy: entity name (PII - subject to redaction)
    target_email: v.optional(v.string()), // Legacy: entity email (PII - subject to redaction)
    timestamp: v.optional(v.number()), // Legacy: created_at
    reason: v.optional(v.string()), // Legacy: action reason
    metadata: v.optional(v.any()), // Legacy: additional data (may contain PII - subject to redaction)
  })
    .index('by_actor', ['actor_id', 'created_at']) // Find all actions by a user
    .index('by_entity', ['entity_type', 'entity_id', 'created_at']) // Find all changes to an entity
    .index('by_student', ['student_id', 'created_at']) // FERPA: Find all actions affecting a student
    .index('by_university', ['university_id', 'created_at']) // Tenant-scoped queries
    .index('by_action', ['action', 'created_at']) // Find all instances of a specific action type
    .index('by_created_at', ['created_at']) // Retention policy: find old logs for archival
    .index('by_category', ['category', 'created_at']) // Filter by audit category (user_action, permission_change, etc.)
    .index('by_timestamp', ['timestamp']) // Legacy: retention policy for old logs
    .index('by_target', ['target_type', 'target_id', 'timestamp']) // Legacy: Find logs by target (user-specific queries)
    .index('by_target_email', ['target_email', 'timestamp']), // Legacy: Find logs by target email

  // Migration tracking table for idempotency and state management
  migration_state: defineTable({
    migration_name: v.string(), // Unique identifier for the migration (e.g., "migrate_follow_ups_v1")
    status: v.union(
      v.literal('pending'), // Migration started but not completed
      v.literal('in_progress'), // Currently running
      v.literal('completed'), // Successfully completed
      v.literal('failed'), // Failed with errors
      v.literal('rolled_back'), // Rolled back due to errors
    ),
    started_at: v.number(),
    completed_at: v.optional(v.number()),
    error_message: v.optional(v.string()),
    metadata: v.optional(v.any()), // Migration-specific data (counts, stats, etc.)
    executed_by: v.optional(v.string()), // Who/what triggered the migration
  })
    .index('by_name', ['migration_name'])
    .index('by_status', ['status'])
    .index('by_started_at', ['started_at']),

  // Advisor-student roster mapping for UNIVERSITY ADMIN module
  // Used by: convex/university_admin.ts, convex/universities_admin.ts
  //
  // ========================================
  // DEPRECATED: This table is being phased out
  // ========================================
  // Use `student_advisors` (line ~938) instead for all new code.
  //
  // Migration status:
  // - [x] university_admin.assignAdvisorToStudent now uses student_advisors
  // - [x] universities_admin.hardDeleteUniversity deletes from both tables
  // - [ ] Run migration: npx convex run migrations/consolidate_advisor_students:migrate
  // - [ ] Remove this table after migration is verified
  //
  // Key differences from student_advisors:
  // - References studentProfiles instead of users (student_profile_id vs student_id)
  // - No ownership semantics (no is_owner, shared_type fields)
  //
  // See docs/TECH_DEBT_ADVISOR_STUDENT_TABLES.md for full migration plan.
  // ========================================
  advisorStudents: defineTable({
    university_id: v.id('universities'),
    advisor_id: v.id('users'),
    student_profile_id: v.id('studentProfiles'),
    assigned_by_id: v.id('users'),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_advisor_student', ['advisor_id', 'student_profile_id'])
    .index('by_advisor', ['advisor_id'])
    .index('by_student_profile', ['student_profile_id'])
    .index('by_university', ['university_id']),

  // Memberships link users to universities with a role
  memberships: defineTable({
    user_id: v.id('users'),
    university_id: v.id('universities'),
    role: v.union(v.literal('student'), v.literal('advisor'), v.literal('university_admin')),
    status: v.union(v.literal('active'), v.literal('inactive'), v.literal('revoked')),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_user', ['user_id'])
    .index('by_user_role', ['user_id', 'role'])
    .index('by_university_role', ['university_id', 'role'])
    .index('by_university', ['university_id']),

  // ========================================
  // AI EVALUATION TABLES
  // ========================================
  //
  // Centralized AI evaluation framework for quality assessment, safety guardrails,
  // and audit capabilities across all AI-powered tools.
  //
  // @see docs/AI_EVALUATOR_STRATEGY.md for governance and policies
  // ========================================

  // AI evaluation results - stores evaluation outcomes for all AI outputs
  // v2.0: Uses 1-5 scale with standardized dimensions and safety gate
  ai_evaluations: defineTable({
    // Identity
    tool_id: v.string(), // Which AI tool generated the content (e.g., 'resume-generation')
    tool_version: v.optional(v.string()), // Version of the tool if tracked
    evaluator_model: v.string(), // Model used for evaluation (e.g., 'gpt-4o-mini')
    rubric_version: v.string(), // Version of the rubric used (v2.0.0 = 1-5 scale)

    // Scores (v2.0: 1-5 scale for 5 standardized dimensions)
    overall_score: v.number(), // 1-5 average of dimension scores (or 0-100 for legacy)
    dimension_scores: v.any(), // Record<StandardizedDimension, DimensionScore>
    risk_flags: v.array(v.string()), // Array of risk flag identifiers
    explanation: v.string(), // Short rationale for audit/debugging
    passed: v.boolean(), // Whether evaluation passed

    // Safety gate (v2.0: binary pass/fail for safety dimension)
    safety_score: v.optional(v.number()), // 1-5 safety dimension score
    safety_passed: v.optional(v.boolean()), // true if safety >= 3
    is_safety_hard_failure: v.optional(v.boolean()), // true if safety <= 2

    // Context
    user_id: v.optional(v.string()), // Clerk user ID (if authenticated)
    input_hash: v.string(), // Hash of input for deduplication
    output_hash: v.string(), // Hash of output

    // Metadata
    environment: v.union(v.literal('dev'), v.literal('staging'), v.literal('production')),
    evaluation_duration_ms: v.number(), // How long evaluation took
    created_at: v.number(),
  })
    .index('by_tool', ['tool_id'])
    .index('by_user', ['user_id'])
    .index('by_created', ['created_at'])
    .index('by_tool_and_passed', ['tool_id', 'passed'])
    .index('by_tool_and_created', ['tool_id', 'created_at'])
    .index('by_safety_failed', ['is_safety_hard_failure', 'created_at']),

  // AI evaluation configuration - stores rubric overrides and settings per tool
  ai_evaluation_config: defineTable({
    tool_id: v.string(), // Which AI tool this config applies to
    rubric: v.optional(v.any()), // ToolRubric override (null = use default)
    pass_threshold: v.optional(v.number()), // Override pass threshold
    enabled: v.boolean(), // Whether evaluation is enabled for this tool
    block_on_fail: v.boolean(), // Whether to block output on evaluation failure
    updated_at: v.number(),
    updated_by: v.string(), // Clerk user ID of admin who updated
  }).index('by_tool', ['tool_id']),

  // ============================================================================
  // EMAIL AUTO UPDATES (Gmail + Outlook)
  // Privacy: store minimal metadata + derived signals only (no full bodies)
  // ============================================================================

  email_integrations: defineTable({
    user_id: v.id('users'),
    provider: v.union(v.literal('gmail'), v.literal('outlook')),
    status: v.union(v.literal('connected'), v.literal('revoked')),
    enabled: v.boolean(), // User opt-in toggle for scanning
    mode: v.union(v.literal('metadata_only'), v.literal('enhanced')), // Enhanced allows limited snippet/preview
    auto_add_enabled: v.optional(v.boolean()), // User preference for auto-add to Kanban (default: true)
    scopes: v.array(v.string()),

    // OAuth tokens (encrypted at rest, never returned to client)
    encrypted_refresh_token: v.optional(v.string()),
    token_cipher_version: v.optional(v.string()),

    // Provider identity (for display + webhook routing)
    provider_account_email: v.optional(v.string()),
    provider_account_id: v.optional(v.string()),

    // Sync state
    last_scan_at: v.optional(v.number()),
    last_scan_enqueued_at: v.optional(v.number()),
    scan_lock_until: v.optional(v.number()),
    cursor: v.optional(v.string()), // Provider sync token/delta link when supported

    // Gmail-specific push state (optional)
    gmail_history_id: v.optional(v.string()),
    gmail_watch_expiration: v.optional(v.number()),

    // Outlook-specific push state (optional)
    outlook_subscription_id: v.optional(v.string()),
    outlook_subscription_expiration: v.optional(v.number()),
    outlook_client_state_hash: v.optional(v.string()), // SHA-256 of clientState

    // Consent + lifecycle
    consented_at: v.optional(v.number()),
    revoked_at: v.optional(v.number()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_user', ['user_id'])
    .index('by_user_provider', ['user_id', 'provider'])
    .index('by_provider_account_email', ['provider', 'provider_account_email'])
    .index('by_provider_outlook_subscription', ['provider', 'outlook_subscription_id'])
    .index('by_status_enabled', ['status', 'enabled'])
    .index('by_updated_at', ['updated_at']),

  email_scan_events: defineTable({
    integration_id: v.id('email_integrations'),
    user_id: v.id('users'),
    provider: v.union(v.literal('gmail'), v.literal('outlook')),
    run_at: v.number(),
    processed_count: v.number(),
    matched_count: v.number(),
    suggested_count: v.number(),
    errors_count: v.number(),
    error_summary: v.optional(v.string()),
    created_at: v.number(),
  })
    .index('by_integration', ['integration_id', 'run_at'])
    .index('by_user', ['user_id', 'run_at']),

  email_application_signals: defineTable({
    integration_id: v.id('email_integrations'),
    user_id: v.id('users'),
    provider: v.union(v.literal('gmail'), v.literal('outlook')),

    // Provider identifiers (minimal, no bodies stored)
    message_id: v.string(),
    thread_id: v.string(),
    subject: v.string(),
    from: v.string(),
    from_domain: v.optional(v.string()),
    received_at: v.number(),
    snippet_limited: v.optional(v.string()), // Only when enhanced mode is enabled (length-limited)

    // Detection + classification
    subject_gate_version: v.string(),
    subject_gate_passed: v.boolean(),
    event_type: v.optional(v.string()),
    confidence: v.optional(v.number()),
    extracted_entities: v.optional(v.any()),
    classification_source: v.optional(v.string()),
    classification_reason: v.optional(v.string()),
    ai_prompt_version: v.optional(v.string()),
    ai_model: v.optional(v.string()),
    ai_summary: v.optional(v.string()),

    // Application matching
    matched_application_id: v.optional(v.id('applications')),
    match_confidence: v.optional(v.number()),
    match_signals: v.optional(v.any()),
    candidate_applications: v.optional(v.any()),

    // Decision
    status: v.union(
      v.literal('ignored'),
      v.literal('suggested'),
      v.literal('applied'),
      v.literal('dismissed'),
    ),
    suggested_stage: v.optional(v.string()),
    applied_stage_event_id: v.optional(v.id('application_stage_events')),

    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_integration_message', ['integration_id', 'message_id'])
    .index('by_user_status_created', ['user_id', 'status', 'created_at'])
    .index('by_user_provider_thread', ['user_id', 'provider', 'thread_id'])
    .index('by_user_created_at', ['user_id', 'created_at'])
    .index('by_created_at', ['created_at']),

  application_stage_events: defineTable({
    application_id: v.id('applications'),
    user_id: v.id('users'),

    actor_type: v.union(v.literal('system'), v.literal('user')),
    actor_user_id: v.optional(v.id('users')),
    source: v.union(v.literal('manual'), v.literal('email_auto_update')),

    // Email integration context (if source=email_auto_update)
    provider: v.optional(v.union(v.literal('gmail'), v.literal('outlook'))),
    message_id: v.optional(v.string()),
    thread_id: v.optional(v.string()),
    signal_id: v.optional(v.id('email_application_signals')),

    previous_stage: v.optional(v.string()),
    new_stage: v.string(),
    previous_status: v.optional(v.string()),
    new_status: v.optional(v.string()),

    classification_confidence: v.optional(v.number()),
    match_confidence: v.optional(v.number()),

    created_at: v.number(),

    // Undo support
    undone_at: v.optional(v.number()),
    undone_by_user_id: v.optional(v.id('users')),
    undo_reason: v.optional(v.string()),
  })
    .index('by_application', ['application_id', 'created_at'])
    .index('by_user', ['user_id', 'created_at'])
    .index('by_signal', ['signal_id']),

  // Notifications table for in-app notifications
  notifications: defineTable({
    user_id: v.id('users'), // User who should see this notification
    type: v.union(
      v.literal('support_ticket'), // New support ticket
      v.literal('ticket_update'), // Ticket status/assignment changed
      v.literal('application_update'), // Application status changed
      v.literal('goal_reminder'), // Goal deadline approaching
      v.literal('system'), // System announcements
    ),
    title: v.string(), // Notification title
    message: v.string(), // Notification message
    link: v.optional(v.string()), // Optional link to related resource
    related_id: v.optional(v.string()), // ID of related entity (ticket, application, etc.)
    read: v.boolean(), // Whether user has read this notification
    read_at: v.optional(v.number()), // When notification was read
    created_at: v.number(), // When notification was created
  })
    .index('by_user', ['user_id'])
    .index('by_user_read', ['user_id', 'read'])
    .index('by_created_at', ['created_at']),

  // ============================================================================
  // EMAIL AUTO UPDATE AUDIT
  // Tracks auto-created/updated applications from email scanning for undo support
  // ============================================================================
  email_auto_update_audit: defineTable({
    user_id: v.id('users'),
    gmail_message_id: v.string(), // Provider message ID for dedup and undo lookup
    provider: v.union(v.literal('gmail'), v.literal('outlook')),
    intent_type: v.string(), // 'interview_request', 'applied_confirmation', 'offer', etc.
    application_id: v.id('applications'),
    action_type: v.union(v.literal('created'), v.literal('updated')),

    // Snapshot for undo (only for updates)
    previous_snapshot: v.optional(
      v.object({
        stage: v.optional(v.string()),
        status: v.optional(v.string()),
        interview_round: v.optional(v.number()),
        interview_round_type: v.optional(v.string()),
      }),
    ),

    // Classification context for audit
    classification_confidence: v.optional(v.number()),
    match_confidence: v.optional(v.number()),
    review_status: v.optional(v.union(v.literal('confirmed'), v.literal('needs_review'))),

    // Undo tracking
    undone_at: v.optional(v.number()),
    undone_by_user_id: v.optional(v.id('users')),
    undo_reason: v.optional(v.string()),

    created_at: v.number(),
  })
    .index('by_user_message', ['user_id', 'gmail_message_id', 'intent_type'])
    .index('by_application', ['application_id'])
    .index('by_user', ['user_id', 'created_at'])
    .index('by_user_undone', ['user_id', 'undone_at']),
});
