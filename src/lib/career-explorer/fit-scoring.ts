/**
 * Fit Score Calculation Utility
 *
 * Calculates transparent fit scores with driver breakdowns for roles.
 * Scores range from 0-100 with weighted factors.
 */

import type { ConfidenceLabel, FitScore, FitScoreDriver, QuizAnswers, RoleSkill } from './types';

// Weight configuration for fit score factors
const FACTOR_WEIGHTS = {
  skills: 0.3, // 30%
  interests: 0.25, // 25%
  values: 0.2, // 20%
  experience: 0.15, // 15%
  constraints: 0.1, // 10%
} as const;

interface RoleProfile {
  title: string;
  required_skills?: string[];
  preferred_skills?: string[];
  industry?: string;
  work_style?: string[];
  values?: string[];
  experience_level?: string;
  remote_friendly?: boolean;
  salary_range?: { min: number; max: number };
}

interface UserProfile {
  skills?: string[];
  interests?: string[];
  values?: string[];
  experience_years?: number;
  remote_preference?: boolean;
  salary_expectation?: number;
}

/**
 * Calculate skill match score
 */
function calculateSkillMatch(
  userSkills: string[],
  requiredSkills: string[],
  preferredSkills: string[],
): { score: number; explanation: string } {
  if (requiredSkills.length === 0 && preferredSkills.length === 0) {
    return { score: 50, explanation: 'No specific skills required' };
  }

  const normalizedUserSkills = userSkills.map((s) => s.toLowerCase());

  // Calculate required skills match (weighted more heavily)
  let requiredMatches = 0;
  for (const skill of requiredSkills) {
    if (normalizedUserSkills.some((us) => us.includes(skill.toLowerCase()))) {
      requiredMatches++;
    }
  }
  const requiredScore =
    requiredSkills.length > 0 ? (requiredMatches / requiredSkills.length) * 100 : 100;

  // Calculate preferred skills match
  let preferredMatches = 0;
  for (const skill of preferredSkills) {
    if (normalizedUserSkills.some((us) => us.includes(skill.toLowerCase()))) {
      preferredMatches++;
    }
  }
  const preferredScore =
    preferredSkills.length > 0 ? (preferredMatches / preferredSkills.length) * 100 : 100;

  // Combine with 70/30 weighting favoring required skills
  const score = Math.round(requiredScore * 0.7 + preferredScore * 0.3);

  const matchedTotal = requiredMatches + preferredMatches;
  const totalSkills = requiredSkills.length + preferredSkills.length;

  let explanation = '';
  if (score >= 80) {
    explanation = `Strong skill match: ${matchedTotal}/${totalSkills} skills aligned`;
  } else if (score >= 50) {
    explanation = `Partial skill match: ${matchedTotal}/${totalSkills} skills aligned`;
  } else {
    explanation = `Skill gap identified: ${totalSkills - matchedTotal} skills to develop`;
  }

  return { score, explanation };
}

/**
 * Calculate interest alignment score from quiz answers
 */
function calculateInterestAlignment(
  quizAnswers: QuizAnswers,
  roleProfile: RoleProfile,
): { score: number; explanation: string } {
  // Interest-related question IDs from the quiz
  const interestQuestionIds = ['work_environment', 'team_preference', 'learning_style'];

  let alignmentScore = 50; // Default neutral
  const factors: string[] = [];

  // Check work environment preference
  if (quizAnswers.work_environment && roleProfile.work_style) {
    const envPref = String(quizAnswers.work_environment);
    if (roleProfile.work_style.includes(envPref)) {
      alignmentScore += 15;
      factors.push('work environment match');
    }
  }

  // Check industry alignment
  if (quizAnswers.preferred_industries && roleProfile.industry) {
    const industries = Array.isArray(quizAnswers.preferred_industries)
      ? quizAnswers.preferred_industries
      : [String(quizAnswers.preferred_industries)];
    if (industries.some((i) => roleProfile.industry?.toLowerCase().includes(i.toLowerCase()))) {
      alignmentScore += 25;
      factors.push('industry alignment');
    }
  }

  // Check remote preference
  if (quizAnswers.remote_preference !== undefined && roleProfile.remote_friendly !== undefined) {
    const wantsRemote =
      quizAnswers.remote_preference === 'remote' || quizAnswers.remote_preference === 'hybrid';
    if (wantsRemote === roleProfile.remote_friendly) {
      alignmentScore += 10;
      factors.push('remote flexibility match');
    }
  }

  const score = Math.min(100, Math.max(0, alignmentScore));
  const explanation =
    factors.length > 0
      ? `Aligned on: ${factors.join(', ')}`
      : 'Interest alignment based on general preferences';

  return { score, explanation };
}

/**
 * Calculate values alignment score
 */
function calculateValuesAlignment(
  quizAnswers: QuizAnswers,
  roleProfile: RoleProfile,
): { score: number; explanation: string } {
  const userValues: string[] = [];

  // Extract values from quiz answers
  if (quizAnswers.work_values) {
    const vals = Array.isArray(quizAnswers.work_values)
      ? quizAnswers.work_values
      : [String(quizAnswers.work_values)];
    userValues.push(...vals);
  }

  if (!roleProfile.values || roleProfile.values.length === 0) {
    return { score: 50, explanation: 'Values assessment neutral - limited role data' };
  }

  const matchedValues = userValues.filter((uv) =>
    roleProfile.values!.some((rv) => rv.toLowerCase().includes(uv.toLowerCase())),
  );

  const score = Math.round((matchedValues.length / Math.max(userValues.length, 1)) * 100);
  const explanation =
    matchedValues.length > 0
      ? `Values aligned: ${matchedValues.join(', ')}`
      : 'Values assessment based on role characteristics';

  return { score, explanation };
}

/**
 * Calculate experience level match
 */
function calculateExperienceMatch(
  userProfile: UserProfile,
  roleProfile: RoleProfile,
): { score: number; explanation: string } {
  if (!roleProfile.experience_level || userProfile.experience_years === undefined) {
    return { score: 50, explanation: 'Experience level neutral' };
  }

  const levelMap: Record<string, { min: number; max: number }> = {
    entry: { min: 0, max: 2 },
    junior: { min: 1, max: 3 },
    mid: { min: 3, max: 6 },
    senior: { min: 5, max: 10 },
    lead: { min: 7, max: 15 },
    executive: { min: 10, max: 30 },
  };

  const level = levelMap[roleProfile.experience_level.toLowerCase()];
  if (!level) {
    return { score: 50, explanation: 'Experience level neutral' };
  }

  const years = userProfile.experience_years;
  let score: number;
  let explanation: string;

  if (years >= level.min && years <= level.max) {
    score = 100;
    explanation = `Experience level ideal for ${roleProfile.experience_level} role`;
  } else if (years < level.min) {
    const gap = level.min - years;
    score = Math.max(0, 100 - gap * 20);
    explanation = `${gap} year(s) below typical experience level`;
  } else {
    const over = years - level.max;
    score = Math.max(60, 100 - over * 5); // Slight penalty for overqualification
    explanation = 'May be overqualified for this level';
  }

  return { score, explanation };
}

/**
 * Calculate constraint satisfaction (salary, location, etc.)
 */
function calculateConstraintSatisfaction(
  userProfile: UserProfile,
  roleProfile: RoleProfile,
): { score: number; explanation: string } {
  const factors: { satisfied: boolean; label: string }[] = [];

  // Salary constraint
  if (userProfile.salary_expectation && roleProfile.salary_range) {
    const satisfied = userProfile.salary_expectation <= roleProfile.salary_range.max;
    factors.push({
      satisfied,
      label: satisfied ? 'salary within range' : 'salary expectation above range',
    });
  }

  // Remote constraint
  if (userProfile.remote_preference !== undefined && roleProfile.remote_friendly !== undefined) {
    const satisfied = !userProfile.remote_preference || roleProfile.remote_friendly;
    factors.push({
      satisfied,
      label: satisfied ? 'remote flexibility available' : 'remote work not available',
    });
  }

  if (factors.length === 0) {
    return { score: 50, explanation: 'Constraints not evaluated' };
  }

  const satisfiedCount = factors.filter((f) => f.satisfied).length;
  const score = Math.round((satisfiedCount / factors.length) * 100);

  const satisfiedLabels = factors.filter((f) => f.satisfied).map((f) => f.label);
  const unsatisfiedLabels = factors.filter((f) => !f.satisfied).map((f) => f.label);

  let explanation = '';
  if (satisfiedLabels.length > 0) {
    explanation = satisfiedLabels.join(', ');
  }
  if (unsatisfiedLabels.length > 0) {
    explanation += (explanation ? '; ' : '') + unsatisfiedLabels.join(', ');
  }

  return { score, explanation };
}

/**
 * Determine confidence level based on data completeness
 */
function calculateConfidence(
  roleProfile: RoleProfile,
  userProfile: UserProfile,
  quizAnswers: QuizAnswers,
): 'high' | 'medium' | 'low' {
  let dataPoints = 0;
  let filledPoints = 0;

  // Role profile completeness
  dataPoints += 5;
  if (roleProfile.required_skills && roleProfile.required_skills.length > 0) filledPoints++;
  if (roleProfile.industry) filledPoints++;
  if (roleProfile.work_style && roleProfile.work_style.length > 0) filledPoints++;
  if (roleProfile.experience_level) filledPoints++;
  if (roleProfile.salary_range) filledPoints++;

  // User profile completeness
  dataPoints += 4;
  if (userProfile.skills && userProfile.skills.length > 0) filledPoints++;
  if (userProfile.experience_years !== undefined) filledPoints++;
  if (userProfile.interests && userProfile.interests.length > 0) filledPoints++;
  if (userProfile.values && userProfile.values.length > 0) filledPoints++;

  // Quiz completeness
  const quizAnswerCount = Object.keys(quizAnswers).length;
  dataPoints += 1;
  if (quizAnswerCount >= 10) filledPoints++;

  const completeness = filledPoints / dataPoints;

  if (completeness >= 0.7) return 'high';
  if (completeness >= 0.4) return 'medium';
  return 'low';
}

/**
 * Calculate comprehensive fit score with transparent drivers
 */
export function calculateFitScore(
  roleProfile: RoleProfile,
  userProfile: UserProfile,
  quizAnswers: QuizAnswers = {},
): FitScore {
  const drivers: FitScoreDriver[] = [];

  // Skills match
  const skillMatch = calculateSkillMatch(
    userProfile.skills || [],
    roleProfile.required_skills || [],
    roleProfile.preferred_skills || [],
  );
  drivers.push({
    factor: 'Skills Match',
    score: skillMatch.score,
    contribution: FACTOR_WEIGHTS.skills * 100,
    explanation: skillMatch.explanation,
  });

  // Interest alignment
  const interestAlign = calculateInterestAlignment(quizAnswers, roleProfile);
  drivers.push({
    factor: 'Interest Alignment',
    score: interestAlign.score,
    contribution: FACTOR_WEIGHTS.interests * 100,
    explanation: interestAlign.explanation,
  });

  // Values alignment
  const valuesAlign = calculateValuesAlignment(quizAnswers, roleProfile);
  drivers.push({
    factor: 'Values Alignment',
    score: valuesAlign.score,
    contribution: FACTOR_WEIGHTS.values * 100,
    explanation: valuesAlign.explanation,
  });

  // Experience match
  const expMatch = calculateExperienceMatch(userProfile, roleProfile);
  drivers.push({
    factor: 'Experience Level',
    score: expMatch.score,
    contribution: FACTOR_WEIGHTS.experience * 100,
    explanation: expMatch.explanation,
  });

  // Constraint satisfaction
  const constraints = calculateConstraintSatisfaction(userProfile, roleProfile);
  drivers.push({
    factor: 'Practical Fit',
    score: constraints.score,
    contribution: FACTOR_WEIGHTS.constraints * 100,
    explanation: constraints.explanation,
  });

  // Calculate weighted overall score
  const overall = Math.round(
    drivers.reduce((sum, driver) => {
      const weight = driver.contribution / 100;
      return sum + driver.score * weight;
    }, 0),
  );

  const confidence = calculateConfidence(roleProfile, userProfile, quizAnswers);

  return {
    overall,
    drivers,
    confidence,
  };
}

/**
 * Get display color for fit score
 */
export function getFitScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-blue-600';
  if (score >= 40) return 'text-amber-600';
  return 'text-red-600';
}

/**
 * Get display color class for background
 */
export function getFitScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-emerald-50';
  if (score >= 60) return 'bg-blue-50';
  if (score >= 40) return 'bg-amber-50';
  return 'bg-red-50';
}

/**
 * Get fit score label
 */
export function getFitScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent Fit';
  if (score >= 60) return 'Good Fit';
  if (score >= 40) return 'Moderate Fit';
  return 'Needs Development';
}

/**
 * Calculate skill gap analysis
 */
export function analyzeSkillGaps(
  userSkills: string[],
  roleSkills: RoleSkill[],
): { missing: RoleSkill[]; matched: RoleSkill[]; partial: RoleSkill[] } {
  const normalizedUserSkills = userSkills.map((s) => s.toLowerCase());

  const missing: RoleSkill[] = [];
  const matched: RoleSkill[] = [];
  const partial: RoleSkill[] = [];

  for (const skill of roleSkills) {
    const normalizedSkillName = skill.name.toLowerCase();
    const isExactMatch = normalizedUserSkills.some((us) => us === normalizedSkillName);
    const isPartialMatch =
      !isExactMatch &&
      normalizedUserSkills.some(
        (us) => us.includes(normalizedSkillName) || normalizedSkillName.includes(us),
      );

    if (isExactMatch) {
      matched.push(skill);
    } else if (isPartialMatch) {
      partial.push(skill);
    } else {
      missing.push(skill);
    }
  }

  return { missing, matched, partial };
}
