/**
 * Career Path Validator for Career Explorer
 *
 * Validates career paths for realism, including:
 * - Level progression (no unrealistic jumps)
 * - Credential requirements
 * - Industry-specific rules
 * - Suggested intermediate steps for large gaps
 */

import {
  detectIndustryFromRole,
  getCareerLevel,
  getMaxReasonableLevelJump,
  getRequiredCredential,
  INDUSTRIES,
  Industry,
  requiresCredential,
} from './industryTaxonomy';
import { PlacedStep } from './types';

// Validation error types
export type ValidationErrorType =
  | 'unrealistic_jump'
  | 'missing_credential'
  | 'backward_progression'
  | 'duplicate_role'
  | 'industry_mismatch';

// Validation error
export interface ValidationError {
  type: ValidationErrorType;
  message: string;
  fromIndex?: number;
  toIndex?: number;
  index?: number;
  suggestion?: string | string[];
  severity: 'error' | 'warning';
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  suggestions: string[];
}

/**
 * Validate an entire career path for realism
 */
export function validateCareerPath(steps: PlacedStep[], industry?: Industry): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const suggestions: string[] = [];

  if (steps.length === 0) {
    return { valid: true, errors: [], warnings: [], suggestions: [] };
  }

  // Detect industry from first role if not provided
  const detectedIndustry = industry || detectIndustryFromRole(steps[0].title);
  const industryConfig = INDUSTRIES[detectedIndustry];
  const maxJump = getMaxReasonableLevelJump(detectedIndustry);

  // Track seen titles for duplicate detection
  const seenTitles = new Set<string>();

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const titleLower = step.title.toLowerCase();

    // Check for duplicates
    if (seenTitles.has(titleLower)) {
      warnings.push({
        type: 'duplicate_role',
        message: `Duplicate role: "${step.title}" appears multiple times`,
        index: i,
        severity: 'warning',
      });
    }
    seenTitles.add(titleLower);

    // Check credential requirements
    if (requiresCredential(step.title, detectedIndustry)) {
      const credential = getRequiredCredential(step.title, detectedIndustry);
      warnings.push({
        type: 'missing_credential',
        message: `"${step.title}" typically requires ${credential || 'a professional credential'}`,
        index: i,
        suggestion: `Consider adding a step to obtain ${credential || 'required credentials'}`,
        severity: 'warning',
      });
    }

    // Validate progression from previous step
    if (i > 0) {
      const prevStep = steps[i - 1];
      const prevLevel = getCareerLevel(prevStep.title, detectedIndustry);
      const currLevel = getCareerLevel(step.title, detectedIndustry);

      if (prevLevel && currLevel) {
        const levelDiff = currLevel.level - prevLevel.level;

        // Check for backward progression (more than 1 level down)
        if (levelDiff < -1) {
          errors.push({
            type: 'backward_progression',
            message: `Going from "${prevStep.title}" (${prevLevel.name}) to "${step.title}" (${currLevel.name}) is a significant step backward`,
            fromIndex: i - 1,
            toIndex: i,
            severity: 'error',
          });
        }

        // Check for unrealistic jumps
        if (levelDiff > maxJump) {
          const intermediateRoles = getIntermediateRoles(
            prevStep.title,
            step.title,
            detectedIndustry,
          );

          errors.push({
            type: 'unrealistic_jump',
            message: `Jumping from "${prevStep.title}" (${prevLevel.name}) to "${step.title}" (${currLevel.name}) skips ${levelDiff - 1} level(s)`,
            fromIndex: i - 1,
            toIndex: i,
            suggestion:
              intermediateRoles.length > 0
                ? intermediateRoles
                : `Consider adding intermediate roles between ${prevLevel.name} and ${currLevel.name}`,
            severity: 'error',
          });
        }
      }
    }

    // Check for industry mismatch (if clearly different industry)
    const stepIndustry = detectIndustryFromRole(step.title);
    if (stepIndustry !== detectedIndustry && i > 0) {
      // Only warn if it's a significant industry change
      const significantChange = !areRelatedIndustries(detectedIndustry, stepIndustry);
      if (significantChange) {
        warnings.push({
          type: 'industry_mismatch',
          message: `"${step.title}" appears to be in ${INDUSTRIES[stepIndustry]?.name || stepIndustry} rather than ${industryConfig.name}`,
          index: i,
          suggestion:
            'Cross-industry transitions are possible but may require additional skills or credentials',
          severity: 'warning',
        });
      }
    }
  }

  // Generate overall suggestions
  if (errors.length > 0) {
    suggestions.push('Consider breaking large career jumps into smaller, achievable steps');
  }

  if (warnings.some((w) => w.type === 'missing_credential')) {
    suggestions.push('Add certification or credential acquisition steps where required');
  }

  // Check for missing entry path
  if (steps.length > 0) {
    const firstLevel = getCareerLevel(steps[0].title, detectedIndustry);
    if (firstLevel && firstLevel.level > 2) {
      suggestions.push(
        `Your path starts at ${firstLevel.name} level. Consider adding entry-level steps for a more complete picture.`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  };
}

/**
 * Validate a single transition between two roles
 */
export function validateTransition(
  fromRole: string,
  toRole: string,
  industry?: Industry,
): {
  isRealistic: boolean;
  levelDiff: number;
  message: string;
  suggestion?: string;
} {
  const detectedIndustry = industry || detectIndustryFromRole(fromRole);
  const maxJump = getMaxReasonableLevelJump(detectedIndustry);

  const fromLevel = getCareerLevel(fromRole, detectedIndustry);
  const toLevel = getCareerLevel(toRole, detectedIndustry);

  if (!fromLevel || !toLevel) {
    return {
      isRealistic: true, // Can't determine, assume OK
      levelDiff: 0,
      message: 'Unable to determine career levels for these roles',
    };
  }

  const levelDiff = toLevel.level - fromLevel.level;

  // Backward progression
  if (levelDiff < -1) {
    return {
      isRealistic: false,
      levelDiff,
      message: `Going from ${fromLevel.name} to ${toLevel.name} is a significant step backward`,
      suggestion: 'Consider a lateral move instead of a demotion',
    };
  }

  // Lateral move or small backward move
  if (levelDiff >= -1 && levelDiff <= 0) {
    return {
      isRealistic: true,
      levelDiff,
      message:
        levelDiff === 0 ? 'Lateral move at the same level' : 'Slight step back (could be a pivot)',
    };
  }

  // Normal promotion (1-2 levels)
  if (levelDiff <= maxJump) {
    return {
      isRealistic: true,
      levelDiff,
      message: levelDiff === 1 ? 'Natural next step' : 'Ambitious but achievable promotion',
    };
  }

  // Unrealistic jump (3+ levels)
  const intermediates = getIntermediateRoles(fromRole, toRole, detectedIndustry);
  return {
    isRealistic: false,
    levelDiff,
    message: `Skipping ${levelDiff - 1} career level(s) is unrealistic`,
    suggestion:
      intermediates.length > 0
        ? `Consider intermediate roles: ${intermediates.join(', ')}`
        : `Add ${levelDiff - 1} intermediate step(s) between ${fromLevel.name} and ${toLevel.name}`,
  };
}

/**
 * Get suggested intermediate roles between two positions
 */
export function getIntermediateRoles(
  fromRole: string,
  toRole: string,
  industry: Industry,
): string[] {
  const fromLevel = getCareerLevel(fromRole, industry);
  const toLevel = getCareerLevel(toRole, industry);

  if (!fromLevel || !toLevel) {
    return [];
  }

  const industryConfig = INDUSTRIES[industry];
  const levelDiff = toLevel.level - fromLevel.level;

  if (levelDiff <= 2) {
    return []; // No intermediates needed
  }

  // Find intermediate levels from the industry's career levels
  const intermediates: string[] = [];

  for (let level = fromLevel.level + 1; level < toLevel.level; level++) {
    const levelConfig = industryConfig.careerLevels.find((l) => l.level === level);
    if (levelConfig) {
      // Generate a plausible role title
      const roleBase = extractRoleBase(fromRole);
      intermediates.push(`${levelConfig.name} ${roleBase}`);
    }
  }

  // Also check typical progression for more specific suggestions
  const progressionIdx = industryConfig.typicalProgression.findIndex(
    (p) =>
      fromRole.toLowerCase().includes(p.toLowerCase()) ||
      p.toLowerCase().includes(extractRoleBase(fromRole).toLowerCase()),
  );

  if (progressionIdx >= 0) {
    const targetIdx = industryConfig.typicalProgression.findIndex(
      (p) =>
        toRole.toLowerCase().includes(p.toLowerCase()) ||
        p.toLowerCase().includes(extractRoleBase(toRole).toLowerCase()),
    );

    if (targetIdx > progressionIdx) {
      const specificIntermediates = industryConfig.typicalProgression.slice(
        progressionIdx + 1,
        targetIdx,
      );
      if (specificIntermediates.length > 0) {
        return specificIntermediates;
      }
    }
  }

  return intermediates;
}

/**
 * Calculate a realism score for a career path (0-100)
 */
export function calculatePathRealismScore(
  steps: PlacedStep[],
  industry?: Industry,
): {
  score: number;
  breakdown: {
    progressionScore: number;
    credentialScore: number;
    consistencyScore: number;
  };
} {
  if (steps.length === 0) {
    return {
      score: 100,
      breakdown: { progressionScore: 100, credentialScore: 100, consistencyScore: 100 },
    };
  }

  const detectedIndustry = industry || detectIndustryFromRole(steps[0].title);
  const maxJump = getMaxReasonableLevelJump(detectedIndustry);

  let progressionScore = 100;
  let credentialScore = 100;
  let consistencyScore = 100;

  // Calculate progression score
  let problematicTransitions = 0;

  for (let i = 1; i < steps.length; i++) {
    const prevLevel = getCareerLevel(steps[i - 1].title, detectedIndustry);
    const currLevel = getCareerLevel(steps[i].title, detectedIndustry);

    if (prevLevel && currLevel) {
      const levelDiff = currLevel.level - prevLevel.level;

      // Penalize for backward progression
      if (levelDiff < -1) {
        problematicTransitions++;
        progressionScore -= 15;
      }
      // Penalize for unrealistic jumps
      else if (levelDiff > maxJump) {
        problematicTransitions++;
        progressionScore -= 10 * (levelDiff - maxJump);
      }
    }
  }

  // Calculate credential score
  let credentialIssues = 0;
  for (const step of steps) {
    if (requiresCredential(step.title, detectedIndustry)) {
      credentialIssues++;
      credentialScore -= 5; // Small penalty for missing credential step
    }
  }

  // Calculate consistency score (industry alignment)
  let industryMismatches = 0;
  for (let i = 1; i < steps.length; i++) {
    const stepIndustry = detectIndustryFromRole(steps[i].title);
    if (!areRelatedIndustries(detectedIndustry, stepIndustry)) {
      industryMismatches++;
      consistencyScore -= 10;
    }
  }

  // Ensure scores don't go below 0
  progressionScore = Math.max(0, progressionScore);
  credentialScore = Math.max(0, credentialScore);
  consistencyScore = Math.max(0, consistencyScore);

  // Calculate overall score (weighted average)
  const overallScore = Math.round(
    progressionScore * 0.5 + credentialScore * 0.2 + consistencyScore * 0.3,
  );

  return {
    score: Math.max(0, Math.min(100, overallScore)),
    breakdown: {
      progressionScore: Math.round(progressionScore),
      credentialScore: Math.round(credentialScore),
      consistencyScore: Math.round(consistencyScore),
    },
  };
}

/**
 * Check if two industries are related (cross-over is reasonable)
 */
function areRelatedIndustries(industry1: Industry, industry2: Industry): boolean {
  const relatedGroups: Industry[][] = [
    ['technology', 'consulting', 'finance'],
    ['healthcare', 'science_research'],
    ['academia', 'science_research', 'education'],
    ['legal', 'consulting', 'government'],
    ['manufacturing', 'trades'],
    ['creative', 'media', 'technology'],
    ['retail', 'hospitality'],
    ['nonprofit', 'government', 'education'],
  ];

  for (const group of relatedGroups) {
    if (group.includes(industry1) && group.includes(industry2)) {
      return true;
    }
  }

  return industry1 === industry2;
}

/**
 * Extract the base role from a title (remove level indicators)
 */
function extractRoleBase(title: string): string {
  return title
    .toLowerCase()
    .replace(
      /\b(senior|junior|lead|principal|staff|associate|assistant|chief|head of|director of|vp of|sr\.|jr\.|i |ii |iii |1 |2 |3 )\b/gi,
      '',
    )
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Suggest improvements for a career path
 */
export function suggestPathImprovements(steps: PlacedStep[], industry?: Industry): string[] {
  const validation = validateCareerPath(steps, industry);
  const suggestions: string[] = [...validation.suggestions];

  if (steps.length === 0) {
    suggestions.push('Add a starting role to begin building your career path');
    return suggestions;
  }

  const detectedIndustry = industry || detectIndustryFromRole(steps[0].title);
  const industryConfig = INDUSTRIES[detectedIndustry];

  // Check path length
  if (steps.length < 3) {
    suggestions.push(
      `Consider adding more steps to show a complete career progression in ${industryConfig.name}`,
    );
  }

  // Check if path ends at a reasonable senior level
  const lastLevel = getCareerLevel(steps[steps.length - 1].title, detectedIndustry);
  if (lastLevel && lastLevel.level < 4) {
    suggestions.push('Consider adding longer-term career goals to show where you want to go');
  }

  // Industry-specific suggestions
  if (detectedIndustry === 'healthcare' && !industryConfig.hasInternships) {
    const hasClinical = steps.some(
      (s) =>
        s.title.toLowerCase().includes('clinical') || s.title.toLowerCase().includes('rotation'),
    );
    if (!hasClinical && steps.length > 0) {
      suggestions.push(
        'Healthcare careers typically start with clinical rotations rather than traditional internships',
      );
    }
  }

  if (detectedIndustry === 'trades') {
    const hasApprenticeship = steps.some((s) => s.title.toLowerCase().includes('apprentice'));
    if (!hasApprenticeship && steps.length > 0) {
      suggestions.push('Trades careers typically require an apprenticeship as the entry path');
    }
  }

  if (detectedIndustry === 'academia') {
    const hasPhD = steps.some(
      (s) => s.title.toLowerCase().includes('phd') || s.title.toLowerCase().includes('doctoral'),
    );
    const hasProfessor = steps.some((s) => s.title.toLowerCase().includes('professor'));
    if (hasProfessor && !hasPhD) {
      suggestions.push('Professor positions typically require a PhD');
    }
  }

  return suggestions;
}
