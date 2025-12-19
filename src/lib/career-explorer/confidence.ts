/**
 * Confidence Labeling Utility
 *
 * Provides transparent confidence labels for AI-generated and inferred data.
 * Helps users understand the reliability of career recommendations.
 */

import type { ConfidenceLabel, ConfidenceSource } from './types';

/**
 * Configuration for confidence label display
 */
export const CONFIDENCE_CONFIG: Record<
  'high' | 'medium' | 'low',
  { label: string; color: string; bgColor: string; icon: string }
> = {
  high: {
    label: 'High Confidence',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50 border-emerald-200',
    icon: 'CheckCircle',
  },
  medium: {
    label: 'Medium Confidence',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50 border-amber-200',
    icon: 'AlertCircle',
  },
  low: {
    label: 'Low Confidence',
    color: 'text-red-700',
    bgColor: 'bg-red-50 border-red-200',
    icon: 'HelpCircle',
  },
};

/**
 * Data source descriptions for tooltips
 */
export const SOURCE_DESCRIPTIONS: Record<ConfidenceSource, string> = {
  verified: 'Data from verified sources (BLS, O*NET, official statistics)',
  inferred: 'Inferred from job postings and industry data using AI analysis',
  estimated: 'Estimated based on similar roles and limited data points',
};

/**
 * Create a confidence label with appropriate tooltip
 */
export function createConfidenceLabel(
  level: 'high' | 'medium' | 'low',
  source: ConfidenceSource,
  additionalContext?: string,
): ConfidenceLabel {
  const baseTooltip = SOURCE_DESCRIPTIONS[source];
  const tooltip = additionalContext ? `${baseTooltip}. ${additionalContext}` : baseTooltip;

  return {
    level,
    source,
    tooltip,
  };
}

/**
 * Determine confidence level for salary data
 */
export function getSalaryConfidence(params: {
  hasVerifiedData: boolean;
  sampleSize?: number;
  dataAgeMonths?: number;
  isRegional?: boolean;
}): ConfidenceLabel {
  const { hasVerifiedData, sampleSize = 0, dataAgeMonths = 0, isRegional = false } = params;

  if (hasVerifiedData && sampleSize >= 100 && dataAgeMonths < 12) {
    return createConfidenceLabel(
      'high',
      'verified',
      isRegional ? 'Regional data may vary by location' : undefined,
    );
  }

  if (sampleSize >= 20 || (hasVerifiedData && dataAgeMonths < 24)) {
    return createConfidenceLabel(
      'medium',
      'inferred',
      `Based on ${sampleSize > 0 ? `${sampleSize} data points` : 'aggregated job postings'}`,
    );
  }

  return createConfidenceLabel(
    'low',
    'estimated',
    'Limited data available - consider as a rough estimate',
  );
}

/**
 * Determine confidence level for skill requirements
 */
export function getSkillConfidence(params: {
  fromJobDescription: boolean;
  frequency?: number; // How often this skill appears in similar roles (0-100)
  isInferred?: boolean;
}): ConfidenceLabel {
  const { fromJobDescription, frequency = 0, isInferred = false } = params;

  if (fromJobDescription && frequency >= 70) {
    return createConfidenceLabel('high', 'verified', 'Commonly required for this role');
  }

  if (frequency >= 40 || fromJobDescription) {
    return createConfidenceLabel(
      'medium',
      'inferred',
      `Appears in ${frequency}% of similar job postings`,
    );
  }

  return createConfidenceLabel('low', 'estimated', 'Skill may be role-specific or emerging');
}

/**
 * Determine confidence level for fit scores
 */
export function getFitScoreConfidence(params: {
  quizCompleteness: number; // 0-100%
  profileCompleteness: number; // 0-100%
  roleDataQuality: 'high' | 'medium' | 'low';
}): ConfidenceLabel {
  const { quizCompleteness, profileCompleteness, roleDataQuality } = params;

  const avgCompleteness = (quizCompleteness + profileCompleteness) / 2;

  if (avgCompleteness >= 80 && roleDataQuality === 'high') {
    return createConfidenceLabel(
      'high',
      'verified',
      'Based on comprehensive profile and role data',
    );
  }

  if (avgCompleteness >= 50 || roleDataQuality === 'medium') {
    return createConfidenceLabel(
      'medium',
      'inferred',
      'Complete your profile for more accurate results',
    );
  }

  return createConfidenceLabel(
    'low',
    'estimated',
    'Limited data - results may not fully reflect your fit',
  );
}

/**
 * Determine confidence level for career recommendations
 */
export function getRecommendationConfidence(params: {
  basedOnQuiz: boolean;
  basedOnHistory: boolean;
  matchCount: number; // Number of data points supporting recommendation
}): ConfidenceLabel {
  const { basedOnQuiz, basedOnHistory, matchCount } = params;

  if (basedOnQuiz && basedOnHistory && matchCount >= 3) {
    return createConfidenceLabel('high', 'verified', 'Strong alignment across multiple factors');
  }

  if ((basedOnQuiz || basedOnHistory) && matchCount >= 2) {
    return createConfidenceLabel('medium', 'inferred', 'Based on available profile information');
  }

  return createConfidenceLabel('low', 'estimated', 'Explore more to refine recommendations');
}

/**
 * Determine confidence level for growth outlook predictions
 */
export function getGrowthOutlookConfidence(params: {
  source: 'bls' | 'industry_report' | 'ai_analysis' | 'unknown';
  projectionYears?: number;
}): ConfidenceLabel {
  const { source, projectionYears = 10 } = params;

  if (source === 'bls') {
    return createConfidenceLabel(
      'high',
      'verified',
      `Official BLS ${projectionYears}-year projection`,
    );
  }

  if (source === 'industry_report') {
    return createConfidenceLabel('medium', 'inferred', 'Based on industry analyst reports');
  }

  if (source === 'ai_analysis') {
    return createConfidenceLabel('medium', 'inferred', 'AI analysis of market trends');
  }

  return createConfidenceLabel('low', 'estimated', 'Growth outlook is speculative');
}

/**
 * Determine confidence level for day-in-life descriptions
 */
export function getDayInLifeConfidence(params: {
  fromProfessionalInput: boolean;
  fromJobPostings: boolean;
  isGeneric: boolean;
}): ConfidenceLabel {
  const { fromProfessionalInput, fromJobPostings, isGeneric } = params;

  if (fromProfessionalInput && !isGeneric) {
    return createConfidenceLabel(
      'high',
      'verified',
      'Based on input from professionals in this role',
    );
  }

  if (fromJobPostings) {
    return createConfidenceLabel(
      'medium',
      'inferred',
      'Compiled from job descriptions and industry sources',
    );
  }

  return createConfidenceLabel(
    'low',
    'estimated',
    'Generic description - actual day may vary significantly',
  );
}

/**
 * Get the appropriate badge variant based on confidence level
 */
export function getConfidenceBadgeVariant(
  level: 'high' | 'medium' | 'low',
): 'default' | 'secondary' | 'outline' {
  switch (level) {
    case 'high':
      return 'default';
    case 'medium':
      return 'secondary';
    case 'low':
      return 'outline';
  }
}

/**
 * Calculate overall confidence from multiple confidence labels
 */
export function aggregateConfidence(labels: ConfidenceLabel[]): 'high' | 'medium' | 'low' {
  if (labels.length === 0) return 'low';

  const scores = labels.map((l) => (l.level === 'high' ? 3 : l.level === 'medium' ? 2 : 1));
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  if (avgScore >= 2.5) return 'high';
  if (avgScore >= 1.5) return 'medium';
  return 'low';
}
