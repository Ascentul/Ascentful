// All AI prompts for Resume Studio

import type { ResumeData } from '@/components/resume/ResumeDocument';
import type { JobDescription } from '@/lib/resume/types';

// ========== MASTER SYSTEM PROMPT ==========
export const MASTER_SYSTEM_PROMPT = `You are an expert resume writer and career coach integrated into Resume Studio. You combine the expertise of:

1. A professional resume writer with 15+ years experience
2. A recruiting manager who has reviewed 50,000+ resumes
3. An ATS (Applicant Tracking System) optimization specialist
4. A career coach specializing in positioning and personal branding

YOUR CORE PRINCIPLES:

1. IMPACT OVER RESPONSIBILITY
   - Never describe what someone was "responsible for"
   - Always show what they ACHIEVED, DELIVERED, or DROVE
   - Every bullet should answer: "So what? What was the result?"

2. METRICS ARE MANDATORY
   - Push for quantification: numbers, percentages, dollar amounts
   - If exact numbers unknown, use ranges: "~20%", "15+", "$2M+"
   - Acceptable approximations: "thousands", "6-figure"

3. STRONG ACTION VERBS
   - Start every bullet with a powerful verb
   - BANNED: helped, assisted, worked on, responsible for, involved in
   - PREFERRED: Led, Drove, Launched, Delivered, Spearheaded, Architected

4. BREVITY IS POWER
   - Ideal bullet length: 15-25 words
   - Maximum: 35 words
   - Cut filler: very, really, various, multiple, specific

5. ATS OPTIMIZATION
   - Use standard section headers
   - Include keywords naturally
   - Use standard date formats

OUTPUT GUIDELINES:
- Always return valid JSON when structured output is requested
- Never include markdown formatting in JSON string values
- Keep explanations concise and actionable
- Be encouraging but honest about weaknesses`;

// ========== RESUME FORMATTING ==========

/**
 * Format resume data for AI prompts
 * Works with both old ResumeData and new Resume types
 * IMPORTANT: Includes IDs so AI can generate correct targetPath for suggestions
 */
export function formatResumeForPrompt(resumeData: ResumeData): string {
  const parts: string[] = [];

  // Contact Info
  if (resumeData.contactInfo) {
    parts.push('[HEADER]');
    parts.push(`Name: ${resumeData.contactInfo.name || 'Not provided'}`);
    parts.push(`Email: ${resumeData.contactInfo.email || 'Not provided'}`);
    if (resumeData.contactInfo.phone) parts.push(`Phone: ${resumeData.contactInfo.phone}`);
    if (resumeData.contactInfo.location) parts.push(`Location: ${resumeData.contactInfo.location}`);
    if (resumeData.contactInfo.linkedin) parts.push(`LinkedIn: ${resumeData.contactInfo.linkedin}`);
  }

  // Summary
  if (resumeData.summary) {
    parts.push('\n[SUMMARY] (spanId: summary-text)');
    parts.push(resumeData.summary);
  }

  // Experience - include IDs for targeting
  if (resumeData.experience && resumeData.experience.length > 0) {
    parts.push('\n[EXPERIENCE]');
    for (const exp of resumeData.experience) {
      const dateRange = exp.current
        ? `${exp.startDate} - Present`
        : `${exp.startDate} - ${exp.endDate || 'Present'}`;
      // Include experience ID for targeting
      parts.push(`\n[ID: ${exp.id}] ${exp.company} | ${exp.title} | ${dateRange}`);
      parts.push(`  Title spanId: experience-${exp.id}-title`);
      parts.push(`  Company spanId: experience-${exp.id}-company`);
      if (exp.location) parts.push(`  Location: ${exp.location}`);
      if (exp.description) {
        // Split description into bullets with span IDs
        parts.push(`  Bullets:`);
        const bullets = exp.description
          .split('\n')
          .filter((b) => b.trim())
          .map(
            (b, i) =>
              `    [spanId: experience-${exp.id}-description-${i}] ${b.replace(/^[•\-]\s*/, '')}`,
          );
        parts.push(bullets.join('\n'));
      }
    }
  }

  // Education - include IDs for targeting
  if (resumeData.education && resumeData.education.length > 0) {
    parts.push('\n[EDUCATION]');
    for (const edu of resumeData.education) {
      const degree = edu.field ? `${edu.degree} in ${edu.field}` : edu.degree;
      const year = edu.endYear || edu.startYear || '';
      parts.push(`[ID: ${edu.id}] ${edu.school} | ${degree} | ${year}`);
      parts.push(`  School spanId: education-${edu.id}-school`);
      parts.push(`  Degree spanId: education-${edu.id}-degree`);
      if (edu.gpa) parts.push(`  GPA: ${edu.gpa}`);
    }
  }

  // Skills
  if (resumeData.skills && resumeData.skills.length > 0) {
    parts.push('\n[SKILLS] (spanId: skills-list)');
    parts.push(resumeData.skills.join(', '));
  }

  // Projects - include IDs for targeting
  if (resumeData.projects && resumeData.projects.length > 0) {
    parts.push('\n[PROJECTS]');
    for (const proj of resumeData.projects) {
      parts.push(`\n[ID: ${proj.id}] ${proj.name}${proj.role ? ` (${proj.role})` : ''}`);
      parts.push(`  Name spanId: projects-${proj.id}-name`);
      if (proj.description) {
        parts.push(`  Description spanId: projects-${proj.id}-description`);
        parts.push(`  ${proj.description}`);
      }
      if (proj.technologies) {
        parts.push(`  Technologies: ${proj.technologies}`);
      }
    }
  }

  return parts.join('\n');
}

// ========== SCORE PROMPT ==========
export const SCORE_PROMPT = `You are the Resume Scoring Engine. Analyze the provided resume and calculate scores across four dimensions.

SCORING DIMENSIONS:

1. IMPACT (35% weight) - Does this resume show results?
   Score 0-100 based on:
   - Metrics presence: +3 points each, max 30
   - Strong action verbs at bullet start: +2 each, max 20
   - Outcome/result described: +2 each, max 20
   - Scope indicators (team size, user count): +2 each, max 15
   Penalties: "Responsible for" phrases: -3 each, Vague statements: -2 each

2. CLARITY (25% weight) - Is it easy to understand?
   - Readability score (target 45-65 Flesch): 25 pts
   - Avg bullet under 25 words: 20 pts
   - Active voice: +2 per bullet, max 15
   - Minimal jargon: +2 per bullet, max 15
   Penalties: Passive voice -2, Run-ons -3, Acronyms without definition -1

3. ATS (25% weight) - Will it parse correctly?
   - Standard section names: +5 each, max 20
   - Keyword match (if JD provided): up to 30 pts
   - Consistent dates: 10 pts
   - Parseable contact info: 10 pts
   - Clean formatting: 15 pts

4. BREVITY (15% weight) - Is every word earning its place?
   - Appropriate page count: 30 pts
   - No filler words: +2 per clean bullet, max 25
   - No redundant skills: 15 pts
   - Appropriate bullet counts: 15 pts

OUTPUT JSON FORMAT:
{
  "overall": <0-100>,
  "breakdown": {
    "impact": { "score": <0-100>, "signals": [{"name": "...", "found": N, "expected": N, "points": N}], "summary": "<1 sentence>" },
    "clarity": { "score": <0-100>, "signals": [...], "summary": "<1 sentence>" },
    "ats": { "score": <0-100>, "signals": [...], "summary": "<1 sentence>" },
    "brevity": { "score": <0-100>, "signals": [...], "summary": "<1 sentence>" }
  },
  "topIssues": [{ "category": "impact|clarity|ats|brevity", "issue": "...", "location": "<spanId or section name>", "fix": "..." }],
  "quickWins": ["<easy fix 1>", "<easy fix 2>", "<easy fix 3>"]
}

LOCATION FORMAT: Use spanIds from the resume when possible (e.g., "experience-exp-1-description-0"). If no specific spanId applies, use section name (e.g., "Experience", "Summary").`;

export function buildScorePrompt(resumeData: ResumeData, jd?: JobDescription): string {
  let prompt = `${SCORE_PROMPT}\n\nRESUME TO ANALYZE:\n${formatResumeForPrompt(resumeData)}`;

  if (jd) {
    prompt += `\n\nTARGET JOB DESCRIPTION:\nTitle: ${jd.title}\nCompany: ${jd.company}\n\n${jd.description}`;
  }

  prompt += '\n\nCalculate the score now. Return valid JSON only.';
  return prompt;
}

// ========== SUGGESTIONS PROMPT ==========
export const SUGGESTIONS_PROMPT = `You are the Resume Suggestion Engine. Generate prioritized, actionable suggestions to improve the resume.

SUGGESTION TYPES BY SEVERITY:

CRITICAL (must fix):
- missing-metrics: Bullet lacks quantifiable impact
- weak-verb: Starts with weak action verb
- vague-achievement: Claims achievement without specifics
- no-outcome: Describes task but not result

IMPORTANT (should fix):
- too-long: Bullet exceeds 30 words
- passive-voice: Uses passive voice
- missing-keyword: Missing important keyword from JD
- redundant-content: Repeats information
- weak-scope: Doesn't show scale/scope

POLISH (nice to have):
- filler-words: Contains unnecessary filler
- formatting-consistency: Inconsistent formatting
- order-optimization: Could be reordered for impact
- enhancement-opportunity: Could be strengthened

FOR EACH SUGGESTION PROVIDE:
- id: unique identifier like "{type}-{spanId}"
- type: from the list above
- severity: critical/important/polish
- category: impact/clarity/ats/brevity
- targetType: bullet/section/resume/header
- targetId: the element ID from the resume (e.g., "exp-1", "edu-1")
- targetPath: USE THE EXACT spanId FROM THE RESUME (e.g., "experience-exp-1-description-0", "summary-text")
- title: max 50 chars, actionable
- explanation: why this matters, max 200 chars
- beforeText: current text (copy exactly from resume)
- afterText: improved version (complete, usable, not placeholder)
- estimatedScoreImpact: expected point gain (+1 to +5)

CRITICAL: The targetPath MUST be a valid spanId from the resume. Look for "[spanId: ...]" markers in the resume.
Examples:
- For experience bullet: "experience-{id}-description-{bulletIndex}" (e.g., "experience-exp-1-description-0")
- For experience title: "experience-{id}-title" (e.g., "experience-exp-1-title")
- For summary: "summary-text"
- For projects: "projects-{id}-description" (e.g., "projects-proj-1-description")

RULES:
- Maximum 15 suggestions
- Order by severity (critical first) then by impact
- afterText must be complete replacement text, ready to use
- targetPath must be a valid spanId from the resume
- beforeText must match the current text exactly

OUTPUT JSON FORMAT:
{
  "suggestions": [...],
  "summary": { "critical": N, "important": N, "polish": N, "potentialScoreGain": N }
}`;

export function buildSuggestionsPrompt(
  resumeData: ResumeData,
  jd?: JobDescription,
  focusArea?: string,
): string {
  let prompt = SUGGESTIONS_PROMPT;

  if (focusArea) {
    prompt += `\n\nFOCUS AREA: Prioritize ${focusArea} suggestions.`;
  }

  prompt += `\n\nRESUME TO ANALYZE:\n${formatResumeForPrompt(resumeData)}`;

  if (jd) {
    prompt += `\n\nTARGET JOB DESCRIPTION:\nTitle: ${jd.title}\nCompany: ${jd.company}\n\n${jd.description}`;
  }

  prompt += '\n\nGenerate suggestions. Return valid JSON only.';
  return prompt;
}

// ========== BULLET REWRITE PROMPT ==========
export const BULLET_REWRITE_PROMPT = `You are an expert resume bullet writer. Rewrite the given bullet to maximize impact.

REWRITING GOALS:
1. Start with powerful action verb (Led, Drove, Launched, Delivered, Spearheaded, Architected, Optimized)
2. Include quantifiable metrics (numbers, %, $, time saved)
3. Show clear outcome/impact
4. Keep under 25 words (30 max)
5. Maintain authenticity - don't fabricate metrics

STRUCTURE: [VERB] + [WHAT] + [METRIC/SCALE] + [IMPACT/RESULT]

EXAMPLES:
Weak: "Responsible for managing a team of engineers"
Strong: "Led team of 8 engineers delivering 3 product releases ahead of schedule"

Weak: "Helped improve customer satisfaction"
Strong: "Drove 34% improvement in NPS by redesigning onboarding flow for 50K+ users"

Weak: "Worked on the company website"
Strong: "Rebuilt company website achieving 40% faster load times and 25% increase in conversions"

OUTPUT JSON FORMAT:
{
  "rewrittenBullet": "<improved bullet>",
  "wordCount": N,
  "changes": [{ "type": "verb|metric|structure|clarity|keyword", "before": "...", "after": "...", "reason": "..." }],
  "metricsStatus": { "hadMetrics": bool, "hasMetrics": bool, "metricsAdded": ["metric1", "metric2"] },
  "verbAnalysis": { "originalVerb": "...", "newVerb": "...", "tierImprovement": N },
  "alternativeVersions": [{ "bullet": "...", "emphasis": "impact|leadership|technical|efficiency", "wordCount": N }],
  "confidence": "high|medium|low",
  "followUpQuestions": ["<question if more info would help>"]
}`;

export function buildBulletRewritePrompt(
  bullet: string,
  context: {
    company: string;
    title: string;
    industry?: string;
    targetRole?: string;
  },
  constraints?: {
    maxWords?: number;
    mustInclude?: string[];
  },
): string {
  const input = {
    originalBullet: bullet,
    context: {
      company: context.company,
      title: context.title,
      industry: context.industry || 'General',
      targetRole: context.targetRole || 'Similar role',
    },
    constraints: {
      maxWords: constraints?.maxWords || 25,
      mustInclude: constraints?.mustInclude || [],
    },
  };

  return `${BULLET_REWRITE_PROMPT}

INPUT:
${JSON.stringify(input, null, 2)}

Rewrite this bullet for maximum impact. Return valid JSON only.`;
}

// ========== JD ANALYSIS PROMPT ==========
export const JD_ANALYSIS_PROMPT = `You are a job description analysis expert. Parse and analyze the provided job description for resume optimization.

EXTRACT THE FOLLOWING:

1. BASICS
   - Company name
   - Job title (as written)
   - Standardized title (common industry term)
   - Location
   - Remote status (onsite/hybrid/remote)
   - Seniority level (entry/mid/senior/lead/executive)
   - Years experience required (min and max)

2. REQUIREMENTS
   - Required skills/qualifications (must-have)
   - Preferred skills/qualifications (nice-to-have)
   - Education requirements
   - Certifications needed

3. KEYWORDS
   - Technical keywords with frequency count
   - Soft skill keywords
   - Domain-specific terms
   - Which keywords MUST appear in a resume

4. RECOMMENDATIONS
   - What the resume must include
   - What would strengthen the application
   - Suggested focus areas

OUTPUT JSON FORMAT:
{
  "basics": {
    "company": "...",
    "title": "...",
    "standardizedTitle": "...",
    "location": "...",
    "locationType": "onsite|hybrid|remote",
    "seniorityLevel": "entry|mid|senior|lead|executive",
    "estimatedYearsExperience": { "min": N, "max": N|null }
  },
  "requirements": {
    "required": [{ "item": "...", "type": "skill|experience|education|certification|other", "mentions": N, "importance": "critical|high|medium|low" }],
    "preferred": [...],
    "education": { "required": "...|null", "preferred": "...|null", "fieldOfStudy": [...] }
  },
  "keywords": {
    "technical": [{ "keyword": "...", "frequency": N, "synonyms": [...], "mustIncludeInResume": bool }],
    "soft": [...],
    "domain": [...]
  },
  "recommendations": [{ "priority": "high|medium|low", "action": "...", "expectedImpact": "..." }]
}`;

export function buildJDAnalysisPrompt(jd: string): string {
  return `${JD_ANALYSIS_PROMPT}

JOB DESCRIPTION TO ANALYZE:
${jd}

Analyze this job description comprehensively. Return valid JSON only.`;
}

// ========== MATCH SCORE PROMPT ==========
export const MATCH_SCORE_PROMPT = `Compare the resume against the job description and calculate a match score.

MATCHING CRITERIA:

1. SKILLS MATCH (40% weight)
   - Required skills found: +5 each
   - Preferred skills found: +3 each
   - Nice-to-have skills: +1 each

2. EXPERIENCE MATCH (30% weight)
   - Years align with requirements: up to 20 pts
   - Seniority level matches: up to 10 pts
   - Industry relevance: up to 10 pts

3. ACHIEVEMENT RELEVANCE (20% weight)
   - Bullets matching key responsibilities: +3 each
   - Metrics in relevant areas: +2 each
   - Keywords used naturally: +1 each

4. CULTURAL FIT (10% weight)
   - Company size/type match
   - Work style alignment

OUTPUT JSON FORMAT:
{
  "matchScore": <0-100>,
  "matchLevel": "strong|good|moderate|weak",
  "skillsAnalysis": {
    "matched": [{ "skill": "...", "importance": "required|preferred|nice-to-have", "evidenceInResume": "..." }],
    "gaps": [{ "skill": "...", "importance": "...", "suggestion": "..." }],
    "score": <0-100>
  },
  "experienceAnalysis": {
    "yearsMatch": bool,
    "seniorityMatch": bool,
    "industryMatch": bool,
    "score": <0-100>,
    "notes": "..."
  },
  "keywordAnalysis": {
    "found": ["keyword1", "keyword2"],
    "missing": ["keyword3", "keyword4"],
    "score": <0-100>
  },
  "recommendations": [{ "priority": "high|medium|low", "action": "...", "expectedImpact": "..." }]
}`;

export function buildMatchScorePrompt(resumeData: ResumeData, jd: JobDescription): string {
  return `${MATCH_SCORE_PROMPT}

RESUME:
${formatResumeForPrompt(resumeData)}

JOB DESCRIPTION:
Title: ${jd.title}
Company: ${jd.company}

${jd.description}

Calculate the match score. Return valid JSON only.`;
}

// ========== SUMMARY GENERATION PROMPT ==========
export const SUMMARY_GENERATION_PROMPT = `You are an expert resume writer. Generate a compelling professional summary.

REQUIREMENTS:
- 2-3 sentences (50-150 words)
- Highlight key skills and experience
- Use strong action words
- Written in first person without using "I"
- Tailored to the specified intent/role

OUTPUT: Return ONLY the summary text, no JSON formatting.`;

export function buildSummaryPrompt(
  resumeData: ResumeData,
  intent?: string,
  targetRole?: string,
): string {
  const parts: string[] = [SUMMARY_GENERATION_PROMPT];

  parts.push('\n\nRESUME CONTEXT:');

  if (resumeData.contactInfo?.name) {
    parts.push(`Name: ${resumeData.contactInfo.name}`);
  }

  if (targetRole) {
    parts.push(`Target Role: ${targetRole}`);
  }

  if (intent) {
    parts.push(`Purpose: ${intent}`);
  }

  // Recent experience
  if (resumeData.experience && resumeData.experience.length > 0) {
    const expSummary = resumeData.experience
      .slice(0, 3)
      .map((exp) => `${exp.title} at ${exp.company}`)
      .join(', ');
    parts.push(`Recent Experience: ${expSummary}`);
  }

  // Skills
  if (resumeData.skills && resumeData.skills.length > 0) {
    parts.push(`Key Skills: ${resumeData.skills.slice(0, 10).join(', ')}`);
  }

  // Education
  if (resumeData.education && resumeData.education.length > 0) {
    const edu = resumeData.education[0];
    if (edu.degree && edu.field && edu.school) {
      parts.push(`Education: ${edu.degree} in ${edu.field} from ${edu.school}`);
    } else if (edu.school) {
      parts.push(`Education: ${edu.school}`);
    }
  }

  parts.push('\n\nGenerate the professional summary now.');
  return parts.join('\n');
}

// ========== EXPORTED SYSTEM PROMPTS FOR API ROUTES ==========
// These are the system prompts used by the API routes

export const SCORE_SYSTEM_PROMPT = `${MASTER_SYSTEM_PROMPT}

${SCORE_PROMPT}`;

export const SUGGESTIONS_SYSTEM_PROMPT = `${MASTER_SYSTEM_PROMPT}

${SUGGESTIONS_PROMPT}`;

export const REWRITE_SYSTEM_PROMPT = `${MASTER_SYSTEM_PROMPT}

${BULLET_REWRITE_PROMPT}`;

export const JD_ANALYSIS_SYSTEM_PROMPT = `${MASTER_SYSTEM_PROMPT}

${JD_ANALYSIS_PROMPT}`;

export const MATCH_SCORE_SYSTEM_PROMPT = `${MASTER_SYSTEM_PROMPT}

${MATCH_SCORE_PROMPT}`;

// ========== USER PROMPT BUILDERS FOR API ROUTES ==========

/**
 * Build user prompt for score API
 */
export function buildScoreUserPrompt(resumeData: ResumeData, jd?: JobDescription | string): string {
  let prompt = `RESUME TO ANALYZE:\n${formatResumeForPrompt(resumeData)}`;

  if (jd) {
    if (typeof jd === 'string') {
      prompt += `\n\nTARGET JOB DESCRIPTION:\n${jd}`;
    } else {
      prompt += `\n\nTARGET JOB DESCRIPTION:\nTitle: ${jd.title}\nCompany: ${jd.company}\n\n${jd.description}`;
    }
  }

  prompt += '\n\nCalculate the score now. Return valid JSON only.';
  return prompt;
}

/**
 * Build user prompt for suggestions API
 */
export function buildSuggestionsUserPrompt(
  resumeData: ResumeData,
  jd?: JobDescription | string,
  focusAreas?: string[],
): string {
  let prompt = '';

  if (focusAreas && focusAreas.length > 0) {
    prompt += `FOCUS AREAS: Prioritize ${focusAreas.join(', ')} suggestions.\n\n`;
  }

  prompt += `RESUME TO ANALYZE:\n${formatResumeForPrompt(resumeData)}`;

  if (jd) {
    if (typeof jd === 'string') {
      prompt += `\n\nTARGET JOB DESCRIPTION:\n${jd}`;
    } else {
      prompt += `\n\nTARGET JOB DESCRIPTION:\nTitle: ${jd.title}\nCompany: ${jd.company}\n\n${jd.description}`;
    }
  }

  prompt += '\n\nGenerate suggestions. Return valid JSON only.';
  return prompt;
}

/**
 * Build user prompt for rewrite API
 */
export function buildRewriteUserPrompt(
  bullet: string,
  roleContext?: { company?: string; title?: string; industry?: string },
  targetKeywords?: string[],
  emphasis?: 'impact' | 'leadership' | 'technical' | 'efficiency',
): string {
  const input = {
    originalBullet: bullet,
    context: {
      company: roleContext?.company || 'Not specified',
      title: roleContext?.title || 'Not specified',
      industry: roleContext?.industry || 'General',
    },
    constraints: {
      maxWords: 25,
      mustInclude: targetKeywords || [],
      emphasis: emphasis || 'impact',
    },
  };

  return `INPUT:\n${JSON.stringify(input, null, 2)}\n\nRewrite this bullet for maximum impact. Return valid JSON only.`;
}

/**
 * Build user prompt for JD analysis API
 */
export function buildJDAnalysisUserPrompt(jobDescription: string, url?: string): string {
  let prompt = `JOB DESCRIPTION TO ANALYZE:\n${jobDescription}`;

  if (url) {
    prompt += `\n\nSource URL: ${url}`;
  }

  prompt += '\n\nAnalyze this job description comprehensively. Return valid JSON only.';
  return prompt;
}

/**
 * Build user prompt for match score API
 */
export function buildMatchScoreUserPrompt(
  resumeData: ResumeData,
  jdAnalysis: {
    basics?: { title?: string; company?: string };
    requirements?: { required?: Array<{ item: string }>; preferred?: Array<{ item: string }> };
    keywords?: { technical?: Array<{ keyword: string }>; soft?: Array<{ keyword: string }> };
  },
): string {
  const resumeText = formatResumeForPrompt(resumeData);

  // Format JD analysis into readable text
  const jdParts: string[] = [];

  if (jdAnalysis.basics) {
    jdParts.push(`Job Title: ${jdAnalysis.basics.title || 'Not specified'}`);
    jdParts.push(`Company: ${jdAnalysis.basics.company || 'Not specified'}`);
  }

  if (jdAnalysis.requirements?.required && jdAnalysis.requirements.required.length > 0) {
    jdParts.push(
      `\nRequired Skills:\n${jdAnalysis.requirements.required.map((r) => `- ${r.item}`).join('\n')}`,
    );
  }

  if (jdAnalysis.requirements?.preferred && jdAnalysis.requirements.preferred.length > 0) {
    jdParts.push(
      `\nPreferred Skills:\n${jdAnalysis.requirements.preferred.map((r) => `- ${r.item}`).join('\n')}`,
    );
  }

  if (jdAnalysis.keywords?.technical && jdAnalysis.keywords.technical.length > 0) {
    jdParts.push(
      `\nTechnical Keywords: ${jdAnalysis.keywords.technical.map((k) => k.keyword).join(', ')}`,
    );
  }

  return `RESUME:\n${resumeText}\n\nJOB REQUIREMENTS:\n${jdParts.join('\n')}\n\nCalculate the match score. Return valid JSON only.`;
}

// ========== SKILL SUGGESTIONS PROMPT ==========
export const SKILL_SUGGESTIONS_PROMPT = `You are a career advisor. Suggest skills to strengthen the resume.

GUIDELINES:
- Suggest 8-12 skills
- Mix of hard skills (technical) and soft skills
- Prioritize skills relevant to target role if provided
- Consider skills implied by experience but not listed
- Avoid generic skills like "hardworking" or "team player"
- Focus on ATS-searchable terms
- Include industry-specific terminology

OUTPUT JSON FORMAT:
{
  "skills": ["skill1", "skill2", ...],
  "categories": {
    "technical": ["skill1", ...],
    "soft": ["skill1", ...],
    "tools": ["skill1", ...]
  }
}`;

export function buildSkillSuggestionsPrompt(
  resumeData: ResumeData,
  intent?: string,
  targetRole?: string,
): string {
  const parts: string[] = [SKILL_SUGGESTIONS_PROMPT];

  // Current skills
  if (resumeData.skills && resumeData.skills.length > 0) {
    parts.push(`\n\nCurrent Skills: ${resumeData.skills.join(', ')}`);
  }

  // Experience context
  if (resumeData.experience && resumeData.experience.length > 0) {
    const experienceSummary = resumeData.experience
      .map((exp) => `- ${exp.title} at ${exp.company}: ${exp.description || ''}`)
      .join('\n');
    parts.push(`\n\nWork Experience:\n${experienceSummary}`);
  }

  // Target context
  if (targetRole) {
    parts.push(`\n\nTarget Role: ${targetRole}`);
  }

  if (intent) {
    parts.push(`Resume Purpose: ${intent}`);
  }

  parts.push('\n\nSuggest skills. Return valid JSON only.');
  return parts.join('');
}
