import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

import { evaluate } from '@/lib/ai-evaluation';
import { createRequestLogger, getCorrelationIdFromRequest, toErrorCode } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================================
// GROUND TRUTH EXTRACTION
// ============================================================================
// Pre-analyze the resume text to establish expectations for AI parsing.
// This creates a "contract" that we can validate against.

interface SectionInfo {
  name: string;
  startLine: number;
  endLine: number;
  bulletCount: number;
  content: string;
}

interface JobBlock {
  order: number; // 1-based position in document
  dateRange: string;
  headerLine: string; // First line of the job block (usually title/company)
  preview: string; // First 200 chars of content
  startLine: number;
  endLine: number;
  blockText: string;
}

interface GroundTruth {
  sections: SectionInfo[];
  totalBullets: number;
  experienceBullets: number;
  dateRanges: { text: string; line: number }[];
  certificationIndicators: number; // Count of certification-like items
  hasSummary: boolean;
  jobBlocks: JobBlock[]; // Ordered list of job blocks as they appear in document
}

interface ParsedExperienceEntry {
  title?: string;
  company?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  summary?: string;
  keyContributions?: string[];
}

// Common section headers to detect
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

/**
 * Count bullet points in text
 * Recognizes: •, -, *, ●, ○, ▪, ▸, ►, ➤, ➢
 */
function countBullets(text: string): number {
  const bulletPatterns = [
    /^[•●○▪▸►➤➢]\s/gm, // Unicode bullets at line start
    /^\s*[-*]\s+\S/gm, // Dash or asterisk followed by space and content
    /^\s*\d+[.)]\s/gm, // Numbered lists like "1." or "1)"
  ];

  let count = 0;
  for (const pattern of bulletPatterns) {
    const matches = text.match(pattern);
    if (matches) count += matches.length;
  }
  return count;
}

/**
 * Extract date ranges from text
 */
function extractDateRanges(text: string): { text: string; line: number }[] {
  const lines = text.split('\n');
  const results: { text: string; line: number }[] = [];

  const datePatterns = [
    // "Month YYYY - Month YYYY" or "Month YYYY - Present"
    /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[.,]?\s*\d{4}\s*[-–—to]+\s*(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[.,]?\s*\d{4}|Present|Current|Now|Ongoing)/gi,
    // "MM/YYYY - MM/YYYY"
    /\d{1,2}\/\d{4}\s*[-–—to]+\s*(?:\d{1,2}\/\d{4}|Present|Current)/gi,
    // "YYYY - YYYY"
    /(?:19|20)\d{2}\s*[-–—to]+\s*(?:(?:19|20)\d{2}|Present|Current)/gi,
  ];

  lines.forEach((line, idx) => {
    for (const pattern of datePatterns) {
      pattern.lastIndex = 0;
      const matches = line.match(pattern);
      if (matches) {
        for (const match of matches) {
          // Avoid duplicates
          if (!results.some((r) => r.text === match && Math.abs(r.line - idx) < 2)) {
            results.push({ text: match, line: idx + 1 });
          }
        }
      }
    }
  });

  return results;
}

function findDateRange(text: string): string {
  for (const pattern of DATE_RANGE_LINE_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return '';
}

/**
 * Detect certification indicators in text
 */
function countCertificationIndicators(text: string): number {
  const certKeywords = [
    /salesforce\s+(?:certified|administrator|consultant|developer)/gi,
    /(?:aws|amazon)\s+(?:certified|solutions\s+architect)/gi,
    /google\s+(?:certified|analytics|ads)/gi,
    /microsoft\s+(?:certified|azure)/gi,
    /pmp|project\s+management\s+professional/gi,
    /(?:scrum|agile)\s+(?:master|certified)/gi,
    /hubspot\s+(?:certified|certification)/gi,
    /(?:certification|certified|credential)\s*(?:id|#)?[:.]?\s*[A-Z0-9-]+/gi,
  ];

  let count = 0;
  for (const pattern of certKeywords) {
    const matches = text.match(pattern);
    if (matches) count += matches.length;
  }
  return count;
}

/**
 * Extract job blocks from experience section in document order
 * This helps ensure the AI maintains the same ordering
 */
function extractJobBlocks(text: string): JobBlock[] {
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
      .slice(contentStart, contentStart + 5)
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
 * Extract ground truth from resume text
 * This pre-analyzes the text to establish expectations for validation
 */
function extractGroundTruth(text: string): GroundTruth {
  const lines = text.split('\n');
  const sections: SectionInfo[] = [];

  // Find all section boundaries
  const sectionStarts = findSectionStarts(lines);

  // Build section info with content and bullet counts
  for (let i = 0; i < sectionStarts.length; i++) {
    const start = sectionStarts[i];
    const endLine = i < sectionStarts.length - 1 ? sectionStarts[i + 1].line : lines.length;
    const content = lines.slice(start.line + 1, endLine).join('\n');

    sections.push({
      name: start.name,
      startLine: start.line + 1,
      endLine,
      bulletCount: countBullets(content),
      content,
    });
  }

  // Calculate totals
  const totalBullets = countBullets(text);
  const experienceSection = sections.find((s) => s.name === 'EXPERIENCE');
  const experienceBullets = experienceSection?.bulletCount || 0;
  const dateRanges = extractDateRanges(text);
  const certificationIndicators = countCertificationIndicators(text);
  const jobBlocks = extractJobBlocks(text);

  // Check if there's a summary section
  const hasSummary =
    sections.some((s) => s.name === 'SUMMARY') ||
    /(?:professional\s+)?summary|profile|objective/i.test(text.substring(0, 1000));

  return {
    sections,
    totalBullets,
    experienceBullets,
    dateRanges,
    certificationIndicators,
    hasSummary,
    jobBlocks,
  };
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

  let contentStartIndex = trimmedLines.findIndex(
    (line) => BULLET_LINE_PATTERN.test(line) || ACCOMPLISHMENTS_HEADER_PATTERN.test(line),
  );
  if (contentStartIndex === -1) contentStartIndex = trimmedLines.length;

  let headerEndIndex = Math.min(firstNonEmptyIndex + 4, contentStartIndex);
  for (let i = contentStartIndex - 1; i >= firstNonEmptyIndex; i--) {
    if (!trimmedLines[i]) {
      headerEndIndex = i;
      break;
    }
  }

  const headerLines = trimmedLines
    .slice(firstNonEmptyIndex, headerEndIndex)
    .map((line) => line.trim())
    .filter(Boolean);

  const locationLine = headerLines.find(
    (line) => LOCATION_PATTERN.test(line) || REMOTE_PATTERN.test(line),
  );
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

function parseExperienceFromJobBlocks(jobBlocks: JobBlock[]): ParsedExperienceEntry[] {
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

// ============================================================================
// VALIDATION
// ============================================================================

interface ParsedResume {
  personalInfo?: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    github?: string;
  };
  summary?: string;
  skills?: string[];
  experience?: ParsedExperienceEntry[];
  education?: Array<{
    degree?: string;
    field?: string;
    school?: string;
    location?: string;
    startYear?: string;
    endYear?: string;
    graduationYear?: string;
    gpa?: string;
    honors?: string;
  }>;
  projects?: Array<{
    name?: string;
    role?: string;
    technologies?: string;
    description?: string;
    url?: string;
  }>;
  achievements?: Array<{
    title?: string;
    description?: string;
    date?: string;
  }>;
  certifications?: Array<{
    name?: string;
    issuer?: string;
    date?: string;
    expirationDate?: string;
    credentialId?: string;
    url?: string;
  }>;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    expectedBullets: number;
    actualBullets: number;
    expectedCerts: number;
    actualCerts: number;
  };
}

/**
 * Validate parsed resume against ground truth
 */
function validateParsedResume(parsed: ParsedResume, groundTruth: GroundTruth): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Count bullets in parsed output
  const actualBullets = (parsed.experience || []).reduce(
    (sum, exp) => sum + (exp.keyContributions?.length || 0),
    0,
  );

  // Count certifications
  const actualCerts = parsed.certifications?.length || 0;

  // Validation 1: Check bullet count (allow 10% tolerance for edge cases)
  const bulletThreshold = Math.floor(groundTruth.experienceBullets * 0.85);
  if (actualBullets < bulletThreshold && groundTruth.experienceBullets > 0) {
    errors.push(
      `Missing bullet points: expected ~${groundTruth.experienceBullets} in experience, got ${actualBullets}`,
    );
  }

  // Validation 2: Check certifications
  if (groundTruth.certificationIndicators > 0 && actualCerts === 0) {
    errors.push(
      `Certifications missing: found ${groundTruth.certificationIndicators} certification indicators in text, but none extracted`,
    );
  }

  // Validation 3: Check if we have experience entries for each date range
  const experienceCount = parsed.experience?.length || 0;
  // Filter date ranges to only those likely in experience section (rough heuristic)
  const experienceDateCount = Math.min(groundTruth.dateRanges.length, 10); // Cap at reasonable max
  if (experienceCount < experienceDateCount - 1 && experienceDateCount > 0) {
    warnings.push(
      `Possible missing jobs: found ${experienceDateCount} date ranges, but only ${experienceCount} experience entries`,
    );
  }

  // Validation 4: Check summary if expected
  if (groundTruth.hasSummary && (!parsed.summary || parsed.summary.length < 20)) {
    warnings.push('Professional summary may be missing or too short');
  }

  // Validation 5: Basic sanity checks
  if (!parsed.personalInfo?.name || parsed.personalInfo.name === 'Imported Resume') {
    warnings.push('Name not detected');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    stats: {
      expectedBullets: groundTruth.experienceBullets,
      actualBullets,
      expectedCerts: groundTruth.certificationIndicators,
      actualCerts,
    },
  };
}

/**
 * Enhanced fallback parser that uses regex to extract comprehensive resume information
 * Used when OpenAI is not available
 */
function fallbackParser(resumeText: string) {
  const lines = resumeText.split('\n').filter((line) => line.trim());

  // Extract email
  const emailMatch = resumeText.match(/[\w\.-]+@[\w\.-]+\.\w+/);
  const email = emailMatch ? emailMatch[0] : '';

  // Extract phone
  const phoneMatch = resumeText.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const phone = phoneMatch ? phoneMatch[0] : '';

  // Extract LinkedIn
  const linkedinMatch = resumeText.match(/(?:linkedin\.com\/in\/|linkedin\.com\/pub\/)[\w-]+/i);
  const linkedin = linkedinMatch ? `https://${linkedinMatch[0]}` : '';

  // Extract GitHub
  const githubMatch = resumeText.match(/(?:github\.com\/)[\w-]+/i);
  const github = githubMatch ? `https://${githubMatch[0]}` : '';

  // Extract location - look for common patterns like "City, State" or "City, Country"
  const locationMatch = resumeText.match(
    /(?:^|\n)([A-Z][a-z]+(?:\s[A-Z][a-z]+)?,\s*[A-Z]{2,}(?:\s+\d{5})?)/m,
  );
  const location = locationMatch ? locationMatch[1].trim() : '';

  // Try to extract name (usually first line or near top, often in caps or bold)
  let name = 'Imported Resume';
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].trim();
    // Name is typically the first substantial line, often in caps or title case
    if (
      line.length > 3 &&
      line.length < 50 &&
      !line.includes('@') &&
      !line.match(/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/)
    ) {
      name = line.replace(/[^\w\s'-]/g, '').trim();
      if (name.length > 3) break;
    }
  }

  // Helper function to find section content
  const extractSection = (headers: string[]): string => {
    const headerPattern = new RegExp(`^\\s*(${headers.join('|')})\\s*[:]*\\s*$`, 'im');
    const match = resumeText.match(headerPattern);
    if (!match) return '';

    const startIndex = match.index! + match[0].length;
    const remainingText = resumeText.substring(startIndex);

    // Find next major section (all caps header)
    const nextSectionMatch = remainingText.match(/\n\s*[A-Z][A-Z\s]{3,}[:]*\s*\n/);
    const endIndex = nextSectionMatch ? nextSectionMatch.index! : remainingText.length;

    return remainingText.substring(0, endIndex).trim();
  };

  // Extract Professional Summary
  const summaryHeaders = [
    'SUMMARY',
    'PROFESSIONAL SUMMARY',
    'PROFILE',
    'OBJECTIVE',
    'CAREER OBJECTIVE',
    'ABOUT ME',
  ];
  const summary = extractSection(summaryHeaders);

  // Extract Skills
  const skillsHeaders = [
    'SKILLS',
    'TECHNICAL SKILLS',
    'CORE COMPETENCIES',
    'EXPERTISE',
    'TECHNOLOGIES',
  ];
  const skillsText = extractSection(skillsHeaders);
  let skills: string[] = [];
  if (skillsText) {
    skills = skillsText
      .split(/[,\n•·\-\|]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length < 50 && !s.match(/^[A-Z\s]{4,}$/)) // Exclude headers
      .slice(0, 20);
  }

  // Extract Work Experience
  const experienceHeaders = [
    'EXPERIENCE',
    'WORK EXPERIENCE',
    'PROFESSIONAL EXPERIENCE',
    'EMPLOYMENT HISTORY',
    'WORK HISTORY',
  ];
  const experienceText = extractSection(experienceHeaders);
  const experience: any[] = [];

  if (experienceText) {
    // Split by job entries - typically starts with a job title (often bold/caps) followed by company
    const jobPattern =
      /([^\n]+?)\s*\n\s*([^\n]+?)(?:\n|\s+)([A-Z][a-z]+\s+\d{4}\s*[-–—]\s*(?:[A-Z][a-z]+\s+\d{4}|Present|Current))/gi;
    let match;

    while ((match = jobPattern.exec(experienceText)) !== null) {
      const [, titleLine, companyLine, dateRange] = match;

      // Extract dates
      const dateMatch = dateRange.match(
        /([A-Z][a-z]+\s+\d{4})\s*[-–—]\s*([A-Z][a-z]+\s+\d{4}|Present|Current)/i,
      );
      const startDate = dateMatch ? dateMatch[1] : '';
      const endDate = dateMatch ? dateMatch[2] : '';
      const current = endDate.match(/present|current/i) !== null;

      // Get description (everything until next job or section)
      const descStart = match.index + match[0].length;
      const remainingExp = experienceText.substring(descStart);
      const nextJobMatch = remainingExp.match(/\n\s*[A-Z][^\n]{10,50}\n\s*[A-Z]/m);
      const descEnd = nextJobMatch ? nextJobMatch.index! : Math.min(500, remainingExp.length);
      const description = remainingExp.substring(0, descEnd).trim();

      // Parse description into summary and keyContributions to match AI schema
      // Trim lines upfront so bullet detection works for indented lines like "  • Contribution"
      const descriptionLines = description
        ? description
            .split(/\n/)
            .map((line) => line.trim())
            .filter((line) => line)
        : [];
      const summaryLines: string[] = [];
      const contributionLines: string[] = [];

      for (const line of descriptionLines) {
        if (/^[•*\-]\s*/.test(line)) {
          contributionLines.push(line.replace(/^[•*\-]\s*/, ''));
        } else if (contributionLines.length === 0) {
          // Lines before bullets are considered summary/overview
          summaryLines.push(line);
        } else {
          // Non-bullet lines after bullets are continuation of previous contribution
          if (line.length > 0 && contributionLines.length > 0) {
            contributionLines[contributionLines.length - 1] += ' ' + line;
          }
        }
      }

      const summaryText = summaryLines.join(' ').trim();
      const keyContributions = contributionLines.filter((line) => line.length > 0);

      experience.push({
        title: titleLine.trim(),
        company: companyLine.trim().replace(/^\s*[-–—•]\s*/, ''),
        location: '',
        startDate,
        endDate: current ? 'Present' : endDate,
        current,
        summary: summaryText,
        keyContributions,
      });
    }

    // Fallback: if no structured jobs found, try simpler pattern
    if (experience.length === 0) {
      const simpleJobLines = experienceText.split('\n').filter((l) => l.trim());
      for (let i = 0; i < simpleJobLines.length; i++) {
        const line = simpleJobLines[i].trim();
        // Look for lines that might be job titles (reasonable length, not all caps unless short)
        if (line.length > 5 && line.length < 80) {
          const nextLine = simpleJobLines[i + 1]?.trim() || '';
          const datePattern = /\d{4}\s*[-–—]\s*(?:\d{4}|Present)/;

          if (datePattern.test(line) || datePattern.test(nextLine)) {
            experience.push({
              title: line.replace(datePattern, '').trim(),
              company: '',
              location: '',
              startDate: '',
              endDate: '',
              current: false,
              summary: '',
              keyContributions: [],
            });
          }
        }
      }
    }
  }

  // Extract Education
  const educationHeaders = [
    'EDUCATION',
    'ACADEMIC BACKGROUND',
    'QUALIFICATIONS',
    'ACADEMIC QUALIFICATIONS',
  ];
  const educationText = extractSection(educationHeaders);
  const education: any[] = [];

  if (educationText) {
    // Look for degree patterns
    const degreePattern =
      /(Bachelor|Master|PhD|B\.?S\.?|M\.?S\.?|B\.?A\.?|M\.?A\.?|Associate|Doctorate)[^\n]*\n([^\n]+)\n?([^\n]*\d{4}[^\n]*)?/gi;
    let match;

    while ((match = degreePattern.exec(educationText)) !== null) {
      const [, degreeType, schoolLine, dateLine] = match;

      // Extract graduation year
      const yearMatch = (dateLine || schoolLine).match(/\d{4}/);
      const graduationYear = yearMatch ? yearMatch[0] : '';

      // Extract GPA
      const gpaMatch = educationText.match(/GPA[:\s]*(\d+\.?\d*)/i);
      const gpa = gpaMatch ? gpaMatch[1] : '';

      education.push({
        degree: degreeType.trim(),
        field: match[0].replace(degreeType, '').split('\n')[0].trim(),
        school: schoolLine.trim(),
        location: '',
        startYear: '',
        endYear: graduationYear,
        graduationYear,
        gpa,
        honors: '',
      });
    }

    // Fallback: simpler education parsing
    if (education.length === 0) {
      const eduLines = educationText.split('\n').filter((l) => l.trim());
      const degreeKeywords = /bachelor|master|phd|degree|b\.?s\.?|m\.?s\.?|b\.?a\.?|m\.?a\.?/i;

      for (let i = 0; i < eduLines.length; i++) {
        const line = eduLines[i].trim();
        if (degreeKeywords.test(line)) {
          const yearMatch = line.match(/\d{4}/);
          education.push({
            degree: line,
            field: '',
            school: eduLines[i + 1]?.trim() || '',
            location: '',
            startYear: '',
            endYear: yearMatch ? yearMatch[0] : '',
            graduationYear: yearMatch ? yearMatch[0] : '',
            gpa: '',
            honors: '',
          });
          break;
        }
      }
    }
  }

  // Extract Projects
  const projectHeaders = ['PROJECTS', 'PERSONAL PROJECTS', 'KEY PROJECTS', 'PORTFOLIO'];
  const projectsText = extractSection(projectHeaders);
  const projects: any[] = [];

  if (projectsText) {
    const projectLines = projectsText.split(/\n(?=[A-Z])/g).filter((l) => l.trim());

    for (const projectBlock of projectLines.slice(0, 5)) {
      const lines = projectBlock
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l);
      if (lines.length > 0) {
        const name = lines[0];
        const description = lines.slice(1).join('\n');

        // Look for technologies
        const techMatch = description.match(
          /(?:Technologies?|Tech Stack|Built with)[:\s]*([^\n]+)/i,
        );
        const technologies = techMatch ? techMatch[1].trim() : '';

        projects.push({
          name,
          role: '',
          technologies,
          description: description
            .replace(/(?:Technologies?|Tech Stack|Built with)[:\s]*[^\n]+/i, '')
            .trim(),
          url: '',
        });
      }
    }
  }

  // Extract Achievements/Awards
  const achievementHeaders = [
    'ACHIEVEMENTS',
    'AWARDS',
    'HONORS',
    'CERTIFICATIONS',
    'ACCOMPLISHMENTS',
  ];
  const achievementsText = extractSection(achievementHeaders);
  const achievements: any[] = [];

  if (achievementsText) {
    const achievementLines = achievementsText.split(/\n/).filter((l) => l.trim() && l.length > 5);

    for (const line of achievementLines.slice(0, 10)) {
      // Extract year if present
      const yearMatch = line.match(/\b(19|20)\d{2}\b/);
      const date = yearMatch ? yearMatch[0] : '';

      achievements.push({
        title: line.replace(/^[•\-\*]\s*/, '').trim(),
        description: '',
        date,
      });
    }
  }

  return {
    personalInfo: {
      name: name || 'Imported Resume',
      email,
      phone,
      location,
      linkedin,
      github,
    },
    summary,
    skills,
    experience,
    education,
    projects,
    achievements,
  };
}

export async function POST(req: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(req);
  const log = createRequestLogger(correlationId, {
    feature: 'resume',
    httpMethod: 'POST',
    httpPath: '/api/resumes/parse',
  });

  const startTime = Date.now();
  log.info('Resume parse request started', { event: 'request.start' });

  try {
    const { resumeText } = await req.json();

    if (!resumeText || typeof resumeText !== 'string') {
      log.warn('Missing or invalid resume text', {
        event: 'validation.failed',
        errorCode: 'BAD_REQUEST',
      });
      return NextResponse.json(
        { error: 'Missing or invalid resume text' },
        {
          status: 400,
          headers: { 'x-correlation-id': correlationId },
        },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (apiKey) {
      try {
        log.info('Starting OpenAI resume parsing', { event: 'ai.request' });
        const client = new OpenAI({ apiKey });

        // Extract ground truth BEFORE AI parsing to establish expectations
        const groundTruth = extractGroundTruth(resumeText);
        log.debug('Ground truth extracted', {
          event: 'groundtruth.extracted',
          extra: {
            totalBullets: groundTruth.totalBullets,
            experienceBullets: groundTruth.experienceBullets,
            certificationIndicators: groundTruth.certificationIndicators,
            dateRanges: groundTruth.dateRanges.length,
            hasSummary: groundTruth.hasSummary,
            sections: groundTruth.sections.map((s) => s.name),
            jobBlocksCount: groundTruth.jobBlocks.length,
            jobBlocks: groundTruth.jobBlocks.map((j) => ({
              order: j.order,
              header: j.headerLine,
              dates: j.dateRange,
            })),
          },
        });

        // Build the prompt with ground truth constraints
        const prompt = `You are a professional resume parser. Parse the following resume text and extract structured information.

Resume Text:
${resumeText}

=== GROUND TRUTH (Pre-analyzed from document - YOU MUST MATCH THESE) ===
Total bullet points detected in document: ${groundTruth.totalBullets}
Bullet points in Experience section: ${groundTruth.experienceBullets}
Certification indicators found: ${groundTruth.certificationIndicators}
Date ranges detected: ${groundTruth.dateRanges.map((d) => d.text).join(', ')}
Has professional summary: ${groundTruth.hasSummary}

=== JOB BLOCKS DETECTED IN DOCUMENT ORDER ===
${
  groundTruth.jobBlocks.length > 0
    ? groundTruth.jobBlocks
        .map(
          (job) =>
            `Position #${job.order} in document: "${job.headerLine}" (${job.dateRange || 'dates not auto-detected'})`,
        )
        .join('\n')
    : 'Auto-detection found no job blocks - parse the Experience section carefully'
}
IMPORTANT: Your experience array output MUST follow this same order. Position #1 = experience[0], Position #2 = experience[1], etc.

YOUR OUTPUT MUST:
- Extract ALL work experience entries from the resume (not just the ones listed above)
- Have approximately ${groundTruth.experienceBullets} total items across all keyContributions arrays (if bullets detected)
- Extract ${groundTruth.certificationIndicators > 0 ? 'at least 1 certification' : 'certifications if present'}
- ${groundTruth.hasSummary ? 'Include the professional summary' : 'Include summary if found'}
- Maintain the exact order jobs appear in the document
=== END GROUND TRUTH ===

Return a JSON object with this exact structure:
{
  "personalInfo": {
    "name": "Full name from resume",
    "email": "Email address",
    "phone": "Phone number",
    "location": "City, State or location",
    "linkedin": "LinkedIn URL if found",
    "github": "GitHub URL if found"
  },
  "summary": "Professional summary or objective if found, otherwise empty string",
  "skills": ["skill1", "skill2", ...],
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "location": "City, State",
      "startDate": "MM/YYYY",
      "endDate": "MM/YYYY or Present",
      "current": false,
      "summary": "Brief paragraph summarizing the role and overall responsibilities (2-3 sentences, NO bullet point)",
      "keyContributions": [
        "Specific achievement or contribution (no bullet symbol, just the text)",
        "Another key contribution (no bullet symbol, just the text)",
        "Additional accomplishment (no bullet symbol, just the text)"
      ]
    }
  ],
  "education": [
    {
      "degree": "Degree name",
      "field": "Field of study",
      "school": "Institution name",
      "location": "City, State",
      "startYear": "YYYY",
      "endYear": "YYYY",
      "graduationYear": "YYYY",
      "gpa": "GPA if mentioned",
      "honors": "Honors/awards if mentioned"
    }
  ],
  "projects": [
    {
      "name": "Project name",
      "role": "Your role",
      "technologies": "Technologies used",
      "description": "Project description",
      "url": "Project URL if available"
    }
  ],
  "achievements": [
    {
      "title": "Achievement title",
      "description": "Achievement description",
      "date": "Date if available"
    }
  ],
  "certifications": [
    {
      "name": "Certification name (e.g., Salesforce Marketing Cloud Account Engagement Consultant)",
      "issuer": "Issuing organization (e.g., Salesforce, Google, AWS)",
      "date": "Date obtained (MM/YYYY or YYYY)",
      "expirationDate": "Expiration date if applicable",
      "credentialId": "Credential ID if mentioned",
      "url": "Verification URL if available"
    }
  ]
}

CRITICAL RULES - YOU MUST FOLLOW THESE EXACTLY:

1. CAPTURE ALL CONTENT - NO TRUNCATION:
   - Extract EVERY SINGLE bullet point from each job - do not skip any
   - If a job has 10 bullet points, keyContributions must have 10 items
   - Count the bullets in the resume and make sure your output has the same count
   - NEVER summarize or combine multiple bullets into one

2. For work experience, separate the role summary from specific achievements:
   - "summary": A paragraph describing overall responsibilities (NO bullets, just plain text)
   - "keyContributions": An array containing EVERY achievement/bullet point (each item is PLAIN TEXT without bullet symbols)

3. DO NOT include bullet point symbols (•, -, *, etc.) in the keyContributions array - just the text content

4. Extract all information accurately. If a field is not found, use an empty string or empty array.

5. PRESERVE DOCUMENT ORDER AND JOB INTEGRITY - THIS IS CRITICAL:
   - Jobs MUST appear in the EXACT same order as they appear in the resume document
   - The first job listed in the resume = the first item in the experience array
   - Do NOT reorder jobs by date or any other criteria

   CRITICAL - KEEP EACH JOB AS A COMPLETE UNIT:
   - Each job block in the resume contains: company name, job title, date range, and bullet points
   - ALL of these elements belong together and must stay together in your output
   - Read each job block top-to-bottom: the company/title at the top of that block owns ALL the bullets beneath it until the next job block starts
   - The bullets/achievements listed under a company belong to THAT company, not to any other company
   - NEVER separate a company's name from its own bullets
   - NEVER assign one company's bullets to a different company

6. Each bullet point from the original resume becomes ONE item in keyContributions - never merge them.

7. CERTIFICATIONS - Extract ALL certifications:
   - Look for sections labeled "Certifications", "Licenses", "Credentials", "Professional Certifications"
   - Extract each certification with its name, issuing organization, and date
   - Common issuers: Salesforce, Google, AWS, Microsoft, HubSpot, etc.
   - Do NOT put certifications in the achievements array - they go in the certifications array`;

        const MAX_RETRIES = 2;
        let parsedData: ParsedResume | null = null;
        let validationResult: ValidationResult | null = null;
        let lastValidationErrors: string[] = [];

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          // Build prompt with validation feedback on retry
          let retryFeedback = '';
          if (attempt > 0 && lastValidationErrors.length > 0) {
            retryFeedback = `

=== PREVIOUS ATTEMPT FAILED VALIDATION ===
${lastValidationErrors.map((e) => `- ${e}`).join('\n')}
Please fix these issues. Make sure to capture ALL content.
=== END VALIDATION FEEDBACK ===`;
          }

          const fullPrompt = prompt + retryFeedback;

          log.info(`AI parsing attempt ${attempt + 1}/${MAX_RETRIES + 1}`, {
            event: 'ai.attempt',
            extra: { attempt, hasRetryFeedback: attempt > 0 },
          });

          const response = await client.chat.completions.create({
            model: 'gpt-5',
            messages: [
              {
                role: 'system',
                content:
                  'You are a professional resume parser. Extract ALL content from the resume - do not truncate or skip any bullet points. CRITICAL: Keep each job as a complete unit - the company name, job title, dates, and all bullets must stay together as they appear in the document. Never swap content between jobs. Output only valid JSON with the exact structure requested.',
              },
              { role: 'user', content: fullPrompt },
            ],
            response_format: { type: 'json_object' },
            // Note: GPT-5 does not support temperature parameter
            max_tokens: 16000, // Increased to ensure all content is captured
          });

          const content = response.choices[0]?.message?.content || '{}';

          // Parse JSON with error handling
          try {
            parsedData = JSON.parse(content) as ParsedResume;
          } catch (parseError) {
            log.warn('Failed to parse AI response as JSON', {
              event: 'ai.json_parse_error',
              extra: { attempt, contentPreview: content.substring(0, 200) },
            });
            lastValidationErrors = ['AI returned invalid JSON'];
            if (attempt < MAX_RETRIES) continue;
            throw new Error('Failed to parse AI response as JSON');
          }

          const jobBlockExperience = parseExperienceFromJobBlocks(groundTruth.jobBlocks);
          if (jobBlockExperience.length > 0) {
            parsedData.experience = jobBlockExperience;
            log.debug('Experience rebuilt from job blocks', {
              event: 'experience.job_blocks',
              extra: {
                jobBlocksCount: groundTruth.jobBlocks.length,
                experienceCount: jobBlockExperience.length,
              },
            });
          }

          // Validate against ground truth
          validationResult = validateParsedResume(parsedData, groundTruth);

          log.info('Validation result', {
            event: 'validation.result',
            extra: {
              attempt,
              isValid: validationResult.isValid,
              errors: validationResult.errors,
              warnings: validationResult.warnings,
              stats: validationResult.stats,
            },
          });

          if (validationResult.isValid) {
            log.info(`AI parsing succeeded on attempt ${attempt + 1}`, {
              event: 'ai.success',
              extra: { attempt },
            });
            break;
          }

          // Store errors for retry feedback
          lastValidationErrors = validationResult.errors;

          if (attempt < MAX_RETRIES) {
            log.warn('Validation failed, retrying', {
              event: 'validation.retry',
              extra: { attempt, errors: validationResult.errors },
            });
          }
        }

        log.info('OpenAI resume parsing completed', { event: 'ai.response' });

        // Handle case where no valid parse was obtained (shouldn't happen but be safe)
        if (!parsedData) {
          log.error('No parsed data after all attempts', 'PARSE_FAILED', {
            event: 'ai.parse.failed',
          });
          throw new Error('Failed to parse resume after multiple attempts');
        }

        // Evaluate AI-parsed resume (non-blocking for now)
        try {
          const evalResult = await evaluate({
            tool_id: 'resume-parse',
            input: { resumeText },
            output: parsedData as unknown as Record<string, unknown>,
          });

          if (!evalResult.passed) {
            log.warn('Resume parsing failed AI evaluation', {
              event: 'ai.evaluation.failed',
              extra: {
                score: evalResult.overall_score,
                riskFlagsCount: evalResult.risk_flags?.length ?? 0,
              },
            });
          }
        } catch (evalError) {
          // Don't block on evaluation failures
          log.warn('Error evaluating resume parsing', {
            event: 'ai.evaluation.error',
            errorCode: toErrorCode(evalError),
          });
        }

        const durationMs = Date.now() - startTime;
        log.info('Resume parse request completed', {
          event: 'request.success',
          httpStatus: 200,
          durationMs,
          extra: {
            validationPassed: validationResult?.isValid ?? false,
            bulletsCaptured: validationResult?.stats.actualBullets ?? 0,
            bulletsExpected: validationResult?.stats.expectedBullets ?? 0,
          },
        });

        // Build response with validation metadata
        const responseData: Record<string, unknown> = {
          success: true,
          data: parsedData,
        };

        // Include validation stats and warnings for debugging/transparency
        if (validationResult) {
          responseData.validation = {
            passed: validationResult.isValid,
            stats: validationResult.stats,
            warnings: validationResult.warnings,
          };

          // If validation ultimately failed, include errors as warnings in response
          if (!validationResult.isValid) {
            responseData.warning = `Parsing may be incomplete: ${validationResult.errors.join('; ')}`;
          }
        }

        return NextResponse.json(responseData, {
          headers: { 'x-correlation-id': correlationId },
        });
      } catch (aiError: any) {
        log.warn('AI parsing error, falling back to regex parser', {
          event: 'ai.fallback',
          errorCode: toErrorCode(aiError),
        });
        // Fallback to basic parsing
        const fallbackData = fallbackParser(resumeText);
        const durationMs = Date.now() - startTime;
        log.info('Resume parse completed with fallback', {
          event: 'request.success',
          httpStatus: 200,
          durationMs,
          extra: { method: 'fallback' },
        });
        return NextResponse.json(
          {
            success: true,
            data: fallbackData,
            warning: 'Used fallback parsing due to AI service error',
          },
          {
            headers: { 'x-correlation-id': correlationId },
          },
        );
      }
    }

    // No OpenAI key: use fallback parser
    log.info('No OpenAI key, using fallback parser', { event: 'ai.not_configured' });
    const fallbackData = fallbackParser(resumeText);
    const durationMs = Date.now() - startTime;
    log.info('Resume parse completed with fallback', {
      event: 'request.success',
      httpStatus: 200,
      durationMs,
      extra: { method: 'fallback' },
    });
    return NextResponse.json(
      {
        success: true,
        data: fallbackData,
        warning: 'OpenAI API key not configured, using basic parsing',
      },
      {
        headers: { 'x-correlation-id': correlationId },
      },
    );
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    log.error('Resume parse request failed', toErrorCode(err), {
      event: 'request.error',
      httpStatus: 500,
      durationMs,
    });
    return NextResponse.json(
      { error: 'Failed to parse resume' },
      {
        status: 500,
        headers: { 'x-correlation-id': correlationId },
      },
    );
  }
}
