/**
 * Local Suggestion Generator
 *
 * Generates suggestions for missing content WITHOUT calling AI.
 * This provides instant feedback on empty fields and basic content issues.
 *
 * These suggestions are merged with AI suggestions for a complete analysis.
 */

import type { ResumeData } from '@/components/resume/ResumeDocument';
import type {
  Suggestion,
  SuggestionCategory,
  SuggestionSeverity,
  SuggestionType,
} from '@/lib/resume/types';

interface GeneratorConfig {
  minBulletsPerRole?: number;
  minBulletLength?: number;
  minSkillsCount?: number;
  minSummaryLength?: number;
}

const DEFAULT_CONFIG: GeneratorConfig = {
  minBulletsPerRole: 3,
  minBulletLength: 50,
  minSkillsCount: 5,
  minSummaryLength: 100,
};

/**
 * Generate suggestions for missing content locally (no AI call)
 * Returns suggestions for empty fields, incomplete sections, and basic issues
 */
export function generateMissingContentSuggestions(
  resumeData: ResumeData,
  config: GeneratorConfig = DEFAULT_CONFIG,
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // ===== CONTACT INFO CHECKS =====
  suggestions.push(...checkContactInfo(resumeData));

  // ===== SUMMARY CHECKS =====
  suggestions.push(...checkSummary(resumeData, cfg));

  // ===== EXPERIENCE CHECKS =====
  suggestions.push(...checkExperience(resumeData, cfg));

  // ===== EDUCATION CHECKS =====
  suggestions.push(...checkEducation(resumeData));

  // ===== SKILLS CHECKS =====
  suggestions.push(...checkSkills(resumeData, cfg));

  return suggestions;
}

/**
 * Check contact information for missing fields
 */
function checkContactInfo(resumeData: ResumeData): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const contact = resumeData.contactInfo;

  if (!contact?.phone || contact.phone.trim() === '') {
    suggestions.push(
      createSuggestion({
        id: 'missing-contact-field-phone',
        type: 'missing-contact-field',
        severity: 'important',
        category: 'ats',
        targetType: 'header',
        targetId: 'contact',
        targetPath: 'contact-phone',
        title: 'Add phone number',
        explanation:
          'Recruiters need a direct way to contact you for phone screens and interviews. Missing phone numbers can delay the hiring process.',
        beforeText: '',
        afterText: '(555) 123-4567',
        estimatedScoreImpact: 2,
      }),
    );
  }

  if (!contact?.linkedin || contact.linkedin.trim() === '') {
    suggestions.push(
      createSuggestion({
        id: 'missing-contact-field-linkedin',
        type: 'missing-contact-field',
        severity: 'important',
        category: 'ats',
        targetType: 'header',
        targetId: 'contact',
        targetPath: 'contact-linkedin',
        title: 'Add LinkedIn profile',
        explanation:
          '87% of recruiters use LinkedIn to evaluate candidates. A profile link allows them to see endorsements, recommendations, and your full professional network.',
        beforeText: '',
        afterText: 'linkedin.com/in/yourname',
        estimatedScoreImpact: 2,
      }),
    );
  }

  if (!contact?.location || contact.location.trim() === '') {
    suggestions.push(
      createSuggestion({
        id: 'missing-contact-field-location',
        type: 'missing-contact-field',
        severity: 'polish',
        category: 'ats',
        targetType: 'header',
        targetId: 'contact',
        targetPath: 'contact-location',
        title: 'Add location',
        explanation:
          'Location helps employers understand your proximity to the office and timezone. Many ATS systems filter by location.',
        beforeText: '',
        afterText: 'San Francisco, CA',
        estimatedScoreImpact: 1,
      }),
    );
  }

  return suggestions;
}

/**
 * Check summary section
 */
function checkSummary(resumeData: ResumeData, cfg: GeneratorConfig): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const summary = resumeData.summary?.trim();

  if (!summary || summary === '') {
    suggestions.push(
      createSuggestion({
        id: 'missing-summary',
        type: 'missing-summary',
        severity: 'critical',
        category: 'impact',
        targetType: 'section',
        targetId: 'summary',
        targetPath: 'summary-text',
        title: 'Add a professional summary',
        explanation:
          "A compelling summary is your elevator pitch. It immediately communicates your value proposition and helps recruiters understand why you're a fit in the 6 seconds they spend scanning your resume.",
        beforeText: '',
        afterText:
          'Results-driven professional with X+ years of experience in [your field]. Proven track record of [key achievement]. Skilled in [top 3 skills] with expertise in [industry/domain].',
        estimatedScoreImpact: 5,
      }),
    );
  } else if (summary.length < (cfg.minSummaryLength || 100)) {
    suggestions.push(
      createSuggestion({
        id: 'short-content-summary',
        type: 'short-content',
        severity: 'important',
        category: 'impact',
        targetType: 'section',
        targetId: 'summary',
        targetPath: 'summary-text',
        title: 'Expand your summary',
        explanation: `Your summary is only ${summary.length} characters. A strong summary should be 2-3 sentences highlighting your experience level, key skills, and what you bring to the role.`,
        beforeText: summary,
        afterText:
          summary +
          ' [Add 1-2 more sentences about your key achievements and what makes you unique.]',
        estimatedScoreImpact: 3,
      }),
    );
  }

  return suggestions;
}

/**
 * Check experience section
 */
function checkExperience(resumeData: ResumeData, cfg: GeneratorConfig): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const experience = resumeData.experience;

  if (!experience || experience.length === 0) {
    suggestions.push(
      createSuggestion({
        id: 'missing-experience',
        type: 'missing-experience',
        severity: 'critical',
        category: 'impact',
        targetType: 'section',
        targetId: 'experience',
        targetPath: 'experience-section',
        title: 'Add work experience',
        explanation:
          'Work experience is the most important section of your resume. It demonstrates your qualifications and shows employers what you can accomplish.',
        beforeText: '',
        afterText:
          '[Add your most recent position with company name, title, dates, and 3-5 achievement-focused bullet points]',
        estimatedScoreImpact: 10,
      }),
    );
    return suggestions;
  }

  // Check each experience entry
  for (const exp of experience) {
    const expId = exp.id;
    const description = exp.description?.trim() || '';
    const bullets = description
      .split('\n')
      .map((b) => b.replace(/^[•\-]\s*/, '').trim())
      .filter((b) => b.length > 0);

    // Check for empty bullets
    if (bullets.length === 0) {
      suggestions.push(
        createSuggestion({
          id: `empty-bullets-${expId}`,
          type: 'empty-bullets',
          severity: 'critical',
          category: 'impact',
          targetType: 'section',
          targetId: expId,
          // Use container spanId (without index) to highlight the entire bullets section
          targetPath: `experience-${expId}-bullets`,
          title: `Add bullet points for ${exp.title}`,
          explanation: `Your ${exp.title} role at ${exp.company} has no bullet points. Add 3-5 achievement-focused bullets that demonstrate your impact and results.`,
          beforeText: '',
          afterText:
            'Led [project/initiative] resulting in [quantifiable outcome]. Collaborated with [team/stakeholders] to [accomplish goal].',
          estimatedScoreImpact: 5,
        }),
      );
    } else if (bullets.length < (cfg.minBulletsPerRole || 3)) {
      suggestions.push(
        createSuggestion({
          id: `incomplete-entry-${expId}`,
          type: 'incomplete-entry',
          severity: 'important',
          category: 'impact',
          targetType: 'section',
          targetId: expId,
          // Use container spanId (without index) to highlight the entire bullets section
          targetPath: `experience-${expId}-bullets`,
          title: `Add more bullets for ${exp.title}`,
          explanation: `Only ${bullets.length} bullet(s) for your ${exp.title} role. Aim for 3-5 bullets to fully showcase your achievements and responsibilities.`,
          beforeText: '',
          afterText:
            '[Add another achievement with metrics: "Increased X by Y% through Z initiative"]',
          estimatedScoreImpact: 3,
        }),
      );
    }

    // Check for short bullets
    for (let i = 0; i < bullets.length; i++) {
      const bullet = bullets[i];
      if (bullet.length < (cfg.minBulletLength || 50)) {
        suggestions.push(
          createSuggestion({
            id: `short-content-${expId}-${i}`,
            type: 'short-content',
            severity: 'important',
            category: 'impact',
            targetType: 'bullet',
            targetId: expId,
            targetPath: `experience-${expId}-bullets-${i}`,
            title: 'Expand this bullet with details',
            explanation: `This bullet is only ${bullet.length} characters. Add specific metrics, scope, and results to make it more impactful.`,
            beforeText: bullet,
            afterText: bullet + ' [Add: by X%, for Y users, saving $Z, with team of N]',
            estimatedScoreImpact: 2,
          }),
        );
      }
    }

    // Check for missing title
    if (!exp.title || exp.title.trim() === '') {
      suggestions.push(
        createSuggestion({
          id: `incomplete-entry-title-${expId}`,
          type: 'incomplete-entry',
          severity: 'critical',
          category: 'ats',
          targetType: 'header',
          targetId: expId,
          targetPath: `experience-${expId}-title`,
          title: 'Add job title',
          explanation:
            'Job title is missing. This is critical for ATS matching and helps recruiters quickly understand your experience level.',
          beforeText: '',
          afterText: 'Software Engineer',
          estimatedScoreImpact: 4,
        }),
      );
    }

    // Check for missing company
    if (!exp.company || exp.company.trim() === '') {
      suggestions.push(
        createSuggestion({
          id: `incomplete-entry-company-${expId}`,
          type: 'incomplete-entry',
          severity: 'critical',
          category: 'ats',
          targetType: 'header',
          targetId: expId,
          targetPath: `experience-${expId}-company`,
          title: 'Add company name',
          explanation:
            "Company name is missing. Employers want to see where you've worked to assess your experience.",
          beforeText: '',
          afterText: 'Company Name',
          estimatedScoreImpact: 4,
        }),
      );
    }
  }

  return suggestions;
}

/**
 * Check education section
 */
function checkEducation(resumeData: ResumeData): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const education = resumeData.education;

  if (!education || education.length === 0) {
    suggestions.push(
      createSuggestion({
        id: 'missing-education',
        type: 'missing-education',
        severity: 'important',
        category: 'ats',
        targetType: 'section',
        targetId: 'education',
        targetPath: 'education-section',
        title: 'Add education',
        explanation:
          'Many employers and ATS systems filter by education. Include your highest degree, certifications, or relevant coursework.',
        beforeText: '',
        afterText: '[Add your degree, school name, graduation year, and any honors/GPA if notable]',
        estimatedScoreImpact: 3,
      }),
    );
    return suggestions;
  }

  // Check each education entry for completeness
  for (const edu of education) {
    const eduId = edu.id;

    if (!edu.degree || edu.degree.trim() === '') {
      suggestions.push(
        createSuggestion({
          id: `incomplete-entry-degree-${eduId}`,
          type: 'incomplete-entry',
          severity: 'important',
          category: 'ats',
          targetType: 'header',
          targetId: eduId,
          targetPath: `education-${eduId}-degree`,
          title: 'Add degree type',
          explanation:
            "Degree type is missing. Specify Bachelor's, Master's, etc. for ATS matching.",
          beforeText: '',
          afterText: 'Bachelor of Science',
          estimatedScoreImpact: 2,
        }),
      );
    }

    if (!edu.school || edu.school.trim() === '') {
      suggestions.push(
        createSuggestion({
          id: `incomplete-entry-school-${eduId}`,
          type: 'incomplete-entry',
          severity: 'important',
          category: 'ats',
          targetType: 'header',
          targetId: eduId,
          targetPath: `education-${eduId}-school`,
          title: 'Add school name',
          explanation: 'School name is missing. Include the institution name for credibility.',
          beforeText: '',
          afterText: 'University Name',
          estimatedScoreImpact: 2,
        }),
      );
    }
  }

  return suggestions;
}

/**
 * Check skills section
 */
function checkSkills(resumeData: ResumeData, cfg: GeneratorConfig): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const skills = resumeData.skills;

  if (!skills || skills.length === 0) {
    suggestions.push(
      createSuggestion({
        id: 'missing-skills',
        type: 'missing-skills',
        severity: 'critical',
        category: 'ats',
        targetType: 'section',
        targetId: 'skills',
        targetPath: 'skills-list',
        title: 'Add a skills section',
        explanation:
          'Skills sections are critical for ATS matching. Recruiters scan for specific keywords - without skills listed, your resume may be filtered out.',
        beforeText: '',
        afterText:
          '[Add 8-12 relevant skills: programming languages, tools, frameworks, methodologies]',
        estimatedScoreImpact: 5,
      }),
    );
  } else if (skills.length < (cfg.minSkillsCount || 5)) {
    suggestions.push(
      createSuggestion({
        id: 'incomplete-skills',
        type: 'short-content',
        severity: 'important',
        category: 'ats',
        targetType: 'section',
        targetId: 'skills',
        targetPath: 'skills-list',
        title: 'Add more skills',
        explanation: `You only have ${skills.length} skill(s) listed. Aim for 8-12 relevant skills to improve ATS matching and showcase your capabilities.`,
        beforeText: skills.join(', '),
        afterText: skills.join(', ') + ', [Add 5+ more relevant skills]',
        estimatedScoreImpact: 3,
      }),
    );
  }

  return suggestions;
}

/**
 * Helper to create a properly typed suggestion
 */
function createSuggestion(params: {
  id: string;
  type: SuggestionType;
  severity: SuggestionSeverity;
  category: SuggestionCategory;
  targetType: 'bullet' | 'section' | 'resume' | 'header';
  targetId: string;
  targetPath: string;
  title: string;
  explanation: string;
  beforeText: string;
  afterText: string;
  estimatedScoreImpact: number;
}): Suggestion {
  return {
    id: params.id,
    type: params.type,
    severity: params.severity,
    category: params.category,
    targetType: params.targetType,
    targetId: params.targetId,
    targetPath: params.targetPath,
    title: params.title,
    explanation: params.explanation,
    beforeText: params.beforeText,
    afterText: params.afterText,
    estimatedScoreImpact: params.estimatedScoreImpact,
  };
}

/**
 * Apply rule-based checks for content quality issues
 * (Weak verbs, missing metrics, etc. - complements AI analysis)
 */
export function applyRuleBasedChecks(resumeData: ResumeData): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Check for weak verbs at the start of bullets
  const weakVerbs = [
    'helped',
    'assisted',
    'worked',
    'responsible',
    'involved',
    'participated',
    'contributed',
    'supported',
    'aided',
    'handled',
  ];

  const experience = resumeData.experience || [];

  for (const exp of experience) {
    const description = exp.description?.trim() || '';
    const bullets = description
      .split('\n')
      .map((b) => b.replace(/^[•\-]\s*/, '').trim())
      .filter((b) => b.length > 0);

    for (let i = 0; i < bullets.length; i++) {
      const bullet = bullets[i];
      const firstWord = bullet
        .split(/\s+/)[0]
        ?.toLowerCase()
        .replace(/[^a-z]/g, '');

      // Check for weak starting verbs
      if (weakVerbs.some((wv) => firstWord === wv || firstWord?.startsWith(wv))) {
        suggestions.push(
          createSuggestion({
            id: `weak-verb-${exp.id}-${i}`,
            type: 'weak-verb',
            severity: 'critical',
            category: 'impact',
            targetType: 'bullet',
            targetId: exp.id,
            targetPath: `experience-${exp.id}-bullets-${i}`,
            title: 'Replace weak starting verb',
            explanation: `"${firstWord}" is a weak verb that diminishes impact. Start with a powerful action verb like Led, Drove, Delivered, Spearheaded, or Architected.`,
            beforeText: bullet,
            afterText: bullet.replace(/^\w+/, 'Led'), // Simple replacement - AI will do better
            estimatedScoreImpact: 3,
          }),
        );
      }

      // Check for bullets without any numbers (likely missing metrics)
      const hasNumber = /\d+/.test(bullet);
      if (!hasNumber && bullet.length > 30) {
        // Only suggest if bullet is long enough to meaningfully have metrics
        suggestions.push(
          createSuggestion({
            id: `missing-metrics-${exp.id}-${i}`,
            type: 'missing-metrics',
            severity: 'critical',
            category: 'impact',
            targetType: 'bullet',
            targetId: exp.id,
            targetPath: `experience-${exp.id}-bullets-${i}`,
            title: 'Add quantifiable metrics',
            explanation:
              'This bullet has no numbers. Quantify your impact: How many? How much? What percentage increase/decrease? Metrics make achievements concrete and believable.',
            beforeText: bullet,
            afterText: bullet + ' [Add: X%, $Y, Z users, N team members]',
            estimatedScoreImpact: 4,
          }),
        );
      }
    }
  }

  return suggestions;
}

/**
 * Valid targetPath patterns for suggestions
 * Suggestions without valid targetPaths cannot be highlighted on the canvas
 */
const VALID_TARGET_PATH_PATTERNS = [
  /^summary-text$/,
  /^contact-(name|email|phone|location|linkedin|website|github)$/,
  /^experience-[\w-]+-bullets(-\d+)?$/,
  /^experience-[\w-]+-(title|company|location|dates)$/,
  /^education-[\w-]+-(school|degree|field|year|gpa)$/,
  /^projects-[\w-]+-(name|description)$/,
  /^skills-list(-\d+)?$/,
  /^certifications-[\w-]+-(name|issuer|date)$/,
  /^achievements-[\w-]+-(title|description)$/,
];

/**
 * Check if a suggestion has a valid targetPath that can be highlighted
 */
function hasValidTargetPath(suggestion: Suggestion): boolean {
  if (!suggestion.targetPath || suggestion.targetPath.trim() === '') {
    return false;
  }

  // Check against valid patterns
  return VALID_TARGET_PATH_PATTERNS.some((pattern) => pattern.test(suggestion.targetPath));
}

/**
 * Prioritize and deduplicate suggestions
 * Ensures critical/missing content suggestions appear first
 * Filters out suggestions without valid targetPaths
 */
export function prioritizeAndDedupe(suggestions: Suggestion[]): Suggestion[] {
  // First, filter out suggestions without valid targetPaths
  const validSuggestions = suggestions.filter((s) => {
    const isValid = hasValidTargetPath(s);
    if (!isValid && process.env.NODE_ENV !== 'production') {
      console.warn(
        `Filtering out suggestion with invalid targetPath: "${s.targetPath}" - "${s.title}"`,
      );
    }
    return isValid;
  });

  // Remove duplicates by targetPath + type
  const seen = new Set<string>();
  const unique = validSuggestions.filter((s) => {
    const key = `${s.targetPath}-${s.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Define severity order (lower = higher priority)
  const severityOrder: Record<SuggestionSeverity, number> = {
    critical: 0,
    important: 1,
    polish: 2,
  };

  // Define type priority for missing content (show these first)
  const missingTypes = new Set<SuggestionType>([
    'missing-summary',
    'missing-experience',
    'missing-skills',
    'missing-education',
    'empty-bullets',
    'missing-contact-field',
    'incomplete-entry',
  ]);

  // Sort by: missing content first, then severity, then score impact
  return unique.sort((a, b) => {
    // Missing content types first
    const aIsMissing = missingTypes.has(a.type) ? 0 : 1;
    const bIsMissing = missingTypes.has(b.type) ? 0 : 1;
    if (aIsMissing !== bIsMissing) return aIsMissing - bIsMissing;

    // Then by severity
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;

    // Then by estimated score impact (higher first)
    return b.estimatedScoreImpact - a.estimatedScoreImpact;
  });
}
