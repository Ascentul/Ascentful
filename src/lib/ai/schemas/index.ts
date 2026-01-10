// Zod validation schemas for AI responses

import { z } from 'zod';

// ========== SCORE SCHEMAS ==========
export const ScoreSignalSchema = z.object({
  name: z.string(),
  found: z.number(),
  expected: z.number(),
  points: z.number(),
});

export const ScoreDimensionSchema = z.object({
  score: z.number().min(0).max(100),
  signals: z.array(ScoreSignalSchema),
  summary: z.string().max(200),
});

export const ScoreResponseSchema = z.object({
  overall: z.number().min(0).max(100),
  breakdown: z.object({
    impact: ScoreDimensionSchema,
    clarity: ScoreDimensionSchema,
    ats: ScoreDimensionSchema,
    brevity: ScoreDimensionSchema,
  }),
  topIssues: z
    .array(
      z.object({
        category: z.enum(['impact', 'clarity', 'ats', 'brevity']),
        issue: z.string(),
        location: z.string(),
        fix: z.string(),
      }),
    )
    .max(5),
  quickWins: z.array(z.string()).max(3),
});

// ========== SUGGESTION SCHEMAS ==========
export const SuggestionSchema = z.object({
  id: z.string(),
  type: z.enum([
    // Critical - Content Quality Issues
    'missing-metrics',
    'weak-verb',
    'vague-achievement',
    'no-outcome',
    'generic-content',
    // Critical - Missing Content
    'missing-summary',
    'missing-experience',
    'missing-skills',
    'empty-bullets',
    // Important - Content Issues
    'too-long',
    'passive-voice',
    'missing-keyword',
    'redundant-content',
    'weak-scope',
    'buried-impact',
    // Important - Missing Content
    'missing-education',
    'missing-contact-field',
    'incomplete-entry',
    'short-content',
    // Polish
    'filler-words',
    'formatting-consistency',
    'order-optimization',
    'enhancement-opportunity',
    'structure-issue',
    // Strategic
    'career-gap',
    'missing-progression',
    'outdated-skills',
    // Legacy (keeping for backwards compatibility)
    'missing-info',
  ]),
  severity: z.enum(['critical', 'important', 'polish']),
  category: z.enum(['impact', 'clarity', 'ats', 'brevity']),
  targetType: z.enum(['bullet', 'section', 'resume', 'header']),
  targetId: z.string(),
  targetPath: z.string(),
  title: z.string().max(60),
  explanation: z.string().max(300),
  beforeText: z.string(),
  afterText: z.string(),
  estimatedScoreImpact: z.number().min(-5).max(10),
});

export const SuggestionsResponseSchema = z.object({
  suggestions: z.array(SuggestionSchema).max(15),
  summary: z.object({
    critical: z.number(),
    important: z.number(),
    polish: z.number(),
    potentialScoreGain: z.number(),
  }),
});

// ========== BULLET REWRITE SCHEMAS ==========
export const BulletChangeSchema = z.object({
  type: z.enum(['verb', 'metric', 'structure', 'clarity', 'keyword']),
  before: z.string(),
  after: z.string(),
  reason: z.string(),
});

export const AlternativeVersionSchema = z.object({
  bullet: z.string(),
  emphasis: z.enum(['impact', 'leadership', 'technical', 'efficiency']),
  wordCount: z.number(),
});

export const BulletRewriteResponseSchema = z.object({
  rewrittenBullet: z.string().max(300),
  wordCount: z.number(),
  changes: z.array(BulletChangeSchema),
  metricsStatus: z.object({
    hadMetrics: z.boolean(),
    hasMetrics: z.boolean(),
    metricsAdded: z.array(z.string()),
  }),
  verbAnalysis: z.object({
    originalVerb: z.string(),
    newVerb: z.string(),
    tierImprovement: z.number(),
  }),
  alternativeVersions: z.array(AlternativeVersionSchema).max(3),
  confidence: z.enum(['high', 'medium', 'low']),
  followUpQuestions: z.array(z.string()).max(3),
});

// ========== JD ANALYSIS SCHEMAS ==========
export const JDRequirementSchema = z.object({
  item: z.string(),
  type: z.enum(['skill', 'experience', 'education', 'certification', 'other']),
  mentions: z.number(),
  importance: z.enum(['critical', 'high', 'medium', 'low']),
});

// Normalized keyword type (output of transformation)
export const JDKeywordSchema = z.object({
  keyword: z.string(),
  frequency: z.number(),
  synonyms: z.array(z.string()),
  mustIncludeInResume: z.boolean(),
});

// Flexible keyword schema that accepts either string or full object
// GPT-5 models often return simple strings instead of objects
const FlexibleKeywordSchema = z.union([
  z.string().transform((s) => ({
    keyword: s,
    frequency: 1,
    synonyms: [],
    mustIncludeInResume: true,
  })),
  z.object({
    keyword: z.string(),
    frequency: z.number().optional().default(1),
    synonyms: z.array(z.string()).optional().default([]),
    mustIncludeInResume: z.boolean().optional().default(true),
  }),
]);

export const JDRecommendationSchema = z.object({
  priority: z.enum(['high', 'medium', 'low']),
  action: z.string(),
  expectedImpact: z.string(),
});

export const JDAnalysisResponseSchema = z.object({
  basics: z.object({
    // All basic fields are optional with defaults - AI often returns null or omits fields
    company: z
      .string()
      .nullable()
      .optional()
      .default('Unknown Company')
      .transform((v) => v || 'Unknown Company'),
    title: z
      .string()
      .nullable()
      .optional()
      .default('Unknown Title')
      .transform((v) => v || 'Unknown Title'),
    standardizedTitle: z
      .string()
      .nullable()
      .optional()
      .default('')
      .transform((v) => v || ''),
    location: z
      .string()
      .nullable()
      .optional()
      .default('Not specified')
      .transform((v) => v || 'Not specified'),
    locationType: z.enum(['onsite', 'hybrid', 'remote']).optional().default('remote'),
    seniorityLevel: z
      .enum(['entry', 'mid', 'senior', 'lead', 'executive'])
      .optional()
      .default('mid'),
    estimatedYearsExperience: z
      .object({
        min: z.number().optional().default(0),
        max: z.number().nullable().optional().default(null),
      })
      .refine((data) => data.max === null || data.max >= data.min, {
        message: 'max must be greater than or equal to min',
      })
      .optional()
      .default({ min: 0, max: null }),
  }),
  requirements: z
    .object({
      required: z.array(JDRequirementSchema).optional().default([]),
      preferred: z.array(JDRequirementSchema).optional().default([]),
      education: z
        .object({
          required: z.string().nullable().optional().default(null),
          preferred: z.string().nullable().optional().default(null),
          fieldOfStudy: z.array(z.string()).optional().default([]),
        })
        .optional()
        .default({ required: null, preferred: null, fieldOfStudy: [] }),
    })
    .optional()
    .default({
      required: [],
      preferred: [],
      education: { required: null, preferred: null, fieldOfStudy: [] },
    }),
  // Use FlexibleKeywordSchema to handle both string[] and object[] from AI
  keywords: z
    .object({
      technical: z.array(FlexibleKeywordSchema).optional().default([]),
      soft: z.array(FlexibleKeywordSchema).optional().default([]),
      domain: z.array(FlexibleKeywordSchema).optional().default([]),
    })
    .optional()
    .default({ technical: [], soft: [], domain: [] }),
  recommendations: z.array(JDRecommendationSchema).optional().default([]),
});

// ========== MATCH SCORE SCHEMAS ==========
export const MatchedSkillSchema = z.object({
  skill: z.string(),
  importance: z.enum(['required', 'preferred', 'nice-to-have']),
  evidenceInResume: z.string(),
});

export const SkillGapSchema = z.object({
  skill: z.string(),
  importance: z.enum(['required', 'preferred', 'nice-to-have']),
  suggestion: z.string(),
});

export const MatchScoreResponseSchema = z.object({
  matchScore: z.number().min(0).max(100),
  matchLevel: z.enum(['strong', 'good', 'moderate', 'weak']),
  skillsAnalysis: z.object({
    matched: z.array(MatchedSkillSchema),
    gaps: z.array(SkillGapSchema),
    score: z.number().min(0).max(100),
  }),
  experienceAnalysis: z.object({
    yearsMatch: z.boolean(),
    seniorityMatch: z.boolean(),
    industryMatch: z.boolean(),
    score: z.number().min(0).max(100),
    notes: z.string(),
  }),
  keywordAnalysis: z.object({
    found: z.array(z.string()),
    missing: z.array(z.string()),
    score: z.number().min(0).max(100),
  }),
  recommendations: z.array(JDRecommendationSchema),
});

// ========== SKILL SUGGESTIONS SCHEMAS ==========
export const SkillSuggestionsResponseSchema = z.object({
  skills: z.array(z.string()),
  categories: z.object({
    technical: z.array(z.string()),
    soft: z.array(z.string()),
    tools: z.array(z.string()),
  }),
});

// ========== AI CHAT SCHEMAS ==========
export const ChatActionSchema = z.object({
  type: z.string(),
  label: z.string(),
  payload: z.record(z.unknown()).optional(),
});

export const ChatResponseSchema = z.object({
  message: z.string(),
  actions: z.array(ChatActionSchema).optional(),
});

// ========== TYPE EXPORTS ==========
export type ScoreResponse = z.infer<typeof ScoreResponseSchema>;
export type SuggestionsResponse = z.infer<typeof SuggestionsResponseSchema>;
export type BulletRewriteResponse = z.infer<typeof BulletRewriteResponseSchema>;
export type JDAnalysisResponse = z.infer<typeof JDAnalysisResponseSchema>;
export type MatchScoreResponse = z.infer<typeof MatchScoreResponseSchema>;
export type ChatResponse = z.infer<typeof ChatResponseSchema>;
export type Suggestion = z.infer<typeof SuggestionSchema>;
export type ScoreDimension = z.infer<typeof ScoreDimensionSchema>;
export type SkillSuggestionsResponse = z.infer<typeof SkillSuggestionsResponseSchema>;
