/**
 * Suggestion Rules
 * Rule-based suggestion generation for resume content
 * Used as fallback when AI suggestions are not available
 */

import type {
  Education,
  Experience,
  Project,
  ResumeData,
} from '@/components/resume/ResumeDocument';
import type { Suggestion, TopFix } from '@/types/resume-editor';

import { generateSpanId, parseBulletPoints } from './span-utils';

// ============================================================================
// Constants
// ============================================================================

// Weak verbs that should be replaced with stronger action verbs
const WEAK_VERBS = [
  'helped',
  'worked',
  'did',
  'made',
  'got',
  'used',
  'tried',
  'was responsible for',
  'was in charge of',
  'handled',
  'dealt with',
  'assisted',
  'participated',
  'contributed',
  'supported',
];

// Strong action verbs by category
const STRONG_VERBS = {
  leadership: ['Led', 'Directed', 'Managed', 'Orchestrated', 'Spearheaded', 'Championed'],
  creation: ['Developed', 'Built', 'Designed', 'Created', 'Launched', 'Established'],
  improvement: ['Improved', 'Enhanced', 'Optimized', 'Streamlined', 'Transformed', 'Revamped'],
  achievement: ['Achieved', 'Exceeded', 'Delivered', 'Generated', 'Increased', 'Reduced'],
  technical: ['Implemented', 'Engineered', 'Architected', 'Automated', 'Integrated', 'Deployed'],
};

// Regex patterns for detecting metrics
const METRIC_PATTERNS = [
  /\d+%/, // Percentages: 50%
  /\$[\d,]+/, // Dollar amounts: $1,000
  /\d+\+?/, // Numbers: 100, 50+
  /\d+x/, // Multipliers: 3x
  /\d+k/i, // Thousands: 10k
  /\d+m/i, // Millions: 5M
];

// Passive voice indicators
const PASSIVE_INDICATORS = [
  'was used',
  'were created',
  'was implemented',
  'were developed',
  'was managed',
  'were handled',
  'was built',
  'were improved',
];

function replaceFirstInsensitive(text: string, search: string, replacement: string): string {
  const lowerText = text.toLowerCase();
  const lowerSearch = search.toLowerCase();
  const index = lowerText.indexOf(lowerSearch);
  if (index === -1) return text;
  return text.slice(0, index) + replacement + text.slice(index + search.length);
}

// ============================================================================
// Suggestion Generation
// ============================================================================

/**
 * Generate all rule-based suggestions for a resume
 */
export function generateMockSuggestions(data: ResumeData): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Summary suggestions
  if (data.summary) {
    suggestions.push(...generateSummarySuggestions(data.summary));
  }

  // Experience suggestions
  if (data.experience) {
    data.experience.forEach((exp, _index) => {
      suggestions.push(...generateExperienceSuggestions(exp));
    });
  }

  // Education suggestions
  if (data.education) {
    data.education.forEach((edu, _index) => {
      suggestions.push(...generateEducationSuggestions(edu));
    });
  }

  // Skills suggestions
  if (data.skills) {
    suggestions.push(...generateSkillsSuggestions(data.skills));
  }

  // Projects suggestions
  if (data.projects) {
    data.projects.forEach((project, _index) => {
      suggestions.push(...generateProjectSuggestions(project));
    });
  }

  return suggestions;
}

/**
 * Generate suggestions for the summary section
 */
function generateSummarySuggestions(summary: string): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const spanId = generateSpanId({ sectionType: 'summary', field: 'text' });

  // Check summary length
  const wordCount = summary.split(/\s+/).length;
  if (wordCount < 30) {
    suggestions.push({
      suggestionId: `summary-length-short`,
      spanId,
      severity: 'improve',
      type: 'length',
      category: 'Clarity',
      message:
        'Your summary is quite short. Aim for 50-100 words to highlight your key qualifications.',
      proposedText: null,
      dismissed: false,
    });
  } else if (wordCount > 100) {
    suggestions.push({
      suggestionId: `summary-length-long`,
      spanId,
      severity: 'optional',
      type: 'length',
      category: 'Clarity',
      message: 'Consider condensing your summary. The ideal length is 50-100 words.',
      proposedText: null,
      dismissed: false,
    });
  }

  // Check for first-person pronouns (often discouraged in resumes)
  if (/\bI\b/.test(summary)) {
    suggestions.push({
      suggestionId: `summary-first-person`,
      spanId,
      severity: 'optional',
      type: 'clarity',
      category: 'Clarity',
      message: 'Consider removing first-person pronouns ("I") for a more professional tone.',
      proposedText: null,
      dismissed: false,
    });
  }

  // Check for metrics in summary
  if (!METRIC_PATTERNS.some((pattern) => pattern.test(summary))) {
    suggestions.push({
      suggestionId: `summary-no-metrics`,
      spanId,
      severity: 'improve',
      type: 'metric',
      category: 'Impact',
      message: 'Add quantifiable achievements to your summary (e.g., "10+ years", "$1M+ revenue").',
      proposedText: null,
      dismissed: false,
    });
  }

  return suggestions;
}

/**
 * Generate suggestions for experience entries
 */
function generateExperienceSuggestions(experience: Experience): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const bullets = parseBulletPoints(experience.description || '');

  bullets.forEach((bullet, bulletIndex) => {
    const spanId = generateSpanId({
      sectionType: 'experience',
      itemId: experience.id,
      field: 'description',
      lineIndex: bulletIndex,
    });

    // Check for weak verbs
    const lowerBullet = bullet.toLowerCase();
    for (const weakVerb of WEAK_VERBS) {
      if (lowerBullet.startsWith(weakVerb) || lowerBullet.includes(` ${weakVerb} `)) {
        const strongVerb = suggestStrongerVerb(bullet);
        suggestions.push({
          suggestionId: `exp-${experience.id}-${bulletIndex}-weak-verb`,
          spanId,
          severity: 'improve',
          type: 'verb',
          category: 'Impact',
          message: `"${weakVerb}" is a weak verb. Use a stronger action verb.`,
          proposedText: strongVerb ? replaceFirstInsensitive(bullet, weakVerb, strongVerb) : null,
          explainText:
            'Strong action verbs make your achievements more compelling and demonstrate leadership.',
          dismissed: false,
        });
        break; // Only one verb suggestion per bullet
      }
    }

    // Check for missing metrics
    if (!METRIC_PATTERNS.some((pattern) => pattern.test(bullet))) {
      suggestions.push({
        suggestionId: `exp-${experience.id}-${bulletIndex}-no-metric`,
        spanId,
        severity: 'improve',
        type: 'metric',
        category: 'Impact',
        message: 'Add quantifiable results (%, $, numbers) to show impact.',
        proposedText: null,
        explainText: 'Numbers and percentages make your achievements more credible and memorable.',
        dismissed: false,
      });
    }

    // Check bullet length
    const wordCount = bullet.split(/\s+/).length;
    if (wordCount > 25) {
      suggestions.push({
        suggestionId: `exp-${experience.id}-${bulletIndex}-too-long`,
        spanId,
        severity: 'optional',
        type: 'length',
        category: 'Clarity',
        message: 'This bullet point is quite long. Consider splitting it into two points.',
        proposedText: null,
        dismissed: false,
      });
    }

    // Check for passive voice
    for (const passive of PASSIVE_INDICATORS) {
      if (lowerBullet.includes(passive)) {
        suggestions.push({
          suggestionId: `exp-${experience.id}-${bulletIndex}-passive`,
          spanId,
          severity: 'optional',
          type: 'clarity',
          category: 'Clarity',
          message: 'Consider using active voice for more impact.',
          proposedText: null,
          explainText: 'Active voice is more direct and engaging than passive voice.',
          dismissed: false,
        });
        break;
      }
    }
  });

  // Check if experience has bullets at all
  if (bullets.length === 0 && experience.description) {
    suggestions.push({
      suggestionId: `exp-${experience.id}-no-bullets`,
      spanId: generateSpanId({
        sectionType: 'experience',
        itemId: experience.id,
        field: 'description',
      }),
      severity: 'critical',
      type: 'clarity',
      category: 'Format',
      message: 'Use bullet points to list your achievements instead of a paragraph.',
      proposedText: null,
      dismissed: false,
    });
  }

  // Check minimum bullet count
  if (bullets.length > 0 && bullets.length < 3) {
    suggestions.push({
      suggestionId: `exp-${experience.id}-few-bullets`,
      spanId: generateSpanId({
        sectionType: 'experience',
        itemId: experience.id,
        field: 'description',
      }),
      severity: 'improve',
      type: 'impact',
      category: 'Impact',
      message: 'Consider adding more bullet points to fully showcase your accomplishments.',
      proposedText: null,
      dismissed: false,
    });
  }

  return suggestions;
}

/**
 * Generate suggestions for education entries
 */
function generateEducationSuggestions(education: Education): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Check for missing GPA if recently graduated
  if (!education.gpa && education.endYear) {
    const endYear = parseInt(education.endYear, 10);
    const currentYear = new Date().getFullYear();
    if (currentYear - endYear <= 3) {
      suggestions.push({
        suggestionId: `edu-${education.id}-no-gpa`,
        spanId: generateSpanId({ sectionType: 'education', itemId: education.id, field: 'gpa' }),
        severity: 'optional',
        type: 'impact',
        category: 'Impact',
        message: "Consider adding your GPA if it's 3.0 or higher.",
        proposedText: null,
        dismissed: false,
      });
    }
  }

  // Check for missing honors
  if (!education.honors && education.gpa && parseFloat(education.gpa) >= 3.5) {
    suggestions.push({
      suggestionId: `edu-${education.id}-no-honors`,
      spanId: generateSpanId({ sectionType: 'education', itemId: education.id, field: 'honors' }),
      severity: 'optional',
      type: 'impact',
      category: 'Impact',
      message: "Add relevant honors, awards, or Dean's List recognition.",
      proposedText: null,
      dismissed: false,
    });
  }

  return suggestions;
}

/**
 * Generate suggestions for skills
 */
function generateSkillsSuggestions(skills: string[]): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const spanId = generateSpanId({ sectionType: 'skills', field: 'list' });

  // Check skill count
  if (skills.length < 5) {
    suggestions.push({
      suggestionId: 'skills-too-few',
      spanId,
      severity: 'improve',
      type: 'impact',
      category: 'ATS',
      message: 'Add more skills (aim for 8-15) to improve ATS keyword matching.',
      proposedText: null,
      dismissed: false,
    });
  } else if (skills.length > 20) {
    suggestions.push({
      suggestionId: 'skills-too-many',
      spanId,
      severity: 'optional',
      type: 'clarity',
      category: 'Clarity',
      message: 'Consider removing less relevant skills to focus on your strongest ones.',
      proposedText: null,
      dismissed: false,
    });
  }

  // Check for generic skills
  const genericSkills = ['Microsoft Office', 'Communication', 'Teamwork', 'Problem Solving'];
  const hasGeneric = skills.some((skill) =>
    genericSkills.some((generic) => skill.toLowerCase().includes(generic.toLowerCase())),
  );
  if (hasGeneric) {
    suggestions.push({
      suggestionId: 'skills-generic',
      spanId,
      severity: 'optional',
      type: 'impact',
      category: 'Impact',
      message:
        'Replace generic skills with more specific, technical skills relevant to your target role.',
      proposedText: null,
      dismissed: false,
    });
  }

  return suggestions;
}

/**
 * Generate suggestions for project entries
 */
function generateProjectSuggestions(project: Project): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Check for technologies
  if (!project.technologies) {
    suggestions.push({
      suggestionId: `proj-${project.id}-no-tech`,
      spanId: generateSpanId({
        sectionType: 'projects',
        itemId: project.id,
        field: 'technologies',
      }),
      severity: 'improve',
      type: 'ats',
      category: 'ATS',
      message: 'Add technologies used to improve keyword matching.',
      proposedText: null,
      dismissed: false,
    });
  }

  // Check for project URL
  if (!project.url) {
    suggestions.push({
      suggestionId: `proj-${project.id}-no-url`,
      spanId: generateSpanId({ sectionType: 'projects', itemId: project.id, field: 'url' }),
      severity: 'optional',
      type: 'impact',
      category: 'Impact',
      message: 'Add a link to the project (GitHub, live demo) if available.',
      proposedText: null,
      dismissed: false,
    });
  }

  return suggestions;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Suggest a stronger verb to replace a weak one
 */
export function suggestStrongerVerb(text: string): string | null {
  const lowerText = text.toLowerCase();
  const hash = lowerText.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

  // Map context to verb category
  if (
    lowerText.includes('team') ||
    lowerText.includes('project') ||
    lowerText.includes('initiative')
  ) {
    return STRONG_VERBS.leadership[hash % STRONG_VERBS.leadership.length];
  }
  if (lowerText.includes('build') || lowerText.includes('create') || lowerText.includes('design')) {
    return STRONG_VERBS.creation[hash % STRONG_VERBS.creation.length];
  }
  if (
    lowerText.includes('improve') ||
    lowerText.includes('enhance') ||
    lowerText.includes('optim')
  ) {
    return STRONG_VERBS.improvement[hash % STRONG_VERBS.improvement.length];
  }
  if (
    lowerText.includes('code') ||
    lowerText.includes('develop') ||
    lowerText.includes('software')
  ) {
    return STRONG_VERBS.technical[hash % STRONG_VERBS.technical.length];
  }

  // Default to achievement verbs
  return STRONG_VERBS.achievement[hash % STRONG_VERBS.achievement.length];
}

/**
 * Generate top fixes from suggestions
 */
export function generateTopFixes(suggestions: Suggestion[]): TopFix[] {
  const fixes: TopFix[] = [];

  // Count critical issues by type
  const criticalByType: Record<string, Suggestion[]> = {};
  suggestions
    .filter((s) => s.severity === 'critical' || s.severity === 'improve')
    .forEach((s) => {
      if (!criticalByType[s.type]) {
        criticalByType[s.type] = [];
      }
      criticalByType[s.type].push(s);
    });

  // Generate fixes for most impactful issues
  if (criticalByType['metric']?.length > 0) {
    fixes.push({
      fixId: 'fix-metrics',
      suggestionIds: criticalByType['metric'].map((s) => s.suggestionId),
      message: `Add metrics to ${criticalByType['metric'].length} bullet points`,
      impact: 'high',
    });
  }

  if (criticalByType['verb']?.length > 0) {
    fixes.push({
      fixId: 'fix-verbs',
      suggestionIds: criticalByType['verb'].map((s) => s.suggestionId),
      message: `Strengthen ${criticalByType['verb'].length} weak verbs`,
      impact: 'medium',
    });
  }

  if (criticalByType['ats']?.length > 0) {
    fixes.push({
      fixId: 'fix-ats',
      suggestionIds: criticalByType['ats'].map((s) => s.suggestionId),
      message: `Improve ${criticalByType['ats'].length} ATS keywords`,
      impact: 'high',
    });
  }

  // Return top 3
  return fixes.slice(0, 3);
}
