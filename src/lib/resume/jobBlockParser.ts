/**
 * Job Block Parser - Deterministic parsing of work experience from resume text
 *
 * This module provides functions to:
 * 1. Extract job blocks from the Experience section in document order
 * 2. Parse each job block into structured experience entries
 *
 * The parsing is deterministic (no AI) to guarantee:
 * - Jobs stay in document order
 * - Each job's content (title, company, dates, bullets) stays together
 * - Summary and accomplishments are never duplicated
 */

// ============================================================================
// TYPES
// ============================================================================

export interface JobBlock {
  order: number; // 1-based position in document
  dateRange: string;
  headerLine: string; // First line of the job block (usually title/company)
  preview: string; // First 200 chars of content
  startLine: number;
  endLine: number;
  blockText: string;
}

export interface ParsedExperienceEntry {
  title?: string;
  company?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  summary?: string;
  keyContributions?: string[];
}

// ============================================================================
// PATTERNS
// ============================================================================

const SECTION_PATTERNS: { name: string; patterns: RegExp[] }[] = [
  {
    name: 'SUMMARY',
    patterns: [
      /^(?:professional\s+)?summary$/i,
      /^profile$/i,
      /^(?:career\s+)?objective$/i,
      /^about\s*(?:me)?$/i,
      /^overview$/i,
    ],
  },
  {
    name: 'EXPERIENCE',
    patterns: [
      /^(?:work\s+)?experience$/i,
      /^(?:professional\s+)?experience$/i,
      /^employment(?:\s+history)?$/i,
      /^work\s+history$/i,
    ],
  },
  {
    name: 'EDUCATION',
    patterns: [/^education$/i, /^academic(?:\s+background)?$/i, /^qualifications$/i],
  },
  {
    name: 'SKILLS',
    patterns: [
      /^(?:technical\s+)?skills$/i,
      /^core\s+competencies$/i,
      /^expertise$/i,
      /^technologies$/i,
    ],
  },
  {
    name: 'CERTIFICATIONS',
    patterns: [
      /^certifications?$/i,
      /^licenses?(?:\s*&\s*certifications?)?$/i,
      /^credentials?$/i,
      /^professional\s+certifications?$/i,
    ],
  },
  {
    name: 'PROJECTS',
    patterns: [/^projects?$/i, /^(?:personal\s+)?projects$/i, /^portfolio$/i],
  },
  {
    name: 'ACHIEVEMENTS',
    patterns: [/^achievements?$/i, /^awards?$/i, /^honors?$/i, /^accomplishments?$/i],
  },
];

const BULLET_LINE_PATTERN = /^\s*(?:[•●○▪▸►➤➢]|[-*]|\d+[.)])\s+/;
const ACCOMPLISHMENTS_HEADER_PATTERN =
  /^(?:accomplishments?|achievements?|highlights?|responsibilities|key contributions?)\s*:?\s*$/i;
const LOCATION_PATTERN = /^[A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s*[A-Z]{2,}(?:\s*\d{5})?$/;
const REMOTE_PATTERN = /^(remote|hybrid|onsite)$/i;
const COMPANY_HINT_PATTERN =
  /\b(inc\.?|llc|l\.l\.c\.|corp\.?|corporation|company|co\.?|ltd\.?|limited|group|university|institutes?|laborator(?:y|ies)|labs?|agency|department|consulting|systems|solutions|technologies|health|bank|foundation|college|school|research)\b/i;
const TITLE_HINT_PATTERN =
  /\b(analyst|engineer|developer|designer|manager|director|lead|specialist|consultant|administrator|coordinator|intern|assistant|associate|officer|architect|strategist|scientist|principal|owner|founder|president|vice president|vp|product|marketing|sales|account|project|program|business|operations|research|data|software|qa|devops)\b/i;

const MONTH_PATTERN =
  'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?';
const RANGE_SEPARATOR = '(?:-|–|—|to)';

const MONTH_RANGE_REGEX = new RegExp(
  `(${MONTH_PATTERN})[.,]?\\s*(\\d{4})\\s*${RANGE_SEPARATOR}\\s*(?:(${MONTH_PATTERN})[.,]?\\s*(\\d{4})|(Present|Current|Now|Ongoing))`,
  'i',
);
const NUMERIC_RANGE_REGEX =
  /(\d{1,2})\s*\/\s*(\d{4})\s*(?:-|–|—|to)\s*(?:(\d{1,2})\s*\/\s*(\d{4})|(Present|Current|Now|Ongoing))/i;
const YEAR_RANGE_REGEX =
  /((?:19|20)\d{2})\s*(?:-|–|—|to)\s*((?:19|20)\d{2}|Present|Current|Now|Ongoing)/i;

const DATE_RANGE_LINE_PATTERNS = [
  new RegExp(
    `(?:${MONTH_PATTERN})[.,]?\\s*\\d{4}\\s*${RANGE_SEPARATOR}\\s*(?:(?:${MONTH_PATTERN})[.,]?\\s*\\d{4}|Present|Current|Now|Ongoing)`,
    'i',
  ),
  new RegExp(
    `\\d{1,2}\\s*\\/\\s*\\d{4}\\s*${RANGE_SEPARATOR}\\s*(?:\\d{1,2}\\s*\\/\\s*\\d{4}|Present|Current|Now|Ongoing)`,
    'i',
  ),
  new RegExp(
    `(?:19|20)\\d{2}\\s*${RANGE_SEPARATOR}\\s*(?:(?:19|20)\\d{2}|Present|Current|Now|Ongoing)`,
    'i',
  ),
];

const MONTH_NUMBER_MAP: Record<string, string> = {
  jan: '01',
  january: '01',
  feb: '02',
  february: '02',
  mar: '03',
  march: '03',
  apr: '04',
  april: '04',
  may: '05',
  jun: '06',
  june: '06',
  jul: '07',
  july: '07',
  aug: '08',
  august: '08',
  sep: '09',
  sept: '09',
  september: '09',
  oct: '10',
  october: '10',
  nov: '11',
  november: '11',
  dec: '12',
  december: '12',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function findSectionStarts(lines: string[]): { name: string; line: number; headerLine: string }[] {
  const sectionStarts: { name: string; line: number; headerLine: string }[] = [];

  lines.forEach((line, idx) => {
    const trimmedLine = line.trim().replace(/[:\s]+$/, '');
    if (!trimmedLine || trimmedLine.length > 50) return;

    for (const section of SECTION_PATTERNS) {
      for (const pattern of section.patterns) {
        if (pattern.test(trimmedLine)) {
          if (!sectionStarts.some((entry) => entry.line === idx)) {
            sectionStarts.push({ name: section.name, line: idx, headerLine: trimmedLine });
          }
          return;
        }
      }
    }
  });

  return sectionStarts.sort((a, b) => a.line - b.line);
}

function isSectionHeader(line: string): boolean {
  const trimmedLine = line.trim().replace(/[:\s]+$/, '');
  if (!trimmedLine || trimmedLine.length > 50) return false;
  return SECTION_PATTERNS.some((section) =>
    section.patterns.some((pattern) => pattern.test(trimmedLine)),
  );
}

function findDateRange(text: string): string {
  for (const pattern of DATE_RANGE_LINE_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return '';
}

function normalizeMonthYear(text: string): string {
  const monthMatch = text.match(new RegExp(`(${MONTH_PATTERN})[.,]?\\s*(\\d{4})`, 'i'));
  if (monthMatch) {
    const monthKey = monthMatch[1].toLowerCase().replace('.', '');
    const monthNumber = MONTH_NUMBER_MAP[monthKey];
    if (monthNumber) return `${monthNumber}/${monthMatch[2]}`;
  }

  const numericMatch = text.match(/(\d{1,2})\s*\/\s*(\d{4})/);
  if (numericMatch) {
    const paddedMonth = numericMatch[1].padStart(2, '0');
    return `${paddedMonth}/${numericMatch[2]}`;
  }

  const yearMatch = text.match(/\b(19|20)\d{2}\b/);
  return yearMatch ? yearMatch[0] : text.trim();
}

function stripDateRangeFromLine(line: string): string {
  let cleaned = line;
  for (const pattern of DATE_RANGE_LINE_PATTERNS) {
    cleaned = cleaned.replace(pattern, '').trim();
  }
  return cleaned
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s|•·-]+$/, '')
    .replace(/^[-–—|]\s*/, '')
    .trim();
}

function parseDateRangeText(dateRange: string): {
  startDate: string;
  endDate: string;
  current: boolean;
} {
  if (!dateRange) return { startDate: '', endDate: '', current: false };

  const normalized = dateRange.replace(/\s+/g, ' ').trim();

  const monthMatch = normalized.match(MONTH_RANGE_REGEX);
  if (monthMatch) {
    const startDate = normalizeMonthYear(`${monthMatch[1]} ${monthMatch[2]}`);
    if (monthMatch[5]) {
      return { startDate, endDate: 'Present', current: true };
    }
    const endDate = normalizeMonthYear(`${monthMatch[3]} ${monthMatch[4]}`);
    return { startDate, endDate, current: false };
  }

  const numericMatch = normalized.match(NUMERIC_RANGE_REGEX);
  if (numericMatch) {
    const startDate = `${numericMatch[1].padStart(2, '0')}/${numericMatch[2]}`;
    if (numericMatch[5]) {
      return { startDate, endDate: 'Present', current: true };
    }
    const endDate = `${numericMatch[3].padStart(2, '0')}/${numericMatch[4]}`;
    return { startDate, endDate, current: false };
  }

  const yearMatch = normalized.match(YEAR_RANGE_REGEX);
  if (yearMatch) {
    const endIsCurrent = /present|current|now|ongoing/i.test(yearMatch[2]);
    return {
      startDate: yearMatch[1],
      endDate: endIsCurrent ? 'Present' : yearMatch[2],
      current: endIsCurrent,
    };
  }

  return { startDate: '', endDate: '', current: false };
}

function splitCompanyTitle(line: string): { company: string; title: string } | null {
  const separators = [' | ', ' - ', ' — ', ' – '];
  for (const separator of separators) {
    if (!line.includes(separator)) continue;
    const parts = line
      .split(separator)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length === 2) return { company: parts[0], title: parts[1] };
  }
  return null;
}

function deriveCompanyAndTitle(
  candidates: string[],
  dateLineIndex: number = -1,
): { company: string; title: string } {
  const cleaned = candidates.map((line) => line.trim()).filter(Boolean);
  if (cleaned.length === 0) return { company: '', title: '' };

  if (cleaned.length > 1 && dateLineIndex >= 0 && dateLineIndex < cleaned.length) {
    const dateLine = cleaned[dateLineIndex];
    const otherLine = cleaned.find((_, idx) => idx !== dateLineIndex) || '';
    const dateLineLooksTitle = TITLE_HINT_PATTERN.test(dateLine);
    const dateLineLooksCompany = COMPANY_HINT_PATTERN.test(dateLine);
    const otherLooksTitle = TITLE_HINT_PATTERN.test(otherLine);
    const otherLooksCompany = COMPANY_HINT_PATTERN.test(otherLine);

    if (otherLooksCompany && !otherLooksTitle && dateLineLooksTitle && !dateLineLooksCompany) {
      return { company: otherLine, title: dateLine };
    }
    if (dateLineLooksCompany && !dateLineLooksTitle && otherLooksTitle && !otherLooksCompany) {
      return { company: dateLine, title: otherLine };
    }
    if (dateLineLooksCompany && otherLooksTitle && !otherLooksCompany) {
      return { company: dateLine, title: otherLine };
    }
    if (otherLooksCompany && dateLineLooksTitle && !dateLineLooksCompany) {
      return { company: otherLine, title: dateLine };
    }
    if (otherLooksTitle) {
      return { company: dateLine, title: otherLine };
    }
    if (dateLineLooksTitle && !otherLooksTitle) {
      return { company: otherLine, title: dateLine };
    }
    return { company: dateLine, title: otherLine };
  }

  if (cleaned.length === 1) {
    const split = splitCompanyTitle(cleaned[0]);
    if (split) return split;
    if (TITLE_HINT_PATTERN.test(cleaned[0]) && !COMPANY_HINT_PATTERN.test(cleaned[0])) {
      return { company: '', title: cleaned[0] };
    }
    return { company: cleaned[0], title: '' };
  }

  for (const line of cleaned) {
    const split = splitCompanyTitle(line);
    if (split) return split;
  }

  const companyIndex = cleaned.findIndex((line) => COMPANY_HINT_PATTERN.test(line));
  const titleIndex = cleaned.findIndex((line) => TITLE_HINT_PATTERN.test(line));

  if (companyIndex !== -1 && titleIndex !== -1 && companyIndex !== titleIndex) {
    return { company: cleaned[companyIndex], title: cleaned[titleIndex] };
  }
  if (titleIndex !== -1) {
    const company = cleaned.find((_, idx) => idx !== titleIndex) || '';
    return { company, title: cleaned[titleIndex] };
  }
  if (companyIndex !== -1) {
    const title = cleaned.find((_, idx) => idx !== companyIndex) || '';
    return { company: cleaned[companyIndex], title };
  }

  return { company: cleaned[0], title: cleaned[1] };
}

// ============================================================================
// MAIN EXPORTED FUNCTIONS
// ============================================================================

/**
 * Extract job blocks from experience section in document order
 * Each block contains all text for one job entry
 */
export function extractJobBlocks(text: string): JobBlock[] {
  const lines = text.split('\n');
  const jobBlocks: JobBlock[] = [];

  // Find experience section boundaries
  let expStart = -1;
  let expEnd = lines.length;
  const sectionStarts = findSectionStarts(lines);
  const experienceIndex = sectionStarts.findIndex((section) => section.name === 'EXPERIENCE');

  if (experienceIndex !== -1) {
    expStart = sectionStarts[experienceIndex].line + 1;
    const nextSection = sectionStarts.slice(experienceIndex + 1).find((section) => {
      if (section.line <= expStart) return false;
      if (section.name !== 'ACHIEVEMENTS') return true;
      if (!ACCOMPLISHMENTS_HEADER_PATTERN.test(section.headerLine)) return true;
      const lookbackStart = Math.max(expStart, section.line - 12);
      for (let i = section.line - 1; i >= lookbackStart; i--) {
        if (findDateRange(lines[i])) return false;
      }
      return true;
    });
    if (nextSection) expEnd = nextSection.line;
  }

  if (expStart === -1) return jobBlocks;

  // Find lines with date ranges - these typically mark job entries
  const jobStartLines: number[] = [];
  for (let i = expStart; i < expEnd; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    if (!trimmedLine || BULLET_LINE_PATTERN.test(trimmedLine)) continue;
    if (findDateRange(trimmedLine)) {
      // Walk up to include contiguous header lines above the date line
      let headerLine = i;
      for (let j = i - 1; j >= expStart; j--) {
        const prevLine = lines[j].trim();
        if (
          !prevLine ||
          prevLine.length > 120 ||
          BULLET_LINE_PATTERN.test(prevLine) ||
          ACCOMPLISHMENTS_HEADER_PATTERN.test(prevLine)
        ) {
          break;
        }
        headerLine = j;
      }
      if (!jobStartLines.includes(headerLine)) jobStartLines.push(headerLine);
    }
  }

  jobStartLines.sort((a, b) => a - b);

  // Extract job blocks
  for (let i = 0; i < jobStartLines.length; i++) {
    const startLine = jobStartLines[i];
    const endLine = i < jobStartLines.length - 1 ? jobStartLines[i + 1] : expEnd;

    const blockLines = lines.slice(startLine, endLine);
    const blockText = blockLines.join('\n');

    // Find the date range in this block
    const dateRange = findDateRange(blockText);

    // Get header line (first non-empty line)
    const headerLineText = blockLines.find((l) => l.trim().length > 0)?.trim() || '';

    // Get preview (first 200 chars of content after header)
    const contentStart = blockLines.findIndex((l) => l.trim().length > 0);
    const preview = blockLines
      .slice(Math.max(contentStart + 1, 0), contentStart + 6)
      .join(' ')
      .substring(0, 200)
      .trim();

    jobBlocks.push({
      order: i + 1,
      dateRange,
      headerLine: headerLineText,
      preview,
      startLine,
      endLine,
      blockText,
    });
  }

  return jobBlocks;
}

/**
 * Parse a single job block into a structured experience entry
 *
 * IMPORTANT: This function ensures summary and keyContributions are NEVER duplicated.
 * - Summary: Plain text paragraph BEFORE the Accomplishments section
 * - keyContributions: Bullet points AFTER the Accomplishments header
 */
function parseExperienceFromJobBlock(block: JobBlock): ParsedExperienceEntry {
  const rawLines = block.blockText.split('\n');
  const trimmedLines = rawLines.map((line) => line.trim());
  const firstNonEmptyIndex = trimmedLines.findIndex((line) => line.length > 0);

  if (firstNonEmptyIndex === -1) {
    return {
      title: '',
      company: '',
      location: '',
      startDate: '',
      endDate: '',
      current: false,
      summary: '',
      keyContributions: [],
    };
  }

  // Find where bullets/accomplishments start
  let contentStartIndex = trimmedLines.findIndex(
    (line) => BULLET_LINE_PATTERN.test(line) || ACCOMPLISHMENTS_HEADER_PATTERN.test(line),
  );
  if (contentStartIndex === -1) contentStartIndex = trimmedLines.length;

  // Determine header section end (usually 2-4 lines: company, title, dates, location)
  let headerEndIndex = Math.min(firstNonEmptyIndex + 4, contentStartIndex);
  for (let i = contentStartIndex - 1; i >= firstNonEmptyIndex; i--) {
    if (!trimmedLines[i]) {
      headerEndIndex = i;
      break;
    }
  }

  // Extract header lines
  const headerLines = trimmedLines
    .slice(firstNonEmptyIndex, headerEndIndex)
    .map((line) => line.trim())
    .filter(Boolean);

  // Find location
  const locationLine = headerLines.find(
    (line) => LOCATION_PATTERN.test(line) || REMOTE_PATTERN.test(line),
  );

  // Build header candidates (for company/title detection)
  let dateLineCandidateIndex = -1;
  const headerCandidates: string[] = [];
  headerLines.forEach((line) => {
    const cleanedLine = stripDateRangeFromLine(line);
    if (!cleanedLine || cleanedLine === locationLine) return;
    if (findDateRange(line) && dateLineCandidateIndex === -1) {
      dateLineCandidateIndex = headerCandidates.length;
    }
    headerCandidates.push(cleanedLine);
  });

  const { company, title } = deriveCompanyAndTitle(headerCandidates, dateLineCandidateIndex);
  const dateRange = block.dateRange || findDateRange(block.blockText);
  const { startDate, endDate, current } = parseDateRangeText(dateRange);

  // Find where the accomplishments/bullets section starts
  let accomplishmentsStartIndex = -1;
  for (let i = headerEndIndex; i < trimmedLines.length; i++) {
    const line = trimmedLines[i];
    if (!line) continue;
    if (ACCOMPLISHMENTS_HEADER_PATTERN.test(line) || BULLET_LINE_PATTERN.test(line)) {
      accomplishmentsStartIndex = i;
      break;
    }
    if (isSectionHeader(line)) break;
  }

  // Summary: collect lines BETWEEN header and accomplishments section (non-bullet text only)
  const summaryLines: string[] = [];
  const summaryEndIndex =
    accomplishmentsStartIndex !== -1 ? accomplishmentsStartIndex : contentStartIndex;
  for (let i = headerEndIndex; i < summaryEndIndex; i++) {
    const line = trimmedLines[i];
    if (!line) continue;
    if (ACCOMPLISHMENTS_HEADER_PATTERN.test(line)) break;
    if (isSectionHeader(line)) break;
    if (BULLET_LINE_PATTERN.test(line)) break;
    summaryLines.push(line);
  }

  // Key contributions: collect ONLY from accomplishments section onwards (bullet points only)
  const keyContributions: string[] = [];
  let currentBulletIndex = -1;
  const bulletsStartIndex =
    accomplishmentsStartIndex !== -1 ? accomplishmentsStartIndex : headerEndIndex;

  for (let i = bulletsStartIndex; i < trimmedLines.length; i++) {
    const line = trimmedLines[i];
    if (!line) continue;
    if (ACCOMPLISHMENTS_HEADER_PATTERN.test(line)) continue; // Skip the header itself
    if (isSectionHeader(line)) break;

    const bulletMatch = line.match(BULLET_LINE_PATTERN);
    if (bulletMatch) {
      const bulletText = line.replace(BULLET_LINE_PATTERN, '').trim();
      if (bulletText) {
        keyContributions.push(bulletText);
        currentBulletIndex = keyContributions.length - 1;
      }
      continue;
    }

    // Continuation of previous bullet (wrapped text)
    if (currentBulletIndex >= 0 && !BULLET_LINE_PATTERN.test(line)) {
      keyContributions[currentBulletIndex] += ` ${line}`;
    }
  }

  // Build final summary
  const finalSummary = summaryLines.join(' ').trim();

  // Helper to normalize text for comparison (remove punctuation, extra spaces, lowercase)
  const normalizeForComparison = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')
      .trim();
  };

  const normalizedSummary = normalizeForComparison(finalSummary);

  // CRITICAL: Ensure summary and bullets are NEVER identical
  // This can happen if the resume has the same text as both overview and first bullet
  const filteredContributions = keyContributions.filter((contribution) => {
    const normalizedContribution = normalizeForComparison(contribution);

    // Skip if empty after normalization
    if (!normalizedContribution) return false;

    // Exact match
    if (normalizedContribution === normalizedSummary) return false;

    // Summary contains this contribution
    if (normalizedSummary.includes(normalizedContribution)) return false;

    // Contribution contains the summary (reverse check)
    if (normalizedContribution.includes(normalizedSummary) && normalizedSummary.length > 20)
      return false;

    // Check for high similarity (first 50 chars match)
    const summaryStart = normalizedSummary.substring(0, 50);
    const contributionStart = normalizedContribution.substring(0, 50);
    if (summaryStart === contributionStart && summaryStart.length >= 30) return false;

    return true;
  });

  return {
    title,
    company,
    location: locationLine || '',
    startDate,
    endDate,
    current,
    summary: finalSummary,
    keyContributions: filteredContributions,
  };
}

/**
 * Parse all job blocks into structured experience entries
 * Returns experiences in the same order as the job blocks (document order)
 */
export function parseExperienceFromJobBlocks(jobBlocks: JobBlock[]): ParsedExperienceEntry[] {
  const experiences = jobBlocks.map((block) => parseExperienceFromJobBlock(block));
  return experiences.filter(
    (exp) =>
      exp.company ||
      exp.title ||
      exp.summary ||
      (exp.keyContributions && exp.keyContributions.length > 0) ||
      exp.startDate ||
      exp.endDate,
  );
}
