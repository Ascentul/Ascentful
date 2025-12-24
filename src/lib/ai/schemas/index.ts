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
    'missing-metrics',
    'weak-verb',
    'vague-achievement',
    'no-outcome',
    'too-long',
    'passive-voice',
    'missing-keyword',
    'redundant-content',
    'weak-scope',
    'filler-words',
    'formatting-consistency',
    'order-optimization',
    'enhancement-opportunity',
    'missing-info', // For missing required information
    'generic-content', // For overly generic descriptions
    'structure-issue', // For structural/formatting issues
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

export const JDKeywordSchema = z.object({
  keyword: z.string(),
  frequency: z.number(),
  synonyms: z.array(z.string()),
  mustIncludeInResume: z.boolean(),
});

export const JDRecommendationSchema = z.object({
  priority: z.enum(['high', 'medium', 'low']),
  action: z.string(),
  expectedImpact: z.string(),
});

export const JDAnalysisResponseSchema = z.object({
  basics: z.object({
    company: z.string(),
    title: z.string(),
    standardizedTitle: z.string(),
    location: z.string(),
    locationType: z.enum(['onsite', 'hybrid', 'remote']),
    seniorityLevel: z.enum(['entry', 'mid', 'senior', 'lead', 'executive']),
    estimatedYearsExperience: z.object({
      min: z.number(),
      max: z.number().nullable(),
    }),
  }),
  requirements: z.object({
    required: z.array(JDRequirementSchema),
    preferred: z.array(JDRequirementSchema),
    education: z.object({
      required: z.string().nullable(),
      preferred: z.string().nullable(),
      fieldOfStudy: z.array(z.string()),
    }),
  }),
  keywords: z.object({
    technical: z.array(JDKeywordSchema),
    soft: z.array(JDKeywordSchema),
    domain: z.array(JDKeywordSchema),
  }),
  recommendations: z.array(JDRecommendationSchema),
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
