import { auth } from '@clerk/nextjs/server';
import { fetchQuery } from 'convex/nextjs';
import { NextResponse } from 'next/server';

import { api } from '../../../../../convex/_generated/api';

interface SuggestedRoleRequest {
  roles: Array<{
    id: string;
    title: string;
    category: string;
    fit_score: number;
    relationship?: string;
  }>;
  column: 'entry_level' | 'lateral' | 'promotion' | 'internship';
  currentPathTitles?: string[]; // Titles already in the path
}

interface SuggestedRoleResponse {
  suggestedRoleId: string | null;
  reason: string;
  confidenceScore: number; // 0-100
}

/**
 * Career Level Hierarchy (lower number = more junior)
 * This represents realistic career progression in most industries
 */
const CAREER_LEVELS: { keywords: string[]; level: number; name: string }[] = [
  { keywords: ['intern', 'internship'], level: 0, name: 'Intern' },
  {
    keywords: ['junior', 'associate', 'entry', 'assistant', 'trainee', 'apprentice'],
    level: 1,
    name: 'Entry Level',
  },
  {
    keywords: ['specialist', 'analyst', 'coordinator', 'representative'],
    level: 2,
    name: 'Individual Contributor',
  },
  { keywords: ['senior', 'sr.', 'sr '], level: 3, name: 'Senior' },
  { keywords: ['lead', 'team lead', 'tech lead', 'principal'], level: 4, name: 'Lead' },
  { keywords: ['manager', 'mgr'], level: 5, name: 'Manager' },
  { keywords: ['senior manager', 'sr. manager', 'sr manager'], level: 6, name: 'Senior Manager' },
  { keywords: ['director', 'head of', 'head '], level: 7, name: 'Director' },
  {
    keywords: ['senior director', 'sr. director', 'sr director'],
    level: 8,
    name: 'Senior Director',
  },
  { keywords: ['vp', 'vice president', 'v.p.'], level: 9, name: 'VP' },
  { keywords: ['svp', 'senior vice president', 'senior vp'], level: 10, name: 'SVP' },
  { keywords: ['evp', 'executive vice president'], level: 11, name: 'EVP' },
  { keywords: ['ceo', 'cto', 'cfo', 'cmo', 'coo', 'cio', 'chief'], level: 12, name: 'C-Suite' },
];

/**
 * Detect the career level of a role title
 * Returns level 2 (IC) as default if no specific level markers found
 */
function detectCareerLevel(title: string): { level: number; name: string } {
  const titleLower = title.toLowerCase();

  // Check from highest to lowest level (more specific matches first)
  // This ensures "Senior Director" is matched before "Director"
  for (let i = CAREER_LEVELS.length - 1; i >= 0; i--) {
    const levelInfo = CAREER_LEVELS[i];
    for (const keyword of levelInfo.keywords) {
      if (titleLower.includes(keyword)) {
        return { level: levelInfo.level, name: levelInfo.name };
      }
    }
  }

  // Default to IC level (2) for unrecognized roles
  return { level: 2, name: 'Individual Contributor' };
}

/**
 * Calculate the appropriate next level for career progression
 * Realistic progression is typically +1 level at a time
 */
function getIdealNextLevel(currentLevel: number, column: string): number {
  switch (column) {
    case 'internship':
      return 0; // Looking for internships
    case 'entry_level':
      // From intern/major → entry level (1-2)
      // From entry level → senior (3)
      return currentLevel <= 1 ? 2 : currentLevel + 1;
    case 'lateral':
      // Same level, different function
      return currentLevel;
    case 'promotion':
      // One level up is realistic
      return Math.min(currentLevel + 1, 12);
    default:
      return currentLevel + 1;
  }
}

/**
 * Check if a progression from one level to another is realistic
 * Returns a score modifier (-50 to +20)
 */
function getProgressionRealism(
  fromLevel: number,
  toLevel: number,
  column: string,
): { modifier: number; reason: string; isRealistic: boolean } {
  const levelDiff = toLevel - fromLevel;

  if (column === 'lateral') {
    // Lateral moves should be same level
    if (levelDiff === 0) {
      return { modifier: 20, reason: 'Appropriate lateral move', isRealistic: true };
    } else if (Math.abs(levelDiff) === 1) {
      return { modifier: 5, reason: 'Near-lateral move', isRealistic: true };
    } else {
      return { modifier: -30, reason: 'Not a lateral move', isRealistic: false };
    }
  }

  if (column === 'promotion') {
    // Ideal promotion is +1 level, but +2-3 is still realistic in many careers
    // (e.g., Specialist→Manager is often a direct path)
    if (levelDiff === 1) {
      return { modifier: 25, reason: 'Natural next step', isRealistic: true };
    } else if (levelDiff === 2) {
      return { modifier: 15, reason: 'Strong promotion path', isRealistic: true };
    } else if (levelDiff === 3) {
      return { modifier: 5, reason: 'Ambitious but achievable', isRealistic: true };
    } else if (levelDiff === 0) {
      return { modifier: -10, reason: 'Not a promotion', isRealistic: false };
    } else if (levelDiff < 0) {
      return { modifier: -40, reason: 'Demotion, not promotion', isRealistic: false };
    } else if (levelDiff >= 4) {
      return {
        modifier: -50,
        reason: 'Unrealistic jump - skips too many levels',
        isRealistic: false,
      };
    }
  }

  if (column === 'entry_level') {
    // Entry level should be level 1-3
    if (toLevel >= 1 && toLevel <= 3) {
      return { modifier: 15, reason: 'Appropriate entry-level role', isRealistic: true };
    } else if (toLevel === 0) {
      return { modifier: 0, reason: 'Internship level', isRealistic: true };
    } else {
      return { modifier: -40, reason: 'Too senior for entry-level', isRealistic: false };
    }
  }

  if (column === 'internship') {
    if (toLevel === 0) {
      return { modifier: 20, reason: 'Appropriate internship', isRealistic: true };
    } else {
      return { modifier: -50, reason: 'Not an internship', isRealistic: false };
    }
  }

  return { modifier: 0, reason: '', isRealistic: true };
}

/**
 * Extract the functional area from a role title (e.g., "Marketing" from "Digital Marketing Manager")
 */
function extractFunctionalArea(title: string): string[] {
  const titleLower = title.toLowerCase();
  const areas: string[] = [];

  const functionalKeywords: Record<string, string[]> = {
    marketing: [
      'marketing',
      'brand',
      'content',
      'seo',
      'growth',
      'demand gen',
      'digital marketing',
    ],
    engineering: [
      'engineer',
      'developer',
      'programmer',
      'software',
      'devops',
      'sre',
      'backend',
      'frontend',
      'fullstack',
    ],
    design: ['design', 'ux', 'ui', 'product design', 'graphic', 'creative'],
    product: ['product', 'pm'],
    sales: ['sales', 'account executive', 'business development', 'bdr', 'sdr'],
    finance: ['finance', 'accounting', 'financial', 'controller', 'treasury'],
    hr: ['hr', 'human resources', 'people', 'talent', 'recruiting', 'recruiter'],
    operations: ['operations', 'ops', 'supply chain', 'logistics'],
    data: ['data', 'analytics', 'analyst', 'business intelligence', 'bi'],
    legal: ['legal', 'counsel', 'attorney', 'compliance'],
    customer: ['customer success', 'customer support', 'support', 'client'],
  };

  for (const [area, keywords] of Object.entries(functionalKeywords)) {
    if (keywords.some((kw) => titleLower.includes(kw))) {
      areas.push(area);
    }
  }

  return areas.length > 0 ? areas : ['general'];
}

/**
 * Calculate the most aligned role suggestion based on:
 * 1. REALISTIC CAREER PROGRESSION (most important)
 * 2. User data (quiz results, profile, skills)
 * 3. Current career path context
 */
export async function POST(request: Request) {
  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get Convex auth token for authenticated queries
    const token = await getToken({ template: 'convex' });
    if (!token) {
      return NextResponse.json({ error: 'Failed to obtain auth token' }, { status: 401 });
    }

    let body: SuggestedRoleRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const { roles, column, currentPathTitles = [] } = body;

    if (!roles || roles.length === 0) {
      return NextResponse.json({
        suggestedRoleId: null,
        reason: 'No roles to evaluate',
        confidenceScore: 0,
      } as SuggestedRoleResponse);
    }

    // Determine the current role level from the path
    const lastPathTitle = currentPathTitles[currentPathTitles.length - 1];
    const currentLevel = lastPathTitle
      ? detectCareerLevel(lastPathTitle)
      : { level: 1, name: 'Entry Level' }; // Default for new paths

    const currentFunctionalAreas = lastPathTitle ? extractFunctionalArea(lastPathTitle) : [];

    // Fetch user data from Convex (with auth token for user context)
    const galaxyData = await fetchQuery(api.career_explorer.getCareerGalaxyData, {}, { token });
    const { profile, quizResult } = galaxyData || {};

    // Calculate alignment scores for each role
    const scoredRoles = roles.map((role) => {
      const roleLevel = detectCareerLevel(role.title);
      const roleFunctionalAreas = extractFunctionalArea(role.title);

      // Start with base fit score
      let alignmentScore = role.fit_score;
      const reasons: string[] = [];
      let isRealistic = true;

      // 1. CAREER PROGRESSION REALISM (highest weight - can heavily penalize unrealistic paths)
      const progression = getProgressionRealism(currentLevel.level, roleLevel.level, column);
      alignmentScore += progression.modifier;
      isRealistic = progression.isRealistic;

      if (progression.reason && progression.modifier !== 0) {
        reasons.push(progression.reason);
      }

      // 2. Functional area continuity (bonus for staying in same field)
      if (currentFunctionalAreas.length > 0) {
        const areaOverlap = currentFunctionalAreas.some((area) =>
          roleFunctionalAreas.includes(area),
        );
        if (areaOverlap) {
          alignmentScore += 15;
          reasons.push('Continues in your field');
        } else if (column === 'lateral') {
          // For lateral moves, different function is expected and okay
          alignmentScore += 10;
          reasons.push('New functional area');
        }
      }

      // 3. Dream job alignment
      if (profile?.dream_job) {
        const dreamJobLower = profile.dream_job.toLowerCase();
        const roleTitleLower = role.title.toLowerCase();
        const dreamFunctionalAreas = extractFunctionalArea(profile.dream_job);

        // Check if this role is in the same functional area as dream job
        const dreamAreaMatch = dreamFunctionalAreas.some((area) =>
          roleFunctionalAreas.includes(area),
        );

        if (dreamAreaMatch) {
          alignmentScore += 12;
          reasons.push('Aligned with your dream job path');
        }

        // Check for title keyword match
        const dreamJobWords = dreamJobLower.split(/\s+/).filter((w) => w.length > 3);
        const matchingWords = dreamJobWords.filter(
          (word) =>
            roleTitleLower.includes(word) &&
            !['senior', 'junior', 'lead', 'manager', 'director'].includes(word),
        );
        if (matchingWords.length > 0) {
          alignmentScore += 8;
        }
      }

      // 4. Skills match
      if (profile?.skills) {
        const userSkills = profile.skills
          .toLowerCase()
          .split(',')
          .map((s) => s.trim());
        const roleCategory = role.category.toLowerCase();

        const categoryToSkills: Record<string, string[]> = {
          marketing: ['marketing', 'seo', 'social media', 'content', 'analytics', 'google ads'],
          technology: ['javascript', 'python', 'react', 'node', 'sql', 'aws', 'programming'],
          design: ['figma', 'design', 'ui', 'ux', 'photoshop', 'illustrator'],
          finance: ['excel', 'financial modeling', 'accounting', 'analysis'],
          data: ['sql', 'python', 'analytics', 'statistics', 'tableau'],
        };

        const relevantSkills = categoryToSkills[roleCategory] || [];
        const matchCount = userSkills.filter((skill) =>
          relevantSkills.some((rs) => skill.includes(rs) || rs.includes(skill)),
        ).length;

        if (matchCount >= 3) {
          alignmentScore += 10;
          reasons.push('Strong skills match');
        } else if (matchCount >= 1) {
          alignmentScore += 5;
        }
      }

      // 5. Quiz theme alignment
      if (quizResult?.themes && quizResult.themes.length > 0) {
        const topThemes = quizResult.themes
          .sort((a, b) => b.weight - a.weight)
          .slice(0, 3)
          .map((t) => t.name.toLowerCase());

        const roleTitleLower = role.title.toLowerCase();
        const themeMatches: Record<string, string[]> = {
          innovation: ['technology', 'engineering', 'product', 'research'],
          leadership: ['manager', 'director', 'head', 'lead'],
          creativity: ['design', 'creative', 'marketing', 'content'],
          analysis: ['data', 'analyst', 'research', 'finance'],
        };

        for (const theme of topThemes) {
          const matchingCategories = themeMatches[theme] || [];
          if (matchingCategories.some((cat) => roleTitleLower.includes(cat))) {
            alignmentScore += 8;
            break;
          }
        }
      }

      // 6. Penalize duplicates in path
      if (currentPathTitles.length > 0) {
        const roleTitleLower = role.title.toLowerCase();
        const isDuplicate = currentPathTitles.some((pathTitle) => {
          const pathTitleLower = pathTitle.toLowerCase();
          return (
            pathTitleLower === roleTitleLower ||
            pathTitleLower.includes(roleTitleLower) ||
            roleTitleLower.includes(pathTitleLower)
          );
        });

        if (isDuplicate) {
          alignmentScore -= 30;
          isRealistic = false;
        }
      }

      // Calculate confidence based on realism and data points
      let confidence = isRealistic ? 70 : 30;
      if (reasons.length > 0) {
        confidence += reasons.length * 5;
      }
      confidence = Math.min(95, Math.max(20, confidence));

      return {
        ...role,
        alignmentScore: Math.max(0, Math.min(100, alignmentScore)),
        reasons,
        isRealistic,
        confidence,
        levelInfo: roleLevel,
      };
    });

    // Filter to only realistic roles first, then sort by score
    const realisticRoles = scoredRoles.filter((r) => r.isRealistic);
    const sortedRoles =
      realisticRoles.length > 0
        ? realisticRoles.sort((a, b) => b.alignmentScore - a.alignmentScore)
        : scoredRoles.sort((a, b) => b.alignmentScore - a.alignmentScore);

    const bestRole = sortedRoles[0];

    if (!bestRole || !bestRole.isRealistic) {
      // No realistic suggestion found
      return NextResponse.json({
        suggestedRoleId: null,
        reason: 'No suitable progression found',
        confidenceScore: 0,
      } as SuggestedRoleResponse);
    }

    // Check if the best role is significantly better than others
    const secondBest = sortedRoles[1];
    let finalConfidence = bestRole.confidence;
    if (secondBest && bestRole.alignmentScore - secondBest.alignmentScore < 5) {
      finalConfidence = Math.max(40, finalConfidence - 15);
    }

    // Build reason string
    const reason =
      bestRole.reasons.length > 0
        ? bestRole.reasons[0]
        : `Natural progression to ${bestRole.levelInfo.name}`;

    return NextResponse.json({
      suggestedRoleId: bestRole.id,
      reason,
      confidenceScore: Math.round(finalConfidence),
    } as SuggestedRoleResponse);
  } catch (error) {
    console.error('Suggested role calculation error:', error);
    return NextResponse.json({ error: 'Failed to calculate suggested role' }, { status: 500 });
  }
}
