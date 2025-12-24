import type { ResumeData } from '@/components/resume/ResumeDocument';
import type { ResumeScore, Suggestion, TopFix } from '@/types/resume-editor';

import { parseBulletPoints } from './resume-editor/span-utils';

export interface ScoreBreakdown {
  total: number;
  sections: {
    contactInfo: SectionScore;
    summary: SectionScore;
    experience: SectionScore;
    education: SectionScore;
    skills: SectionScore;
  };
}

export interface SectionScore {
  score: number;
  max: number;
  label: string;
  feedback?: string;
}

/**
 * Calculate resume completion score based on filled fields
 * Returns a percentage (0-100)
 */
export function calculateResumeScore(data: ResumeData): number {
  const breakdown = getScoreBreakdown(data);
  return breakdown.total;
}

/**
 * Get detailed score breakdown by section
 */
export function getScoreBreakdown(data: ResumeData): ScoreBreakdown {
  const contactInfo = scoreContactInfo(data.contactInfo);
  const summary = scoreSummary(data.summary);
  const experience = scoreExperience(data.experience);
  const education = scoreEducation(data.education);
  const skills = scoreSkills(data.skills);

  const totalScore =
    contactInfo.score + summary.score + experience.score + education.score + skills.score;
  const maxScore = contactInfo.max + summary.max + experience.max + education.max + skills.max;

  return {
    total: Math.round((totalScore / maxScore) * 100),
    sections: {
      contactInfo,
      summary,
      experience,
      education,
      skills,
    },
  };
}

function scoreContactInfo(info: ResumeData['contactInfo']): SectionScore {
  let score = 0;
  const max = 20;

  if (info?.name && info.name.trim()) score += 5;
  if (info?.email && info.email.trim()) score += 5;
  if (info?.phone && info.phone.trim()) score += 5;
  if (info?.linkedin && info.linkedin.trim()) score += 3;
  if (info?.location && info.location.trim()) score += 2;

  let feedback = '';
  if (score < 10) {
    feedback = 'Add your contact information';
  } else if (score < 15) {
    feedback = 'Consider adding LinkedIn profile';
  } else if (score < max) {
    feedback = 'Add location for local job searches';
  }

  return { score: Math.min(score, max), max, label: 'Contact Info', feedback };
}

function scoreSummary(summary?: string): SectionScore {
  let score = 0;
  const max = 15;

  if (summary && summary.trim()) {
    const length = summary.trim().length;
    if (length >= 200) {
      score = 15;
    } else if (length >= 100) {
      score = 12;
    } else if (length >= 50) {
      score = 8;
    } else {
      score = 4;
    }
  }

  let feedback = '';
  if (score === 0) {
    feedback = 'Add a professional summary';
  } else if (score < 12) {
    feedback = 'Expand your summary (aim for 100+ characters)';
  }

  return { score, max, label: 'Summary', feedback };
}

function scoreExperience(experience?: ResumeData['experience']): SectionScore {
  let score = 0;
  const max = 30;

  if (experience && experience.length > 0) {
    // Base score for having experience
    const entryCount = Math.min(experience.length, 3);
    score += entryCount * 6; // Up to 18 points for 3 entries

    // Bonus for detailed entries
    for (const exp of experience.slice(0, 3)) {
      if (exp.description && exp.description.length > 100) {
        score += 2;
      }
      if (exp.company && exp.title) {
        score += 2;
      }
    }
  }

  let feedback = '';
  if (score === 0) {
    feedback = 'Add your work experience';
  } else if (score < 15) {
    feedback = 'Add more detail to your experience entries';
  } else if (score < 24) {
    feedback = 'Consider adding more experience entries';
  }

  return { score: Math.min(score, max), max, label: 'Experience', feedback };
}

function scoreEducation(education?: ResumeData['education']): SectionScore {
  let score = 0;
  const max = 15;

  if (education && education.length > 0) {
    score += 10; // Base score for having education

    const firstEdu = education[0];
    if (firstEdu.degree) score += 2;
    if (firstEdu.field) score += 2;
    if (firstEdu.school) score += 1;
  }

  let feedback = '';
  if (score === 0) {
    feedback = 'Add your education';
  } else if (score < 12) {
    feedback = 'Add degree and field of study';
  }

  return { score: Math.min(score, max), max, label: 'Education', feedback };
}

function scoreSkills(skills?: string[]): SectionScore {
  let score = 0;
  const max = 20;

  if (skills && skills.length > 0) {
    // 4 points per skill, up to 5 skills = 20 points
    const skillCount = Math.min(skills.length, 5);
    score = skillCount * 4;
  }

  let feedback = '';
  if (score === 0) {
    feedback = 'Add your skills';
  } else if (score < 12) {
    feedback = 'Add more relevant skills (aim for 5+)';
  }

  return { score: Math.min(score, max), max, label: 'Skills', feedback };
}

/**
 * Get the color for the score indicator
 */
export function getScoreColor(score: number): string {
  if (score < 30) return '#ef4444'; // Red
  if (score < 50) return '#f97316'; // Orange
  if (score < 70) return '#eab308'; // Yellow
  return '#22c55e'; // Green
}

/**
 * Get encouragement message based on score
 */
export function getScoreMessage(score: number): string {
  if (score < 20) return 'Just getting started';
  if (score < 40) return 'Keep going!';
  if (score < 60) return 'Making progress';
  if (score < 80) return 'Looking good!';
  return 'Excellent resume!';
}

// ============================================================================
// Enhanced Scoring System for 3-Panel Editor
// ============================================================================

/**
 * Score weight configuration
 * Impact 25%, Clarity 20%, Relevance 25%, ATS 15%, Consistency 15%
 */
const SCORE_WEIGHTS = {
  impact: 0.25,
  clarity: 0.2,
  relevance: 0.25,
  ats: 0.15,
  consistency: 0.15,
};

/**
 * Action verbs that indicate strong impact
 */
const STRONG_ACTION_VERBS = [
  'led',
  'managed',
  'directed',
  'orchestrated',
  'spearheaded',
  'championed',
  'developed',
  'built',
  'designed',
  'created',
  'launched',
  'established',
  'improved',
  'enhanced',
  'optimized',
  'streamlined',
  'transformed',
  'revamped',
  'achieved',
  'exceeded',
  'delivered',
  'generated',
  'increased',
  'reduced',
  'implemented',
  'engineered',
  'architected',
  'automated',
  'integrated',
  'deployed',
];

/**
 * Patterns that indicate quantified achievements
 */
const METRIC_PATTERNS = [
  /\d+%/, // Percentages: 50%
  /\$[\d,]+/, // Dollar amounts: $1,000
  /\d+\+?\s*(users|clients|customers|projects|team|members)/i, // User counts
  /\d+x/, // Multipliers: 3x
  /\d+K\b/, // Thousands: 10K
  /\d+M\b/, // Millions: 5M
  /increased.*by\s+\d+/i, // "increased by X"
  /reduced.*by\s+\d+/i, // "reduced by X"
  /saved.*\d+/i, // "saved X"
];

/**
 * ATS-friendly formatting checks
 */
const ATS_REQUIREMENTS = {
  hasContactSection: (data: ResumeData) => !!(data.contactInfo.name && data.contactInfo.email),
  hasPhone: (data: ResumeData) => !!data.contactInfo.phone,
  hasLinkedIn: (data: ResumeData) => !!data.contactInfo.linkedin,
  hasSummary: (data: ResumeData) => !!(data.summary && data.summary.length > 50),
  hasExperience: (data: ResumeData) => (data.experience?.length || 0) > 0,
  hasEducation: (data: ResumeData) => (data.education?.length || 0) > 0,
  hasSkills: (data: ResumeData) => (data.skills?.length || 0) >= 5,
  experienceHasDates: (data: ResumeData) => data.experience?.every((exp) => exp.startDate) || false,
  educationHasDates: (data: ResumeData) => data.education?.every((edu) => edu.startYear) || false,
};

/**
 * Calculate enhanced resume score with 5 subscores
 *
 * @param data Resume data to score
 * @param suggestions Optional suggestions from the coach system
 * @returns Enhanced score with subscores and top fixes
 */
export function calculateEnhancedScore(data: ResumeData, suggestions?: Suggestion[]): ResumeScore {
  const impact = calculateImpactScore(data);
  const clarity = calculateClarityScore(data);
  const relevance = calculateRelevanceScore(data);
  const ats = calculateATSScore(data);
  const consistency = calculateConsistencyScore(data);

  // Calculate weighted overall score
  const overallScore = Math.round(
    impact * SCORE_WEIGHTS.impact +
      clarity * SCORE_WEIGHTS.clarity +
      relevance * SCORE_WEIGHTS.relevance +
      ats * SCORE_WEIGHTS.ats +
      consistency * SCORE_WEIGHTS.consistency,
  );

  // Generate top fixes based on lowest subscores and suggestions
  const topFixes = generateTopFixes(
    data,
    { impact, clarity, relevance, ats, consistency },
    suggestions,
  );

  return {
    overallScore,
    subscores: { impact, clarity, relevance, ats, consistency },
    topFixes,
  };
}

/**
 * Calculate Impact score (0-100)
 * Measures: action verbs, quantified achievements, results-oriented language
 */
function calculateImpactScore(data: ResumeData): number {
  let score = 0;
  let checks = 0;

  // Check experience bullets for action verbs and metrics
  if (data.experience && data.experience.length > 0) {
    let strongVerbCount = 0;
    let metricCount = 0;
    let totalBullets = 0;

    for (const exp of data.experience) {
      const bullets = parseBulletPoints(exp.description || '');
      totalBullets += bullets.length;

      for (const bullet of bullets) {
        const lowerBullet = bullet.toLowerCase();

        // Check for strong action verbs
        const firstWord = lowerBullet.split(/\s+/)[0];
        if (STRONG_ACTION_VERBS.includes(firstWord)) {
          strongVerbCount++;
        }

        // Check for metrics
        if (METRIC_PATTERNS.some((pattern) => pattern.test(bullet))) {
          metricCount++;
        }
      }
    }

    if (totalBullets > 0) {
      // Action verb usage (50% of impact score)
      const verbRatio = strongVerbCount / totalBullets;
      score += verbRatio * 50;
      checks++;

      // Metric usage (50% of impact score)
      const metricRatio = metricCount / totalBullets;
      score += Math.min(metricRatio * 2, 1) * 50; // 50% metrics = full score
      checks++;
    }
  }

  // Check summary for impact language
  if (data.summary) {
    const summaryLower = data.summary.toLowerCase();
    let summaryImpact = 0;

    // Check for achievement words
    const achievementWords = ['achieved', 'delivered', 'generated', 'created', 'led', 'managed'];
    if (achievementWords.some((word) => summaryLower.includes(word))) {
      summaryImpact += 40;
    }

    // Check for metrics in summary
    if (METRIC_PATTERNS.some((pattern) => pattern.test(data.summary))) {
      summaryImpact += 60;
    }

    score += summaryImpact;
    checks++;
  }

  return checks > 0 ? Math.min(Math.round(score / checks), 100) : 0;
}

/**
 * Calculate Clarity score (0-100)
 * Measures: conciseness, readability, bullet length, no passive voice
 */
function calculateClarityScore(data: ResumeData): number {
  let score = 100; // Start at 100 and deduct

  // Check summary length and clarity
  if (data.summary) {
    const wordCount = data.summary.split(/\s+/).length;

    // Ideal summary: 50-100 words
    if (wordCount < 30) {
      score -= 15; // Too short
    } else if (wordCount > 150) {
      score -= 20; // Too long
    }

    // Check for first person pronouns
    if (/\bI\b/.test(data.summary)) {
      score -= 10;
    }
  } else {
    score -= 20; // No summary
  }

  // Check experience bullet clarity
  if (data.experience && data.experience.length > 0) {
    let longBulletCount = 0;
    let passiveVoiceCount = 0;
    let totalBullets = 0;

    for (const exp of data.experience) {
      const bullets = parseBulletPoints(exp.description || '');
      totalBullets += bullets.length;

      for (const bullet of bullets) {
        const wordCount = bullet.split(/\s+/).length;

        // Deduct for overly long bullets (>25 words)
        if (wordCount > 25) {
          longBulletCount++;
        }

        // Check for passive voice indicators
        const passiveIndicators = [
          'was used',
          'were created',
          'was implemented',
          'were developed',
          'was managed',
        ];
        if (passiveIndicators.some((ind) => bullet.toLowerCase().includes(ind))) {
          passiveVoiceCount++;
        }
      }
    }

    if (totalBullets > 0) {
      // Deduct for long bullets
      const longRatio = longBulletCount / totalBullets;
      score -= Math.round(longRatio * 20);

      // Deduct for passive voice
      const passiveRatio = passiveVoiceCount / totalBullets;
      score -= Math.round(passiveRatio * 15);
    }
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate Relevance score (0-100)
 * Measures: completeness of profile, skill coverage
 * Note: Would be enhanced with job description matching in future
 */
function calculateRelevanceScore(data: ResumeData): number {
  const maxPoints = 100;
  let earnedPoints = 0;

  // Contact completeness (15 points)
  if (data.contactInfo.name) earnedPoints += 5;
  if (data.contactInfo.email) earnedPoints += 5;
  if (data.contactInfo.phone) earnedPoints += 3;
  if (data.contactInfo.linkedin) earnedPoints += 2;

  // Summary present and substantial (20 points)
  if (data.summary) {
    const wordCount = data.summary.split(/\s+/).length;
    if (wordCount >= 50) earnedPoints += 20;
    else if (wordCount >= 30) earnedPoints += 15;
    else earnedPoints += 10;
  }

  // Experience completeness (30 points)
  if (data.experience && data.experience.length > 0) {
    const expScore = Math.min(data.experience.length * 7, 21); // Up to 21 points for 3+ experiences
    earnedPoints += expScore;

    // Bonus for detailed descriptions
    let detailedCount = 0;
    for (const exp of data.experience.slice(0, 3)) {
      const bullets = parseBulletPoints(exp.description || '');
      if (bullets.length >= 3) detailedCount++;
    }
    earnedPoints += Math.min(detailedCount * 3, 9);
  }

  // Education completeness (15 points)
  if (data.education && data.education.length > 0) {
    earnedPoints += 10;
    const firstEdu = data.education[0];
    if (firstEdu.degree) earnedPoints += 3;
    if (firstEdu.field) earnedPoints += 2;
  }

  // Skills coverage (20 points)
  if (data.skills) {
    const skillScore = Math.min(data.skills.length * 2, 20);
    earnedPoints += skillScore;
  }

  const score = Math.round((earnedPoints / maxPoints) * 100);
  return Math.min(100, score);
}

/**
 * Calculate ATS score (0-100)
 * Measures: format compliance, standard sections, proper structure
 */
function calculateATSScore(data: ResumeData): number {
  let score = 0;
  const checks = Object.entries(ATS_REQUIREMENTS);
  const totalChecks = checks.length;

  for (const [, checkFn] of checks) {
    if (checkFn(data)) {
      score += 100 / totalChecks;
    }
  }

  // Bonus/deduction for specific ATS factors
  // Check for proper email format
  if (data.contactInfo.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(data.contactInfo.email)) {
      score += 5;
    }
  }

  // Check for proper phone format
  if (data.contactInfo.phone) {
    const phoneRegex = /^[\d\s\-().+]{7,}$/;
    if (phoneRegex.test(data.contactInfo.phone)) {
      score += 5;
    }
  }

  return Math.min(100, Math.round(score));
}

/**
 * Calculate Consistency score (0-100)
 * Measures: date format consistency, tense consistency, style uniformity
 */
function calculateConsistencyScore(data: ResumeData): number {
  let score = 80; // Start with base score

  // Check date format consistency in experience
  if (data.experience && data.experience.length > 1) {
    const dateFormats = new Set<string>();

    for (const exp of data.experience) {
      if (exp.startDate) {
        // Detect date format type
        if (/^\d{4}$/.test(exp.startDate)) dateFormats.add('year-only');
        else if (/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}$/i.test(exp.startDate))
          dateFormats.add('month-year');
        else if (/^\d{1,2}\/\d{4}$/.test(exp.startDate)) dateFormats.add('mm-yyyy');
        else dateFormats.add('other');
      }
    }

    // Deduct for inconsistent date formats
    if (dateFormats.size > 1) {
      score -= 15;
    }
  }

  // Check education date consistency
  if (data.education && data.education.length > 1) {
    const hasStartYear = data.education.every((edu) => edu.startYear);
    const hasEndYear = data.education.every((edu) => edu.endYear);

    if (!hasStartYear || !hasEndYear) {
      score -= 10;
    }
  }

  // Check bullet point style consistency in experience
  if (data.experience && data.experience.length > 0) {
    let bulletsWithPeriod = 0;
    let bulletsWithoutPeriod = 0;
    let totalBullets = 0;

    for (const exp of data.experience) {
      const bullets = parseBulletPoints(exp.description || '');
      for (const bullet of bullets) {
        totalBullets++;
        if (bullet.trim().endsWith('.')) {
          bulletsWithPeriod++;
        } else {
          bulletsWithoutPeriod++;
        }
      }
    }

    // Check for inconsistent punctuation
    if (totalBullets > 2 && bulletsWithPeriod > 0 && bulletsWithoutPeriod > 0) {
      const ratio = Math.min(bulletsWithPeriod, bulletsWithoutPeriod) / totalBullets;
      if (ratio > 0.2) {
        score -= 10;
      }
    }
  }

  // Bonus for completeness consistency
  if (data.experience && data.experience.length > 0) {
    const allHaveCompany = data.experience.every((exp) => exp.company);
    const allHaveTitle = data.experience.every((exp) => exp.title);
    const allHaveDescription = data.experience.every((exp) => exp.description);

    if (allHaveCompany && allHaveTitle && allHaveDescription) {
      score += 10;
    }
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Generate top 3 actionable fixes based on scores and suggestions
 */
function generateTopFixes(
  data: ResumeData,
  subscores: ResumeScore['subscores'],
  suggestions?: Suggestion[],
): TopFix[] {
  const fixes: TopFix[] = [];

  // Prioritize critical suggestions first
  if (suggestions) {
    const criticalSuggestions = suggestions.filter(
      (s) => s.severity === 'critical' && !s.dismissed,
    );
    if (criticalSuggestions.length > 0) {
      fixes.push({
        fixId: 'fix-critical',
        suggestionIds: criticalSuggestions.slice(0, 5).map((s) => s.suggestionId),
        message: `Fix ${criticalSuggestions.length} critical issue${criticalSuggestions.length > 1 ? 's' : ''}`,
        impact: 'high',
      });
    }
  }

  // Sort subscores to find weakest areas
  const sortedScores = Object.entries(subscores)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 3);

  for (const [area, score] of sortedScores) {
    if (score >= 80) continue; // Skip areas that are already good

    const fix = generateFixForArea(area as keyof typeof subscores, score, data, suggestions);
    if (fix) {
      fixes.push(fix);
    }
  }

  return fixes.slice(0, 3);
}

/**
 * Generate a specific fix for an underperforming area
 */
function generateFixForArea(
  area: keyof ResumeScore['subscores'],
  score: number,
  data: ResumeData,
  suggestions?: Suggestion[],
): TopFix | null {
  const relatedSuggestions =
    suggestions
      ?.filter((s) => {
        switch (area) {
          case 'impact':
            return s.type === 'metric' || s.type === 'verb';
          case 'clarity':
            return s.type === 'clarity' || s.type === 'length';
          case 'relevance':
            return s.type === 'keyword';
          case 'ats':
            return s.type === 'ats';
          case 'consistency':
            return s.type === 'consistency';
          default:
            return false;
        }
      })
      .map((s) => s.suggestionId) || [];

  switch (area) {
    case 'impact':
      if (score < 50) {
        return {
          fixId: 'fix-impact-metrics',
          suggestionIds: relatedSuggestions,
          message: 'Add quantified achievements (%, $, numbers) to your bullets',
          impact: 'high',
        };
      } else if (score < 70) {
        return {
          fixId: 'fix-impact-verbs',
          suggestionIds: relatedSuggestions,
          message: 'Start bullets with strong action verbs',
          impact: 'medium',
        };
      }
      break;

    case 'clarity':
      if (score < 60) {
        return {
          fixId: 'fix-clarity-length',
          suggestionIds: relatedSuggestions,
          message: 'Shorten long bullet points for better readability',
          impact: 'medium',
        };
      }
      break;

    case 'relevance':
      if (!data.summary || data.summary.length < 50) {
        return {
          fixId: 'fix-relevance-summary',
          suggestionIds: relatedSuggestions,
          message: 'Write a compelling professional summary',
          impact: 'high',
        };
      } else if ((data.skills?.length || 0) < 5) {
        return {
          fixId: 'fix-relevance-skills',
          suggestionIds: relatedSuggestions,
          message: 'Add more relevant skills (aim for 8-15)',
          impact: 'medium',
        };
      }
      break;

    case 'ats':
      if (!data.contactInfo.linkedin) {
        return {
          fixId: 'fix-ats-linkedin',
          suggestionIds: relatedSuggestions,
          message: 'Add your LinkedIn profile URL',
          impact: 'low',
        };
      } else if ((data.skills?.length || 0) < 5) {
        return {
          fixId: 'fix-ats-keywords',
          suggestionIds: relatedSuggestions,
          message: 'Add more skills for better keyword matching',
          impact: 'high',
        };
      }
      break;

    case 'consistency':
      if (score < 70) {
        return {
          fixId: 'fix-consistency',
          suggestionIds: relatedSuggestions,
          message: 'Ensure consistent formatting across all sections',
          impact: 'low',
        };
      }
      break;
  }

  return null;
}
